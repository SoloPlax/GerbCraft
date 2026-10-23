// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { parseDrill, exportDrill } from "./core/drill.js";
import {
  ROLES,
  boardSettings,
  validateBoard,
  buildBoard,
} from "./core/board3d.js";
import { createPreview } from "./core/preview3d.js";
import { parseGerber, exportGerber } from "./core/gerber.js";
import { EditorDocument, newDocument } from "./core/document.js";
import { unionBounds, objectBounds, groupCenter } from "./core/geometry.js";
import { drawObject, hitObject } from "./core/render.js";
import { demoFiles } from "./demo.js";
const $ = (id) => document.getElementById(id),
  model = new EditorDocument(),
  canvas = $("board"),
  ctx = canvas.getContext("2d"),
  layerCanvas = document.createElement("canvas"),
  scratch = document.createElement("canvas"),
  desktop = window.desktop;
let activeLayer = null,
  filePath = null,
  tool = "select",
  view = { scale: 35, ox: 300, oy: 400 },
  unit = "mm",
  drag = null,
  measure = null,
  lastStatus = "Ready",
  toastTimer,
  license = null;
const factor = () => (unit === "mil" ? 0.0254 : unit === "in" ? 25.4 : 1);
const fmt = (n) => (n / factor()).toFixed(unit === "mil" ? 2 : 3);
const world = (e) => {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - view.ox) / view.scale,
    y: (view.oy - e.clientY + r.top) / view.scale,
  };
};
function notify(message, error = false) {
  $("toast").textContent = message;
  $("toast").classList.toggle("error", error);
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => ($("toast").hidden = true),
    error ? 12000 : 5000,
  );
  status(message);
}
function status(message) {
  lastStatus = message;
  $("status").textContent = message;
}
async function guarded(fn) {
  try {
    return await fn();
  } catch (e) {
    notify(e.message, true);
  }
}
function update() {
  model.prune();
  const count = model.data.layers.reduce((n, l) => n + l.objects.length, 0);
  $("projectName").textContent = model.data.name;
  $("dirtyMark").textContent = model.dirty ? "●" : "";
  $("projectSummary").textContent = count
    ? `${model.data.layers.length} layers · ${count.toLocaleString()} objects`
    : "A clear view of every layer.";
  $("layerCount").textContent = model.data.layers.length;
  $("layerEmpty").hidden = model.data.layers.length > 0;
  $("welcome").hidden = model.data.layers.length > 0;
  $("objectCount").textContent = model.objects().length.toLocaleString();
  const selected = model.objects(true);
  $("selectionCount").textContent = `${selected.length} selected`;
  $("historyCount").textContent = `${model.undoStack.length} steps`;
  $("undoButton").disabled = !model.undoStack.length;
  $("redoButton").disabled = !model.redoStack.length;
  const b = unionBounds(selected.map(objectBounds));
  $("selectionSummary").textContent = b
    ? `${selected.length} object${selected.length === 1 ? "" : "s"} · ${selected.length === 1 ? selected[0].kind : "group"}\n${fmt(b.maxX - b.minX)} × ${fmt(b.maxY - b.minY)} ${unit}\nCentre ${fmt((b.minX + b.maxX) / 2)}, ${fmt((b.minY + b.maxY) / 2)}`
    : "Click an object to inspect it. Shift-click to add to your selection.";
  for (const id of [
    "moveButton",
    "copyButton",
    "rotateButton",
    "mirrorX",
    "mirrorY",
  ])
    $(id).disabled = !selected.length;
  renderLayers();
  draw();
  desktop?.dirty(model.dirty);
  document.title = `${model.dirty ? "● " : ""}${model.data.name} — GerbCraft`;
}
function renderLayers() {
  const list = $("layerList");
  list.replaceChildren();
  for (const l of model.data.layers) {
    const row = document.createElement("div");
    row.className =
      "layer" +
      (l.id === activeLayer ? " active" : "") +
      (!l.visible ? " hidden-layer" : "");
    row.style.setProperty("--layer-color", l.color);
    const visible = document.createElement("input");
    visible.type = "checkbox";
    visible.checked = l.visible;
    visible.title = `Show ${l.name}`;
    visible.setAttribute("aria-label", `Show ${l.name}`);
    visible.onchange = () => {
      model.commit("Layer visibility", () => (l.visible = visible.checked));
      update();
    };
    const dot = document.createElement("div");
    dot.className = "layer-dot";
    const label = document.createElement("div");
    const name = document.createElement("div");
    name.className = "layer-name";
    name.textContent = l.name;
    name.title = l.name;
    const meta = document.createElement("div");
    meta.className = "layer-meta";
    meta.textContent = `${l.objects.length.toLocaleString()} objects${l.locked ? " · locked" : ""}`;
    label.append(name, meta);
    label.onclick = () => {
      activeLayer = l.id;
      update();
    };
    label.ondblclick = () => editLayer(l);
    const lock = document.createElement("button");
    lock.textContent = l.locked ? "◆" : "◇";
    lock.title = l.locked ? "Unlock layer" : "Lock layer";
    lock.setAttribute(
      "aria-label",
      `${l.locked ? "Unlock" : "Lock"} ${l.name}`,
    );
    lock.onclick = () => {
      model.commit("Layer lock", () => (l.locked = !l.locked));
      update();
    };
    row.append(visible, dot, label, lock);
    row.oncontextmenu = (e) => {
      e.preventDefault();
      editLayer(l);
    };
    list.append(row);
  }
}
function modal(title, body, actions) {
  $("modalTitle").textContent = title;
  $("modalBody").replaceChildren();
  if (typeof body === "string") $("modalBody").textContent = body;
  else $("modalBody").append(body);
  $("modalActions").replaceChildren();
  for (const a of actions) {
    const button = document.createElement("button");
    button.textContent = a.label;
    if (a.primary) button.className = "primary";
    button.onclick = () =>
      guarded(async () => {
        if (a.action) await a.action();
        if (!a.keepOpen) $("modal").close();
      });
    $("modalActions").append(button);
  }
  if (!$("modal").open) $("modal").showModal();
}
function ask(title, message) {
  return new Promise((resolve) => {
    modal(title, message, [
      { label: "Cancel", action: () => resolve(false) },
      { label: "Continue", primary: true, action: () => resolve(true) },
    ]);
    $("modal").addEventListener("close", () => resolve(false), { once: true });
  });
}
function inputField(label, value, type = "text") {
  const el = document.createElement("label");
  el.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  input.value = value;
  el.append(input);
  return { el, input };
}
function editLayer(l) {
  const body = document.createElement("div"),
    name = inputField("Layer name", l.name),
    color = inputField("Layer colour", l.color, "color");
  body.append(name.el, color.el);
  modal("Layer settings", body, [
    {
      label: "Remove layer",
      action: async () => {
        model.commit(
          "Remove layer",
          (d) => (d.layers = d.layers.filter((x) => x.id !== l.id)),
        );
        update();
      },
    },
    { label: "Cancel" },
    {
      label: "Apply",
      primary: true,
      action: () => {
        if (!name.input.value.trim()) throw Error("Enter a layer name.");
        model.commit("Layer settings", () => {
          l.name = name.input.value.trim();
          l.color = color.input.value;
        });
        update();
      },
    },
  ]);
}
function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width));
  canvas.height = Math.max(1, Math.round(r.height));
  layerCanvas.width = scratch.width = canvas.width;
  layerCanvas.height = scratch.height = canvas.height;
  draw();
}
function fit() {
  const b = unionBounds(model.objects().map(objectBounds));
  if (!b) return;
  view.scale = Math.min(
    (canvas.width - 100) / Math.max(b.maxX - b.minX, 0.1),
    (canvas.height - 110) / Math.max(b.maxY - b.minY, 0.1),
  );
  view.scale = Math.max(0.01, Math.min(20000, view.scale));
  view.ox = canvas.width / 2 - ((b.minX + b.maxX) / 2) * view.scale;
  view.oy = canvas.height / 2 + ((b.minY + b.maxY) / 2) * view.scale;
  draw();
}
function zoom(mult, px = canvas.width / 2, py = canvas.height / 2) {
  const x = (px - view.ox) / view.scale,
    y = (view.oy - py) / view.scale;
  view.scale = Math.min(20000, Math.max(0.01, view.scale * mult));
  view.ox = px - x * view.scale;
  view.oy = py + y * view.scale;
  draw();
}
function draw() {
  ctx.resetTransform();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0c1119";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if ($("gridToggle").checked) {
    const raw = 50 / view.scale,
      pow = 10 ** Math.floor(Math.log10(raw)),
      step = [1, 2, 5, 10].find((n) => n * pow >= raw) * pow,
      spacing = step * view.scale;
    ctx.fillStyle = "#293340";
    for (
      let x = ((view.ox % spacing) + spacing) % spacing;
      x < canvas.width;
      x += spacing
    )
      for (
        let y = ((view.oy % spacing) + spacing) % spacing;
        y < canvas.height;
        y += spacing
      )
        ctx.fillRect(x, y, 1, 1);
  }
  ctx.strokeStyle = "#374455";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(view.ox, 0);
  ctx.lineTo(view.ox, canvas.height);
  ctx.moveTo(0, view.oy);
  ctx.lineTo(canvas.width, view.oy);
  ctx.stroke();
  const lc = layerCanvas.getContext("2d");
  for (const l of model.data.layers) {
    if (!l.visible) continue;
    lc.resetTransform();
    lc.clearRect(0, 0, canvas.width, canvas.height);
    lc.setTransform(view.scale, 0, 0, -view.scale, view.ox, view.oy);
    for (const o of l.objects) {
      const b = objectBounds(o);
      if (
        b.maxX < (0 - view.ox) / view.scale ||
        b.minX > (canvas.width - view.ox) / view.scale ||
        b.maxY < (view.oy - canvas.height) / view.scale ||
        b.minY > view.oy / view.scale
      )
        continue;
      lc.globalCompositeOperation =
        o.polarity === "clear" ? "destination-out" : "source-over";
      drawObject(lc, o, l.color, view, scratch);
    }
    lc.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.85;
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }
  for (const l of model.data.layers.filter((l) => l.visible))
    for (const o of l.objects)
      if (model.selected.has(model.key(l, o))) {
        const b = objectBounds(o);
        ctx.strokeStyle = "#f6ffff";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          view.ox + b.minX * view.scale - 3,
          view.oy - b.maxY * view.scale - 3,
          (b.maxX - b.minX) * view.scale + 6,
          (b.maxY - b.minY) * view.scale + 6,
        );
        ctx.setLineDash([]);
      }
  if (drag?.type === "box") {
    ctx.strokeStyle = "#81e9d1";
    ctx.fillStyle = "#61dec51a";
    const a = drag.screen,
      b = drag.current;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  if (measure?.a && measure?.b) {
    ctx.strokeStyle = "#f5cd7d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(
      view.ox + measure.a.x * view.scale,
      view.oy - measure.a.y * view.scale,
    );
    ctx.lineTo(
      view.ox + measure.b.x * view.scale,
      view.oy - measure.b.y * view.scale,
    );
    ctx.stroke();
    $("measureLabel").textContent =
      `Distance ${fmt(Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y))} ${unit}`;
  } else $("measureLabel").textContent = "";
  $("zoomLabel").textContent = Math.round((view.scale / 35) * 100) + "%";
  const b = unionBounds(model.objects().map(objectBounds));
  $("boardDimensions").textContent = b
    ? `${fmt(b.maxX - b.minX)} × ${fmt(b.maxY - b.minY)} ${unit}`
    : "";
}
function setTool(t) {
  tool = t;
  for (const k of ["select", "pan", "measure"])
    $(k + "Tool").classList.toggle("active", t === k);
  canvas.style.cursor =
    t === "pan" ? "grab" : t === "measure" ? "crosshair" : "default";
  status(
    t === "select"
      ? "Click to select · Shift-click to add · Drag empty space to select a group"
      : t === "pan"
        ? "Drag to pan · Scroll to zoom"
        : "Click a start point, then an end point to measure.",
  );
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoom(Math.exp(-e.deltaY * 0.001), e.clientX - r.left, e.clientY - r.top);
  },
  { passive: false },
);
canvas.onpointerdown = (e) => {
  if (e.button === 2) return;
  canvas.focus();
  canvas.setPointerCapture(e.pointerId);
  const p = world(e),
    r = canvas.getBoundingClientRect(),
    screen = { x: e.clientX - r.left, y: e.clientY - r.top };
  if (tool === "pan" || e.button === 1 || e.altKey) {
    drag = {
      type: "pan",
      x: e.clientX,
      y: e.clientY,
      ox: view.ox,
      oy: view.oy,
    };
    return;
  }
  if (tool === "measure") {
    if (!measure || measure.done) measure = { a: p, b: p, done: false };
    else {
      measure.b = p;
      measure.done = true;
    }
    draw();
    return;
  }
  let found = null;
  for (const l of [...model.data.layers].reverse()) {
    if (!l.visible || l.locked) continue;
    for (const o of [...l.objects].reverse())
      if (hitObject(ctx, o, p, 3 / view.scale)) {
        found = { l, o };
        break;
      }
    if (found) break;
  }
  if (found) {
    const k = model.key(found.l, found.o);
    if (e.shiftKey && model.selected.has(k)) model.selected.delete(k);
    else {
      if (!e.shiftKey) model.selected.clear();
      model.selected.add(k);
    }
    activeLayer = found.l.id;
    update();
  } else {
    if (!e.shiftKey) model.selected.clear();
    drag = { type: "box", world: p, screen, current: screen, add: e.shiftKey };
    update();
  }
};
canvas.onpointermove = (e) => {
  const p = world(e);
  $("cursorPosition").textContent = `X ${fmt(p.x)} · Y ${fmt(p.y)} ${unit}`;
  if (drag?.type === "pan") {
    view.ox = drag.ox + e.clientX - drag.x;
    view.oy = drag.oy + e.clientY - drag.y;
    draw();
  } else if (drag?.type === "box") {
    const r = canvas.getBoundingClientRect();
    drag.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    draw();
  }
  if (tool === "measure" && measure && !measure.done) {
    measure.b = p;
    draw();
  }
};
canvas.onpointerup = (e) => {
  if (drag?.type === "box") {
    const p = world(e),
      a = drag.world,
      b = {
        minX: Math.min(a.x, p.x),
        maxX: Math.max(a.x, p.x),
        minY: Math.min(a.y, p.y),
        maxY: Math.max(a.y, p.y),
      };
    for (const l of model.data.layers.filter((l) => l.visible && !l.locked))
      for (const o of l.objects) {
        const q = objectBounds(o);
        if (
          q.minX >= b.minX &&
          q.maxX <= b.maxX &&
          q.minY >= b.minY &&
          q.maxY <= b.maxY
        )
          model.selected.add(model.key(l, o));
      }
  }
  drag = null;
  update();
};
canvas.onpointercancel = () => {
  drag = null;
  draw();
};
canvas.oncontextmenu = (e) => e.preventDefault();
async function importFiles(result) {
  const { files, skipped = [] } = Array.isArray(result)
    ? { files: result }
    : result;
  if (!files.length) return;
  const parsed = files.map((f) => {
    try {
      return f.kind === "drill" ||
        /\.(drl|xln|exc)$/i.test(f.name) ||
        /^\s*M48\s*$/m.test(f.text)
        ? parseDrill(f.text, f.name)
        : parseGerber(f.text, f.name);
    } catch (error) {
      throw Error(`${f.name}: ${error.message}`);
    }
  });
  if (
    model.data.layers.reduce((n, l) => n + l.objects.length, 0) +
      parsed.reduce((n, l) => n + l.objects.length, 0) >
    200000
  )
    throw Error("A project supports at most 200,000 objects.");
  if (model.data.layers.length + parsed.length > 256)
    throw Error("A project supports at most 256 layers.");
  model.addLayers(parsed);
  activeLayer = model.data.layers.at(-1).id;
  update();
  fit();
  const warnings = [...new Set(parsed.flatMap((l) => l.warnings))];
  notify(
    `Imported ${parsed.length} layer${parsed.length === 1 ? "" : "s"}.${skipped.length ? ` Skipped ${skipped.length} supporting file(s).` : ""}${warnings.length ? " " + warnings.join(" ") : ""}`,
  );
  if (skipped.length) {
    const body = document.createElement("div");
    const intro = document.createElement("p");
    intro.textContent = `Imported ${parsed.length} layers. These ${skipped.length} supporting files were not imported:`;
    const list = document.createElement("ul");
    for (const name of skipped) {
      const item = document.createElement("li");
      item.textContent = name;
      list.append(item);
    }
    body.append(intro, list);
    modal("Import complete", body, [{ label: "Done", primary: true }]);
  }
}
async function save(saveAs = false) {
  const p = await desktop.saveProject({
    text: JSON.stringify(model.data, null, 2),
    filePath,
    saveAs,
  });
  if (p) {
    filePath = p;
    model.markSaved();
    update();
    notify("Project saved.");
  }
}
async function exportDialog() {
  const body = document.createElement("div");
  body.append(
    document.createTextNode(
      "Choose the geometry to include. Clear objects remain ordered within each layer.",
    ),
  );
  const label = document.createElement("label");
  label.textContent = "Export scope";
  const select = document.createElement("select");
  for (const [value, text] of [
    ["visible", "All visible layers"],
    ["active", "Active layer"],
    ["selected", "Selected objects"],
  ]) {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = text;
    select.append(o);
  }
  label.append(select);
  body.append(label);
  const note = document.createElement("p");
  note.className = "small";
  note.textContent =
    "Use one file per physical PCB layer for fabrication. Combined export overlays the chosen layers in list order; clear polarity can erase earlier layers. X2 net/component metadata is omitted.";
  body.append(note);
  modal("Export Gerber", body, [
    { label: "Cancel" },
    {
      label: "Export…",
      primary: true,
      action: async () => {
        let objects =
          select.value === "selected"
            ? model.objects(true)
            : select.value === "active"
              ? model.data.layers.find((l) => l.id === activeLayer)?.objects ||
                []
              : model.objects();
        const text = exportGerber(objects, { name: model.data.name }),
          p = await desktop.exportGerber({
            text,
            name: model.data.name + ".gbr",
          });
        if (p) notify("Gerber exported successfully.");
      },
    },
  ]);
}
const commands = {
  import: async () => importFiles(await desktop.openGerbers()),
  open: async () => {
    if (
      model.dirty &&
      !(await ask(
        "Open another project?",
        "Unsaved changes will be discarded. Save first if you want to keep them.",
      ))
    )
      return;
    const f = await desktop.openProject();
    if (!f) return;
    model.load(JSON.parse(f.text));
    filePath = f.path;
    activeLayer = model.data.layers[0]?.id;
    update();
    fit();
    notify("Project opened.");
  },
  new: async () => {
    if (
      model.dirty &&
      !(await ask("Start a new project?", "Unsaved changes will be discarded."))
    )
      return;
    model.load(newDocument());
    filePath = null;
    activeLayer = null;
    measure = null;
    update();
  },
  save: () => save(),
  saveAs: () => save(true),
  undo: () => {
    model.undo();
    update();
    status("Undo");
  },
  redo: () => {
    model.redo();
    update();
    status("Redo");
  },
  selectAll: () => {
    model.selectAll();
    update();
  },
  delete: () => {
    model.deleteSelected();
    update();
  },
  fit,
  export: exportDialog,
  help: () => {
    const div = document.createElement("div");
    div.innerHTML =
      "<p><b>Working with artwork</b><br>Import Gerber, Excellon drill files or a ZIP containing both. Each artwork file becomes a layer. Subfolders are included; supporting files are reported and skipped. Undo removes the entire import. Click an object, Shift-click for a group, or drag a selection box around objects. Locked layers cannot be selected.</p><p><b>Navigation</b><br>Scroll to zoom at the pointer. Choose Pan, or use Alt-drag / middle-drag. Home fits the board. M measures between two points. V selects; H pans.</p><p><b>Editing</b><br>Offsets use the displayed unit. Rotate around the selection centre or board origin. Mirrors change X or Y. Ctrl+Z undoes; Ctrl+Y redoes. Save a .gcraft project to retain all layers.</p><p><b>Export</b><br>Visible layers, active layer or selection. Gerber output uses millimetres with six decimal places. Arcs and circles remain exact primitives. Clear polarity is retained. Unsupported imports are rejected with a reason.</p><p>Supported: C/R/O/P apertures, macro primitives 1/4/5/20/21/22, lines with circular apertures, G74/G75 arcs, regions, polarity, step-repeat, units and zero omission. Unsupported: aperture blocks, moiré/thermal macros, non-circular drawing apertures and ODB++. Excellon supports explicit-decimal or declared-format absolute holes and G85 slots; routing and repeats are rejected. Import .drl files with the same Import button. Use Add hole / slot or Edit drills in the inspector. Export drill data separately. Board setup maps physical layers for the 3D preview.</p>";
    modal("GerbCraft quick guide", div, [{ label: "Done", primary: true }]);
  },
  license: async () => {
    license = await desktop.licenseStatus();
    if (license.mode === "perpetual") {
      const body = document.createElement("p");
      body.textContent =
        "Perpetual access is included. Editing, saving and all exports are enabled, with no activation or expiry date.";
      modal("GerbCraft licence", body, [{ label: "Done", primary: true }]);
      return;
    }
    const div = document.createElement("div");
    const info = document.createElement("p");
    info.textContent =
      license.mode === "development"
        ? "Development build: editing, saving and export are enabled. A signed commercial build requires a public issuer key before distribution."
        : license.active
          ? `Activated for ${license.license.customer}. ${license.license.expires ? "Expires " + license.license.expires : "Perpetual licence."}`
          : "Viewer mode. Import a signed licence to enable saving and export.";
    const code = inputField(
      "Installation code — send this to your licence issuer",
      license.deviceId,
    );
    code.input.readOnly = true;
    div.append(info, code.el);
    if (license.error) {
      const e = document.createElement("p");
      e.textContent = license.error;
      div.append(e);
    }
    modal("GerbCraft activation", div, [
      { label: "Close" },
      {
        label: "Import licence…",
        primary: true,
        action: async () => {
          if (!(await desktop.activate())) return;
          await updateLicense();
          notify("Licence activated.");
        },
      },
    ]);
  },
};
for (const b of document.querySelectorAll("[data-action]"))
  b.onclick = () => guarded(commands[b.dataset.action]);
desktop?.onCommand((c) => {
  if (
    document.activeElement?.matches("input,textarea,select") &&
    ["undo", "redo", "selectAll", "delete"].includes(c)
  ) {
    if (c === "selectAll") document.activeElement.select?.();
    else document.execCommand(c === "delete" ? "forwardDelete" : c);
    return;
  }
  if ($("previewDialog").open || $("modal").open) return;
  if (commands[c]) guarded(commands[c]);
});
$("closeModal").onclick = () => $("modal").close();
$("addLayer").onclick = () => guarded(commands.import);
$("demoButton").onclick = () => guarded(() => importFiles(demoFiles));
for (const t of ["select", "pan", "measure"])
  $(t + "Tool").onclick = () => setTool(t);
$("zoomIn").onclick = () => zoom(1.3);
$("zoomOut").onclick = () => zoom(1 / 1.3);
$("gridToggle").onchange = draw;
$("unitSelect").onchange = (e) => {
  const old = factor();
  unit = e.target.value;
  for (const id of ["moveX", "moveY"])
    $(id).value = Number(((Number($(id).value) * old) / factor()).toFixed(6));
  update();
};
$("clearSelection").onclick = () => {
  model.selected.clear();
  update();
};
$("showAll").onclick = () => {
  model.commit("Show all layers", (d) =>
    d.layers.forEach((l) => (l.visible = true)),
  );
  update();
};
$("hideAll").onclick = () => {
  model.commit("Hide all layers", (d) =>
    d.layers.forEach((l) => (l.visible = false)),
  );
  update();
};
const selectedOrigin = () =>
  $("pivot").value === "origin"
    ? { x: 0, y: 0 }
    : groupCenter(model.objects(true));
for (const [id, fn] of [
  [
    "moveButton",
    () =>
      model.transform({
        dx: Number($("moveX").value) * factor(),
        dy: Number($("moveY").value) * factor(),
      }),
  ],
  [
    "copyButton",
    () =>
      model.transform(
        {
          dx: Number($("moveX").value) * factor(),
          dy: Number($("moveY").value) * factor(),
        },
        true,
      ),
  ],
  [
    "rotateButton",
    () =>
      model.transform({
        angle: Number($("angle").value),
        origin: selectedOrigin(),
      }),
  ],
  ["mirrorX", () => model.transform({ mirror: "x", origin: selectedOrigin() })],
  ["mirrorY", () => model.transform({ mirror: "y", origin: selectedOrigin() })],
])
  $(id).onclick = () =>
    guarded(() => {
      fn();
      update();
      status(
        id === "copyButton" ? "Selection copied." : "Selection transformed.",
      );
    });
window.addEventListener("keydown", (e) => {
  if (
    $("modal").open ||
    $("previewDialog").open ||
    e.target.matches("input,textarea,select")
  )
    return;
  if (e.ctrlKey || e.metaKey) return;
  if (e.key === "v" || e.key === "V") setTool("select");
  if (e.key === "h" || e.key === "H") setTool("pan");
  if (e.key === "m" || e.key === "M") setTool("measure");
  if (e.key === "Escape") {
    model.selected.clear();
    measure = null;
    update();
  }
});
async function updateLicense() {
  license = await desktop.licenseStatus();
  $("licenseBadge").textContent =
    license.mode === "perpetual"
      ? "◈ Perpetual · No activation required"
      : license.mode === "development"
        ? "◈ Development build · Activation settings"
        : license.active
          ? `◈ Licensed · ${license.license.customer}`
          : "◈ Viewer mode · Activate GerbCraft";
}
new ResizeObserver(resize).observe($("workspace"));
update();
guarded(updateLicense);

$("projectName").ondblclick = () => {
  const name = inputField("Project name", model.data.name);
  modal("Rename project", name.el, [
    { label: "Cancel" },
    {
      label: "Rename",
      primary: true,
      action: () => {
        const value = name.input.value.trim();
        if (!value || value.length > 200)
          throw Error("Enter a project name up to 200 characters.");
        model.commit("Rename project", (d) => (d.name = value));
        update();
      },
    },
  ]);
};

function chooseField(label, options, value) {
  const el = document.createElement("label");
  el.textContent = label;
  const input = document.createElement("select");
  input.setAttribute("aria-label", label);
  for (const [v, t] of options) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    input.append(o);
  }
  input.value = value;
  el.append(input);
  return { el, input };
}
function drillDialog(edit = false) {
  const picked = model.objects(true),
    single = edit && picked.length === 1 ? picked[0] : null;
  if (edit && (!picked.length || picked.some((o) => o.kind !== "drill")))
    throw Error(
      "Select drill holes only. Hide artwork layers to make selection easier.",
    );
  const body = document.createElement("div"),
    fields = {},
    add = (key, label, value, type = "number") => {
      const f = inputField(label, value, type);
      body.append(f.el);
      fields[key] = f.input;
    };
  const layers = model.data.layers.filter(
    (l) => l.type === "drill" && l.visible && !l.locked,
  );
  const target = chooseField(
    "Drill layer",
    [["", "Create new drill layer"], ...layers.map((l) => [l.id, l.name])],
    layers.some((l) => l.id === activeLayer) ? activeLayer : "",
  );
  if (!edit) body.append(target.el);
  add(
    "diameter",
    "Hole diameter / slot width (mm)",
    single?.diameter || picked[0]?.diameter || 1,
  );
  const plating = chooseField(
    "Plating",
    [
      ["plated", "Plated"],
      ["non-plated", "Non-plated"],
      ["unknown", "Unspecified"],
    ],
    single?.plating || picked[0]?.plating || "plated",
  );
  body.append(plating.el);
  const shape = chooseField(
    "Shape",
    [
      ["hole", "Round hole"],
      ["slot", "Straight slot"],
    ],
    single?.end ? "slot" : "hole",
  );
  if (!edit || single) {
    body.append(shape.el);
    add("x", "X centre / slot start (mm)", single?.at.x || 0);
    add("y", "Y centre / slot start (mm)", single?.at.y || 0);
    add("endX", "Slot end X (mm)", single?.end?.x ?? (single?.at.x || 0) + 2);
    add("endY", "Slot end Y (mm)", single?.end?.y ?? (single?.at.y || 0));
    const toggle = () => {
      fields.endX.parentElement.hidden = fields.endY.parentElement.hidden =
        shape.input.value !== "slot";
    };
    shape.input.onchange = toggle;
    toggle();
  }
  const note = document.createElement("p");
  note.textContent = edit
    ? `${picked.length} selected drill(s). Changes apply only to these holes. Copper pads are unchanged.`
    : "Through holes only. Coordinates are always millimetres. Copper pads are unchanged.";
  body.append(note);
  modal(edit ? "Edit drills" : "Add hole / slot", body, [
    { label: "Cancel" },
    {
      label: edit ? "Apply" : "Add",
      primary: true,
      action: () => {
        const number = (k) => {
          if (
            !fields[k].value.trim() ||
            !Number.isFinite(Number(fields[k].value))
          )
            throw Error("Enter a valid " + k + ".");
          return Number(fields[k].value);
        };
        const values = {
          diameter: number("diameter"),
          plating: plating.input.value,
        };
        if (!edit || single) {
          values.at = { x: number("x"), y: number("y") };
          values.end =
            shape.input.value === "slot"
              ? { x: number("endX"), y: number("endY") }
              : undefined;
        }
        if (edit) model.editDrills(values);
        else {
          model.addDrill(target.input.value, values);
          activeLayer = target.input.value || model.data.layers.at(-1).id;
        }
        update();
        notify(edit ? "Drills updated." : "Drill added.");
      },
    },
  ]);
}
$("addDrill").onclick = () => guarded(() => drillDialog());
$("editDrill").onclick = () => guarded(() => drillDialog(true));
$("exportDrill").onclick = () =>
  guarded(() => {
    const body = document.createElement("div"),
      scope = chooseField(
        "Export scope",
        [
          ["active", "Active drill layer"],
          ["selected", "Selected drill holes"],
          ["all", "All drill layers (including hidden)"],
        ],
        "active",
      ),
      plating = chooseField(
        "Plating to export",
        [
          ["plated", "Plated"],
          ["non-plated", "Non-plated"],
        ],
        "plated",
      );
    const all = model.data.layers
        .flatMap((l) => l.objects)
        .filter((o) => o.kind === "drill"),
      summary = document.createElement("p");
    summary.textContent = `${all.length} drill objects: ${all.filter((o) => o.plating === "plated").length} plated, ${all.filter((o) => o.plating === "non-plated").length} non-plated, ${all.filter((o) => o.plating === "unknown").length} unspecified. Plated and non-plated output uses separate files. Export regenerates tools by diameter.`;
    body.append(scope.el, plating.el, summary);
    modal("Export drills", body, [
      { label: "Cancel" },
      {
        label: "Export…",
        primary: true,
        action: async () => {
          const objects = (
            scope.input.value === "selected"
              ? model.objects(true)
              : scope.input.value === "active"
                ? model.data.layers.find((l) => l.id === activeLayer)
                    ?.objects || []
                : all
          ).filter(
            (o) => o.kind === "drill" && o.plating === plating.input.value,
          );
          const text = exportDrill(objects),
            p = await desktop.exportDrill({
              text,
              name:
                model.data.name +
                (plating.input.value === "plated" ? "-PTH.drl" : "-NPTH.drl"),
            });
          if (p) notify(`Exported ${objects.length} drill holes / slots.`);
        },
      },
    ]);
  });
$("boardSetup").onclick = () =>
  guarded(() => {
    const current = boardSettings(model.data),
      body = document.createElement("div"),
      thickness = inputField(
        "Overall board thickness (mm)",
        current.thickness,
        "number",
      ),
      copper = inputField(
        "Copper thickness per side (mm; recorded only)",
        current.copperThickness,
        "number",
      ),
      finish = chooseField(
        "Surface finish",
        [
          ["ENIG", "ENIG"],
          ["HASL", "HASL"],
          ["Copper", "Bare copper"],
        ],
        current.finish,
      ),
      mask = inputField("Mask colour", current.mask, "color"),
      silk = inputField("Silkscreen colour", current.silk, "color");
    const note = document.createElement("p");
    note.textContent =
      "Two copper layers · FR4. Initial roles are inferred from file attributes or names. Confirm the mapping and dimensions; defaults are assumptions. Use the fabrication notes to confirm these values.";
    body.append(note, thickness.el, copper.el, finish.el, mask.el, silk.el);
    const roles = model.data.layers.map((l) => {
      const f = chooseField(
        l.name,
        (l.type === "drill"
          ? ["ignore", "drill"]
          : ROLES.filter((r) => r !== "drill")
        ).map((r) => [r, r.replaceAll("-", " ")]),
        current.roles[l.id],
      );
      body.append(f.el);
      return [l.id, f.input];
    });
    modal("Board setup", body, [
      { label: "Cancel" },
      {
        label: "Apply",
        primary: true,
        action: () => {
          const b = {
            ...current,
            thickness: Number(thickness.input.value),
            copperThickness: Number(copper.input.value),
            finish: finish.input.value,
            mask: mask.input.value,
            silk: silk.input.value,
            roles: Object.fromEntries(
              roles.map(([id, input]) => [id, input.value]),
            ),
          };
          validateBoard(b, model.data);
          model.commit("Board setup", (d) => {
            d.version = 2;
            d.board = b;
          });
          update();
          notify("Board setup saved in this project.");
        },
      },
    ]);
  });
let preview;
$("preview3d").onclick = () =>
  guarded(() => {
    const board = buildBoard(model.data);
    $("previewDialog").showModal();
    $("previewSummary").textContent =
      `${(board.bounds.maxX - board.bounds.minX).toFixed(3)} × ${(board.bounds.maxY - board.bounds.minY).toFixed(3)} × ${board.setup.thickness.toFixed(3)} mm · ${board.drills.length} drill holes / slots · ${board.setup.material} · ${board.setup.finish}. ${model.data.board ? "" : "Board settings use unconfirmed defaults. "}${board.warnings.join(" ")}`;
    preview = createPreview($("previewCanvas"), model.data, board);
    preview.draw();
  });
$("closePreview").onclick = () => {
  $("previewDialog").close();
  preview = null;
};
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => preview?.view(b.dataset.view);
$("savePreview").onclick = () =>
  guarded(async () => {
    if (await desktop.savePreview($("previewCanvas").toDataURL("image/png")))
      notify("Preview image saved.");
  });
