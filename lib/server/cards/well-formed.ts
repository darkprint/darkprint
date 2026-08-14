/* ============================================================
   DarkPrint backend — the well-formedness walk
   `pg` encodes query parameters as UTF-8; an unpaired UTF-16
   surrogate has no UTF-8 encoding and is silently rewritten to
   U+FFFD, which would store a `cardDigest` naming bytes never
   actually held. Refused, not repaired — for `source` and every
   string reachable inside `body`, keys included, since a
   surrogate in a `params` key would get the same silent rewrite.

   Iterative from the start: a recursive walk closes cycles
   correctly and still dies with `RangeError` at ~20 000 deep,
   which a 120 KB request body reaches (T010's own defect, paid
   for once — not repeated here). An explicit stack, and cycle
   detection scoped to the current path rather than one global
   visited-set, so the same value legitimately reachable at two
   different paths (structural sharing, not a cycle) is never
   flagged.
   ============================================================ */

export interface WellFormednessIssue {
  /** Dotted/bracketed path to the offending value, e.g. `body.params.notes[2]`. */
  path: string;
}

interface Frame {
  value: unknown;
  path: string;
  ancestors: ReadonlySet<object>;
}

/**
 * `undefined` when `source` and every string in `body` (keys included) round-trip;
 * the first offending path otherwise.
 */
export function findWellFormednessIssue(source: string, body: unknown): WellFormednessIssue | undefined {
  if (!source.isWellFormed()) return { path: "source" };

  const stack: Frame[] = [{ value: body, path: "body", ancestors: new Set() }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    const { value, path, ancestors } = frame;

    if (typeof value === "string") {
      if (!value.isWellFormed()) return { path };
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    if (ancestors.has(value)) return { path };

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        stack.push({ value: value[i], path: `${path}[${i}]`, ancestors: nextAncestors });
      }
    } else {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (!key.isWellFormed()) return { path: `${path}.${key}` };
        stack.push({ value: v, path: `${path}.${key}`, ancestors: nextAncestors });
      }
    }
  }
  return undefined;
}
