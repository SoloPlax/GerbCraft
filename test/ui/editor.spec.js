// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
let app, page, temp;
test.beforeEach(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "gerbcraft-ui-"));
  app = await electron.launch({
    args: [".", `--user-data-dir=${temp}`],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test" },
  });
  page = await app.firstWindow();
  await page.waitForLoadState();
});
test.afterEach(async () => {
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy();
  });
  await app.close();
  await fs.rm(temp, { recursive: true, force: true });
});
test("sample, selection, transform, delete, Undo/Redo and visibility", async () => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByText("Explore a sample").click();
  await expect(page.locator("#layerCount")).toHaveText("3");
  await expect(page.locator("#objectCount")).toHaveText("9");
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(page.locator("#selectionCount")).toHaveText("9 selected");
  await page.locator("#moveX").fill("2.54");
  await page.locator("#moveButton").click();
  await page.locator("#angle").fill("45");
  await page.locator("#rotateButton").click();
  await page
    .getByRole("button", { name: "Delete selection", exact: true })
    .click();
  await expect(page.locator("#objectCount")).toHaveText("0");
  await page.locator("#undoButton").click();
  await expect(page.locator("#objectCount")).toHaveText("9");
  await page.locator("#redoButton").click();
  await expect(page.locator("#objectCount")).toHaveText("0");
  await page.locator("#undoButton").click();
  await page.locator("#hideAll").click();
  await expect(page.locator("#objectCount")).toHaveText("0");
  await page.locator("#showAll").click();
  await expect(page.locator("#objectCount")).toHaveText("9");
  await page.getByRole("button", { name: "Fit board", exact: false }).click();
  await page.screenshot({ path: "test-results/editor.png" });
  expect(errors).toEqual([]);
});
test("editor fits a small Windows display", async () => {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1000, 680),
  );
  await page.getByText("Explore a sample").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Export Gerber ↗" }),
  ).toBeInViewport();
  await page.screenshot({ path: "test-results/editor-small.png" });
});
test("real file import, project save/reopen and export via desktop bridge", async () => {
  const fixture = path.resolve("test/fixtures/transform.gbr"),
    project = path.join(temp, "Saved.gcraft"),
    output = path.join(temp, "Export.gbr");
  await app.evaluate(({ dialog }, fixture) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [fixture],
    });
  }, fixture);
  await page
    .getByRole("button", { name: "＋ Import Gerber / ZIP", exact: true })
    .click();
  await expect(page.locator("#objectCount")).toHaveText("5");
  await app.evaluate(({ dialog }, project) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: project,
    });
  }, project);
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.locator("#dirtyMark")).toHaveText("");
  const saved = JSON.parse(await fs.readFile(project, "utf8"));
  expect(saved.layers).toHaveLength(1);
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, output);
  await page.getByRole("button", { name: "Export Gerber ↗" }).click();
  await page.getByRole("button", { name: "Export…", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("exported successfully");
  expect(await fs.readFile(output, "utf8")).toContain("M02*");
  await app.evaluate(({ dialog }, project) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [project],
    });
  }, project);
  await page.getByRole("button", { name: "Open project", exact: true }).click();
  await expect(page.locator("#objectCount")).toHaveText("5");
});
