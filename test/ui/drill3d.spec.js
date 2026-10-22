import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { exportGerber } from "../../src/core/gerber.js";
import { parseDrill } from "../../src/core/drill.js";
import { circleAperture } from "../../src/core/geometry.js";
let app, page, temp, errors;
test.beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "gerbcraft-drill3d-"));
  app = await electron.launch({
    args: [".", `--user-data-dir=${temp}`, "--disable-gpu"],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test" },
  });
  page = await app.firstWindow();
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(async () => {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
  expect(errors).toEqual([]);
});
const openFiles = async (files) =>
  app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, files);
const saveTo = async (file) =>
  app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, file);
test("drill creation, slot editing, Undo, export, board setup, 3D and project persistence", async () => {
  const points = [
      [0, 0],
      [20, 0],
      [20, 10],
      [0, 10],
    ],
    objects = points.map((p, i) => ({
      id: String(i),
      kind: "line",
      polarity: "dark",
      start: { x: p[0], y: p[1] },
      end: { x: points[(i + 1) % 4][0], y: points[(i + 1) % 4][1] },
      aperture: circleAperture(0.1),
    })),
    outline = path.join(temp, "Edge_Cuts.gbr");
  await fs.writeFile(outline, exportGerber(objects));
  await openFiles([outline]);
  await page
    .getByRole("button", { name: "＋ Import Gerber / ZIP", exact: true })
    .click();
  await page.locator("#addDrill").click();
  await expect(page.getByLabel("Slot end X (mm)")).toBeHidden();
  await expect(page.getByLabel("Slot end Y (mm)")).toBeHidden();
  await page.getByLabel("Hole diameter / slot width (mm)").fill("2");
  await page.getByLabel("X centre / slot start (mm)").fill("3");
  await page.getByLabel("Y centre / slot start (mm)").fill("4");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator("#objectCount")).toHaveText("5");
  await page.getByLabel("Show Edge_Cuts.gbr").uncheck();
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await page.locator("#editDrill").click();
  await page.getByLabel("Shape", { exact: true }).selectOption("slot");
  await expect(page.getByLabel("Slot end X (mm)")).toBeVisible();
  await expect(page.getByLabel("Slot end Y (mm)")).toBeVisible();
  await page.getByLabel("Slot end X (mm)").fill("7");
  await page.getByLabel("Slot end Y (mm)").fill("4");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await page.locator("#boardSetup").click();
  await page.getByLabel("Overall board thickness (mm)").fill("1.55");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  const project = path.join(temp, "drills.gcraft");
  await saveTo(project);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  const before = await fs.readFile(project, "utf8");
  await page.locator("#preview3d").click();
  await expect(page.locator("#previewSummary")).toContainText(
    "20.000 × 10.000 × 1.550",
  );
  await expect(page.locator("#previewSummary")).toContainText("1 drill");
  await page.getByRole("button", { name: "Bottom", exact: true }).click();
  await page.getByRole("button", { name: "Top", exact: true }).click();
  // At top view the slot centre is empty and surrounding substrate is opaque.
  const pixels = await page.locator("#previewCanvas").evaluate((c) => {
    const ctx = c.getContext("2d"),
      scale = (Math.min(c.width, c.height) * 0.9) / Math.hypot(20, 10, 1.55),
      pixel = (x, y) => [
        ...ctx.getImageData(
          Math.round(c.width / 2 + (x - 10) * scale),
          Math.round(c.height / 2 - (y - 5) * scale),
          1,
          1,
        ).data,
      ];
    return { slot: pixel(5, 4), solid: pixel(10, 5) };
  });
  expect(pixels.slot.slice(0, 3)).toEqual([12, 17, 25]);
  expect(pixels.solid.slice(0, 3)).not.toEqual([12, 17, 25]);
  const png = path.join(temp, "board.png");
  await saveTo(png);
  await page.locator("#savePreview").click();
  await expect(page.locator("#toast")).toContainText("Preview image saved");
  expect((await fs.readFile(png)).subarray(1, 4).toString()).toBe("PNG");
  await page.locator("#closePreview").click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  const drill = path.join(temp, "output.drl");
  await saveTo(drill);
  await page.locator("#exportDrill").click();
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Exported 1");
  const parsed = parseDrill(await fs.readFile(drill, "utf8"));
  expect(parsed.objects[0].end).toEqual({ x: 7, y: 4 });
  await page
    .getByRole("button", { name: "Delete selection", exact: true })
    .click();
  await expect(page.locator("#objectCount")).toHaveText("0");
  await page.locator("#undoButton").click();
  await expect(page.locator("#objectCount")).toHaveText("1");
  await saveTo(project);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  expect(await fs.readFile(project, "utf8")).toEqual(before);
  await openFiles([project]);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator("#layerCount")).toHaveText("2");
});
test("sample 381-hole board renders top/bottom without a GPU; 3D leaves artwork export unchanged", async () => {
  test.setTimeout(60000);
  const sample = path.resolve(
    "Sample_Gerber_Files/GerbCraft-Test-Results/PCB-11-23001-drills-3D.gcraft",
  );
  test.skip(
    !(await fs.stat(sample).catch(() => null)),
    "Optional private sample",
  );
  await openFiles([sample]);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator("#layerCount")).toHaveText("11");
  await page.locator("#preview3d").click();
  await expect(page.locator("#previewSummary")).toContainText("381 drill");
  await page.screenshot({
    path: "Sample_Gerber_Files/GerbCraft-Test-Results/3d-isometric.png",
  });
  await page.getByRole("button", { name: "Top", exact: true }).click();
  await page.screenshot({
    path: "Sample_Gerber_Files/GerbCraft-Test-Results/3d-top.png",
  });
  await page.getByRole("button", { name: "Bottom", exact: true }).click();
  await page.screenshot({
    path: "Sample_Gerber_Files/GerbCraft-Test-Results/3d-bottom.png",
  });
  await page.locator("#closePreview").click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  const saved = path.join(temp, "reopened.gcraft");
  await saveTo(saved);
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.send("command", "saveAs"),
  );
  await expect
    .poll(async () => !!(await fs.stat(saved).catch(() => null)))
    .toBe(true);
  expect(JSON.parse(await fs.readFile(saved, "utf8"))).toEqual(
    JSON.parse(await fs.readFile(sample, "utf8")),
  );
});
test("surface textures resolve clear polarity independently and keep bottom world coordinates", async () => {
  const result = await page.evaluate(async () => {
    const { surfaceTexture } = await import("./core/preview3d.js");
    const ap = (d) => ({
      components: [
        { kind: "circle", center: { x: 0, y: 0 }, diameter: d, dark: true },
      ],
    });
    const flash = (x, y, d, polarity = "dark") => ({
      kind: "flash",
      at: { x, y },
      aperture: ap(d),
      polarity,
    });
    const board = {
        bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
        setup: {
          finish: "ENIG",
          mask: "#176343",
          silk: "#ffffff",
          roles: { t: "top-copper", b: "bottom-copper" },
        },
      },
      data = {
        layers: [
          { id: "t", objects: [flash(2, 3, 2), flash(2, 3, 0.8, "clear")] },
          { id: "b", objects: [flash(8, 7, 2)] },
        ],
      };
    const top = surfaceTexture(data, board, "top", 1002),
      bottom = surfaceTexture(data, board, "bottom", 1002),
      pixel = (tex, x, y) => {
        const k =
          (Math.round(tex.view.oy - y * tex.view.scale) * tex.width +
            Math.round(tex.view.ox + x * tex.view.scale)) *
          4;
        return [...tex.pixels.slice(k, k + 3)];
      };
    return {
      centre: pixel(top, 2, 3),
      ring: pixel(top, 2.7, 3),
      bottom: pixel(bottom, 8, 7),
      empty: pixel(bottom, 2, 3),
    };
  });
  expect(result.centre).toEqual([130, 120, 73]);
  expect(result.ring).toEqual([212, 182, 99]);
  expect(result.bottom).toEqual(result.ring);
  expect(result.empty).toEqual(result.centre);
});
