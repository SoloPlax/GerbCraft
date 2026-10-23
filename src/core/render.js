// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { objectBounds, circularWidth, circleAperture } from "./geometry.js";
export function segmentPath(path, s) {
  if (s.kind === "arc") {
    const r = Math.hypot(s.start.x - s.center.x, s.start.y - s.center.y),
      a = Math.atan2(s.start.y - s.center.y, s.start.x - s.center.x),
      b = Math.atan2(s.end.y - s.center.y, s.end.x - s.center.x);
    const full = Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y) < 1e-8;
    path.arc(
      s.center.x,
      s.center.y,
      r,
      a,
      full ? a + (s.cw ? -2 : 2) * Math.PI : b,
      s.cw,
    );
  } else path.lineTo(s.end.x, s.end.y);
}
export function componentPath(c) {
  const p = new Path2D();
  if (c.kind === "circle")
    p.arc(c.center.x, c.center.y, c.diameter / 2, 0, 2 * Math.PI);
  else {
    p.moveTo(c.points[0].x, c.points[0].y);
    for (const q of c.points.slice(1)) p.lineTo(q.x, q.y);
    p.closePath();
  }
  return p;
}
export function objectPath(o) {
  const p = new Path2D();
  if (o.kind === "region") {
    for (const c of o.contours) {
      p.moveTo(c[0].start.x, c[0].start.y);
      for (const s of c) segmentPath(p, s);
      p.closePath();
    }
  } else if (o.kind !== "flash") {
    p.moveTo(o.start.x, o.start.y);
    segmentPath(p, o);
  }
  return p;
}
export function drawObject(ctx, o, color, view, scratch) {
  if (o.kind === "drill") o = drillArtwork(o);
  // Zero-size standard circular apertures carry no image area. Canvas ignores
  // lineWidth=0, so do not accidentally render these using the previous width.
  if (o.aperture && circularWidth(o.aperture) === 0) return;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (o.kind === "flash") {
    const hasClear = o.aperture.components.some((c) => !c.dark);
    if (hasClear) {
      const sc = scratch.getContext("2d");
      sc.resetTransform();
      sc.clearRect(0, 0, scratch.width, scratch.height);
      sc.setTransform(view.scale, 0, 0, -view.scale, view.ox, view.oy);
      sc.translate(o.at.x, o.at.y);
      sc.fillStyle = color;
      for (const c of o.aperture.components) {
        sc.globalCompositeOperation = c.dark
          ? "source-over"
          : "destination-out";
        sc.fill(componentPath(c));
      }
      sc.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.resetTransform();
      ctx.drawImage(scratch, 0, 0);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(o.at.x, o.at.y);
      for (const c of o.aperture.components) ctx.fill(componentPath(c));
      ctx.restore();
    }
  } else if (o.kind === "region") ctx.fill(objectPath(o), "evenodd");
  else {
    ctx.lineWidth = circularWidth(o.aperture);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(objectPath(o));
  }
}
export function hitObject(ctx, o, p, tolerance) {
  if (o.kind === "drill") o = drillArtwork(o);
  if (o.aperture && circularWidth(o.aperture) === 0) return false;
  const b = objectBounds(o);
  if (
    p.x < b.minX - tolerance ||
    p.x > b.maxX + tolerance ||
    p.y < b.minY - tolerance ||
    p.y > b.maxY + tolerance
  )
    return false;
  ctx.save();
  ctx.resetTransform();
  let hit = false;
  if (o.kind === "flash") {
    for (const c of o.aperture.components)
      if (ctx.isPointInPath(componentPath(c), p.x - o.at.x, p.y - o.at.y))
        hit = c.dark;
  } else if (o.kind === "region")
    hit = ctx.isPointInPath(objectPath(o), p.x, p.y, "evenodd");
  else {
    ctx.lineCap = "round";
    ctx.lineWidth = circularWidth(o.aperture) + 2 * tolerance;
    hit = ctx.isPointInStroke(objectPath(o), p.x, p.y);
  }
  ctx.restore();
  return hit;
}

function drillArtwork(o) {
  return o.end
    ? {
        kind: "line",
        start: o.at,
        end: o.end,
        aperture: circleAperture(o.diameter),
      }
    : { kind: "flash", at: o.at, aperture: circleAperture(o.diameter) };
}
