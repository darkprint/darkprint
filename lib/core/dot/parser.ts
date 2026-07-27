/* ============================================================
   DarkPrint core — DOT parser
   Recursive-descent parser over ./lexer producing a flat
   DotGraph: nodes with their resolved attributes and edges with
   theirs. Subgraphs are flattened; their default attributes stay
   scoped. Design doc §2, engine spec §7.
   ============================================================ */

import { error, info, warning } from "../diagnostics";
import type { Diagnostic, DiagnosticLocation } from "../diagnostics";
import { lex } from "./lexer";
import type { Token } from "./lexer";

/** DOT attributes are always flat strings — that is why the rich detail lives in cards (§2). */
export interface DotAttrs {
  readonly [key: string]: string;
}

/** A node with its attributes already merged over the `node [...]` defaults in scope. */
export interface DotNodeStmt {
  id: string;
  attrs: DotAttrs;
  /** 1-based position of the node's first appearance. */
  line: number;
  column: number;
}

/** One directed edge. `a -> b -> c` yields two of these, both carrying the statement's attributes. */
export interface DotEdgeStmt {
  source: string;
  target: string;
  attrs: DotAttrs;
  /** 1-based position of this edge's source endpoint. */
  line: number;
  column: number;
}

/** The whole graph, flattened. */
export interface DotGraph {
  strict: boolean;
  directed: boolean;
  name?: string;
  /** Root-level `graph [...]` and bare `key=value` attributes. Subgraph-local ones stay scoped. */
  graphAttrs: DotAttrs;
  /** Deduplicated, in first-appearance order. Nodes only implied by an edge appear here too. */
  nodes: DotNodeStmt[];
  edges: DotEdgeStmt[];
}

/** `graph` is absent only when the source could not be parsed at all. */
export interface DotParseResult {
  graph?: DotGraph;
  diagnostics: Diagnostic[];
}

/** Enough to report a broken file without drowning the user in cascading noise. */
const MAX_PARSE_ERRORS = 20;

/**
 * How deep subgraphs may nest. The parser is recursive descent, so nesting costs
 * JS stack; a hand-written blueprint never gets past two or three levels, and a file
 * that does is reported as a parse error rather than being allowed to overflow the
 * stack of whichever host — browser or Node — is reading it.
 */
const MAX_SUBGRAPH_DEPTH = 100;

type MutableAttrs = Record<string, string>;

interface NodeRec {
  id: string;
  attrs: MutableAttrs;
  line: number;
  column: number;
}

interface EdgeRec {
  source: string;
  target: string;
  attrs: MutableAttrs;
  line: number;
  column: number;
}

/** Default attributes in force at one nesting level. A subgraph gets a copy, so nothing leaks out. */
interface Scope {
  node: MutableAttrs;
  edge: MutableAttrs;
  graph: MutableAttrs;
  depth: number;
}

/** One side of an edge: a single node, or every node declared inside a subgraph. */
interface Endpoint {
  ids: string[];
  line: number;
  column: number;
  subgraph: boolean;
}

/** How a token reads inside an error message. */
function describe(t: Token): string {
  if (t.kind === "eof") return "end of input";
  if (t.kind === "string") return `the string "${t.value}"`;
  return `\`${t.value}\``;
}

class DotParser {
  private readonly tokens: Token[];
  private readonly file?: string;
  private pos = 0;

  readonly diagnostics: Diagnostic[] = [];
  private errorCount = 0;
  private aborted = false;

  private strict = false;
  private directed = true;
  private name?: string;
  private readonly graphAttrs: MutableAttrs = {};
  private readonly nodes = new Map<string, NodeRec>();
  private readonly edges: EdgeRec[] = [];
  /** `source\u0000target` -> index in `edges`; only used when the graph is `strict`. */
  private readonly edgeIndex = new Map<string, number>();
  /** Node-id collectors, one per open subgraph, innermost last. */
  private readonly collectors: string[][] = [];
  private notDirectedReported = false;
  private portsReported = false;
  private readonly selfLoopsReported = new Set<string>();

  constructor(tokens: Token[], file?: string) {
    this.tokens = tokens;
    this.file = file;
  }

  /* ---------------- token access ---------------- */

  /** `lex` always terminates the stream with `eof`, so reads past the end repeat it. */
  private peek(offset = 0): Token {
    const idx = Math.min(this.pos + offset, this.tokens.length - 1);
    return this.tokens[idx];
  }

  /** Never advances past `eof`, so no loop in this file can run away. */
  private advance(): Token {
    const t = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos += 1;
    return t;
  }

  private isPunct(t: Token, value: string): boolean {
    return t.kind === "punct" && t.value === value;
  }

  /** DOT keywords are case-insensitive, but a quoted "graph" is an ordinary id. */
  private isKeyword(t: Token, keyword: string): boolean {
    return t.kind === "id" && t.value.toLowerCase() === keyword;
  }

  private isIdToken(t: Token): boolean {
    return t.kind === "id" || t.kind === "number" || t.kind === "string";
  }

  /* ---------------- diagnostics ---------------- */

  private locOf(t: Token): DiagnosticLocation {
    return this.file === undefined
      ? { line: t.line, column: t.column }
      : { file: this.file, line: t.line, column: t.column };
  }

  private fail(token: Token, message: string, hint?: string): void {
    if (this.aborted) return;
    this.errorCount += 1;
    if (this.errorCount > MAX_PARSE_ERRORS) {
      this.aborted = true;
      this.diagnostics.push(
        error("dot/parse-error", "Too many parse errors; stopped reading the graph.", {
          location: this.locOf(token),
        }),
      );
      return;
    }
    this.diagnostics.push(
      error("dot/parse-error", message, { hint, location: this.locOf(token) }),
    );
  }

  /** Panic-mode resync: swallow the rest of the broken statement, keep the rest of the file. */
  private recover(): void {
    // Once reading has been abandoned there is nothing left to resync to, and scanning
    // the rest of the file once per abandoned nesting level would be quadratic.
    if (this.aborted) return;
    for (;;) {
      const t = this.peek();
      if (t.kind === "eof") return;
      if (this.isPunct(t, "}")) return;
      this.advance();
      if (this.isPunct(t, ";")) return;
    }
  }

  private reportUndirectedEdge(op: Token): void {
    // One report is enough: an undirected file would otherwise emit an error per edge.
    if (this.notDirectedReported) return;
    this.notDirectedReported = true;
    this.diagnostics.push(
      error("dot/not-directed", "Undirected edge `--` in a DarkPrint blueprint.", {
        hint: "Blueprints are directed: write `->` so the data flow has a direction.",
        location: this.locOf(op),
      }),
    );
  }

  /* ---------------- graph construction ---------------- */

  private collect(id: string): void {
    for (const c of this.collectors) {
      if (!c.includes(id)) c.push(id);
    }
  }

  /**
   * A node named without an attribute list — inside an edge, or as a bare `a;`
   * statement. It creates the node with the defaults in force, and leaves an existing
   * one exactly as it was: the statement declares nothing, so it can neither overwrite
   * an attribute nor conflict with one (§7, "an explicit attribute on the node wins").
   */
  private mentionNode(id: string, defaults: MutableAttrs, line: number, column: number): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { id, attrs: { ...defaults }, line, column });
    }
    this.collect(id);
  }

  /**
   * A node written with its own attribute list. The explicit attributes win over the
   * `node [...]` defaults in scope, which only fill the keys the node has no value for;
   * `dot/duplicate-node` reports the values a second declaration really changed.
   */
  private declareNode(
    id: string,
    defaults: MutableAttrs,
    explicit: MutableAttrs,
    line: number,
    column: number,
  ): void {
    const existing = this.nodes.get(id);
    if (existing === undefined) {
      this.nodes.set(id, { id, attrs: { ...defaults, ...explicit }, line, column });
      this.collect(id);
      return;
    }
    this.collect(id);
    const changed: string[] = [];
    for (const key of Object.keys(explicit)) {
      const previous = existing.attrs[key];
      const value = explicit[key];
      if (previous !== undefined && previous !== value) {
        changed.push(`${key} \`${previous}\` → \`${value}\``);
      }
      existing.attrs[key] = value;
    }
    // Defaults fill gaps only. Letting a later `node [...]` statement rewrite an
    // attribute the author put on the node is how a pinned `card=` used to be lost.
    for (const key of Object.keys(defaults)) {
      if (!Object.prototype.hasOwnProperty.call(existing.attrs, key)) {
        existing.attrs[key] = defaults[key];
      }
    }
    if (changed.length > 0) {
      this.diagnostics.push(
        info("dot/duplicate-node", `Node \`${id}\` is redeclared with different attributes.`, {
          hint: `Overwritten: ${changed.join(", ")}.`,
          location:
            this.file === undefined
              ? { nodeId: id, line, column }
              : { file: this.file, nodeId: id, line, column },
        }),
      );
    }
  }

  private addEdge(
    source: string,
    target: string,
    attrs: MutableAttrs,
    line: number,
    column: number,
  ): void {
    if (this.strict) {
      const key = `${source}\u0000${target}`;
      const existing = this.edgeIndex.get(key);
      if (existing !== undefined) {
        // `strict` merges parallel edges rather than repeating them.
        Object.assign(this.edges[existing].attrs, attrs);
        return;
      }
      this.edgeIndex.set(key, this.edges.length);
    }
    if (source === target && !this.selfLoopsReported.has(source)) {
      this.selfLoopsReported.add(source);
      this.diagnostics.push(
        // Info, not a warning: a self-loop is legal topology. Whether the loop is
        // *unbounded* is the security analyzer's call (§8.2), not the parser's.
        info("dot/self-loop", `Node \`${source}\` has an edge to itself.`, {
          hint: "A self-loop is a cycle; the security analysis treats it as one.",
          location:
            this.file === undefined
              ? { nodeId: source, edge: { source, target }, line, column }
              : { file: this.file, nodeId: source, edge: { source, target }, line, column },
        }),
      );
    }
    this.edges.push({ source, target, attrs: { ...attrs }, line, column });
  }

  /* ---------------- grammar ---------------- */

  /** `[strict] (graph|digraph) [ID] '{' stmt_list '}'` */
  parse(): DotGraph | undefined {
    if (this.isKeyword(this.peek(), "strict")) {
      this.strict = true;
      this.advance();
    }

    const keyword = this.peek();
    if (this.isKeyword(keyword, "digraph")) {
      this.advance();
    } else if (this.isKeyword(keyword, "graph")) {
      this.advance();
      this.directed = false;
      this.notDirectedReported = true;
      this.diagnostics.push(
        error("dot/not-directed", "The graph is declared with `graph`, not `digraph`.", {
          hint: "A blueprint is a directed graph: use `digraph` and `->` edges.",
          location: this.locOf(keyword),
        }),
      );
    } else {
      this.fail(
        keyword,
        `Expected \`graph\` or \`digraph\`, found ${describe(keyword)}.`,
        "A blueprint is a single `digraph { ... }`.",
      );
      return undefined;
    }

    const nameToken = this.peek();
    if (this.isIdToken(nameToken)) {
      this.name = nameToken.value;
      this.advance();
    }

    if (!this.expectPunct("{")) return undefined;
    const root: Scope = { node: {}, edge: {}, graph: {}, depth: 0 };
    this.parseStmtList(root);

    const closing = this.peek();
    if (!this.isPunct(closing, "}")) {
      // Running out of input after an earlier error is a consequence of it, not news:
      // report the missing brace only when it is the first thing that went wrong.
      if (!(closing.kind === "eof" && this.errorCount > 0)) {
        this.fail(closing, `Expected \`}\`, found ${describe(closing)}.`);
      }
      return undefined;
    }
    this.advance();

    const trailing = this.peek();
    if (trailing.kind !== "eof") {
      this.diagnostics.push(
        warning("dot/unsupported", "Only the first graph in the file is read.", {
          location: this.locOf(trailing),
        }),
      );
    }

    const graph: DotGraph = {
      strict: this.strict,
      directed: this.directed,
      graphAttrs: this.graphAttrs,
      nodes: [...this.nodes.values()],
      edges: this.edges,
    };
    if (this.name !== undefined) graph.name = this.name;
    return graph;
  }

  private expectPunct(value: string): boolean {
    const t = this.peek();
    if (this.isPunct(t, value)) {
      this.advance();
      return true;
    }
    this.fail(t, `Expected \`${value}\`, found ${describe(t)}.`);
    return false;
  }

  private parseStmtList(scope: Scope): void {
    for (;;) {
      if (this.aborted) return;
      const t = this.peek();
      if (t.kind === "eof") return;
      if (this.isPunct(t, "}")) return;
      if (this.isPunct(t, ";")) {
        this.advance();
        continue;
      }
      if (!this.parseStmt(scope)) {
        this.recover();
        continue;
      }
      if (this.isPunct(this.peek(), ";")) this.advance();
    }
  }

  private parseStmt(scope: Scope): boolean {
    const t = this.peek();

    // `node [...]` / `edge [...]` / `graph [...]` — defaults for this scope and nested ones.
    if (t.kind === "id" && this.isPunct(this.peek(1), "[")) {
      const keyword = t.value.toLowerCase();
      if (keyword === "node" || keyword === "edge" || keyword === "graph") {
        this.advance();
        const attrs = this.parseAttrLists();
        if (attrs === undefined) return false;
        const target =
          keyword === "node" ? scope.node : keyword === "edge" ? scope.edge : scope.graph;
        Object.assign(target, attrs);
        if (keyword === "graph" && scope.depth === 0) Object.assign(this.graphAttrs, attrs);
        return true;
      }
    }

    // Bare `key = value` graph attribute.
    if (this.isIdToken(t) && this.isPunct(this.peek(1), "=")) {
      const key = this.readId();
      if (key === undefined) return false;
      this.advance(); // `=`
      return this.assignGraphAttr(key, scope);
    }

    return this.parseEndpointStmt(scope);
  }

  private assignGraphAttr(key: string, scope: Scope): boolean {
    const value = this.readId();
    if (value === undefined) {
      this.fail(this.peek(), `Expected a value after \`=\`, found ${describe(this.peek())}.`);
      return false;
    }
    scope.graph[key] = value;
    // Subgraph-local graph attributes stay in the scope; the flat model keeps only the root's.
    if (scope.depth === 0) this.graphAttrs[key] = value;
    return true;
  }

  /** A node statement, an edge chain, or a bare subgraph. */
  private parseEndpointStmt(scope: Scope): boolean {
    const first = this.parseEndpoint(scope);
    if (first === undefined) return false;

    // `"a" + "b" = c` — only detectable once the concatenation has been read.
    if (!first.subgraph && this.isPunct(this.peek(), "=")) {
      this.advance();
      return this.assignGraphAttr(first.ids[0], scope);
    }

    if (this.peek().kind === "edgeop") {
      const segments: Endpoint[] = [first];
      // Each endpoint is registered as soon as it has been read, before the next one is
      // parsed. That keeps `nodes` in first-appearance order when a subgraph sits in the
      // middle of a chain, and it registers both sides even when one of them is empty.
      this.mentionEndpoint(first, scope);
      while (this.peek().kind === "edgeop") {
        const op = this.advance();
        if (op.value === "--") this.reportUndirectedEdge(op);
        const next = this.parseEndpoint(scope);
        if (next === undefined) return false;
        this.mentionEndpoint(next, scope);
        segments.push(next);
      }
      const explicit = this.isPunct(this.peek(), "[") ? this.parseAttrLists() : {};
      if (explicit === undefined) return false;
      const attrs = { ...scope.edge, ...explicit };
      for (let s = 0; s + 1 < segments.length; s += 1) {
        const from = segments[s];
        const to = segments[s + 1];
        for (const source of from.ids) {
          for (const target of to.ids) {
            this.addEdge(source, target, attrs, from.line, from.column);
          }
        }
      }
      return true;
    }

    // A subgraph used as a statement has already contributed its nodes and edges.
    if (first.subgraph) return true;

    // A non-subgraph endpoint always carries exactly one id.
    const hasAttrs = this.isPunct(this.peek(), "[");
    if (!hasAttrs) {
      this.mentionNode(first.ids[0], scope.node, first.line, first.column);
      return true;
    }
    const explicit = this.parseAttrLists();
    if (explicit === undefined) return false;
    this.declareNode(first.ids[0], scope.node, explicit, first.line, first.column);
    return true;
  }

  /** Register every node an endpoint names; a subgraph's members are already in. */
  private mentionEndpoint(endpoint: Endpoint, scope: Scope): void {
    if (endpoint.subgraph) return;
    for (const id of endpoint.ids) {
      this.mentionNode(id, scope.node, endpoint.line, endpoint.column);
    }
  }

  private parseEndpoint(scope: Scope): Endpoint | undefined {
    const t = this.peek();
    if (this.isPunct(t, "{") || this.isKeyword(t, "subgraph")) {
      return this.parseSubgraph(scope);
    }
    if (!this.isIdToken(t)) {
      this.fail(t, `Expected a node name, found ${describe(t)}.`);
      return undefined;
    }
    const id = this.readId();
    if (id === undefined) {
      this.fail(t, `Expected a node name, found ${describe(t)}.`);
      return undefined;
    }
    if (!this.skipPortSpec()) return undefined;
    return { ids: [id], line: t.line, column: t.column, subgraph: false };
  }

  /** `node:port:compass` — DarkPrint has no port syntax in the DOT, ports live on the card (§3.3). */
  private skipPortSpec(): boolean {
    while (this.isPunct(this.peek(), ":")) {
      const colon = this.advance();
      const part = this.peek();
      if (!this.isIdToken(part)) {
        this.fail(part, `Expected a port name after \`:\`, found ${describe(part)}.`);
        return false;
      }
      this.advance();
      if (!this.portsReported) {
        this.portsReported = true;
        this.diagnostics.push(
          warning("dot/unsupported", "Port and compass specifiers are ignored.", {
            hint: "Pin ports on the edge instead, with `out=` and `in=`.",
            location: this.locOf(colon),
          }),
        );
      }
    }
    return true;
  }

  /** `[subgraph [ID]] '{' stmt_list '}'` — flattened, but its defaults are scoped to it. */
  private parseSubgraph(scope: Scope): Endpoint | undefined {
    const start = this.peek();
    if (this.isKeyword(start, "subgraph")) {
      this.advance();
      // The name is not kept: the model is flat, so a subgraph has no identity of its own.
      if (this.isIdToken(this.peek())) this.advance();
    }
    if (!this.isPunct(this.peek(), "{")) {
      this.fail(this.peek(), `Expected \`{\` to open a subgraph, found ${describe(this.peek())}.`);
      return undefined;
    }
    if (scope.depth >= MAX_SUBGRAPH_DEPTH) {
      // Reading on would recurse once more per level and take the host's stack with it,
      // so the file is reported as unreadable — the one thing this parser must never do
      // is throw. Nothing after this point is parsed.
      this.fail(
        start,
        `Subgraphs are nested more than ${MAX_SUBGRAPH_DEPTH} deep.`,
        "A blueprint needs a handful of levels at most; check for unbalanced `{` braces.",
      );
      this.aborted = true;
      return undefined;
    }
    this.advance();
    const child: Scope = {
      node: { ...scope.node },
      edge: { ...scope.edge },
      graph: { ...scope.graph },
      depth: scope.depth + 1,
    };
    const collected: string[] = [];
    this.collectors.push(collected);
    this.parseStmtList(child);
    this.collectors.pop();
    if (!this.expectPunct("}")) return undefined;
    return { ids: collected, line: start.line, column: start.column, subgraph: true };
  }

  /** One or more `[ a=b, c=d ]` groups, merged left to right. */
  private parseAttrLists(): MutableAttrs | undefined {
    const out: MutableAttrs = {};
    while (this.isPunct(this.peek(), "[")) {
      this.advance();
      for (;;) {
        const t = this.peek();
        if (this.isPunct(t, "]")) {
          this.advance();
          break;
        }
        if (t.kind === "eof") {
          this.fail(t, "Unexpected end of input inside an attribute list.", "Close it with `]`.");
          return undefined;
        }
        if (this.isPunct(t, ",") || this.isPunct(t, ";")) {
          this.advance();
          continue;
        }
        if (!this.isIdToken(t)) {
          this.fail(t, `Expected an attribute name, found ${describe(t)}.`);
          return undefined;
        }
        const key = this.readId();
        if (key === undefined) return undefined;
        if (!this.isPunct(this.peek(), "=")) {
          this.fail(
            this.peek(),
            `Expected \`=\` after the attribute \`${key}\`, found ${describe(this.peek())}.`,
          );
          return undefined;
        }
        this.advance();
        const value = this.readId();
        if (value === undefined) {
          this.fail(this.peek(), `Expected a value after \`=\`, found ${describe(this.peek())}.`);
          return undefined;
        }
        out[key] = value;
      }
    }
    return out;
  }

  /** An ID token, joining `"a" + "b"` concatenations into one value. */
  private readId(): string | undefined {
    const t = this.peek();
    if (!this.isIdToken(t)) return undefined;
    this.advance();
    let value = t.value;
    if (t.kind === "string") {
      while (this.isPunct(this.peek(), "+") && this.peek(1).kind === "string") {
        this.advance();
        value += this.advance().value;
      }
    }
    return value;
  }
}

/**
 * Parse DOT source into a flat graph. Never throws.
 *
 * `graph` is omitted only when the source could not be read (a `dot/parse-error`
 * was emitted); a semantic error such as `dot/not-directed` still yields a graph
 * so the caller can show what the user actually wrote. Check `hasErrors` before
 * trusting the result.
 */
export function parseDot(src: string, file?: string): DotParseResult {
  const lexed = lex(src, file);
  const parser = new DotParser(lexed.tokens, file);
  const graph = parser.parse();
  const diagnostics = [...lexed.diagnostics, ...parser.diagnostics];
  const broken = diagnostics.some((d) => d.code === "dot/parse-error");
  if (graph === undefined || broken) return { diagnostics };
  return { graph, diagnostics };
}
