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

   ── whose dependency this is, and it CHANGED under this file ──
   Written when `lib/server/saves/store.ts` sorted on the enum
   column directly, so T140's published order depended on the
   coincidence and this guard was the only thing holding it up.
   **D-140-10 moved that dependency out**: the store now sorts
   `target_kind::text`, which makes D-140-09's lexicographic
   reading true by construction, and T140 no longer relies on any
   property of the declaration.

   So this file's dependent is no longer T140. It is the NEXT
   consumer that sorts this column in SQL without a cast — and the
   reason to expect one is that sorting an enum column directly is
   the obvious thing to write, is what T140 wrote, and reads
   exactly as safe as the correct version. This guard makes the
   divergence visible at the moment of the DDL edit rather than in
   whatever suite flips afterwards.

   **If a year passes with no such consumer, delete this file
   rather than maintaining it.** A guard whose dependent has moved
   away and whose replacement never arrived is a red with no
   consequence, and a red with no consequence teaches people to
   ignore reds.

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
      "`target_kind`'s declaration order is no longer alphabetical. Postgres sorts an enum column " +
        "by DECLARATION order; anything sorting `SaveRecord.targetKind` as a string sorts " +
        "lexicographically. While the two coincide nobody notices, and they no longer coincide. " +
        "T140 is NOT the caller at risk — D-140-10 made it sort `target_kind::text`, so its " +
        "published order is lexicographic by construction. The caller at risk is any LATER one " +
        "that sorts this column in SQL without a cast, which is the obvious thing to write and is " +
        "what T140 wrote first. Either declare the new member alphabetically, or make every SQL " +
        "sort on this column cast to text. Note that three of the five enums here already declare " +
        "semantically, so following the house style is how this breaks.",
    ).toEqual([...members!].sort());
  });
});
