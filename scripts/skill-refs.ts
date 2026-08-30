/* ============================================================
   DarkPrint — the authoring skill's reference files, rendered
   from the engine
   `skills/darkprint/` is installed on a stranger's machine by
   `npx skills@latest add Brotherhood94/darkprint`, and the two
   reference files under it are the only description of the
   vocabulary and the wire format that stranger will read. A
   hand-copied ontology is a lie with a shelf life: add a term to
   `lib/core/ontology/core.ts` and the copy is wrong the same
   afternoon, with nothing anywhere saying so.

   So the references are *rendered from the runtime values the
   validator resolves against*. `references/ontology.md` is
   `CORE_ONTOLOGY` printed as tables, and `references/card-schema.md`
   is `CARD_KNOWN_KEYS` plus the verbatim bytes of
   `lib/core/card/schema.ts`. Neither can drift by construction,
   and `scripts/generate-skill-refs.test.ts` fails the suite the
   moment the committed files stop matching what this module
   renders today.

   ── Why the render functions live apart from the writer ──
   `scripts/generate-skill-refs.ts` is the thin `main`: it installs
   the `@/…` resolver hook Node needs to run the engine's
   TypeScript, then writes what this module returns. This module
   imports `@/lib/core` statically, which is what lets vitest —
   whose config already aliases `@/` — import it directly and
   compare bytes without a filesystem write or a subprocess.
   Same split, same reason, as `lib/content/bundle-export.ts`
   deciding *what* a bundle is while `scripts/generate-bundles.ts`
   decides where it lands.

   ── Why the output is committed ──
   The skills CLI does `git clone --depth 1` and reads files off
   the clone. It never runs npm and never runs `prebuild`. A
   gitignored reference simply would not exist for anyone
   installing the skill. Committing generated output is already
   the house convention (`public/bundles/**`), and this file is
   deterministic: sorted, newline-normalised, no clock, no random
   source.

   ── Why this is NOT chained into `prebuild` ──
   `prebuild` runs inside `next build`. If a reference were stale,
   CI would silently rewrite it, the deployed site would be fine,
   and the fix would never land in git. The test is the honest
   gate; `npm run generate:skill-refs` is the fix.
   ============================================================ */

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CARD_KNOWN_KEYS,
  CORE_ONTOLOGY,
  CORE_PHASE_IDS,
  DARKPRINT_CONFIG,
  INFERRED_MARKERS,
  isControlPoint,
  ITERATION_CAP_KEYS,
  ontologyView,
  type OntologyTerm,
  type TermKind,
} from "@/lib/core";

/** Repo root: this file sits in `scripts/`. */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A view over the shipped vocabulary, so the "governs flow" column is asked of the engine
 * rather than transcribed. The flag is inherited down `broader`, which a column reading
 * `term.governsFlow` directly would get wrong for every term but the three that carry it.
 */
const VIEW = ontologyView(CORE_ONTOLOGY);

/** Where the skill lives. Named once; every path below hangs off it. */
export const SKILL_DIR = join("skills", "darkprint");

/** The card model, quoted verbatim into the schema reference. */
const SCHEMA_SOURCE = join("lib", "core", "card", "schema.ts");

/**
 * The banner every generated file opens with.
 *
 * It names the generator and the npm script rather than only saying "do not edit",
 * because the reader of a wrong reference is usually the person who has just discovered
 * it is wrong and wants to know where the truth is kept.
 */
function banner(source: string): string {
  return [
    "<!--",
    "  GENERATED FILE — do not edit by hand.",
    `  Rendered from ${source} by scripts/skill-refs.ts.`,
    "  Regenerate with: npm run generate:skill-refs",
    "  scripts/generate-skill-refs.test.ts fails the suite if this file drifts.",
    "-->",
  ].join("\n");
}

/* --------------------- markdown helpers --------------------- */

/**
 * Escape the two characters that break a markdown table cell.
 *
 * A pipe would end the cell early and a newline would end the row; term descriptions are
 * prose written for humans and nothing forbids either. Backslash-escaping the pipe is
 * what GFM specifies, and a newline becomes a space because a table cell has no lines.
 */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
}

/** One `| a | b | c |` row. */
function row(cells: readonly string[]): string {
  return `| ${cells.map(cell).join(" | ")} |`;
}

/** A table with its header rule. Header order is the column order. */
function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    row(headers),
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map(row),
  ].join("\n");
}

/** `id` in backticks, or an em dash when there is nothing to print. */
function code(value: string | undefined): string {
  return value === undefined || value === "" ? "—" : `\`${value}\``;
}

/* --------------------- the ontology reference --------------------- */

/** Terms of one kind, in the order the reference prints them. */
function byKind(kind: TermKind): OntologyTerm[] {
  return CORE_ONTOLOGY.terms.filter((t) => t.kind === kind).slice();
}

/**
 * Phases print in lifecycle order, everything else alphabetically by id.
 *
 * `CORE_PHASE_IDS` is exported precisely because `byKind` order is not lifecycle order,
 * and a reader who meets the five phases in alphabetical order (debugging, deployment,
 * implementation, planning, testing) has been handed a worse mental model than the one
 * the vocabulary intends.
 */
function phaseOrdered(): OntologyTerm[] {
  const terms = byKind("phase");
  return CORE_PHASE_IDS.map((id) => terms.find((t) => t.id === id)).filter(
    (t): t is OntologyTerm => t !== undefined,
  );
}

function alphabetical(kind: TermKind): OntologyTerm[] {
  return byKind(kind).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * One term by id, for the two places the prose quotes a specific term's own number.
 * Throws rather than falling back: a term the reference names by hand and the vocabulary
 * no longer carries is exactly the drift this whole module exists to make impossible, and
 * a silent `2.0` in its place would hide it.
 */
function term(id: string): OntologyTerm {
  const found = CORE_ONTOLOGY.terms.find((t) => t.id === id);
  if (found === undefined) throw new Error(`skill-refs: no ontology term \`${id}\`.`);
  return found;
}

/** `deprecated` is rendered because a term never disappears; it is superseded. */
function deprecationNote(term: OntologyTerm): string {
  if (term.deprecated === undefined) return "";
  const replaced = term.deprecated.replacedBy;
  return replaced === undefined
    ? ` **Deprecated since ${term.deprecated.since}.**`
    : ` **Deprecated since ${term.deprecated.since}; use \`${replaced}\`.**`;
}

function describe(term: OntologyTerm): string {
  return `${term.description}${deprecationNote(term)}`;
}

/**
 * The security weight a marker actually costs, read off the calibration file rather than
 * off the term.
 *
 * Core markers deliberately carry no `defaultWeight`: doc 3 §4 puts the tunable numbers
 * in `lib/core/config.ts`. Printing them here is the whole point of the reference — an
 * author deciding whether to declare `irreversible-action` wants to know it costs 1.5,
 * and the abstract categories cost nothing because nothing is ever charged for a category.
 */
function weightOf(term: OntologyTerm): string {
  const configured = DARKPRINT_CONFIG.security.weights[term.id];
  if (configured !== undefined) return `−${configured.toFixed(1)}`;
  if (term.defaultWeight !== undefined) return `−${term.defaultWeight.toFixed(1)}`;
  return "—";
}

/** `unbounded-loop` and friends are charged whether or not a card declares them. */
function inferredOf(term: OntologyTerm): string {
  return INFERRED_MARKERS.includes(term.id) ? "inferred" : "declared";
}

/**
 * The whole vocabulary, as the skill's installed copy reads it.
 *
 * Five sections, one per `TermKind`, each a table of id, label, parent and description.
 * Nothing here is editorial: every string comes out of `CORE_ONTOLOGY` or
 * `DARKPRINT_CONFIG`, and the prose between the tables is about how the *kind* is used,
 * which is a property of the engine rather than of any one term.
 */
export function renderOntologyReference(): string {
  const o = CORE_ONTOLOGY;

  const sections: string[] = [];

  sections.push(
    banner("lib/core/ontology/core.ts and lib/core/config.ts"),
    "",
    `# ${o.title}`,
    "",
    `Ontology version \`${o.version}\`. ${o.terms.length} terms.`,
    "",
    "Every card field that names a term is resolved against this list. A term that is not",
    "here is `card/unknown-term` (error). A term of the wrong kind — a `data-type` in the",
    "`tools` list, a `tool` in `type` — is `card/wrong-term-kind` (error).",
    "",
    "A card names no vocabulary version. There is one vocabulary, every card is read against",
    "it, and the version a SCORE was computed under is recorded on the score. Writing",
    "`ontology_version:` on a card is `card/retired-field` (warning).",
    "",
  );

  sections.push(
    "## phase — the five, closed",
    "",
    "Optional and repeatable. A card may declare none, one, or several. `phase: []` — or the",
    "field omitted entirely — is a **complete and correct answer**, and the validator emits",
    "nothing at all about it: an intake step, a retrieval step and a memory store sit in none",
    "of the five. Phase coverage is descriptive and nothing scores off it, so never invent a",
    "phase to fill a strip.",
    "",
    "This is the one dimension that is never namespaced: `me/triage` as a phase is",
    "`card/namespaced-phase` (error). Listed in lifecycle order, which is the order coverage",
    "reports in.",
    "",
    table(
      ["id", "label", "meaning"],
      phaseOrdered().map((t) => [code(t.id), t.label, describe(t)]),
    ),
    "",
  );

  sections.push(
    "## node-type — what does the job",
    "",
    "Exactly one per card, in `type`. Three of these are **abstract categories** and a node",
    "should not be typed with one: they exist so the metrics can ask a subsumption question.",
    "",
    "`human-gate` and `human-input` are subsumed by `human-in-the-loop` and carry",
    "`impliesHuman`. Declaring one of them is the whole of how a card says a person acts at",
    "the node: there is no second field beside `type` to set, and nothing else on the card",
    "can say otherwise.",
    "",
    "The `orchestration` branch is control flow: `parallel` splits the run, `parallel.fan-in`",
    "joins it back, `manager-loop` supervises a sub-run and decides whether it repeats. The",
    "three are named after the Attractor handlers they compile to, so a bundle's `topology.dot`",
    "reads the same on both sides.",
    "",
    "Autonomy is read twice off `type` and the weaker reading is the one that lands in a band.",
    "How much runs alone: the share of nodes whose `type` is *not* subsumed by",
    "`human-in-the-loop`. How much of the deciding runs alone: the same share taken over the",
    "**control points** only, which are the nodes under `evaluative` or `orchestration` plus",
    `\`human-gate\`, and it decides a band only from ${DARKPRINT_CONFIG.autonomy.minControlPoints} control points up. Bands: ` +
      `> ${DARKPRINT_CONFIG.autonomy.level4} closed-loop, ` +
      `≥ ${DARKPRINT_CONFIG.autonomy.level3} conditional, ` +
      `≥ ${DARKPRINT_CONFIG.autonomy.level2} supervised, below that assisted.`,
    "",
    table(
      ["id", "label", "broader", "implies human", "governs flow", "meaning"],
      alphabetical("node-type").map((t) => [
        code(t.id),
        t.label,
        code(t.broader),
        t.impliesHuman === true ? "yes" : "no",
        isControlPoint(VIEW, t.id) ? "yes" : "no",
        describe(t),
      ]),
    ),
    "",
    "**The trap.** `tool`'s own description names running tests, which invites typing the",
    "test runner `tool`. The `criteria-leak` check defines its generator set as the",
    "predecessors of nodes typed `validation`; type the judge `tool` and that set is empty,",
    "the check does not run, and the blueprint scores 4 on security because nothing was",
    "asked, not because nothing was found. The engine says so with",
    "`analysis/criteria-leak-unanchored` (warning). Whatever decides the run is finished is",
    "`validation`.",
    "",
  );

  sections.push(
    "## risk-marker — what it costs",
    "",
    "Declared in `risk_markers`. The security score starts at 4 and each distinct marker",
    "present anywhere in the blueprint is charged **once**, however many nodes carry it:",
    "`clamp(round(4 − Σ weights), 1, 4)`. Weights are read from `lib/core/config.ts`; a locally",
    `namespaced marker with no weight counts ${DARKPRINT_CONFIG.security.unknownMarkerWeight}`,
    "and does not move the score.",
    "",
    "Three markers are **inferred** from the graph whether or not any card declares them.",
    "Declaring one the engine would have inferred anyway changes nothing; failing to declare",
    "one does not hide it.",
    "",
    table(
      ["id", "weight", "how it arrives", "broader", "meaning"],
      alphabetical("risk-marker").map((t) => [
        code(t.id),
        weightOf(t),
        t.broader === undefined && weightOf(t) === "—" ? "category" : inferredOf(t),
        code(t.broader),
        describe(t),
      ]),
    ),
    "",
    "How the three inferred ones are found:",
    "",
    "- `unbounded-loop` — every strongly connected component in the graph, unless some card",
    "  in it declares an iteration cap. The cap is a **top-level** key of `params`, one of",
    `  ${ITERATION_CAP_KEYS.map((k) => `\`${k}\``).join(", ")}, holding a non-negative`,
    "  integer (`0` counts). Nested inside another object it is not read, and the cycle takes",
    "  the charge on every member with no obvious cause.",
    "- `unvalidated-external-access` — a node whose `tools` include anything subsumed by",
    "  `web-search`, `http-fetch`, `sql` or `ci`, which has at least one successor, and at",
    "  least one of those successors is not a `validation` node. `messaging`, `git`,",
    "  `vector-store`, `file-io`, `shell` and `python-sandbox` are deliberately excluded.",
    "- `criteria-leak` — see below. This is the one the whole design is built around.",
    "",
    "### criteria-leak, precisely",
    "",
    "Two sets are computed first. **Producers** are nodes declaring an output port whose type",
    "is subsumed by `acceptance-criteria`. **Judges** are nodes typed `validation`, and",
    "**generators** are the predecessors of any judge, closed upward through non-judge nodes.",
    `The marker fires, at ${weightOf(term("criteria-leak"))}, when:`,
    "",
    "- **topological** — walking forward from a producer, absorbing at judges, reaches a",
    "  generator. The criteria reach the node whose work is being judged.",
    "- **declarative** — one node emits both an `acceptance-criteria` port *and* another port",
    "  a directly connected judge reads as the artefact under judgement. One node writing the",
    "  criteria and the work is structurally illegal, off the declarations alone.",
    "",
    "And it warns without charging when:",
    "",
    "- **content** — the 3-gram Jaccard similarity between a generator's `spec` and a producer's",
    `  exceeds ${DARKPRINT_CONFIG.criteriaLeak.similarityThreshold}`,
    "  (`analysis/criteria-leak-suspected`). An absent edge with the criteria paraphrased into",
    "  the prose is a false isolation, and this is the half that catches it. Specs under three",
    "  words are excluded from the comparison entirely.",
    "- **relayed** — reachable only by walking *through* a judge",
    "  (`analysis/criteria-relayed-through-judge`). The engine cannot tell an endorsed",
    "  `judge → fixer → judge` loop from a forbidden `judge → builder → judge` one, so it",
    "  declines to decide and says which it saw.",
    "- **out of band** — a `params` key matching `/criteri/i` naming something nothing in the",
    "  graph produces (`analysis/criteria-out-of-band`). Isolation has stopped being a property",
    "  of the topology for that node.",
    "- **unanchored** — one of the two legs is missing: producers with no generators, or",
    "  generators with no producers (`analysis/criteria-leak-unanchored`). **The check did not",
    "  run.** A 4 in this state is silence, not a pass. Both sets empty is silent by design.",
    "",
  );

  sections.push(
    "## data-type — what an edge carries",
    "",
    "Every port declares one, in `type`. Compatibility along an edge is directional: a source",
    "port fits a target port when the types are equal, when either side is `any`, or when the",
    "**source is narrower** than the target. Never the other way. `code → text` carries;",
    "`text → code` is `bundle/type-mismatch` (error).",
    "",
    "**Do not reach for `any`.** It matches everything, which means every edge passes, no",
    "`cannot` prohibition can be violated, and the criteria check has nothing to anchor on. A",
    "bundle typed `any` throughout loads perfectly and checks nothing.",
    "",
    "`acceptance-criteria` is load-bearing: it is the port type the entire `criteria-leak`",
    "machinery anchors on. Criteria typed `text` or `structured` are criteria the engine",
    "cannot see.",
    "",
    table(
      ["id", "label", "broader", "meaning"],
      alphabetical("data-type").map((t) => [code(t.id), t.label, code(t.broader), describe(t)]),
    ),
    "",
    "The lattice, as `broader` draws it:",
    "",
    "```",
    ...lattice("data-type"),
    "```",
    "",
  );

  sections.push(
    "## tool — what a node is permitted to do",
    "",
    "Declared in `tools`. Note the deliberate id collision: `tool` is both a `node-type` and",
    "the *kind* of these terms. The field a term appears in decides which is meant, so there",
    "is no ambiguity to resolve — `type: tool` is the node type and `tools: [shell]` is a",
    "capability.",
    "",
    "`tools` says what the node is permitted to do. `mcp` says which installed server supplies",
    "it, is free text, and is checked against nothing — an MCP server is a process somebody",
    "installed and the vocabulary has no term for one. A node can carry either without the other.",
    "",
    table(
      ["id", "label", "broader", "meaning"],
      alphabetical("tool").map((t) => [code(t.id), t.label, code(t.broader), describe(t)]),
    ),
    "",
  );

  sections.push(
    "## Local terms",
    "",
    "`node-type`, `risk-marker`, `data-type` and `tool` accept a locally namespaced term",
    "(`me/my-term`), which must be rooted in an `extensions.yaml` carried by the bundle.",
    "`phase` never accepts one.",
    "",
    "**Do not emit local terms unless the author asks for one and writes the extension.** An",
    "unrooted local term is silently ignored, which is the worst outcome available: the card",
    "loads, the field reads as declared, and nothing enforces it.",
    "",
  );

  return `${sections.join("\n")}\n`.replace(/\n{3,}/g, "\n\n");
}

/**
 * The `broader` edges of one kind, drawn as an indented tree.
 *
 * Rendered rather than written out because the lattice is exactly the set of `broader`
 * fields and a hand-drawn tree is one term-addition away from being wrong. Roots are the
 * terms with no parent, in id order; children hang under their parent in id order.
 */
function lattice(kind: TermKind): string[] {
  const terms = alphabetical(kind);
  const lines: string[] = [];
  const walk = (parent: string | undefined, depth: number): void => {
    for (const term of terms.filter((t) => t.broader === parent)) {
      lines.push(`${"  ".repeat(depth)}${term.id}`);
      walk(term.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return lines;
}

/* --------------------- the card schema reference --------------------- */

/**
 * The wire format, in two byte-derived halves.
 *
 * (a) `CARD_KNOWN_KEYS` — the actual set of keys the validator accepts, camelCase aliases
 * included. Anything outside it is an `info` and is ignored, which is forward
 * compatibility rather than permission: a misspelled `risk_marker` is silently dropped.
 *
 * (b) `lib/core/card/schema.ts` verbatim. Its jsdoc *is* the specification — why `phases`
 * is optional and repeatable, why `spec` has to be self-sufficient, what `cannot` enforces
 * and what `will_not` deliberately does not
 * — and an agent reads TypeScript fine. `readFileSync` cannot drift by construction.
 *
 * The orientation header in front of it is not decoration. That file's comments cite
 * "doc 1 §3.2" and "doc 3 §7", which are design documents nobody installing this skill has
 * ever seen, so the reader is told up front to read the sentences and ignore the citations.
 */
export function renderCardSchemaReference(): string {
  const keys = [...CARD_KNOWN_KEYS].sort();
  const source = readFileSync(join(ROOT, SCHEMA_SOURCE), "utf8").replace(/\r\n/g, "\n");

  return (
    [
      banner(`${SCHEMA_SOURCE} and lib/core/card/validate.ts`),
      "",
      "# The node card, on the wire",
      "",
      "A card is one YAML or JSON document describing one node. The wire format is",
      "**snake_case** — `risk_markers`, `will_not` — and the validator maps it onto the",
      "camelCase model quoted at the bottom of this file.",
      "",
      "## Every key the validator accepts",
      "",
      "Exactly this set, and nothing else. An unrecognised key is reported as `info` and",
      "**ignored**, so a typo does not fail the card; it silently does nothing.",
      "",
      keys.map((k) => `- \`${k}\``).join("\n"),
      "",
      "Where two spellings appear (`phase`/`phases`, `will_not`/`willNot`,",
      "`risk_markers`/`riskMarkers`) both load. Writing both on one card is an `info` and the",
      "snake_case one wins. Prefer snake_case: it is what every shipped card is written in.",
      "",
      "## Required, and what happens when they are missing",
      "",
      "A missing, null, non-string or blank value on any of these is an **error**, and no card",
      "comes back at all.",
      "",
      table(
        ["key", "rule", "diagnostic"],
        [
          [
            "`id`",
            "lowercase words joined by single hyphens, at most one namespace segment: `solver`, `me/solver-a`",
            "`card/bad-id`",
          ],
          ["`name`", "any non-blank string", "`card/missing-field`"],
          ["`type`", "exactly one `node-type` term", "`card/unknown-term`, `card/wrong-term-kind`"],
          ["`action`", "non-blank; short and machine-readable", "`card/missing-field`"],
          [
            "`spec`",
            "non-blank; under 40 trimmed characters is `card/spec-too-thin`, a warning",
            "`card/missing-field`",
          ],
          [
            "`inputs`",
            "must be **present**; write `[]` explicitly when the node needs nothing",
            "`card/missing-field`",
          ],
          ["`outputs`", "must be **present**; `[]` is how a sink is declared", "`card/missing-field`"],
          ["`version`", "full semver `MAJOR.MINOR.PATCH`", "`card/bad-version`"],
        ],
      ),
      "",
      "## A port",
      "",
      table(
        ["key", "rule"],
        [
          ["`name`", "required, non-blank, **unique within its side** (`card/duplicate-port`, error)"],
          ["`type`", "required, one `data-type` term"],
          ["`description`", "optional string"],
          [
            "`required`",
            "optional boolean, **inputs only**; on an output it is an `info` and is dropped. Defaults to true.",
          ],
        ],
      ),
      "",
      "## Optional, and what they default to",
      "",
      table(
        ["key", "default", "checked against the ontology?"],
        [
          ["`phase` / `phases`", "`[]`", "yes — the five, never namespaced"],
          ["`tools`", "`[]`", "yes — `tool` terms"],
          ["`mcp`", "`[]`", "**no** — free text, installed server names"],
          ["`params`", "`{}`", "no — any JSON-serialisable mapping, nesting depth under 100"],
          ["`dependencies`", "`[]`", "no here — checked against the graph by the resolver"],
          ["`cannot`", "`[]`", "yes — `data-type` terms, and see below"],
          ["`will_not`", "`[]`", "**no** — free text, see below"],
          ["`risk_markers`", "`[]`", "yes — `risk-marker` terms"],
          ["`model`, `agent`, `skill`, `notes`, `author`, `provenance`", "absent", "no"],
        ],
      ),
      "",
      "## `cannot` and `will_not` are two prohibitions, and only one is checked",
      "",
      "Write a prohibition in the field that matches what you want to happen to it.",
      "",
      "`cannot` holds **`data-type` term ids and nothing else**. The resolver refuses any",
      "incoming edge whose *carrier* is that type or anything narrower, with",
      "`bundle/prohibition-violated`, an error. That is what turns an absent edge from a",
      "convention somebody remembered into a rule the engine holds the graph to. A sentence",
      "written here is `card/unknown-term`, an error, and the card does not load.",
      "",
      "**What counts as the carrier** decides how far the enforcement reaches, so read this",
      "twice. On an edge with no `out=` pin the carriers are **every output of the source card**,",
      "so an edge out of a node that emits the criteria at all is refused. On an edge pinned with",
      "`out=`, the carrier is **that one port**, so pinning the edge to a different port satisfies",
      "the prohibition. The bundle then loads — and the analyzer charges `criteria-leak` anyway,",
      "because its topological walk reads the graph at node level and does not care which port an",
      "edge carries. `cannot` is the fast tripwire that stops the bundle loading; the analyzer is",
      "the backstop that prices it. Neither replaces the other.",
      "",
      "`will_not` holds **your own sentences**: \"never opens a shell\", \"does not edit the code",
      "under test\". Nothing checks them, because no engine can decide a sentence against a",
      "topology. They are addressed to whoever reads the card and to the agent instantiated from",
      "it, which is a real audience and not a lesser one. Putting a `data-type` here is",
      "`card/prohibition-misfiled`, a **warning**: the card loads, the entry is shown, and",
      "nothing enforces it.",
      "",
      "Two asymmetries that decide what to put in `cannot`:",
      "",
      "- Subsumption runs one way. `cannot: [structured]` refuses an incoming",
      "  `acceptance-criteria`, because that is narrower. `cannot: [acceptance-criteria]` does",
      "  **not** refuse an incoming `structured`.",
      "- An output typed `any` never violates a narrower prohibition. Lazy typing makes the",
      "  whole mechanism unenforceable.",
      "",
      "## Who acts at the node",
      "",
      "`type`, and nothing else. A `type` subsumed by `human-in-the-loop` — `human-gate`,",
      "`human-input`, or `human-in-the-loop` itself, since subsumption is reflexive — is a node",
      "where a person acts, and every other type is a node that runs unattended. The autonomy",
      "reading, the schematic and the card page all ask that one question of that one field.",
      "",
      "There used to be a `requires_human` boolean beside it. A card could set it to `false` on",
      "a `human-gate`, or to `true` on a `tool`, and nothing refused the document. Writing it",
      "today is `card/retired-field`, a **warning**: the card still loads, the key is ignored,",
      "and the diagnostic says what the card's own `type` answers instead.",
      "",
      "## Which vocabulary a card is read against",
      "",
      "The one this build ships. A card used to declare `ontology_version`, and the engine read",
      "it against the vocabulary that string named — but a release stores its whole scorecard at",
      "publish time, so no score is ever recomputed against an older vocabulary and nothing ever",
      "asked for the older one. Terms are added and retired inside the one vocabulary with",
      "`deprecated: {since, replacedBy}`, which is what a card naming a renamed term follows.",
      "Writing `ontology_version:` today is `card/retired-field`, a **warning**, on the same",
      "terms as `requires_human`.",
      "",
      "## Re-emitting a card",
      "",
      "A published version is never edited in place. Rewriting a card's content while leaving",
      "the old file beside it is `bundle/digest-mismatch` (error). Bumping too small for what",
      "changed is `card/version-bump-too-small` (error): a changed `spec` prices as **minor**, a",
      "changed port, type or param prices as **major**. A card version nothing instantiates is",
      "`bundle/orphan-card` (warning) — delete the superseded file rather than keep it for",
      "history.",
      "",
      `## \`${SCHEMA_SOURCE}\`, verbatim`,
      "",
      "The engine's own model, quoted byte for byte. Read the sentences; the `doc 1 §3.2` style",
      "citations point at design documents that do not ship with this skill and can be ignored.",
      "",
      "```ts",
      source.trimEnd(),
      "```",
    ].join("\n") + "\n"
  );
}

/* --------------------- the manifest of generated files --------------------- */

/** One generated reference: where it lives, and the function that produces its bytes. */
export interface GeneratedRef {
  /** Repo-relative, POSIX-separated for the failure message; joined with `ROOT` to read. */
  path: string;
  render: () => string;
}

/**
 * Everything `npm run generate:skill-refs` writes, and everything the drift test checks.
 * One list, so a third reference cannot be added to the generator and forgotten by the test.
 */
export const GENERATED_REFS: readonly GeneratedRef[] = [
  { path: `${SKILL_DIR}/references/ontology.md`, render: renderOntologyReference },
  { path: `${SKILL_DIR}/references/card-schema.md`, render: renderCardSchemaReference },
];

/** Absolute path of a generated reference. The test and the writer both need it. */
export function absolutePathOf(ref: GeneratedRef): string {
  return join(ROOT, ref.path);
}
