/* ============================================================
   `topology.dot`, tokenised and cut into blocks.

   The pure half of `./DotBreakdown.tsx`: no React, no DOM, so the
   node suite can hold every claim in here to the nine files the
   archive actually stores.

   ── Why the steps are DERIVED and never typed ──
   `components/home/nodecard/annotations.ts` records the bug this
   avoids: a hand-written table of line ranges drifted out of
   document order, and the highlight climbed the file while the
   reader scrolled down it. Its fix was to resolve every range from
   the file itself, and the same fix applies here twice over,
   because this figure runs over NINE different files — one per
   blueprint — and a typed table would have to be right nine times
   and stay right whenever any of them is edited.

   So a step is a BLOCK of the file: a run of statements of one kind
   (the header, the node declarations, one group of edges), with the
   comment lines immediately above it attached to it, ended by a
   blank line, by the closing brace, or by the kind changing. That
   rule gives the starter five steps —

     L1–3    the graph, opened
     L5–10   five nodes, each pinned to a card
     L12–18  the two edges into `tester`, under the comment about
             the edge that is NOT written
     L20–24  the tester ⇄ debugger loop
     L26     the release edge

   — and three steps for the six blueprints whose edges are one
   unbroken run. Blocks are emitted in document order by
   construction, which is the property `dot-breakdown.test.ts`
   asserts: there is no ordering decision left for an author to get
   wrong.

   ── What "the important tag" is ──
   `card="id@version"`. It is the one attribute DarkPrint adds to
   DOT (`components/spec/rows.ts`, `TOPOLOGY_ROWS`), and it is the
   join between a box in the drawing and the document that describes
   it. The tokeniser marks the whole attribute — name, `=`, value —
   as one `card` kind so the listing can light all three together
   rather than colouring a string that happens to look like a ref.

   ── Where the prose comes from ──
   Every sentence below is a `TOPOLOGY_ROWS` claim, restated for the
   block it lands on. Nothing here says anything about the engine
   that `/spec/topology` does not already say in its check table:
   layout attributes are read by nobody, `label` is compared against
   nothing, and the port types are what decide whether an edge can
   carry anything at all.
   ============================================================ */

/* ==================== tokens ==================== */

export type DotTokenKind =
  /** Whitespace, and anything the scanner has no opinion about. */
  | "plain"
  /** `//` or `#` to the end of the line. */
  | "comment"
  /** `digraph`, `node`, `edge`, `graph`, `subgraph`, `strict`. */
  | "keyword"
  /** A node id, or either end of an edge. */
  | "id"
  /** An attribute name — the identifier on the left of an `=`. */
  | "attr"
  /** An attribute value, quoted or bare. */
  | "string"
  /** `->`, or `--` in an undirected file. */
  | "arrow"
  /** `{ } [ ] ; , =` and friends. */
  | "punct"
  /** The three tokens of `card="id@version"`, marked as one thing. */
  | "card";

export interface DotToken {
  kind: DotTokenKind;
  text: string;
}

export interface DotLine {
  /** 1-based, so it is the number printed in the gutter. */
  no: number;
  tokens: DotToken[];
}

/** DOT's reserved words. Matched case-insensitively, the way Graphviz matches them. */
const RESERVED = new Set(["strict", "digraph", "graph", "node", "edge", "subgraph"]);

const WORD = /[A-Za-z_0-9.]/;
const SPACE = /[ \t]/;

/**
 * One line, left to right.
 *
 * Deliberately not a grammar. The listing has to render a line the archive stores whether
 * or not it parses — a half-written file on `/upload` is still a file a reader wants to
 * look at — so every branch here falls back to `punct` or `plain` rather than throwing.
 * The engine's parser is the thing that decides whether a DOT is valid; this decides what
 * colour a character is.
 */
function tokenizeLine(text: string): DotToken[] {
  const tokens: DotToken[] = [];
  const push = (kind: DotTokenKind, slice: string) => {
    if (slice !== "") tokens.push({ kind, text: slice });
  };

  let i = 0;
  /** The last non-space character emitted, which is how a bare value is told from a name. */
  let prev = "";

  while (i < text.length) {
    const ch = text[i];

    if (SPACE.test(ch)) {
      let j = i;
      while (j < text.length && SPACE.test(text[j])) j += 1;
      push("plain", text.slice(i, j));
      i = j;
      continue;
    }

    // A comment runs to the end of the line in every form this archive uses. `#` is a DOT
    // comment too, and `attractor/hash-comment` is a real warning about it, so it has to
    // render as a comment here rather than as a punctuation mark.
    if (text.startsWith("//", i) || text.startsWith("/*", i) || ch === "#") {
      push("comment", text.slice(i));
      break;
    }

    if (ch === '"') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === "\\") {
          j += 2;
          continue;
        }
        if (text[j] === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      push("string", text.slice(i, j));
      prev = '"';
      i = j;
      continue;
    }

    if (text.startsWith("->", i) || text.startsWith("--", i)) {
      push("arrow", text.slice(i, i + 2));
      prev = ">";
      i += 2;
      continue;
    }

    if (WORD.test(ch)) {
      let j = i;
      while (j < text.length && WORD.test(text[j])) j += 1;
      const word = text.slice(i, j);
      let k = j;
      while (k < text.length && SPACE.test(text[k])) k += 1;
      const next = text[k] ?? "";
      const kind: DotTokenKind =
        prev === "="
          ? "string"
          : next === "="
            ? "attr"
            : RESERVED.has(word.toLowerCase())
              ? "keyword"
              : "id";
      push(kind, word);
      prev = word[word.length - 1] ?? "";
      i = j;
      continue;
    }

    push("punct", ch);
    prev = ch;
    i += 1;
  }

  return tokens;
}

/**
 * Promote `card`, `=` and the value after it to one `card` kind.
 *
 * Three tokens rather than one, because the scanner has already split them and rejoining
 * text is how a listing stops being selectable line by line. The renderer paints them with
 * one class and they abut inside a `white-space: pre` run, so they read as a single marked
 * phrase with no gap in it.
 *
 * Matched on the ATTRIBUTE NAME and not on the value's shape. A `label="code-builder@1.0.0"`
 * is a plausible string and is not the join; only the attribute the engine reads is.
 */
function markCardAttribute(tokens: DotToken[]): void {
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].kind !== "attr" || tokens[i].text !== "card") continue;
    let eq = i + 1;
    while (eq < tokens.length && tokens[eq].kind === "plain") eq += 1;
    if (tokens[eq]?.text !== "=") continue;
    let value = eq + 1;
    while (value < tokens.length && tokens[value].kind === "plain") value += 1;
    if (tokens[value]?.kind !== "string") continue;
    for (let m = i; m <= value; m += 1) tokens[m].kind = "card";
  }
}

/** The whole document, one entry per line, with `\r\n` normalised away. */
export function tokenizeDot(source: string): DotLine[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((text, index) => {
      const tokens = tokenizeLine(text);
      markCardAttribute(tokens);
      return { no: index + 1, tokens };
    });
}

/* ==================== steps ==================== */

export type DotStepKind = "header" | "nodes" | "edges";

export interface DotStep {
  /** 1-based, printed in the listing's marker column and in the rail. */
  step: number;
  kind: DotStepKind;
  /** First line of the block, comments included. */
  from: number;
  /** Last line of the block. */
  to: number;
  title: string;
  body: string;
}

type StatementKind = DotStepKind | "blank" | "comment" | "close";

/**
 * What a line is, for grouping purposes only.
 *
 * The order of the tests is load-bearing. `node [shape=box, style=rounded];` opens with a
 * reserved word and has a bracket, so it looks exactly like a node declaration until the
 * reserved-word test has run; getting that wrong puts the drawing defaults in the "nodes"
 * step on all nine blueprints.
 */
function statementKind(text: string): StatementKind {
  const t = text.trim();
  if (t === "") return "blank";
  if (t.startsWith("//") || t.startsWith("#") || t.startsWith("/*") || t.startsWith("*")) {
    return "comment";
  }
  if (t.startsWith("}")) return "close";
  if (/^(strict\s+)?(di)?graph\b/i.test(t)) return "header";
  if (/^(node|edge|graph)\b[^=]*\[/i.test(t)) return "header";
  if (/->|\s--\s/.test(t)) return "edges";
  if (/^"?[A-Za-z_][\w."-]*"?\s*\[/.test(t)) return "nodes";
  return "header";
}

interface Block {
  kind: DotStepKind;
  from: number;
  to: number;
}

/**
 * The file, cut into blocks.
 *
 * A blank line ends a block, the closing brace ends a block, and a change of kind ends a
 * block. Comment lines never open or close one: they queue up and are handed to whatever
 * statement comes next, so the five lines explaining the edge that is not written belong
 * to the step that shows the edges that are.
 */
function blocksOf(lines: readonly string[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | undefined;
  /** The first line of the comment run waiting to be attached. */
  let pending: number | undefined;

  const flush = () => {
    if (current !== undefined) blocks.push(current);
    current = undefined;
  };

  lines.forEach((text, index) => {
    const no = index + 1;
    const kind = statementKind(text);

    if (kind === "blank" || kind === "close") {
      flush();
      pending = undefined;
      return;
    }
    if (kind === "comment") {
      if (pending === undefined) pending = no;
      return;
    }
    if (current !== undefined && current.kind === kind) {
      current.to = no;
    } else {
      flush();
      current = { kind, from: pending ?? no, to: no };
    }
    pending = undefined;
  });

  flush();
  return blocks;
}

/* ---------- what a block is about, read off the block ---------- */

interface Edge {
  from: string;
  to: string;
}

const unquote = (id: string) => id.replace(/^"|"$/g, "");

function edgesIn(lines: readonly string[], block: Block): Edge[] {
  const edges: Edge[] = [];
  for (let no = block.from; no <= block.to; no += 1) {
    const raw = lines[no - 1] ?? "";
    if (statementKind(raw) !== "edges") continue;
    // Attribute lists and trailing comments carry `->`-free text that would otherwise
    // become an endpoint; both are cut before the line is split.
    const cleaned = raw
      .replace(/\/\/.*$/, "")
      .replace(/#.*$/, "")
      .replace(/\[[^\]]*\]/g, "");
    // SPLIT ON `;` FIRST. `grounded-research-desk` writes `plan -> web; plan -> vectors;
    // plan -> code;` on one line, and cutting at the first semicolon instead of splitting
    // on every one of them threw two thirds of that file's edges away.
    for (const statement of cleaned.split(";")) {
      const ids = statement
        .split(/->|\s--\s/)
        .map((part) => unquote(part.trim()))
        .filter((part) => part !== "");
      // `pr -> triage -> draft -> tests` is three edges, not one, which is why this is a
      // chain walk rather than a pair match.
      for (let k = 0; k + 1 < ids.length; k += 1) {
        edges.push({ from: ids[k], to: ids[k + 1] });
      }
    }
  }
  return edges;
}

function nodesIn(lines: readonly string[], block: Block): { id: string; card: boolean }[] {
  const nodes: { id: string; card: boolean }[] = [];
  for (let no = block.from; no <= block.to; no += 1) {
    const raw = lines[no - 1] ?? "";
    if (statementKind(raw) !== "nodes") continue;
    const id = /^\s*("?[A-Za-z_][\w."-]*"?)/.exec(raw)?.[1];
    if (id === undefined) continue;
    nodes.push({ id: unquote(id), card: /\bcard\s*=/.test(raw) });
  }
  return nodes;
}

/** How many statements (not comments) a block holds. */
function statementCount(lines: readonly string[], block: Block): number {
  let n = 0;
  for (let no = block.from; no <= block.to; no += 1) {
    const kind = statementKind(lines[no - 1] ?? "");
    if (kind !== "comment" && kind !== "blank") n += 1;
  }
  return n;
}

/* ---------- the copy, one sentence per shape ---------- */

const HEADER_TITLE = "The graph, opened";

const HEADER_BODY_BARE =
  "One directed graph per bundle, named on the opening line. Every rule the engine " +
  "applies below it reads which way an edge points.";

/* `shape` used to be listed here beside `rankdir` and `style` as one more layout
   default, and it is the one attribute in the line that is not layout: Attractor spec
   §2.8 picks the handler that runs a node from its shape. Nothing about the DarkPrint
   half changed — a topology's shapes are still read by nobody here — but a reader who
   goes on to compile this file needs the other half of that sentence, because the shape
   is what decides what each node in the compiled file does. */
const HEADER_BODY_LAYOUT =
  "One directed graph per bundle, named on the opening line. The statements under it " +
  "set defaults for the nodes below. `rankdir` and `style` are Graphviz layout and " +
  "DarkPrint reads neither. `shape` is the attribute Attractor picks a node's handler " +
  "from, and the export writes it again per node from the card's type. The drawing " +
  "above this listing is its own.";

/* `grounded-research-desk` is the only blueprint in the archive that opens a
   `subgraph cluster_…`, and without a shape of its own it took the opening line's title
   and printed "The graph, opened" twice on the same walk. The body stays a fact about the
   FILE — what the grouping does to the engine's reading of it is not something this
   figure is in a position to claim. */
const CLUSTER_TITLE = "A cluster of nodes";

const CLUSTER_BODY =
  "`subgraph` groups declarations inside the file. The nodes in it are written exactly " +
  "like the ones above, with the same `card=\"id@version\"` join.";

const DEFAULTS_TITLE = "Drawing defaults";

const NODES_BODY =
  "One attribute does the joining. A node writes `card=\"id@version\"`, and the version " +
  "is pinned, so two readings of this file describe the same nodes. Everything else about " +
  "a node lives in the card it names.";

/** A second or third run of declarations has nothing new to say about the join. */
const NODES_BODY_MORE =
  "More declarations, in the same shape: an id, and the card it pins by version.";

/** The first group of edges carries the claim; the rest carry what makes them different. */
const EDGE_BODY_INTERFACE =
  "An edge is an interface. The resolver pairs an output port with an input port by type, " +
  "and an edge with no compatible pairing is a graph that cannot run.";

const EDGE_BODY_DASHED =
  "`style=dashed` is Graphviz layout and says nothing to the engine. The two port types " +
  "still decide what may travel this way.";

/* Both readings, because the row in `TOPOLOGY_ROWS` this restates now carries both.
   "Compared against nothing" is true of DarkPrint and false of the runner: spec §3.3
   Step 2 matches a normalized `label` to pick a branch, and the export writes the label
   straight through, so a caption in this listing is a routing key in the compiled file. */
const EDGE_BODY_LABEL =
  "`label` is what the author says an edge carries. It is drawn on the schematic and " +
  "compared against nothing here, and the two port types decide what travels. The " +
  "compiled file reads it a second way: over the edges that carry no guard, Attractor " +
  "matches the label, normalized, against the branch a stage asked for (spec §3.3).";

/** `planner, builder → tester`, `tester ⇄ debugger`, or a count when the shape has none. */
function edgeTitle(edges: readonly Edge[]): string {
  if (edges.length === 0) return "The wiring";
  if (edges.length === 1) return `${edges[0].from} → ${edges[0].to}`;
  if (
    edges.length === 2 &&
    edges[0].from === edges[1].to &&
    edges[0].to === edges[1].from
  ) {
    return `${edges[0].from} ⇄ ${edges[0].to}`;
  }
  const sources = [...new Set(edges.map((e) => e.from))];
  const targets = [...new Set(edges.map((e) => e.to))];
  // Three is where a joined list stops being a title and starts being a sentence; the
  // rail's head is one line at 371px and a fourth id wraps it.
  if (targets.length === 1 && sources.length <= 3) return `${sources.join(", ")} → ${targets[0]}`;
  if (sources.length === 1 && targets.length <= 3) return `${sources[0]} → ${targets.join(", ")}`;
  return `${edges.length} edges`;
}

/**
 * The FIRST run of declarations carries the count and the claim; a later one names its ids
 * instead.
 *
 * `grounded-research-desk` declares in three runs, and counting each of them printed
 * "3 nodes, each pinned to a card" twice in a row on the rail — two heads a reader cannot
 * tell apart, over two different parts of the file. Ids are what distinguishes them, and
 * three of them fit the rail's 371px head on one line.
 */
function nodeTitle(nodes: readonly { id: string; card: boolean }[], first: boolean): string {
  if (nodes.length === 0) return "The nodes";
  if (!first) {
    if (nodes.length <= 3) return nodes.map((node) => node.id).join(", ");
    return `${nodes.length} more nodes`;
  }
  const carded = nodes.every((node) => node.card);
  if (nodes.length === 1) return carded ? "One node, one card" : "One node";
  return carded ? `${nodes.length} nodes, each pinned to a card` : `${nodes.length} nodes`;
}

/**
 * The breakdown, resolved from the file.
 *
 * Returned in document order with `step` numbered from 1, and `from`/`to` strictly
 * increasing across the list — asserted in `dot-breakdown.test.ts` against all nine
 * blueprints, because a block whose range overlaps its neighbour's is a rail row that
 * lights lines belonging to another row, which is the one defect this whole derivation
 * exists to make impossible.
 */
export function resolveDotSteps(source: string): DotStep[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = blocksOf(lines);

  let edgeGroup = 0;
  let nodeGroup = 0;
  return blocks.map((block, index) => {
    const base = { step: index + 1, kind: block.kind, from: block.from, to: block.to };
    const text = lines.slice(block.from - 1, block.to).join("\n");
    if (block.kind === "header") {
      if (/^\s*(strict\s+)?(di)?graph\b/im.test(text)) {
        return {
          ...base,
          title: HEADER_TITLE,
          body: statementCount(lines, block) > 1 ? HEADER_BODY_LAYOUT : HEADER_BODY_BARE,
        };
      }
      if (/\bsubgraph\b/i.test(text)) {
        return { ...base, title: CLUSTER_TITLE, body: CLUSTER_BODY };
      }
      return { ...base, title: DEFAULTS_TITLE, body: HEADER_BODY_LAYOUT };
    }
    if (block.kind === "nodes") {
      nodeGroup += 1;
      return {
        ...base,
        title: nodeTitle(nodesIn(lines, block), nodeGroup === 1),
        body: nodeGroup === 1 ? NODES_BODY : NODES_BODY_MORE,
      };
    }
    const edges = edgesIn(lines, block);
    const dashed = /style\s*=\s*"?dashed/i.test(text);
    edgeGroup += 1;
    const body =
      edgeGroup === 1
        ? EDGE_BODY_INTERFACE
        : dashed
          ? EDGE_BODY_DASHED
          : EDGE_BODY_LABEL;
    return { ...base, title: edgeTitle(edges), body };
  });
}

/** `L17` for one line, `L12–18` for a run. An en dash, the way `CardWalk` spells it. */
export function lineSpan(from: number, to: number): string {
  return from === to ? `L${from}` : `L${from}–${to}`;
}
