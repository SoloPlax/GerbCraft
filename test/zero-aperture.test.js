// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import test from "node:test";
import assert from "node:assert/strict";
import { parseGerber, exportGerber } from "../src/core/gerber.js";
import { EditorDocument, validateDocument } from "../src/core/document.js";
import { drawObject, hitObject } from "../src/core/render.js";
const zero = "%FSLAX46Y46*%%MOMM*%%ADD10C,0*%D10*X0Y0D03*X1000000Y0D01*M02*";
test("zero-diameter standard circles survive import, project save and export", () => {
  const d = new EditorDocument();
  d.addLayers([parseGerber(zero)]);
  const saved = validateDocument(JSON.parse(JSON.stringify(d.data)));
  const objects = parseGerber(exportGerber(saved.layers[0].objects)).objects;
  assert.equal(objects.length, 2);
  for (const o of objects) assert.equal(o.aperture.components[0].diameter, 0);
});
test("zero-size flashes and strokes draw no pixels and are not hit targets", () => {
  const ctx = new Proxy(
    {},
    {
      get() {
        throw Error("Zero-size object touched canvas");
      },
      set() {
        throw Error("Zero-size object changed canvas");
      },
    },
  );
  for (const o of parseGerber(zero).objects) {
    drawObject(ctx, o, "#ffffff", {}, null);
    assert.equal(hitObject(ctx, o, { x: 0, y: 0 }, 1), false);
  }
});
test("a region drawn with a zero-size aperture still has filled geometry", () => {
  const data = zero.replace(
    "X0Y0D03*X1000000Y0D01*",
    "G36*X0Y0D02*X1000000Y0D01*X1000000Y1000000D01*X0Y0D01*G37*",
  );
  const objects = parseGerber(data).objects;
  assert.equal(objects[0].kind, "region");
  assert.equal(objects[0].contours[0].length, 3);
});
test("zero-size exception does not admit negative circles or zero rectangles", () => {
  for (const def of ["C,-1", "R,0X1", "C,0X1"])
    assert.throws(() => parseGerber(zero.replace("C,0", def)));
});
