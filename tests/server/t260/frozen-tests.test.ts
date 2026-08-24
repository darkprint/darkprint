/* ============================================================
   T260 AC3 and D-260-10 — the tests that must pass UNCHANGED

   "Passes unchanged" is the strongest form a cutover criterion
   takes and it has no enforcement unless somebody asserts it. The
   section's own rule binds the implementer — do not weaken, skip or
   rewrite a named test to make a cutover pass — and two of the four
   files below sit INSIDE T260's `Owns`, so the task can satisfy
   itself by editing its own guard.

   ── why a digest and not a re-run ──
   Running these files here would prove they PASS, which is not the
   criterion. A rewritten test that passes is precisely the failure
   D-260-10 exists to prevent, and it passes. Only content answers
   "unchanged".

   ── why a GIT BLOB SHA and not a path, a ref or a sha256 ──
   `tests/error-hygiene.test.ts:113` takes its domain from a ref —
   `git ls-tree -d backend lib/server/` — and a ref is a mutable
   global dereferenced at run time, so a merge can move what the
   guard compares against. A blob sha cannot move. It is also
   directly checkable by hand, which a sha256 of the working copy is
   not:

       git ls-tree 3daa325 <path>
       git cat-file -p <sha>

   Both computed and cross-checked at `3daa325`, and the two agree
   element-wise:

       git hash-object <path>   ==   git ls-tree 3daa325 <path>

   ── what a red here does NOT mean ──
   A red says the bytes moved. It does not say who moved them. Two
   of these files belong to nobody in this wave (`honesty.test.ts`
   is amended by T263 under D-263-04) so a red after a merge can be
   another task's legitimate change arriving. The message says so,
   and the repair is to attribute it before touching the pin —
   updating a pin to match is the REMOVAL of this assertion, never
   the satisfaction of it.
   ============================================================ */

import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { sources } from "./contract";

interface Frozen {
  readonly path: string;
  readonly blob: string;
  readonly why: string;
  readonly owner: string;
}

const FROZEN: readonly Frozen[] = [
  {
    path: "components/ui/autonomy-surfaces.test.ts",
    blob: "922b8265db5929d6bd7c1098c6b53c33e10d3592",
    owner: "nobody in this wave",
    why:
      "AC3 and D-260-02 name it. `:259` finds `components/gallery/GalleryBrowser.tsx` by EXACT PATH and asserts it lacks `value: \"downloads\"` and `value: \"votes\"`, carrying `expect(gallery).toBeDefined()` so a rename or a move REDS LOUDLY rather than passing vacuously. It is the only instrument in the repository holding D-31/D-57's popularity prohibition.",
  },
  {
    path: "components/site/honesty.test.ts",
    blob: "a7e8b77bbf2c4cd42e82f2087bc2d0ccd6568315",
    owner: "nobody in this wave; amended by T263 under D-263-04",
    why:
      "AC3 names it. It pins its sentences VERBATIM, so changing one is changing this file in the same commit with the new sentence pinned — which is the mechanism D-78's one-direction rule relies on. Note that none of its pinned surfaces is a T260 route (D-260-09), so this pin holds the file, not this task's honesty; `ac4-markers.test.ts` is the instrument for that.",
  },
  {
    path: "components/ontology/weight-provenance.test.ts",
    blob: "5e857b65af478499f550c5a3b5c3727dae8e50ae",
    owner: "INSIDE T260's `Owns`",
    why:
      "D-260-10 added it to the named list. It sits inside `components/ontology/**`, so before that ruling the only existing guard over D-260-01's frozen pricing surface was deletable by the task D-260-01 constrains. A guard a task owns is not a guard on that task.",
  },
  {
    path: "components/ontology/canonical-route.test.ts",
    blob: "46dd27055fbd604b809cd3fe15fc110a584458e4",
    owner: "INSIDE T260's `Owns`",
    why:
      "D-260-10 added it. `next.config.ts`'s own comment cites it by name as the file that \"records the reversal and holds both routes in place\" for `/ontology` versus `/spec/ontology` — so deleting it silently unpins a redirect pair that `nav.test.ts` checks from the other end.",
  },
];

describe("AC3 / D-260-10: the named tests are byte-identical", () => {
  it.each(FROZEN)("$path", ({ path, blob, why, owner }) => {
    /* `sources()` first, so a DELETED file reds as a PartitionError naming the path rather
       than as a digest mismatch against an empty read. The two have different repairs, and
       deleting a must-pass-unchanged test is the more serious of the two. */
    const [source] = sources([path], 1);

    const actual = execFileSync("git", ["hash-object", source.path], {
      encoding: "utf8",
      cwd: process.cwd(),
    }).trim();

    expect(
      actual,
      `${path} has changed.\n\n` +
        `Owner: ${owner}.\n${why}\n\n` +
        `Pinned at blob ${blob}, taken on \`backend\` at \`3daa325\` and cross-checked with ` +
        `\`git ls-tree 3daa325 ${path}\`. Read the old bytes with \`git cat-file -p ${blob}\` ` +
        `and diff them before doing anything else.\n\n` +
        `If the change is T260's, it is a named must-pass-unchanged test being rewritten to ` +
        `make a cutover pass, which the section forbids in as many words. If it arrived from ` +
        `another task at a merge, attribute it and re-pin deliberately. Updating the pin to ` +
        `match is the removal of this assertion, not the satisfaction of it.`,
    ).toBe(blob);
  });

  /*
   * The premise for the four cells above, and it fails outside every one of them.
   *
   * `git hash-object` is the instrument; if it is unavailable or answers something that is
   * not a sha, all four cells fail with a message about a byte change that did not happen.
   * Checked against a KNOWN blob rather than against a shape: a `hash-object` that returned
   * a constant would satisfy `/^[0-9a-f]{40}$/` and make all four pins agree with each other
   * forever.
   */
  it("the instrument itself still discriminates", () => {
    const [a] = sources(["components/site/honesty.test.ts"], 1);
    const [b] = sources(["components/ontology/canonical-route.test.ts"], 1);
    const hash = (path: string) =>
      execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

    expect(hash(a.path)).toMatch(/^[0-9a-f]{40}$/);
    expect(
      hash(a.path),
      "`git hash-object` gave two different files the same sha, so every pin above is vacuous",
    ).not.toBe(hash(b.path));
  });
});
