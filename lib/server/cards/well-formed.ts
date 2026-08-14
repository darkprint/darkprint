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
   for once — not repeated here).

   Two more, both from T-02 (2026-08-14): `addCard`'s `body` is an
   in-process object this module never re-parses, so shared
   substructure survives and a diamond of depth `n` was visited
   2^n times, 22 levels measuring 75 s. Fixed with two changes,
   neither sufficient alone: `open` is one mutable set with
   explicit enter/leave bookkeeping (push on enter, delete on
   leave, via a "leave" marker frame) rather than a fresh `Set`
   copy handed to every child — same cycle-detection correctness
   (still exactly the objects on the current path from the root),
   O(1) per visit instead of O(depth); and `seen` remembers every
   container walked to completion and found clean, so the second
   and every later path into a shared value skips it rather than
   re-walking it — content well-formedness cannot depend on which
   parent pointed at it, so memoizing across paths (unlike `open`,
   which must stay path-scoped to still catch a real cycle) is
   sound.
   ============================================================ */

export interface WellFormednessIssue {
  /** Dotted/bracketed path to the offending value, e.g. `body.params.notes[2]`. */
  path: string;
}

type Frame = { kind: "enter"; value: unknown; path: string } | { kind: "leave"; container: object };

/**
 * `undefined` when `source` and every string in `body` (keys included) round-trip;
 * the first offending path otherwise.
 */
export function findWellFormednessIssue(source: string, body: unknown): WellFormednessIssue | undefined {
  if (!source.isWellFormed()) return { path: "source" };

  const open = new Set<object>();
  const seen = new Set<object>();
  const stack: Frame[] = [{ kind: "enter", value: body, path: "body" }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;

    if (frame.kind === "leave") {
      open.delete(frame.container);
      seen.add(frame.container);
      continue;
    }

    const { value, path } = frame;

    if (typeof value === "string") {
      if (!value.isWellFormed()) return { path };
      continue;
    }
    if (typeof value !== "object" || value === null) continue;
    if (seen.has(value)) continue;
    if (open.has(value)) return { path };

    open.add(value);
    // Pushed before the children: on a LIFO stack the children (pushed after)
    // pop and fully drain — including their own nested leave markers — before
    // this one is reached, so popping it is exactly "value's whole subtree is
    // done", which is when it's safe to mark clean.
    stack.push({ kind: "leave", container: value });

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        stack.push({ kind: "enter", value: value[i], path: `${path}[${i}]` });
      }
    } else {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        if (!key.isWellFormed()) return { path: `${path}.${key}` };
        stack.push({ kind: "enter", value: v, path: `${path}.${key}` });
      }
    }
  }
  return undefined;
}
