/* ============================================================
   The guided path, walked end to end
   ------------------------------------------------------------
   Doc 2 §5.7: "Tutte e 8 devono produrre una fabbrica scaricabile
   e funzionante. Da esplicitare, altrimenti si testano i percorsi
   principali e i restanti si rompono in silenzio." So this walks
   the enumeration rather than a sample, and it walks the whole of
   it: eight structural variants at each of ten caps, because the
   cap changes the card the run is bounded by and the `max_retries`
   written into the runnable DOT, which makes it a different file
   even though it is the same graph.

   Four things are asserted of every combination, and each maps to
   a promise the page makes on screen:

     1. it resolves through the real engine with no error;
     2. `exportBundle` produces the four kinds of file, and the
        emitted `factory.dot` survives `parseDot` + `lintAttractor`,
        which is what Attractor itself runs before it will execute
        a pipeline;
     3. doc 2 §5.2's isolation holds, on the topology and in the
        prose;
     4. doc 2 §1.1 holds in the copy: no evaluative language about
        the autonomy level anywhere the reader can see it.

   The last one reaches into the step prose, because that is where
   §1.1 is most easily lost and the hardest thing to notice going.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CORE_ONTOLOGY,
  hasErrors,
  lintAttractor,
  loadBundle,
  ontologyView,
  parseDot,
  readIterationCap,
} from "@/lib/core";
import {
  BUNDLE_README,
  FACTORY_DOT,
  TOPOLOGY_DOT,
  exportBundle,
} from "@/lib/content/bundle-export";
import {
  MAX_ITERATIONS,
  MIN_ITERATIONS,
  STARTER_VARIANTS,
  buildStarterBundle,
  starterRunBudget,
  starterSlug,
} from "@/lib/starter/variants";
import { autonomyStatement } from "@/lib/format";
import { ALL_COMBINATIONS, APPROVAL_OPTIONS, OUTPUT_OPTIONS } from "./choices";
import { buildState, uncappedReading } from "./state";
import { STEPS } from "./steps";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

function label(choices: (typeof ALL_COMBINATIONS)[number]): string {
  return `${starterSlug(choices)} @ cap ${choices.maxIterations}`;
}

/* --------------------- the enumeration --------------------- */

describe("the choice space", () => {
  it("is the eight structural variants at every cap", () => {
    const caps = MAX_ITERATIONS - MIN_ITERATIONS + 1;
    expect(STARTER_VARIANTS).toHaveLength(8);
    expect(OUTPUT_OPTIONS).toHaveLength(4);
    expect(APPROVAL_OPTIONS).toHaveLength(2);
    expect(ALL_COMBINATIONS).toHaveLength(8 * caps);
    expect(new Set(ALL_COMBINATIONS.map(label)).size).toBe(ALL_COMBINATIONS.length);
  });

  it("offers every output kind and every approval mode the generator knows", () => {
    expect(OUTPUT_OPTIONS.map((o) => o.id).sort()).toEqual(
      [...new Set(STARTER_VARIANTS.map((v) => v.output))].sort(),
    );
    expect(APPROVAL_OPTIONS.map((a) => a.id).sort()).toEqual(
      [...new Set(STARTER_VARIANTS.map((v) => v.approval))].sort(),
    );
  });
});

/* --------------------- every combination is a working factory --------------------- */

describe("every combination the path can produce", () => {
  it.each(ALL_COMBINATIONS.map((choices) => [label(choices), choices] as const))(
    "%s resolves with no error and exports a runnable factory",
    (_name, choices) => {
      const state = buildState(choices, false);

      expect(hasErrors(state.diagnostics)).toBe(false);
      expect(state.blueprint).toBeDefined();
      expect(state.analysis).toBeDefined();
      expect(state.graph).toBeDefined();
      expect(state.paneModel).toBeDefined();

      // The four kinds of file the download promises.
      const paths = state.files.map((file) => file.path);
      expect(paths).toContain(FACTORY_DOT);
      expect(paths).toContain(TOPOLOGY_DOT);
      expect(paths).toContain(BUNDLE_README);
      expect(paths.filter((path) => path.startsWith("cards/")).length).toBe(
        state.blueprint?.nodes.length,
      );

      // The claim the page cannot check for the reader: it runs from a command line.
      // Attractor parses and lints before it executes, so a file that fails either check
      // would fail on their machine, and it fails here instead.
      const factory = state.files.find((file) => file.path === FACTORY_DOT);
      expect(factory).toBeDefined();
      const parsed = parseDot(factory?.text ?? "", FACTORY_DOT);
      expect(parsed.graph).toBeDefined();
      expect(hasErrors(parsed.diagnostics)).toBe(false);
      expect(lintAttractor(parsed.graph!, factory?.text ?? "", FACTORY_DOT)).toEqual([]);

      // The cap the reader chose is the cap the artefact carries.
      expect(factory?.text).toContain(`max_retries=${choices.maxIterations}`);
    },
  );

  it("puts the chosen cap on the debugger card of every combination", () => {
    for (const choices of ALL_COMBINATIONS) {
      const state = buildState(choices, false);
      const node = state.blueprint?.nodes.find((n) => n.nodeId === "debugger");
      expect(node, label(choices)).toBeDefined();
      expect(readIterationCap(node?.card.params ?? {}), label(choices)).toBe(
        choices.maxIterations,
      );
    }
  });

  it("declares a progress criterion and an escalation rule alongside the cap", () => {
    // Doc 2 §5.5 asks for three things, and the loop step says which of them the analyzer
    // can see. The step's prose reads the other two off `params`; if the generator stops
    // writing them the prose falls back to a weaker sentence, and this is the test that
    // notices rather than the reader.
    for (const choices of ALL_COMBINATIONS) {
      const state = buildState(choices, false);
      const params =
        state.blueprint?.nodes.find((n) => n.nodeId === "debugger")?.card.params ?? {};
      expect(params.stop_on_repeated_evidence, label(choices)).toBeDefined();
      expect(params.on_cap_exhausted, label(choices)).toBeDefined();
    }
  });
});

/* --------------------- isolation, both halves --------------------- */

describe("the lesson the path is built on", () => {
  it("keeps the criteria away from the builder in all eight variants", () => {
    for (const variant of STARTER_VARIANTS) {
      const choices = { ...variant, maxIterations: 3 };
      const state = buildState(choices, false);
      const security = state.analysis?.security;
      expect(security, starterSlug(variant)).toBeDefined();
      expect(
        security?.findings.filter((f) => f.marker === "criteria-leak"),
        starterSlug(variant),
      ).toEqual([]);
      expect(state.bundle.dot, starterSlug(variant)).not.toContain("planner -> builder");
    }
  });

  it("shows the gap on all three representations while it is a gap", () => {
    const state = buildState({ output: "python", approval: "tester", maxIterations: 3 });
    const model = state.paneModel;
    expect(model).toBeDefined();
    // Pane 1's "not drawn" group, pane 3's ghost row, pane 2 and 4's field anchor.
    const edge = model?.absences.find((a) => a.id === "criteria-to-builder");
    expect(edge?.edge).toEqual({ source: "planner", target: "builder" });
    expect(edge?.dot?.afterLine).toBeGreaterThan(0);
    const prose = model?.absences.find((a) => a.id === "criteria-in-spec");
    expect(prose?.field).toEqual({ nodeId: "builder", key: "spec" });
  });

  it("fires criteria-leak with the switch on, and never in the artefact", () => {
    const choices = { output: "python", approval: "tester", maxIterations: 3 } as const;
    const clean = buildState(choices, false);
    const leaked = buildState(choices, true);

    const before = clean.analysis?.security;
    const after = leaked.analysis?.security;
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after?.findings.some((f) => f.marker === "criteria-leak")).toBe(true);
    expect(after?.findings.some((f) => f.nodeId === "builder")).toBe(true);
    // The demonstration costs points. Which points is the engine's business, so this
    // asserts the direction and not a figure.
    expect(after!.level).toBeLessThan(before!.level);

    // Doc 2 §5.4 and §5.3: the switch must not be persistable. The leaked state offers no
    // files at all, and the artefact for the same choices does not carry the edge.
    expect(leaked.files).toEqual([]);
    expect(leaked.bundle.dot).toContain("planner  -> builder");
    expect(clean.bundle.dot).not.toContain("planner  -> builder");
    for (const file of clean.files) expect(file.text).not.toContain("planner  -> builder");
  });

  /**
   * The other half of what the switch does, which the panel was not reading.
   *
   * `code-builder@1.0.0` declares `cannot: [acceptance-criteria]`, so the demonstration
   * edge does not merely cost security points: it makes the bundle fail to resolve. The
   * card the reader is looking at in pane 4 says so on its own `notes` — "an edge carrying
   * the criteria into this node fails the bundle with `bundle/prohibition-violated`,
   * whatever the prose says" — while the panel beside it reported a level and stopped, so
   * the two contradicted each other on one screen.
   *
   * `BuildState.errors` is what closes that, and it is asserted on all eight variants
   * rather than on the one the sibling test above uses: the prohibition is a property of
   * the builder's card, which every variant has its own copy of.
   */
  it("refuses the bundle behind the switch, in all eight variants", () => {
    for (const variant of STARTER_VARIANTS) {
      const choices = { ...variant, maxIterations: 3 };
      const clean = buildState(choices, false);
      const leaked = buildState(choices, true);
      const where = starterSlug(variant);

      // The artefact resolves. Anything else and the path hands out a broken factory.
      expect(clean.errors, `${where} clean`).toEqual([]);

      expect(
        leaked.errors.map((d) => d.code),
        `${where} leaked`,
      ).toContain("bundle/prohibition-violated");
      const violation = leaked.errors.find(
        (d) => d.code === "bundle/prohibition-violated",
      );
      expect(violation?.message).toContain("builder");
      expect(violation?.message).toContain("acceptance-criteria");

      // `errors` is the error-severity half of `diagnostics` and never a separate list.
      expect(leaked.errors).toEqual(
        leaked.diagnostics.filter((d) => d.severity === "error"),
      );
      expect(hasErrors(leaked.diagnostics)).toBe(true);
    }
  });
});

/* --------------------- what the cap moves, and what it does not --------------------- */

describe("the iteration cap", () => {
  it("moves neither computed score between the ends of the slider", () => {
    for (const variant of STARTER_VARIANTS) {
      const low = buildState({ ...variant, maxIterations: MIN_ITERATIONS });
      const high = buildState({ ...variant, maxIterations: MAX_ITERATIONS });
      expect(low.analysis?.autonomy.level, starterSlug(variant)).toBe(
        high.analysis?.autonomy.level,
      );
      expect(low.analysis?.security.level, starterSlug(variant)).toBe(
        high.analysis?.security.level,
      );
    }
  });

  it("moves the run budget on every notch", () => {
    const seen = new Set<number>();
    for (let cap = MIN_ITERATIONS; cap <= MAX_ITERATIONS; cap += 1) {
      const budget = starterRunBudget({ output: "python", approval: "tester", maxIterations: cap });
      expect(budget.maxIterations).toBe(cap);
      seen.add(budget.modelCallsAtMost);
    }
    expect(seen.size).toBe(MAX_ITERATIONS - MIN_ITERATIONS + 1);
  });

  it("is what stands between the loop and an unbounded-loop charge", () => {
    // The one figure the loop step quotes that is not on the slider. It has to be the
    // engine's, and it has to be a real drop, or the sentence beside it is decoration.
    const choices = { output: "python", approval: "tester", maxIterations: 3 } as const;
    const capped = buildState(choices).analysis?.security;
    const uncapped = uncappedReading(choices);
    expect(capped).toBeDefined();
    expect(uncapped).toBeDefined();
    expect(uncapped!.level).toBeLessThan(capped!.level);
    expect(uncapped!.rationale).toContain("unbounded-loop");
  });
});

/* --------------------- doc 2 §1.1, in the copy --------------------- */

/**
 * The phrases §1.1 rules out, as they would actually be typed.
 *
 * Each is a specific way of turning a description into a grade. "out of 4" and "falls
 * short" put the level on a scale with a gap left to close; the comparative adverbs rank
 * the branches of choice 2 against each other; the rest are the sentences that make a
 * reader who put a person in their graph feel behind.
 *
 * Tailwind's opacity syntax (`bg-cyan/10`) is why the list carries no bare `"/4"`: it
 * would match `surface-2/40` in every file and catch nothing a reader can see.
 */
const FORBIDDEN = [
  "out of 4",
  "out of four",
  "score of 4",
  "fully autonomous",
  "not autonomous",
  "more autonomous",
  "less autonomous",
  "maximum autonomy",
  "highest level",
  "falls short",
  "fall short",
  "shortfall",
  "room for improvement",
  "should automate",
  "penalty",
  "penalis",
  "penaliz",
  "downgrade",
];

/** Every file whose strings a reader can end up looking at. */
const COPY_FILES = [
  "components/build/steps.tsx",
  "components/build/choices.ts",
  "components/build/ScorePanel.tsx",
  "components/build/controls.tsx",
  "components/build/GuidedPath.tsx",
  "components/build/DownloadStep.tsx",
  "components/build/ChoiceGraphPane.tsx",
  "app/build/page.tsx",
];

/**
 * Where the em-dash rule is enforced, as trees rather than as a list of files.
 *
 * The list below it used to be the whole of it: fifteen paths under `components/build`
 * and `components/panes`, named one at a time. Doc 2 §2.5 is a rule about the site's copy
 * and the constraint sheet cites this test as what keeps it, so a pass that wrote a new
 * landing, `/spec` and `/how-to-build-a-dark-factory` added several thousand words that
 * the guard could not see. A directory is added once and covers every file put in it
 * afterwards, which is the property a hardcoded list does not have.
 *
 * What is deliberately outside: `components/nodes`, `components/upload`,
 * `components/blueprint`, `app/ontology` and `app/nodes` carry em dashes in copy that
 * predates the rule, so adding them here would fail on text nobody in this pass wrote.
 * They are a copy edit, not a guard, and putting them in the list before the edit would
 * only produce a skipped test.
 */
const COPY_TREES = [
  "components/home",
  "components/hero",
  "components/spec",
  "components/howto",
  "components/viz",
  "components/explain",
  "components/site",
  "components/gallery",
];

/** Single files outside those trees, on the routes this rule was extended for. */
const COPY_PAGES = [
  "app/page.tsx",
  "app/spec/page.tsx",
  "app/how-to-build-a-dark-factory/page.tsx",
  "app/which-tasks/page.tsx",
  "app/what-it-isnt/page.tsx",
  "app/blueprints/page.tsx",
];

/**
 * Every `.ts`/`.tsx` under `dir`, tests excluded.
 *
 * A test that asserts on the character has to be able to name it, and three of them do
 * (`nodecard.test.ts`, `graph.test.ts` and this file). Including them would make the guard
 * report itself.
 */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(child));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(child);
  }
  return out;
}

/** Every file the em-dash rule is held over, deduplicated and stable. */
const EM_DASH_FILES = [
  ...new Set([
    ...COPY_FILES,
    "components/build/path-state.ts",
    "components/build/state.ts",
    "components/build/BuildPanes.tsx",
    "components/panes/GraphPane.tsx",
    "components/panes/SkeletonPane.tsx",
    "components/panes/SourcePane.tsx",
    "components/panes/SynchronisedPanes.tsx",
    ...COPY_TREES.flatMap(sourcesUnder),
    ...COPY_PAGES,
  ]),
].sort();

/**
 * Comments out, so what is left is roughly what a reader sees.
 *
 * A block comment is the house style for the header of every file here and a line comment
 * explains a decision beside it; neither is product copy, and both are allowed the
 * punctuation §2.5 keeps out of the page. The line-comment rule skips a `//` that follows
 * a colon or a quote, which is what a URL inside a string looks like.
 *
 * The block rule wants a whitespace or bracket boundary in front of the comment opener for
 * the same class of reason. `SpecLayers` names its figure with a glob over the card
 * directory, and that glob puts a slash-star inside a string literal: an opener with no
 * boundary in front of it matches there and swallows everything up to the next real
 * closer, which on that file is the caption and the whole of lane 1. A guard that is
 * silently blind over the span it ate is the worst way for a check to fail, and this rule
 * was just extended to cover exactly that file.
 */
function visibleCopy(source: string): string {
  return source
    .replace(/(^|[\s{(=,])\/\*[\s\S]*?\*\//g, "$1")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * A lone em dash standing in for an empty cell, removed before the pause check.
 *
 * §2.5 rules out the em dash "usato come pausa", and a pause has text on at least one side
 * of it. `{edge.label ?? "—"}` puts the character in a table cell that has nothing in it,
 * which is a glyph and not a sentence: `SectionAbsentEdge` and the security ledger both
 * write one. Only the exact one-character string is stripped, so `"— and then"` is still
 * caught.
 */
function withoutPlaceholders(source: string): string {
  return source.replace(/"—"/g, '""').replace(/>\s*—\s*</g, "><");
}

describe("autonomy is a description, not a verdict", () => {
  it.each(COPY_FILES)("%s carries no evaluative language about the level", (path) => {
    // Through `visibleCopy`, like the em-dash check below: the rule is about what a reader
    // sees. A comment quoting §5.3's "must not read as a penalty" is the rule being
    // honoured, and reading it as a breach would push the next author to stop writing the
    // reason down.
    const text = visibleCopy(readFileSync(join(process.cwd(), path), "utf8")).toLowerCase();
    for (const phrase of FORBIDDEN) {
      expect(text, `${path} contains "${phrase}"`).not.toContain(phrase);
    }
  });

  /**
   * Doc 2 §2.5: "trattini lunghi usati come pausa" is one of the four AI-writing patterns
   * to strip from the site's text, and the audience is developers who recognise them. The
   * panel shipped one, between a status token and the sentence explaining it.
   */
  it("covers the surfaces this pass wrote, not a list somebody has to remember", () => {
    // A walk that matched nothing passes every case below. These four are the routes the
    // guard was extended for, and the landing sections are the bulk of the new copy.
    expect(EM_DASH_FILES.length).toBeGreaterThan(40);
    for (const path of [
      "app/page.tsx",
      "app/spec/page.tsx",
      "app/how-to-build-a-dark-factory/page.tsx",
      "components/home/SectionLevels.tsx",
      "components/spec/SpecLayers.tsx",
      "components/viz/Glyphs.tsx",
    ]) {
      expect(EM_DASH_FILES, `${path} is not guarded`).toContain(path);
    }
  });

  it.each(EM_DASH_FILES)(
    "%s uses no em dash as a pause in what a reader sees",
    (path) => {
      const text = withoutPlaceholders(
        visibleCopy(readFileSync(join(process.cwd(), path), "utf8")),
      );
      const offending = text
        .split("\n")
        .map((line, i) => ({ line: line.trim(), at: i + 1 }))
        .filter((entry) => entry.line.includes("—"));
      expect(offending.map((e) => `${path}:${e.at}  ${e.line}`)).toEqual([]);
    },
  );

  it("describes both branches of choice 2 without recommending one", () => {
    for (const option of APPROVAL_OPTIONS) {
      expect(option.hint).not.toMatch(/better|best|prefer|recommend|ideal|stronger/i);
    }
    // Both hints state who acts, at comparable length. A one-word row beside a three-line
    // row is a recommendation made with whitespace.
    const [a, b] = APPROVAL_OPTIONS.map((option) => option.hint.length);
    expect(Math.abs(a - b)).toBeLessThan(40);
  });

  it("puts a human gate and a closed loop in the same shape of graph", () => {
    // Doc 2 §1.1's structural claim: choosing the approver produces a factory that is
    // complete, downloadable and runnable, exactly like the other one. If it ever stops
    // being so, the neutral copy above becomes a lie.
    for (const output of OUTPUT_OPTIONS.map((o) => o.id)) {
      const withHuman = buildState({ output, approval: "human", maxIterations: 3 });
      const without = buildState({ output, approval: "tester", maxIterations: 3 });
      expect(hasErrors(withHuman.diagnostics), output).toBe(false);
      expect(hasErrors(without.diagnostics), output).toBe(false);
      for (const state of [withHuman, without]) {
        const paths = state.files.map((file) => file.path);
        expect(paths, output).toContain(FACTORY_DOT);
        expect(paths, output).toContain(TOPOLOGY_DOT);
        expect(paths, output).toContain(BUNDLE_README);
      }
      expect(
        withHuman.analysis?.autonomy.contributions.filter((c) => c.requiresHuman),
        output,
      ).toHaveLength(1);
      expect(
        without.analysis?.autonomy.contributions.filter((c) => c.requiresHuman),
        output,
      ).toHaveLength(0);
    }
  });
});

/* --------------------- the path itself --------------------- */

describe("the steps", () => {
  it("run whole → part → whole, with the loop last before the download", () => {
    const ids = STEPS.map((step) => step.id);
    expect(ids[0]).toBe("whole");
    expect(ids[1]).toBe("node");
    // Doc 2 §5.3: the output kind comes first of the three choices.
    expect(ids.indexOf("output")).toBeLessThan(ids.indexOf("approval"));
    expect(ids.indexOf("approval")).toBeLessThan(ids.indexOf("loop"));
    // §5.4 sits where the reader is already on the builder and the tester.
    expect(ids.indexOf("switch")).toBeGreaterThan(ids.indexOf("node"));
    expect(ids.indexOf("switch")).toBeLessThan(ids.indexOf("loop"));
    // §5.6: the loop is the finale, and the download closes the path.
    expect(ids[ids.length - 1]).toBe("download");
  });

  it("hangs every choice on a node the graph actually has", () => {
    const state = buildState({ output: "python", approval: "tester", maxIterations: 3 });
    const ids = new Set(state.blueprint?.nodes.map((node) => node.nodeId) ?? []);
    for (const step of STEPS) {
      if (step.choiceNode === undefined) continue;
      expect(ids.has(step.choiceNode), step.id).toBe(true);
    }
  });
});

/* --------------------- the README the reader takes away --------------------- */

describe("the exported README", () => {
  it("quotes the engine rather than paraphrasing it, for every variant", () => {
    for (const variant of STARTER_VARIANTS) {
      const choices = { ...variant, maxIterations: 3 };
      const state = buildState(choices);
      const readme = state.files.find((file) => file.path === BUNDLE_README);
      expect(readme, starterSlug(variant)).toBeDefined();
      const text = readme?.text ?? "";
      // Autonomy is quoted through `autonomyStatement`: the engine's own sentence less
      // the band ordinal it ends on (doc 2 §1.1). The counts, the fraction and the
      // threshold are all still there, so the quote stays checkable against a local run.
      expect(text, starterSlug(variant)).toContain(
        autonomyStatement(state.analysis!.autonomy.rationale),
      );
      expect(text, starterSlug(variant)).toContain(state.analysis!.security.rationale);
      expect(text, starterSlug(variant)).toContain(state.blueprint!.digest);
      expect(text.toLowerCase(), starterSlug(variant)).not.toContain("out of 4");
      // The class carries the reading; the band behind it never reaches the file the
      // reader takes away.
      expect(text, starterSlug(variant)).toContain(
        `Autonomy: ${state.analysis!.autonomy.label}.`,
      );
      expect(text, starterSlug(variant)).not.toMatch(/autonomy[^.\n]{0,24}level\s*\d/i);
    }
  });

  it("is the same export path the archive's own bundles go through", () => {
    const choices = { output: "docs", approval: "human", maxIterations: 7 } as const;
    const bundle = buildStarterBundle(choices);
    const result = loadBundle(bundle, { ontology: ONTOLOGY });
    const direct = exportBundle({
      blueprint: result.blueprint!,
      analysis: result.analysis!,
      cards: Object.entries(bundle.cardFiles).map(([file, text]) => ({
        ref: file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
        text,
      })),
    });
    expect(buildState(choices).files).toEqual(direct);
  });
});
