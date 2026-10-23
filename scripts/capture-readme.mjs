// Publishable screenshots from synthetic artwork, never from customer samples.
import { _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { circleAperture } from "../src/core/geometry.js";
import { validateDocument } from "../src/core/document.js";
import { boardSettings } from "../src/core/board3d.js";
let id = 0;
const object = (o) => ({ id: String(++id), polarity: "dark", ...o });
const line = (x, y, X, Y, w = 0.3) =>
  object({
    kind: "line",
    start: { x, y },
    end: { x: X, y: Y },
    aperture: circleAperture(w),
  });
const flash = (x, y, d) =>
  object({ kind: "flash", at: { x, y }, aperture: circleAperture(d) });
const rect = (x, y, w, h) =>
  object({
    kind: "flash",
    at: { x, y },
    aperture: {
      components: [
        {
          kind: "polygon",
          dark: true,
          points: [
            { x: -w / 2, y: -h / 2 },
            { x: w / 2, y: -h / 2 },
            { x: w / 2, y: h / 2 },
            { x: -w / 2, y: h / 2 },
          ],
        },
      ],
    },
  });
const box = (x, y, w, h) => [
  line(x, y, x + w, y, 0.16),
  line(x + w, y, x + w, y + h, 0.16),
  line(x + w, y + h, x, y + h, 0.16),
  line(x, y + h, x, y, 0.16),
];
const top = [],
  bottom = [],
  mask = [],
  silk = [],
  drills = [];
const hole = (x, y, d, plating = "plated") =>
  drills.push(
    object({
      kind: "drill",
      at: { x, y },
      diameter: d,
      plating,
      span: "through",
    }),
  );
for (const [x, y] of [
  [4, 4],
  [56, 4],
  [56, 36],
  [4, 36],
]) {
  hole(x, y, 2.8, "non-plated");
  mask.push(flash(x, y, 4));
  silk.push(...box(x - 2.3, y - 2.3, 4.6, 4.6));
}
for (let i = 0; i < 10; i++) {
  const x = 18 + i * 2.54;
  for (const y of [5, 35]) {
    top.push(flash(x, y, 1.8));
    bottom.push(flash(x, y, 1.8));
    mask.push(flash(x, y, 2));
    hole(x, y, 0.85);
  }
  const px = 23 + i * 1.5;
  top.push(rect(px, 15, 0.85, 2), rect(px, 25, 0.85, 2));
  mask.push(rect(px, 15, 1.05, 2.2), rect(px, 25, 1.05, 2.2));
  top.push(
    line(x, 5, x, 8 + i * 0.35),
    line(x, 8 + i * 0.35, px, 12.5),
    line(px, 12.5, px, 14),
  );
  top.push(
    line(x, 35, x, 32 - i * 0.35),
    line(x, 32 - i * 0.35, px, 27.5),
    line(px, 27.5, px, 26),
  );
}
silk.push(
  ...box(21, 16.5, 18, 7),
  ...box(16.5, 3.3, 26.5, 3.4),
  ...box(16.5, 33.3, 26.5, 3.4),
);
for (let i = 0; i < 6; i++) {
  const y = 12 + i * 3;
  top.push(
    rect(10, y, 2, 1),
    rect(14, y, 2, 1),
    line(15, y, 18, y),
    line(18, y, 21, y + 1),
  );
  mask.push(rect(10, y, 2.2, 1.2), rect(14, y, 2.2, 1.2));
  silk.push(...box(11.4, y - 0.8, 1.2, 1.6));
  top.push(flash(48, y, 1.2));
  bottom.push(flash(48, y, 1.2));
  mask.push(flash(48, y, 1.4));
  hole(48, y, 0.5);
  bottom.push(line(48, y, 52, y), line(52, y, 52, 8), line(52, 8, 43, 8));
}
const font = {
  G: ["01110", "10000", "10111", "10001", "01110"],
  E: ["11111", "10000", "11110", "10000", "11111"],
  R: ["11110", "10001", "11110", "10100", "10010"],
  B: ["11110", "10001", "11110", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "01111"],
  A: ["01110", "10001", "11111", "10001", "10001"],
  F: ["11111", "10000", "11110", "10000", "10000"],
  T: ["11111", "00100", "00100", "00100", "00100"],
};
for (const [i, c] of [..."GERBCRAFT"].entries())
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++)
      if (font[c][row][col] === "1")
        silk.push(
          rect(20 + i * 2.35 + col * 0.36, 30 - row * 0.36, 0.31, 0.31),
        );
const layers = [
  ["Top copper", "top-copper", top, "#f5b65a", true],
  ["Bottom copper", "bottom-copper", bottom, "#879dff", false],
  ["Top solder mask", "top-mask", mask, "#57d6c1", false],
  [
    "Bottom solder mask",
    "bottom-mask",
    structuredClone(mask),
    "#57d6c1",
    false,
  ],
  ["Top silkscreen", "top-silk", silk, "#e8eef5", true],
  ["Board outline", "outline", box(0, 0, 60, 40), "#57d6c1", true],
  ["Through drills", "drill", drills, "#f17e9d", true],
].map(([name, role, objects, color, visible], i) => ({
  id: "layer" + i,
  name,
  color,
  visible,
  locked: false,
  objects,
  ...(role === "drill" ? { type: "drill" } : {}),
  role,
}));
const doc = {
  format: "gerbcraft",
  version: 2,
  name: "GerbCraft · Demonstration board",
  layers,
};
doc.board = boardSettings(doc);
doc.board.roles = Object.fromEntries(layers.map((l) => [l.id, l.role]));
validateDocument(doc);
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gc-promo-"));
let app;
try {
  const file = path.join(temp, "demo.gcraft");
  await fs.writeFile(file, JSON.stringify(doc));
  app = await electron.launch({
    args: [".", `--user-data-dir=${temp}`],
    env: { ...process.env, NODE_ENV: "production" },
  });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow, dialog }, file) => {
    BrowserWindow.getAllWindows()[0].setSize(1440, 960);
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, file);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await page.locator("#layerCount").filter({ hasText: "7" }).waitFor();
  await page.locator("#toast").waitFor({ state: "hidden" });
  await page.screenshot({ path: "docs/images/gerbcraft-editor.png" });
  await page.locator("#preview3d").click();
  await page.locator("#previewSummary").filter({ hasText: "60.000" }).waitFor();
  await page.locator("#previewCanvas").hover();
  await page.mouse.wheel(0, -350);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/images/gerbcraft-3d.png" });
  await page.locator("#closePreview").click();
  await page.locator("#addDrill").click();
  await page.getByLabel("Shape", { exact: true }).selectOption("slot");
  await page.getByLabel("X centre / slot start (mm)").fill("50");
  await page.getByLabel("Y centre / slot start (mm)").fill("20");
  await page.getByLabel("Slot end X (mm)").fill("54");
  await page.getByLabel("Slot end Y (mm)").fill("20");
  await page.screenshot({ path: "docs/images/gerbcraft-drills.png" });
} finally {
  if (app) {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
  }
  await fs.rm(temp, { recursive: true, force: true });
}
console.log("Captured three real app screenshots using synthetic artwork.");
