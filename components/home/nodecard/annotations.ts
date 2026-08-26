/* ============================================================
   The nine things spec §3.2 asks this card to be read for, in the
   order they are written down.

   ── The order is document order, and that is now a rule ──
   It used to be reading order: the table in the spec puts `skill`
   before `tools`/`mcp`, and this file followed it, so step 3 pointed
   at line 22 and step 4 pointed back up at line 19. Every quantity
   in `geometry.ts` follows the run being read, so scrolling DOWN
   through that pair slid the listing DOWN too and the highlight
   climbed the card. The author, watching it: "when scrolling down,
   the highlighted elements should be ordered from top to bottom.
   Right now, sometimes scrolling down, highlight something above."

   A scroll-driven figure makes exactly one promise, which is that
   the reader's gesture and the drawing move the same way, and no
   argument about the ideal order of two facts is worth breaking it.
   So the sequence is the file's own: identity, what it does, the
   brief it is handed, what runs it, what it reaches, where its
   behaviour is written, what arrives, what it hands on, and what
   must never arrive. `nodecard.test.ts` asserts the resolved line
   ranges are strictly increasing, so the next person to add a step
   cannot reintroduce this by putting it in the wrong place.

   Steps annotate a KEY GROUP rather than a line: `identity` covers
   the four lines that name the node, `reach` covers `tools` and
   `mcp` together because neither answers "what can it touch" alone.
   The group is the unit a reader thinks in and the unit the leader
   line points at.

   ── Every claim below is one the site can be held to ──
   - step 2's "checked by nothing" is `lib/core/card/validate.ts`,
     which reads `action` for presence and never for content;
   - step 3's forty characters is `card/spec-too-thin`, raised at
     warning severity;
   - step 4's `llm_model` is what `lib/core/attractor/emit.ts`
     writes, and Attractor spec §8's model stylesheet is what can
     override it;
   - step 6's "the engine reads nothing at the other end" is
     `lib/core/card/schema.ts` on `skill`, and the missing folder is
     the paragraph `lib/content/bundle-export.ts` puts in every
     bundle README;
   - step 8's mismatch is `bundle/port-mismatch`;
   - step 9 is `lib/core/bundle/resolve.ts`'s `checkProhibitions`,
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
      "version. `agent` is the node type: this box runs a model, not a script. " +
      "`implementation` places it in the lifecycle the ontology defines.",
  },
  {
    id: "action",
    keys: ["action"],
    title: "What it does, in a line",
    body:
      "The operation, in one sentence a person can read at a glance. Nothing in the engine " +
      "checks it. `action` is prose for whoever opens the card. It travels into the " +
      "download unchanged. The instruction the agent is actually handed is the block under it.",
  },
  {
    id: "spec",
    keys: ["spec"],
    title: "The brief it is handed",
    body:
      "The prose an agent is given when somebody instantiates this graph on their own machine. " +
      "It has to stand alone, because whatever reads it never sees the rest of the graph. Only " +
      "its length is checked here: under forty characters raises `card/spec-too-thin`.",
  },
  {
    id: "model",
    keys: ["model"],
    title: "The model it runs on",
    body:
      // The runnable file is named on `/blueprints/[slug]`'s download panel, not here: the
      // author asked for `factory.dot` off the landing, and this walk renders there. The
      // claim is unchanged — the model line really does land in the compiled export and
      // NOT in `topology.dot`, which carries no `model` at all — only the name is gone.
      "The model this agent is instantiated with. The compiled export writes it as " +
      "`llm_model`. Attractor reads that field. A model stylesheet can override it at run " +
      "time. A card with no such line inherits whatever the run supplies.",
  },
  {
    id: "reach",
    keys: ["tools", "mcp"],
    title: "What it can reach",
    body:
      "`tools` is empty. `mcp` names one server. This node touches the filesystem and " +
      "nothing else. The reach of a whole factory can be read off its cards before anything " +
      "runs.",
  },
  {
    id: "skill",
    keys: ["skill"],
    title: "The behaviour document",
    body:
      "`skills/code-builder.md` is where this agent's behaviour is written. The field is a " +
      "pointer. The engine reads nothing at the other end. No skill document travels in " +
      "the download. Each bundle's README lists the paths you supply yourself.",
  },
  {
    id: "inputs",
    keys: ["inputs"],
    title: "What arrives",
    body:
      "One input. It carries a type. `brief` is a `plan`, an ontology term, not free " +
      "text. The resolver checks an incoming edge against it. In the starter factory " +
      "nothing points at this node. The brief arrives with the run.",
  },
  {
    id: "outputs",
    keys: ["outputs"],
    title: "What it hands on",
    body:
      "One output, typed the same way. `build` is `code`. It is what the edge to the " +
      "acceptance tester carries. A downstream node declares its own input against that " +
      "type. A mismatch is reported as `bundle/port-mismatch`.",
  },
  {
    id: "cannot",
    keys: ["cannot"],
    title: "What must never arrive",
    body:
      "The prohibition. The engine holds the graph to it. `acceptance-criteria` names an " +
      "ontology data type. An edge carrying it into this node fails the bundle with " +
      "`bundle/prohibition-violated`. The second entry names no term. It is read as free text.",
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
