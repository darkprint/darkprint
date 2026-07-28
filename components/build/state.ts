/* ============================================================
   The guided path — one set of choices, resolved
   ------------------------------------------------------------
   Everything the path shows about a factory comes out of this
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

   ── The switch is not a choice ──
   Doc 2 §5.3 and §5.4: a demonstration and a decision must never
   mix. `criteriaVisibleToBuilder` is set on the bundle the panes
   draw and never on the bundle the files come from, so the edge
   cannot reach a download however the reader leaves the step.
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
 * `ontologyView(CORE_ONTOLOGY)` with no local extensions, and `path.test.ts` verifies every
 * variant against exactly this. The generated cards declare only curated terms, so the
 * browser and the build agree on every score by construction rather than by coincidence,
 * and the folder the path hands over needs no vocabulary file to reproduce its own numbers
 * (`lib/content/bundle-export.ts` writes one only for a bundle that declares a local term).
 */
const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** Everything the path renders for one combination of choices. */
export interface BuildState {
  /** The bundle the reader is looking at. Carries the demonstration edge while it is on. */
  bundle: Bundle;
  blueprint?: ResolvedBlueprint;
  analysis?: BlueprintAnalysis;
  diagnostics: readonly Diagnostic[];
  /**
   * The error-severity half of `diagnostics`, which is the half that decides whether this
   * bundle is a thing anybody could publish.
   *
   * Non-empty exactly while doc 2 §5.4's switch is on. The builder's card declares
   * `cannot: [acceptance-criteria]` and the demonstration edge carries that type, so the
   * bundle behind the switch does not resolve — and the builder card the reader is looking
   * at in pane 4 says so in its own `notes`, which is why the panel beside it cannot
   * report a security level and stop there. Empty for all eighty real combinations, and
   * `path.test.ts` walks them to keep it that way.
   */
  errors: readonly Diagnostic[];
  graph?: BlueprintGraph;
  paneModel?: PaneModel;
  /** The files of the artefact. Empty while the switch is on, because that is not it. */
  files: readonly ExportedFile[];
  /** What the cap bounds, in whole numbers taken off the graph. */
  budget: StarterRunBudget;
  /** True while doc 2 §5.4's switch is on. Nothing persisted is derived from it. */
  demo: boolean;
}

/**
 * The absence doc 2 §5.1 asks to be shown on three representations at once.
 *
 * Declared only while the edge really is missing. With the switch on the statement is in
 * the file, so a ghost row would contradict the line three rows above it and the "not
 * drawn" group would list an edge the drawing draws. Guarded on both endpoints being in
 * the graph, like `absencesFor` in the archive's own view.
 */
function absences(nodeIds: readonly string[], leaked: boolean): PaneAbsenceInput[] {
  if (leaked) return [];
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
 * One combination of choices, resolved into everything the path shows.
 *
 * Total: a bundle the engine cannot resolve comes back with its diagnostics and no
 * blueprint rather than throwing, so the page can say what went wrong. `app/build/page.tsx`
 * walks all eighty combinations at build time and fails the build on any of them, which is
 * what makes that branch unreachable in a shipped build; this is what makes it legible if
 * it ever is not.
 */
export function buildState(choices: StarterChoices, demo = false): BuildState {
  const bundle = buildStarterBundle(
    demo ? { ...choices, criteriaVisibleToBuilder: true } : choices,
  );
  const result = loadBundle(bundle, { ontology: ONTOLOGY });

  const state: BuildState = {
    bundle,
    diagnostics: result.diagnostics,
    errors: result.diagnostics.filter((d) => d.severity === "error"),
    files: [],
    budget: starterRunBudget(choices),
    demo,
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
    absences: absences(
      blueprint.nodes.map((node) => node.nodeId),
      demo,
    ),
  });

  // The artefact, and only from the bundle the reader chose. `exportBundle` is the same
  // function the archive's own downloads go through, so a factory built here and a
  // blueprint pulled from the gallery are the same kind of folder.
  if (!demo) {
    state.files = exportBundle({
      blueprint,
      analysis: result.analysis,
      cards: Object.entries(bundle.cardFiles).map(([file, text]) => ({
        ref: file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
        text,
      })),
    });
  }
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
 * Doc 2 §5.6 wants the last step to show that the cap is a trade rather than a dial to
 * turn up. Between 1 and 10 neither computed score moves, because a cap of 1 and a cap of
 * 10 are both a cap; the figure that does move is what happens when there is none, and doc
 * 3 §4.1 charges `unbounded-loop` for it. That figure is the engine's, taken here on a
 * bundle assembled for the purpose and thrown away, exactly as `/what-it-isnt` takes the
 * criteria-leak figure.
 *
 * Total: a variant whose cards declare no cap, or one that fails to resolve once the cap
 * is gone, yields nothing and the sentence that would have quoted it is not written.
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
