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
import InstallPage, { metadata as installMetadata } from "@/app/install/page";
import { allBlueprints } from "@/lib/content";
import { CARD_ROWS } from "@/components/spec/rows";
import { ScoringModel } from "@/components/spec/ScoringModel";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
import { BlueprintCanvas } from "@/components/blueprint/BlueprintCanvas";
import { AgentHandoff } from "@/components/build/AgentHandoff";
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
 * The scoring panel `/spec/scoring` mounts (PROJECT.md §3.4; moved off `/spec` onto its
 * own route by the lifecycle-scoring pass, spec §4 — `ScoringModel` itself is unchanged
 * and this still renders it directly, so the assertions below hold regardless of which
 * route mounts it).
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
 * The starter is the one bundle whose criteria walk stops at a judge
 * (`analysis/criteria-relayed-through-judge`), so it is the only page carrying the
 * feedback-against-gaming statement. Asserted rather than assumed, below.
 */
const STARTER = canvas("starter-software-factory");

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
    surface: "/spec/card · checked against the graph, or shown to a reader",
    why: "half of the page's thesis. Panel B asserts the free-text entry is legitimate; without this the symmetry has one side, and an entry nothing checks reads as an entry that failed",
    says: "both are legitimate, and a reader has to be able to tell which is which without running anything",
    where: "open",
    html: SPEC_CARD,
  },
  {
    surface: "/spec/card · the resolver's own sentence",
    why: 'the severity of the refusal in word form. It used to be in the prose ("at error severity"); after the length pass the only word form left was inside an `<svg>` plate and inside the folded field table',
    says: "error bundle/prohibition-violated",
    where: "open",
    html: SPEC_CARD,
  },

  /* ---- /spec/scoring ---- */
  {
    surface: "/spec · cost and time, if they are ever reported",
    why: "the whole telemetry block is a design nothing implements. `minRuns 5` and `outlierZScore 3` are printed as engine configuration, which is what every other number in that section is, and those two are filters on a pipeline that has never had an input. PROJECT.md §3.5 is the point at which this stops being free, so the sentence has to be beside the numbers rather than behind a disclosure",
    says: "nothing on this site measures a run, so these two filters describe a design rather than a behaviour",
    where: "open",
    html: SCORING,
  },

  /* ---- /towards-a-dark-factory/which-tasks ---- */
  {
    surface: "/towards-a-dark-factory/which-tasks · check 01",
    why: "the tester's structural position, which is why a task with no verdict is a veto rather than a caution. A grep for \"release gate\" over the built site returns one hit, and it describes the starter's wiring rather than the tester",
    says: "the tester is the one node standing between generated code and the release gate",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory/which-tasks · check 01",
    why: "what a rubber-stamping tester costs. The examples above say the tester passes whatever it is given; nothing else says what that makes the graph",
    says: "an expensive way to run one prompt",
    where: "present",
    html: WHICH_TASKS,
  },
  {
    surface: "/towards-a-dark-factory/which-tasks · check 03",
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
];

describe("the surfaces the ledger is read off", () => {
  it("rendered something on each of them", () => {
    // A ledger held over an empty string passes every case in it.
    for (const [name, html] of [
      ["/spec/card", SPEC_CARD],
      ["/spec scoring panel", SCORING],
      ["which-tasks checks", WHICH_TASKS],
      ["the starter's canvas", STARTER],
      ["/build · download exit", DOWNLOAD_STEP],
      ["/build · agent-brief exit", AGENT_HANDOFF],
    ] as const) {
      expect(html.length, name).toBeGreaterThan(2000);
    }
    expect(BLUEPRINTS.length).toBe(9);
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
