/* ============================================================
   /tutorial — the folder, written from what the reader typed
   ------------------------------------------------------------
   Pure: values in, files out. No DOM, no clock, no randomness, so
   the suite can put the example values through this and then through
   `loadBundle` and assert the result resolves. That test is the only
   thing standing between this page and handing somebody a folder the
   engine refuses, because nothing else here runs the engine.

   ── the shape is the published one, and it is not the prototype's ──
   `topology.dot`, `cards/<id>@<version>.yaml`, `README.md`, and
   `evals/scenario.yaml` once a rubric exists. That is what
   `public/bundles/**` holds and what `skills/darkprint/SKILL.md`
   tells the authoring skill to write.

   NO `blueprint.yaml`. The design handoff put `summary`, `category`
   and `tags` on the `digraph` line, and they parse: `parseDot` lifts
   any root `key=value` into `graphAttrs` with no allowlist. They are
   also read by nothing. The one consumer of `graphAttrs` in this
   repository is `attractor/import.ts`, which reads `label` and
   `goal`. Those three fields live on `BundleManifest`, which is read
   from `blueprint.yaml` by `readManifest`, and a published bundle
   carries no manifest at all: `stubManifestFor` names the blueprint
   after the DIRECTORY. So the summary the reader writes goes into
   `README.md`, where a published bundle really does carry it, and
   the graph file keeps the `rankdir` and node defaults that are the
   only root attributes any bundle in `content/` uses.

   ── the four things the engine refuses, learned by running it ──
   The handoff's own file writer produced ten diagnostics, four at
   error severity, and `export` threw. Each of these lines is one of
   them, fixed:

   1. `cannot:` takes `data-type` term ids and NOTHING else. Three
      prose prohibitions there were three `card/unknown-term` errors.
      Prose is `will_not`, which the resolver does not check and
      which is addressed to a person (`card/schema.ts`).
   2. A port `description` starting with `{` is a YAML flow mapping,
      so `{claim, url, span} + checked_at` was `card/parse-error`.
      Every description is quoted.
   3. `dependencies` left empty is five `bundle/undeclared-dependency`
      warnings, one per edge. It names the upstream CARD ids, not the
      node ids.
   4. `inputs` is required even on a source node, and `spec` is
      required on every card. Both are always written.

   `cannot: [acceptance-criteria]` on the extractor stays, and it is
   the one entry in that field the vocabulary holds. What it does is
   NOT what the handoff said: the marker is inferred from the graph
   and the guard does not silence it. Measured both ways, it moves
   zero diagnostics on this blueprint, because the criteria walk
   absorbs at the validation node and never reaches the extractor.
   What the line buys is a refusal: draw `rubric -> extract` with it
   in place and the resolver raises `bundle/prohibition-violated` at
   error severity. Step 07 says that, in those terms.
   ============================================================ */

import { valueOf, type BlankValues } from "./blanks";

/** One file of the folder, at its bundle-relative path. */
export interface BundleFile {
  readonly path: string;
  readonly text: string;
}

/** A port as it is written into a card. */
interface Port {
  readonly name: string;
  readonly type: string;
  /**
   * The record shape inside the type, in prose.
   *
   * Two layers, and the tutorial teaches the difference: `type` is the ontology term the
   * resolver holds the edge to, and this is the field list the receiving node's `spec`
   * reads. The engine treats it as prose and checks nothing about it.
   */
  readonly description: string;
}

interface Card {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly action: string;
  readonly spec: string;
  readonly tools: readonly string[];
  readonly params: Readonly<Record<string, string>>;
  readonly inputs: readonly Port[];
  readonly outputs: readonly Port[];
  /** Card ids, not node ids: `bundle/undeclared-dependency` compares against the card ref. */
  readonly dependencies: readonly string[];
  /** `data-type` term ids the resolver enforces against every incoming edge. */
  readonly cannot: readonly string[];
  /** Sentences in the author's own words. Nothing checks these. */
  readonly willNot: readonly string[];
}

const VERSION = "1.0.0";

/* ============================================================
   Reader text into a YAML value

   Everything below `id`, `type` and the ports is prose somebody
   typed, and a page that promises the folder resolves has to be
   right about that for the text they actually type rather than for
   the example. Four of these were reachable before this existed and
   each of them is a `card/parse-error`:

     a name holding a colon      `name: Seed: Crawler`
     a shape holding a quote     `description: "{a, "b"}"`
     any value starting with `{` a flow mapping followed by a scalar
     a newline in a textarea     a block scalar ended at column 0

   The identifier fields are NOT quoted here, because quoting is the
   wrong answer for them: a card id is a filename and a node name is
   a DOT node id, and both are refused rather than escaped. That is
   `identifierFaults` in `state.ts`, on the page, while the field is
   still in front of the reader.
   ============================================================ */

/**
 * A YAML scalar that reads back as the string it was given.
 *
 * Double-quoted whenever plain would be ambiguous, and plain otherwise so the ordinary card
 * still looks like the archive's. The condition is deliberately broad: it is cheaper to
 * quote a value that did not need it than to enumerate YAML's plain-scalar rules and be
 * wrong about one. `JSON.stringify` produces exactly YAML's double-quoted form for the
 * cases that reach it, escaping `"` and `\` and turning a newline into `\n`.
 */
function scalar(value: string): string {
  const plain = /^[A-Za-z0-9][A-Za-z0-9 ._@/-]*$/.test(value) && !value.endsWith(" ");
  return plain ? value : JSON.stringify(value);
}

/**
 * A folded block scalar, with every line of the value indented under its key.
 *
 * `action` and `spec` are textareas, so a reader can put a newline in one. A block scalar
 * ends at the first line indented less than its content, so a second line at column 0 ended
 * the block and became a document-level scalar: `card/parse-error`, and the card stopped
 * loading. Indenting each line is what `>-` is for, and it folds them back into one
 * paragraph on read, which is what the field means.
 */
function block(key: string, value: string): string {
  const lines = value.split("\n").map((line) => `  ${line.trim()}`);
  return `${key}: >-\n${lines.join("\n")}\n`;
}

/**
 * A YAML list, or the flow-style empty list on one line.
 *
 * `key:` followed by nothing is `null` to a YAML reader, and `stringList` in the card
 * validator reports a null where a list belongs. `key: []` is the empty list it means.
 */
function list(key: string, entries: readonly string[], indent = "  "): string {
  if (entries.length === 0) return `${key}: []\n`;
  return `${key}:\n${entries.map((entry) => `${indent}- ${scalar(entry)}`).join("\n")}\n`;
}

/**
 * A port, with its description quoted.
 *
 * The quotes are not decoration. Every shape in this tutorial is written `{claim, url,
 * span}`, and a value that OPENS with `{` is a YAML flow mapping: `description: {claim,
 * url, span} + checked_at` parses as a map followed by a scalar, which is
 * `card/parse-error` at the node's end. Quoting is what makes the field the string it
 * looks like.
 */
function port(p: Port): string {
  return `  - name: ${p.name}\n    description: ${scalar(p.description)}\n    type: ${p.type}\n`;
}

function cardYaml(card: Card): string {
  const params =
    Object.keys(card.params).length === 0
      ? "params: {}\n"
      : `params:\n${Object.entries(card.params)
          .map(([key, value]) => `  ${key}: ${scalar(value)}`)
          .join("\n")}\n`;

  return (
    `id: ${card.id}\n` +
    `name: ${scalar(card.name)}\n` +
    `type: ${card.type}\n\n` +
    block("action", card.action) +
    block("spec", card.spec) +
    list("tools", card.tools) +
    "mcp: []\n" +
    params +
    "\n" +
    (card.inputs.length === 0
      ? "inputs: []\n"
      : `inputs:\n${card.inputs.map(port).join("")}`) +
    `outputs:\n${card.outputs.map(port).join("")}` +
    list("dependencies", card.dependencies) +
    "\n" +
    list("cannot", card.cannot) +
    list("will_not", card.willNot) +
    "\n" +
    "risk_markers: []\n\n" +
    `version: ${VERSION}\n`
  );
}

/**
 * Whether the rubric has been started, which is the page's one derived mode.
 *
 * Derived from the rubric card's id rather than toggled, so a reader cannot be looking at a
 * graph with a rubric node in it and a folder without one. Everything step 07 adds hangs
 * off this: the fifth card, the fifth edge, the checker's `criteria` port, the extractor's
 * prohibition, and `evals/scenario.yaml`.
 */
export function rubricStarted(values: BlankValues): boolean {
  return valueOf(values, "c5_id") !== "";
}

function cardsFor(values: BlankValues): Card[] {
  const v = (id: string) => valueOf(values, id);
  const on = rubricStarted(values);
  const page = v("shape_page");
  const entry = v("shape_entry");

  const cards: Card[] = [
    {
      id: v("c1_id"),
      name: v("c1_name"),
      type: v("c1_type"),
      action: v("c1_action"),
      spec: v("c1_spec"),
      tools: [v("c1_tools")],
      params: {},
      inputs: [{ name: "seeds", type: "json", description: "the seed URLs, one per line" }],
      outputs: [
        { name: "pages", type: v("c1_out_type"), description: `one record per page, ${page}` },
      ],
      dependencies: [],
      cannot: [],
      willNot: [v("c1_will_not")],
    },
    {
      id: v("c2_id"),
      name: v("c2_name"),
      type: v("c2_type"),
      action: v("c2_action"),
      spec:
        "For each page, write entries of the form {claim, url, span}. The span is copied from " +
        "the page, never paraphrased. An unsupported entry comes back with the reason: fix that " +
        "entry or drop it, and touch nothing else.",
      tools: [],
      params: {},
      inputs: [
        { name: "pages", type: v("c2_in_type"), description: `one record per page, ${page}` },
        {
          name: "unsupported",
          type: "json",
          description: `an entry sent back, ${entry} + reason`,
        },
      ],
      outputs: [
        {
          name: "entries",
          type: v("c2_out_type"),
          description: `one entry per claim, ${entry}`,
        },
      ],
      dependencies: [v("c1_id"), v("c3_id")],
      /* The only entry in this field the vocabulary holds, and the only one it takes. It is
         a rule about an EDGE: with it in place, wiring the rubric into this node is
         `bundle/prohibition-violated` and the bundle stops resolving. */
      cannot: on ? ["acceptance-criteria"] : [],
      willNot: [v("c2_will_not")],
    },
    {
      id: v("c3_id"),
      name: v("c3_name"),
      type: v("c3_type"),
      action: v("c3_action"),
      spec:
        "An entry is grounded when its span is found verbatim on its url and the claim follows " +
        "from that span. Anything else is unsupported, with the reason attached.",
      tools: ["http-fetch"],
      /* The cap, on the checker because the checker is what decides to send an entry back.
         `readIterationCap` reads three spellings off the top level of `params`; this is the
         one the hint names. Without it, `unbounded-loop` is inferred on every member of the
         cycle and takes the security reading from 4 to 2. */
      params: { max_iterations: v("c3_max_iterations") },
      inputs: on
        ? [
            {
              name: "entries",
              type: v("c3_in_type"),
              description: `one entry per claim, ${entry}`,
            },
            {
              name: "criteria",
              type: "acceptance-criteria",
              description: "the rubric, written before the run",
            },
          ]
        : [
            {
              name: "entries",
              type: v("c3_in_type"),
              description: `one entry per claim, ${entry}`,
            },
          ],
      outputs: [
        {
          name: "grounded",
          type: v("c3_out_type"),
          description: `the entry as received, ${entry} + checked_at`,
        },
        {
          name: "unsupported",
          type: "json",
          description: "the entry as received + reason",
        },
      ],
      dependencies: on ? [v("c2_id"), v("c5_id")] : [v("c2_id")],
      cannot: [],
      willNot: [v("c3_will_not")],
    },
    {
      id: v("c4_id"),
      name: "Knowledge Writer",
      type: v("c4_type"),
      action: "Merge grounded entries by claim, keep every source, and write the knowledge base.",
      spec:
        "One file per topic, one line per claim, every line ending in its sources. Two entries " +
        "with the same claim merge; their sources concatenate. Drop nothing.",
      tools: ["file-io"],
      params: {},
      inputs: [
        {
          name: "grounded",
          type: v("c4_in_type"),
          description: `${entry} + checked_at`,
        },
      ],
      outputs: [
        {
          name: "knowledge",
          type: "artifact",
          description: "one file per topic, one line per claim, sources at the end of the line",
        },
      ],
      dependencies: [v("c3_id")],
      cannot: [],
      willNot: ["drop an entry that arrived grounded"],
    },
  ];

  if (on) {
    cards.push({
      id: v("c5_id"),
      name: v("c5_name"),
      type: "human-input",
      action: "Hand the checker the criteria the run will be graded by.",
      spec:
        "Write the criteria before the run: which facts must appear, what counts as grounded, " +
        "where a url may point. They reach the checker only.",
      tools: [],
      params: {},
      inputs: [],
      outputs: [
        {
          name: "criteria",
          type: "acceptance-criteria",
          description: "the rubric of evals/scenario.yaml",
        },
      ],
      dependencies: [],
      cannot: [],
      willNot: [],
    });
  }

  return cards;
}

function topologyDot(values: BlankValues, cards: readonly Card[]): string {
  const v = (id: string) => valueOf(values, id);
  const on = rubricStarted(values);
  const [n1, n2, n3, n4] = [v("n1"), v("n2"), v("n3"), v("n4")];

  return (
    `digraph "${v("blueprint_name")}" {\n` +
    "  rankdir=LR;\n" +
    "  node [shape=box, style=rounded];\n\n" +
    `  ${n1} [card="${cards[0].id}@${VERSION}"];\n` +
    `  ${n2} [card="${cards[1].id}@${VERSION}"];\n` +
    `  ${n3} [card="${cards[2].id}@${VERSION}"];\n` +
    `  ${n4} [card="${cards[3].id}@${VERSION}"];\n` +
    (on ? `  rubric [card="${cards[4].id}@${VERSION}"];\n` : "") +
    "\n" +
    `  ${n1} -> ${n2} [out="pages", in="pages"];\n` +
    `  ${n2} -> ${n3} [out="entries", in="entries"];\n` +
    `  ${n3} -> ${n2} [label="unsupported", style=dashed, out="unsupported", in="unsupported"];\n` +
    `  ${n3} -> ${n4} [label="grounded", out="grounded", in="grounded"];\n` +
    (on ? `  rubric -> ${n3} [out="criteria", in="criteria"];\n` : "") +
    "}\n"
  );
}

function readmeMd(values: BlankValues): string {
  const v = (id: string) => valueOf(values, id);
  const on = rubricStarted(values);
  const [n1, n2, n3, n4] = [v("n1"), v("n2"), v("n3"), v("n4")];
  const name = v("blueprint_name");

  return (
    `# ${name}\n\n${v("summary")}\n\n` +
    "## The graph\n\n" +
    `\`${n1}\` fetches the seed sites, \`${n2}\` turns pages into cited entries, \`${n3}\` ` +
    `reopens every citation and sends the unsupported ones back, \`${n4}\` files what arrived ` +
    "grounded." +
    (on
      ? " `rubric` hands the checker the criteria, and the extractor is forbidden from " +
        "receiving them."
      : "") +
    "\n\n" +
    "## Check it\n\n```\ndarkprint validate .\ndarkprint export . --attractor > desk.dot\n```\n\n" +
    (on
      ? "## Measure it\n\nRun `desk.dot` through your own harness on `evals/scenario.yaml`, " +
        "grade the run directory against its rubric, then `darkprint report <run-dir> " +
        `--target <you>/${name} --cost <units>\`.\n\n`
      : "") +
    "Written with the DarkPrint tutorial. Nothing here has been published.\n"
  );
}

/**
 * The scenario, which is the one file in the folder DarkPrint does not read.
 *
 * `readBundleDirectory` reads the top-level files, `cards/`, and the two spellings of the
 * local vocabulary. It never opens `evals/`, so the engine neither validates this nor
 * complains about it. It rides along because the run it describes happens in the reader's
 * own harness, and a scenario kept beside the graph it grades is a scenario somebody can
 * still find a month later. The page says as much rather than letting the folder imply the
 * registry checks it.
 */
function scenarioYaml(values: BlankValues): string {
  const v = (id: string) => valueOf(values, id);
  /* Through `scalar` like every other reader value, even though DarkPrint never opens this
     file: the reader's own harness will, and a scenario that does not parse is the same
     defect one file further along. */
  return (
    `scenario: ${scalar(v("s_name"))}\n` +
    `seeds:\n  - ${scalar(v("s_seed1"))}\n  - ${scalar(v("s_seed2"))}\n` +
    `expect:\n  entries_min: ${scalar(v("s_min"))}\n  must_include:\n    - ${scalar(v("s_fact"))}\n` +
    "rubric:\n" +
    `  - criterion: coverage\n    threshold: ${scalar(v("s_cov"))}\n` +
    `  - criterion: grounding\n    threshold: ${scalar(v("s_ground"))}\n` +
    `  - criterion: within_seeds\n    threshold: ${scalar(v("s_seeds"))}\n`
  );
}

/**
 * Every file of the folder, in the order the zip writes them.
 *
 * Six files without a rubric, eight with one. `topology.dot` first because it is the file
 * that makes the folder a blueprint, and a reader unzipping into a listing meets it first.
 */
export function bundleFiles(values: BlankValues): BundleFile[] {
  const cards = cardsFor(values);
  const files: BundleFile[] = [
    { path: "topology.dot", text: topologyDot(values, cards) },
    { path: "README.md", text: readmeMd(values) },
  ];
  for (const card of cards) {
    files.push({ path: `cards/${card.id}@${VERSION}.yaml`, text: cardYaml(card) });
  }
  if (rubricStarted(values)) {
    files.push({ path: "evals/scenario.yaml", text: scenarioYaml(values) });
  }
  return files;
}

/**
 * The same folder, under a directory named for the blueprint, ready to archive.
 *
 * The zip carried the files at the root, so `unzip site-knowledge-desk.zip` scattered eight
 * files into whatever directory the reader was standing in, and the two commands the page
 * prints beside the button both name `./<blueprint_name>` and would have found nothing.
 * Prefixing at archive time rather than in `bundleFiles` keeps the bundle-relative paths
 * that `cardFilesOf` and the engine want: a bundle's own keys are `cards/<id>@1.0.0.yaml`
 * and adding a directory to them would make the in-tab check disagree with the CLI.
 *
 * It also fixes the name. `stubManifestFor` titles a bundle after its DIRECTORY, so a
 * folder called `site-knowledge-desk` is what makes `darkprint export` write
 * `digraph site_knowledge_desk` rather than naming it after wherever the reader unzipped.
 */
export function archiveEntries(
  files: readonly BundleFile[],
  slug: string,
): { path: string; text: string }[] {
  const root = slug === "" ? "blueprint" : slug;
  return files.map((file) => ({ path: `${root}/${file.path}`, text: file.text }));
}

/**
 * The card documents alone, keyed the way a bundle keys them.
 *
 * `loadBundle` treats EVERY entry of `cardFiles` as a node card, whatever its path, so
 * handing it the whole folder reports `evals/scenario.yaml` as a card missing eight
 * required fields. `readBundleDirectory` avoids that by only ever reading the `cards/`
 * directory; this function is the same filter for the caller that has the files in memory
 * rather than on disk, and it exists so the in-tab check and the CLI see the same bundle.
 */
export function cardFilesOf(files: readonly BundleFile[]): Record<string, string> {
  const cards: Record<string, string> = {};
  for (const file of files) {
    if (file.path.startsWith("cards/")) cards[file.path] = file.text;
  }
  return cards;
}
