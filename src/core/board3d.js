import { earcut, flatten, deviation, clipping } from "../vendor/polygons.js";
import { pointsBounds } from "./geometry.js";
export const ROLES = [
  "ignore",
  "outline",
  "top-copper",
  "bottom-copper",
  "top-mask",
  "bottom-mask",
  "top-silk",
  "bottom-silk",
  "drill",
];
export function inferRole(l) {
  if (l.type === "drill") return "drill";
  const a =
    (l.attributes || []).find((a) => a.startsWith("TF.FileFunction,")) || "";
  if (a.includes("Profile")) return "outline";
  const side = a.includes(",Top")
    ? "top"
    : a.includes(",Bot")
      ? "bottom"
      : null;
  if (side) {
    if (a.includes("Copper")) return side + "-copper";
    if (a.includes("Soldermask")) return side + "-mask";
    if (a.includes("Legend")) return side + "-silk";
  }
  const n = l.name.toLowerCase();
  if (/edge[_. -]?cuts|outline|\.gko$/.test(n)) return "outline";
  const names = [
    ["top-copper", /f_cu|\.gtl$/],
    ["bottom-copper", /b_cu|\.gbl$/],
    ["top-mask", /f_mask|\.gts$/],
    ["bottom-mask", /b_mask|\.gbs$/],
    ["top-silk", /f_silkscreen|\.gto$/],
    ["bottom-silk", /b_silkscreen|\.gbo$/],
  ];
  return names.find(([, r]) => r.test(n))?.[0] || "ignore";
}
export function boardSettings(d) {
  return {
    thickness: 1.6,
    material: "FR4",
    finish: "ENIG",
    copperThickness: 0.035,
    mask: "#176343",
    silk: "#f0ebd4",
    ...d.board,
    roles: Object.fromEntries(
      d.layers.map((l) => [l.id, d.board?.roles?.[l.id] || inferRole(l)]),
    ),
  };
}
export function validateBoard(b, d) {
  if (
    !b ||
    !Number.isFinite(b.thickness) ||
    b.thickness < 0.1 ||
    b.thickness > 20 ||
    !Number.isFinite(b.copperThickness) ||
    b.copperThickness <= 0 ||
    b.copperThickness * 2 >= b.thickness ||
    !["FR4"].includes(b.material) ||
    !["ENIG", "HASL", "Copper"].includes(b.finish) ||
    !/^#[a-f\d]{6}$/i.test(b.mask) ||
    !/^#[a-f\d]{6}$/i.test(b.silk) ||
    !b.roles ||
    Array.isArray(b.roles) ||
    typeof b.roles !== "object"
  )
    throw Error(
      "Invalid board setup. Thickness must be 0.1–20 mm and exceed both copper layers.",
    );
  for (const l of d.layers) {
    const r = b.roles[l.id];
    if (
      r &&
      (!ROLES.includes(r) ||
        (r === "drill" && l.type !== "drill") ||
        (l.type === "drill" && !["ignore", "drill"].includes(r)))
    )
      throw Error("Invalid board layer role.");
  }
  return b;
}
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 0.001;
export function segmentPoints(s) {
  if (s.kind === "line") return [s.start, s.end];
  const r = Math.hypot(s.start.x - s.center.x, s.start.y - s.center.y),
    a = Math.atan2(s.start.y - s.center.y, s.start.x - s.center.x),
    end = Math.atan2(s.end.y - s.center.y, s.end.x - s.center.x),
    tau = 2 * Math.PI;
  let span = s.cw ? -((a - end + tau) % tau) : (end - a + tau) % tau;
  if (near(s.start, s.end)) span = s.cw ? -tau : tau;
  const step = Math.min(
      Math.PI / 12,
      2 * Math.acos(Math.max(-1, 1 - 0.005 / r)),
    ),
    count = Math.max(2, Math.ceil(Math.abs(span) / step));
  if (count > 20000) throw Error("Outline arc is too complex for preview.");
  return Array.from({ length: count + 1 }, (_, i) =>
    i === 0
      ? s.start
      : i === count
        ? s.end
        : {
            x: s.center.x + r * Math.cos(a + (span * i) / count),
            y: s.center.y + r * Math.sin(a + (span * i) / count),
          },
  );
}
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function intersects(a, b, c, d) {
  const v = [cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)];
  const on = (a, b, p) =>
    Math.abs(cross(a, b, p)) < 1e-9 &&
    p[0] >= Math.min(a[0], b[0]) - 1e-9 &&
    p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    p[1] >= Math.min(a[1], b[1]) - 1e-9 &&
    p[1] <= Math.max(a[1], b[1]) + 1e-9;
  return (
    (v[0] * v[1] < 0 && v[2] * v[3] < 0) ||
    on(a, b, c) ||
    on(a, b, d) ||
    on(c, d, a) ||
    on(c, d, b)
  );
}
export function outlineRings(objects) {
  if (
    !objects.length ||
    objects.some(
      (o) => !["line", "arc"].includes(o.kind) || o.polarity !== "dark",
    )
  )
    throw Error("Outline must contain dark line/arc centre paths only.");
  const remaining = [...objects],
    rings = [];
  while (remaining.length) {
    const first = remaining.shift();
    let points = segmentPoints(first);
    while (!near(points[0], points.at(-1))) {
      const end = points.at(-1),
        candidates = remaining
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => near(s.start, end) || near(s.end, end));
      if (candidates.length !== 1)
        throw Error(
          "Outline is open or branches. Repair the profile before 3D preview.",
        );
      const { s, i } = candidates[0];
      remaining.splice(i, 1);
      let ps = segmentPoints(s);
      if (!near(ps[0], end)) ps.reverse();
      points.push(...ps.slice(1));
    }
    points.pop();
    if (points.length < 3) throw Error("Outline has a degenerate contour.");
    rings.push(points.map((p) => [p.x, p.y]));
  }
  const edges = rings.flatMap((r, ri) =>
    r.map((a, i) => ({ a, b: r[(i + 1) % r.length], i, ri, n: r.length })),
  );
  if (edges.length > 10000)
    throw Error("Outline exceeds preview complexity limit.");
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const a = edges[i],
        b = edges[j];
      if (
        a.ri === b.ri &&
        (Math.abs(a.i - b.i) === 1 || Math.abs(a.i - b.i) === a.n - 1)
      )
        continue;
      if (intersects(a.a, a.b, b.a, b.b))
        throw Error(
          "Outline contours cross or touch. Repair the profile before 3D preview.",
        );
    }
  return rings;
}
export function drillRing(o) {
  const r = o.diameter / 2,
    a = o.at,
    b = o.end || o.at,
    angle = Math.atan2(b.y - a.y, b.x - a.x),
    points = [];
  const n = Math.max(
    16,
    Math.ceil(
      Math.PI / Math.acos(Math.max(-1, 1 - Math.min(0.005, r / 20) / r)),
    ),
  );
  if (!o.end || near(a, b))
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI;
      points.push([a.x + r * Math.cos(t), a.y + r * Math.sin(t)]);
    }
  else
    for (const [p, start] of [
      [b, angle - Math.PI / 2],
      [a, angle + Math.PI / 2],
    ])
      for (let i = 0; i <= n / 2; i++) {
        const t = start + (i / Math.floor(n / 2)) * Math.PI;
        points.push([p.x + r * Math.cos(t), p.y + r * Math.sin(t)]);
      }
  return points;
}
export function buildBoard(d) {
  const setup = validateBoard(boardSettings(d), d),
    role = (l) => setup.roles[l.id],
    outlines = d.layers.filter((l) => role(l) === "outline");
  if (outlines.length !== 1)
    throw Error("Choose exactly one outline layer in Board setup.");
  for (const r of [
    "top-copper",
    "bottom-copper",
    "top-mask",
    "bottom-mask",
    "top-silk",
    "bottom-silk",
  ])
    if (d.layers.filter((l) => role(l) === r).length > 1)
      throw Error("Choose at most one layer for " + r + ".");
  const rings = outlineRings(outlines[0].objects),
    bounds = pointsBounds(rings.flat().map(([x, y]) => ({ x, y })));
  let area = [];
  for (const ring of rings)
    area = area.length ? clipping.xor(area, [[ring]]) : [[ring]];
  const drills = d.layers
      .filter((l) => role(l) === "drill")
      .flatMap((l) => l.objects),
    warnings = [];
  if (drills.length > 5000)
    throw Error("3D preview currently supports up to 5,000 drill holes.");
  if (!drills.length)
    warnings.push("No drill layer assigned: holes are not represented.");
  if (drills.some((o) => o.plating === "unknown"))
    warnings.push("Some hole plating is unspecified.");
  const holes = drills.map(drillRing);
  const outside = holes.filter(
    (r) => clipping.difference([[r]], area).length,
  ).length;
  if (outside)
    warnings.push(
      `${outside} hole(s) cross or lie outside the profile. Check drill alignment.`,
    );
  for (let i = 0; i < holes.length; i += 100)
    area = clipping.difference(
      area,
      ...holes.slice(i, i + 100).map((r) => [[r]]),
    );
  if (!area.length) throw Error("Drills remove the entire board profile.");
  const triangles = [];
  for (const polygon of area) {
    const f = flatten(polygon),
      indices = earcut(f.vertices, f.holes, f.dimensions);
    if (deviation(f.vertices, f.holes, f.dimensions, indices) > 1e-6)
      throw Error("Could not triangulate board reliably.");
    for (let i = 0; i < indices.length; i += 3)
      triangles.push(
        indices
          .slice(i, i + 3)
          .map((k) => ({ x: f.vertices[2 * k], y: f.vertices[2 * k + 1] })),
      );
  }
  return { setup, bounds, rings, area, triangles, drills, warnings };
}
