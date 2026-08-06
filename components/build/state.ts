/* ============================================================
   /build — one set of choices, resolved
   ------------------------------------------------------------
   Everything the workspace shows about a factory comes out of this
   function, and everything it produces comes out of `loadBundle`.
   No reading on `/build` is animated, interpolated or written into
   a string: the autonomy class, the security level, the findings,
   the diagnostics, the sentence under each one and the digest are
   the engine's, computed on the exact bytes the download hands
   over.

   ── Why it runs in the browser ──
   The site is static, so there is no request-time place to build a
   bundle, and the reader picks one of eighty. Precomputing all
   eighty finished states — six card documents, two DOTs, a README
   and an analysis each — is megabytes of page for a reader who will
   look at one. `buildStarterBundle` is pure and client-safe, and
   `/upload` already resolves a bundle in the tab, so the generator
   and the analyzer both run where the choice is made. Doc 1 §0.1.3
   keeps *execution* off the server; static analysis is not
   execution.

   ── One bundle per state, and it is the one that downloads ──
   This function used to take a second argument, `demo`, which set
   `criteriaVisibleToBuilder` on the bundle the panes drew while
   refusing to export any file from it: doc 2 §5.4's demonstration
   switch lived on a step and had to be unable to reach a download.
   The steps are gone (restructure spec §2.1) and so is the switch,
   so there is now exactly one bundle per set of choices and the
   reader is looking at the bytes they are about to take away.
   `lib/starter/variants.ts` still knows how to write the leaked
   graph; the surface that asks it to is `/what-it-isnt`, through
   `components/explain/starter-isolation.ts`.
   ============================================================ */

import {
  CORE_ONTOLOGY,
  loadBundle,
  ontologyView,
  type BlueprintAnalysis,
  type Bundle,
  type Diagnostic,
  type ResolvedBlueprint,
} from "@/lib/core";
import { exportBundle, type ExportedFile } from "@/lib/content/bundle-export";
import { graphForBlueprint } from "@/lib/graph-seed";
import {
  buildStarterBundle,
  starterRunBudget,
  type StarterChoices,
  type StarterRunBudget,
} from "@/lib/starter/variants";
import type { BlueprintGraph } from "@/lib/types";
import {
  buildPaneModel,
  type PaneAbsenceInput,
  type PaneNodeInput,
} from "@/components/panes/build";
import type { PaneModel } from "@/components/panes/model";
import { LEAK_EDGE } from "./choices";

/**
 * One vocabulary view for the tab.
 *
 * `ontologyView(CORE_ONTOLOGY)` with no local extensions, and `workspace.test.ts` verifies
 * every variant against exactly this. The generated cards declare only curated terms, so the
 * browser and the build agree on every score by construction rather than by coincidence,
 * and the folder the workspace hands over needs no vocabulary file to reproduce its own
 * numbers (`lib/content/bundle-export.ts` writes one only for a bundle that declares a
 * local term).
 */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** Everything the workspace renders for one combination of choices. */
export interface BuildState {
  /** The bundle the reader is looking at, which is the bundle the files come from. */
  bundle: Bundle;
  blueprint?: ResolvedBlueprint;
  analysis?: BlueprintAnalysis;
  diagnostics: readonly Diagnostic[];
  /**
   * The error-severity half of `diagnostics`, which is the half that decides whether this
   * bundle is a thing anybody could publish.
   *
   * Empty for all eighty combinations, and two things keep it that way rather than one:
   * `workspace.test.ts` walks the enumeration through this function, and
   * `app/build/page.tsx` walks it again through `loadBundle` at build time and throws on a
   * single error-severity diagnostic. So the non-empty branch is unreachable in a shipped
   * build by construction. It is still carried, and `ScorePanel` still prints it above the
   * readings, because the alternative is a page that would score a graph the engine had
   * refused: `loadBundle` is the authority on that, not this file, and if it ever refuses
   * one of the eighty the workspace has to say so rather than report a level.
   */
  errors: readonly Diagnostic[];
  graph?: BlueprintGraph;
  paneModel?: PaneModel;
  /** The files of the artefact, exported from the bundle above and no other. */
  files: readonly ExportedFile[];
  /** What the cap bounds, in whole numbers taken off the graph. */
  budget: StarterRunBudget;
}

/**
 * The absence doc 2 §5.1 asks to be shown on three representations at once.
 *
 * Guarded on both endpoints being in the graph, like `absencesFor` in the archive's own
 * view: an absence declared between nodes one of which is not drawn would put a ghost row
 * under a reading that has nowhere to anchor it. Every bundle this file resolves has the
 * edge missing, which is the whole of doc 2 §5.2, so there is no second branch here any
 * more; the one that used to exist returned nothing while the demonstration switch was on
 * and the statement really was in the file.
 */
function absences(nodeIds: readonly string[]): PaneAbsenceInput[] {
  const present = new Set(nodeIds);
  if (!present.has(LEAK_EDGE.source) || !present.has(LEAK_EDGE.target)) return [];
  return [
    {
      id: "criteria-to-builder",
      label: `${LEAK_EDGE.source} ⇢ ${LEAK_EDGE.target}`,
      detail:
        "The acceptance criteria leave the planner for the tester and go nowhere else. No edge carries them to the node that writes the work.",
      edge: { source: LEAK_EDGE.source, target: LEAK_EDGE.target },
    },
    {
      id: "criteria-in-spec",
      label: "the criteria, in the prose",
      detail:
        "An absent edge is isolation only when the content is absent too. This spec names no criterion and quotes no threshold, so the check has nothing to find on the card either.",
      field: { nodeId: LEAK_EDGE.target, key: "spec" },
    },
  ];
}

/**
 * One combination of choices, resolved into everything the workspace shows.
 *
 * Total: a bundle the engine cannot resolve comes back with its diagnostics and no
 * blueprint rather than throwing, so the page can say what went wrong. `app/build/page.tsx`
 * walks all eighty combinations at build time and fails the build on any of them, which is
 * what makes that branch unreachable in a shipped build; this is what makes it legible if
 * it ever is not.
 */
export function buildState(choices: StarterChoices): BuildState {
  const bundle = buildStarterBundle(choices);
  const result = loadBundle(bundle, { ontology: ONTOLOGY });

  const state: BuildState = {
    bundle,
    diagnostics: result.diagnostics,
    errors: result.diagnostics.filter((d) => d.severity === "error"),
    files: [],
    budget: starterRunBudget(choices),
  };
  if (result.blueprint === undefined || result.analysis === undefined) return state;

  const blueprint = result.blueprint;
  state.blueprint = blueprint;
  state.analysis = result.analysis;
  state.graph = graphForBlueprint(blueprint);

  const paneNodes: PaneNodeInput[] = blueprint.nodes.map((node) => {
    const entry: PaneNodeInput = {
      nodeId: node.nodeId,
      label: node.card.name,
      ref: node.ref,
      card: node.card,
    };
    const yaml = bundle.cardFiles[`cards/${node.ref}.yaml`];
    if (yaml !== undefined) entry.yaml = yaml;
    return entry;
  });

  state.paneModel = buildPaneModel({
    slug: blueprint.manifest.slug,
    title: blueprint.manifest.title,
    dot: blueprint.dot,
    nodes: paneNodes,
    absences: absences(blueprint.nodes.map((node) => node.nodeId)),
  });

  // The artefact, and only from the bundle the reader chose. `exportBundle` is the same
  // function the archive's own downloads go through, so a factory built here and a
  // blueprint pulled from the gallery are the same kind of folder.
  state.files = exportBundle({
    blueprint,
    analysis: result.analysis,
    cards: Object.entries(bundle.cardFiles).map(([file, text]) => ({
      ref: file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
      text,
    })),
  });
  return state;
}

/* --------------------- the counterfactual behind the cap --------------------- */

/** What the analyzer reads when the loop declares no cap at all. */
export interface UncappedReading {
  level: number;
  /** The engine's own sentence for that score. */
  rationale: string;
}

/**
 * One card document with its iteration cap taken out.
 *
 * `undefined` when the document declares none, so the caller can tell "nothing to remove"
 * from "removed". Only the cap line goes: `stop_on_repeated_evidence` and
 * `on_cap_exhausted` stay, because the question being asked is what an uncapped loop
 * scores and not what a card with no `params` scores.
 */
function withoutCap(text: string): string | undefined {
  const lines = text.split("\n");
  const at = lines.findIndex((line) =>
    /^\s+(max_iterations|maxIterations|max_retries):/.test(line),
  );
  if (at < 0) return undefined;

  const out = [...lines];
  out.splice(at, 1);
  const params = out.findIndex((line) => /^params:\s*$/.test(line));
  if (params >= 0) {
    const next = out[params + 1];
    if (next === undefined || !/^\s+\S/.test(next)) out.splice(params, 1);
  }
  return out.join("\n");
}

/**
 * The security reading of the same factory with the cap removed, or `undefined`.
 *
 * Doc 2 §5.6 wanted the cap's own step to show that the cap is a trade rather than a dial
 * to turn up. That step is gone (restructure spec §2.1), and nothing on `/build` today
 * quotes this figure. Between 1 and 10 neither computed score moves, because a cap of 1
 * and a cap of 10 are both a cap; the figure that does move is what happens when there is
 * none, and doc 3 §4.1 charges `unbounded-loop` for it. That figure is the engine's, taken
 * here on a bundle assembled for the purpose and thrown away, exactly as
 * `components/explain/starter-isolation.ts` takes the criteria-leak figure.
 *
 * Total: a variant whose cards declare no cap, or one that fails to resolve once the cap
 * is gone, yields nothing and the sentence that would have quoted it is not written.
 *
 * No UI caller today. `GuidedPath.tsx` and `steps.tsx` were the only two, and both went
 * with the path; `workspace.test.ts` is the sole caller left, proving the cap-versus-
 * `unbounded-loop` claim stays true across all eight variants. Same standing as
 * `ChoiceGraphPane.tsx`'s `choice` slot (see its own doc comment): kept because the claim
 * is worth keeping proven and nothing currently pays for the alternative, not because
 * something on screen reads it — either the workspace should say this figure beside the
 * cap slider, or this function should go.
 */
export function uncappedReading(choices: StarterChoices): UncappedReading | undefined {
  const bundle = buildStarterBundle(choices);

  const cardFiles: Record<string, string> = {};
  let removed = false;
  for (const [file, text] of Object.entries(bundle.cardFiles)) {
    const stripped = withoutCap(text);
    if (stripped === undefined) {
      cardFiles[file] = text;
      continue;
    }
    cardFiles[file] = stripped;
    removed = true;
  }
  if (!removed) return undefined;

  const result = loadBundle({ ...bundle, cardFiles }, { ontology: ONTOLOGY });
  if (result.analysis === undefined) return undefined;
  if (result.diagnostics.some((d) => d.severity === "error")) return undefined;
  return {
    level: result.analysis.security.level,
    rationale: result.analysis.security.rationale,
  };
}
