const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createKeys, issueLicense } = require("./licensing.cjs");
if (process.platform === "win32") app.disableHardwareAcceleration();
app.setName("GerbCraft Activation");
app.setPath(
  "userData",
  !app.isPackaged &&
    process.env.NODE_ENV === "test" &&
    process.env.GERBCRAFT_TEST_DATA
    ? process.env.GERBCRAFT_TEST_DATA
    : path.join(app.getPath("appData"), "GerbCraft Activation"),
);
let win;
const keyPath = () => path.join(app.getPath("userData"), "issuer-private.pem");
const publicPath = () =>
  path.join(app.getPath("userData"), "issuer-public.pem");
app.whenReady().then(async () => {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  win = new BrowserWindow({
    icon: path.join(__dirname, "../build/icon.png"),
    width: 840,
    height: 780,
    minWidth: 720,
    minHeight: 680,
    backgroundColor: "#10151e",
    webPreferences: {
      preload: path.join(__dirname, "issuer-preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_w, _p, cb) =>
    cb(false),
  );
  const handle = (name, fn) =>
    ipcMain.handle(name, async (e) => {
      if (
        e.sender !== win.webContents ||
        e.senderFrame !== win.webContents.mainFrame
      )
        throw Error("Invalid sender.");
      return fn();
    });
  handle("issuer-status", async () => {
    try {
      const publicKey = await fs.readFile(publicPath(), "utf8");
      return { ready: true, publicKey, keyFolder: app.getPath("userData") };
    } catch {
      return { ready: false, keyFolder: app.getPath("userData") };
    }
  });
  handle("issuer-create", async () => {
    try {
      await fs.access(keyPath());
      throw Error("An issuer key already exists. It will not be overwritten.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const k = createKeys();
    await fs.writeFile(keyPath(), k.privateKey, { mode: 0o600, flag: "wx" });
    await fs.writeFile(publicPath(), k.publicKey, { mode: 0o644, flag: "wx" });
    return {
      ready: true,
      publicKey: k.publicKey,
      keyFolder: app.getPath("userData"),
    };
  });
  handle("issuer-restore", async () => {
    try {
      await fs.access(keyPath());
      throw Error(
        "This app already has a signing identity. Use its existing key or restore into a fresh profile.",
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "Private key backup", extensions: ["pem"] }],
    });
    if (r.canceled) return null;
    const bytes = await fs.readFile(r.filePaths[0]);
    if (bytes.length > 16000) throw Error("Invalid private key backup.");
    const crypto = require("node:crypto"),
      key = crypto.createPrivateKey(bytes);
    if (key.asymmetricKeyType !== "ed25519")
      throw Error("Expected an Ed25519 private key.");
    const pub = crypto
      .createPublicKey(key)
      .export({ type: "spki", format: "pem" });
    await fs.writeFile(
      keyPath(),
      key.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600, flag: "wx" },
    );
    await fs.writeFile(publicPath(), pub, { flag: "wx" });
    return true;
  });
  handle("issuer-export-public", async () => {
    const key = await fs.readFile(publicPath(), "utf8");
    const r = await dialog.showSaveDialog(win, {
      defaultPath: "gerbcraft-issuer-public.pem",
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, key);
    return r.filePath;
  });
  handle("issuer-backup", async () => {
    const r = await dialog.showSaveDialog(win, {
      defaultPath: "gerbcraft-issuer-private-BACKUP.pem",
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, await fs.readFile(keyPath()), {
      mode: 0o600,
    });
    return r.filePath;
  });
  ipcMain.handle("issuer-issue", async (e, data) => {
    if (
      e.sender !== win.webContents ||
      e.senderFrame !== win.webContents.mainFrame
    )
      throw Error("Invalid sender.");
    const token = issueLicense(data, await fs.readFile(keyPath(), "utf8"));
    const r = await dialog.showSaveDialog(win, {
      defaultPath:
        "GerbCraft-" +
        data.customer.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) +
        ".gcl",
      filters: [{ name: "GerbCraft licence", extensions: ["gcl"] }],
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, token);
    const record = {
      issued: new Date().toISOString(),
      customer: data.customer,
      deviceId: data.deviceId,
      expires: data.expires || null,
      file: path.basename(r.filePath),
    };
    await fs.appendFile(
      path.join(app.getPath("userData"), "issuance-log.jsonl"),
      JSON.stringify(record) + "\n",
      { mode: 0o600 },
    );
    return r.filePath;
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([{ label: "File", submenu: [{ role: "quit" }] }]),
  );
  await win.loadFile(path.join(__dirname, "../src/activation.html"));
});
app.on("window-all-closed", () => app.quit());
