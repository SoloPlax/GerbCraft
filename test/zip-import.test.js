import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readImportFiles } from "../electron/import-files.cjs";
import { zip } from "./helpers/zip.js";
import { parseGerber } from "../src/core/gerber.js";
import { parseDrill } from "../src/core/drill.js";
const artwork = await fs.readFile("test/fixtures/transform.gbr", "utf8");
async function withZip(entries, fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gc-zip-"));
  const file = path.join(dir, "Board.ZIP");
  try {
    await fs.writeFile(file, zip(entries));
    await fn(file);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
test("ZIP imports nested artwork and text-named drills, skips supporting files, preserves duplicate basenames", async () => {
  await withZip(
    [
      { name: "top/COPPER.GBR", text: artwork },
      { name: "bottom/COPPER.GBR", text: artwork, stored: true },
      {
        name: "drills.txt",
        text: "M48\nMETRIC,TZ\nT01C0.8\n%\nT01\nX1.0Y2.0\nM30",
      },
      { name: "notes.txt", text: "Manufacturing notes" },
      { name: "__MACOSX/._top.gbr", text: "junk" },
      { name: "drawing.pdf", text: "%PDF" },
      { name: "unusual", text: artwork },
    ],
    async (file) => {
      const result = await readImportFiles([file]);
      assert.equal(result.files.length, 4);
      assert.equal(result.skipped.length, 3);
      assert.equal(result.files[2].kind, "drill");
      assert.equal(result.files[0].name, "top/COPPER.GBR");
      assert.equal(result.files[1].name, "bottom/COPPER.GBR");
      assert.equal(parseGerber(result.files[0].text).objects.length, 5);
      assert.equal(parseDrill(result.files[2].text).objects.length, 1);
    },
  );
});
test("ZIP rejects corrupt, encrypted, unsafe, linked, oversized and falsified entries", async () => {
  for (const entry of [
    { name: "bad.gbr", text: artwork, badCRC: true },
    { name: "secret.gbr", text: artwork, encrypted: true },
    { name: "../bad.gbr", text: artwork },
    { name: "/bad.gbr", text: artwork },
    { name: "link.gbr", text: "somewhere", symlink: true },
    { name: "large.gbr", size: 51 * 1024 * 1024 },
    { name: "lie.gbr", text: artwork, size: 2 },
  ])
    await withZip([entry], (file) => assert.rejects(readImportFiles([file])));
});
test("ZIP rejects empty/no-artwork, malformed archives and too many layers", async () => {
  await withZip([{ name: "notes.txt", text: "No artwork" }], (file) =>
    assert.rejects(readImportFiles([file]), /No Gerber/),
  );
  await withZip([], async (file) => {
    await fs.writeFile(file, "broken archive");
    await assert.rejects(readImportFiles([file]));
  });
  await withZip(
    Array.from({ length: 257 }, (_, i) => ({
      name: `${i}.gbr`,
      text: artwork,
    })),
    (file) => assert.rejects(readImportFiles([file]), /256 layers/),
  );
});
test("original PCB ZIP imports all 11 layers and 381 holes without manufacturing notes", async (t) => {
  const file = "Sample_Gerber_Files/PCB-11-23001 Rev 1.zip";
  if (!(await fs.stat(file).catch(() => null)))
    return t.skip("Private sample unavailable");
  const result = await readImportFiles([file]);
  const layers = result.files.map((f) =>
    f.kind === "drill"
      ? parseDrill(f.text, f.name)
      : parseGerber(f.text, f.name),
  );
  assert.equal(layers.length, 11);
  assert.equal(
    layers.reduce((n, l) => n + l.objects.length, 0),
    12818,
  );
  assert.equal(
    layers
      .filter((_, i) => result.files[i].kind === "drill")
      .reduce((n, l) => n + l.objects.length, 0),
    381,
  );
  assert.equal(result.skipped.length, 1);
});
