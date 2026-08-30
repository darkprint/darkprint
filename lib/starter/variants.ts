/* ============================================================
   The workspace — the variant engine
   Doc 2 §5.3, §5.4, §5.5 and §5.7: three choices in, one complete
   `Bundle` out. Pure, total and deterministic — no clock, no
   randomness, no filesystem — so the same choices always produce
   the same bytes, and the page can build a bundle in the browser
   or at build time without the two disagreeing.

   ── The eight variants (§5.7) ──
   Four output types times two approval modes. The iteration cap is
   a number in one card's `params` and moves no edge, so it does
   not multiply the cases. `STARTER_VARIANTS` is the list, and
   `variants.test.ts` walks all eight through the real `loadBundle`
   rather than sampling the ones a developer happens to click.

   ── What changes with what ──
   choice 1, output type   card contents, and the `data-type` on
                           the ports that carry the work. No node,
                           no edge, no metric.
   choice 2, approval      one node and one edge. The autonomy
                           class moves from closed-loop to
                           supervised, and doc 2 §1.1 governs every
                           word written about that — including the
                           comments this file writes into the DOT,
                           which travel inside the download.
   choice 3, iteration cap `params.max_iterations` on the debugger,
                           the sentence of its `spec` that tells the
                           agent when to stop, and that card's
                           version. See `starterRunBudget` for what
                           it does and does not move.
   the §5.4 switch         one edge in the DOT and nothing else.
                           Never written into a card, so the
                           demonstration cannot be persisted by
                           accident.

   ── Isolation, kept ──
   No edge runs from the planner to the builder, and the builder's
   `spec` does not restate the criteria either (doc 1 §3.2). Both
   halves are asserted in `variants.test.ts` against the engine's
   own `criteria-leak` result and its own similarity measure, for
   all eight variants.
   ============================================================ */

import { cardFilePath } from "@/lib/content/bundle-export";
import { cardRef, type Bundle, type BundleManifest, type CardRef, type JsonValue } from "@/lib/core";

import {
  STARTER_APPROVALS,
  STARTER_OUTPUTS,
  STARTER_PROFILES,
  clampIterations,
  starterNodes,
  type StarterApproval,
  type StarterCardSpec,
  type StarterOutput,
  type StarterPort,
} from "./cards";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-99) (cited at line 264): n/a — client-side; a server would only duplicate it

export type { StarterApproval, StarterOutput } from "./cards";
export {
  starterNodes,
  STARTER_APPROVALS,
  STARTER_OUTPUTS,
  STARTER_PROFILES,
  MIN_ITERATIONS,
  MAX_ITERATIONS,
  DEFAULT_ITERATIONS,
  clampIterations,
} from "./cards";

/* --------------------- the choices --------------------- */

/** Doc 2 §5.3's three choices, plus §5.4's switch. */
export interface StarterChoices {
  output: StarterOutput;
  approval: StarterApproval;
  /** 1..10. Out-of-range values are clamped rather than refused (`clampIterations`). */
  maxIterations: number;
  /**
   * Doc 2 §5.4's demonstration switch. Adds `planner -> builder` to the DOT and nothing
   * else, so the criteria reach the node whose work they judge and `criteria-leak` fires
   * on the builder.
   *
   * Never persisted into a downloaded artefact: the flag lives in this argument, never in
   * a card, and a page that forgets to turn it off ships a DOT with a commented edge in it
   * rather than a card that has quietly learned the criteria.
   */
  criteriaVisibleToBuilder?: boolean;
}

/** One structural variant. Doc 2 §5.7: there are eight of them and all eight must work. */
export interface StarterVariant {
  output: StarterOutput;
  approval: StarterApproval;
}

/**
 * The eight, in a fixed order: output type outer, approval inner.
 *
 * Built from the two vocabularies rather than written out, so adding a fifth output type
 * cannot leave a variant untested — the list and the loop that walks it grow together.
 */
export const STARTER_VARIANTS: readonly StarterVariant[] = Object.freeze(
  STARTER_OUTPUTS.flatMap((output) =>
    STARTER_APPROVALS.map((approval) => Object.freeze({ output, approval })),
  ),
);

/* --------------------- identity --------------------- */

/** `python-script-factory`, or `python-script-factory-with-approval`. */
export function starterSlug(choices: StarterVariant): string {
  const stem = `${STARTER_PROFILES[choices.output].slug}-factory`;
  return choices.approval === "human" ? `${stem}-with-approval` : stem;
}

/** The `digraph` name: the slug with hyphens turned into underscores. */
function graphName(slug: string): string {
  return slug.replace(/-/g, "_");
}

/**
 * Small counts as words, for the one sentence that has to say how many nodes there are.
 *
 * The count is passed in from `starterNodes`, so the summary and the node table in the
 * README are the same fact written twice rather than a sentence that has to be kept in
 * step by hand. A count outside the table falls back to the digit, which reads plainly
 * enough and cannot be wrong.
 */
const COUNT_WORDS: readonly string[] = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function manifestFor(choices: StarterVariant, nodeCount: number): BundleManifest {
  const p = STARTER_PROFILES[choices.output];
  const human = choices.approval === "human";
  const tags = ["workspace", "starter", "isolation", choices.output];
  if (human) tags.push("human-in-the-loop");
  const summary = `A ${countWord(nodeCount)}-node blueprint that ${p.summaryTail}`;
  return {
    slug: starterSlug(choices),
    title: human ? `${p.title} with approval` : p.title,
    summary: human
      ? `${summary} One named approver accepts before anything is released.`
      : summary,
    // Spec part 2 binds this string even though nothing renders it today. It is a
    // manifest description, and `toBlueprintView` reads exactly that field as the body
    // copy of a blueprint page (`lib/content/view.ts`), so "reads autonomy level 3 …
    // level 4" was one call away from being the per-graph number printed beside the
    // 1-to-5 organisational ladder. The class says the same thing and cannot collide.
    description: human
      ? `${p.description}\n\nA sixth node holds the run at the release boundary until a person accepts the work. With that node the blueprint is classed supervised and without it closed-loop, and the class records where a person acts.`
      : p.description,
    category: p.category,
    tags,
  };
}

/* --------------------- the topology --------------------- */

/** Node ids are padded to this width so the DOT reads as a column. */
const ID_WIDTH = 8;

function pad(id: string): string {
  return id.padEnd(ID_WIDTH, " ");
}

function refOf(card: StarterCardSpec): CardRef {
  return cardRef(card.id, card.version);
}

/**
 * The DarkPrint topology.
 *
 * Written by hand rather than assembled from a generic emitter: the comments are the
 * teaching material (doc 2 §5.1 puts the DOT in front of the user beside the drawing), and
 * a generated DOT with no comments would say less than the drawing it stands beside.
 */
export function starterDot(choices: StarterChoices): string {
  const nodes = starterNodes(choices);
  const human = choices.approval === "human";
  const lines: string[] = [];

  lines.push(`digraph ${graphName(starterSlug(choices))} {`);
  lines.push("  rankdir=LR;");
  lines.push("  node [shape=box, style=rounded];");
  lines.push("");
  lines.push("  // Doc 2 §5.2: one node per phase. The id on the left is the instance in");
  lines.push("  // this factory, the pin on the right is the card that defines it.");
  for (const node of nodes) {
    lines.push(`  ${pad(node.nodeId)} [card="${refOf(node.card)}"];`);
  }
  lines.push("");
  lines.push("  // The lesson of this blueprint is the edge that is not written below.");
  lines.push("  // Nothing runs from planner to builder: the acceptance criteria reach the");
  lines.push("  // node that judges the work and never the node that produces it.");
  lines.push(`  ${pad("planner")} -> ${pad("tester")} [label="acceptance criteria"];`);
  lines.push(`  ${pad("builder")} -> ${pad("tester")} [label="build"];`);

  if (choices.criteriaVisibleToBuilder === true) {
    lines.push("");
    lines.push("  // Doc 2 §5.4: the demonstration edge, present because you switched it on.");
    lines.push("  // It is not part of what you download. With it the criteria reach the node");
    lines.push("  // whose work they judge, and `criteria-leak` fires on the builder.");
    lines.push(`  ${pad("planner")} -> ${pad("builder")} [label="acceptance criteria"];`);
  }

  lines.push("");
  lines.push("  // Doc 2 §5.5: the loop is tester -> debugger -> tester and it never returns");
  lines.push("  // to the builder. Work already done is preserved, and the builder stays");
  lines.push("  // isolated from every fact about the failures for the whole run. The cap, the");
  lines.push("  // progress criterion and the exit once the cap is spent are on the debugger card.");
  lines.push(`  ${pad("tester")} -> ${pad("debugger")} [label="failure evidence", style=dashed];`);
  lines.push(`  ${pad("debugger")} -> ${pad("tester")} [label="patch"];`);
  lines.push("");

  if (human) {
    // Doc 2 §1.1 reaches into this comment. It is read twice — in the DOT pane on
    // /build and in `topology.dot` inside the downloaded folder — so an ordinal here is
    // an autonomy number on a user-facing surface, and "from 4 to 3" frames the person
    // as a subtraction. The class says the same fact and ranks nothing, which is the
    // wording the manifest description and the approver card already carry.
    lines.push("  // Doc 2 §5.3: a person accepts the work before it is released. The graph");
    lines.push("  // changes here and the autonomy class changes with it: with this node the");
    lines.push("  // blueprint is classed supervised, without it closed-loop. The class records");
    lines.push("  // where a person acts in the run.");
    lines.push(`  ${pad("tester")} -> ${pad("approver")} [label="approved build"];`);
    lines.push(`  ${pad("approver")} -> ${pad("deployer")} [label="human approval"];`);
  } else {
    lines.push("  // The tester decides the work is finished, and the release follows from it.");
    lines.push(`  ${pad("tester")} -> ${pad("deployer")} [label="approved build"];`);
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/* --------------------- the bundle --------------------- */

/**
 * One complete bundle from one set of choices. Pure: the same choices always produce
 * byte-identical output.
 *
 * Every combination is a working factory, which doc 2 §5.3 makes a hard requirement:
 * "se rendi persistente una configurazione rotta, spedisci a qualcuno una fabbrica
 * difettosa col tuo marchio sopra". `variants.test.ts` puts all eight through
 * `loadBundle` and fails on a single error diagnostic.
 */
export function buildStarterBundle(choices: StarterChoices): Bundle {
  const nodes = starterNodes(choices);
  const cardFiles: Record<string, string> = {};
  for (const node of nodes) {
    cardFiles[cardFilePath(refOf(node.card))] = cardDocument(node.card);
  }
  return {
    // The node count comes off the same list the DOT is written from, so the summary
    // cannot disagree with the graph it describes (six nodes with an approver, five
    // without).
    manifest: manifestFor(choices, nodes.length),
    dot: starterDot(choices),
    cardFiles,
  };
}

/* --------------------- what the cap actually moves --------------------- */

/**
 * The run the cap bounds, in whole numbers taken off the graph.
 *
 * Doc 2 §5.6 says the slider moves cost, time, autonomy and security together. Measured
 * against this engine it moves none of the four: the two static metrics of doc 1 §8 read
 * the *presence* of a cap and never its size, and cost and time are reported figures from
 * telemetry that does not exist yet (doc 1 §8, doc 2 §6). `variants.test.ts` asserts that
 * as a fact rather than leaving it to be discovered by a reader who moves the slider and
 * watches nothing happen.
 *
 * These are the numbers that do move, and every one of them is arithmetic over the
 * topology and the declared cap rather than an estimate:
 *
 *   - the tester runs once for the first build and once more per patch;
 *   - the debugger runs at most once per patch;
 *   - the nodes Attractor hands to a model are the planner, the builder, the tester and
 *     the debugger (`agent` and `validation` types both map to the `codergen` handler),
 *     so the model is called at most `2n + 3` times.
 *
 * All three are worst cases. `stop_on_repeated_evidence` on the debugger card ends the
 * loop early when two rounds produce the same evidence, so a real run is bounded by these
 * numbers and not described by them.
 */
export interface StarterRunBudget {
  /** The cap as the card declares it, after clamping. */
  maxIterations: number;
  /** Worst case: the first build, plus one pass per patch. */
  testerRunsAtMost: number;
  /** Worst case: one pass per patch. */
  debuggerRunsAtMost: number;
  /** Worst case model calls across the whole run: planner, builder, tester, debugger. */
  modelCallsAtMost: number;
}

/** The budget for one set of choices. Pure arithmetic over the cap. */
export function starterRunBudget(choices: StarterChoices): StarterRunBudget {
  const n = clampIterations(choices.maxIterations);
  return {
    maxIterations: n,
    testerRunsAtMost: n + 1,
    debuggerRunsAtMost: n,
    // planner (1) + builder (1) + tester (n + 1) + debugger (n).
    modelCallsAtMost: 2 * n + 3,
  };
}

/* --------------------- the card document writer --------------------- */

/*
 * A small YAML writer rather than `yaml`'s `stringify`.
 *
 * Two reasons. The output has to read like the archive's own cards, because the user is
 * looking at both in the four-pane view (doc 2 §5.1) and a card whose prose arrives as one
 * 900-character line teaches nothing. And a card document is a fixed, known shape, so a
 * general emitter would be more machinery than the job needs.
 *
 * The correctness of this half is tested rather than argued: `variants.test.ts` parses
 * every emitted document back through the engine's own `loadCard` and compares the result
 * field by field with the model in `cards.ts`.
 */

/** Column the folded prose blocks wrap at, including the two-space indent. */
const WRAP_WIDTH = 96;

/**
 * A plain scalar is written unquoted when it cannot be read as anything else.
 *
 * Starts with a letter or a digit, so no indicator character can open it, and carries no
 * `:` and no `#`, which are the two that stay special inside a plain scalar. Everything
 * else is double-quoted through `JSON.stringify`, whose output is valid YAML.
 */
const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9 ,.;'()`_/@-]*[A-Za-z0-9,.;')`_/@-]$/;

function yamlString(value: string): string {
  if (value.length === 1) return /^[A-Za-z0-9]$/.test(value) ? value : JSON.stringify(value);
  return PLAIN_SCALAR.test(value) ? value : JSON.stringify(value);
}

function yamlScalar(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return yamlString(value);
  // `params` is `JsonValue`, so a nested value is legal even though no card here uses one.
  return JSON.stringify(value);
}

/**
 * Prose as a folded block scalar.
 *
 * `>-` folds every line break into one space and strips the trailing newline, so the text
 * comes back exactly as it went in provided that no emitted line is blank and no emitted
 * line starts with a space. Both are true of a greedy wrap over whitespace-normalised
 * text, and a word longer than the wrap width simply takes a line of its own.
 */
function foldedBlock(key: string, value: string, indent: string): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const limit = Math.max(20, WRAP_WIDTH - indent.length - 2);
  const lines: string[] = [`${indent}${key}: >-`];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > limit) {
      lines.push(`${indent}  ${current}`);
      current = word;
      continue;
    }
    current = `${current} ${word}`;
  }
  if (current !== "") lines.push(`${indent}  ${current}`);
  return lines;
}

/** One port, as a list entry. */
function portLines(port: StarterPort): string[] {
  const lines = [`  - name: ${yamlString(port.name)}`, `    type: ${yamlString(port.type)}`];
  if (port.required === false) lines.push("    required: false");
  lines.push(...foldedBlock("description", port.description, "    "));
  return lines;
}

function listLines(key: string, values: readonly string[]): string[] {
  if (values.length === 0) return [`${key}: []`];
  return [`${key}:`, ...values.map((value) => `  - ${yamlString(value)}`)];
}

function portsLines(key: string, ports: readonly StarterPort[]): string[] {
  if (ports.length === 0) return [`${key}: []`];
  return [`${key}:`, ...ports.flatMap(portLines)];
}

/** One card, as the YAML document the bundle carries. */
export function cardDocument(card: StarterCardSpec): string {
  const lines: string[] = [];

  lines.push(`id: ${yamlString(card.id)}`);
  lines.push(`name: ${yamlString(card.name)}`);
  lines.push(`type: ${yamlString(card.type)}`);
  lines.push(`phase: ${yamlString(card.phase)}`);
  lines.push("");

  lines.push(...foldedBlock("action", card.action, ""));
  lines.push(...foldedBlock("spec", card.spec, ""));
  if (card.agent !== undefined) lines.push(`agent: ${yamlString(card.agent)}`);
  lines.push(...listLines("tools", card.tools));
  lines.push(...listLines("mcp", card.mcp));
  if (card.skill !== undefined) lines.push(`skill: ${yamlString(card.skill)}`);
  if (card.params !== undefined) {
    lines.push("params:");
    for (const key of Object.keys(card.params)) {
      lines.push(`  ${key}: ${yamlScalar(card.params[key])}`);
    }
  }
  lines.push("");

  lines.push(...portsLines("inputs", card.inputs));
  lines.push(...portsLines("outputs", card.outputs));
  lines.push(...listLines("dependencies", card.dependencies));
  lines.push(...listLines("cannot", card.cannot));
  lines.push(...listLines("will_not", card.willNot));
  lines.push("");

  lines.push(...listLines("risk_markers", card.riskMarkers));
  lines.push(...foldedBlock("notes", card.notes, ""));
  lines.push("");

  lines.push(`version: ${JSON.stringify(card.version)}`);
  lines.push(`provenance: ${yamlString(card.provenance)}`);

  return `${lines.join("\n")}\n`;
}
