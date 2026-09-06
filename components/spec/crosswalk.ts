/* ============================================================
   The crosswalk: what a DarkPrint bundle becomes when it is
   compiled into a file an Attractor runner takes.

   §11.0 Q20 (b). The owner chose a dedicated route over appending
   an Attractor clause to each field row on `/spec/card`, and gave
   two reasons: it is one URL you can hand a stranger, and a page
   rendered from constants cannot go stale. This file is the second
   half of that. It carries the prose a table needs and nothing a
   table can read off the engine.

   ── the rule this file exists to keep ──
   The COLUMN OF ATTRIBUTE NAMES IS NOT WRITTEN HERE. `crosswalk()`
   walks `ATTRACTOR_EMITTED_ATTRIBUTES` and
   `DARKPRINT_EMITTED_ATTRIBUTES` — the two halves of `emit.ts`'s
   private / runtime-read line — and looks each name up in the table
   below, throwing on one it cannot find. So the page prints exactly
   the names the emitter can write, in the order the emitter writes
   them, and an attribute added to the emitter fails the render
   instead of quietly going missing from the page that claims to
   list them all. The other direction (a row here for a name nothing
   emits) is `crosswalk.test.ts`'s.

   That leaves this file owning three things a constant cannot
   carry: which bundle field the value came from, one sentence on
   what the runner does with it, and the spec sections that say so.
   Those are transcriptions, and they are held to the spec by a
   person rather than by a test, which is why every one of them
   names its section — the same discipline `reserved.ts` applies to
   the reserved sets it transcribes.

   ── why the source keys are still read off the engine ──
   `from` is prose and `keys` is not. The three spellings of the
   iteration cap and the one spelling of the tool command are
   exported constants (`ITERATION_CAP_KEYS`, `TOOL_COMMAND_KEY`),
   because two modules already had to agree about them, and a page
   that re-typed either would be a third answer. A reader checking
   whether their card's `maxIterations` survives the export is
   reading the array the emitter reads.

   Plain TypeScript, no JSX and no React, so `crosswalk.test.ts` can
   import it under `environment: "node"` and hold it against the
   engine's own constants.
   ============================================================ */

import {
  ATTRACTOR_EMITTED_ATTRIBUTES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  ITERATION_CAP_KEYS,
  isReserved,
  type AttractorScope,
} from "@/lib/core";
/* Deep import, and it is the only one on this route.

   `TOOL_COMMAND_KEY` is declared in `lib/core/card/schema.ts` and not re-exported from
   `lib/core/index.ts`, which is the barrel every other component on this site binds to.
   Publishing it there is the right fix and that file belongs to another lane this pass,
   so the import goes to the module rather than the page transcribing the string a fourth
   time. Reported as owed. */
import { TOOL_COMMAND_KEY } from "@/lib/core/card/schema";

/**
 * One line of the compiled file, and where its value came from.
 *
 * `attribute` is the key half of a lookup rather than a column somebody typed: nothing
 * renders this array directly, and `crosswalk()` reaches every row through the emitter's
 * own lists. A row whose `attribute` matches no emitted name is unreachable, and the test
 * fails on it rather than letting it sit here reading as documentation.
 */
export interface CrosswalkRow {
  /** Where the attribute is attached, which is what makes the name meaningful at all. */
  scope: AttractorScope;
  /** The attribute name, exactly as `emit.ts` writes it. */
  attribute: string;
  /**
   * The bundle keys the value is read from, spelled as a card or manifest spells them.
   *
   * Empty for a value that is not a field: an edge's `weight` is written on the edge in
   * `topology.dot`, and there is no card key to name. `origin` carries that case.
   */
  keys: readonly string[];
  /** One sentence on where the value comes from, for the rows a key cannot answer. */
  origin: string;
  /** What the runner does with it. Quoted from, or directly backed by, `sections`. */
  reads: string;
  /** The spec sections that state `reads`. Cited, never implied. */
  sections: readonly string[];
  /**
   * What the compiled file says when the bundle declares nothing, or `undefined` when
   * the attribute is written unconditionally.
   *
   * A real answer and never a gap. Half the rows below turn on it: `llm_model=""` would
   * beat the stylesheet §8.5 puts underneath it, and `goal=""` claims the goal is the
   * empty string rather than that the blueprint declares none.
   */
  absent?: string;
}

/**
 * Every row, keyed by scope and attribute. Order is irrelevant here and settled by
 * `crosswalk()`, which reads it off the emitter.
 *
 * Written as an array rather than a nested record so a scope is a field a reader can see
 * on the row it belongs to. `label` appears three times in this file and means three
 * different things, which is the whole reason `AttractorScope` exists.
 */
const ROWS: readonly CrosswalkRow[] = [
  /* --------------------- graph --------------------- */
  {
    scope: "graph",
    attribute: "goal",
    keys: ["manifest.summary"],
    origin: "The bundle manifest's one-line summary.",
    reads:
      "§2.5: “Human-readable goal for the pipeline. Exposed as $goal in prompt templates and mirrored into the run context as graph.goal.” Every prompt on the graph can therefore expand it.",
    sections: ["2.5", "4.5"],
    absent: "A manifest with a blank summary writes no goal attribute at all.",
  },
  {
    scope: "graph",
    attribute: "label",
    keys: ["manifest.title"],
    origin: "The bundle manifest's title.",
    reads: "§2.5: “Display name for the graph (used in visualization).” Nothing routes on it.",
    sections: ["2.5"],
    absent: "A manifest with a blank title writes no label attribute.",
  },

  /* --------------------- node --------------------- */
  {
    scope: "node",
    attribute: "label",
    keys: ["card.name"],
    origin: "The card's human name. A node with no card is labelled with its own DOT id.",
    reads:
      "§2.6: “Display name shown in UI, prompts, and telemetry.” §4.5 also falls back to it as the prompt when a codergen node has none, so it is a routing-visible string and not only a caption.",
    sections: ["2.6", "4.5"],
  },
  {
    scope: "node",
    attribute: "shape",
    keys: ["card.type"],
    origin:
      "The card's ontology type, resolved through its broader chain and then through the type table below.",
    reads:
      "§2.6: “Graphviz shape. Determines the default handler type.” §2.8 is the mapping, and it is the whole reason a DarkPrint type never travels as a DOT attribute.",
    sections: ["2.6", "2.8"],
    absent:
      "A type the vocabulary has never heard of, and a node with no card at all, both get box. That runs the card's spec as a prompt instead of dropping the node.",
  },
  {
    scope: "node",
    attribute: "prompt",
    keys: ["card.spec"],
    origin: "The card's spec, verbatim. This is the field that makes a topology runnable.",
    reads:
      "§2.6: “Primary instruction for the stage. Supports $goal variable expansion. Falls back to label if empty for LLM stages.” §4.5 step 1 is that fallback in pseudocode.",
    sections: ["2.6", "4.5"],
  },
  {
    scope: "node",
    attribute: "llm_model",
    keys: ["card.model"],
    origin: "The model the card names, quoted as a String because a dash ends a bare token.",
    reads:
      "§2.6: “LLM model identifier. Overridable by stylesheet.” §8.5 puts an explicit node attribute above every stylesheet rule.",
    sections: ["2.6", "8.4", "8.5"],
    absent:
      "A card naming no model writes no attribute, so the graph's model_stylesheet still decides. Writing an empty string here would beat the sheet under §8.5 rather than defer to it.",
  },
  {
    scope: "node",
    attribute: "max_retries",
    keys: ITERATION_CAP_KEYS.map((key) => `card.params.${key}`),
    origin:
      "The iteration cap the card declares, read by the same function that decides whether a cycle is charged as unbounded.",
    reads:
      "§2.6: “Number of additional attempts beyond the initial execution. If omitted, inherits graph default_max_retries. max_retries=3 means up to 4 total executions.” So a cap of 3 is four passes, not three.",
    sections: ["2.6", "3.5", "3.6"],
    absent:
      "A card declaring no cap writes no attribute, and the node inherits the graph's default_max_retries, which is 0.",
  },
  {
    scope: "node",
    attribute: "tool_command",
    keys: [`card.params.${TOOL_COMMAND_KEY}`],
    origin:
      "The shell command a shell-tool card carries. Written only when the node's shape selects §4.10's handler, since no other handler reads it.",
    reads:
      "§4.10 reads it bare and refuses the node without it: “IF command is empty: RETURN Outcome(status=FAIL, failure_reason=‘No tool_command specified’)”. It has no default anywhere in the spec.",
    sections: ["4.10"],
    absent:
      "A shell-tool card with no command writes no attribute. That is deliberate: an empty string is the value §4.10 fails on, so the file leaves the header free to say the node has no command yet.",
  },
  {
    scope: "node",
    attribute: "class",
    keys: ["card.type", "card.phases"],
    origin:
      "The card's type, then its broader chain nearest-first, then its phases in the card's own order, each lowercased and hyphenated behind a dp- prefix.",
    reads:
      "§2.12: “Classes are comma-separated.” §8.3 makes .class_name a stylesheet selector at specificity 2, above a shape and below a node id, which is what hands the reader model routing DarkPrint states no opinion about.",
    sections: ["2.10", "2.12", "8.2", "8.3"],
    absent: "A card with no phases and an unknown type still writes its declared type as one class.",
  },
  {
    scope: "node",
    attribute: "card",
    keys: ["card.id", "card.version"],
    origin: "The pinned card ref, id@version, joined the way a DOT node already pins one.",
    reads:
      "Nothing. It is in none of §2.5, §2.6 or §2.7, in none of Appendix A's three tables, and no §7.2 lint rule is about an attribute name the tables do not carry. This one row is the compatibility claim.",
    sections: ["2.5", "2.6", "2.7", "7.2", "Appendix A"],
  },
  {
    scope: "node",
    attribute: "dp_node",
    keys: [],
    origin:
      "The node's original id in topology.dot, written only when the id had to be rewritten to reach the file.",
    reads:
      "Nothing, for the same reason as card. It exists because §2.3 requires “bare identifiers for node IDs” matching [A-Za-z_][A-Za-z0-9_]*, and because a node called start or exit collides with §7.2's start_node and terminal_node rules. The rewritten node keeps its real name here.",
    sections: ["2.2", "2.3", "7.2"],
  },

  /* --------------------- edge --------------------- */
  {
    scope: "edge",
    attribute: "label",
    keys: [],
    origin: "The label the edge carries in topology.dot, trimmed.",
    reads:
      "§2.7: “Human-facing caption and routing key. Used for preferred-label matching in edge selection.” §3.3 is where that matching happens.",
    sections: ["2.7", "3.3"],
    absent: "An unlabelled edge writes no label attribute, and its two siblings below are unaffected.",
  },
  {
    scope: "edge",
    attribute: "condition",
    keys: [],
    origin:
      "The condition the edge declares, carried byte for byte and never trimmed. It is input to somebody else's parser.",
    reads:
      "§2.7: “Boolean guard expression evaluated against the current context and outcome.” §10 is the grammar it has to parse under, and §7.2's condition_syntax rule is an ERROR when it does not.",
    sections: ["2.7", "7.2", "10"],
    absent: "An edge with no condition is unguarded and always eligible.",
  },
  {
    scope: "edge",
    attribute: "weight",
    keys: [],
    origin:
      "The weight the edge declares. Emitted bare when it looks like a number under §2.2's Integer or Float, quoted otherwise, and both spellings parse back the same.",
    reads:
      "§2.7: “Numeric priority for edge selection. Higher weight wins among equally eligible edges.”",
    sections: ["2.2", "2.7", "3.3"],
    absent: "An edge with no weight takes §2.7's default of 0.",
  },
];

/** `${scope}:${attribute}`, the identity of a row. */
function key(scope: AttractorScope, attribute: string): string {
  return `${scope}:${attribute}`;
}

const BY_KEY = new Map(ROWS.map((row) => [key(row.scope, row.attribute), row]));

/**
 * Every attribute the emitter can write in one scope, in the order it writes them:
 * Attractor's own names first, then the two DarkPrint parks beside them.
 *
 * Exported for the test, which holds the declared rows to exactly this population. The
 * page never calls it directly — it calls `crosswalk()` and gets the rows.
 */
export function emittedIn(scope: AttractorScope): readonly string[] {
  return [...ATTRACTOR_EMITTED_ATTRIBUTES[scope], ...DARKPRINT_EMITTED_ATTRIBUTES[scope]];
}

/** One rendered row: the declaration, plus what the reserved sets say about the name. */
export interface CrosswalkEntry extends CrosswalkRow {
  /**
   * Whether Attractor reserves this name in this position, asked of `isReserved` at render
   * time rather than stored on the row.
   *
   * A stored boolean would be a second copy of the reserved sets, and the one row on the
   * page that matters most is the one where the answer is `false`. If a later Attractor
   * revision reserves `card`, this page says so on the next build and the claim it makes
   * changes with it, which is what the whole compatibility argument rests on.
   */
  reserved: boolean;
}

/**
 * The crosswalk for one scope, ordered and completed from the emitter's own lists.
 *
 * Throws on an emitted name with no row here. That is the same argument `specNeighbours`
 * makes about an unknown route: the failure it prevents is a page that renders a table
 * headed "everything a bundle writes" with one line quietly missing, which no build and no
 * type would otherwise catch. A new emitted attribute is a docs change, and this is what
 * makes it one.
 */
export function crosswalk(scope: AttractorScope): readonly CrosswalkEntry[] {
  return emittedIn(scope).map((attribute) => {
    const row = BY_KEY.get(key(scope, attribute));
    if (row === undefined) {
      throw new Error(
        `\`${attribute}\` is emitted on a ${scope} and has no crosswalk row in components/spec/crosswalk.ts`,
      );
    }
    return { ...row, reserved: isReserved(scope, attribute) };
  });
}

/** The three scopes, in the order the spec tabulates them and the emitter writes them. */
export const CROSSWALK_SCOPES: readonly AttractorScope[] = ["graph", "node", "edge"];
