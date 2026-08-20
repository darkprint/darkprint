/* ============================================================
   `target_kind`'s declaration order is alphabetical, and
   D-140-08's published order silently depends on it.

   ── the coincidence, and why it is not a convention ──
   Postgres orders an enum column by DECLARATION order, not
   alphabetically. `target_kind` is declared
   `["blueprint", "card", "term"]`, which happens to be both — so
   `ORDER BY target_kind ASC` in SQL and a JavaScript string sort
   over `SaveRecord.targetKind` agree today.

   They agree by accident. Three of the five `pgEnum`s in
   `lib/db/schema.ts` already declare out of alphabetical order —
   `visibility` is `[public, private]`, `target_actor_kind` is
   `[star, note_vote]`, `actor_kind` is `[owner, operator,
   system]`. **The repository's habit is semantic order**, and
   `target_kind` is one of the two exceptions. So a fourth member
   added by somebody following the house style is the likely case,
   not the exotic one.

   ── what breaks, and why nothing else would notice ──
   D-140-08 publishes `listSaves` as `saved_at DESC, target_kind
   ASC, ref_id ASC`, and a blind author computing the expected
   order from `SaveRecord` alone has nothing but the strings, so
   it will sort them lexicographically — and be right for a reason
   it is not relying on. The day the two readings diverge, the
   implementation's SQL and the contract's published order mean
   different things, every cell that computes an expected order
   flips, and the diff that caused it is one word in a DDL array.

   Reported by T140's implementer while building D-140-08, as an
   agreement it had noticed and declined to spend: **flagged
   because a blind author will assume alphabetical and will be
   right for the wrong reason.**

   ── scope ──
   Only `target_kind`, and only because a published contract reads
   its order. The other four are free to declare semantically and
   three of them do; asserting alphabetical order across all five
   would be inventing a convention this repository does not have
   and does not need.

   Fails CLOSED: the enum not being found at all is an error, not
   a pass over an empty match.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Read from the working tree, not from `backend`.
 *
 * The other schema-reading guards in `tests/` take the shipped tree so an implementer is never red
 * for unmerged work. This one is the opposite case on purpose: the failure it catches is a member
 * being ADDED, and the moment worth catching it is while the person adding it is still looking at
 * the diff — not one merge later, when the flipped expectations land on somebody else.
 */
function declaredMembers(enumName: string): readonly string[] | undefined {
  const source = execFileSync("git", ["show", ":lib/db/schema.ts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  const match = new RegExp(`pgEnum\\(\\s*"${enumName}"\\s*,\\s*\\[([^\\]]*)\\]`).exec(source);
  if (match === null) return undefined;
  return [...match[1]!.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
}

describe("D-140-08's published order does not depend on an accident", () => {
  it("target_kind is declared in alphabetical order", () => {
    const members = declaredMembers("target_kind");

    expect(
      members,
      "`pgEnum(\"target_kind\", [...])` was not found in lib/db/schema.ts. Either the enum was " +
        "renamed or the declaration was reshaped — both make the assertion below vacuous, and a " +
        "vacuous version of this check passes over exactly the edit it exists to catch.",
    ).toBeDefined();

    expect(
      [...members!],
      "`target_kind`'s declaration order is no longer alphabetical, and D-140-08's published " +
        "order for `listSaves` depends on those being the same thing. Postgres sorts an enum " +
        "column by DECLARATION order; a caller sorting `SaveRecord.targetKind` has only the " +
        "strings and will sort them lexicographically. While the two coincide nobody notices. " +
        "Now they do not: `ORDER BY target_kind ASC` and the published contract mean different " +
        "sequences, and every cell that computes an expected order from the records flips. " +
        "Either declare the new member alphabetically, or amend D-140-08 and make the store sort " +
        "on something a caller can compute — a cast to text, or an explicit CASE. Note that three " +
        "of the five enums here already declare semantically, so following the house style is how " +
        "this breaks.",
    ).toEqual([...members!].sort());
  });
});
