import {
  circleAperture,
  rectPoints,
  rotate,
  transformAperture,
  transformObject,
  circularWidth,
} from "./geometry.js";
const LIMIT = 200000,
  MAX = 1e6;
const finite = (n) => {
  if (!Number.isFinite(n) || Math.abs(n) > MAX)
    throw Error("Coordinate or dimension is outside the supported range.");
  return n;
};
const positive = (n) => {
  finite(n);
  if (n <= 0) throw Error("Aperture dimensions must be positive.");
  return n;
};
// Small arithmetic interpreter: macro expressions never execute JavaScript.
export function expression(source, vars = {}) {
  const tokens =
    source.match(
      /\$\d+|(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?|[()+\-xX*/]/g,
    ) || [];
  if (tokens.join("") !== source.replace(/\s/g, ""))
    throw Error("Invalid aperture macro expression.");
  let i = 0;
  const atom = () => {
    const t = tokens[i++];
    if (t === "-") return -atom();
    if (t === "+") return atom();
    if (t === "(") {
      const v = sum();
      if (tokens[i++] !== ")") throw Error("Unbalanced macro expression.");
      return v;
    }
    if (t?.startsWith("$")) return vars[t] ?? 0;
    if (t === undefined || !/^\d|^\./.test(t))
      throw Error("Incomplete macro expression.");
    return Number(t);
  };
  const product = () => {
    let v = atom();
    while (["x", "X", "*", "/"].includes(tokens[i])) {
      const op = tokens[i++],
        n = atom();
      v = op === "/" ? v / n : v * n;
    }
    return v;
  };
  const sum = () => {
    let v = product();
    while (["+", "-"].includes(tokens[i])) {
      const op = tokens[i++],
        n = product();
      v = op === "+" ? v + n : v - n;
    }
    return v;
  };
  const value = sum();
  if (i !== tokens.length) throw Error("Invalid macro expression.");
  return finite(value);
}
function macroAperture(lines, args, unit) {
  const vars = Object.fromEntries(args.map((v, i) => ["$" + (i + 1), v])),
    components = [];
  for (const line of lines) {
    if (!line || /^0(?:\s|,|$)/.test(line)) continue;
    if (line.startsWith("$")) {
      const [name, value] = line.split("=");
      if (!/^\$\d+$/.test(name) || value === undefined)
        throw Error("Invalid macro variable.");
      vars[name] = expression(value, vars);
      continue;
    }
    const v = line.split(",").map((s) => expression(s, vars)),
      code = v[0],
      dark = v[1] === 1;
    if (v[1] !== 0 && v[1] !== 1) throw Error("Invalid macro exposure.");
    if (code === 1) {
      if (v.length < 5 || v.length > 6) throw Error("Invalid circle macro.");
      components.push({
        kind: "circle",
        dark,
        diameter: positive(v[2] * unit),
        center: rotate({ x: v[3] * unit, y: v[4] * unit }, v[5] || 0),
      });
    } else if (code === 21 || code === 22) {
      if (v.length !== 7) throw Error("Invalid rectangular macro.");
      const w = positive(v[2] * unit),
        h = positive(v[3] * unit),
        center = {
          x: v[4] * unit + (code === 22 ? w / 2 : 0),
          y: v[5] * unit + (code === 22 ? h / 2 : 0),
        };
      components.push({
        kind: "polygon",
        dark,
        points: rectPoints(w, h, center, v[6]),
      });
    } else if (code === 20) {
      if (v.length !== 8) throw Error("Invalid vector-line macro.");
      const w = positive(v[2] * unit),
        a = { x: v[3] * unit, y: v[4] * unit },
        b = { x: v[5] * unit, y: v[6] * unit },
        len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len === 0) throw Error("Zero-length vector-line macro.");
      const nx = ((-(b.y - a.y) / len) * w) / 2,
        ny = (((b.x - a.x) / len) * w) / 2;
      components.push({
        kind: "polygon",
        dark,
        points: [
          { x: a.x + nx, y: a.y + ny },
          { x: b.x + nx, y: b.y + ny },
          { x: b.x - nx, y: b.y - ny },
          { x: a.x - nx, y: a.y - ny },
        ].map((p) => rotate(p, v[7])),
      });
    } else if (code === 4) {
      const n = v[2];
      if (
        !Number.isInteger(n) ||
        n < 3 ||
        n > 5000 ||
        v.length !== 2 * (n + 1) + 4
      )
        throw Error("Invalid outline macro.");
      const pts = [];
      for (let j = 0; j <= n; j++)
        pts.push(
          rotate({ x: v[3 + 2 * j] * unit, y: v[4 + 2 * j] * unit }, v.at(-1)),
        );
      if (Math.hypot(pts[0].x - pts.at(-1).x, pts[0].y - pts.at(-1).y) > 1e-7)
        throw Error("Macro outline is not closed.");
      components.push({ kind: "polygon", dark, points: pts.slice(0, -1) });
    } else if (code === 5) {
      const n = v[2];
      if (v.length !== 7 || !Number.isInteger(n) || n < 3 || n > 12)
        throw Error("Invalid polygon macro.");
      positive(v[5]);
      components.push({
        kind: "polygon",
        dark,
        points: Array.from({ length: n }, (_, i) =>
          rotate(
            {
              x: (v[3] + (v[5] / 2) * Math.cos((i * 2 * Math.PI) / n)) * unit,
              y: (v[4] + (v[5] / 2) * Math.sin((i * 2 * Math.PI) / n)) * unit,
            },
            v[6],
          ),
        ),
      });
    } else
      throw Error(
        `Macro primitive ${code} is not supported (supported: 1, 4, 5, 20, 21, 22).`,
      );
    if (components.length > 5000) throw Error("Macro is too complex.");
  }
  if (!components.length) throw Error("Empty aperture macro.");
  return { components };
}
function standardAperture(type, args, unit) {
  const n = args.map((x) => x * unit);
  let ap;
  if (type === "C") {
    finite(n[0]);
    if (n[0] < 0) throw Error("Circle diameter cannot be negative.");
    ap = circleAperture(n[0]);
  } else if (type === "R") {
    ap = {
      components: [
        {
          kind: "polygon",
          dark: true,
          points: rectPoints(positive(n[0]), positive(n[1])),
        },
      ],
    };
  } else if (type === "O") {
    const w = positive(n[0]),
      h = positive(n[1]),
      d = Math.min(w, h),
      offset = (Math.max(w, h) - d) / 2;
    ap = circleAperture(d);
    ap.components[0].center =
      w >= h ? { x: -offset, y: 0 } : { x: 0, y: -offset };
    if (offset > 0) {
      ap.components.push(
        {
          kind: "circle",
          dark: true,
          diameter: d,
          center: w >= h ? { x: offset, y: 0 } : { x: 0, y: offset },
        },
        {
          kind: "polygon",
          dark: true,
          points: rectPoints(w >= h ? 2 * offset : d, w >= h ? d : 2 * offset),
        },
      );
    }
  } else if (type === "P") {
    positive(n[0]);
    const count = args[1];
    if (!Number.isInteger(count) || count < 3 || count > 12)
      throw Error("Polygon aperture must have 3–12 vertices.");
    ap = {
      components: [
        {
          kind: "polygon",
          dark: true,
          points: Array.from({ length: count }, (_, i) =>
            rotate(
              {
                x: (n[0] / 2) * Math.cos((i * 2 * Math.PI) / count),
                y: (n[0] / 2) * Math.sin((i * 2 * Math.PI) / count),
              },
              args[2] || 0,
            ),
          ),
        },
      ],
    };
  } else throw Error("Unknown aperture " + type);
  const holeIndex = type === "C" ? 1 : type === "P" ? 3 : 2;
  if (args.length > holeIndex + 1)
    throw Error("Rectangular aperture holes are not supported.");
  if (type === "C" && n[0] === 0 && n[holeIndex] > 0)
    throw Error("A zero-diameter circle cannot contain a hole.");
  if (n[holeIndex] > 0)
    ap.components.push({
      kind: "circle",
      dark: false,
      center: { x: 0, y: 0 },
      diameter: n[holeIndex],
    });
  return ap;
}
export function parseGerber(text, name = "Untitled.gbr") {
  if (typeof text !== "string" || text.length > 50 * 1024 * 1024)
    throw Error("Gerber file exceeds 50 MB.");
  const tokens = [];
  let pos = 0;
  while (pos < text.length) {
    while (/\s/.test(text[pos] || "") && pos < text.length) pos++;
    if (pos === text.length) break;
    const extended = text[pos] === "%";
    const end = text.indexOf(extended ? "%" : "*", pos + (extended ? 1 : 0));
    if (end < 0) throw Error("Unterminated Gerber command.");
    tokens.push({
      extended,
      raw: text.slice(pos + (extended ? 1 : 0), end).trim(),
    });
    pos = end + 1;
    if (tokens.length > LIMIT * 10) throw Error("Too many Gerber commands.");
  }
  let format = null,
    unit = null,
    zero = "L",
    absolute = true,
    at = { x: 0, y: 0 },
    mode = 1,
    operation = 2,
    selected = null,
    polarity = "dark",
    region = null,
    contour = null,
    quadrant = 75,
    ended = false,
    apTransform = { angle: 0, mirror: null, scale: 1 },
    repeat = null;
  const macros = new Map(),
    aps = new Map(),
    objects = [],
    warnings = [],
    attributes = [];
  const coord = (str, axis) => {
    if (str === undefined) return undefined;
    if (!format || unit === null)
      throw Error("Coordinates require FS format and MO units.");
    const f = format[axis],
      sign = str.startsWith("-") ? -1 : 1,
      digits = str.replace(/^[+-]/, "");
    if (digits.includes(".")) return finite(Number(str) * unit);
    if (digits.length > f[0] + f[1])
      throw Error("Coordinate exceeds declared format.");
    const padded = zero === "T" ? digits.padEnd(f[0] + f[1], "0") : digits;
    return finite(((sign * Number(padded)) / 10 ** f[1]) * unit);
  };
  const emit = (o) => {
    const copies = repeat || { x: 1, y: 1, i: 0, j: 0 };
    for (let x = 0; x < copies.x; x++)
      for (let y = 0; y < copies.y; y++) {
        objects.push({
          ...transformObject(o, {
            origin: { x: 0, y: 0 },
            dx: x * copies.i,
            dy: y * copies.j,
          }),
          id: `o${objects.length + 1}`,
        });
        if (objects.length > LIMIT)
          throw Error(`File exceeds ${LIMIT} objects.`);
      }
  };
  const aperture = () => {
    if (!aps.has(selected)) throw Error("Drawing requires a defined aperture.");
    let a = transformAperture(aps.get(selected), {
      angle: apTransform.angle,
      mirror: apTransform.mirror,
    });
    for (const c of a.components) {
      if (c.kind === "circle") {
        c.diameter *= apTransform.scale;
        c.center.x *= apTransform.scale;
        c.center.y *= apTransform.scale;
      } else
        c.points = c.points.map((p) => ({
          x: p.x * apTransform.scale,
          y: p.y * apTransform.scale,
        }));
    }
    return a;
  };
  const closeContour = () => {
    if (contour?.length) {
      const a = contour[0].start,
        b = contour.at(-1).end;
      if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-7)
        contour.push({ kind: "line", start: b, end: a });
      region.push(contour);
    }
    contour = [];
  };
  for (const token of tokens) {
    if (ended) break;
    try {
      if (token.extended) {
        const lines = token.raw
          .split("*")
          .map((x) => x.trim())
          .filter(Boolean);
        if (lines[0]?.startsWith("AM")) {
          macros.set(lines[0].slice(2), lines.slice(1));
          continue;
        }
        for (const cmd of lines) {
          let m;
          if ((m = cmd.match(/^FS([LT])([AI])X(\d)(\d)Y(\d)(\d)$/))) {
            zero = m[1];
            absolute = m[2] === "A";
            format = { X: [+m[3], +m[4]], Y: [+m[5], +m[6]] };
            if ([...format.X, ...format.Y].some((n) => n > 7))
              throw Error("Unsupported coordinate format.");
          } else if (cmd === "MOMM") unit = 1;
          else if (cmd === "MOIN") unit = 25.4;
          else if ((m = cmd.match(/^ADD(\d+)([^,]+)(?:,(.*))?$/))) {
            if (unit === null)
              throw Error("Set units before defining apertures.");
            const args = m[3] ? m[3].split("X").map(Number) : [];
            if (args.some((x) => !Number.isFinite(x)))
              throw Error("Invalid aperture parameter.");
            const ap = macros.has(m[2])
              ? macroAperture(macros.get(m[2]), args, unit)
              : standardAperture(m[2], args, unit);
            aps.set(+m[1], ap);
          } else if (cmd === "LPD" || cmd === "LPC")
            polarity = cmd === "LPD" ? "dark" : "clear";
          else if (/^L[RS]/.test(cmd)) {
            const n = finite(Number(cmd.slice(2)));
            if (cmd.startsWith("LR")) apTransform.angle = n;
            else apTransform.scale = positive(n);
          } else if (/^LM(N|X|Y|XY)$/.test(cmd)) {
            const v = cmd.slice(2);
            apTransform.mirror = v === "N" ? null : v.toLowerCase();
          } else if (cmd === "SR") repeat = null;
          else if (
            (m = cmd.match(/^SRX(\d+)Y(\d+)I([+\-\d.]+)J([+\-\d.]+)$/))
          ) {
            if (unit === null || region)
              throw Error("Invalid step-repeat context.");
            repeat = {
              x: +m[1],
              y: +m[2],
              i: finite(+m[3] * unit),
              j: finite(+m[4] * unit),
            };
            if (repeat.x < 1 || repeat.y < 1 || repeat.x * repeat.y > 10000)
              throw Error("Step-repeat count exceeds limit.");
          } else if (/^T[FADO]/.test(cmd)) {
            attributes.push(cmd);
            if (
              !warnings.includes(
                "X2 attributes are read as metadata; exported geometry omits net/component attributes.",
              )
            )
              warnings.push(
                "X2 attributes are read as metadata; exported geometry omits net/component attributes.",
              );
          } else if (cmd === "IPPOS" || cmd === "ASAXBY") {
          } else
            throw Error(`Unsupported extended command: ${cmd.slice(0, 50)}`);
        }
        continue;
      }
      const cmd = token.raw.replace(/\s/g, "");
      if (!cmd || /^G0?4/.test(cmd)) continue;
      if (/^M0?[02]$/.test(cmd)) {
        if (region) throw Error("Unclosed region.");
        ended = true;
        continue;
      }
      let rest = cmd;
      rest = rest.replace(/G(\d+)/g, (_, s) => {
        const g = +s;
        if ([1, 2, 3].includes(g)) mode = g;
        else if (g === 36) {
          if (region) throw Error("Nested regions.");
          region = [];
          contour = [];
        } else if (g === 37) {
          if (!region) throw Error("G37 without region.");
          closeContour();
          if (!region.length) throw Error("Empty region.");
          emit({ kind: "region", contours: region, polarity });
          region = null;
          contour = null;
        } else if (g === 74 || g === 75) quadrant = g;
        else if (g === 70) unit = 25.4;
        else if (g === 71) unit = 1;
        else if (g === 90) absolute = true;
        else if (g === 91) absolute = false;
        else if (g !== 54 && g !== 55) throw Error(`Unsupported G${g}.`);
        return "";
      });
      const values = {};
      rest = rest.replace(
        /([XYIJ])([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g,
        (_, k, v) => {
          if (values[k] !== undefined) throw Error("Duplicate coordinate.");
          values[k] = v;
          return "";
        },
      );
      rest = rest.replace(/D(\d+)/g, (_, v) => {
        const d = +v;
        if (d >= 10) selected = d;
        else if (d >= 1 && d <= 3) operation = d;
        else throw Error("Invalid D operation.");
        return "";
      });
      if (rest) throw Error(`Unsupported command: ${rest.slice(0, 50)}`);
      if (!Object.keys(values).length && !/D0?[123]$/.test(cmd)) continue;
      const next = {
        x:
          values.X === undefined
            ? at.x
            : (absolute ? 0 : at.x) + coord(values.X, "X"),
        y:
          values.Y === undefined
            ? at.y
            : (absolute ? 0 : at.y) + coord(values.Y, "Y"),
      };
      if (operation === 2) {
        if (region) closeContour();
        at = next;
        continue;
      }
      if (operation === 3) {
        if (region) throw Error("Flash inside region.");
        emit({ kind: "flash", at: next, aperture: aperture(), polarity });
        at = next;
        continue;
      }
      let segment = { kind: "line", start: { ...at }, end: next };
      if (mode !== 1) {
        const i = coord(values.I || "0", "X"),
          j = coord(values.J || "0", "Y");
        let center = { x: at.x + i, y: at.y + j };
        const valid = (c) =>
          Math.abs(
            Math.hypot(at.x - c.x, at.y - c.y) -
              Math.hypot(next.x - c.x, next.y - c.y),
          ) <=
          Math.max(
            0.00005,
            (2 * unit) / 10 ** Math.min(format.X[1], format.Y[1]),
          );
        if (quadrant === 74) {
          const options = [];
          for (const sx of [-1, 1])
            for (const sy of [-1, 1]) {
              const c = {
                  x: at.x + sx * Math.abs(i),
                  y: at.y + sy * Math.abs(j),
                },
                a = Math.atan2(at.y - c.y, at.x - c.x),
                b = Math.atan2(next.y - c.y, next.x - c.x),
                sweep =
                  ((mode === 2 ? a - b : b - a) + Math.PI * 4) % (Math.PI * 2);
              if (valid(c) && sweep <= Math.PI / 2 + 1e-5) options.push(c);
            }
          if (!options.length) throw Error("Invalid single-quadrant arc.");
          center = options[0];
        }
        if (
          !valid(center) ||
          Math.hypot(at.x - center.x, at.y - center.y) === 0
        )
          throw Error("Arc centre does not match endpoints.");
        segment = { ...segment, kind: "arc", center, cw: mode === 2 };
      }
      if (region) contour.push(segment);
      else {
        const ap = aperture();
        if (circularWidth(ap) === null)
          throw Error(
            "Drawing with a non-circular aperture is not supported; convert the stroke to a region first.",
          );
        emit({ ...segment, aperture: ap, polarity });
      }
      at = next;
    } catch (e) {
      throw Error(`${name}: ${e.message} [${token.raw.slice(0, 80)}]`);
    }
  }
  if (region) throw Error(`${name}: Unclosed region.`);
  if (!ended) throw Error(`${name}: Missing M02 end-of-file command.`);
  if (!objects.length) throw Error(`${name}: No drawable geometry found.`);
  return { name, objects, warnings, attributes };
}
const num = (n) => {
  finite(n);
  return (
    (Math.abs(n) < 0.00000005 ? 0 : n).toFixed(6).replace(/\.?0+$/, "") || "0"
  );
};
const coordinate = (n) => {
  const value = Math.round(finite(n) * 1e6);
  if (Math.abs(value) > 999999999999)
    throw Error("Coordinate exceeds Gerber 6.6 output range.");
  return value;
};
const xy = (p) => `X${coordinate(p.x)}Y${coordinate(p.y)}`;
export function exportGerber(objects, { name = "GerbCraft" } = {}) {
  if (objects.some((o) => o.kind === "drill"))
    throw Error(
      "Use Export drills for hole data. Hide drill layers or choose an artwork layer for Gerber export.",
    );
  if (!objects.length) throw Error("No geometry to export.");
  const lines = [
      `G04 ${name.replace(/[^a-zA-Z0-9 ._-]/g, "_")} - GerbCraft*`,
      "%FSLAX66Y66*%",
      "%MOMM*%",
      "%IPPOS*%",
    ],
    aps = new Map();
  let next = 10;
  const key = (a) => JSON.stringify(a.components);
  for (const o of objects)
    if (o.aperture && !aps.has(key(o.aperture)))
      aps.set(key(o.aperture), { code: next++, ap: o.aperture });
  for (const { code, ap } of aps.values()) {
    const width = circularWidth(ap);
    if (width !== null) lines.push(`%ADD${code}C,${num(width)}*%`);
    else {
      const parts = [`%AMGC${code}*`];
      for (const c of ap.components) {
        if (c.kind === "circle")
          parts.push(
            `1,${c.dark ? 1 : 0},${num(c.diameter)},${num(c.center.x)},${num(c.center.y)},0*`,
          );
        else {
          const pts = [...c.points, c.points[0]];
          parts.push(
            `4,${c.dark ? 1 : 0},${c.points.length},${pts.map((p) => `${num(p.x)},${num(p.y)}`).join(",")},0*`,
          );
        }
      }
      parts.push("%", `%ADD${code}GC${code}*%`);
      lines.push(...parts);
    }
  }
  lines.push("G75*");
  let polarity = null,
    apCode = null;
  const segment = (s) => {
    if (s.kind === "arc")
      return `G0${s.cw ? 2 : 3}${xy(s.end)}I${coordinate(s.center.x - s.start.x)}J${coordinate(s.center.y - s.start.y)}D01*`;
    return `G01${xy(s.end)}D01*`;
  };
  for (const o of objects) {
    if (o.polarity !== polarity) {
      polarity = o.polarity;
      lines.push(`%LP${polarity === "clear" ? "C" : "D"}*%`);
    }
    if (o.aperture) {
      const code = aps.get(key(o.aperture)).code;
      if (code !== apCode) {
        lines.push(`D${code}*`);
        apCode = code;
      }
    }
    if (o.kind === "flash") lines.push(`G01${xy(o.at)}D03*`);
    else if (o.kind === "region") {
      lines.push("G36*");
      for (const c of o.contours) {
        lines.push(`G01${xy(c[0].start)}D02*`);
        for (const s of c) lines.push(segment(s));
      }
      lines.push("G37*");
    } else {
      lines.push(`G01${xy(o.start)}D02*`, segment(o));
    }
  }
  lines.push("M02*");
  return lines.join("\n") + "\n";
}
