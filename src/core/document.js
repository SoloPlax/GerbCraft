// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { validateBoard } from "./board3d.js";
import { diff, applyPatches } from "./history.js";
import { validateDrill } from "./drill.js";
import {
  clone,
  transformObject,
  groupCenter,
  objectBounds,
  circularWidth,
} from "./geometry.js";
export const COLORS = [
  "#57d6c1",
  "#f5b65a",
  "#879dff",
  "#f17e9d",
  "#d6cd72",
  "#b48ced",
];
export const newDocument = () => ({
  format: "gerbcraft",
  version: 1,
  name: "Untitled board",
  layers: [],
});
export function validateDocument(d) {
  if (
    !d ||
    typeof d.name !== "string" ||
    d.name.length > 200 ||
    d.format !== "gerbcraft" ||
    ![1, 2].includes(d.version) ||
    !Array.isArray(d.layers) ||
    d.layers.length > 256
  )
    throw Error("This is not a supported GerbCraft project.");
  let count = 0;
  const p = (q) => {
    if (
      !q ||
      !Number.isFinite(q.x) ||
      !Number.isFinite(q.y) ||
      Math.abs(q.x) > 1e6 ||
      Math.abs(q.y) > 1e6
    )
      throw Error("Invalid project coordinate.");
  };
  const ap = (a) => {
    if (
      !a ||
      !Array.isArray(a.components) ||
      !a.components.length ||
      a.components.length > 5000
    )
      throw Error("Invalid project aperture.");
    for (const c of a.components) {
      if (typeof c.dark !== "boolean")
        throw Error("Invalid aperture exposure.");
      if (c.kind === "circle") {
        p(c.center);
        if (
          !Number.isFinite(c.diameter) ||
          c.diameter < 0 ||
          c.diameter > 1e6 ||
          (c.diameter === 0 && circularWidth(a) !== 0)
        )
          throw Error("Invalid circle diameter.");
      } else if (
        c.kind === "polygon" &&
        Array.isArray(c.points) &&
        c.points.length >= 3 &&
        c.points.length <= 5000
      )
        c.points.forEach(p);
      else throw Error("Invalid aperture component.");
    }
  };
  const segment = (o) => {
    p(o.start);
    p(o.end);
    if (o.kind === "arc") {
      p(o.center);
      if (typeof o.cw !== "boolean") throw Error("Invalid arc direction.");
      const r = Math.hypot(o.start.x - o.center.x, o.start.y - o.center.y),
        r2 = Math.hypot(o.end.x - o.center.x, o.end.y - o.center.y);
      if (r <= 0 || Math.abs(r - r2) > 0.001)
        throw Error("Invalid arc radius.");
    } else if (o.kind !== "line") throw Error("Invalid segment.");
  };
  const ids = new Set();
  for (const l of d.layers) {
    if (
      typeof l.id !== "string" ||
      ids.has(l.id) ||
      typeof l.name !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(l.color) ||
      typeof l.visible !== "boolean" ||
      typeof l.locked !== "boolean" ||
      !Array.isArray(l.objects)
    )
      throw Error("Invalid project layer.");
    ids.add(l.id);
    const oids = new Set();
    for (const o of l.objects) {
      if (++count > 200000) throw Error("Project exceeds 200,000 objects.");
      if (
        typeof o.id !== "string" ||
        oids.has(o.id) ||
        !["dark", "clear"].includes(o.polarity)
      )
        throw Error("Invalid project object.");
      oids.add(o.id);
      if (o.kind === "drill") {
        if (d.version < 2 || l.type !== "drill" || o.polarity !== "dark")
          throw Error("Invalid drill layer.");
        validateDrill(o);
      } else if (l.type === "drill") throw Error("Artwork in drill layer.");
      else if (o.kind === "region") {
        if (!Array.isArray(o.contours) || !o.contours.length)
          throw Error("Invalid region.");
        for (const c of o.contours) {
          if (!Array.isArray(c) || !c.length) throw Error("Empty contour.");
          for (const s of c) segment(s);
          for (let i = 0; i < c.length; i++) {
            const e = c[i].end,
              s = c[(i + 1) % c.length].start;
            if (Math.hypot(e.x - s.x, e.y - s.y) > 1e-6)
              throw Error("Disconnected region contour.");
          }
        }
      } else {
        ap(o.aperture);
        if (o.kind === "flash") p(o.at);
        else {
          segment(o);
          if (circularWidth(o.aperture) === null)
            throw Error("Non-circular drawing aperture in project.");
        }
      }
      objectBounds(o);
    }
  }
  if (d.board) {
    if (d.version < 2) throw Error("Board setup requires project version 2.");
    validateBoard(d.board, d);
  }
  return clone(d);
}
export class EditorDocument {
  constructor() {
    this.data = newDocument();
    this.selected = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.saved = JSON.stringify(this.data);
  }
  get dirty() {
    return JSON.stringify(this.data) !== this.saved;
  }
  markSaved() {
    this.saved = JSON.stringify(this.data);
  }
  load(d) {
    this.data = validateDocument(d);
    this.selected.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.markSaved();
  }
  commit(label, change) {
    const before = clone(this.data);
    try {
      change(this.data);
    } catch (e) {
      this.data = before;
      throw e;
    }
    const patches = diff(before, this.data);
    if (!patches.length) return;
    this.undoStack.push({ label, patches: clone(patches) });
    let bytes = 0;
    this.undoStack = this.undoStack
      .reverse()
      .filter((s, i) => {
        bytes += JSON.stringify(s.patches).length * 2;
        return i < 100 && bytes <= 64 * 1024 * 1024;
      })
      .reverse();
    this.redoStack = [];
    this.prune();
  }
  undo() {
    const s = this.undoStack.pop();
    if (!s) return false;
    applyPatches(this.data, s.patches, false);
    this.redoStack.push(s);
    this.prune();
    return true;
  }
  redo() {
    const s = this.redoStack.pop();
    if (!s) return false;
    applyPatches(this.data, s.patches, true);
    this.undoStack.push(s);
    this.prune();
    return true;
  }
  key(layer, o) {
    return layer.id + "/" + o.id;
  }
  prune() {
    const valid = new Set(
      this.data.layers
        .filter((l) => l.visible && !l.locked)
        .flatMap((l) => l.objects.map((o) => this.key(l, o))),
    );
    this.selected = new Set([...this.selected].filter((k) => valid.has(k)));
  }
  addLayers(parsed) {
    this.commit("Import layers", (d) => {
      if (parsed.some((l) => l.type === "drill")) d.version = 2;
      for (const l of parsed)
        d.layers.push({
          ...(l.type ? { type: l.type } : {}),
          ...(l.attributes ? { attributes: l.attributes } : {}),
          id: crypto.randomUUID(),
          name: l.name,
          color: COLORS[d.layers.length % COLORS.length],
          visible: true,
          locked: false,
          objects: l.objects,
          warnings: l.warnings || [],
        });
    });
  }
  objects(selected = false) {
    return this.data.layers
      .filter((l) => l.visible)
      .flatMap((l) =>
        l.objects.filter(
          (o) => !selected || (!l.locked && this.selected.has(this.key(l, o))),
        ),
      );
  }
  selectAll() {
    this.selected = new Set(
      this.data.layers
        .filter((l) => l.visible && !l.locked)
        .flatMap((l) => l.objects.map((o) => this.key(l, o))),
    );
  }
  transform(t, copy = false) {
    const picked = this.objects(true);
    if (!picked.length)
      throw Error("Select one or more unlocked objects first.");
    for (const n of [t.dx || 0, t.dy || 0, t.angle || 0])
      if (!Number.isFinite(n) || Math.abs(n) > 1e6)
        throw Error("Enter a finite transform value.");
    const transform = { origin: t.origin || groupCenter(picked), ...t };
    this.commit(copy ? "Copy selection" : "Transform selection", (d) => {
      for (const l of d.layers) {
        if (!l.visible || l.locked) continue;
        const additions = [];
        l.objects = l.objects.map((o) => {
          if (!this.selected.has(this.key(l, o))) return o;
          const n = transformObject(o, transform);
          const b = objectBounds(n);
          if (
            Object.values(b).some(
              (v) => !Number.isFinite(v) || Math.abs(v) > 1e6,
            )
          )
            throw Error("Transform exceeds coordinate limits.");
          if (copy) {
            n.id = crypto.randomUUID();
            additions.push(n);
            return o;
          }
          return n;
        });
        l.objects.push(...additions);
      }
    });
  }
  addDrill(layerId, values) {
    const hole = validateDrill({
      id: crypto.randomUUID(),
      kind: "drill",
      polarity: "dark",
      span: "through",
      ...clone(values),
    });
    this.commit("Add drill", (d) => {
      let l = d.layers.find((l) => l.id === layerId);
      if (!l) {
        l = {
          id: crypto.randomUUID(),
          name: "New drills",
          type: "drill",
          color: "#7acbff",
          visible: true,
          locked: false,
          objects: [],
        };
        d.layers.push(l);
      }
      if (l.type !== "drill" || l.locked || !l.visible)
        throw Error("Choose a visible, unlocked drill layer.");
      if (
        d.layers.length > 256 ||
        d.layers.reduce((n, l) => n + l.objects.length, 0) >= 200000
      )
        throw Error("Project limit reached.");
      d.version = 2;
      l.objects.push(hole);
    });
  }
  editDrills(values) {
    const picked = this.objects(true);
    if (!picked.length || picked.some((o) => o.kind !== "drill"))
      throw Error("Select only drill holes to edit.");
    this.commit("Edit drills", (d) => {
      for (const l of d.layers)
        if (l.visible && !l.locked)
          for (let i = 0; i < l.objects.length; i++)
            if (this.selected.has(this.key(l, l.objects[i])))
              l.objects[i] = validateDrill({
                ...l.objects[i],
                ...clone(values),
              });
    });
  }
  deleteSelected() {
    this.commit("Delete selection", (d) => {
      for (const l of d.layers)
        if (l.visible && !l.locked)
          l.objects = l.objects.filter(
            (o) => !this.selected.has(this.key(l, o)),
          );
    });
  }
}
