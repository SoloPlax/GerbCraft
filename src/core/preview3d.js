// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

import { drawObject } from "./render.js";
const makeCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
export function surfaceTexture(data, board, side, size = 1600) {
  const b = board.bounds,
    w = b.maxX - b.minX,
    h = b.maxY - b.minY,
    scale = (size - 2) / Math.max(w, h),
    width = Math.ceil(w * scale) + 2,
    height = Math.ceil(h * scale) + 2;
  const canvas = makeCanvas(width, height),
    ctx = canvas.getContext("2d"),
    layer = makeCanvas(width, height),
    lc = layer.getContext("2d"),
    scratch = makeCanvas(width, height),
    view = { scale, ox: 1 - b.minX * scale, oy: 1 + b.maxY * scale };
  ctx.fillStyle = "#827849";
  ctx.fillRect(0, 0, width, height);
  const artwork = (role, color) => {
    lc.resetTransform();
    lc.clearRect(0, 0, width, height);
    lc.setTransform(scale, 0, 0, -scale, view.ox, view.oy);
    const l = data.layers.find((l) => board.setup.roles[l.id] === role);
    if (l)
      for (const o of l.objects) {
        lc.globalCompositeOperation =
          o.polarity === "clear" ? "destination-out" : "source-over";
        drawObject(lc, o, color, view, scratch);
      }
    lc.globalCompositeOperation = "source-over";
    return !!l;
  };
  const finish = { ENIG: "#d4b663", HASL: "#bdc4c9", Copper: "#bd764a" }[
    board.setup.finish
  ];
  artwork(side + "-copper", finish);
  ctx.drawImage(layer, 0, 0);
  if (artwork(side + "-mask", "#ffffff")) {
    const mask = makeCanvas(width, height),
      mc = mask.getContext("2d");
    mc.fillStyle = board.setup.mask;
    mc.fillRect(0, 0, width, height);
    mc.globalCompositeOperation = "destination-out";
    mc.drawImage(layer, 0, 0);
    ctx.globalAlpha = 0.91;
    ctx.drawImage(mask, 0, 0);
    ctx.globalAlpha = 1;
  }
  artwork(side + "-silk", board.setup.silk);
  ctx.drawImage(layer, 0, 0);
  return {
    pixels: ctx.getImageData(0, 0, width, height).data,
    width,
    height,
    view,
  };
}
export function createPreview(canvas, data, board) {
  const textures = {
      top: surfaceTexture(data, board, "top"),
      bottom: surfaceTexture(data, board, "bottom"),
    },
    b = board.bounds,
    cx = (b.minX + b.maxX) / 2,
    cy = (b.minY + b.maxY) / 2,
    extent = Math.hypot(
      b.maxX - b.minX,
      b.maxY - b.minY,
      board.setup.thickness,
    ),
    z = board.setup.thickness / 2;
  const faces = [];
  for (const tri of board.triangles) {
    faces.push({ vertices: tri.map((p) => ({ ...p, z })), side: "top" });
    faces.push({ vertices: tri.map((p) => ({ ...p, z: -z })), side: "bottom" });
  }
  for (const poly of board.area)
    for (const ring of poly)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = { x: ring[i][0], y: ring[i][1] },
          b = { x: ring[i + 1][0], y: ring[i + 1][1] };
        faces.push(
          {
            vertices: [
              { ...a, z },
              { ...b, z },
              { ...b, z: -z },
            ],
          },
          {
            vertices: [
              { ...a, z },
              { ...b, z: -z },
              { ...a, z: -z },
            ],
          },
        );
      }
  let yaw = -0.35,
    tilt = 0.72,
    zoom = 1,
    offset = { x: 0, y: 0 },
    drag = null,
    pending = false;
  const ctx = canvas.getContext("2d");
  function draw() {
    pending = false;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(200, Math.min(1000, Math.round(rect.width)));
    canvas.height = Math.max(200, Math.min(700, Math.round(rect.height)));
    const w = canvas.width,
      h = canvas.height,
      scale = ((Math.min(w, h) * 0.9) / extent) * zoom,
      img = ctx.createImageData(w, h),
      pixels = img.data,
      depth = new Float32Array(w * h).fill(-Infinity),
      co = Math.cos(yaw),
      si = Math.sin(yaw),
      ct = Math.cos(tilt),
      st = Math.sin(tilt);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 12;
      pixels[i + 1] = 17;
      pixels[i + 2] = 25;
      pixels[i + 3] = 255;
    }
    const project = (p) => {
      const x = p.x - cx,
        y = p.y - cy,
        rx = x * co - y * si,
        ry = x * si + y * co;
      return {
        x: w / 2 + offset.x + rx * scale,
        y: h / 2 + offset.y - (ry * ct - p.z * st) * scale,
        z: ry * st + p.z * ct,
      };
    };
    for (const face of faces) {
      const v = face.vertices.map(project),
        [a, b, c] = v,
        den = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
      if (Math.abs(den) < 1e-8) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x))),
        x1 = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x))),
        y0 = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y))),
        y1 = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
      const texture = textures[face.side],
        uv = texture
          ? face.vertices.map((p) => ({
              u: p.x * texture.view.scale + texture.view.ox,
              v: -p.y * texture.view.scale + texture.view.oy,
            }))
          : null;
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const u =
              ((b.y - c.y) * (x + 0.5 - c.x) + (c.x - b.x) * (y + 0.5 - c.y)) /
              den,
            vv =
              ((c.y - a.y) * (x + 0.5 - c.x) + (a.x - c.x) * (y + 0.5 - c.y)) /
              den,
            t = 1 - u - vv;
          if (u < -1e-8 || vv < -1e-8 || t < -1e-8) continue;
          const zz = u * a.z + vv * b.z + t * c.z,
            index = y * w + x;
          if (zz <= depth[index]) continue;
          depth[index] = zz;
          const dst = index * 4;
          if (texture) {
            const tx = Math.max(
                0,
                Math.min(
                  texture.width - 1,
                  Math.round(u * uv[0].u + vv * uv[1].u + t * uv[2].u),
                ),
              ),
              ty = Math.max(
                0,
                Math.min(
                  texture.height - 1,
                  Math.round(u * uv[0].v + vv * uv[1].v + t * uv[2].v),
                ),
              ),
              src = (ty * texture.width + tx) * 4,
              light = 0.78 + 0.22 * Math.abs(ct);
            for (let k = 0; k < 3; k++)
              pixels[dst + k] = texture.pixels[src + k] * light;
          } else {
            pixels[dst] = 112;
            pixels[dst + 1] = 104;
            pixels[dst + 2] = 66;
          }
        }
    }
    ctx.putImageData(img, 0, 0);
  }
  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(draw);
    }
  }
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = {
      x: e.clientX,
      y: e.clientY,
      yaw,
      tilt,
      offset: { ...offset },
      pan: e.shiftKey || e.button === 1,
    };
  };
  canvas.onpointermove = (e) => {
    if (!drag) return;
    const x = e.clientX - drag.x,
      y = e.clientY - drag.y;
    if (drag.pan) offset = { x: drag.offset.x + x, y: drag.offset.y + y };
    else {
      yaw = drag.yaw + x * 0.008;
      tilt = drag.tilt + y * 0.008;
    }
    schedule();
  };
  canvas.onpointerup = canvas.onpointercancel = () => (drag = null);
  canvas.oncontextmenu = (e) => e.preventDefault();
  canvas.onwheel = (e) => {
    e.preventDefault();
    zoom = Math.max(0.2, Math.min(12, zoom * Math.exp(-e.deltaY * 0.001)));
    schedule();
  };
  return {
    draw,
    view(name) {
      offset = { x: 0, y: 0 };
      zoom = 1;
      if (name === "top") {
        yaw = 0;
        tilt = 0;
      } else if (name === "bottom") {
        yaw = Math.PI;
        tilt = Math.PI;
      } else {
        yaw = -0.35;
        tilt = 0.72;
      }
      draw();
    },
  };
}
