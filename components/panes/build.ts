/* ============================================================
   The four-pane synchronised view — the build-time half
   ------------------------------------------------------------
   Turns a resolved bundle into the serializable `PaneModel` the
   client renders. This is the only file in `components/panes/`
   that imports a runtime value from `lib/core`, and it is called
   from a server component, so the engine stays out of the browser
   bundle.

   The line numbers are the point of this module. Doc 2 §5.1 wants
   a click on a node to light the line that declares it, which
   needs a mapping from a node id to a position in a text file.
   The DOT parser already records one — `DotNodeStmt.line` and
   `DotEdgeStmt.line`, both 1-based — so nothing here searches the
   source for a name. A string search would find the id inside a
   comment, inside a quoted card ref, and inside a longer id that
   contains it, and would silently disagree with the parser about
   what the file says.

   PURE, and total: a DOT that will not parse yields a model with
   no line numbers rather than an exception. Every page that
   mounts this view has already been through `loadBundle`, so a
   broken DOT cannot reach it from the archive; a bundle dropped
   into the upload wizard can.
   ============================================================ */

import { parseDot, type NodeCard } from "@/lib/core";
import type {
  PaneAbsence,
  PaneCard,
  PaneField,
  PaneModel,
  PaneNode,
} from "./model";
import { CARD_BLOCKS } from "./model";

/* --------------------- what the caller supplies --------------------- */

/** One drawn node, joined to whatever the archive holds behind it. */
export interface PaneNodeInput {
  /** DOT node id. */
  nodeId: string;
  /** The name the drawing prints on it. */
  label: string;
  /** Pinned `id@version`, when the DOT pins one. */
  ref?: string;
  /** The resolved card. Absent when the bundle carries no card for the ref. */
  card?: NodeCard;
  /** The card document, verbatim. Absent when the archive holds only the resolved card. */
  yaml?: string;
}

/** One declared gap, before its position in the DOT has been worked out. */
export interface PaneAbsenceInput {
  id: string;
  label: string;
  detail: string;
  /** The node the gap concerns. Defaults to the target of `edge`. */
  nodeId?: string;
  edge?: { source: string; target: string };
  /** The statement nobody wrote. Defaults to `source -> target;`. */
  dotText?: string;
  /** The card field the same gap shows up in. */
  field?: { nodeId: string; key: string };
}

export interface PaneModelInput {
  slug: string;
  title: string;
  dot: string;
  /** Filename for pane 3's header. */
  dotFile?: string;
  /** Drawn nodes, in the order the DOT declares them. */
  nodes: readonly PaneNodeInput[];
  absences?: readonly PaneAbsenceInput[];
}

/* --------------------- the card document --------------------- */

/**
 * Top-level keys of a card document, mapped to the 1-based inclusive line range each
 * one owns.
 *
 * A key owns every line from its own down to the line before the next top-level key,
 * with trailing blank lines trimmed off so a block ends on the last line that says
 * something. That is enough for a card: doc 1 §3's schema is a flat mapping of scalars,
 * lists and one nested `params`, all of it indented under a key in column 0, and the
 * archive's documents are hand-written in exactly that shape.
 *
 * A key written twice keeps its first range. A document that does that is malformed and
 * the card validator rejects it; picking the first occurrence only makes this function
 * deterministic on the way there.
 */
export function cardYamlBlocks(text: string): Map<string, { start: number; end: number }> {
  const lines = text.split("\n");
  const KEY = /^([A-Za-z_][A-Za-z0-9_]*):/;

  const heads: { key: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = KEY.exec(lines[i]);
    if (match !== null) heads.push({ key: match[1], line: i + 1 });
  }

  const out = new Map<string, { start: number; end: number }>();
  for (let i = 0; i < heads.length; i += 1) {
    const start = heads[i].line;
    const nextStart = i + 1 < heads.length ? heads[i + 1].line : lines.length + 1;
    let end = nextStart - 1;
    while (end > start && lines[end - 1].trim() === "") end -= 1;
    if (!out.has(heads[i].key)) out.set(heads[i].key, { start, end });
  }
  return out;
}

function words(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

/**
 * The prose as one run of text, with the document's folding taken out.
 *
 * Every long field in the archive is a YAML folded scalar, so the line breaks in the file
 * are the author's right margin rather than the author's paragraphs. Flattening here means
 * the renderer's line clamp counts the lines a reader actually sees instead of the lines
 * the file happened to wrap at.
 *
 * This replaced `oneLine`, which cut `action` at 88 characters. Measured over the 53 cards
 * the archive publishes, all 53 were cut: the resting row never once showed a whole action.
 * A character budget also cannot be right on two viewports at the same time, the value
 * column being 720px wide on a desktop and 304px on a phone. Cutting is now the renderer's
 * job and it cuts in lines, which is the unit the reader is looking at.
 */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The descriptions a port list cannot carry on one line.
 *
 * `name: type` is what the slot shows and it is the half a reader can check against the
 * DOT; what each port is *for* is written on the card and had nowhere to go.
 */
function ports(
  declared: readonly { name: string; type: string; description?: string }[],
): { detail?: string } {
  const written = declared.filter((port) => port.description !== undefined);
  if (written.length === 0) return {};
  return {
    detail: written
      .map((port) => `${port.name}: ${port.type} — ${port.description ?? ""}`)
      .join("\n"),
  };
}

function list(values: readonly string[], empty: string): { filled: boolean; value: string } {
  return values.length === 0
    ? { filled: false, value: empty }
    : { filled: true, value: values.join(", ") };
}

function optional(value: string | undefined, empty: string): { filled: boolean; value: string } {
  return value === undefined || value.trim() === ""
    ? { filled: false, value: empty }
    : { filled: true, value: value };
}

/**
 * One wire key of doc 1 §3, read off the resolved card.
 *
 * The engine's model is camelCase and the document on disk is snake_case; this is the
 * one place the two are put side by side, and the key the slot is labelled with is
 * always the document's, so pane 2 and pane 4 spell the same field the same way.
 *
 * Every empty case states what the card says rather than what it lacks. Doc 2 §1.1 is
 * about autonomy, but the habit it is defending against is general: a slot rendered as
 * a gap to be filled turns a complete card into a checklist with items outstanding, and
 * a card that declares no tools and no risk markers has answered both questions.
 *
 * ── `value` is the value, and a word count is not one ──
 * The author, looking at the `spec` row: "I expected the content of the spec there and if
 * this does not fit within the available space, on click it shows the details." Three
 * fields used to answer with a description of themselves instead — `spec` and `notes` with
 * a word count, `action` with the first 88 characters — and `params` answered with its keys
 * and dropped every value. So every one of the 23 keys below now returns what the card
 * wrote, and the renderer clamps it to two lines and unclamps it when the row is opened.
 * Nothing is cut at build time and nothing is behind a measurement.
 *
 * What the reader loses by that is the size of a long field at a glance, so `measure`
 * carries it: a short figure that sits in the row's right-hand meta slot beside the line
 * range, and is what `announce` reads into the live region in place of a 700-character
 * paragraph. Only the fields whose value runs past a couple of lines set one.
 */
function fieldValue(
  key: string,
  card: NodeCard,
): { filled: boolean; value: string; measure?: string; detail?: string } {
  switch (key) {
    case "id":
      return { filled: true, value: card.id };
    case "name":
      return { filled: true, value: card.name };
    case "type":
      return { filled: true, value: card.type };
    case "phase":
      // Doc 3 §2 and doc 1 §3: the five phases describe the factory, not every node in
      // it. An intake or a retrieval step stands in none of them and says so.
      return list(card.phases, "outside the five");
    case "action":
      // One sentence, 105 to 248 characters across the archive. It fits the clamp on a
      // desktop and takes two lines on a phone, so it carries no `measure`: there is
      // nothing left over for a figure to stand for.
      return { filled: true, value: flatten(card.action) };
    case "spec":
      // The whole payload, which is what doc 1 §0.1.2 makes it: the prose handed to Claude
      // Code, or an equivalent agent, when somebody instantiates the graph on their own
      // machine. This slot used to say only how long it was, on the argument that "the
      // prose itself is in pane 4, on the lines this slot points at" — and that argument
      // stopped being true when `SynchronisedPanes` dropped panes 3 and 4 from the
      // blueprint page, which is the only surface that mounts this pane. There is no
      // second representation of the spec on that page. This slot is it.
      //
      // `card/spec-too-thin`, and that it only measures length, is not lost with the
      // sentence that used to sit here: it is in `FIELD_NOTE.spec`, which every open row
      // prints above the value, in a stronger form than this line ever carried.
      return {
        filled: true,
        value: flatten(card.spec),
        measure: `${words(card.spec)} words`,
      };
    case "model":
      return optional(card.model, "not named");
    case "agent":
      return optional(card.agent, "not named");
    case "skill":
      // A path, and the empty case is a statement about the card rather than a gap: doc 1
      // §3.2 says a node whose `spec` is the whole instruction declares no skill.
      return optional(card.skill, "no skill document is pointed at");
    case "tools":
      return list(card.tools, "none required");
    case "mcp":
      return list(card.mcp, "no server is named");
    case "params":
      // Keys **and** values. The keys alone were the one field on this pane whose content
      // a reader could not reach at all: no detail behind the row, and the blueprint page
      // draws no YAML pane to fall back on, so `max_iterations: 3` existed on that page
      // only inside the flight payload. A value that is not a string is JSON so a nested
      // one still says what it is rather than collapsing to its type.
      return list(
        Object.entries(card.params).map(
          ([name, value]) =>
            `${name}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
        ),
        "none set",
      );
    case "inputs":
      return {
        ...list(
          card.inputs.map((port) => `${port.name}: ${port.type}`),
          "nothing arrives on a declared port",
        ),
        ...ports(card.inputs),
      };
    case "outputs":
      return {
        ...list(
          card.outputs.map((port) => `${port.name}: ${port.type}`),
          "nothing leaves on a declared port",
        ),
        ...ports(card.outputs),
      };
    case "dependencies":
      return list(card.dependencies, "no upstream node is named");
    case "cannot":
      // The negative half of §3.3. `[]` is a complete answer and is not drawn as a gap:
      // most cards declare nothing here, and the ones that do are making a claim the
      // resolver checks rather than filling in a form.
      return list(card.cannot, "nothing is ruled out");
    case "requires_human":
      // Doc 2 §1.1. Both states are a design decision and the two sentences are written
      // to weigh the same. Neither one is a result.
      return card.requiresHuman
        ? { filled: true, value: "true. The run holds here until a person acts." }
        : { filled: true, value: "false. A run passes through without stopping." };
    case "risk_markers":
      return list(card.riskMarkers, "none declared");
    case "notes":
      // The commentary itself. Whose voice it is was the job of the words "of author's
      // notes", and that is `FIELD_NOTE.notes`, which also carries the claim the count
      // could never make: nothing in the engine reads this and no check is made against it.
      return card.notes === undefined || card.notes.trim() === ""
        ? { filled: false, value: "none" }
        : {
            filled: true,
            value: flatten(card.notes),
            measure: `${words(card.notes)} words`,
          };
    case "version":
      return { filled: true, value: card.version };
    case "author":
      return optional(card.author, "unattributed");
    case "provenance":
      return optional(card.provenance, "not stated");
    case "ontology_version":
      return { filled: true, value: card.ontologyVersion };
    default:
      return { filled: false, value: "not part of the schema" };
  }
}

function buildCard(
  ref: string,
  card: NodeCard,
  yaml: string,
  dependencyEdgeLines: (dependency: string) => number[],
): PaneCard {
  const blocks = cardYamlBlocks(yaml);

  const fields: PaneField[] = [];
  for (const block of CARD_BLOCKS) {
    for (const key of block.keys) {
      const { filled, value, measure, detail } = fieldValue(key, card);
      const field: PaneField = { key, group: block.id, filled, value };
      if (measure !== undefined) field.measure = measure;
      if (detail !== undefined && detail.trim() !== "") field.detail = detail;
      const lines = blocks.get(key);
      if (lines !== undefined) field.lines = lines;
      if (key === "dependencies" && card.dependencies.length > 0) {
        const edges = card.dependencies.flatMap(dependencyEdgeLines);
        if (edges.length > 0) field.edgeLines = [...new Set(edges)].sort((a, b) => a - b);
      }
      fields.push(field);
    }
  }

  return { ref, id: card.id, name: card.name, yaml, fields };
}

/* --------------------- the model --------------------- */

function push(map: Map<number, string[]>, line: number, value: string): void {
  const held = map.get(line);
  if (held === undefined) {
    map.set(line, [value]);
    return;
  }
  if (!held.includes(value)) held.push(value);
}

/**
 * A resolved bundle as the four panes need it.
 *
 * Both source documents are carried verbatim: pane 3 shows the DOT the archive
 * publishes and pane 4 shows the card document the archive publishes, so what the
 * reader downloads and what the reader is looking at cannot come apart. Doc 2 §5.1's
 * second argument for this view is exactly that — it removes the jump between "I see a
 * drawing" and "I downloaded some text files" — and it only holds if the text on screen
 * is the text in the file.
 */
export function buildPaneModel(input: PaneModelInput): PaneModel {
  const dotFile = input.dotFile ?? "topology.dot";
  const parsed = parseDot(input.dot, dotFile);
  const graph = parsed.graph;

  const nodeLines = new Map<string, { line: number; column: number }>();
  for (const stmt of graph?.nodes ?? []) {
    nodeLines.set(stmt.id, { line: stmt.line, column: stmt.column });
  }

  const edgeLinesByNode = new Map<string, number[]>();
  /**
   * Keyed by `source\0target`, written as the escape and never as a literal NUL: a raw
   * control character in the source makes the file binary to `file`, `grep` and most
   * editors, and a tool that strips it on the way through would turn the separator into
   * plain concatenation, where `a -> bc` and `ab -> c` collide on one key and one of the
   * two edges highlights the other's line. `\0` is the same byte at run time and survives
   * every one of those hands.
   */
  const edgeLinesByPair = new Map<string, number[]>();
  const sourcesOf = new Map<string, string[]>();
  const targetsOf = new Map<string, string[]>();
  const lineNodes = new Map<number, string[]>();
  const linePhrases = new Map<number, string[]>();

  /** Node ids an edge statement on this line already names. */
  const wiredOnLine = new Map<number, Set<string>>();

  // Edges first, so a line that carries one lists its **source** before its target and
  // `selectionForDotLine` can hand back the id the line opens with.
  for (const edge of graph?.edges ?? []) {
    push(lineNodes, edge.line, edge.source);
    push(lineNodes, edge.line, edge.target);
    push(linePhrases, edge.line, `edge from ${edge.source} to ${edge.target}`);

    const wired = wiredOnLine.get(edge.line) ?? new Set<string>();
    wired.add(edge.source);
    wired.add(edge.target);
    wiredOnLine.set(edge.line, wired);

    for (const id of [edge.source, edge.target]) {
      const held = edgeLinesByNode.get(id);
      if (held === undefined) edgeLinesByNode.set(id, [edge.line]);
      else if (!held.includes(edge.line)) held.push(edge.line);
    }
    const pair = `${edge.source}\0${edge.target}`;
    const pairLines = edgeLinesByPair.get(pair);
    if (pairLines === undefined) edgeLinesByPair.set(pair, [edge.line]);
    else if (!pairLines.includes(edge.line)) pairLines.push(edge.line);

    const into = sourcesOf.get(edge.target);
    if (into === undefined) sourcesOf.set(edge.target, [edge.source]);
    else if (!into.includes(edge.source)) into.push(edge.source);

    const outOf = targetsOf.get(edge.source);
    if (outOf === undefined) targetsOf.set(edge.source, [edge.target]);
    else if (!outOf.includes(edge.target)) outOf.push(edge.target);
  }

  // Then the node statements. A node first appearing *inside* an edge is already
  // accounted for by that edge's phrase, and saying "declares node a" over `a -> b`
  // would describe the file as a reader does not read it.
  for (const stmt of graph?.nodes ?? []) {
    push(lineNodes, stmt.line, stmt.id);
    if (wiredOnLine.get(stmt.line)?.has(stmt.id) === true) continue;
    const ref = stmt.attrs.card;
    push(
      linePhrases,
      stmt.line,
      ref === undefined
        ? `declares node ${stmt.id}`
        : `declares node ${stmt.id}, pinning card ${ref}`,
    );
  }

  const nodes: PaneNode[] = input.nodes.map((entry) => {
    const at = nodeLines.get(entry.nodeId);
    const node: PaneNode = {
      nodeId: entry.nodeId,
      label: entry.label,
      edgeLines: [...(edgeLinesByNode.get(entry.nodeId) ?? [])].sort((a, b) => a - b),
      sources: [...(sourcesOf.get(entry.nodeId) ?? [])],
      targets: [...(targetsOf.get(entry.nodeId) ?? [])],
    };
    if (at !== undefined) {
      node.dotLine = at.line;
      node.dotColumn = at.column;
    }
    if (entry.card !== undefined) {
      node.card = buildCard(
        entry.ref ?? `${entry.card.id}@${entry.card.version}`,
        entry.card,
        entry.yaml ?? "",
        (dependency) => edgeLinesByPair.get(`${dependency}\0${entry.nodeId}`) ?? [],
      );
    }
    return node;
  });

  const lastEdgeLine = Math.max(0, ...(graph?.edges ?? []).map((e) => e.line));

  const absences: PaneAbsence[] = (input.absences ?? []).map((entry) => {
    const absence: PaneAbsence = {
      id: entry.id,
      label: entry.label,
      detail: entry.detail,
    };
    const nodeId = entry.nodeId ?? entry.edge?.target ?? entry.field?.nodeId;
    if (nodeId !== undefined) absence.nodeId = nodeId;
    if (entry.field !== undefined) absence.field = entry.field;
    if (entry.edge !== undefined) {
      absence.edge = entry.edge;
      // Where a reader would have written it: under the last edge leaving the same node.
      // Failing that, under the node's own declaration, then under the last edge in the
      // file. The parser's line numbers again, so the ghost lands among real statements
      // rather than at a position guessed from the whitespace of one archive file.
      const siblings = (graph?.edges ?? [])
        .filter((e) => e.source === entry.edge?.source)
        .map((e) => e.line);
      const afterLine =
        siblings.length > 0
          ? Math.max(...siblings)
          : (nodeLines.get(entry.edge.source)?.line ?? lastEdgeLine);
      absence.dot = {
        text: entry.dotText ?? `${entry.edge.source} -> ${entry.edge.target};`,
        afterLine: afterLine > 0 ? afterLine : 1,
      };
    }
    return absence;
  });

  const dotLineNodes: Record<string, string[]> = {};
  for (const [line, ids] of lineNodes) dotLineNodes[String(line)] = ids;

  const dotLineMeaning: Record<string, string> = {};
  for (const [line, phrases] of linePhrases) {
    dotLineMeaning[String(line)] = phrases.join("; ");
  }

  return {
    slug: input.slug,
    title: input.title,
    dot: input.dot,
    dotFile,
    nodes,
    absences,
    dotLineNodes,
    dotLineMeaning,
  };
}
