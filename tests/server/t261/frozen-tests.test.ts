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
    blob: "3edcbfd3717d83070eb91651c4ff5fefc9b8ce90" /* RE-PINNED DELIBERATELY a FOURTH time,
      2026-09-06, later the same day as the second and the third, and this one REVERSES what
      those two measured rather than correcting them.

      The owner put the node index beside the drawing: "set the panel Jump to a node on the
      right of the panel The graph... where The graph occupies 2/3 of the horizontal space,
      while Jump to a node occupies the rest 1/3." `SynchronisedPanes` draws
      `grid gap-4 lg:grid-cols-3` with the pane at `lg:col-span-2`, so the canvas is two
      thirds of the body plus the gap it spans, above `lg`, and the whole body below.

      THE COST WAS PRICED BEFORE IT WAS TAKEN, and the owner took it knowing the number. The
      canvas goes 1124 -> 735 at the widest width above the grid. A six-column archive drawing
      needs 1086px before its 11px kind row clears 10 CSS px, so `LEGIBLE_AT` collapses from
      seven blueprints to one at every viewport that has room for any: **no six-column drawing
      is legible at any window width on any device now.** `guarded-merge-bot` is back on
      `PANE_MIN_HEIGHT` at 240, which is the floor taking over from the box. Every number in
      this file moved and every one was re-derived rather than scaled.

      TWO FINDINGS THIS PASS THAT NO EARLIER ONE COULD HAVE HAD. The chain has TWO cliffs now,
      not one, and the new one is nearly twice the old: 1023 -> 1024 costs 330px as the grid
      splits, against the rail's 118 at 1280. And the widest canvas on the site is no longer on
      a desktop — 900 draws 824 because it is below `lg` and escapes the column entirely, so
      the drawing is largest on a tablet. `WIDEST` is named for the widest ABOVE the grid for
      that reason and the cap cell says so in place.

      MEASURED, NOT REASONED. Twelve readings off the running page, both sides of both hinges,
      each switch simulated by suppressing it and forcing the width because neither the grid
      nor the rail can be reached by resizing a container; plus one unforced reading at
      clientWidth 2033 giving 735. `canvasWidthAt` then reproduced all twelve to the pixel
      before a single pin moved.

      FALSIFIED BEFORE THIS PIN MOVED, three mutations, each restored from a `cp` copy and
      verified byte-identical with `diff -q`. M1, the page returning to full width by dropping
      `lg:col-span-2` -> 1 red, the class-agreement cell. M2, `GRID_FROM` moved to 1100 with
      the page unchanged -> 2 reds. M3, the gap term dropped out of `graphColumnWidth` -> 10
      reds. **M1's count is the one to read**: the canvas numbers are computed from the
      CONSTANTS and cannot see the page, so a layout change with the constants left alone reds
      only the cell that compares the two. That cell is why the rail went unseen for a day, and
      it is now the whole of this file's grip on the page.

      The previous pin was `ab262dcb257c58bdffd0bb1cfcad1e5da81bb666`, RE-PINNED DELIBERATELY a
      THIRD time,
      on 2026-09-06, LATER THE SAME DAY AS THE SECOND.

      **THIS AMENDMENT CORRECTS THE ONE BELOW. IT DOES NOT EXTEND IT.** The note beginning
      "RE-PINNED DELIBERATELY a SECOND time" is left in place because its account of what was
      done is accurate and its falsification really was run, but SOME OF THE NUMBERS IT
      RECORDS ARE WRONG AND ARE SUPERSEDED BY THIS ONE. Specifically: the canvas list it
      states as "1124/1124/948/824/692/424/314" is wrong in its FIRST entry, "10.4 for the
      six-column drawings" is true only at a width that list mislabels, and the sentence "the
      chain is monotonic" is false. Read this note before acting on that one.

      SAME CAUSE, SAME INSTRUCTION. The underlying change is still the owner's, on 2026-09-06:
      "move on that part the The graph panel (extend full horizontal length as the other
      elements)". Nothing new was asked for. What moved is that the previous pass modelled
      that instruction with a chain that is missing a link, and this pass measured the link.

      WHAT WAS WRONG. The previous pass re-derived the canvas as
      `min(viewport, 1200) - 48 - 28`, treating `.container-page` as the only thing between
      the viewport and the graph. `components/ui/SideRail.tsx` wraps the blueprint page in
      `xl:grid xl:grid-cols-[16rem_minmax(0,1fr)]` — a 256px track, `display: none` below
      1280 and a real column at and above it — and it sits ONE LEVEL OUT from where the
      re-derivation started. It started at `.container-page` and worked DOWN, because down is
      where the deleted body grid had been. Two consequences, both now corrected:

        · `MEASURED_CANVAS[1440]` was pinned at 1124 and the canvas at a 1440px viewport is
          1108. 1124 is first reached at 1456. The previous reading was taken in a real
          browser at a 2044px WINDOW — where the rail stops mattering because
          `.container-page` reaches its own 1200 cap regardless — and written down against
          1440. Every entry from 1200 down was and remains CORRECT, because 1200 is below
          `xl` and pays no rail; the error is confined to the 1440 row and what derives from
          it.
        · The `lg` hinge argument was DELETED as "no longer real", and the chain was declared
          monotonic. The hinge did not disappear. It moved to `xl` and got worse: 1279 draws
          a 1124px canvas and 1280 draws 948, a 176px cliff where `lg`'s was 729 -> 612, and
          the canvas does not recover until 1456. The argument is restored at its new
          breakpoint, in both headers, with the deletion named as an error and the reason for
          it named too.

      WHAT THIS PIN COVERS, beyond undoing those two. 429+/130- against the bytes the second
      pin froze. `WIDTHS` goes from seven to twelve: 1920, 1456, 1440, 1366, 1280 and 1279
      are pinned where the seven-width set had NOTHING between 1200 and 1440. That hole was
      the whole of the rail band, both of its edges reported the same seven legible
      blueprints, and a reader of a green run would have concluded the seven held across it.
      They do not — at 1366, the commonest laptop width there is, ONE of the nine clears the
      10 CSS px floor. `LEGIBLE_AT` now says that per width. `draws its type at the size the
      layout allows` became two cells, at the widest canvas and at the design width, because
      1440 stopped being both. `asks for a different pane height per blueprint` pins both
      sets. `WIDEST` is `[1920, 1456, 1279, 1200]`, which is not an interval, and that is the
      non-monotonic chain visible in a constant.

      TWO ASSERTIONS WERE ADDED. `puts the graph inside the side rail's grid, at the rail's
      own width` reads `RAIL_WIDTH` off `SideRail.tsx`'s own grid template and the `xl`
      breakpoint off its `hidden`/`xl:block` aside, from both ends, so the two new constants
      cannot drift from the page the way the body grid's five did. `steps down once, at the
      rail's own breakpoint, by the rail's own width` holds the hinge as a hinge: exactly one
      downward step in 1001..1920, at 1280, 176px deep, recovering at 1456 and short of the
      cap at every width between.

      FALSIFIED BEFORE THIS PIN MOVED. `framing.ts` and `SideRail.tsx` restored from `cp`
      copies each time, never `git checkout`.
        · Rail term dropped from `bodyWidthAt` (`track = viewport`), which is the chain the
          second pin froze: 8 reds — the canvas cells at 1440/1366/1280, the legible set at
          1366 and 1280, the 1440 type pin, the pane heights, the hinge cell. Note what did
          NOT red, because it is the reason the type pin is held at TWO canvases: the legible
          SET at 1440 stayed green, since 1124 and 1108 yield the same seven blueprints. A
          per-width set alone cannot see a 16px canvas error, and the achieved-number pin can.
          (Counted against the final tree. An earlier draft of this note said 11, which was a
          number carried over from a run of an earlier version of the hinge cell and not
          re-measured — the same class of error as the one this whole amendment corrects.)
        · `RAIL_FROM` 1280 -> 1360: 3 reds. THE FIRST VERSION OF THE HINGE CELL SCORED 0 ON
          THIS and was rewritten before the pin moved. It wrote its own expectation as
          `[`${RAIL_FROM}: ${-depth}`]`, so both sides of the comparison moved with the
          mutation — an expected value bound from the subject cannot falsify the subject. The
          hinge is now pinned at the LITERALS 1280 and 176, which are what `.react-flow` was
          read at, with the constants asserted to agree with them.
        · `RAIL_WIDTH` 256 -> 240: 7 reds, including the `SideRail.tsx` cell, which is the
          leg that catches a constant drifting from the page.
        · `SideRail.tsx`'s track 16rem -> 18rem, the page moving under a correct constant:
          1 red, the `SideRail.tsx` cell, by name and with both numbers.
      Suite measured green at 273/273 across `components/panes` and `components/graph` after
      the restores, `tsc --noEmit` clean, `eslint` clean on both trees.

      THE BROWSER READING, since the previous note's is what went wrong. Dev server,
      `/blueprints/darkprint/incident-commander`. One UNFORCED reading: innerWidth 1288,
      clientWidth 1277, an 11px scrollbar, rail VISIBLE at 256px, `.react-flow` 945 against a
      predicted 945 — and 1124 under the chain the second pin froze. Fifteen forced widths on
      both sides of the hinge agreed to the pixel. The keys are `clientWidth` and the file now
      says so, because the media query that switches the rail matches `innerWidth` — probed,
      the largest matching `min-width` was 1288 exactly — and the two differ by a scrollbar.
      `RAIL_FROM` carries that residual rather than hiding it.

      WHAT WAS NOT DONE: no assertion about accessibility, contrast, label overlap or an
      honesty disclaimer was removed or loosened. The honesty half was STRENGTHENED, not
      traded: `is whole but not legible on a phone` is untouched, and the file's per-width
      legible set now reports the band it was silent about. No number was widened into a
      floor. The second note below is amended and not overwritten.

      The previous pin was `392b7ca37023288f9339bb8d5f36ef49ec32278b`.

      RE-PINNED DELIBERATELY a SECOND time,
      on 2026-09-06, on the owner's instruction to take the blueprint page's graph panel to
      the container's full width: "move on that part the The graph panel (extend full
      horizontal length as the other elements)". This is NOT the D-261-05 repoint `granted`
      below describes — that grant covers a diff touching only `PAGE_FILE` — and it is not
      claimed under it. The authority is the owner's instruction, plus a rule this file wrote
      for itself and carried through the change that made it necessary: "If this ever starts
      failing because everything fits, that is good news and the assertion should be
      tightened, not deleted."

      385+/190-, which is heavy, so it is attributed by what MOVED rather than by size.

      ONE CELL WAS RED. `gives the graph panel the body grid's two-thirds column` read
      `mt-10 grid gap-8 lg:grid-cols-3`, a following `lg:col-span-2` and an `<aside` off the
      page, and all three left it with the body grid. It is REPLACED, not deleted: `gives the
      graph the container's whole width` holds the new arrangement from both ends — nothing
      between `.container-page` and the mount narrows the box, and the three needles do not
      come back — over a comment-stripped copy of the page, because the page's own history
      note quotes all three inside backticks and a raw scan reds against a correct page for
      saying what it stopped doing.

      THE REST OF THE DIFF IS THE HALF THAT STAYED GREEN, and it is the reason the pin moved
      at all. Every canvas figure in that file comes from `columnCanvasWidthAt`, which is
      arithmetic over constants and reads no page, so about thirty cells went on passing while
      describing a layout no reader could reach: a 729px canvas, a 6.6 CSS px kind row, and a
      sentence saying nothing but `starter-software-factory` is legible anywhere. Re-measured
      and re-pinned: canvas 1124/1124/948/824/692/424/314, `draws its type at the size the
      layout allows` at 10.4 for the six-column drawings and 17.6 for the starter, nine new
      pane heights, and `cannot make a six-column drawing legible in this column` INVERTED
      into `is legible exactly where the canvas is wide enough for it`, which pins the whole
      legible set at each of the seven widths. The `lg` hinge both headers argued was real
      (1024 narrower than 900) is gone with the grid, and the argument is removed rather than
      annotated: 948 > 824 and the chain is monotonic.

      THREE ASSERTIONS WERE ADDED rather than only moved. `lands on the canvas width its own
      arithmetic predicts` gives `minCanvasFor` its first caller, one pixel either side of the
      boundary it names; the per-blueprint pane-height cell now also refuses
      `PANE_MIN_HEIGHT` at the design width; and the replacement layout cell opens with an
      instrument check on its own comment stripper, because a strip that ate the tail of the
      page would green all three of its needles at once and read exactly like a page with no
      grid on it.

      The honesty half was kept in place rather than dropped with the number it reported: the
      file still says in a sentence that `adversarial-consensus-line` and
      `checkpoint-resume-runner` clear no floor at any window width, and `is whole but not
      legible on a phone` is untouched.

      FALSIFIED BEFORE THIS PIN MOVED, on two axes, because a file this large can be made
      green by weakening as easily as by measuring.
        · Page source, restored from a `cp` copy each time, never `git checkout`. Putting the
          `lg:grid-cols-3` / `lg:col-span-2` / `<aside` arrangement back between the container
          and the mount reds the new cell by name, listing both class lists. A BARE `<aside`
          added AFTER the mount, where the forward half cannot see it, reds the backward half
          — which is also the two-axis proof that the comment stripper works, since the same
          cell is green against the correct page whose comment quotes that token. Removing
          `id="blueprint-workspace"` reds the wrapper half.
        · `framing.ts`, restored from a `cp` copy each time. `minCanvasFor` 20px low: 1 red,
          the new boundary cell, and the per-width pairing missed it — measured, and said so
          in that cell's own docblock rather than left implied. `minCanvasFor` one pixel high:
          1 red, the same cell. `MAX_ZOOM` lowered under `LEGIBLE_ZOOM`: 12 reds, including
          the boundary cell, which is the one case its closed form does not model.
          `canvasWidthAt` 40px narrower: 11 reds, all seven canvas cells and the legible set
          at 1440 and 1200.
        · The new cell's own stripper, replaced by a truncation that keeps the mount and
          drops everything after it: 1 red, the instrument check, naming the vacuity rather
          than the page.
      Suite measured green at 213/213 across `components/panes` and `components/graph` after
      the restores, `tsc --noEmit` clean, `eslint` clean.

      WHAT WAS NOT DONE: no assertion about accessibility, contrast, label overlap or an
      honesty disclaimer was removed or loosened, no cell was deleted without a replacement
      holding the same subject, and no number was widened into a floor to absorb the move.
      `>= 10.4` and `at least six of them` were both available and both refused, because
      either would pass a layout that traded `frontline-triage` for
      `checkpoint-resume-runner`.

      The previous pin was `7d66eabdb801ab0c58969fe6e940e26e8066a6cb`.

      RE-PINNED DELIBERATELY at the T261 merge, cause named as the pin's own message
      demands: D-261-05's granted `PAGE_FILE` repoint. Diff attributed before re-pinning —
      3+/2-, the constant, its new D-261-05 citation comment, and one prose line naming the
      moved path. No assertion touched. */,
    why:
      "NAMED by AC5. It is the file whose module-scope `sourceFile(PAGE_FILE)` read of " +
      "`app/blueprints/[slug]/page.tsx` deletes all 878 of its lines from the run on ENOENT " +
      "rather than redding one cell — the measurement D-261-05 cites as its own evidence.",
    granted:
      "YES — `PAGE_FILE` repoint (D-261-05). A diff touching ONLY that constant is the grant, " +
      "and NEITHER of the two 2026-09-06 re-pins above is it. There are two because the first " +
      "of them got the canvas chain wrong; the THIRD note is the current one and the SECOND " +
      "is superseded in its numbers. Read the third before attributing anything.",
  },
  {
    path: "components/blueprint/severity-word.test.ts",
    blob: "1e15328b947e8d91d72f698abb2ed74d4924fe59" /* RE-PINNED DELIBERATELY a THIRD time,
      on 2026-09-05, at the withdrawal of ontology versioning. The owner asked the concept
      removed in full, so `AutonomyResult.ontologyVersion` no longer exists and `BundlePanel`
      no longer declares `scoredOntologyVersion`: the panel's `Scores computed under vX.Y.Z`
      row has no value to draw. The diff here is 0+/1-, the same shape and the same cause as
      the second re-pin below, and it is again a deletion the COMPILER forces rather than an
      assertion being weakened. The line removed passed `bp.analysis.autonomy.ontologyVersion`
      into a prop that is gone; leaving it would not have held anything, it would have failed
      to typecheck. `ac5-prop-shapes.test.ts` moved in the same edit, which is the procedure
      that makes a removal admissible under D-261-07(8) at all.

      The previous pin was `3d26e19b2d103182377e046bf5e6233557832af3`.

      RE-PINNED DELIBERATELY a second time, at the withdrawal of the manifest's
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
  /* `components/blueprint/EvidenceLayers.test.tsx` stood here, pinned at blob
     `bd9f95725d765ae7502a42973d3a53d86c48034d`. The row is REMOVED rather than re-pinned
     because its subject is deleted: the owner asked the scoring reading off the blueprint
     page on 2026-09-04, `EvidenceLayers` had no other product mount, and the component and
     both its suites went with it. That is the one disposal this row's own `why` anticipated
     in as many words — "Inside `Owns` and deletable by the task it constrains" — so removing
     it is the outcome the pin was written to allow, not a repoint it was written to refuse.
     Recorded here rather than deleted silently, because a freeze list that shortens with no
     note is indistinguishable from one somebody trimmed to get green. */
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
    blob: "df51f62283533697a16f2e61b4b199a2397e72ab" /* RE-PINNED DELIBERATELY on 2026-09-04,
      and forced by the archive rather than by this file. Every branch edge in the nine
      topologies gained a `condition`, because without one engine spec §3.3 falls through to
      Step 5's lexical tiebreak on the target id and six of the nine blueprints took the
      wrong arm on every run. Two cells read the starter's LINE SPANS, and an explanation
      written above an edge lands inside that edge's step, so `tester ⇄ debugger` grew from
      L20–24 to L20–35 and `tester → deployer` moved from L26 to L37. The spans are the
      assertion, so they move with the file they measure.

      Falsified before the pin moved: the sibling cell "gives no two steps the same head"
      caught a real regression in the same change — a blank line left above the new comment
      in `guarded-merge-bot` split one edge block into two that both titled themselves
      "3 edges". The guard reddened by name, the topology was repaired rather than the
      assertion, and only then was this pin taken. */,
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
   *
   * SEVEN since 2026-09-04, and the missing one is accounted for in place rather than by
   * this number: `components/blueprint/EvidenceLayers.test.tsx` was deleted with the
   * component it tests, when the owner asked the scoring reading off the blueprint page.
   * Its row is replaced by a comment naming the old blob, because a shortened freeze list
   * with no note is exactly what this cell exists to catch, and the note is what tells the
   * next reader that this eight became seven by a disposal the pin's own `why` permitted
   * rather than by somebody trimming the list to get green. The count moved in the same
   * change as the removal; a count edited afterwards guards nothing in between.
   */
  it("still holds all seven", () => {
    expect(FROZEN).toHaveLength(7);
    expect(new Set(FROZEN.map((f) => f.path)).size, "a duplicated path hides a dropped one").toBe(7);
  });
});
