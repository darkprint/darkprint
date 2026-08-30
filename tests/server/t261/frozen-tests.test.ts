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
    blob: "3d26e19b2d103182377e046bf5e6233557832af3" /* RE-PINNED DELIBERATELY a second time, at the withdrawal of the manifest's
      `ontologyVersion`. The diff is 0+/1-: the `ontologyVersion` prop leaves the
      `createElement(BundlePanel, …)` call, because `BundlePanel` no longer declares it. This
      file is one of the two instruments holding that component's PROP SHAPES, so the deletion
      is exactly what it is for — and it is a deletion the compiler forces, not an assertion
      being weakened: the line it removes passed `bp.analysis.autonomy.ontologyVersion` to
      BOTH props, so it was already asserting one value under two names. The surviving
      `scoredOntologyVersion` is the one that was ever a fact about the score.

      The FIRST re-pin needed a ruling and its reasoning stands: the diff then was 1+/1-, a
      single docblock line naming a moved page path, `granted` said NO on the measured ground
      that this file reads no page file, and D-261-05's enumeration had missed a file that
      merely NAMES a moved path in prose. Refusing to re-pin a named must-pass-unchanged test
      on one reader's judgement is why D-261-15 exists. */,
    why:
      "NAMED by AC5. It is also the only instrument holding the PROP SHAPES of `BundlePanel` " +
      "and `Explainability` against the cutover (see `ac5-prop-shapes.test.ts`), and it holds " +
      "`allBlueprints().length === 9` — so it pins the archive helper staying on `lib/content`.",
    granted: "NO. It reads no page file; measured. Any diff here is the named test changing.",
  },
  {
    path: "components/blueprint/download-name.test.ts",
    blob: "7227156634759705c85eaf3bd383115f00648ee8" /* RE-PINNED DELIBERATELY a THIRD time,
      at the owner's authorisation to unfreeze this file for one purpose: removing its
      import of `FACTORY_DOT` from `lib/content/bundle-export`, which was one of the two
      pins keeping a dead constant alive there. Attributed before the pin moved.

      The diff is 1 import member removed, one local `const RUNNABLE_DOT = "factory.dot"`
      added with the reason in place, and the two occurrences inside the assertion renamed
      to it. **The assertion itself is byte-for-byte the same claim**: the download anchor
      must not contain `factory.dot`. What changed is where the string comes from — a
      literal, because the constant it used to come from no longer exists and there is
      nothing left in the product that produces that name.

      What was NOT done: no assertion was removed, weakened or re-pointed at a different
      subject, and the pin was not moved to make an unrelated red go away.

      The SECOND re-pin, and its own attribution:
      First at D-261-11's ruled rewrite off page-invocation onto the component-with-props
      idiom, 89+/37-. Then at the topology rename (owner-instructed, 2026-08-25): the
      registry's stored file became `topology.dot`, and the suite's pinned label moved
      WITH the download attribute — holding the label at the old word while the attribute
      tracked the renamed constant was the exact label/filename disagreement the suite
      refuses. The label now derives from `TOPOLOGY_DOT` itself, so the two cannot part
      again without this suite seeing it. */,
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
    blob: "84beb369b1a8593047d14b0bb952497744920dd9" /* RE-PINNED DELIBERATELY, at the owner's
      authorisation to unfreeze this file for one purpose: removing its imports of
      `FACTORY_DOT` and `BUNDLE_AGENTS`, which were the pins keeping the first of those two
      constants alive in `lib/content/bundle-export`. Attributed before the pin moved.

      Two import members removed, and both names removed from the `ALLOWED` set with the
      reason written in place. `ALLOWED` is an allow-list, so this is a STRENGTHENING and
      not a weakening: `exportBundle` stopped writing either file at the owner's 2026-08-25
      instruction, and until now a seeded listing could still advertise `factory.dot` or
      `AGENTS.md` and pass — the exact "a listing that names files the download does not
      contain" failure the banner at the top of that file describes. Both names are now
      strays. Measured before the edit: no listing in `lib/data/bundles.ts` names either, so
      nothing was made to pass by the removal and nothing red by it.

      `BUNDLE_AGENTS` survives the constant sweep on its own merits and not on this import:
      `components/upload/BundleDropzone.tsx` reads it to name an `AGENTS.md` a reader drops
      from an older download. `FACTORY_DOT` had no such consumer and is deleted. */,
    why:
      "The folder a bundle page draws. Its header names `/u/<owner>/<slug>` — the route " +
      "D-261-01 turns into a 308 — so it is the file most likely to be quietly re-scoped.",
    granted: "NO.",
  },
  {
    path: "components/panes/build.test.ts",
    blob: "d6c7bfe99d22985c9b50417f5cadd8b9e16b6fc5" /* RE-PINNED DELIBERATELY a THIRD time, at
      the withdrawal of `ontology_version`, and attributed the same way the second re-pin was.

      Two edits. (1) `ontology_version: 0.1.0` leaves the `CARD_YAML` fixture, because no card
      document carries that key any more. (2) The line-offset probe changes its SUBJECT rather
      than only its value: it asked `blocks.get("ontology_version")`, and that key is not in
      the document at all now, so an offset for it would be `undefined`. It asks
      `blocks.get("author")` at `{24, 24}` instead — the last top-level key of the document,
      which is the identical question (the final key owns exactly its own line) about the same
      boundary rule. The pane case for `ontology_version` is gone from `build.ts` with the
      field, so no cell is left describing a row that cannot be drawn.

      What was NOT done: the pin was not updated to make a red go away. The probe was
      re-pointed to a key that still exists rather than deleted, and the fixture line was
      removed because the wire key was withdrawn, not because it was inconvenient.

      The SECOND re-pin, and its own attribution:
      at the withdrawal of `requires_human`. This is a HEAVIER diff than the last one and it
      is attributed line by line before the pin moves, because the previous re-pin's claim —
      compiler-forced, no assertion touched — is not available here.

      Three edits. (1) `requires_human: false` leaves the `CARD_YAML` fixture, because no
      card document carries that key any more. (2) `blocks.get("ontology_version")` moves
      from `{26, 26}` to `{25, 25}`: an assertion VALUE changed, and it changed because the
      document above it is one line shorter, not because `cardYamlBlocks` decides anything
      differently. (3) The cell "states both sides of requires_human without weighing one
      against the other" is REPLACED, not deleted quietly: its subject is a field that no
      longer exists, and what stands in its place asserts the pane draws no row for the
      withdrawn key. Doc 2 §1.1's claim that the two answers weigh the same is not lost with
      it — the sentences moved to `FIELD_NOTE.type`, where the answer now is, and
      `/nodes/<id>`'s `type` row carries the same pair.

      What was NOT done: the pin was not updated to make a red go away. The `requires_human`
      row cannot be kept, because keeping it would mean the pane printing a field off a
      document that does not declare it. Suite measured green at 211/211 across
      `components/panes/` after the edit. */,
    why:
      "The pane model the graph column is assembled through. See the header: this is the pin " +
      "that arrived one character wrong, and `12d14ca` is not a valid object at all.",
    granted: "NO. The re-pin above is a compiler-forced literal completion, argued in place.",
  },
  {
    path: "components/panes/dot-breakdown.test.ts",
    blob: "6839677a290101851b1eecbdd74d65d97b8ba598",
    why: "The DOT listing's own decomposition, mounted by the page the migration moves.",
    granted: "NO.",
  },
  {
    path: "components/panes/model.test.ts",
    blob: "26c1bc23da68b3d4939e0333ba3039f6cc17a91a" /* RE-PINNED DELIBERATELY a THIRD time, at
      the withdrawal of `ontology_version`. Two edits, the same pair as last time: the key
      leaves the `BUILDER_YAML` fixture and the typed `NodeCard` literal below it, and the
      `blockOf` probe into the SERVICE block moves from `ontology_version` to `provenance`.
      That block still has three keys, `provenance` asks the identical question, and the cell
      still probes three of the five blocks and still ends on the unknown-key case. There is
      one vocabulary and a card declares no version of it; the version a SCORE was computed
      under is on the score, which is not a card field and has no block here.

      The SECOND re-pin, and its own attribution:
      at the withdrawal of `requires_human`, and attributed the same way. Two edits: the key
      leaves the `BUILDER_YAML` fixture and the typed `NodeCard` literal below it, and one
      `blockOf` probe changes its argument.

      That probe is the part worth naming. The cell asks whether `blockOf` answers with the
      block a key belongs to, and it used `requires_human` to ask about `evaluation`. The
      key is not in `CARD_BLOCKS` any more, so the probe would have asserted `undefined`;
      `risk_markers` is the same block's other key and asks the identical question. The
      cell still probes three of the five blocks and still ends on the unknown-key case.
      Whether a person acts at the node is `type`, in `identity`, which the neighbouring
      block-id cell already covers. */,
    why: "The synchronised-panes model. Same tree, same deletability.",
    granted: "NO. The re-pin above is a compiler-forced literal completion, argued in place.",
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
