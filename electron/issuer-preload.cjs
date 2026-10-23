// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("issuer", {
  status: () => ipcRenderer.invoke("issuer-status"),
  create: () => ipcRenderer.invoke("issuer-create"),
  exportPublic: () => ipcRenderer.invoke("issuer-export-public"),
  restore: () => ipcRenderer.invoke("issuer-restore"),
  backup: () => ipcRenderer.invoke("issuer-backup"),
  issue: (data) => ipcRenderer.invoke("issuer-issue", data),
});
