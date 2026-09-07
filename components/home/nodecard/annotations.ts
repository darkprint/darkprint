/* ============================================================
   The nine parts a node card is read for, in the order the file
   writes them.

   Document order is a rule, not a preference. A scroll-driven figure
   makes one promise, that the reader's gesture and the drawing move
   the same way, and a step list in reading order once sent the
   highlight back up the card while the reader scrolled down it.
   `nodecard.test.ts` asserts the resolved line ranges are strictly
   increasing so a new step cannot reintroduce that.

   Steps annotate a key group rather than a line: `identity` covers
   the four lines that name the node, `reach` covers `tools` and `mcp`
   together because neither answers "what can it touch" alone.

   Every claim below is one the site can be held to:
   - "nothing checks it" on `action` is `lib/core/card/validate.ts`,
     which reads the field for presence and never for content;
   - forty characters on `spec` is `card/spec-too-thin`, a warning;
   - `llm_model` is what `lib/core/attractor/emit.ts` writes, and
     Attractor spec §8.5 puts an explicit node attribute above every
     stylesheet rule, which is the direction `rows.test.ts` holds
     every `model` sentence to;
   - nothing reads what `skill` points at (`lib/core/card/schema.ts`),
     and the missing document is the paragraph
     `lib/content/bundle-export.ts` puts in every README;
   - an output/input type mismatch is `bundle/type-mismatch`;
   - `cannot` is `lib/core/bundle/resolve.ts`'s `checkProhibitions`,
     which raises `bundle/prohibition-violated` at error severity.

   `nodecard.test.ts` caps every body at 300 characters, because the
   figure's height is the listing's and a longer body pins the walk
   off-centre.
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
      "version. `agent` is the node type: a model runs this box. " +
      "`implementation` places it in the lifecycle the vocabulary defines.",
  },
  {
    id: "action",
    keys: ["action"],
    title: "What it does, in a line",
    body:
      "The operation, in one sentence a person can read at a glance. Nothing checks it. " +
      "`action` is prose for whoever opens the card. It travels into the " +
      "download unchanged. The instruction the agent is handed is the block under it.",
  },
  {
    id: "spec",
    keys: ["spec"],
    title: "The brief it is handed",
    body:
      "The prose an agent is given when somebody runs this graph on their own machine. " +
      "It has to stand alone, because whatever reads it never sees the rest of the graph. Only " +
      "its length is checked here: under forty characters raises `card/spec-too-thin`.",
  },
  {
    id: "model",
    keys: ["model"],
    title: "The model it runs on",
    body:
      // The model line lands in the compiled graph and never in `topology.dot`, which
      // carries no `model` at all.
      "The model this agent runs on. The compiled graph writes it as " +
      "`llm_model`, and Attractor reads that field. Spec §8.5 ranks an explicit node " +
      "attribute above every model stylesheet rule, and DarkPrint writes none. A card " +
      "with no such line inherits whatever the run supplies.",
  },
  {
    id: "reach",
    keys: ["tools", "mcp"],
    title: "What it can reach",
    body:
      "`tools` is empty. `mcp` names one server. This node touches the filesystem and " +
      "nothing else. The reach of a whole blueprint can be read off its cards before " +
      "anything runs.",
  },
  {
    id: "skill",
    keys: ["skill"],
    title: "The behaviour document",
    body:
      "`skills/code-builder.md` is where this agent's behaviour is written. The field is a " +
      "pointer. Nothing here reads what it points at, and no skill document travels in " +
      "the download. Each blueprint's README lists the paths you supply yourself.",
  },
  {
    id: "inputs",
    keys: ["inputs"],
    title: "What arrives",
    body:
      "One input, and it carries a type. `brief` is a `plan`, a term from the shared vocabulary " +
      "rather than free text. The validator checks an incoming edge against it. In the " +
      "starter blueprint nothing points at this node. The brief arrives with the run.",
  },
  {
    id: "outputs",
    keys: ["outputs"],
    title: "What it hands on",
    body:
      "One output, typed the same way. `build` is `code`. It is what the edge to the " +
      "acceptance tester carries. A downstream node declares its own input against that " +
      "type. A mismatch is reported as `bundle/type-mismatch`.",
  },
  {
    /* Two keys, one step, and the walk still has nine parts: `geometry.ts` sizes the rail
       for a fixed count, and the thing worth showing is the pair. A reader who sees
       `cannot` alone learns what is checked and nothing about the promise under it. */
    id: "cannot",
    keys: ["cannot", "will_not"],
    title: "What must never arrive",
    body:
      "Two fields, because the validator can hold the graph to only one of them. `cannot` " +
      "takes data types: an edge carrying `acceptance-criteria` in fails the whole blueprint " +
      "with `bundle/prohibition-violated`. `will_not` takes the author's sentences, and " +
      "nothing reads those.",
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
 * are correct by design (a card with no `model` inherits), so the section has to survive
 * being pointed at one, and a leader line drawn to a line the reader is not looking at is
 * worse than an annotation that is not there.
 *
 * Dropping a step cannot disturb the order: the specs are already in document order, so
 * any subsequence of them is too. What it does disturb is the rail's arithmetic, which is
 * sized for a fixed count (`geometry.ts`), and that is why the two live next to each
 * other rather than one being derived from the archive.
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
