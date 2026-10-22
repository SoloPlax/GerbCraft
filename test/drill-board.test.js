import test from "node:test";
import assert from "node:assert/strict";
import { parseDrill, exportDrill } from "../src/core/drill.js";
import { EditorDocument, validateDocument } from "../src/core/document.js";
import {
  boardSettings,
  buildBoard,
  outlineRings,
  drillRing,
} from "../src/core/board3d.js";
import { circleAperture, objectBounds } from "../src/core/geometry.js";
import { exportGerber } from "../src/core/gerber.js";
const fixture = (
  body,
  header = "METRIC,TZ",
  format = "; FORMAT={3:3/ absolute / metric / suppress leading zeros}",
) =>
  `M48\n${format}\n; #@! TF.FileFunction,Plated,1,2,PTH\n${header}\nT1C1.000\n%\nG90\nG05\nT1\n${body}\nM30\n`;
const normalized = (os) =>
  os.map(({ at, end, diameter, plating, span }) => ({
    at,
    end,
    diameter,
    plating,
    span,
  }));
const lines = (points) =>
  points.map((p, i) => ({
    id: crypto.randomUUID(),
    kind: "line",
    polarity: "dark",
    start: { x: p[0], y: p[1] },
    end: {
      x: points[(i + 1) % points.length][0],
      y: points[(i + 1) % points.length][1],
    },
    aperture: circleAperture(0.2),
  }));
const square = () =>
  lines([
    [0, 0],
    [20, 0],
    [20, 10],
    [0, 10],
  ]);
const hole = (x, y, d = 1) => ({
  at: { x, y },
  diameter: d,
  plating: "plated",
  span: "through",
});
test("Excellon decimal, TZ, LZ, omitted axes, inch and G85 slots", () => {
  const a = parseDrill(fixture("X1500Y-2000\nX2500\nX3.5Y4.0G85X5.5Y4.0"));
  assert.deepEqual(a.objects[0].at, { x: 1.5, y: -2 });
  assert.deepEqual(a.objects[1].at, { x: 2.5, y: -2 });
  assert.deepEqual(a.objects[2].end, { x: 5.5, y: 4 });
  assert.deepEqual(
    normalized(parseDrill(exportDrill(a.objects)).objects),
    normalized(a.objects),
  );
  assert.deepEqual(
    parseDrill(fixture("X0015Y002", "METRIC,LZ")).objects[0].at,
    { x: 1.5, y: 2 },
  );
  const inch = parseDrill(fixture("X1.0Y-0.5", "INCH,TZ", ""));
  assert.deepEqual(inch.objects[0].at, { x: 25.4, y: -12.7 });
  assert.equal(inch.objects[0].diameter, 25.4);
});
test("ambiguous, incremental, routing, undefined tool, malformed and blind drills fail", () => {
  for (const text of [
    fixture("X123Y456", "METRIC,TZ", ""),
    fixture("G91\nX1.0Y2.0"),
    fixture("G00X1.0Y2.0"),
    fixture("T2\nX1.0Y2.0"),
    fixture("R3X1Y1"),
    fixture("X1Y1").replace("Plated,1,2", "Plated,2,3"),
    fixture("X1Y1").replace("M30", ""),
  ])
    assert.throws(() => parseDrill(text));
});
test("drill edits are local; transform, copy, delete and history preserve slots and artwork", () => {
  const d = new EditorDocument();
  d.addLayers([{ name: "Edge_Cuts.gbr", objects: square() }]);
  const artwork = structuredClone(d.data.layers[0]);
  d.addDrill("", hole(2, 3));
  const l = d.data.layers[1];
  d.addDrill(l.id, { ...hole(6, 3), end: { x: 8, y: 3 } });
  d.selected = new Set([d.key(l, l.objects[0])]);
  d.editDrills({ diameter: 2 });
  assert.equal(l.objects[1].diameter, 1);
  d.undo();
  assert.equal(d.data.layers[1].objects[0].diameter, 1);
  d.redo();
  assert.equal(d.data.layers[1].objects[0].diameter, 2);
  d.selectAll();
  d.data.layers[0].locked = true;
  d.prune();
  d.transform({ angle: 90, origin: { x: 0, y: 0 } });
  assert.ok(Math.abs(d.data.layers[1].objects[1].end.x + 3) < 1e-10);
  d.undo();
  d.transform({ mirror: "x", origin: { x: 0, y: 0 } }, true);
  assert.equal(d.data.layers[1].objects.length, 4);
  d.undo();
  d.deleteSelected();
  assert.equal(d.data.layers[1].objects.length, 0);
  d.undo();
  assert.equal(d.data.layers[1].objects.length, 2);
  d.data.layers[0].locked = false;
  assert.deepEqual(d.data.layers[0], artwork);
  validateDocument(d.data);
  assert.throws(() => exportGerber(d.objects()), /Export drills/);
  const original = structuredClone(d.data);
  assert.throws(() => d.editDrills({ diameter: -1 }));
  assert.deepEqual(d.data, original);
});
test("patch history keeps imported snapshots independent of later edits", () => {
  const d = new EditorDocument();
  d.addLayers([{ name: "outline", objects: square() }]);
  d.commit("Rename", (d) => (d.layers[0].name = "Changed"));
  d.undo();
  d.undo();
  d.redo();
  assert.equal(d.data.layers[0].name, "outline");
  d.redo();
  assert.equal(d.data.layers[0].name, "Changed");
  d.commit("Delete layer", (d) => (d.layers = []));
  d.undo();
  assert.equal(d.data.layers[0].name, "Changed");
});
test("board subtracts nested cutout and overlapping hole geometry; mesh area is accurate", () => {
  const d = new EditorDocument();
  d.addLayers([
    {
      name: "Edge_Cuts.gbr",
      objects: [
        ...square(),
        ...lines([
          [8, 2],
          [12, 2],
          [12, 4],
          [8, 4],
        ]),
      ],
    },
  ]);
  d.addDrill("", hole(3, 3, 2));
  d.addDrill(d.data.layers[1].id, hole(3, 3, 2));
  d.data.board = boardSettings(d.data);
  const original = JSON.stringify(d.data),
    b = buildBoard(d.data),
    area = b.triangles.reduce(
      (sum, [a, b, c]) =>
        sum +
        Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2,
      0,
    );
  assert.ok(Math.abs(area - (200 - 8 - Math.PI)) < 0.03);
  assert.equal(b.rings.length, 2);
  assert.equal(JSON.stringify(d.data), original);
  assert.deepEqual(b.bounds, { minX: 0, maxX: 20, minY: 0, maxY: 10 });
  d.data.layers.forEach((l) => (l.visible = false));
  assert.deepEqual(buildBoard(d.data).triangles, b.triangles);
});
test("open, branched, self-crossing or touching profiles fail; submicron endpoint mismatch accepted", () => {
  assert.throws(() => outlineRings(square().slice(1)), /open/);
  assert.throws(
    () =>
      outlineRings(
        lines([
          [0, 0],
          [10, 10],
          [0, 10],
          [10, 0],
        ]),
      ),
    /cross/,
  );
  const s = square();
  s[1].start.x += 0.000024;
  assert.equal(outlineRings(s).length, 1);
  s[1].start.x += 0.01;
  assert.throws(() => outlineRings(s));
});
test("slot polygon bounds include rounded ends and diameter", () => {
  const o = { kind: "drill", ...hole(2, 3, 2), end: { x: 6, y: 3 } },
    ring = drillRing(o),
    b = objectBounds(o);
  assert.equal(b.minX, 1);
  assert.equal(b.maxX, 7);
  assert.ok(Math.abs(Math.min(...ring.map((p) => p[0])) - 1) < 0.01);
  assert.ok(Math.abs(Math.max(...ring.map((p) => p[1])) - 4) < 0.01);
});
test("v1 projects still load, v2 setup and drills persist, malformed setup fails", () => {
  const d = new EditorDocument();
  d.addLayers([{ name: "Edge_Cuts.gbr", objects: square() }]);
  assert.equal(d.data.version, 1);
  validateDocument(d.data);
  d.addDrill("", hole(2, 2));
  d.data.board = boardSettings(d.data);
  const copy = new EditorDocument();
  copy.load(JSON.parse(JSON.stringify(d.data)));
  assert.deepEqual(copy.data, d.data);
  copy.data.board.thickness = 0;
  assert.throws(() => validateDocument(copy.data));
});
