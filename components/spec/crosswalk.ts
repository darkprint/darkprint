/* ============================================================
   The crosswalk: what a DarkPrint blueprint becomes when it is
   compiled into a file an Attractor runner takes.

   The column of attribute names is not written here. `crosswalk()`
   walks `ATTRACTOR_EMITTED_ATTRIBUTES` and `DARKPRINT_EMITTED_ATTRIBUTES`
   and looks each name up in the table below, throwing on one it
   cannot find, so the page prints exactly the names the emitter can
   write and an attribute added to the emitter fails the render rather
   than going quietly missing. The other direction, a row for a name
   nothing emits, is `crosswalk.test.ts`'s.

   That leaves this file owning what a constant cannot carry: which
   bundle field a value came from, one sentence on what the runner
   does with it, and the spec sections that say so. Those are
   transcriptions held to the spec by a person, which is why every one
   names its section. The source keys are still read off the engine
   (`ITERATION_CAP_KEYS`, `TOOL_COMMAND_KEY`) because two modules
   already had to agree about them and a page that re-typed either
   would be a third answer.

   Plain TypeScript, no JSX, so `crosswalk.test.ts` can import it
   under `environment: "node"`.
   ============================================================ */

import {
  ATTRACTOR_EMITTED_ATTRIBUTES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  ITERATION_CAP_KEYS,
  isReserved,
  type AttractorScope,
} from "@/lib/core";
/* `TOOL_COMMAND_KEY` is declared in `lib/core/card/schema.ts` and not re-exported from the
   barrel, so the import goes to the module rather than transcribing the string again. */
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
    origin: "The manifest summary.",
    reads:
      "The pipeline goal, available as $goal in prompts and graph.goal in run context (§2.5, §4.5).",
    sections: ["2.5", "4.5"],
    absent: "A blank summary omits this attribute.",
  },
  {
    scope: "graph",
    attribute: "label",
    keys: ["manifest.title"],
    origin: "The manifest title.",
    reads: "Display name for the graph; it does not affect routing (§2.5).",
    sections: ["2.5"],
    absent: "A blank title omits this attribute.",
  },

  /* --------------------- node --------------------- */
  {
    scope: "node",
    attribute: "label",
    keys: ["card.name"],
    origin: "The card name, or the DOT id when no card is present.",
    reads:
      "Display name for UI, prompts and telemetry (§2.6). LLM nodes also use it as a fallback when prompt is empty (§4.5).",
    sections: ["2.6", "4.5"],
  },
  {
    scope: "node",
    attribute: "shape",
    keys: ["card.type"],
    origin:
      "The card type, resolved through its broader parents and the handler mapping.",
    reads:
      "Selects the default handler (§2.6, §2.8).",
    sections: ["2.6", "2.8"],
    absent:
      "Unknown types and nodes without cards use box, an LLM handler, so the node is retained.",
  },
  {
    scope: "node",
    attribute: "prompt",
    keys: ["card.spec"],
    origin: "The card spec, unchanged.",
    reads:
      "The stage instruction. Supports $goal; LLM stages fall back to label when empty (§2.6, §4.5).",
    sections: ["2.6", "4.5"],
  },
  {
    scope: "node",
    attribute: "llm_model",
    keys: ["card.model"],
    origin: "The card model, quoted to preserve hyphens in the identifier.",
    reads:
      "The explicit node attribute outranks every model_stylesheet rule (§8.5).",
    sections: ["2.6", "8.4", "8.5"],
    absent:
      "No model attribute is written. The stylesheet can supply a default. An empty string would take precedence instead.",
  },
  {
    scope: "node",
    attribute: "max_retries",
    keys: ITERATION_CAP_KEYS.map((key) => `card.params.${key}`),
    origin:
      "The card’s iteration cap, using the same lookup as cycle analysis.",
    reads:
      "Additional attempts after the first execution. max_retries=3 permits four executions (§2.6).",
    sections: ["2.6", "3.5", "3.6"],
    absent:
      "Inherits graph default_max_retries, whose default is 0.",
  },
  {
    scope: "node",
    attribute: "tool_command",
    keys: [`card.params.${TOOL_COMMAND_KEY}`],
    origin:
      "The shell-tool command. Written only for the handler that uses it.",
    reads:
      "The shell command to execute. An empty command fails; there is no default (§4.10).",
    sections: ["4.10"],
    absent:
      "A missing command is omitted. The validator reports card/missing-field; an empty value would also fail at runtime.",
  },
  {
    scope: "node",
    attribute: "class",
    keys: ["card.type", "card.phases"],
    origin:
      "The type, its broader ancestors nearest-first, then the phases in card order. Names are lowercased and hyphenated with a dp- prefix.",
    reads:
      "Comma-separated classes (§2.12). Model stylesheet class selectors have specificity 2, above shape and below node id (§8.3). The runner chooses the model rules.",
    sections: ["2.10", "2.12", "8.2", "8.3"],
    absent: "Even an unknown type with no phases writes its declared type as a class.",
  },
  {
    scope: "node",
    attribute: "card",
    keys: ["card.id", "card.version"],
    origin: "The exact card reference, id@version.",
    reads:
      "Attractor ignores it: the attribute is not reserved and has no lint rule. DarkPrint readers can recover the card identity.",
    sections: ["2.5", "2.6", "2.7", "7.2", "Appendix A"],
  },
  {
    scope: "node",
    attribute: "dp_node",
    keys: [],
    origin:
      "The original topology node id, included only when export rewrites it.",
    reads:
      "Attractor ignores it. Rewriting satisfies the bare-id grammar [A-Za-z_][A-Za-z0-9_]* and avoids collisions with start/exit boundary ids (§2.3, §7.2).",
    sections: ["2.2", "2.3", "7.2"],
  },

  /* --------------------- edge --------------------- */
  {
    scope: "edge",
    attribute: "label",
    keys: [],
    origin: "The topology edge label, trimmed.",
    reads:
      "Caption and routing key for preferred-label matching (§2.7, §3.3).",
    sections: ["2.7", "3.3"],
    absent: "No label is written. Condition and weight are unaffected.",
  },
  {
    scope: "edge",
    attribute: "condition",
    keys: [],
    origin:
      "The topology condition, exported byte for byte without trimming or parsing.",
    reads:
      "A Boolean guard against the context and outcome (§2.7, §10). Invalid syntax is an error (§7.2).",
    sections: ["2.7", "7.2", "10"],
    absent: "The edge is unguarded and always eligible.",
  },
  {
    scope: "edge",
    attribute: "weight",
    keys: [],
    origin:
      "The topology weight. Numbers matching §2.2’s Integer or Float are emitted bare; other values are quoted. Both forms parse back identically.",
    reads:
      "Higher weights win among equally eligible edges (§2.7, §3.3).",
    sections: ["2.2", "2.7", "3.3"],
    absent: "Defaults to 0.",
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
