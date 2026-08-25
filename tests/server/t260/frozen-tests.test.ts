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
import { existsSync } from "node:fs";
import { join } from "node:path";

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
    blob: "39cd161d64b8250178ffd309fded181cde10f58e" /* re-pinned DELIBERATELY at T280
      (owner-instructed wiring wave, 2026-08-25): the seeded-figure rule gained a named
      LIVE_PRINTERS exemption for the two profile surfaces whose downloads/stars sums went
      live off `getSignalsMany`/`getProfile` — demanding "seeded" of a real count is the
      false claim the rule guards against, mirrored. The rule was falsified after the
      amendment: a probe file printing `.votes` with no marker still reds by name. The pin
      fired exactly as designed; this is the deliberate re-pin its message demands. */,
    owner: "nobody in this wave; amended by T280",
    why:
      "AC3 and D-260-02 name it. `:259` finds `components/gallery/GalleryBrowser.tsx` by EXACT PATH and asserts it lacks `value: \"downloads\"` and `value: \"votes\"`, carrying `expect(gallery).toBeDefined()` so a rename or a move REDS LOUDLY rather than passing vacuously. It is the only instrument in the repository holding D-31/D-57's popularity prohibition.",
  },
  {
    path: "components/site/honesty.test.ts",
    blob: "d64124a24e3c9951a93e805b9c2e4dc450aa7d3e" /* re-pinned DELIBERATELY twice. At
      T260's merge: T263's 528806a (D-263-12) moved the file through the backend merge —
      the T260 implementer never touched it. At T280 (owner-instructed wiring wave,
      2026-08-25, D-261-07(5)'s granted path): five ledger rows moved with the copy they
      pin — /skill's publishing panel and metadata (three of four refusals went live, the
      pin keeps the surviving one), /mcp's description and lead (the server went live, the
      npm-unpublished warning is the claim that survives), and the /mcp status-column row
      came OUT with its removal logged inline where it stood. The pin fired exactly as
      designed both times; updating it here, with the cause named, is the deliberate
      re-pin its own message demands rather than the silent one it forbids. */,
    owner: "nobody in this wave; amended by T263 under D-263-04, and by T280",
    why:
      "AC3 names it. It pins its sentences VERBATIM, so changing one is changing this file in the same commit with the new sentence pinned — which is the mechanism D-78's one-direction rule relies on. Note that none of its pinned surfaces is a T260 route (D-260-09), so this pin holds the file, not this task's honesty; `ac4-markers.test.ts` is the instrument for that.",
  },
  {
    path: "components/ontology/canonical-route.test.ts",
    blob: "46dd27055fbd604b809cd3fe15fc110a584458e4",
    owner: "INSIDE T260's `Owns`",
    why:
      "D-260-10 added it. `next.config.ts`'s own comment cites it by name as the file that \"records the reversal and holds both routes in place\" for `/ontology` versus `/spec/ontology` — so deleting it silently unpins a redirect pair that `nav.test.ts` checks from the other end.",
  },
];

/**
 * Retired, deliberately, with the cause named — the counterpart of a deliberate re-pin.
 *
 * `components/ontology/weight-provenance.test.ts` was pinned here at blob `5e857b6` until
 * the T261 cutover. It rendered `/ontology/[...term]` while that page read `content/`
 * synchronously; once the page read the registry the file did not BREAK, it acquired an
 * undeclared infrastructure dependency — measured 9/9 green with `DATABASE_URL` set and
 * **8/9 red without one**. A test that passes only where a database happens to be reachable
 * is worse than one that fails, because it is green on the machine of whoever checks.
 *
 * D-261-13 ruled it retires AT THE T261 MERGE, in the same commit its coverage lands green
 * elsewhere, and D-261-11(3) put the pen for this pin in the blind author's hand. The
 * coverage relocated whole to `tests/server/t261/term-provenance.scratch.test.ts`, which
 * seeds through `runImport` — the production path — and measures `lupo/pii-handling`, the
 * one marker the archive prices in its own vocabulary, arriving at `0.50`. Its middle-rung
 * cell reds by name if a core-only registry ever loses that term, which is the condition
 * the retirement was approved against.
 *
 * This is not a pin becoming absent. It is a pin becoming a different assertion: the file
 * is GONE ON PURPOSE, and a reappearance is a claim somebody has to make out loud.
 */
const RETIRED: ReadonlyArray<{ path: string; why: string }> = [
  {
    path: "components/ontology/weight-provenance.test.ts",
    why:
      "retired under D-261-13; coverage relocated to tests/server/t261/term-provenance.scratch.test.ts",
  },
];

describe("D-261-13: what was retired stays retired", () => {
  it.each(RETIRED)("$path is gone, deliberately", ({ path, why }) => {
    expect(
      existsSync(join(process.cwd(), path)),
      `${path} is back.\n\n${why}.\n\n` +
        `If this is a deliberate restoration, it needs a ruling and a pin of its own — the ` +
        `file was removed because it had become green-only-where-a-database-is, not because ` +
        `its claim was wrong. Restoring the file without restoring that property is how the ` +
        `undeclared dependency comes back.`,
    ).toBe(false);
  });
});

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
