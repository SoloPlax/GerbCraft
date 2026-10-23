// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

// A deliberately strict Excellon subset. Ambiguous implied-decimal files are rejected.
export function validateDrill(o) {
  const point = (p) =>
    p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Math.abs(p.x) <= 1e6 &&
    Math.abs(p.y) <= 1e6;
  if (
    o.kind !== "drill" ||
    !point(o.at) ||
    (o.end && !point(o.end)) ||
    !Number.isFinite(o.diameter) ||
    o.diameter <= 0 ||
    o.diameter > 1000 ||
    !["plated", "non-plated", "unknown"].includes(o.plating) ||
    o.span !== "through"
  )
    throw Error(
      "Invalid drill geometry, diameter, plating or span. Only through holes are supported.",
    );
  return o;
}
export function parseDrill(text, name = "Drills.drl") {
  const tools = new Map(),
    objects = [],
    warnings = [];
  let unit,
    integer,
    decimals,
    zeros,
    tool,
    pos = { x: 0, y: 0 },
    ended = false,
    header = true,
    plating = "unknown";
  const format = text.match(/FORMAT\s*=\s*\{(\d+):(\d+)/i);
  if (format) {
    integer = Number(format[1]);
    decimals = Number(format[2]);
  }
  if (/TF\.FileFunction,NonPlated/i.test(text)) plating = "non-plated";
  else if (/TF\.FileFunction,Plated/i.test(text)) plating = "plated";
  const span = text.match(/TF\.FileFunction,(?:NonPlated|Plated),(\d+),(\d+)/i);
  if (span && (span[1] !== "1" || span[2] !== "2"))
    throw Error(
      "Only two-layer through drill files are supported; confirm layer span before importing.",
    );
  const coordinate = (s) => {
    if (!unit) throw Error("Drill units are missing.");
    if (s.includes(".")) return Number(s) * unit;
    if (integer === undefined || decimals === undefined || !zeros)
      throw Error(
        "Ambiguous drill coordinate format. Supply a FORMAT={3:3/...} header or export decimal coordinates.",
      );
    const sign = s.startsWith("-") ? -1 : 1,
      digits = s.replace(/^[+-]/, "");
    if (digits.length > integer + decimals || integer + decimals > 12)
      throw Error("Invalid drill coordinate precision.");
    // Excellon TZ means trailing zeros are INCLUDED; LZ means leading zeros included.
    return (
      ((sign *
        Number(
          zeros === "LZ" ? digits.padEnd(integer + decimals, "0") : digits,
        )) /
        10 ** decimals) *
      unit
    );
  };
  const xy = (s, previous) => {
    if (
      !/^(?:X[+-]?(?:\d+(?:\.\d*)?|\.\d+))?(?:Y[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(
        s,
      ) ||
      !s
    )
      throw Error("Unsupported drill coordinate: " + s);
    const q = { ...previous };
    for (const m of s.matchAll(/([XY])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g))
      q[m[1].toLowerCase()] = coordinate(m[2]);
    return q;
  };
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.split(";")[0].trim().toUpperCase();
    if (!s) continue;
    if (ended) throw Error("Unexpected data after drill end.");
    if (s === "M48") continue;
    if (s === "%" || s === "M95") {
      header = false;
      continue;
    }
    if (s === "FMAT,2" || s === "G90" || s === "G05") continue;
    if (s === "M30") {
      ended = true;
      continue;
    }
    let m = s.match(/^(METRIC|INCH)(?:,(TZ|LZ))?(?:,(0+)\.(0+))?$/);
    if (m) {
      unit = m[1] === "METRIC" ? 1 : 25.4;
      zeros = m[2];
      if (m[3]) {
        integer = m[3].length;
        decimals = m[4].length;
      }
      continue;
    }
    m = s.match(/^T(\d+)C(\d*\.?\d+)$/);
    if (m) {
      if (!header || !unit)
        throw Error("Drill tool must be defined after units in the header.");
      const d = Number(m[2]) * unit;
      if (!d || d > 1000 || tools.has(Number(m[1])))
        throw Error("Invalid or duplicate drill tool.");
      tools.set(Number(m[1]), d);
      continue;
    }
    m = s.match(/^T(\d+)$/);
    if (m) {
      tool = Number(m[1]);
      continue;
    }
    if (s.startsWith("X") || s.startsWith("Y") || s.startsWith("G85")) {
      if (header || !tools.has(tool))
        throw Error("Select a defined drill tool before coordinates.");
      const parts = s.split("G85");
      if (parts.length > 2) throw Error("Invalid slot.");
      const at = parts[0] ? xy(parts[0], pos) : { ...pos },
        end = parts.length === 2 ? xy(parts[1], at) : undefined;
      const o = {
        id: crypto.randomUUID(),
        kind: "drill",
        polarity: "dark",
        at,
        diameter: tools.get(tool),
        plating,
        span: "through",
        sourceTool: tool,
      };
      if (end) o.end = end;
      objects.push(validateDrill(o));
      pos = end || at;
      if (objects.length > 200000)
        throw Error("Drill file exceeds 200,000 holes.");
      continue;
    }
    throw Error(
      "Unsupported Excellon command: " +
        s +
        ". Routing, repeats and incremental coordinates are not yet supported.",
    );
  }
  if (!ended || header) throw Error("Incomplete Excellon file.");
  if (plating === "unknown")
    warnings.push("Drill plating is unspecified; confirm in the drill editor.");
  return { name, type: "drill", objects, warnings };
}
export function exportDrill(objects) {
  if (!objects.length) throw Error("No drill holes to export.");
  objects.forEach(validateDrill);
  const plating = new Set(objects.map((o) => o.plating));
  if (plating.size !== 1)
    throw Error("Export plated and non-plated holes separately.");
  const p = objects[0].plating;
  if (p === "unknown") throw Error("Confirm hole plating before export.");
  const diameters = [...new Set(objects.map((o) => o.diameter))].sort(
      (a, b) => a - b,
    ),
    f = (n) => n.toFixed(6),
    xy = (p) => `X${f(p.x)}Y${f(p.y)}`;
  const out = [
    "M48",
    "; GerbCraft decimal millimetres",
    `; #@! TF.FileFunction,${p === "plated" ? "Plated" : "NonPlated"},1,2,${p === "plated" ? "PTH" : "NPTH"}`,
    "FMAT,2",
    "METRIC,TZ",
    ...diameters.map((d, i) => `T${i + 1}C${f(d)}`),
    "%",
    "G90",
    "G05",
  ];
  diameters.forEach((d, i) => {
    out.push(`T${i + 1}`);
    for (const o of objects.filter((o) => o.diameter === d))
      out.push(xy(o.at) + (o.end ? "G85" + xy(o.end) : ""));
  });
  out.push("M30");
  return out.join("\n") + "\n";
}
