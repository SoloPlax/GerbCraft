import { test, expect, _electron as electron } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import licensing from "../../electron/licensing.cjs";

test("isolated issuer creates, backs up, and issues a verifiable licence", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "gerbcraft-issuer-"));
  const app = await electron.launch({
    args: ["electron/issuer.cjs"],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "test", GERBCRAFT_TEST_DATA: temp },
  });
  try {
    const page = await app.firstWindow();
    await expect(page.locator("#keyStatus")).toHaveText("NOT CONFIGURED");
    await page.locator("#create").click();
    await expect(page.locator("#keyStatus")).toHaveText("IDENTITY READY");
    await expect(page.locator("#create")).toBeDisabled();
    const output = path.join(temp, "test.gcl");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, output);
    await page.locator("#customer").fill("Integration test");
    await page.locator("#device").fill("test-installation");
    await page.locator("#issue").click();
    await expect(page.locator("#message")).toContainText("Licence created:");
    const publicKey = await fs.readFile(
      path.join(temp, "issuer-public.pem"),
      "utf8",
    );
    expect(
      licensing.verifyLicense(
        await fs.readFile(output, "utf8"),
        publicKey,
        "test-installation",
      ).customer,
    ).toBe("Integration test");
    const backup = path.join(temp, "backup.pem");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, backup);
    await page.locator("#backup").click();
    await expect(page.locator("#message")).toContainText(
      "Private key backed up.",
    );
    expect(await fs.readFile(backup, "utf8")).toBe(
      await fs.readFile(path.join(temp, "issuer-private.pem"), "utf8"),
    );
    expect(
      JSON.parse(
        (
          await fs.readFile(path.join(temp, "issuance-log.jsonl"), "utf8")
        ).trim(),
      ).customer,
    ).toBe("Integration test");
    await page.screenshot({ path: "test-results/activation.png" });
  } finally {
    await app.close();
    await fs.rm(temp, { recursive: true, force: true });
  }
});
