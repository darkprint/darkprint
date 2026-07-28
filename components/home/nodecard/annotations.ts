/* ============================================================
   The seven things spec §3.2 asks this card to be read for, in
   the order it asks for them.

   The table in the spec is the contract, including its ordering,
   which is why step 3 (`skill`) points further down the file than
   step 4 (`tools` / `mcp`) does. The order is the order a reader
   needs the facts in rather than the order the author happened to
   write the keys in.

   Every claim below is one the site can be held to:

   - step 2's `llm_model` is what `lib/core/attractor/emit.ts`
     writes, and Attractor spec §8's model stylesheet is what can
     override it;
   - step 3's "the engine reads nothing at the other end" is
     `lib/core/card/schema.ts` on `skill`, and the missing folder is
     the paragraph `lib/content/bundle-export.ts` puts in every
     bundle README;
   - step 6's mismatch is `bundle/port-mismatch`;
   - step 7 is `lib/core/bundle/resolve.ts`'s `checkProhibitions`,
     which raises `bundle/prohibition-violated` at error severity
     when an incoming edge's source declares an output of the
     prohibited type or of a narrower one.

   Bodies are written to fit the fixed body box the choreographed
   layout gives them (`geometry.ts`, `NC.body`). `nodecard.test.ts`
   holds them to a length that fits, because a body that overflows
   is clipped rather than scrolled and the sentence that gets cut is
   always the last one, which is where the consequence is.
   ============================================================ */

import { keySpan } from "./yaml";

export interface AnnotationSpec {
  /** Stable handle, used for React keys and for `data-viz-id`-style hooks. */
  readonly id: string;
  /** Top-level keys this step attaches to, resolved by name in `yaml.ts`. */
  readonly keys: readonly string[];
  /** One line. Sits in the rail, so it has to survive at 36px. */
  readonly title: string;
  /** Prose. Backticked identifiers render as inline code. */
  readonly body: string;
}

export const NODE_CARD_ANNOTATIONS: readonly AnnotationSpec[] = [
  {
    id: "identity",
    keys: ["id", "name", "type", "phase"],
    title: "What this node is",
    body:
      "The first four lines fix the node's identity. `code-builder` is the id a graph pins by " +
      "version, `agent` is the node type, so this box runs a model rather than a script, and " +
      "`implementation` places it in the lifecycle the ontology defines.",
  },
  {
    id: "model",
    keys: ["model"],
    title: "The model it runs on",
    body:
      "The model this agent is instantiated with. The export writes it into `factory.dot` as " +
      "`llm_model`, which Attractor reads, and a model stylesheet can override it at run time. " +
      "A card with no such line inherits whatever the run supplies.",
  },
  {
    id: "skill",
    keys: ["skill"],
    title: "The behaviour document",
    body:
      "`skills/code-builder.md` is where this agent's behaviour is written. The field is a " +
      "pointer and the engine reads nothing at the other end, so no skill document travels in " +
      "the download. Each bundle's README lists the paths you supply yourself.",
  },
  {
    id: "reach",
    keys: ["tools", "mcp"],
    title: "What it can reach",
    body:
      "`tools` is empty and `mcp` names one server, so this node touches the filesystem and " +
      "nothing else. The reach of a whole factory can be read off its cards before anything is " +
      "run, which is why it is written down here at all.",
  },
  {
    id: "inputs",
    keys: ["inputs"],
    title: "What arrives",
    body:
      "One input, and it carries a type. `brief` is a `plan`, an ontology term rather than free " +
      "text, so the resolver can check an incoming edge against it. In the starter factory " +
      "nothing points at this node, and the brief arrives with the run.",
  },
  {
    id: "outputs",
    keys: ["outputs"],
    title: "What it hands on",
    body:
      "One output, typed the same way. `build` is `code`, and it is what the edge to the " +
      "acceptance tester carries. A downstream node declares its own input against that type, " +
      "and a mismatch is reported as `bundle/port-mismatch`.",
  },
  {
    id: "cannot",
    keys: ["cannot"],
    title: "What must never arrive",
    body:
      "The prohibition, and the engine holds the graph to it. `acceptance-criteria` names an " +
      "ontology data type, so an edge carrying it into this node fails the bundle with " +
      "`bundle/prohibition-violated`. The second entry names no term and is read as free text.",
  },
];

export interface ResolvedAnnotation extends AnnotationSpec {
  /** 1-based position in the sequence a reader walks. */
  readonly step: number;
  /** First and last line of the run this step points at, 1-based and inclusive. */
  readonly from: number;
  readonly to: number;
}

/**
 * The steps this particular card can actually carry, numbered by position.
 *
 * A step whose keys are all absent is dropped rather than pointed at line 1. Sparse cards
 * are correct by design (spec §2b: "a card with no `model` inherits"), so the section has
 * to survive being pointed at one, and a leader line drawn to a line the reader is not
 * looking at is worse than an annotation that is not there.
 */
export function resolveAnnotations(
  source: string,
  specs: readonly AnnotationSpec[] = NODE_CARD_ANNOTATIONS,
): ResolvedAnnotation[] {
  const out: ResolvedAnnotation[] = [];
  for (const spec of specs) {
    const range = keySpan(source, spec.keys);
    if (range === undefined) continue;
    out.push({ ...spec, step: out.length + 1, from: range.from, to: range.to });
  }
  return out;
}
