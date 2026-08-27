/* ============================================================
   DarkPrint backend — content that cannot survive storage
   Refused, not repaired. Two failure modes, both silent:

   - An unpaired surrogate. `pg` rewrites it to U+FFFD on the way
     in, so the term that comes back is not the term that went in
     and nothing reports the substitution. This is not a blanket
     unicode ban: a well-formed pair is content and stores fine.
   - A non-finite number, or a circular structure. Neither has a
     JSON form at all, so `canonicalJson` throws — and an untyped
     throw carrying a value path is exactly the leak `errors.ts`
     exists to prevent. Refusing here keeps `canonicalJson` total
     for everything that gets past this walk.

   **The walk is iterative from the start.** T010 shipped a
   recursive one whose cycle detection was correct and complete and
   which still died with `RangeError` at 20 000 deep — a depth a
   120 KB request body reaches. An explicit stack has no such
   ceiling, and the cycle detection is path-scoped rather than
   global: a value reachable twice by different paths is shared
   substructure, which is legal, while a value reachable from
   inside itself is a cycle, which is not.
   ============================================================ */

const HIGH_SURROGATE_FIRST = 0xd800;
const HIGH_SURROGATE_LAST = 0xdbff;
const LOW_SURROGATE_FIRST = 0xdc00;
const LOW_SURROGATE_LAST = 0xdfff;

/**
 * True when `value` holds a surrogate code unit that is not part of a valid pair.
 *
 * Scans code units rather than code points on purpose: `for...of` iterates code points and
 * silently yields U+FFFD for a lone surrogate, which would make the defect invisible to the
 * check meant to catch it.
 */
export function hasUnpairedSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const unit = value.charCodeAt(i);
    if (unit >= HIGH_SURROGATE_FIRST && unit <= HIGH_SURROGATE_LAST) {
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : -1;
      if (next < LOW_SURROGATE_FIRST || next > LOW_SURROGATE_LAST) return true;
      i += 1; // a valid pair; step over the low half
    } else if (unit >= LOW_SURROGATE_FIRST && unit <= LOW_SURROGATE_LAST) {
      return true; // a low half with no high half before it
    }
  }
  return false;
}

/** What is wrong, and where — the path is the caller's own field names, never a statement. */
export interface Unrepresentable {
  path: string;
  reason: "unpaired-surrogate" | "non-finite-number" | "circular-reference";
}

type Step =
  | { kind: "visit"; value: unknown; path: string }
  | { kind: "leave"; node: object };

function joinPath(path: string, key: string): string {
  return path === "" ? key : `${path}.${key}`;
}

/**
 * Walk `root` and return the first thing that cannot be stored, or `undefined`.
 *
 * "First" is deterministic: object keys are walked in sorted order, so the same input always
 * names the same offender however the object was built. Property *keys* are checked as well
 * as values — a key is a string that round-trips through `jsonb` exactly as a value does.
 */
export function findUnrepresentable(root: unknown): Unrepresentable | undefined {
  /**
   * Nodes already walked to completion or in progress. Without it the walk is O(2^n) over a
   * shared graph — a term list where every entry points at the same substructure re-walks it
   * once per path that reaches it, measured at 370-488 ms for n=20 and unbounded beyond.
   *
   * It does not weaken the cycle rule, because skipping and rejecting are different answers:
   * a node reached again by a *different* path was already checked and is clean, so skipping
   * it is the same verdict arrived at faster. Only `onPath` rejects, and it still holds only
   * the nodes between the root and the cursor.
   */
  const seen = new Set<object>();
  const onPath = new Set<object>();
  const stack: Step[] = [{ kind: "visit", value: root, path: "" }];

  while (stack.length > 0) {
    const step = stack.pop() as Step;

    if (step.kind === "leave") {
      onPath.delete(step.node);
      continue;
    }

    const { value, path } = step;

    if (typeof value === "string") {
      if (hasUnpairedSurrogate(value)) {
        return { path: path === "" ? "(root)" : path, reason: "unpaired-surrogate" };
      }
      continue;
    }

    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        return { path: path === "" ? "(root)" : path, reason: "non-finite-number" };
      }
      continue;
    }

    if (value === null || typeof value !== "object") continue;

    const node = value as object;
    // Order matters: a node between the root and the cursor is a cycle, and a node reached
    // again from anywhere else is merely shared. Checking `seen` first would report a cycle
    // as clean.
    if (onPath.has(node)) {
      return { path: path === "" ? "(root)" : path, reason: "circular-reference" };
    }
    if (seen.has(node)) continue;

    seen.add(node);
    onPath.add(node);
    // Pushed before the children so it pops *after* all of them: the node leaves the current
    // path only once its whole subtree is walked, which is what makes the guard path-scoped
    // rather than global.
    stack.push({ kind: "leave", node });

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i -= 1) {
        stack.push({ kind: "visit", value: node[i], path: `${path}[${i}]` });
      }
    } else {
      const record = node as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      for (let i = keys.length - 1; i >= 0; i -= 1) {
        const key = keys[i];
        if (hasUnpairedSurrogate(key)) {
          return { path: joinPath(path, key), reason: "unpaired-surrogate" };
        }
        stack.push({ kind: "visit", value: record[key], path: joinPath(path, key) });
      }
    }
  }

  return undefined;
}
