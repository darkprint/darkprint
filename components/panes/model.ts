/* ============================================================
   The synchronised panes: types, the card's block table, and selection.

   One selection shared by the drawing and the card skeleton, and the pure functions that
   turn it into the lines each pane lights up. This is the client-safe half: it imports
   nothing from `lib/core`, so a client component can pull a runtime value out of it without
   dragging the engine into the browser bundle. The half that needs the engine, the DOT
   parse that supplies every line number here, is `./build.ts`.

   A slot with nothing in it is an answer rather than a hole: a card that declares no phase,
   no tools and no risk markers is a complete card, and every empty-state string below
   states what is there rather than what is missing.
   ============================================================ */

/* --------------------- the card's blocks, as a table --------------------- */

/** The card's four blocks. Service fields sit outside them and are named as such. */
export type CardBlockId = "identity" | "behaviour" | "interfaces" | "evaluation";

export type FieldGroupId = CardBlockId | "service";

export interface CardBlockSpec {
  id: FieldGroupId;
  label: string;
  /** Where the block's fields are defined for a reader: the card spec's field list. */
  ref: { label: string; href: string };
  /** What the block is for, in one line. */
  purpose: string;
  /**
   * Wire keys in the order doc 1 lists them. Wire keys, not the engine's camelCase
   * model: pane 2 is a skeleton of the document shown in pane 4, so the two have to
   * spell the fields the same way or the correspondence they exist to teach is broken
   * by the labels.
   */
  keys: readonly string[];
}

/**
 * The skeleton, in document order. Four blocks, then the service fields.
 *
 * Doc 1 §3's closing note is the reason the fifth group is drawn apart rather than
 * folded into the fourth: identity, behaviour and interfaces serve **execution**, the
 * evaluation metadata serves DarkPrint's **static analysis**, and the service fields
 * serve neither. One file feeds both worlds and the two worlds do not read the same
 * keys, which is the single most useful thing pane 2 can say about a card.
 *
 * ── Three keys doc 1 §3 does not file under a block, placed here once ──
 * `skill`, `mcp` and `cannot` are in the schema and were in neither table: the skeleton
 * omitted them outright, and `/nodes/<id>` hard-coded its own placement for them. So the
 * blueprint page's skeleton never showed the behaviour document, the servers, or the
 * prohibition — the one field the whole enforcement argument rests on. The placement,
 * with the reason, now that it decides two surfaces rather than one:
 *
 *   skill   behaviour. It is literally the behaviour document.
 *   mcp     behaviour. What it reaches in order to do the work.
 *   cannot  interfaces. §3.3 is "what arrives, what leaves"; a prohibition is the one
 *           thing that must not arrive, and `bundle/prohibition-violated` is raised
 *           against an edge, which is the same currency as `inputs`.
 *
 * ── `will_not` sits beside `cannot`, and not in evaluation ──
 * The prohibition split put the author's own sentences in a field of their own. The
 * temptation is to file them under evaluation, next to `notes`, because nothing in the
 * engine reads them. That is the wrong reading of the block: evaluation holds the keys
 * DarkPrint's static analysis reads, and this one is read by nobody at all. What it says
 * is a statement about what may arrive on this node, which is what §3.3 is, so it belongs
 * where the reader is already looking for a prohibition. Drawing it beside `cannot` is
 * also the whole point of the split: a reader compares two adjacent slots and sees which
 * of the two the engine checks.
 *
 * ── `ontology_version` is not here either ──
 * Service used to hold a fourth key, the semver of the vocabulary the author wrote the
 * card against. The engine read it to resolve the card against that vocabulary rather than
 * the current one, and nothing ever consumed the resolution: a release stores its whole
 * scorecard when it is published, so no score is recomputed against an older vocabulary.
 * What the key produced on this pane was a version number a reader could do nothing with,
 * in the block whose purpose sentence had to name it. The version a SCORE was computed
 * under is still recorded, on the score.
 *
 * ── `requires_human` is not here, and it is not anywhere ──
 * Evaluation used to hold three keys. The first was a boolean saying whether a person
 * acts at the node, sitting one block away from the `type` that already said it, and the
 * document could answer the question twice and differently. The field is gone from the
 * schema and `type` is the whole answer, so the key that would have been drawn here is
 * not a key any more. `identity` is where a reader now finds who acts at the node, which
 * is where doc 1 §3.1 puts `type`.
 */
/** The one public definition of every field, linked rather than cited by section number. */
const CARD_SPEC = { label: "card spec", href: "/spec/card#fields-heading" } as const;

export const CARD_BLOCKS: readonly CardBlockSpec[] = [
  {
    id: "identity",
    label: "Identity",
    ref: CARD_SPEC,
    purpose: "Who the node is. The id is the key the DOT pins.",
    keys: ["id", "name", "type", "phase"],
  },
  {
    id: "behaviour",
    label: "Behaviour",
    ref: CARD_SPEC,
    purpose: "What it does, and the prose the agent is handed when the graph runs.",
    keys: ["action", "spec", "model", "agent", "skill", "tools", "mcp", "params"],
  },
  {
    id: "interfaces",
    label: "Interfaces",
    ref: CARD_SPEC,
    purpose: "What arrives, what leaves, which nodes it expects to hear from, and what may not.",
    keys: ["inputs", "outputs", "dependencies", "cannot", "will_not"],
  },
  {
    id: "evaluation",
    label: "Evaluation metadata",
    ref: CARD_SPEC,
    purpose: "The keys the static analysis reads. Nothing here instructs the agent.",
    keys: ["risk_markers", "notes"],
  },
  {
    id: "service",
    label: "Service fields",
    ref: CARD_SPEC,
    purpose: "The card's own version, and who wrote it.",
    keys: ["version", "author", "provenance"],
  },
];

/** Every wire key the skeleton draws a slot for, in block order. */
export const CARD_FIELD_KEYS: readonly string[] = CARD_BLOCKS.flatMap((b) => b.keys);

const GROUP_OF_KEY: ReadonlyMap<string, FieldGroupId> = new Map(
  CARD_BLOCKS.flatMap((block) => block.keys.map((key) => [key, block.id] as const)),
);

/** Which block a wire key belongs to, or `undefined` for a key doc 1 §3 does not list. */
export function blockOf(key: string): FieldGroupId | undefined {
  return GROUP_OF_KEY.get(key);
}

/* --------------------- the model the panes render --------------------- */

/** One slot of the skeleton, resolved against one card. */
export interface PaneField {
  /** Wire key, exactly as the YAML writes it. Also the selection id. */
  key: string;
  group: FieldGroupId;
  /** True when the card carries a value for the key. */
  filled: boolean;
  /**
   * What the card wrote, whole; what the card says instead when it wrote nothing.
   *
   * Whole, including the 979-character `spec` on the longest card in the archive. Nothing
   * is cut here and nothing is replaced by a description of itself — the renderer clamps
   * the row to two lines and unclamps it when the reader opens it, which is a rule about
   * the space on screen rather than a rule about the value, and which leaves the text in
   * the prerendered HTML for find-in-page, a printer and a reader without script.
   */
  value: string;
  /**
   * How big a long value is, in a few characters. Absent when the value is short.
   *
   * The row draws it in the meta slot beside the line range, where it survives the clamp
   * and says how much is behind the fold. `announce` reads it in place of `value`, which
   * is the load-bearing use: without it, opening the `spec` row would read a whole
   * paragraph into the live region.
   */
  measure?: string;
  /**
   * What the row's own line cannot hold at all, shown when the row is open.
   *
   * **This card's value, not the field's meaning.** Only `inputs` and `outputs` carry one
   * now: the line shows `name: type`, the half a reader can check against the DOT, and
   * what each port is *for* is a sentence per port with nowhere on that line to go. Every
   * other field's value is on the row itself, clamped, because a row that opened onto a
   * repeat of what it just showed would teach a reader that clicking does nothing.
   *
   * What the field is *for* is not here and is not per card: it is one paragraph in
   * `./field-notes.ts`, which the renderer looks up by `key`. Carrying it through this
   * model would put the same 22 paragraphs in the page payload once per node.
   */
  detail?: string;
  /** 1-based inclusive line range in the card document, when the document writes the key. */
  lines?: { start: number; end: number };
  /**
   * DOT lines of the edges this field describes. Only `dependencies` has any: it is the
   * one card field that names topology, so it is the one that can point back at a line
   * of the DOT on its own.
   */
  edgeLines?: number[];
}

/** One card, as panes 2 and 4 need it. */
export interface PaneCard {
  ref: string;
  id: string;
  name: string;
  /** The card document, verbatim. Empty when the archive holds no file behind the ref. */
  yaml: string;
  fields: PaneField[];
}

/** One node of the graph, joined to its DOT statement and its card. */
export interface PaneNode {
  nodeId: string;
  label: string;
  /**
   * 1-based line of the node's first appearance in the DOT — `DotNodeStmt.line`, which
   * the parser records rather than anything reconstructed by searching the text.
   */
  dotLine?: number;
  dotColumn?: number;
  /** DOT lines of every edge statement this node is an endpoint of, ascending, distinct. */
  edgeLines: number[];
  /** Node ids with an edge into this one. */
  sources: string[];
  /** Node ids this one has an edge into. */
  targets: string[];
  /** Absent when the DOT pins a card the bundle does not carry. */
  card?: PaneCard;
}

/**
 * Something the bundle does **not** have, declared so the panes can draw it.
 *
 * Doc 2 §5.1 is explicit that this view is where the absent edge becomes demonstrable
 * on three representations at once: missing from the drawing, missing from the DOT,
 * absent from the card's `spec`. A view that can only say "this is selected" cannot say
 * any of that, so an absence is a first-class row here and every pane has a place to
 * put one.
 */
export interface PaneAbsence {
  id: string;
  /** How the gap reads in the index, e.g. "planner ⇢ builder". */
  label: string;
  /** What is not there, stated as a fact. */
  detail: string;
  /** The node the gap concerns. The drawing rings it while the absence is selected. */
  nodeId?: string;
  /** The edge nobody drew. */
  edge?: { source: string; target: string };
  /** The DOT statement nobody wrote, and the line it would follow. */
  dot?: { text: string; afterLine: number };
  /** The card field the same gap shows up in. */
  field?: { nodeId: string; key: string };
}

/** Everything the four panes render, serializable end to end. */
export interface PaneModel {
  slug: string;
  title: string;
  /** The DOT source, verbatim. */
  dot: string;
  /** Filename for the pane header, e.g. "topology.dot". */
  dotFile: string;
  nodes: PaneNode[];
  absences: PaneAbsence[];
  /**
   * 1-based DOT line → the node ids that line names, the one the line opens with first.
   * Keys are stringified because that is what an object key is; `lineNodes` reads it.
   */
  dotLineNodes: Record<string, string[]>;
  /** 1-based DOT line → what the line is, for the accessible text of pane 3's option. */
  dotLineMeaning: Record<string, string>;
}

/* --------------------- selection --------------------- */

/**
 * One selection, shared by all four panes.
 *
 * A node is always selected: every pane needs one to have something to show, so there
 * is no empty state to design and no pane that goes blank when another is used. A field
 * and an absence are the two narrowings on top of it, and at most one of them applies.
 */
export interface PaneSelection {
  nodeId: string;
  /** Wire key of the card field in focus. */
  field?: string;
  /** Id of the absence in focus. Panes render the gap rather than a value. */
  absence?: string;
  /**
   * The exact DOT line the reader is on, when they got here through pane 3.
   *
   * Several lines resolve to one node — the statement that declares it and every edge it
   * is an endpoint of — so the node alone cannot say which row pane 3 should keep its tab
   * stop on. Carrying the line keeps the pane's keyboard position and the shared
   * selection the same fact, which is what lets the listbox hold no state of its own.
   */
  dotLine?: number;
  /** The exact card line the reader is on, when they got here through pane 4. */
  cardLine?: number;
}

/** A ghost row: something a source pane draws in the place where it is not written. */
export interface PaneGhost {
  absenceId: string;
  /** Rendered directly after this 1-based line. */
  afterLine: number;
  /** The statement nobody wrote. Absent when the gap is about prose rather than a line. */
  text?: string;
  label: string;
  detail: string;
}

/** What the four panes light up, for one selection. Everything else is rendering. */
export interface PaneFocus {
  node: PaneNode;
  card?: PaneCard;
  field?: PaneField;
  absence?: PaneAbsence;
  /** The node the drawing rings. An absence about another node moves it. */
  graphNodeId: string;
  /** DOT lines the selection is anchored on: the node's statement, and the picked line. */
  dotPrimary: number[];
  /** DOT lines of the edges in scope: the selected field's, or the node's own. */
  dotSecondary: number[];
  /** Card lines of the selected field. Empty when no field is selected. */
  yamlPrimary: number[];
  /** The row pane 3 keeps its tab stop on. */
  dotActiveLine?: number;
  /** The row pane 4 keeps its tab stop on. */
  cardActiveLine?: number;
  /** Absences pane 3 draws in place. */
  dotGhosts: PaneGhost[];
  /** Absences pane 4 draws in place, for the card currently shown. */
  yamlGhosts: PaneGhost[];
}

function inclusive(start: number, end: number): number[] {
  const out: number[] = [];
  for (let line = start; line <= end; line += 1) out.push(line);
  return out;
}

/** The node ids a DOT line names, or an empty array. */
export function lineNodes(model: PaneModel, line: number): readonly string[] {
  return model.dotLineNodes[String(line)] ?? [];
}

/** What a DOT line is, in one phrase, or `undefined` for a line that names nothing. */
export function lineMeaning(model: PaneModel, line: number): string | undefined {
  return model.dotLineMeaning[String(line)];
}

/** The nodes of this graph that pin one card ref. Usually one; a reused card gives several. */
export function nodesPinning(model: PaneModel, ref: string): PaneNode[] {
  return model.nodes.filter((node) => node.card?.ref === ref);
}

/**
 * The selection a click on a DOT line means, or `undefined` when the line names nothing.
 *
 * An edge line resolves to its **source**, which is the id the line opens with. Reading
 * a DOT line left to right and having the selection land somewhere else would teach the
 * wrong correspondence.
 */
export function selectionForDotLine(
  model: PaneModel,
  line: number,
): PaneSelection | undefined {
  const first = lineNodes(model, line)[0];
  return first === undefined ? undefined : { nodeId: first };
}

/** The wire key a card line belongs to, or `undefined` above the first key. */
export function fieldForCardLine(card: PaneCard, line: number): string | undefined {
  for (const field of card.fields) {
    if (field.lines === undefined) continue;
    if (line >= field.lines.start && line <= field.lines.end) return field.key;
  }
  return undefined;
}

/**
 * One selection resolved into what each pane highlights.
 *
 * Total by construction: a selection naming a node the model does not carry falls back
 * to the first node rather than blanking four panes at once. `undefined` comes back only
 * for a graph with no nodes in it, which the caller has to render as such anyway.
 */
export function resolveFocus(
  model: PaneModel,
  selection: PaneSelection,
): PaneFocus | undefined {
  const node =
    model.nodes.find((n) => n.nodeId === selection.nodeId) ?? model.nodes[0];
  if (node === undefined) return undefined;

  const card = node.card;
  const field =
    selection.field === undefined
      ? undefined
      : card?.fields.find((f) => f.key === selection.field);
  const absence = model.absences.find((a) => a.id === selection.absence);

  // A field that names topology narrows the edge highlight to the edges it names; every
  // other field leaves the node's own edges lit, because that is what the node is wired to.
  const scopedEdges =
    field?.edgeLines !== undefined && field.edgeLines.length > 0
      ? field.edgeLines
      : node.edgeLines;

  const dotGhosts: PaneGhost[] = [];
  for (const entry of model.absences) {
    if (entry.dot === undefined) continue;
    const ghost: PaneGhost = {
      absenceId: entry.id,
      afterLine: entry.dot.afterLine,
      text: entry.dot.text,
      label: entry.label,
      detail: entry.detail,
    };
    dotGhosts.push(ghost);
  }

  const yamlGhosts: PaneGhost[] = [];
  if (card !== undefined) {
    for (const entry of model.absences) {
      if (entry.field === undefined || entry.field.nodeId !== node.nodeId) continue;
      const anchor = card.fields.find((f) => f.key === entry.field?.key);
      if (anchor?.lines === undefined) continue;
      yamlGhosts.push({
        absenceId: entry.id,
        afterLine: anchor.lines.end,
        label: entry.label,
        detail: entry.detail,
      });
    }
  }

  // The line the reader picked in pane 3, kept only while it still names something in
  // this model. A selection made in another pane clears it; this is the guard for a
  // selection restored from somewhere that did not.
  const pickedDotLine =
    selection.dotLine !== undefined && lineNodes(model, selection.dotLine).length > 0
      ? selection.dotLine
      : undefined;

  const dotPrimary = [
    ...new Set([node.dotLine, pickedDotLine].filter((l): l is number => l !== undefined)),
  ].sort((a, b) => a - b);

  const yamlPrimary =
    field?.lines === undefined ? [] : inclusive(field.lines.start, field.lines.end);
  const pickedCardLine =
    selection.cardLine !== undefined && yamlPrimary.includes(selection.cardLine)
      ? selection.cardLine
      : yamlPrimary[0];

  const focus: PaneFocus = {
    node,
    graphNodeId: absence?.nodeId ?? node.nodeId,
    dotPrimary,
    // A line already lit as the anchor is not also listed as context.
    dotSecondary: scopedEdges.filter((line) => !dotPrimary.includes(line)),
    yamlPrimary,
    dotGhosts,
    yamlGhosts,
  };
  if (card !== undefined) focus.card = card;
  if (field !== undefined) focus.field = field;
  if (absence !== undefined) focus.absence = absence;
  const dotActive = pickedDotLine ?? node.dotLine;
  if (dotActive !== undefined) focus.dotActiveLine = dotActive;
  if (pickedCardLine !== undefined) focus.cardActiveLine = pickedCardLine;
  return focus;
}

/**
 * The sentence the live region reads out after a selection changes.
 *
 * One sentence covering all four panes, because the panes change together and four
 * announcements would arrive as four unrelated facts. Doc 2 §5.1's whole claim is that
 * these are one object seen four ways, and a screen reader has to be told that in the
 * same breath a sighted reader sees it.
 */
export function announce(model: PaneModel, focus: PaneFocus): string {
  const where =
    focus.node.dotLine === undefined
      ? "no line of the DOT declares it"
      : `DOT line ${focus.node.dotLine}`;
  const card =
    focus.card === undefined
      ? "no card is on hand for it"
      : `card ${focus.card.ref}`;

  if (focus.absence !== undefined) {
    return `${focus.absence.label} is not in this blueprint. ${focus.absence.detail} The drawing rings ${focus.graphNodeId}.`;
  }
  if (focus.field !== undefined) {
    const lines =
      focus.field.lines === undefined
        ? "the document does not write it"
        : `card lines ${focus.field.lines.start} to ${focus.field.lines.end}`;
    /* `measure` before `value`, and this is the reason `measure` exists at all. The rows
       print what the card wrote rather than a word count, so `focus.field.value` on the
       `spec` row is now up to 979 characters of prose. Announcing that would read a whole
       paragraph into the live region every time the selection moved — and the reader is
       about to meet the same paragraph in the row itself, which is in the accessible tree
       whether the row is open or not. The size is the part a one-sentence announcement can
       usefully carry. */
    const said = focus.field.measure ?? focus.field.value;
    return `Field ${focus.field.key} of ${card}, ${said}. Selected on node ${focus.node.nodeId}, ${where}, ${lines}.`;
  }
  return `Node ${focus.node.nodeId}, ${focus.node.label}. ${where}, ${card}. ${model.nodes.length} nodes in the graph.`;
}
