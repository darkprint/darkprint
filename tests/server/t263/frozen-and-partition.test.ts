/* ============================================================
   T263 — the two boundary guards, neither of which is a criterion.

   ── D-263-05, and why a digest ──
   `lib/server/publish/publish.ts:48` imports `bundleProgress` from
   `@/components/upload/progress`, and `publish.ts:163-176` consumes
   `progress.state`, `placed` and `total` directly. So a **merged
   and verified** module's AC1/AC2 distinction is decided by a file
   that sat inside T263's `Owns`. The rule "do not weaken, skip or
   rewrite a named test" had no enforcement there: the implementer
   owns its own regression tests and the blind author may not read
   them. D-263-05 carved `progress.ts` and `progress.test.ts` out —
   read-only — and this is the only cell in the tree that says so.

   A content digest rather than a size or an mtime. `sha256` is
   stable across processes where a hashed object identity is not,
   and "equal size" has passed here for a different file before.
   **A red is the intended signal even when the change is
   legitimate**: the ruling says a change here "is a T100 change and
   comes back to me", so this cell's job is to make it arrive, not
   to judge it.

   ── D-263-08, and this one is a GUARD rather than a measurement ──
   The Published signatures line says T263 consumes
   `@/lib/server/engine` and `@/lib/server/publish`. It cannot:
   `publish.ts:49` reaches `pg`/drizzle through `@/lib/db`, and the
   publish control is a client component. **The seams are HTTP.**
   The cell below measures 0 on the shipped tree and 0 on a correct
   implementation, so it reds only on the specific defect — that is
   said here rather than left for a reader to infer from a green.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { FROZEN, occurrences, premise, routeFiles, sha256Of } from "./source";

const files = routeFiles();

describe("D-263-05 — the frozen pair", () => {
  for (const [path, digest] of Object.entries(FROZEN)) {
    it(`${path} is unchanged`, () => {
      expect(
        sha256Of(path),
        `D-263-05: ${path} is carved out of T263's \`Owns\` and is read-only. ` +
          "`lib/server/publish/publish.ts:48` imports `bundleProgress` from it, so a change " +
          "here is a T100 change and belongs to the orchestrator — including a change that " +
          "is correct.",
      ).toBe(digest);
    });
  }
});

describe("D-263-08 — the seam is HTTP, not a barrel", () => {
  it("no file on the route imports a server module", () => {
    premise(files);
    const offenders = files
      .filter((f) => occurrences(f.code, /from\s+["']@\/lib\/server\//) > 0)
      .map((f) => f.path);
    expect(
      offenders,
      `D-263-08: ${offenders.join(", ")} imports \`@/lib/server/**\`. The publish control is ` +
        "a client component and `lib/server/publish` reaches `pg` through `@/lib/db`, so the " +
        "seam is `POST /api/bundles`, not the barrel the Published signatures line names.",
    ).toEqual([]);
  });
});
