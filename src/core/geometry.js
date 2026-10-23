// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

export const EPS = 1e-8;
export const clone = (x) => structuredClone(x);
export const point = (x, y) => ({ x, y });
export function rotate(p, angle, origin = { x: 0, y: 0 }) {
  const a = (angle * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a),
    x = p.x - origin.x,
    y = p.y - origin.y;
  return { x: origin.x + x * c - y * s, y: origin.y + x * s + y * c };
}
export function transformPoint(p, t) {
  let q = rotate(p, t.angle || 0, t.origin);
  if (t.mirror === "x" || t.mirror === "xy") q.x = 2 * t.origin.x - q.x;
  if (t.mirror === "y" || t.mirror === "xy") q.y = 2 * t.origin.y - q.y;
  return { x: q.x + (t.dx || 0), y: q.y + (t.dy || 0) };
}
export function transformAperture(ap, t) {
  const q = clone(ap),
    local = { ...t, origin: { x: 0, y: 0 }, dx: 0, dy: 0 };
  for (const c of q.components) {
    if (c.kind === "circle") c.center = transformPoint(c.center, local);
    else c.points = c.points.map((p) => transformPoint(p, local));
  }
  return q;
}
export function transformObject(obj, t) {
  const q = clone(obj);
  if (q.at) q.at = transformPoint(q.at, t);
  if (q.start) q.start = transformPoint(q.start, t);
  if (q.end) q.end = transformPoint(q.end, t);
  if (q.center) q.center = transformPoint(q.center, t);
  if (q.aperture) q.aperture = transformAperture(q.aperture, t);
  if (q.kind === "arc" && t.mirror && t.mirror !== "xy") q.cw = !q.cw;
  if (q.contours)
    q.contours = q.contours.map((c) => c.map((s) => transformObject(s, t)));
  return q;
}
export function apertureBounds(ap) {
  let pts = [];
  for (const c of ap.components) {
    if (c.kind === "circle") {
      const r = c.diameter / 2;
      pts.push(
        { x: c.center.x - r, y: c.center.y - r },
        { x: c.center.x + r, y: c.center.y + r },
      );
    } else pts.push(...c.points);
  }
  return pointsBounds(pts);
}
export function pointsBounds(ps) {
  if (!ps.length) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of ps) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}
export function unionBounds(bs) {
  return pointsBounds(
    bs.filter(Boolean).flatMap((b) => [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.maxY },
    ]),
  );
}
export function objectBounds(o) {
  if (o.kind === "drill") {
    const b = pointsBounds([o.at, o.end || o.at]),
      r = o.diameter / 2;
    return {
      minX: b.minX - r,
      maxX: b.maxX + r,
      minY: b.minY - r,
      maxY: b.maxY + r,
    };
  }
  if (o.kind === "region")
    return unionBounds(o.contours.flat().map(objectBounds));
  const a = o.aperture
    ? apertureBounds(o.aperture)
    : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  if (o.kind === "flash")
    return {
      minX: o.at.x + a.minX,
      maxX: o.at.x + a.maxX,
      minY: o.at.y + a.minY,
      maxY: o.at.y + a.maxY,
    };
  let b = pointsBounds([o.start, o.end]);
  if (o.kind === "arc") {
    const r = Math.hypot(o.start.x - o.center.x, o.start.y - o.center.y);
    const angles = [
      Math.atan2(o.start.y - o.center.y, o.start.x - o.center.x),
      Math.atan2(o.end.y - o.center.y, o.end.x - o.center.x),
    ];
    const tau = 2 * Math.PI,
      n = (x) => ((x % tau) + tau) % tau,
      span = o.cw ? n(angles[0] - angles[1]) : n(angles[1] - angles[0]);
    let ps = [o.start, o.end];
    for (const k of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
      if (
        span < EPS ||
        (o.cw ? n(angles[0] - k) : n(k - angles[0])) <= span + EPS
      )
        ps.push({
          x: o.center.x + r * Math.cos(k),
          y: o.center.y + r * Math.sin(k),
        });
    b = pointsBounds(ps);
  }
  return {
    minX: b.minX + a.minX,
    maxX: b.maxX + a.maxX,
    minY: b.minY + a.minY,
    maxY: b.maxY + a.maxY,
  };
}
export function groupCenter(objects) {
  const b = unionBounds(objects.map(objectBounds));
  return b
    ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
    : { x: 0, y: 0 };
}
export function circleAperture(d) {
  return {
    components: [
      { kind: "circle", center: { x: 0, y: 0 }, diameter: d, dark: true },
    ],
  };
}
export function rectPoints(w, h, c = { x: 0, y: 0 }, a = 0) {
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => rotate({ x: x + c.x, y: y + c.y }, a));
}
export function circularWidth(ap) {
  if (ap?.components.length !== 1) return null;
  const c = ap.components[0];
  return c.kind === "circle" &&
    c.dark &&
    Math.abs(c.center.x) < EPS &&
    Math.abs(c.center.y) < EPS
    ? c.diameter
    : null;
}
