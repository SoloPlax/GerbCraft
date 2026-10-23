// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { zip } from "../helpers/zip.js";
let app, page, temp;
test.beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "gc-perpetual-"));
  // Exercise the real release configuration, without the test licensing override.
  await fs.writeFile(
    path.join(temp, "license.gcl"),
    "obsolete invalid licence",
  );
  app = await electron.launch({
    args: [".", `--user-data-dir=${temp}`],
    env: { ...process.env, NODE_ENV: "production" },
  });
  page = await app.firstWindow();
});
test.afterEach(async () => {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
  );
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
});
const open = async (paths) =>
  app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
  }, paths);
const save = async (file) =>
  app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, file);
test("fresh perpetual profile imports ZIP, saves, exports and supports whole-import Undo/Redo", async () => {
  const sample = path.resolve("Sample_Gerber_Files/PCB-11-23001 Rev 1.zip");
  test.skip(
    !(await fs.stat(sample).catch(() => null)),
    "Private sample unavailable",
  );
  await expect(page.locator("#licenseBadge")).toContainText("Perpetual");
  await page.locator("#licenseBadge").click();
  await expect(page.locator("#modalBody")).toContainText(
    "no activation or expiry date",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await open([sample]);
  await page
    .getByRole("button", { name: "＋ Import Gerber / ZIP", exact: true })
    .click();
  await expect(page.locator("#layerCount")).toHaveText("11");
  await expect(page.locator("#objectCount")).toHaveText(
    (12818).toLocaleString(),
  );
  await expect(page.locator("#modalBody")).toContainText(
    "MI-11-23001 Rev 1.txt",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator("#undoButton").click();
  await expect(page.locator("#layerCount")).toHaveText("0");
  await page.locator("#redoButton").click();
  await expect(page.locator("#layerCount")).toHaveText("11");
  const project = path.join(temp, "saved.gcraft");
  await save(project);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  expect(JSON.parse(await fs.readFile(project, "utf8")).layers).toHaveLength(
    11,
  );
  await open([project]);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator("#layerCount")).toHaveText("11");
  await page.locator(".layer-name").filter({ hasText: "F_Cu.gbr" }).click();
  const exported = path.join(temp, "board.gbr");
  await save(exported);
  await page.getByRole("button", { name: "Export Gerber ↗" }).click();
  await page.getByLabel("Export scope").selectOption("active");
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("exported successfully");
  expect(await fs.readFile(exported, "utf8")).toContain("M02*");
  await page.screenshot({ path: "test/evidence/zip-perpetual.png" });
});
test("bad ZIP artwork leaves an existing project and its Undo history intact", async () => {
  await page.getByText("Explore a sample").click();
  const archive = path.join(temp, "broken.zip");
  await fs.writeFile(
    archive,
    zip([
      {
        name: "good.gbr",
        text: await fs.readFile("test/fixtures/transform.gbr", "utf8"),
      },
      { name: "bad.drl", text: "M48\nINCH\nT01C0.1\n%\nT01\nX123Y456\nM30" },
    ]),
  );
  await open([archive]);
  await page
    .getByRole("button", { name: "＋ Import Gerber / ZIP", exact: true })
    .click();
  await expect(page.locator("#toast")).toHaveClass(/error/);
  await expect(page.locator("#layerCount")).toHaveText("3");
  await expect(page.locator("#objectCount")).toHaveText("9");
  await page.locator("#undoButton").click();
  await expect(page.locator("#layerCount")).toHaveText("0");
});
