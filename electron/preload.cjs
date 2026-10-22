const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktop", {
  openGerbers: () => ipcRenderer.invoke("open-gerbers"),
  openProject: () => ipcRenderer.invoke("open-project"),
  saveProject: (args) => ipcRenderer.invoke("save-project", args),
  exportDrill: (args) => ipcRenderer.invoke("export-drill", args),
  savePreview: (data) => ipcRenderer.invoke("save-preview", data),
  exportGerber: (args) => ipcRenderer.invoke("export-gerber", args),
  licenseStatus: () => ipcRenderer.invoke("license-status"),
  activate: () => ipcRenderer.invoke("activate"),
  dirty: (value) => ipcRenderer.invoke("dirty", value),
  onCommand: (fn) => ipcRenderer.on("command", (_e, command) => fn(command)),
});
