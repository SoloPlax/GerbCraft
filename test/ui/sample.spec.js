import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
const source = path.resolve("Sample_Gerber_Files/PCB-11-23001 Rev 1");
test("user PCB imports nine layers, renders, saves and reopens", async () => {
  test.skip(
    !(await fs.stat(source).catch(() => null)),
    "Private sample is optional and is not distributed with tests.",
  );
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gerbcraft-board-"));
  const app = await electron.launch({
    args: [".", `--user-data-dir=${temp}`],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test" },
  });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const files = (await fs.readdir(source))
      .filter((n) => n.endsWith(".gbr"))
      .map((n) => path.join(source, n));
    await app.evaluate(({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths });
    }, files);
    await page
      .getByRole("button", { name: "＋ Import Gerber / ZIP", exact: true })
      .click();
    await expect(page.locator("#layerCount")).toHaveText("9");
    await expect(page.locator("#objectCount")).toHaveText(
      (12437).toLocaleString(),
    );
    const project = path.join(temp, "board.gcraft");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, project);
    await page
      .getByRole("button", { name: "Save project", exact: true })
      .click();
    await expect(page.locator("#dirtyMark")).toHaveText("");
    expect(JSON.parse(await fs.readFile(project, "utf8")).layers).toHaveLength(
      9,
    );
    // Open the prepared top-side project for a useful visual inspection.
    const prepared = path.resolve(
      "Sample_Gerber_Files/GerbCraft-Test-Results/PCB-11-23001 Rev 1.gcraft",
    );
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [filePath],
      });
    }, prepared);
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await expect(page.locator("#objectCount")).toHaveText(
      (7309).toLocaleString(),
    );
    await page.screenshot({
      path: "Sample_Gerber_Files/GerbCraft-Test-Results/board-preview.png",
    });
    expect(errors).toEqual([]);
  } finally {
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
    );
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
