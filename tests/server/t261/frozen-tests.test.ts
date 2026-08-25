/* ============================================================
   T261 AC5 and D-261-07(9) — the merged tests that must survive
   the cutover, held by their bytes.

   "Passes unchanged" is the strongest form a cutover criterion
   takes and it has no enforcement unless somebody asserts it.
   D-261-07(9) assigns that assertion to the blind author for a
   reason worth restating at the top of the file it produced:
   ALL EIGHT of these files sit INSIDE the implementer's `Owns`
   (`components/blueprint/**`, `components/bundle/**`,
   `components/panes/**`), and two of them — `severity-word` and
   `archive-labels` — are on the section's own named
   must-pass-unchanged list. A guard a task owns is not a guard on
   that task. So the guard lives here, on the other branch.

   ── why a digest and not a re-run ──
   Running these files here would prove they PASS, which is not the
   criterion. A rewritten test that passes is precisely the failure
   the section forbids, and it passes. Only content answers
   "unchanged".

   ── why a GIT BLOB SHA ──
   A blob sha cannot move. `tests/error-hygiene.test.ts:113` takes
   its domain from a REF (`git ls-tree -d backend lib/server/`) and
   a ref is a mutable global dereferenced at run time, so a merge
   moves what that guard compares against. A blob is also checkable
   by hand, which a sha256 of a working copy is not:

       git cat-file -p <blob>
       git rev-parse HEAD:<path>

   Every blob below was taken from `git rev-parse HEAD:<path>` on
   this branch at `051bc56` and cross-checked element-wise.

   ── one of these was handed to me wrong, and that is the reason
      the cross-check is written down rather than assumed ──
   `components/panes/build.test.ts` reached me as `12d14ca`.
   Measured: `git cat-file -t 12d14ca` -> "Not a valid object
   name"; the file's real blob is `12d14cb…`, one character along.
   A pin transcribed one character off reds forever and reds for
   the WRONG REASON — it reports a byte change that never happened,
   on a file nobody touched. The seven others matched. This is why
   `the instrument itself still discriminates` below checks the
   hasher against a KNOWN pair rather than against a shape.

   ── what a red here does NOT mean ──
   A red says the bytes moved. It does not say who moved them, and
   under D-261-05 SEVERAL of these files carry a GRANTED
   path-constant repoint in the cutover's own commit. So a red is
   the beginning of an attribution, not a verdict. The repair is:
   read the diff, decide whether it is the granted repoint or an
   assertion being weakened, and re-pin DELIBERATELY with the cause
   named in the comment — the pattern T260's merge and D-263-04
   both exercised. Updating a pin to match is the REMOVAL of this
   assertion, never the satisfaction of it.
   ============================================================ */

import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

import { sources } from "./contract";

interface Frozen {
  readonly path: string;
  readonly blob: string;
  /** What is lost if these bytes move unnoticed. */
  readonly why: string;
  /** Whether D-261-05 grants this file a repoint, so a red can be attributed before it is judged. */
  readonly granted: string;
}

const FROZEN: readonly Frozen[] = [
  {
    path: "components/panes/archive-labels.test.ts",
    blob: "7d66eabdb801ab0c58969fe6e940e26e8066a6cb" /* RE-PINNED DELIBERATELY at the T261 merge, cause named as the pin's own message
      demands: D-261-05's granted `PAGE_FILE` repoint. Diff attributed before re-pinning —
      3+/2-, the constant, its new D-261-05 citation comment, and one prose line naming the
      moved path. No assertion touched. */,
    why:
      "NAMED by AC5. It is the file whose module-scope `sourceFile(PAGE_FILE)` read of " +
      "`app/blueprints/[slug]/page.tsx` deletes all 878 of its lines from the run on ENOENT " +
      "rather than redding one cell — the measurement D-261-05 cites as its own evidence.",
    granted: "YES — `PAGE_FILE` repoint (D-261-05). A diff touching ONLY that constant is the grant.",
  },
  {
    path: "components/blueprint/severity-word.test.ts",
    blob: "94e57ccf317418e096b7d3f81bbabf20df61974b" /* RE-PINNED DELIBERATELY, and this one needed a RULING first. The diff is 1+/1-: a
      single docblock line naming the moved page path. `granted` below said NO on the
      measured ground that this file reads no page file — true, and D-261-05's enumeration
      listed the files that READ a moved path and missed the one that merely NAMES it in
      prose. I refused to re-pin a named must-pass-unchanged test on my own reading; that
      refusal is why D-261-15 exists, and it admits this file to the grant. */,
    why:
      "NAMED by AC5. It is also the only instrument holding the PROP SHAPES of `BundlePanel` " +
      "and `Explainability` against the cutover (see `ac5-prop-shapes.test.ts`), and it holds " +
      "`allBlueprints().length === 9` — so it pins the archive helper staying on `lib/content`.",
    granted: "NO. It reads no page file; measured. Any diff here is the named test changing.",
  },
  {
    path: "components/blueprint/download-name.test.ts",
    blob: "86234a5351772a263b1db94d00387880e6213ce1" /* RE-PINNED DELIBERATELY: D-261-11's ruled rewrite off page-invocation onto the
      component-with-props idiom, 89+/37-. The largest diff of the eight and the most
      clearly granted — a page whose body opens a database cannot be invoked directly,
      whatever its segment export says. */,
    why:
      "`import Page from \"@/app/blueprints/[slug]/page\"` is a RESOLUTION-TIME binding: when " +
      "the route moves this breaks `typecheck` and `build`, not merely this suite. It is the " +
      "one file in the eight whose failure is not a test failure.",
    granted: "YES — the import path (D-261-05).",
  },
  {
    path: "components/blueprint/EvidenceLayers.test.tsx",
    blob: "bd9f95725d765ae7502a42973d3a53d86c48034d",
    why:
      "The provenance-aware evidence layers the scorecard sits beside. Inside `Owns` and " +
      "deletable by the task it constrains.",
    granted: "NO.",
  },
  {
    path: "components/bundle/files.test.ts",
    blob: "9e2d95a32c4f9c73df994286af7f8683a77b2c95",
    why:
      "The folder a bundle page draws. Its header names `/u/<owner>/<slug>` — the route " +
      "D-261-01 turns into a 308 — so it is the file most likely to be quietly re-scoped.",
    granted: "NO.",
  },
  {
    path: "components/panes/build.test.ts",
    blob: "12d14cbaab7fc7ef6e833bd1a70e1a1cd5fb1790",
    why:
      "The pane model the graph column is assembled through. See the header: this is the pin " +
      "that arrived one character wrong, and `12d14ca` is not a valid object at all.",
    granted: "NO.",
  },
  {
    path: "components/panes/dot-breakdown.test.ts",
    blob: "6839677a290101851b1eecbdd74d65d97b8ba598",
    why: "The DOT listing's own decomposition, mounted by the page the migration moves.",
    granted: "NO.",
  },
  {
    path: "components/panes/model.test.ts",
    blob: "138613ee8e8531b57a28dd57b1ac72b6896e1a01",
    why: "The synchronised-panes model. Same tree, same deletability.",
    granted: "NO.",
  },
];

describe("AC5 / D-261-07(9): the merged tests inside the implementer's Owns are byte-identical", () => {
  it.each(FROZEN)("$path", ({ path, blob, why, granted }) => {
    /* `sources()` first, so a DELETED file reds as a PartitionError naming the path rather
       than as a digest mismatch against an empty read. The two have different repairs, and
       deleting a must-pass-unchanged test is much the more serious of them. */
    const [source] = sources([path], 1);

    const actual = execFileSync("git", ["hash-object", source.path], {
      encoding: "utf8",
      cwd: process.cwd(),
    }).trim();

    expect(
      actual,
      `${path} has changed.\n\n` +
        `${why}\n\n` +
        `Granted a repoint by D-261-05? ${granted}\n\n` +
        `Pinned at blob ${blob}, taken on \`test/t261-detail\` at \`051bc56\` with ` +
        `\`git rev-parse HEAD:${path}\`. Read the old bytes with \`git cat-file -p ${blob}\` ` +
        `and diff them before doing anything else.\n\n` +
        `ATTRIBUTE BEFORE JUDGING. If the diff is exactly the granted repoint, re-pin here ` +
        `deliberately with the cause named — that path is sanctioned and D-261-07(5) walks it ` +
        `for honesty.test.ts. If it is anything else, it is a merged test inside the cutover's ` +
        `own Owns being edited to make the cutover pass, which the section forbids in as many ` +
        `words. Updating the pin to match is the removal of this assertion, not its satisfaction.`,
    ).toBe(blob);
  });

  /*
   * The premise for the eight cells above, and it fails outside every one of them.
   *
   * `git hash-object` is the instrument; if it is unavailable, or answers something that is
   * not a sha, or answers a CONSTANT, all eight cells red with a message about a byte change
   * that never happened. Checked against a KNOWN PAIR rather than against a shape: a hasher
   * returning a constant satisfies `/^[0-9a-f]{40}$/` and makes all eight pins agree with
   * each other forever, which is the vacuous-green this file exists to refuse.
   */
  it("the instrument itself still discriminates", () => {
    const [a] = sources(["components/blueprint/severity-word.test.ts"], 1);
    const [b] = sources(["components/panes/model.test.ts"], 1);
    const hash = (path: string) =>
      execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

    expect(hash(a.path)).toMatch(/^[0-9a-f]{40}$/);
    expect(
      hash(a.path),
      "`git hash-object` gave two different files the same sha, so every pin above is vacuous",
    ).not.toBe(hash(b.path));
  });

  /*
   * And that the list has not shrunk.
   *
   * D-261-07(9) names EIGHT. A pin list is the one kind of guard that goes vacuous by
   * DELETION rather than by weakening — removing a row reds nothing and reports nothing,
   * and the file still passes with a green count that looks identical.
   */
  it("still holds all eight", () => {
    expect(FROZEN).toHaveLength(8);
    expect(new Set(FROZEN.map((f) => f.path)).size, "a duplicated path hides a dropped one").toBe(8);
  });
});
