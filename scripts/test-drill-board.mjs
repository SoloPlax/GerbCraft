// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import fs from "node:fs/promises";
import { parseGerber } from "../src/core/gerber.js";
import { parseDrill, exportDrill } from "../src/core/drill.js";
import { EditorDocument, validateDocument } from "../src/core/document.js";
import { boardSettings, buildBoard } from "../src/core/board3d.js";
import assert from "node:assert/strict";
const dir = "Sample_Gerber_Files/PCB-11-23001 Rev 1",
  output = "Sample_Gerber_Files/GerbCraft-Test-Results",
  d = new EditorDocument();
const layers = [];
for (const name of (await fs.readdir(dir)).filter((n) =>
  /\.(gbr|drl)$/.test(n),
)) {
  const text = await fs.readFile(dir + "/" + name, "utf8");
  layers.push(
    name.endsWith(".drl") ? parseDrill(text, name) : parseGerber(text, name),
  );
}
d.addLayers(layers);
d.data.name = "PCB-11-23001 Rev 1 — Drills and 3D";
d.data.board = { ...boardSettings(d.data), thickness: 1.55 };
for (const l of d.data.layers) {
  l.visible = ["top-copper", "top-silk", "outline", "drill"].includes(
    d.data.board.roles[l.id],
  );
  if (l.type === "drill") l.color = "#7acbff";
}
validateDocument(d.data);
const b = buildBoard(d.data),
  report = {
    drillCount: b.drills.length,
    plated: b.drills.filter((o) => o.plating === "plated").length,
    nonPlated: b.drills.filter((o) => o.plating === "non-plated").length,
    notesHoleCount: 239,
    holeCountDifference: b.drills.length - 239,
    profileDimensions: {
      width: b.bounds.maxX - b.bounds.minX,
      height: b.bounds.maxY - b.bounds.minY,
    },
    nominalNotesDimensions: { width: 190, height: 163 },
    thickness: b.setup.thickness,
    profileContours: b.rings.length,
    triangles: b.triangles.length,
    warnings: b.warnings,
    roundtrips: [],
  };
for (const l of d.data.layers.filter((l) => l.type === "drill")) {
  const text = exportDrill(l.objects),
    parsed = parseDrill(text),
    normalize = (os) =>
      os.map(({ at, end, diameter, plating, span }) => ({
        at,
        end,
        diameter,
        plating,
        span,
      }));
  assert.deepEqual(normalize(parsed.objects), normalize(l.objects));
  report.roundtrips.push({
    name: l.name,
    count: parsed.objects.length,
    exact: true,
  });
  await fs.writeFile(
    output + "/" + l.name.replace(".drl", "-GerbCraft.drl"),
    text,
  );
}
await fs.writeFile(
  output + "/PCB-11-23001-drills-3D.gcraft",
  JSON.stringify(d.data),
);
// Small edits on the entire actual board must retain 100 steps under the history cap.
d.undoStack = [];
const l = d.data.layers[0];
for (let i = 0; i < 100; i++)
  d.commit("Visibility", () => (l.visible = !l.visible));
assert.equal(d.undoStack.length, 100);
report.historySteps = d.undoStack.length;
report.historyBytes = JSON.stringify(d.undoStack).length * 2;
for (let i = 0; i < 100; i++) assert.equal(d.undo(), true);
for (let i = 0; i < 100; i++) assert.equal(d.redo(), true);
await fs.writeFile(
  output + "/drill-3d-report.json",
  JSON.stringify(report, null, 2),
);
console.log(report);
