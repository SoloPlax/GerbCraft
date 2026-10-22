const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { readImportFiles } = require("./import-files.cjs");
const { verifyLicense } = require("./licensing.cjs");
// Software rendering avoids a blank Chromium surface under Fusion's Windows GPU.
// The first Windows release favours compatibility; large-board profiling is pending.
if (process.platform === "win32") app.disableHardwareAcceleration();
let win,
  deviceId,
  config,
  documentDirty = false;
const projectFiles = new Set();
app.setName("GerbCraft");
async function readSmall(p) {
  const s = await fs.stat(p);
  if (s.size > 50 * 1024 * 1024) throw Error("File is larger than 50 MB.");
  return fs.readFile(p, "utf8");
}
async function licenseStatus() {
  if (config.mode === "perpetual")
    return {
      mode: "perpetual",
      deviceId,
      active: true,
      license: null,
      error: null,
    };
  let data = null,
    error = null;
  try {
    if (config.publicKey)
      data = verifyLicense(
        await fs.readFile(
          path.join(app.getPath("userData"), "license.gcl"),
          "utf8",
        ),
        config.publicKey,
        deviceId,
      );
  } catch (e) {
    if (e.code !== "ENOENT") error = e.message;
  }
  return {
    mode: config.mode,
    deviceId,
    active: config.mode === "development" || !!data,
    license: data,
    error,
  };
}
async function requireLicense() {
  if (!(await licenseStatus()).active)
    throw Error(
      "Activate this installation to save or export. Viewing remains available.",
    );
}
function handle(name, fn) {
  ipcMain.handle(name, async (event, ...args) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      throw Error("Invalid sender.");
    return fn(...args);
  });
}
function send(command) {
  win.webContents.send("command", command);
}
app.whenReady().then(async () => {
  const dir = app.getPath("userData");
  await fs.mkdir(dir, { recursive: true });
  try {
    deviceId = (
      await fs.readFile(path.join(dir, "installation-id"), "utf8")
    ).trim();
  } catch {
    deviceId = crypto.randomUUID();
    await fs.writeFile(path.join(dir, "installation-id"), deviceId, {
      mode: 0o600,
    });
  }
  try {
    config = JSON.parse(
      await fs.readFile(
        path.join(__dirname, "../build/license-config.json"),
        "utf8",
      ),
    );
  } catch (e) {
    if (app.isPackaged)
      throw Error("Release licence configuration is missing or invalid.");
    config = { mode: "development", publicKey: "" };
  }
  if (!app.isPackaged && process.env.NODE_ENV === "test")
    config = { mode: "development", publicKey: "" };
  if (
    !["development", "licensed", "perpetual"].includes(config.mode) ||
    (config.mode === "licensed" && !config.publicKey)
  )
    throw Error("Invalid release licensing configuration.");
  win = new BrowserWindow({
    icon: path.join(__dirname, "../build/icon.png"),
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: "#10151e",
    title: "GerbCraft",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _p, cb) =>
    cb(false),
  );
  win.on("close", (e) => {
    if (documentDirty) {
      const result = dialog.showMessageBoxSync(win, {
        type: "question",
        buttons: ["Keep editing", "Discard changes"],
        defaultId: 0,
        cancelId: 0,
        message: "Discard unsaved changes?",
        detail: "Save the project before closing to keep your edits.",
      });
      if (result === 0) e.preventDefault();
    }
  });
  handle("dirty", (dirty) => {
    documentDirty = !!dirty;
  });
  handle("open-gerbers", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Gerber, drill and ZIP files",
          extensions: [
            "zip",
            "drl",
            "xln",
            "exc",
            "gbr",
            "ger",
            "gbx",
            "gtl",
            "gbl",
            "gts",
            "gbs",
            "gto",
            "gbo",
            "gko",
            "pho",
          ],
        },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (r.canceled) return { files: [], skipped: [] };
    return readImportFiles(r.filePaths);
  });
  handle("open-project", async () => {
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "GerbCraft project", extensions: ["gcraft"] }],
    });
    if (r.canceled) return null;
    const p = r.filePaths[0],
      text = await readSmall(p);
    projectFiles.add(p);
    return { path: p, text };
  });
  handle("save-project", async ({ text, filePath, saveAs }) => {
    await requireLicense();
    if (typeof text !== "string" || text.length > 50 * 1024 * 1024)
      throw Error("Project exceeds 50 MB.");
    let p = filePath;
    if (saveAs || !projectFiles.has(p)) {
      const r = await dialog.showSaveDialog(win, {
        defaultPath: p || "Board.gcraft",
        filters: [{ name: "GerbCraft project", extensions: ["gcraft"] }],
      });
      if (r.canceled) return null;
      p = r.filePath;
    }
    const tmp = p + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(tmp, text);
      await fs.rename(tmp, p);
    } finally {
      await fs.rm(tmp, { force: true });
    }
    projectFiles.add(p);
    return p;
  });
  handle("export-gerber", async ({ text, name }) => {
    await requireLicense();
    if (typeof text !== "string" || text.length > 50 * 1024 * 1024)
      throw Error("Export exceeds 50 MB.");
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.basename(name || "Board.gbr"),
      filters: [{ name: "Gerber RS-274X", extensions: ["gbr"] }],
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, text);
    return r.filePath;
  });
  handle("export-drill", async ({ text, name }) => {
    await requireLicense();
    if (typeof text !== "string" || text.length > 50 * 1024 * 1024)
      throw Error("Drill export exceeds 50 MB.");
    const r = await dialog.showSaveDialog(win, {
      defaultPath: path.basename(name || "Drills.drl"),
      filters: [{ name: "Excellon drills", extensions: ["drl"] }],
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, text);
    return r.filePath;
  });
  handle("save-preview", async (data) => {
    await requireLicense();
    if (
      typeof data !== "string" ||
      data.length > 16 * 1024 * 1024 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)
    )
      throw Error("Invalid preview image.");
    const r = await dialog.showSaveDialog(win, {
      defaultPath: "Board-preview.png",
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (r.canceled) return null;
    await fs.writeFile(r.filePath, Buffer.from(data.split(",")[1], "base64"));
    return r.filePath;
  });
  handle("license-status", licenseStatus);
  handle("activate", async () => {
    if (!config.publicKey)
      throw Error(
        "This development build has no issuer key configured. See the release guide.",
      );
    const r = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      filters: [{ name: "GerbCraft licence", extensions: ["gcl"] }],
    });
    if (r.canceled) return null;
    const token = await readSmall(r.filePaths[0]);
    verifyLicense(token, config.publicKey, deviceId);
    await fs.writeFile(path.join(dir, "license.gcl"), token, { mode: 0o600 });
    return licenseStatus();
  });
  const menu = [
    {
      label: "File",
      submenu: [
        {
          label: "New project",
          accelerator: "CmdOrCtrl+N",
          click: () => send("new"),
        },
        {
          label: "Import Gerber / drills / ZIP…",
          accelerator: "CmdOrCtrl+I",
          click: () => send("import"),
        },
        {
          label: "Open project…",
          accelerator: "CmdOrCtrl+O",
          click: () => send("open"),
        },
        {
          label: "Save project",
          accelerator: "CmdOrCtrl+S",
          click: () => send("save"),
        },
        {
          label: "Save project as…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => send("saveAs"),
        },
        {
          label: "Export Gerber…",
          accelerator: "CmdOrCtrl+E",
          click: () => send("export"),
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        {
          label: "Undo",
          accelerator: "CmdOrCtrl+Z",
          click: () => send("undo"),
        },
        {
          label: "Redo",
          accelerator: "CmdOrCtrl+Y",
          click: () => send("redo"),
        },
        {
          label: "Select all",
          accelerator: "CmdOrCtrl+A",
          click: () => send("selectAll"),
        },
        {
          label: "Delete selection",
          accelerator: "Delete",
          click: () => send("delete"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Fit board", accelerator: "Home", click: () => send("fit") },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Quick guide", click: () => send("help") },
        {
          label:
            config.mode === "perpetual" ? "Licence information" : "Activation",
          click: () => send("license"),
        },
      ],
    },
  ];
  if (process.platform === "darwin") menu.unshift({ role: "appMenu" });
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
  await win.loadFile(path.join(__dirname, "../src/index.html"));
});
app.on("window-all-closed", () => app.quit());
