/* ============================================================
   The sentences this site is not allowed to stop saying.

   Every entry below was on a page once, went missing during a pass
   that was cutting for length, and was found by a reviewer reading
   two builds side by side. That is twice now that a limit statement
   has left this site by accident, and PROJECT.md §4 asks for a
   guard rather than a note in a report: a check that a specific
   disclaimer is present costs nothing to run and does not depend on
   anybody remembering.

   Two things this file is careful about, because both were how the
   statements went in the first place.

   **Open, not merely present.** §3.1 licences moving reference
   depth behind `components/ui/More.tsx`, and a `<details>` really
   does keep the text in the prerendered HTML, keyboard-reachable
   and findable by find-in-page. But a sentence that qualifies
   something printed in the open has to be in the open with it, or
   the qualified thing is read alone. So each entry says which of
   the two it needs, `open` or `present`, and the difference is
   enforced.

   **The real archive, not a fixture.** Everything here renders the
   component the page renders, over `content/`. A statement that
   only appears for a bundle the archive no longer contains is a
   statement nobody reads.

   Adding to this file is the cheapest thing in the repository. If a
   pass removes a sentence deliberately, the entry comes out in the
   same commit and the reason goes in the message.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SpecCardPage from "@/app/spec/card/page";
import McpPage, { metadata as mcpMetadata } from "@/app/mcp/page";
import SkillPage, { metadata as skillMetadata } from "@/app/skill/page";
import UploadPage from "@/app/upload/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { GuardrailShape } from "@/components/explain/ConceptFigures";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { CloneMenu } from "@/components/blueprint/CloneMenu";
import { AgentHandoff } from "@/components/build/AgentHandoff";
import { SectionLifecycle } from "@/components/home/SectionLifecycle";
import { DownloadStep } from "@/components/build/DownloadStep";
import { DEFAULT_CHOICES } from "@/components/build/choices";
import { buildState } from "@/components/build/state";
import { openText, plainText } from "@/components/ui/visible-text";

/* --------------------- the surfaces --------------------- */

const BLUEPRINTS = allBlueprints();

/** The explainability panel exactly as `/blueprints/<slug>` renders it. */
function canvas(slug: string): string {
  const bp = BLUEPRINTS.find((b) => b.slug === slug);
  if (bp === undefined) throw new Error(`no blueprint ${slug} in content/`);
  return renderToStaticMarkup(
    createElement(BlueprintCanvas, { graph: bp.graph, analysis: bp.analysis }),
  );
}

const SPEC_CARD = renderToStaticMarkup(createElement(SpecCardPage as never));
/**
 * `/skill` and `/mcp` — the two halves `/install` split into on 2026-08-07.
 *
 * `/install` was once the one page whose whole subject was a capability that does not
 * exist yet, then became half that when the DarkPrint skill shipped a command that
 * genuinely runs. The author then split it: "I prefer two pages, one for the skill and one
 * for the mcp."
 *
 * The split MULTIPLIES this ledger's work rather than dividing it, which is the thing to
 * understand before touching these rows. On one page the MCP limit and the publishing
 * limit sat under a shared "Not built yet" rule, and a reader who read the rule was
 * covered for both. There is no shared rule now. `/mcp` is a whole route about an unbuilt
 * thing, reachable from the header and from the landing's hero, and a page like that looks
 * exactly like a page for a built thing unless it says otherwise in its own voice. So its
 * limit is asserted in all three registers a reader actually meets it in — the `<head>`
 * description, the lead under the `h1`, and `InstallTabs`'s `ComingSoonBadge` beside the
 * snippet — and `/skill` keeps the publishing limit its own output provokes.
 */
const SKILL_PAGE = renderToStaticMarkup(createElement(SkillPage as never));
/**
 * The two `<head>` descriptions, not the rendered bodies.
 *
 * A search result or a shared link quotes these strings, never the JSX the pages render —
 * `renderToStaticMarkup` walks the component tree, not the sibling `Metadata` export, so a
 * claim held only over the body can go missing here without a single assertion noticing.
 * `openText`/`plainText` pass a plain string through unchanged (there is no tag to strip),
 * so the same ledger mechanism covers them with no new machinery.
 *
 * `/mcp`'s matters more than any other description on the site: it is the one route where
 * the shared-link preview is the only thing standing between a reader and a command that
 * looks runnable and is not.
 */
const SKILL_METADATA_DESCRIPTION = skillMetadata.description ?? "";

/**
 * `/mcp`, whole, and its description — the rows this file's own header claimed and never had.
 *
 * The header has said since the `/install` split that `/mcp` "refuses the server in three
 * registers", and for that entire time the ledger held none of them. The page was shaped
 * like a setup page while it said so: a numbered "1. Configure your client" step, a
 * `McpJourney` component whose connect button set local state and whose search button
 * revealed three real blueprints as though retrieved, and a `<head>` description promising
 * a reader could "connect an agent client to DarkPrint, test the connection, search by
 * task, inspect provenance, and fetch an exact blueprint release." Five capabilities, in
 * the present tense, none of them built.
 *
 * The 2026-08-11 rewrite re-registers the route as the design proposal it is and deletes
 * the journey. These rows are what stops it drifting back: an eyebrow and a badge are
 * presentation and a length pass can take either, where a sentence has to be argued out.
 */
const MCP_PAGE = renderToStaticMarkup(createElement(McpPage as never));
const MCP_METADATA_DESCRIPTION = mcpMetadata.description ?? "";
/**
 * `/upload`, whole — the one route where a reader hands the site a file.
 *
 * It was not in this ledger at all, which is remarkable given its history: the page's own
 * `metadata` docblock records that it shipped as "Share a blueprint" under an eyebrow
 * reading CONTRIBUTE, a promise of publishing there is no backend for, and that TWO HIGH
 * findings against this project were limit sentences deleted from it during a pass cutting
 * for length. Both times the sentence came back because a person read two builds side by
 * side. That is precisely the thing this file exists to stop needing.
 *
 * It matters more now than it did. The DarkPrint skill points here, so the route is the
 * first place many readers will see the word "upload" attached to something they made,
 * and the verb carries the whole implication the three claims below refuse: that the file
 * goes somewhere, that there is an account for it to land in, and that the tool which
 * wrote it can send it. The page states all three refusals in one paragraph under a single
 * `ComingSoonBadge`, in the open, above the wizard.
 *
 * The whole page and not the paragraph: it is written in the route file, and lifting it
 * into a component to make it testable would move a sentence for a test's convenience.
 */
const UPLOAD_PAGE = renderToStaticMarkup(createElement(UploadPage as never));
/* `THE_CLIMB` stood here, rendering `/towards-a-dark-factory/the-climb` whole for the one
   paragraph that said what this site is not: no accounts, nothing publishes, no MCP server.
   The author deleted that page on 2026-08-07 and the row went with it.

   This file's own header says a deliberate removal takes its entry out in the same commit
   with the reason in the message, so this is that reason. The paragraph was never a general
   statement the site owed a reader from anywhere — it was that page's own qualifier, and
   the ledger row said as much: it existed because the page "narrates a working autonomous
   pipeline for four sections" and an account of somebody else's factory read as a
   description of this one is the misreading doc 2 §0.4 exists to stop. No such narration
   survives. What DOES survive is checked and always was: `/skill` refuses the account, the
   private draft, publishing and the live push; `/mcp` refuses the server in three
   registers; `/upload` refuses all of it again beside the dropzone. Nothing moved to cover
   a gap, because the deletion did not open one. */
/**
 * The scoring panel `/reading-the-radar` mounts (PROJECT.md §3.4; moved off `/spec` onto
 * `/spec/scoring` by the lifecycle-scoring pass, spec §4, and moved again when the IA
 * pass merged that route into the radar page — `ScoringModel` itself is unchanged through
 * both, and this still renders it directly, so the assertions below hold regardless of
 * which route mounts it. Two route moves and not one edit here is the argument for
 * rendering the component rather than reading a page).
 *
 * It is the first surface on the site to print `minRuns` and `outlierZScore`, and two
 * named filters on cost and time read as a description of something running unless the
 * page says otherwise beside them. That sentence is the claim below.
 */
const SCORING = renderToStaticMarkup(createElement(ScoringModel));

/**
 * The guardrail figure on `/what-a-blueprint-is#the-words`, added 2026-08-07.
 *
 * Its right-hand column names capabilities that do not exist here and never will —
 * retrying a failed call, capping a budget, blocking or diverting a call in flight. Every
 * one of them is a live-path action, and the engine on this site reads files and analyses
 * them standing still. The only thing separating "what a harness does" from "what
 * DarkPrint does" in that column is its head, so the head is the claim.
 *
 * It is deliberately not a sentence and deliberately not a `ComingSoonBadge`: the author
 * has twice asked the site to stop repeating that it runs nothing, and amber would promise
 * a harness this site is not going to ship. An affirmative, possessive attribution in the
 * column head is the form that survived both constraints, which is exactly the kind of
 * quiet load-bearing string this file's header describes going missing in a wording pass.
 */
const GUARDRAILS = renderToStaticMarkup(createElement(GuardrailShape));

/**
 * `/build`'s two exits (task 5), rendered with the same `DEFAULT_CHOICES` the workspace
 * opens on — real content off `lib/starter/`, not a fixture, exactly like every other
 * surface in this file. Both carry the same "not built yet" sentence about registry
 * retrieval over MCP, and both are asserted below rather than one standing in for the
 * other: a reader who opens only one of the two exits still has to meet the limit.
 */
const BUILD = buildState(DEFAULT_CHOICES);
const DOWNLOAD_STEP = renderToStaticMarkup(
  createElement(DownloadStep, {
    files: BUILD.files,
    ...(BUILD.blueprint === undefined ? {} : { digest: BUILD.blueprint.digest }),
    errors: BUILD.errors.length,
  }),
);
const AGENT_HANDOFF = renderToStaticMarkup(createElement(AgentHandoff));

/**
 * The landing's fourth beat, where the site first tells a stranger what it is for.
 *
 * Its Upload panel now says why anybody would upload at all — the author asked for it, in
 * as many words: "the Upload box should stress that if uploaded, you can get feedback for
 * the blueprint you proposed by other users." Every clause of that is unbuilt. There is no
 * backend, nothing publishes, and there is no readership to send anything back, so the
 * motive and the limit are the same sentence and it has to stay that way.
 *
 * This is the highest-traffic surface in the ledger and the one whose copy is rewritten
 * most often — the beat has lost two illustration registers, a panel, and a whole ordering
 * since it was written — which is exactly the churn the file header describes a disclaimer
 * disappearing into. `components/home/beats.test.ts` holds the panel's other limit and the
 * `ComingSoonBadge` beside this one; the sentence itself is held here, with the rest of
 * the site's.
 */
const LIFECYCLE = renderToStaticMarkup(createElement(SectionLifecycle));

/* `LANDING_SAME_RUN` stood here — beat 2, whole, "the one place on the site that prints a
   per-run score" — and it is gone with the only row that read it, on 2026-08-11. The
   reasoning is filed with that row, under the landing's entry below.

   The import goes with it rather than being left unused. Beat 2 is still the one place on
   this site that prints a per-run score; what changed is that this file no longer asserts
   anything about it. `components/home/beats.test.ts` renders the beat and holds its copy,
   including the four promises of measurement it may not make. */

/**
 * The starter is the one bundle whose criteria walk stops at a judge
 * (`analysis/criteria-relayed-through-judge`), so it is the only page carrying the
 * feedback-against-gaming statement. Asserted rather than assumed, below.
 */
const STARTER = canvas("starter-software-factory");

/**
 * The download menus, both kinds, exactly as the two header rows mount them.
 *
 * They are the first surface on the site to print a `darkprint …` command, and the block
 * beside it is a `curl` line that genuinely runs. A reader who has just been handed a
 * working command reads the next code block as another working command unless the panel
 * says otherwise, which is what the claims below hold in place.
 *
 * ── Why these render at all ──
 * `CloneMenu` is a native `<details>`, so its panel is in the markup whether it is open or
 * shut. That is the whole reason it is a `<details>` rather than `ForkAction`'s
 * `open && (…)` toggle: under that gate the badge and the sentence are simply not in the
 * string `renderToStaticMarkup` produces, and no assertion over them could be written.
 *
 * ── Why `present` and not `open` ──
 * The header rule: a sentence qualifying something printed *in the open* has to be in the
 * open with it. Nothing this qualifies is in the open — the `darkprint clone` preview sits
 * inside the same closed disclosure as its disclaimer, one line above it, and a reader
 * cannot reach one without the other.
 */
const CLONE_BLUEPRINT = renderToStaticMarkup(
  createElement(CloneMenu, {
    kind: "blueprint",
    command:
      'curl --fail-early -fsSL --create-dirs -o "starter-software-factory/#1" "https://darkprint.io/bundles/starter-software-factory/{README.md}"',
    cliCommand: "darkprint clone starter-software-factory",
  }),
);
const CLONE_NODE = renderToStaticMarkup(
  createElement(CloneMenu, {
    kind: "node",
    command: 'curl -fsSL -O "https://darkprint.io/cards/spec-planner@1.0.0.yaml"',
    cliCommand: "darkprint clone card spec-planner@1.0.0",
  }),
);

/* --------------------- the ledger --------------------- */

type Where = "open" | "present";

interface Claim {
  /** What the sentence is for, in the failure message. */
  why: string;
  /** Verbatim, lowercased at compare time. A paraphrase is a different sentence. */
  says: string;
  /** `open` when it qualifies something printed in the open beside it. */
  where: Where;
  html: string;
  surface: string;
}

/* The unanchored limit statement is not in this table. It is held over every bundle in
   that state, one case each, by the test under it. */
const CLAIMS: Claim[] = [
  {
    surface: "/blueprints/starter-software-factory · where the trace stopped",
    why: "why a channel the analyzer cannot follow is worth naming at all. The engine writes it into the hint on every row of that list, and every hint is behind a closed disclosure",
    says: "seeing the evidence of a failure you caused is feedback. seeing the criteria is gaming",
    where: "open",
    html: STARTER,
  },
  {
    surface: "/blueprints/starter-software-factory · where the trace stopped",
    why: "the limit stated in both directions. \"Nothing is charged\" says what the score did; this says what the silence means",
    says: "not evidence of a leak. it is not evidence of isolation either",
    where: "open",
    html: STARTER,
  },

  /* ---- /spec/card ---- */
  {
    surface: "/spec/card · the `cannot[]` entry in the subfield list",
    why: "half of the page's thesis. It used to close panel B of \"The split\", which asserted the free-text entry is legitimate; the IA pass of 2026-08-07 removed that band and rehomed this sentence onto the `cannot[]` entry, which is the field it was always about. Without it the symmetry has one side, and an entry nothing checks reads as an entry that failed",
    says: "both are legitimate. a reader has to be able to tell which is which without running anything",
    where: "open",
    html: SPEC_CARD,
  },
  {
    surface: "/spec/card · the resolver's own sentence, quoted under the field list",
    why: 'the severity of the refusal in word form. It used to be in the prose ("at error severity"); after the length pass the only word form left was inside an `<svg>` plate and inside the folded field table. The IA pass of 2026-08-07 removed both hiding places — "The split" and its `EnforcementFigure` went, and the field table is permanently open — so the quoted `Diagnostic`, still read off `isolationDemo()` at build time, now sits in the open under the field list',
    says: "error bundle/prohibition-violated",
    where: "open",
    html: SPEC_CARD,
  },

  /* ---- /reading-the-radar ---- */
  {
    surface: "/reading-the-radar · cost and time, if they are ever reported",
    why: "the whole telemetry block is a design nothing implements. `minRuns 5` and `outlierZScore 3` are printed as engine configuration, which is what every other number in that section is, and those two are filters on a pipeline that has never had an input. PROJECT.md §3.5 is the point at which this stops being free, so the sentence has to be beside the numbers rather than behind a disclosure",
    says: "nothing on this site measures a run. these two filters describe a design",
    where: "open",
    html: SCORING,
  },

  /* ---- /what-a-blueprint-is · the guardrail figure ---- */
  {
    surface: "/what-a-blueprint-is#the-words · the guardrail figure's right-hand column",
    why: "the column lists retry, budget caps and blocking a call in flight. None of that happens here — this engine reads files standing still — and the possessive is the only thing that says so. Drop it and the figure claims a live path, on the page whose whole subject is what a bundle can and cannot promise",
    /* Reworded 2026-08-08, not weakened, and the row is updated rather than removed
       because the claim survives the rewording intact.

       The author asked the figure reorganised so the right column reads as "an example of
       what a harness does when running according the indications provided by the static
       files in the bundle". The head is now "At run time · an example of what your harness
       does with it", which keeps the possessive this row exists to protect AND adds the
       word `example` — so the column no longer even reads as a list of what a harness will
       do, only of what one might. That is a stronger limit than the one this row was
       written for, in the same place, so the row follows the wording instead of failing on
       it.

       What must never go is `your`. It is the whole difference between describing a harness
       and claiming one, on a page whose subject is what a bundle can and cannot promise. */
    says: "an example of what your harness does with it",
    where: "open",
    html: GUARDRAILS,
  },

  /* ---- /towards-a-dark-factory · the four checks — removed with the section ----
     Three rows stood here, all `where: "present"`, over `WhichTasksChecks`: "the tester is
     the one node standing between generated code and the release gate", "an expensive way
     to run one prompt", and "the run is over before anyone finds out". The author asked
     that section off the route on 2026-08-07 and the component is deleted.

     This file's header asks that a deliberate removal take its entry out in the same commit
     with the reason in the message, so: all three were completions of an argument
     `WhichTasksExamples` made, and two said so in their own `why` — "the examples above say
     the tester passes whatever it is given; nothing else says what that makes the graph".
     The examples were deleted earlier the same day. The rows were qualifying a claim that
     had already left the site, and there is nothing left on the route for them to attach
     to: the four questions are asked once now, in `WhichTasksGlance`, in glance form. */

  /* ---- /what-it-isnt — removed with the route ----
     The entry held "reference another as a composite node, and nothing on the site does
     that today" over `SectionComponentRecap`. It is out because the thing it qualified is
     out: "composite node" was written in exactly one place on the site, that component,
     and the component was deleted with `/what-it-isnt`. The site no longer describes the
     feature, so it no longer needs the sentence saying the feature is not built.

     This is the only reason an entry may leave. An entry does not come out because a
     length pass wanted the words; it comes out when the claim it guards has nothing left
     to guard. If the composite-node idea is ever described again anywhere, this entry
     comes back with it. */

  /* ---- /skill ----
     The half that runs. Its one limit is not inherited from the old shared rule — it is
     the question this page's own output provokes, which is why it stayed here when the MCP
     preview left. A reader who has just been handed a folder asks where to put it. */
  {
    surface: "/skill · the publishing panel, under the page's own rule",
    /* AMENDED at T280 (owner-instructed, 2026-08-25). This row pinned a four-refusal
       sentence; T050 (accounts), T263 (publish + per-release visibility) and T280's page
       wiring made three of the four the false claim in the other direction. The pin moves
       to the one refusal still true, which is the same claim this row always guarded:
       the reader is told, on the page that handed them the folder, what they still
       cannot do with it from where they sit. */
    why: "the route ends with a reader holding a blueprint their own agent wrote, and the next question anybody holding one asks is where to put it. The answer is /upload now, and the residual limit has to be stated on the page that just handed over the folder: their agent cannot push it there itself (T270 todo, SEAM-96 open)",
    says: "not built yet: pushing a change to it straight from claude code as you work",
    where: "open",
    html: SKILL_PAGE,
  },
  {
    surface: "/skill · metadata.description",
    why: "the same kind of disclaimer where a reader who never opens the page reads it — a search result, a shared link's preview card, a browser history entry. `/install`'s said \"not built yet: nothing here runs\" until 2026-08-07, and that came out because it became false in the OTHER direction: `npx skills@latest add Brotherhood94/darkprint` runs. AMENDED at T280 for the same both-ways rule: accounts and publishing went live, so the description now names the one capability genuinely absent — a release cut from inside the reader's own agent",
    says: "not built yet: releasing straight from your agent",
    where: "open",
    html: SKILL_METADATA_DESCRIPTION,
  },

  /* ---- the landing, beat 2 — removed 2026-08-11, on the author's instruction ----
     The row held "illustrative: darkprint does not run your graph", `open`, over
     `SectionSameRun`. The author asked that line off the page, having been shown this row
     and `beats.test.ts`'s assertion first, so both come out in the same commit with the
     reason in the message — which is what this file's header asks of a deliberate removal,
     and the alternative was a row passing over a string nobody prints.

     This is NOT the reason an entry is normally allowed to leave. The rule stated at
     `/what-it-isnt` above is that a row comes out when the thing it qualified has left the
     site. That is not the case here: beat 2 still draws four runs, four scores and three
     deltas in fixed tabular columns, which is the shape of a readout off a real harness, and
     DarkPrint still runs nobody's graph — no per-run figure in the product, no runner, no
     endpoint, and `/reading-the-radar` still says so in the open. The claim is intact and
     the qualifier is gone, which is the one combination this file was written to prevent,
     and it is recorded here rather than in a commit message alone for exactly that reason.

     What survives, and it is weaker: `beats.test.ts` still fails on a PROMISE of measurement
     — `eval`, `we measure`, `we score`, `measure if` — and on the beat losing the sentences
     that keep the running the reader's. None of that catches a reader who takes 0.62 → 0.86
     for readings off this site.

     If the line comes back, this row comes back with it, and `LANDING_SAME_RUN` with both. */

  /* ---- /mcp ----
     Three registers, which is what this file's header has always said this route needs and
     what it did not check: the description a reader meets before the page, the lead they
     meet on it, and the status beside every operation in the contract table. The badge
     beside the `h1` is deliberately NOT one of them — a badge is a glyph and a glyph is not
     a sentence, and every other route in this ledger is held to words for the same reason. */
  {
    surface: "/mcp · metadata.description",
    /* AMENDED at T280 (owner-instructed, 2026-08-25). T220 shipped the four operations at
       /api/mcp/** and the page copy was recorded owed (ARCHITECTURE.md's t220 row); T280
       paid it. The description's job is unchanged: warn the reader the COMMAND is not
       runnable — the truth just moved from "no server" to "no npm package". */
    why: "the one description on the site where a shared link's preview card is all that stands between a reader and a command that looks runnable. The server answers now; what fails is the npx command itself, because nothing was ever published to npm under the name it invokes. A reader who never opens the page has to be told anyway",
    says: "the darkprint package is not published to npm",
    where: "open",
    html: MCP_METADATA_DESCRIPTION,
  },
  {
    surface: "/mcp · the lead under the h1",
    why: "the page prints real client configuration in its first section, because that is where a reader looks for it, and a snippet that is correct in every respect except the package it invokes is the most convincing thing on the route. The sentence that qualifies it has to be above it and in the reader's path, not beside the snippet where it reads as a caveat about one client. AMENDED at T280: the server half went live, so the qualifier names the half that is still absent",
    says: "running the command below still fails, because the darkprint package on npm does not exist yet",
    where: "open",
    html: MCP_PAGE,
  },
  /* ---- /mcp · the status column — row REMOVED at T280 (owner-instructed, 2026-08-25) ----
     It pinned "not built" per operation-row while the four operations had no handlers.
     T220 built all four (lib/server/mcp, app/api/mcp/**) and T280 flipped the column to
     "live", so the pinned string's presence became the false claim. The disclosure duty
     this row carried did not leave the route: the npm-unpublished warning is pinned twice
     above, in the description and in the lead. If an operation is ever unshipped, its row
     comes back here with it — the same both-ways rule every removal in this file cites. */

  /* ---- /upload ----
     THREE rows stood here until T263 wired this route to the registry. Two came off in
     that change and one stayed, and which is which is D-263-02 rather than a judgement
     made here.

     **Off: "an account to upload into, with each blueprint public or private the way a
     repository is."** Both halves of it became real together — T050 landed accounts and
     the wizard's Details step now carries an explicit public/private control that is sent
     on the wire. Had only one half landed, the sentence would have been SPLIT rather than
     deleted: a marker over two claims where one is still true is not a marker that can
     come off whole.

     **Off: "there are no accounts and no backend: what you upload is read in this tab and
     stays in it."** This is the sentence the cutover made false in as many words, and the
     one this file's header records as having twice been deleted by a length pass and twice
     restored. It comes off here for the opposite reason: not because somebody was cutting,
     but because leaving a true statement standing after it has become a lie about the
     product is the other half of D-78 and the worse half.

     **Kept: the editor push.** T270 is `todo`. The skill still writes a folder to disk and
     nothing pushes it, so this refusal is as true as it was and its badge still earns its
     place. It is the only reason `ComingSoonBadge` is still mounted on the route.

     The two rows are not replaced by weaker ones. What replaced them is not a disclaimer at
     all: the page now STATES what publishing does, which is a claim that can be checked
     against behaviour rather than a limit that has to be remembered. */
  {
    surface: "/upload · no push from the editor the skill runs in",
    why: "added with the DarkPrint skill, and it outlived the two sentences it used to sit beside. The paragraph above it tells a reader that a tool inside their own editor writes a folder for this page; the very next question anybody asks is whether the editor sends it, and a page that answers by saying nothing is answering yes. T263 wired the Publish button, which makes that question MORE pressing rather than less — a reader who has just learned the button really publishes has every reason to assume the editor does too. `/install` refuses the same thing at the other end of the same story",
    says: "not built yet: a live push from the editor the skill runs in",
    where: "open",
    html: UPLOAD_PAGE,
  },

  /* ---- the download menus ---- */
  {
    surface: "/blueprints/<slug> · take the whole folder",
    why: "the menu's second half previews a `darkprint clone` line one paragraph under a curl command that really works. Doc 2 §0.4: a code block beside a working code block reads as runnable, and this is the sentence saying the CLI is not",
    says: "not built yet: a darkprint cli that clones a blueprint by name",
    where: "present",
    html: CLONE_BLUEPRINT,
  },
  {
    surface: "/blueprints/<slug> · take the whole folder",
    why: "the honest difference between what this command does and the word the author asked for. Copying a folder over HTTP is a snapshot: no repository, no history, nothing to pull, and a reader who reads \"clone\" and expects an update path finds out only when it fails",
    says: "a snapshot, not a clone",
    where: "present",
    html: CLONE_BLUEPRINT,
  },
  {
    surface: "/nodes/<id> · take the file",
    why: "the same limit on the card page's own menu, so a reader who only ever opens a node card still meets it. The noun differs because the CLI would clone a card there, and a paraphrase of the blueprint sentence would leave this surface unguarded",
    says: "not built yet: a darkprint cli that clones a card by name",
    where: "present",
    html: CLONE_NODE,
  },

];

/** The two dropdown panels, asserted together wherever the assertion is the same. */
const MENUS = [
  ["the blueprint clone menu", CLONE_BLUEPRINT],
  ["the node clone menu", CLONE_NODE],
] as const;

describe("the surfaces the ledger is read off", () => {
  it("rendered something on each of them", () => {
    // A ledger held over an empty string passes every case in it.
    for (const [name, html] of [
      ["/spec/card", SPEC_CARD],
      ["the scoring panel", SCORING],
      ["the starter's canvas", STARTER],
      ["/build · download exit", DOWNLOAD_STEP],
      ["/build · agent-brief exit", AGENT_HANDOFF],
      ["/ · the lifecycle beat", LIFECYCLE],
      ["/upload", UPLOAD_PAGE],
    ] as const) {
      expect(html.length, name).toBeGreaterThan(2000);
    }
    // The guardrail figure is three rows of two cells, not a page. Its own floor, for the
    // same reason the two menus below have theirs: a threshold it could never meet is the
    // same as no threshold at all.
    expect(GUARDRAILS.length, "the guardrail figure").toBeGreaterThan(900);
    // The two menus are dropdown panels rather than pages, so they get their own floor.
    // 2000 is a threshold neither could ever meet, and a floor nothing can fail is the
    // same as no floor at all.
    for (const [name, html] of MENUS) {
      expect(html.length, name).toBeGreaterThan(900);
    }
    expect(BLUEPRINTS.length).toBe(9);
  });

  /**
   * There is no repository per blueprint, no remote and no history. The author asked for
   * "a sort of `git clone blueprint_name`", and this is the half of that ask the site
   * refuses: the command that works is a snapshot fetch, and the only thing here that
   * would genuinely be a clone is the CLI that does not exist. The word may not reappear
   * on either menu under any later wording pass.
   */
  it("never says git on either download menu", () => {
    for (const [name, html] of MENUS) {
      expect(plainText(html).toLowerCase(), name).not.toContain("git");
    }
  });

  it("still has a bundle whose criteria walk stops at a judge", () => {
    // The two starter claims above are only readable in the `relayed` state. If the
    // archive stops producing it, this fails here rather than passing vacuously there.
    expect(
      BLUEPRINTS.filter((bp) =>
        bp.analysis.security.diagnostics.some(
          (d) => d.code === "analysis/criteria-relayed-through-judge",
        ),
      ).map((bp) => bp.slug),
    ).toContain("starter-software-factory");
  });
});

describe("claims the site may not stop making", () => {
  it.each(CLAIMS.map((c) => [`${c.surface} — "${c.says.slice(0, 48)}…"`, c] as const))(
    "%s",
    (_name, claim) => {
      const body = (
        claim.where === "open" ? openText(claim.html) : plainText(claim.html)
      ).toLowerCase();
      expect(body, `${claim.why}. Surface: ${claim.surface}`).toContain(
        claim.says.toLowerCase(),
      );
    },
  );

  /**
   * The unanchored claim is held over every bundle in that state rather than over one, so
   * a change that fixes the panel for the blueprint somebody happened to open is not
   * enough. Eight of the nine are unanchored today.
   */
  it("states the unanchored limit in the open on every bundle in that state", () => {
    const unanchored = BLUEPRINTS.filter((bp) =>
      bp.analysis.security.diagnostics.some(
        (d) => d.code === "analysis/criteria-leak-unanchored",
      ),
    );
    expect(unanchored.length, "no bundle is unanchored any more").toBeGreaterThan(0);
    for (const bp of unanchored) {
      expect(openText(canvas(bp.slug)).toLowerCase(), bp.slug).toContain(
        "the absence of a finding here is silence. it is not a clean verdict",
      );
    }
  });
});

describe("claims carried by data rather than by copy", () => {
  /**
   * Deleted from the `inputs · outputs` row as wording. It is the reason typed ports
   * exist and the premise the whole `cannot` demonstration rests on, and a grep for
   * "checkable" over the built pages found it nowhere else.
   */
  it("says what typed ports are for, on the field the ports are declared in", () => {
    const row = CARD_ROWS.find((r) => r.name === "inputs · outputs");
    expect(row, "the inputs · outputs row was renamed or removed").toBeDefined();
    expect(row?.what).toContain("makes an edge checkable at all");
  });
});


/* ============================================================
   /upload step 4 — what the success screen claims (AC3, D-263-03)
   ============================================================ */

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The wizard's ending, asserted over its SOURCE rather than over a render.
 *
 * ── Why this is not a ledger row ──
 * Every other claim in this file is checked against `renderToStaticMarkup` output, and that
 * mechanism cannot reach this one. `UPLOAD_PAGE` renders `UploadPage`, which mounts
 * `UploadFlow` at `step === 1` with no outcome; the success screen is step 4 of a stateful
 * client component reached by a publish that resolves. A static render never arrives there,
 * so a ledger row over `UPLOAD_PAGE` asserting this sentence would fail against a correct
 * page — and, worse, one asserting its ABSENCE would pass against any page at all.
 *
 * The two ways to make it renderable were both refused, and neither refusal is this task's.
 * `vitest.config.ts` is `environment: "node"` with no jsdom, and adding a DOM environment to
 * satisfy one criterion changes shared config for a test's convenience. Lifting the sentence
 * into a pure export is refused by this file's own header two hundred lines up: "lifting it
 * into a component to make it testable would move a sentence for a test's convenience."
 * D-263-03 rules the source-level form instead, in T262-AC6's idiom.
 *
 * ── What it actually pins ──
 * Not a verbatim string. The screen interpolates the handle, the slug, the version and the
 * digest, so there is no constant sentence to quote — pinning a fragment around the holes
 * would pin punctuation. It pins the CLAIM: that the published branch names each of the four
 * things AC1 asks for, and that the words the route is no longer allowed to say are gone.
 */
/**
 * Source with its commentary removed.
 *
 * **The copy check below is about what the PAGE says, and a comment is not what the page
 * says.** Both directions matter and both were live here. A file whose comments explain why
 * a retired sentence was retired would red a correct page — this guard failed on exactly
 * that on its first run, against prose reading "`not wired up` is gone rather than
 * reworded". And the mirror is worse: a check that matches comments can be satisfied by
 * deleting a comment while the sentence it describes stays on screen.
 *
 * Block comments cover `/* *\/` and JSX's `{/* *\/}`, which is where this file's prose
 * lives. Line comments are stripped too; `UploadFlow.tsx` carries no `://` for that to
 * damage, checked rather than assumed.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * The sentences `/upload` is no longer allowed to say, now that pressing Publish publishes.
 *
 * Each is a claim the cutover made FALSE, not merely dated. `not wired up` is in the list
 * because D-263-02 says it is deleted rather than reworded — a rewording keeps the phrase
 * and changes what follows it, and this catches that.
 *
 * What is deliberately NOT here: "not built yet", which still stands over the editor push
 * (T270 is `todo`), and the vocabulary note's "read against the curated core alone", whose
 * subject is an unreadable overlay and is therefore still true after any cutover. **Subject
 * decides whether a sentence retires, never which file it lives in** (D-263-01, D-263-12).
 */
const RETIRED_CLAIMS = [
  "nothing was sent",
  "nothing was saved",
  "nothing was uploaded",
  "nothing is uploaded",
  "nothing is sent",
  "not wired up",
  "there is no registry backend",
  "nothing leaves this tab",
] as const;

/**
 * Every source file that can put copy on `/upload`, with its commentary removed.
 *
 * Enumerated off the filesystem rather than listed, so the sweep covers a file somebody adds
 * to the route next year without that person having to know this guard exists.
 */
function ROUTE_SOURCES(): { path: string; copy: string }[] {
  const out: { path: string; copy: string }[] = [];
  for (const dir of ["app/upload", "components/upload"]) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const path = join(entry.parentPath ?? dir, entry.name);
      out.push({ path, copy: withoutComments(readFileSync(path, "utf8")) });
    }
  }
  return out;
}

describe("/upload step 4 states what was stored", () => {
  /**
   * The wizard with its commentary taken out — used by EVERY cell below, not just the copy
   * one. A structural cell reading raw source can be satisfied by a comment that mentions
   * the binding it looks for while the branch that rendered it is gone, which is the same
   * class of blindness as the copy cell's and was live here until D-263-12.
   */
  const FLOW = withoutComments(
    readFileSync(`${ROOT}/components/upload/UploadFlow.tsx`, "utf8"),
  );

  /**
   * AC5, and it is the check that the cutover was COMPLETE rather than mostly done.
   *
   * Held over the source and not the render for the reason above: two of the three places
   * this route used to say it — the success screen and the disabled note behind the Publish
   * button — are unreachable from a static render, which is exactly how they survived every
   * pass until now. The header paragraph, which IS reachable, is covered by the ledger above.
   *
   * `not wired up` is in here because D-263-02 says it is DELETED rather than reworded. A
   * reworded version would keep the phrase while changing what follows it, and this catches
   * that.
   */
  it("no longer says the bundle is not sent, saved or wired up, on ANY file that renders the route", () => {
    /* **Every file that renders `/upload`, not the one the criterion cites.**
       D-263-12, and this widening is the finding rather than the line that provoked it.
       The first version of this cell read `UploadFlow.tsx` alone, because that is the file
       AC5's own prose points at — and it passed while `BundleDropzone.tsx` rendered "the
       files are read in this tab and nothing is uploaded" on the upload control itself.
       Holding the rule and recognising its instance are different acts, and a guard scoped
       to the file the rule is written about cannot tell you about the other four.

       The domain is built by READING THE DIRECTORIES rather than from a list, so a file
       added to the route later is swept without anybody remembering to add it here. That
       is the whole difference between this and what it replaces. */
    const surfaces = ROUTE_SOURCES();
    expect(surfaces.length, "the route's source files could not be read").toBeGreaterThan(3);

    for (const { path, copy } of surfaces) {
      for (const forbidden of RETIRED_CLAIMS) {
        expect(
          copy.toLowerCase(),
          `${path} still says "${forbidden}", which the Publish button made false`,
        ).not.toContain(forbidden);
      }
    }
  });

  /**
   * AC1 and AC3 together: the four things a reader is owed after a release.
   *
   * Owner, slug and release are rendered from what this tab submitted and only the digest
   * comes back in the body — `PublishResult` is `{bundleId, releaseId, digest, created}` and
   * names neither an owner nor a slug (D-263-07). So this asserts the four appear on the
   * SCREEN, which is what the criterion is about, and deliberately does not assert anything
   * about the response shape: a cell doing that would red a correct route.
   */
  it("names the owner, the slug, the release and the digest on the published branch", () => {
    const published = /outcome\.state === "published" \? \(([\s\S]*?)\) : outcome\.state === "refused"/.exec(
      FLOW,
    );
    expect(published, "the published branch of the outcome screen was restructured").not.toBeNull();
    const branch = published?.[1] ?? "";
    expect(branch, "the owner's handle is not named").toContain("session.handle");
    expect(branch, "the slug is not named").toContain("{slug}");
    expect(branch, "the release version is not named").toContain("declaredVersion");
    expect(branch, "the digest is not named").toContain("outcome.release.digest");
    expect(branch.toLowerCase(), "the screen does not say the bundle was stored").toContain(
      "stored as",
    );
  });

  /**
   * AC2, and the half of it that a status code cannot carry.
   *
   * `unfinished` and `in-error` are both 422 and are two different sentences, which is the
   * whole reason `PublishRefusedError` carries a `kind`. The failure this guards is the easy
   * one: reaching for the error count because it is in hand, at the one moment doc 2 §1.1
   * says not to. `unfinished()`'s own docblock is explicit that an unfinished folder HAS
   * errors — so the count is available, and printing it is a decision rather than an
   * accident.
   */
  it("refuses an unfinished bundle in the unfinished wording, with no error count", () => {
    const arm = /if \(kind === "unfinished"\) \{([\s\S]*?)\n  \}/.exec(FLOW);
    expect(arm, "the unfinished refusal arm was restructured").not.toBeNull();
    const body = arm?.[1] ?? "";
    expect(body, "the unfinished refusal lost its wording").toContain("still being written");
    expect(body, "the unfinished refusal reaches for the error count").not.toContain("errorCount");
    expect(body, "the unfinished refusal counts errors").not.toContain("summarize");
    // The counts it MAY print are the two `bundleProgress` reports, from `progress.ts`.
    expect(body, "the unfinished refusal stopped saying how far along the folder is").toContain(
      "progress.placed",
    );
  });
});
