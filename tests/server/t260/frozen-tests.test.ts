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
    blob: "b2114d742d79149f6fd59f843732a4211b277056" /* RE-PINNED DELIBERATELY, 2026-09-06,
      at the owner's instruction to cut two figures from the profile header: "just show the
      number of blueprints, cards and stars, remove downloads and validated".

      `components/profile/ProfileShell.tsx` stopped passing `view.downloads` and
      `view.validated`, so it no longer matches `SEEDED_READS` and dropped out of the
      `printers` walk. The witness list named it, so this guard red — CORRECTLY, and on
      exactly the coupling it exists to watch: a surface that stops printing one of these
      figures is indistinguishable, to a walk, from a walk that has stopped finding them.

      WHAT MOVED IS THE WITNESS LIST AND NOT THE RULE. `ProfileShell.tsx` was replaced by
      TWO survivors, `components/profile/Pinned.tsx` and
      `app/blueprints/[owner]/[slug]/page.tsx`, so the list is longer than it was; `Pinned`
      keeps a profile-side witness so the replacement is not a retreat to a different area
      of the site. `LIVE_PRINTERS` still names both profile files and was deliberately not
      touched: neither prints one of these reads today so the exemption is inert, but it is
      an exemption for surfaces summing REAL signals, which is still what they do with
      `stars`.

      FALSIFIED BEFORE THIS PIN MOVED, in two directions, against the amended file.
      M1, the rule: every casing of the word `seeded` was neutralised in
      `components/blueprint/Comments.tsx`, a real printer. The guard red BY NAME
      ("prints an index figure and never says seeded") with 5 of 6 cells still passing. The
      file was restored from a `cp` copy and verified byte-identical with `diff -q`, and no
      probe token survives anywhere in the tree.
      M2, the witness list: removing one name from it reddened NOTHING, because
      `expect.arrayContaining` is a floor and not an exact match. That is a real property of
      this cell and it is recorded rather than left for someone to rediscover — the list can
      only ever be weakened silently, which is the argument for replacing a departing
      witness with more than one rather than fewer.

      The previous pin was `80606a2007ab77d349d1655be600e0831498fa23`, RE-PINNED
      DELIBERATELY on
      2026-09-04, at the owner's instruction to take the scoring reading off the blueprint
      page. The `AutonomyMeter` came off `ContentCard`, `ContentRow` and `Pinned` with it, so
      the surfaces this rule walks are fewer and the cells naming them moved. The RULE is
      untouched and was falsified after the amendment the same way as before: a probe file
      printing a seeded figure with no marker still reds by name. The meter itself survives
      on `/upload` via `ValidationReport`, which is why this is a narrowing and not a
      withdrawal.

      The previous pin was `39cd161d64b8250178ffd309fded181cde10f58e`, re-pinned at T280
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
    blob: "97cfcd822a508d71b13881e548d191f27e182163" /* re-pinned DELIBERATELY a FIFTH
      time, 2026-09-06, at the owner's instruction to delete the workspace route: "delete
      /build, it is not useful and make confusion". The route and the whole
      `components/build` tree went with it, and this file imported four names out of that
      tree.

      What moved is SMALLER IN KIND than the fourth amendment below, and the difference is
      the point. Two LENGTH-FLOOR entries came out of `the surfaces the ledger is read off`,
      the download exit and the agent-brief exit, together with the `DownloadStep`,
      `AgentHandoff`, `DEFAULT_CHOICES` and `buildState` imports that rendered them. No row
      left `CLAIMS` and no honesty sentence stopped being asserted. That was checked rather
      than assumed, against the committed bytes: the HEAD copy of
      `components/site/honesty.test.ts`, read with `git show` and grepped for the rows'
      `html:` field, lists every surface any claim was ever held over, and neither of the two
      exits appears anywhere in it. The pair was only ever held to "this renders more than
      2000 characters", and a floor over a component that no longer exists does not compile.

      So `CLAUDE.md`'s rule about removing an honesty assertion is NOT what authorises this
      change and is not being leaned on here. The fourth amendment below is where that rule
      was exercised, on the owner's instruction, and it stays the only place in this file's
      history where it has been.

      Falsified BEFORE this pin moved, against the amended file rather than a reconstruction
      of it. `app/upload/page.tsx` carries "Not built yet: a live push from the editor the
      skill runs in.", which is the `says` of the surviving `/upload` row; it was reworded to
      open with "Coming soon" and to say "a live send", which is the plausible weakening a
      length or tone pass would produce rather than a deletion the diff would catch. The
      ledger red BY NAME on `/upload · no push from the editor the skill runs in`, printing
      the missing fragment and the whole rendered surface, with 20 of the file's 21 cells
      still passing. The page was restored from a copy taken before the probe and the file
      re-hashed to the digest above.

      The previous pin was `392adc496fcdf369d553b7b844eca6908baa8c51` AND IT CANNOT BE READ
      with the `git cat-file -p` the message below offers. The fourth amendment was still
      uncommitted when this one landed on top of it, so those bytes were never written to the
      object database; `git hash-object` does not write, which is exactly why the digest is
      computable and the blob is not fetchable. The readable baseline is `0496781`, the THIRD
      pin, which is what `git diff components/site/honesty.test.ts` compares against, so that
      diff prints the fourth and the fifth amendments together and has to be read as two
      changes. Sequenced pins in one uncommitted tree do this; it is worth knowing before
      reaching for the command.

      Fourth amendment, kept below because its ruling is the one that carries authority for
      the claim that was removed. Re-pinned DELIBERATELY a FOURTH time, 2026-09-05, and this
      one is DIFFERENT IN KIND from the three below. Each of
      those moved `says` fragments with the copy they guard and each was able to record
      that no row was deleted and no claim changed. **This time a row WAS deleted and a
      claim DID stop being made**, and that is the whole of the amendment rather than a
      detail inside it.

      The row was `/reading-the-radar · cost and time, if they are ever reported`, pinning
      "nothing on this site measures a run. these two filters describe a design" as said in
      the open. `components/spec/ScoringModel.tsx` was its `html`, and no route has mounted
      that component since `/reading-the-radar` was deleted on 2026-09-04 — so the row had
      already become VACUOUS, asserting a sentence was readable on a page that no longer
      rendered, and passing. The owner walked §11.0 on 2026-09-05, was shown that the claim
      is still true while its surface is gone, and ruled that the component, its test and
      this row all go (§11.0 Q13, Q29).

      `CLAUDE.md` allows an honesty assertion to be removed only on the owner's explicit
      instruction. This is that instruction, and it is recorded here rather than in a commit
      message so the next reader meets it at the pin. The nearest surviving statement is
      `/upload`'s "Cost / time is reported by whoever runs it. The platform never sees the
      execution", which is weaker and which Q14's own ruling deliberately KEPT for exactly
      this reason.

      Falsified before this pin moved: the guard still discriminates, checked against a
      known pair by `the instrument itself still discriminates` below, which passes.

      The previous pin was `049678136f654c6b2464c1745c0592870d1009bb`, re-pinned a third
      time at the plain-English copy pass (owner-instructed, 2026-08-26): the sentences
      this ledger pins were rewritten out of "claudish" into plain English by the
      claudish-to-english plugin, so the rows' `says` fragments moved WITH the copy they
      guard, in the same commit. No row was deleted and no claim changed — a rewrite that
      weakened, strengthened or dropped a claim was rejected rather than pinned. Earlier
      re-pins, both still true of this file: at
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
    blob: "aaa434ad1b38a36fc3a02928fc38f87da5eb475d" /* re-pinned DELIBERATELY a FOURTH time,
      2026-09-06, at the owner's acceptance of the reframing that folds `/spec/ontology` into
      `/spec/card`: "The motivations you provided are sound. Apply them."

      THE INSTRUCTION ANSWERS A LARGER QUESTION THAN THE ADDRESS, and the answer is the part
      worth carrying. The owner asked whether the ontology should exist at all or whether
      everything should unify under the Attractor specification, because two spec documents
      read as two rival standards. The finding was that they are not rivals: 13 of 54 core
      terms overlap Attractor and those 13 REFINE it (`agent`, `tool` and `validation` are
      three DarkPrint node-types Attractor collapses into one `shape=box`), while 41 have no
      Attractor equivalent at all. Attractor specifies EXECUTION, the ontology specifies
      DESCRIPTION. So the vocabulary is KEPT and its framing changes: every term exists to be
      a legal value of a card FIELD, so the terms move beside the fields that consume them
      and the separate ontology document goes.

      FOURTH POSITION, FOURTH PIN, AND THE FILE IS STILL BIDIRECTIONAL. The tempting repair
      was to empty a guard that has now been reversed twice in two days by two different
      rulings. It is the same length, it keeps all four positions in its header as history
      rather than rewriting the losing ones as mistakes, and every absence still has a
      positive beside it. What moved: the three cells that read `app/spec/ontology/page.tsx`
      read `app/spec/card/page.tsx`; the redirect set grew to four sources, all onto
      `/spec/card`; the chain predicate INVERTED, because `/spec/ontology` was the
      destination in the third position and is a source in the fourth; a second absence cell
      covers the newly deleted page, premised on the card route being present first.

      ONE ASSERTION WAS REWRITTEN RATHER THAN MOVED, and it is the correction a carry-across
      would have got wrong. The checks-band cell matched `<CheckTable`, which on the deleted
      page could only be the vocabulary's checks band coming back. `/spec/card` mounts a
      `CheckTable` over `CARD_ROWS` as its own oldest band, so the same matcher at the new
      address would have red against a correct fold. It matches `ONTOLOGY_ROWS` now, the
      rows deleted from `components/spec/rows.ts` on the instruction that removed the band,
      which is one name for one band rather than a shape two bands share.

      FALSIFIED BEFORE THIS PIN MOVED, in four parts, against the post-fold tree.
      M1, the ruling reversed: `app/spec/ontology/page.tsx` was written back as a four-line
      stub mounting `<VocabularyBrowser`, the smallest form a fifth pass restoring it could
      take. Two cells red BY NAME — the absence, printing "the separate ontology
      specification page is back", and the whole-tree walk, printing two mounts where one is
      allowed — with the four cells that read other files still green. A guard that only reds
      when everything is wrong reds on nothing. Stub deleted, suite green again.
      M2, the redirect predicates, driven in a throwaway suite against the contract array and
      five mutations of it: the `/spec/ontology` row missing, `permanent: false`, the
      destination left at the old `/spec/ontology`, a `/spec/card` source added so all four
      chain, and a `/ontology/:term` source added to shadow term detail. Green on the
      contract, red on all five. The file was deleted after the run. It had to be driven that
      way rather than against `next.config.ts`, which belongs to another lane, and the
      predicates then ran against the real config once that lane landed: the cell red for one
      pass naming the missing rows and went green when the four arrived, which is the guard
      stating a requirement and having it met rather than being written to fit.
      M3, the freeze itself: the newly added absence of `app/spec/ontology/page.tsx` was
      deleted from the amended file, which is the plausible tidy for an author who reads a
      second absence beside the first as redundant now that the page is gone anyway. The
      SUITE STAYED GREEN at 7 of 7 — the cell goes on passing once its own second direction
      is removed — and this guard red BY NAME with every other pin still passing. That pair
      of readings is what says the freeze and not the cell catches this weakening. Restored
      from a `cp` copy and verified byte-identical with `diff -q`, and the pin above is the
      hash of the restored file rather than of the probe.
      M4, the retargeted cells against the page they now read, five mutations of
      `app/spec/card/page.tsx` restored from a `cp` copy and verified byte-identical: the
      browser unmounted (three cells red, which is the premise doing its job in two of them),
      `ONTOLOGY_ROWS` referenced, `OVERLAY_RULES` declared, a `<RouteBoxLink>` pointing at
      the folded page, and `id="fields-heading"` renamed so the premise itself is shown to be
      live. All five red BY NAME at exactly the cell that owns the claim.

      The previous pin was `07f95f61a6be27f01f1051f062b4d5fa2174c0e6` and it IS readable with
      `git cat-file -p`: those bytes are `HEAD`'s, unlike the second pin below. The caveat
      attached to that one does not apply here and is not being carried forward.

      Re-pinned DELIBERATELY a THIRD time,
      2026-09-06, at the owner's instruction to take two bands off the merged specification
      page: "remove "The overlay / Anyone can add a term, in a namespace of their own"
      section as it become false as we remove the versioning od the onotology and also the
      "The checks / What the engine holds the vocabulary to" section". Quoted as given,
      typos included, the way this file quotes "substituing" below.

      THIS IS THE THIRD AMENDMENT OF ONE DAY AND THE THIRD PIN OVERALL, and what separates it
      from the two below is the direction. Both of those got STRICTER in the same direction:
      the governance-band pass retargeted one expectation and ADDED a cell asserting that the
      extension model survived the cut, and the route merge kept every claim while adding a
      whole-tree walk and two redirect predicates. This one REVERSES the positive half of the
      first. The cell that said "the extension model is still documented on `/spec/ontology`"
      is the cell whose subject the owner has now removed.

      THE STATED REASON DOES NOT SURVIVE CHECKING, AND THE INSTRUCTION STANDS ANYWAY. Ontology
      VERSIONING went on 2026-09-05; the overlay is how a bundle ADDS to the vocabulary and it
      is a different mechanism, still live today — `content/ontology/extensions.yaml` still
      ships inside a bundle whose cards name a local term, `ontologyView` still merges it over
      `CORE_ONTOLOGY`, and `validate()` still refuses a local term no core term subsumes. "The
      checks" never had any connection to versioning at all. The instruction rests on the
      owner's authority over what the site says, which is theirs; it is recorded here with its
      reason so the next reader is not told a false thing about the code by a pin.

      What that costs, stated plainly because nobody priced it: D-144 allowed the governance
      band off `/ontology` ON THE GROUND that `/spec/ontology` keeps the extension model, and
      its own words are that removing either half "would have turned *we stopped versioning
      the vocabulary* into *you cannot add to it*, which is a different and false claim".
      That justification is now void as written. After this pass the product still ships and
      enforces the overlay and NOTHING ON THE SITE DOCUMENTS IT: a reader who wants to add a
      local term has nowhere to learn how. The nearest surviving statement is
      `components/spec/sequence.ts`'s `file: "ontology/extensions.yaml"` on the Learn rail,
      which names the file and says nothing about who may write one. That is a documentation
      gap owed in `docs/ARCHITECTURE.md` §11.0 and a D-144 correction owed in
      `docs/DECISIONS.md`, neither of which is this file's to write.

      What moved, and the file got LONGER rather than shorter. `keeps the extension model and
      the engine checks` inverted into `took the overlay and the checks bands off and left the
      rest of the page standing`, asserting both bands absent on the JSX SHAPE — the
      `aria-labelledby`, the `<h2 id=`, `OVERLAY_RULES`'s declaration and its `.map(`, and a
      mounted `<CheckTable` — and never on the bare words, because that page records in prose
      why each band it has lost went, naming the components and the copy in backticks, and a
      substring match would go red against exactly the removal it checks for. Not
      hypothetical: the page names `components/spec/CheckTable.tsx` in a comment about which
      component the vocabulary table should have reused, so a bare `toContain("CheckTable")`
      reds today against a correct page.
      `dropped the governance band and kept the extension model it described` lost the half
      whose subject is gone and became `dropped the governance band and every band that
      restated it`. NO ASSERTION WAS DELETED. The extension-model claim was MOVED to a new
      cell, `still ships, merges and enforces the overlay the page stopped documenting`, which
      asserts it against the PRODUCT rather than against the page: the checked-in file parses
      and declares `lupo/pii-handling` with a core parent, `bundleFilePaths` carries it into a
      bundle when the cards need it and not otherwise, the exporter's name for the file and
      the parser's are the same string, `CORE_ONTOLOGY` does NOT define the term while the
      merged view resolves it, and `validate()` raises `ontology/local-term-unrooted` for the
      same term with its `broader` dropped and not for the one that ships. That cell is
      written as a POSITIVE on purpose: an assertion that the site does not document the
      overlay would go red the day somebody documents it again, which is the repair this gap
      is waiting for, and a guard that reds on its own fix is a guard that gets deleted.

      Every absence carries a positive beside it as its premise, in the shape
      `tests/server/t262/per-request.test.ts` uses: the vocabulary band's `<h2
      id="vocabulary-heading"`, `<VocabularyBrowser` and `<OntologyCatalog` for the page, and
      "The five kinds of term" for the catalog. Two files each lost a section today, which is
      the pass in which a third gets emptied by accident, and an absence is green against an
      emptied file.

      FALSIFIED BEFORE THIS PIN MOVED, against the amended file rather than a reconstruction,
      in fifteen mutations that red plus two that scored zero, with a 7/7 baseline printed
      before each. Five against
      `app/spec/ontology/page.tsx`: the overlay band restored whole, the checks band restored
      whole, `const OVERLAY_RULES` alone with no heading, a bare `<CheckTable` alone with no
      heading, and the vocabulary heading renamed away. Each red BY NAME with its own message
      and the other six cells green; the third and fourth are there because the heading
      clauses would otherwise mask them, which is the shape a paired-conjunct guard fails in.
      The fifth red in TWO cells, which is the premise doing its job in both places.
      Seven against the mechanism: the overlay term renamed, its `broader` deleted, its
      `broader` repointed at itself so the chain never reaches the core, `terms: []`,
      `CORE_ONTOLOGY` given the term so the merge control has something to catch,
      `ontologyView` made to ignore its `extensions` argument, and — the one that matters
      most and is easily left out of a list — `lib/core/ontology/resolve.ts`'s
      `"ontology/local-term-unrooted"` renamed, which is the second direction falsified
      against a WRONG MODULE rather than against a weakened test. M3 below is the other
      half of that pair and they are not interchangeable. Three against the exporter: the
      vocabulary dropped from `bundleFilePaths`, pushed unconditionally so every bundle
      carries it, and `BUNDLE_VOCABULARY` set to a name the parser does not use. All red by
      name.
      TWO PROBES SCORED ZERO AND BOTH WERE THE PROBE, and the second changed the file. A
      rename of `ONTOLOGY_EXTENSIONS_FILE` in `bundle-export.ts` red nothing because the cell
      was a `toContain` and `ONTOLOGY_EXTENSIONS_FILE_RENAMED` contains the old name as a
      substring — the assertion was rewritten as a call to `bundleFilePaths` in both
      directions, which is what the three exporter reds above are against. The other was an
      unused `const` that never entered `CORE_ONTOLOGY.terms`, re-run properly as the merge
      control above.
      M3, the freeze itself: the last cell's second direction — the `broader`-dropped term
      raising `ontology/local-term-unrooted` — was deleted from the amended file, which is the
      plausible tidy for an author who reads the cell as being about what ships. This guard red
      BY NAME with the other pins still passing, which is what says the freeze and not the cell
      catches that weakening: the cell goes on passing once its own reverse direction is gone.
      Restored from a `cp` copy taken before the probe and verified byte-identical with
      `diff -q`.

      The previous pin was `f59667510855f5deb730384c0983e214e87d9acc` AND IT CANNOT BE READ
      with the `git cat-file -p` the message below offers: those bytes were never committed,
      and `git hash-object` does not write. The readable baseline is still
      `46dd27055fbd604b809cd3fe15fc110a584458e4` at `3daa325`, which is what
      `git diff components/ontology/canonical-route.test.ts` compares against, so that diff
      now prints THREE amendments and has to be read as three changes.

      Re-pinned DELIBERATELY a SECOND time,
      2026-09-06, at the owner's instruction to fold the vocabulary browser into the
      specification page: "move the ontology page in the /spec/ontology substituing the
      "every term" box. Then, you can delete the /ontology page".

      THIS IS THE THIRD POSITION THIS FILE HAS HELD ON ONE QUESTION AND THE SECOND REVERSAL,
      which is the part worth reading before the diff. The guard was written to pin the split
      between `/ontology` (the words) and `/spec/ontology` (the format) "so neither can
      quietly absorb the other again without this file saying which one won". The owner has
      now absorbed one into the other. The guard went red doing exactly its job, and the
      repair was to make it say which one won in the new direction rather than to empty it:
      it is the same length, it asserts in both directions as before, and it keeps the two
      earlier positions in its header as history rather than rewriting them as mistakes.

      What moved: `app/ontology/page.tsx` is deleted, so the three cells that read it read
      `app/spec/ontology/page.tsx` instead; the redirect assertions inverted (`/ontology` now
      HAS a 308, onto `/spec/ontology`, and `/ontologies` and `/ontologies/:slug` are
      repointed off the deleted index onto the same page); the two-routes-by-question cell
      became a one-enumeration-and-here-is-where cell.

      THE FILE GOT STRICTER IN THREE PLACES, and each is there because an absence is green
      against a tree somebody deleted by accident. (1) The deletion of the index is asserted
      only AFTER `app/ontology/` and `app/ontology/[...term]/page.tsx` are asserted present,
      so a missing `page.tsx` can only be the deletion that was ruled and never a vanished
      directory; term detail deliberately did not move and a merge that took it would
      otherwise pass here. (2) A new whole-tree walk asserts that exactly one `page.tsx`
      under `app/` mounts `<VocabularyBrowser` and names which one, because "the spec page
      has the listing" does not stop a future pass mounting a second copy on a restored
      index, and a restored index is precisely the shape this file has now been flipped over
      twice. (3) Two new redirect cells: nothing may take `/spec/ontology` as a source (a
      chain would shadow the merged page and cost every old link two hops) and no source may
      begin `/ontology/` (redirects are checked before the filesystem, so one would shadow
      the term detail pages).

      The one assertion that reads a bare href is written as a JSX-shape regex,
      `<RouteBoxLink[^>]*href="/ontology"`, and not as a substring. That page's comments quote
      route paths in backticks while recording why each one moved, and a substring match would
      charge the page for its own history — the hazard the page warns about, for this file by
      name, at the position the box used to occupy.

      FALSIFIED BEFORE THIS PIN MOVED, in four parts, because the merge landed in another
      lane while this one was writing and the world could not all be driven from here at once.
      M1, the tree as it stood: the amended file was run against the pre-merge tree, which IS
      the mutation this guard is about (index present, no redirect, browser not on the spec
      page). Three cells red BY NAME — `puts the vocabulary on the spec route and keeps the
      term detail pages` printing "the index page is back", `mounts the one enumeration on the
      spec page and nowhere else`, and `took the route box out of the slot the browser now
      fills` — with the three cells that read only `OntologyCatalog.tsx` and the
      specification half still green. A guard that only reds when everything is wrong reds on
      nothing.
      M2, the redirect predicates, which cell 1 cannot reach while the index still exists:
      driven in a throwaway file against the contract array and five mutations of it — the
      `/ontology` row missing, `permanent: false`, the destination left at the old
      `/ontology`, a `/spec/ontology` source added to chain through, and a `/ontology/:term`
      source added to shadow term detail. Green on the contract, red on all five. The file
      was deleted after the run, and the predicates then ran against the real config once the
      merge landed.
      M3, the freeze itself: the whole-tree walk was deleted from the amended file — the
      plausible tidy for an author who reads the cell as being about the spec page alone — and
      the file re-hashed. This guard red BY NAME with the other pins still passing, which is
      what says the freeze and not the cell catches that weakening: the cell goes on passing
      once its own reverse direction is gone. Restored from a `cp` copy and verified
      byte-identical with `diff -q`.
      M4, the reversal itself, against the merged tree: `app/ontology/page.tsx` was written
      back as a four-line stub mounting `<VocabularyBrowser`, which is a fourth pass restoring
      the index in the smallest form that could pass for real. Both directions red BY NAME —
      the absence cell printing "the index page is back", and the walk printing
      `['app/ontology/page.tsx', …(1)]` against the one page it allows — with the other four
      cells green. The stub was deleted and `app/ontology/` verified to hold only `[...term]`.
      M5, the walk's own premise: the walk was pointed at `app/spec` instead of `app`. It red
      BY NAME on "the walk over `app/` found 4 pages, so it has stopped seeing the site",
      which is the point of a floor set at 10 against 27 rather than at 20 — the message a
      premise prints has to be TRUE of the condition that printed it, and a floor within
      reach of the real count would eventually say the walk is broken about a site that had
      simply lost routes. M3 and M4 were run at `805a9ce5a1bab933cd8eb3b564ce81e6b6b8dcad`,
      before that floor was loosened; the loosening is the only change between that digest
      and the one pinned above, and M5 was run after it.

      The previous pin was `7922327c0eb3d74184ac0c208a5ce50d4e28ff73` AND IT CANNOT BE READ
      with the `git cat-file -p` the message below offers: those bytes were never committed,
      and `git hash-object` does not write, which is why the digest was computable and the
      blob is not fetchable. This is the same situation `honesty.test.ts`'s pin records above.
      The readable baseline is `46dd27055fbd604b809cd3fe15fc110a584458e4` at `3daa325`, which
      is what `git diff components/ontology/canonical-route.test.ts` compares against, so that
      diff prints the governance-band amendment and this one together and has to be read as
      two changes.

      The previous pin was re-pinned DELIBERATELY, 2026-09-06,
      at the owner's instruction to take the ontology governance band off the page: "remove
      the section One curated core, room for local terms as we do not offer anymore the
      versioning of the ontology; we just keep the terms from the attractor spec".

      What moved is one expectation and one added cell, and the file got STRICTER rather
      than looser. `keeps the catalog intact` swapped the band's heading for `How to read
      this set`, the heading that replaced it in the same pass. A new case then holds the
      removal from BOTH directions: the band's heading and its promotion-layer copy may not
      come back, the rail's `#governance` link may not either, and the two sentences that
      carry the extension model on the route — the lead naming a bundle's own namespace and
      the button to `/spec/ontology` — must still be there.

      That second half is the reason this amendment is worth reading. Deleting the band
      could have taken the MECHANISM with it by accident: local terms still exist and a
      bundle still declares them in `ontology/extensions.yaml`. A pass that dropped the
      surviving pair would turn "we stopped versioning the vocabulary" into "you cannot add
      to it", which is a different claim and a false one. No assertion was deleted or
      weakened; one was retargeted onto the copy that replaced its subject.

      Falsified BEFORE this pin moved, against the amended file rather than a reconstruction
      of it. The new cell's surviving-extension-model half was deleted — a plausible tidy for
      an author who reads the case as being about the removal alone — and the file re-hashed
      to `77185015ef036d93bfa5bfd4553e4f88d4bca9b6`. This guard red BY NAME on
      `'components/ontology/canonical-route.t…'` with the other four cells still passing,
      which is what says the freeze and not the cell is what catches that weakening: the
      cell itself goes on passing once its own assertion is gone. The file was restored from
      a copy taken before the probe and re-hashed to `7922327c0eb3d74184ac0c208a5ce50d4e28ff73`,
      named literally rather than as "the digest above": the digest above is this pin's, and
      an embedded history that points at the current value tells a reader the wrong baseline.

      The previous pin was `46dd27055fbd604b809cd3fe15fc110a584458e4`, readable with the
      `git cat-file -p` the message below offers, because those bytes are committed at
      `3daa325`. */,
    owner: "INSIDE T260's `Owns`",
    why:
      "D-260-10 added it, and the sentence that used to stand here cited `next.config.ts`'s comment calling it the file that \"records the reversal and holds both routes in place\". That was about the FIRST reversal and there have been two: the config's comment was rewritten with the merge and no longer says it, so the reason is stated here on its own footing. Since 2026-09-06 it also holds the two bands the owner removed OFF the merged page, and it is the only place in the repository asserting that the local-term overlay still ships, still merges and is still enforced now that no page on the site documents it. It is the only instrument holding the vocabulary to ONE route. It asserts that `/spec/ontology` mounts the single exhaustive term listing and that no other page under `app/` mounts a second, that `app/ontology/page.tsx` stays deleted while `app/ontology/[...term]/page.tsx` does not, and that the three redirect rows land there without chaining and without shadowing term detail. `nav.test.ts` sees only the far end of that — it resolves a redirect destination against the filesystem and checks no `page.tsx` survives at a retired source — so deleting this file leaves the trio, the deletion and the surviving detail routes unpinned.",
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
