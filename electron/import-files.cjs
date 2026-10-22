const fs = require("node:fs/promises");
const path = require("node:path");
const { crc32 } = require("node:zlib");
const yauzl = require("yauzl");
const FILE_LIMIT = 50 * 1024 * 1024;
const TOTAL_LIMIT = 100 * 1024 * 1024;
const LAYER_LIMIT = 256;
const GERBER =
  /\.(gbr|ger|gerber|gbx|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gko|gml|gm\d+|g\d+|pho|art)$/i;
const DRILL = /\.(drl|xln|exc)$/i;
function kindOf(name, text) {
  if (DRILL.test(name) || /^\s*M48\s*$/m.test(text)) return "drill";
  if (GERBER.test(name) || /%(?:FS[LT]|MO(?:MM|IN)|ADD\d)/.test(text))
    return "gerber";
  return null;
}
function decode(data, name) {
  if (data.includes(0)) throw Error(`${name}: expected a text artwork file.`);
  return data.toString("utf8").replace(/^\uFEFF/, "");
}
async function readZip(filePath, budget) {
  if ((await fs.stat(filePath)).size > TOTAL_LIMIT)
    throw Error("ZIP exceeds 100 MB.");
  return new Promise((resolve, reject) => {
    yauzl.open(
      filePath,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zip) => {
        if (err) return reject(err);
        let stopped = false,
          entries = 0;
        const files = [],
          skipped = [];
        const fail = (error) => {
          if (stopped) return;
          stopped = true;
          zip.close();
          reject(error);
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (!stopped) resolve({ files, skipped });
        });
        zip.on("entry", async (entry) => {
          try {
            if (++entries > 4096)
              throw Error("ZIP contains more than 4,096 entries.");
            const name = entry.fileName;
            if (
              name.includes("\0") ||
              name.split("/").includes("..") ||
              path.posix.isAbsolute(name)
            )
              throw Error("ZIP contains an unsafe file name.");
            if (((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000)
              throw Error(`ZIP links are unsupported: ${name}`);
            if (name.endsWith("/")) {
              zip.readEntry();
              return;
            }
            // Finder metadata and supporting documents are not artwork layers.
            const meta = name
              .split("/")
              .some((n) => n === "__MACOSX" || n.startsWith("."));
            const candidate =
              !meta &&
              (GERBER.test(name) ||
                DRILL.test(name) ||
                /\.(txt|dat)$/i.test(name) ||
                !path.posix.extname(name));
            if (!candidate) {
              skipped.push(name);
              zip.readEntry();
              return;
            }
            if (entry.generalPurposeBitFlag & 1)
              throw Error(
                `Password-protected ZIP files are unsupported: ${name}`,
              );
            if (entry.uncompressedSize > FILE_LIMIT)
              throw Error(`${name}: file exceeds 50 MB.`);
            budget.bytes += entry.uncompressedSize;
            if (budget.bytes > TOTAL_LIMIT)
              throw Error("Import exceeds 100 MB of uncompressed text.");
            const stream = await new Promise((res, rej) =>
              zip.openReadStream(entry, (e, s) => (e ? rej(e) : res(s))),
            );
            const chunks = [];
            let size = 0;
            for await (const chunk of stream) {
              size += chunk.length;
              if (size > entry.uncompressedSize || size > FILE_LIMIT)
                throw Error(`${name}: invalid expanded size.`);
              chunks.push(chunk);
            }
            const data = Buffer.concat(chunks);
            if (size !== entry.uncompressedSize || crc32(data) !== entry.crc32)
              throw Error(`${name}: ZIP integrity check failed.`);
            const text = decode(data, name),
              kind = kindOf(name, text);
            if (kind) {
              if (++budget.layers > LAYER_LIMIT)
                throw Error("Open at most 256 layers.");
              files.push({ name, text, kind });
            } else skipped.push(name);
            zip.readEntry();
          } catch (error) {
            fail(error);
          }
        });
        zip.readEntry();
      },
    );
  });
}
async function readImportFiles(paths) {
  if (paths.length > LAYER_LIMIT) throw Error("Select at most 256 files.");
  const result = { files: [], skipped: [] },
    budget = { bytes: 0, layers: 0 };
  for (const p of paths) {
    try {
      if (/\.zip$/i.test(p)) {
        const archive = await readZip(p, budget);
        if (!archive.files.length)
          throw Error("No Gerber or Excellon drill files found in ZIP.");
        result.files.push(...archive.files);
        result.skipped.push(
          ...archive.skipped.map((n) => `${path.basename(p)} / ${n}`),
        );
      } else {
        const size = (await fs.stat(p)).size;
        if (size > FILE_LIMIT) throw Error("File exceeds 50 MB.");
        budget.bytes += size;
        if (budget.bytes > TOTAL_LIMIT)
          throw Error("Import exceeds 100 MB of text.");
        if (++budget.layers > LAYER_LIMIT)
          throw Error("Open at most 256 layers.");
        const name = path.basename(p),
          text = decode(await fs.readFile(p), name);
        result.files.push({ name, text, kind: kindOf(name, text) || "gerber" });
      }
    } catch (e) {
      throw Error(`${path.basename(p)}: ${e.message}`);
    }
  }
  return result;
}
module.exports = { readImportFiles };
