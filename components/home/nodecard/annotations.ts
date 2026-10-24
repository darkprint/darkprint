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
      "The graph pins `code-builder` by version. `agent` means a model performs the work; `implementation` is its lifecycle phase.",
  },
  {
    id: "action",
    keys: ["action"],
    title: "What it does, in a line",
    body:
      "`action` is a one-line description for readers. The validator does not check it. `spec` contains the instructions given to the agent.",
  },
  {
    id: "spec",
    keys: ["spec"],
    title: "The brief it is handed",
    body:
      "The instructions your runner uses on your own machine. They must stand alone: the agent does not see the rest of the graph. Fewer than forty characters raises `card/spec-too-thin`.",
  },
  {
    id: "model",
    keys: ["model"],
    title: "The model it runs on",
    body:
      // The model line lands in the compiled graph and never in `topology.dot`, which
      // carries no `model` at all.
      "Export writes this model as `llm_model`. Spec §8.5 ranks an explicit node attribute above every model stylesheet rule. DarkPrint emits no stylesheet. Without a model, the node inherits the run’s configuration.",
  },
  {
    id: "reach",
    keys: ["tools", "mcp"],
    title: "What it can reach",
    body:
      "`tools` is empty and `mcp` names the filesystem server. Read these declarations before running the blueprint.",
  },
  {
    id: "skill",
    keys: ["skill"],
    title: "The behaviour document",
    body:
      "A path to the node’s behaviour document. The validator does not read it, and skill documents are not included in downloads. The README lists the paths you must supply.",
  },
  {
    id: "inputs",
    keys: ["inputs"],
    title: "What arrives",
    body:
      "The input `brief` has type `plan`. The validator checks incoming edges against this type. In the starter graph, no edge enters this node; the runner supplies the brief.",
  },
  {
    id: "outputs",
    keys: ["outputs"],
    title: "What it hands on",
    body:
      "The output `build` has type `code`. It feeds the acceptance tester. Incompatible input and output types report `bundle/type-mismatch`.",
  },
  {
    /* Two keys, one step, and the walk still has nine parts: `geometry.ts` sizes the rail
       for a fixed count, and the thing worth showing is the pair. A reader who sees
       `cannot` alone learns what is checked and nothing about the promise under it. */
    id: "cannot",
    keys: ["cannot", "will_not"],
    title: "What must never arrive",
    body:
      "`cannot` declares checked data-type prohibitions. Receiving `acceptance-criteria` fails the blueprint with `bundle/prohibition-violated`. `will_not` contains behavioural promises the validator cannot check.",
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
