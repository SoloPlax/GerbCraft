import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { parseGerber, exportGerber } from "../src/core/gerber.js";
import { EditorDocument, validateDocument } from "../src/core/document.js";
import { objectBounds, unionBounds } from "../src/core/geometry.js";
const source = process.argv[2];
if (!source) throw Error("Supply an extracted Gerber folder.");
const output = path.resolve(source, "../GerbCraft-Test-Results");
fs.mkdirSync(output, { recursive: true });
const layers = [],
  report = [];
let maxError = 0;
function compare(a, b, at = "") {
  if (typeof a === "number") {
    assert.equal(typeof b, "number", at);
    const error = Math.abs(a - b);
    maxError = Math.max(maxError, error);
    assert.ok(error <= 0.000002, `${at}: ${a} vs ${b}`);
  } else if (Array.isArray(a)) {
    assert.equal(a.length, b.length, at);
    a.forEach((v, i) => compare(v, b[i], `${at}[${i}]`));
  } else if (a && typeof a === "object") {
    for (const key of Object.keys(a).filter((k) => k !== "id"))
      compare(a[key], b[key], `${at}.${key}`);
  } else assert.equal(a, b, at);
}
for (const name of fs
  .readdirSync(source)
  .filter((n) => n.toLowerCase().endsWith(".gbr"))
  .sort()) {
  const start = performance.now();
  const layer = parseGerber(
    fs.readFileSync(path.join(source, name), "utf8"),
    name,
  );
  const exported = exportGerber(layer.objects, { name });
  const again = parseGerber(exported, name);
  compare(layer.objects, again.objects, name);
  layers.push(layer);
  fs.writeFileSync(path.join(output, name), exported);
  report.push({
    name,
    objects: layer.objects.length,
    kinds: layer.objects.reduce(
      (a, o) => ((a[o.kind] = (a[o.kind] || 0) + 1), a),
      {},
    ),
    bounds: unionBounds(layer.objects.map(objectBounds)),
    milliseconds: Math.round(performance.now() - start),
    roundtrip: "pass",
    warnings: layer.warnings,
  });
}
const doc = new EditorDocument();
doc.addLayers(layers);
doc.data.name = path.basename(source);
for (const l of doc.data.layers) {
  l.visible = /-F_Cu\.|-F_Silkscreen\.|-Edge_Cuts\./.test(l.name);
  if (/-F_Cu\./.test(l.name)) l.color = "#377b6f";
  if (/-F_Silkscreen\./.test(l.name)) l.color = "#f5f0d5";
  if (/-Edge_Cuts\./.test(l.name)) l.color = "#f5b65a";
}
validateDocument(doc.data);
fs.writeFileSync(
  path.join(output, doc.data.name + ".gcraft"),
  JSON.stringify(doc.data),
);
const summary = {
  source: path.resolve(source),
  layers: report.length,
  totalObjects: layers.reduce((s, l) => s + l.objects.length, 0),
  maxNumericError: maxError,
  tolerance: 0.000002,
  scope:
    "Same-parser round trip compares primitive structure and numeric fields; not independent manufacturing validation. Drill files not imported. X2 metadata is omitted by export.",
  results: report,
};
fs.writeFileSync(
  path.join(output, "report.json"),
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify({
    output,
    layers: summary.layers,
    objects: summary.totalObjects,
    maxNumericError: maxError,
  }),
);
