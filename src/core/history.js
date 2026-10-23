// Copyright (C) 2026 SoloPlax
// SPDX-License-Identifier: GPL-3.0-only

// Reversible structural patches retain changed values, not complete boards.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function diff(a, b, path = [], out = []) {
  if (equal(a, b)) return out;
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
    let start = 0,
      end = 0;
    while (start < Math.min(a.length, b.length) && equal(a[start], b[start]))
      start++;
    while (
      end < Math.min(a.length, b.length) - start &&
      equal(a[a.length - 1 - end], b[b.length - 1 - end])
    )
      end++;
    out.push({
      path,
      splice: start,
      before: a.slice(start, a.length - end),
      after: b.slice(start, b.length - end),
    });
  } else if (
    a &&
    b &&
    typeof a === "object" &&
    typeof b === "object" &&
    Array.isArray(a) === Array.isArray(b)
  ) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(key in a) || !(key in b))
        out.push({
          path: [...path, key],
          before: a[key],
          after: b[key],
          hadBefore: key in a,
          hadAfter: key in b,
        });
      else diff(a[key], b[key], [...path, key], out);
    }
  } else
    out.push({ path, before: a, after: b, hadBefore: true, hadAfter: true });
  return out;
}
export function applyPatches(data, patches, forward) {
  for (const p of forward ? patches : [...patches].reverse()) {
    const value = structuredClone(forward ? p.after : p.before);
    if ("splice" in p) {
      const a = p.path.reduce((o, k) => o[k], data);
      // Avoid argument-count limits for large imports.
      const result = [
        ...a.slice(0, p.splice),
        ...value,
        ...a.slice(p.splice + (forward ? p.before : p.after).length),
      ];
      const parent = p.path.slice(0, -1).reduce((o, k) => o[k], data);
      parent[p.path.at(-1)] = result;
    } else {
      const parent = p.path.slice(0, -1).reduce((o, k) => o[k], data),
        key = p.path.at(-1);
      if (forward ? p.hadAfter : p.hadBefore) parent[key] = value;
      else delete parent[key];
    }
  }
}
