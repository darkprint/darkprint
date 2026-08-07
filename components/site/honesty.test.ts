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

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SpecCardPage from "@/app/spec/card/page";
import SkillPage, { metadata as skillMetadata } from "@/app/skill/page";
import McpPage, { metadata as mcpMetadata } from "@/app/mcp/page";
import UploadPage from "@/app/upload/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
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
const MCP_PAGE = renderToStaticMarkup(createElement(McpPage as never));
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
const WHICH_TASKS = renderToStaticMarkup(createElement(WhichTasksChecks));
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
    summary: "It builds a small web app, releases on the tester's verdict, and caps the debug loop at 2 turns.",
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
    says: "seeing the evidence of a failure you caused is feedback, seeing the criteria is gaming",
    where: "open",
    html: STARTER,
  },
  {
    surface: "/blueprints/starter-software-factory · where the trace stopped",
    why: "the limit stated in both directions. \"Nothing is charged\" says what the score did; this says what the silence means",
    says: "not evidence of a leak, and it is not evidence of isolation either",
    where: "open",
    html: STARTER,
  },

  /* ---- /spec/card ---- */
  {
    surface: "/spec/card · the `cannot[]` entry in the subfield list",
    why: "half of the page's thesis. It used to close panel B of \"The split\", which asserted the free-text entry is legitimate; the IA pass of 2026-08-07 removed that band and rehomed this sentence onto the `cannot[]` entry, which is the field it was always about. Without it the symmetry has one side, and an entry nothing checks reads as an entry that failed",
    says: "both are legitimate, and a reader has to be able to tell which is which without running anything",
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
    says: "nothing on this site measures a run, so these two filters describe a design rather than a behaviour",
    where: "open",
    html: SCORING,
  },

  /* ---- /what-a-blueprint-is · the guardrail figure ---- */
  {
    surface: "/what-a-blueprint-is#the-words · the guardrail figure's right-hand column",
    why: "the column lists retry, budget caps and blocking a call in flight. None of that happens here — this engine reads files standing still — and the possessive is the only thing that says so. Drop it and the figure claims a live path, on the page whose whole subject is what a bundle can and cannot promise",
    says: "done by your harness, at run time",
    where: "open",
    html: GUARDRAILS,
  },

  /* ---- /towards-a-dark-factory · the four checks ----
     The surfaces are named `/towards-a-dark-factory` rather than `/…/which-tasks` as of
     2026-08-07: that route was merged into its parent and `WhichTasksChecks` is mounted
     there now. The component is unchanged and so are the three sentences. */
  {
    surface: "/towards-a-dark-factory · check 01",
    why: "the tester's structural position, which is why a task with no verdict is a veto rather than a caution. A grep for \"release gate\" over the built site returns one hit, and it describes the starter's wiring rather than the tester",
    says: "the tester is the one node standing between generated code and the release gate",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory · check 01",
    why: "what a rubber-stamping tester costs. The examples above say the tester passes whatever it is given; nothing else says what that makes the graph",
    says: "an expensive way to run one prompt",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory · check 03",
    why: "why ambiguity is not caught by the graph. The examples say every node downstream builds on a guess; this says the run ends before anyone can act on it",
    says: "the run is over before anyone finds out",
    where: "present",
    html: WHICH_TASKS,
  },

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

  /* ---- /mcp ----
     `/install` split in two on 2026-08-07 and this is the unbuilt half, now a route of its
     own with an `h1`, a tab strip of client configs and a command a reader could copy. It
     is reachable from the header and from the landing's hero. Nothing about its shape says
     "preview" — that is what a dedicated route costs, and the three entries below are what
     buys it back.

     The sentence is UNCHANGED, character for character, from the one `/install` carried,
     and it has now moved twice: page lead, then into the MCP panel when the skill took the
     top of the page, then back to being a lead here. It has never been reworded. A limit
     that gets rephrased on every relocation is a limit being negotiated down, and the
     wording is the part these assertions can actually hold.

     What they cannot hold is placement — `MCP_PAGE` renders the whole route and passes
     with the sentence anywhere on it. On `/install` that mattered enormously, because the
     same words above a working install command qualified the wrong thing. Here it matters
     less than it ever has: there is no working command on this page for a stray disclaimer
     to attach itself to. The page is about one thing and the one thing is not built. */
  {
    surface: "/mcp · the lead, directly under the h1",
    why: "doc 2 §0.4's disclaimer, back where it started. The route previews a client config that reads as something to run unless the page says otherwise, and it no longer shares a page with anything that does run — so the limit is the lead again rather than a note beside a panel, which is the strongest position the sentence has ever had",
    says: "not built yet: this is what setup will look like once the registry has an mcp server to point a client at",
    where: "open",
    html: MCP_PAGE,
  },
  {
    surface: "/mcp · beside the tab strip",
    why: "the sentence above is prose a reader can scroll past; this is the marker on the snippet itself. A reader who arrives from the landing's hero chip has already seen one badge on that chip and is looking for the command, not the paragraph, and the command is the thing that would be copied into a terminal. `InstallTabs` prints its own `ComingSoonBadge` inside the tab panel for exactly this reason",
    says: "coming soon",
    where: "open",
    html: MCP_PAGE,
  },
  {
    surface: "/mcp · the retrieval paragraph",
    why: "added 2026-08-07 when the author gave the server a scope: a Claude Code session searching an embedded index of published blueprints and cards by the task in front of it. That paragraph is the most detailed description of unbuilt machinery anywhere on this site — detailed enough to read like a changelog entry for something shipped — and detail is exactly what makes a future capability read as a present one. The lead above it already says the server is not built; this closing clause is the same refusal attached to the specific new claim, because a reader who skimmed to this paragraph for the interesting part never read the lead",
    says: "neither the index nor the search exists yet",
    where: "open",
    html: MCP_PAGE,
  },
  {
    surface: "/mcp · metadata.description",
    why: "the one description on the site doing genuine load-bearing work. Every other route's preview card describes a page a reader can judge on arrival; this one describes a page that looks built and is not, and the card is what a reader sees in a search result or a shared link before deciding whether to trust it. It carries the limit first and names the half that does run second, so the string is useful rather than only cautious",
    says: "not built yet: this is what setup will look like once the registry has an mcp server to point a client at",
    where: "open",
    html: MCP_METADATA_DESCRIPTION,
  },

  /* ---- /skill ----
     The half that runs. Its one limit is not inherited from the old shared rule — it is
     the question this page's own output provokes, which is why it stayed here when the MCP
     preview left. A reader who has just been handed a folder asks where to put it. */
  {
    surface: "/skill · the publishing panel, under the page's own rule",
    why: "the route ends with a reader holding a blueprint their own agent wrote, and the next question anybody holding one asks is where to put it. The answer is nowhere: there is no backend, no account, no private draft and no push from a client, and all four have to be refused on the page that just handed over the folder rather than only on `/towards-a-dark-factory/the-climb`",
    says: "not built yet: an account of your own, a blueprint kept private while it is under construction, publishing one to the registry, and pushing a change to it straight from claude code",
    where: "open",
    html: SKILL_PAGE,
  },
  {
    surface: "/skill · metadata.description",
    why: "the same kind of disclaimer where a reader who never opens the page reads it — a search result, a shared link's preview card, a browser history entry. `/install`'s said \"not built yet: nothing here runs\" until 2026-08-07, and that came out because it became false in the OTHER direction: `npx skills@latest add Brotherhood94/darkprint` runs. This route inherits the working half, so its description names what the command actually leaves on disk and then the two capabilities that are genuinely absent. The MCP limit is NOT in this string any more, and its absence is correct rather than an omission: it moved to `/mcp`, which is now a route with a description of its own",
    says: "not built yet: accounts and publishing",
    where: "open",
    html: SKILL_METADATA_DESCRIPTION,
  },

  /* ---- /upload ----
     One paragraph, three sentences, one badge. They are asserted separately because they
     refuse three different things and a length pass takes sentences, not paragraphs: the
     first two have been on the page since the route was renamed off "Share a blueprint",
     and the third arrived with the skill. Every one of them is `open` — the paragraph sits
     above the wizard with nothing folded over it, and each qualifies a control printed in
     the open below it. */
  {
    surface: "/upload · the account the verb implies",
    why: "the route is called \"Upload blueprint\" and the word means the file goes somewhere and is kept. The author's own sketch of where this is heading — a repository you own, public or private — needs accounts, storage and a backend, and none of the three exists. Stating the direction is what earns the verb; leaving a reader to infer it from the verb is the failure",
    says: "not built yet: an account to upload into, with each blueprint public or private the way a repository is",
    where: "open",
    html: UPLOAD_PAGE,
  },
  {
    surface: "/upload · where the file actually goes",
    why: "the direction above is a promise about later, and on its own it leaves today unstated. This is the sentence about today, and it is the one that has twice been deleted from this route by a pass cutting for length (see the file header). `loadBundle` runs in the tab, so it is also simply true, and it has to be printed rather than demonstrated: a reader cannot see the absence of a network call",
    says: "there are no accounts and no backend: what you upload is read in this tab and stays in it",
    where: "open",
    html: UPLOAD_PAGE,
  },
  {
    surface: "/upload · no push from the editor the skill runs in",
    why: "added with the DarkPrint skill, and the reason it is a third sentence rather than a paraphrase of the second. The paragraph above it now tells a reader that a tool inside their own editor writes a folder for this page; the very next question anybody asks is whether the editor sends it, and a page that answers by saying nothing is answering yes. `/install` refuses the same thing at the other end of the same story",
    says: "nor is there a live push from the editor the skill runs in",
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

  /* ---- /build · the two exits (task 5) ---- */
  {
    surface: "/build · download exit (`DownloadStep`)",
    why: "the download exit hands over a folder that already carries an `AGENTS.md` and, as of task 5, says so out loud. A page that just told a reader their folder is agent-ready is the page likeliest to read as though the registry's own MCP call already exists, so the limit has to sit beside that claim rather than only on `/install`",
    says: "not built yet: your agent querying the registry over mcp for the blueprint that best fits a goal like this one",
    where: "open",
    html: DOWNLOAD_STEP,
  },
  {
    surface: "/build · agent-brief exit (`AgentHandoff`)",
    why: "the same limit on the exit that already asks an agent to act — the co-equal one, not a postscript to the download — so a reader who opens only this exit still meets it",
    says: "not built yet: your agent querying the registry over mcp for the blueprint that best fits a goal like this one",
    where: "open",
    html: AGENT_HANDOFF,
  },

  /* ---- / · the lifecycle beat's upload panel ---- */
  {
    surface: "/ · beat 4, the Upload panel's reason for existing",
    why: "the panel states a motive — other people reading the blueprint you proposed and answering it — and there is no backend, no publishing and no readership behind any part of it. The motive and the limit are one sentence on purpose: a reader who meets \"get feedback from other users\" as a separate, positive line will take it as live, and this is the landing, where most readers meet the idea first",
    says: "not built yet: the second reader. once a bundle can be published, other people can open the blueprint you proposed and tell you where it does not hold.",
    where: "open",
    html: LIFECYCLE,
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
      ["the four checks", WHICH_TASKS],
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
        "the absence of a finding here is silence, not a clean verdict",
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
