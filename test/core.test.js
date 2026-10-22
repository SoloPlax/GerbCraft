import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseGerber, exportGerber, expression } from "../src/core/gerber.js";
import {
  transformObject,
  circularWidth,
  objectBounds,
} from "../src/core/geometry.js";
import { EditorDocument, validateDocument } from "../src/core/document.js";
const fixture = (n) =>
  fs.readFileSync(new URL("./fixtures/" + n + ".gbr", import.meta.url), "utf8");
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);
function compare(a, b) {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].kind, b[i].kind);
    assert.equal(a[i].polarity, b[i].polarity);
    const x = objectBounds(a[i]),
      y = objectBounds(b[i]);
    for (const k in x) near(x[k], y[k], 2e-6);
    if (a[i].center) {
      near(a[i].center.x, b[i].center.x);
      near(a[i].center.y, b[i].center.y);
      assert.equal(a[i].cw, b[i].cw);
    }
  }
}
for (const n of ["arcs", "regions", "macros", "transform"])
  test(n + " roundtrip preserves geometry and polarity", () => {
    const a = parseGerber(fixture(n)).objects,
      b = parseGerber(exportGerber(a)).objects;
    compare(a, b);
  });
test("arcs retain circular interpolation and direction", () => {
  const a = parseGerber(fixture("arcs")).objects;
  assert.equal(a[0].cw, true);
  assert.equal(a[1].cw, false);
  near(a[0].center.x, 3);
  near(a[0].center.y, 3);
  const text = exportGerber(a);
  assert.match(text, /G02/);
  assert.match(text, /G03/);
  assert.doesNotMatch(text, /%AM/);
});
for (const angle of [45, 90, 123.456])
  test(`rotation ${angle} preserves circles and roundtrips`, () => {
    const a = parseGerber(fixture("transform")).objects.map((o) =>
      transformObject(o, { angle, origin: { x: 4.25, y: 3.9 } }),
    );
    const txt = exportGerber(a),
      b = parseGerber(txt).objects;
    compare(a, b);
    assert.equal(
      b.filter((o) => o.kind === "flash" && circularWidth(o.aperture) !== null)
        .length,
      2,
    );
    assert.equal(b.filter((o) => o.kind === "line").length, 2);
    const c = a.map((o) =>
      transformObject(o, { angle: -angle, origin: { x: 4.25, y: 3.9 } }),
    );
    compare(c, parseGerber(fixture("transform")).objects);
  });
for (const mirror of ["x", "y", "xy"])
  test("double mirror " + mirror + " restores arcs", () => {
    const a = parseGerber(fixture("arcs")).objects,
      t = { mirror, origin: { x: 2, y: 3 } },
      b = a.map((o) => transformObject(transformObject(o, t), t));
    compare(a, b);
  });
test("macro expression precedence, variables and rejection", () => {
  near(expression("($1+2)x3-4/2", { $1: 2 }), 10);
  assert.throws(() => expression("process.exit()"));
  assert.throws(() => expression("1/0"));
});
const wrap = (s) =>
  "%FSLAX24Y24*%\n%MOMM*%\n%ADD10C,1*%\nD10*\n" + s + "\nM02*";
test("clear polarity and circular aperture hole retained", () => {
  const a = parseGerber(wrap("X0Y0D03*\n%LPC*%\nX10000Y0D03*")).objects;
  assert.equal(a[1].polarity, "clear");
  compare(a, parseGerber(exportGerber(a)).objects);
  const hole = parseGerber(
    "%FSLAX24Y24*%%MOMM*%%ADD10C,2X1*%D10*X0Y0D03*M02*",
  ).objects;
  assert.equal(hole[0].aperture.components[1].dark, false);
  compare(hole, parseGerber(exportGerber(hole)).objects);
});
test("inch trailing-zero incremental coordinates", () => {
  const a = parseGerber(
    "%FSTIX24Y24*%%MOIN*%%ADD10C,0.01*%D10*X01Y01D03*X01Y0D03*M02*",
  ).objects;
  near(a[0].at.x, 25.4);
  near(a[1].at.x, 50.8);
  near(a[1].at.y, 25.4);
});
test("step repeat expands with declared offsets", () => {
  const a = parseGerber(wrap("%SRX2Y3I5J4*%\nX10000Y20000D03*\n%SR*%")).objects;
  assert.equal(a.length, 6);
  near(a[5].at.x, 6);
  near(a[5].at.y, 10);
});
test("parameterized macro supports safe assignment and clear circle", () => {
  const s =
    "%FSLAX24Y24*%%MOMM*%%AMTEST*$2=$1/2*1,1,$1,0,0*1,0,$2,0,0*%%ADD10TEST,2*%D10*X0Y0D03*M02*";
  const a = parseGerber(s).objects;
  near(a[0].aperture.components[0].diameter, 2);
  near(a[0].aperture.components[1].diameter, 1);
  compare(a, parseGerber(exportGerber(a)).objects);
});
test("region with curved contour and hole roundtrips", () => {
  const s = wrap(
    "G75*G36*G01X0Y0D02*X40000Y0D01*G03X40000Y40000I0J20000D01*G01X0Y40000D01*X0Y0D01*X10000Y10000D02*X10000Y20000D01*X20000Y20000D01*X20000Y10000D01*X10000Y10000D01*G37*",
  );
  const a = parseGerber(s).objects;
  assert.equal(a[0].contours.length, 2);
  compare(a, parseGerber(exportGerber(a)).objects);
});
test("single quadrant arc resolves centre", () => {
  const a = parseGerber(
    wrap("G74*X10000Y0D02*G03X0Y10000I10000J0D01*"),
  ).objects;
  near(a[0].center.x, 0);
  near(a[0].center.y, 0);
});
test("full circle retains endpoints and radius", () => {
  const a = parseGerber(
    wrap("G75*X10000Y0D02*G03X10000Y0I-10000J0D01*"),
  ).objects;
  compare(a, parseGerber(exportGerber(a)).objects);
  const b = objectBounds(a[0]);
  near(b.minX, -1.5);
  near(b.maxY, 1.5);
});
test("unknown commands never silently disappear", () => {
  for (const s of [
    wrap("%AB D11*%X0Y0D03*"),
    wrap("%IPNEG*%X0Y0D03*"),
    wrap("G99X0Y0D03*"),
    wrap("X0Y0D03*").replace("M02*", ""),
  ])
    assert.throws(() => parseGerber(s));
});
test("noncircular draws and malformed arc rejected", () => {
  assert.throws(() => parseGerber(wrap("X0Y0D02*G02X10000Y0I0J0D01*")));
  assert.throws(() =>
    parseGerber(wrap("X0Y0D02*X10000Y0D01*").replace("ADD10C,1", "ADD10R,1X2")),
  );
});
test("three-step history with redo and branch reset", () => {
  const d = new EditorDocument();
  d.addLayers([parseGerber(fixture("transform"))]);
  d.markSaved();
  const baseline = structuredClone(d.data);
  d.selectAll();
  d.transform({ dx: 2.54 });
  d.transform({ dy: 2.54 }, true);
  assert.equal(d.objects().length, 10);
  d.selectAll();
  d.deleteSelected();
  assert.equal(d.objects().length, 0);
  d.undo();
  assert.equal(d.objects().length, 10);
  d.undo();
  assert.equal(d.objects().length, 5);
  d.undo();
  assert.deepEqual(d.data, baseline);
  assert.equal(d.dirty, false);
  d.redo();
  near(d.objects()[0].at.x, 4.54);
  d.undo();
  d.selectAll();
  d.transform({ dy: 1 });
  assert.equal(d.redoStack.length, 0);
});
test("hidden and locked layers cannot be edited", () => {
  const d = new EditorDocument();
  d.addLayers([parseGerber(fixture("transform"))]);
  d.data.layers[0].locked = true;
  d.selectAll();
  assert.equal(d.selected.size, 0);
  assert.throws(() => d.transform({ dx: 1 }));
  d.data.layers[0].locked = false;
  d.selectAll();
  d.data.layers[0].visible = false;
  d.deleteSelected();
  assert.equal(d.data.layers[0].objects.length, 5);
  assert.equal(d.objects().length, 0);
});
test("failed edit is atomic", () => {
  const d = new EditorDocument();
  d.addLayers([parseGerber(fixture("transform"))]);
  const before = structuredClone(d.data);
  assert.throws(() =>
    d.commit("bad", (x) => {
      x.name = "corrupted";
      throw Error("no");
    }),
  );
  assert.deepEqual(d.data, before);
});
test("project validation roundtrip and malicious data rejection", () => {
  const d = new EditorDocument();
  d.addLayers([parseGerber(fixture("arcs")), parseGerber(fixture("regions"))]);
  assert.deepEqual(
    validateDocument(JSON.parse(JSON.stringify(d.data))),
    d.data,
  );
  const bad = structuredClone(d.data);
  bad.layers[0].objects[0].start.x = null;
  assert.throws(() => validateDocument(bad));
});
