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
import TheClimbPage from "@/app/towards-a-dark-factory/the-climb/page";
import InstallPage, { metadata as installMetadata } from "@/app/install/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
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
 * The one page whose whole subject is a capability that does not exist yet — an MCP
 * server. `InstallTabs`'s own `ComingSoonBadge` says so beside the config it previews,
 * but a badge is not a sentence; this is the page's lead, asserted so the disclaimer
 * cannot go missing from `/install` the way it went missing from other pages before
 * (see the file header).
 */
const INSTALL_PAGE = renderToStaticMarkup(createElement(InstallPage as never));
/**
 * `/install`'s `<head>` description, not its rendered body.
 *
 * A search result or a shared link quotes this string, never the JSX `INSTALL_PAGE`
 * renders — `renderToStaticMarkup` walks the component tree, not the sibling `Metadata`
 * export, so a claim held only over `INSTALL_PAGE` can go missing here without a single
 * assertion noticing. `openText`/`plainText` pass a plain string through unchanged (there
 * is no tag to strip), so the same ledger mechanism covers it with no new machinery.
 */
const INSTALL_METADATA_DESCRIPTION = installMetadata.description ?? "";
const WHICH_TASKS = renderToStaticMarkup(createElement(WhichTasksChecks));
/**
 * The last page of the climb route, whole, for the one paragraph that says what this site
 * is not.
 *
 * It was guarded by a source comment reading "Do not fold it" and by nothing else. That
 * comment is the only reason it survived two length passes: `/what-it-isnt` carried the
 * other copy of the same statement and was deleted with the route, so this is now the sole
 * place the route says there are no accounts, nothing publishes and there is no MCP server
 * — on the page of the two most likely to read as a pitch, since it is the one that
 * narrates a working pipeline for four sections before it gets there. A comment is not a
 * guard. This is.
 *
 * The whole page rather than a component, because the paragraph is written in the page and
 * extracting it into a component to make it testable would move the sentence for the
 * test's convenience, which is how a claim ends up somewhere nobody reads it.
 */
const THE_CLIMB = renderToStaticMarkup(createElement(TheClimbPage as never));
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

  /* ---- /towards-a-dark-factory/the-climb ---- */
  {
    surface: "/towards-a-dark-factory/the-climb · the closing section",
    why: "the only place the climb route states its limits. `/what-it-isnt` carried the other copy and was deleted with the route, and this paragraph closes the one page on the site that narrates a working autonomous pipeline for four sections — an account of somebody else's factory read as a description of this one is the exact misreading doc 2 §0.4 exists to stop. It sits in the open under two buttons, so it qualifies something printed in the open and has to be printed in the open with it",
    says: "publishing is not built, there are no accounts, no votes and no telemetry, and there is no mcp server to point a client at yet",
    where: "open",
    html: THE_CLIMB,
  },

  /* ---- /install ---- */
  {
    surface: "/install · the page's own lead sentence",
    why: "doc 2 §0.4's disclaimer on the page a reader lands on specifically to set up MCP access. A tab strip previewing a client config reads as something to run unless the page says, in the open and beside it, that nothing here is live yet",
    says: "not built yet: this is what setup will look like once the registry has an mcp server to point a client at",
    where: "open",
    html: INSTALL_PAGE,
  },
  {
    surface: "/install · metadata.description",
    why: "the same disclaimer where a reader who never opens the page reads it — a search result, a shared link's preview card, a browser history entry. Doc 2 §0.4 does not stop at the rendered body; the finding this guards was that the description could drop the qualifier and nothing would fail",
    says: "not built yet: nothing here runs",
    where: "open",
    html: INSTALL_METADATA_DESCRIPTION,
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
      ["/towards-a-dark-factory/the-climb", THE_CLIMB],
      ["the starter's canvas", STARTER],
      ["/build · download exit", DOWNLOAD_STEP],
      ["/build · agent-brief exit", AGENT_HANDOFF],
      ["/ · the lifecycle beat", LIFECYCLE],
    ] as const) {
      expect(html.length, name).toBeGreaterThan(2000);
    }
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
