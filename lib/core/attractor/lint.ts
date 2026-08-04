/* ============================================================
   DarkPrint core — the Attractor compatibility linter
   Fase 0 spec PART 0 (doc 2 §11 item 0, doc 1 §0.1.1). Attractor
   consumes a strict subset of DOT:

     Graph      ::= 'digraph' Identifier '{' Statement* '}'
     NodeStmt   ::= Identifier AttrBlock? ';'?
     EdgeStmt   ::= Identifier ( '->' Identifier )+ AttrBlock? ';'?
     AttrBlock  ::= '[' Attr ( ',' Attr )* ']'
     Attr       ::= Key '=' Value
     Identifier ::= [A-Za-z_][A-Za-z0-9_]*
     String     ::= '"' ( '\"' | '\n' | '\t' | '\\' | [^"\] )* '"'
     Duration   ::= Integer ( 'ms' | 's' | 'm' | 'h' | 'd' )

   DarkPrint's own DOT parser is deliberately more permissive than
   this — it reads `strict`, `#` comments, semicolon-separated
   attributes and quoted node ids, because those are all legal
   Graphviz and an author who wrote one has not written a broken
   blueprint. So the two layers are kept apart: `dot/*` says the
   file is not readable, `attractor/*` says the file is readable but
   will not run under Attractor. **Every diagnostic here is a
   warning** — a bundle that breaks an Attractor rule is still a
   valid DarkPrint bundle, and the author must be told which of the
   two is complaining.

   The five rules of the contract, plus one:
     1. `digraph` only — no `strict`, no undirected `graph`, one
        graph per file
     2. node identifiers match the Identifier rule — no hyphens, no
        leading digit, no quoted node ids — and are not one of the
        grammar's statement keywords, which match the rule and
        still cannot open a NodeStmt
     3. attribute lists are comma-separated
     4. comments are `//` lines and slash-star blocks only — `#`
        is not Attractor DOT
     5. values are String / Integer / Float / Boolean / Duration /
        bare word
     6. (beyond the five) a node must not carry a `type` attribute.
        Attractor reads node `type` as a *handler override*;
        DarkPrint's `type` is an ontology term inside the YAML card
        (doc 3 §3). The contract's own note says "keep it that way",
        and a DOT that puts an ontology term in `type=` silently
        hands Attractor a handler name. Nothing else about
        unreserved attributes is reported: Attractor ignores them,
        which is the fact the whole compatibility claim rests on.
   ============================================================ */

import { sortDiagnostics, warning } from "../diagnostics";
import type { Diagnostic, DiagnosticCode, DiagnosticLocation } from "../diagnostics";
import { lex } from "../dot/lexer";
import type { Token } from "../dot/lexer";
import type { DotGraph } from "../dot/parser";
import { isAttractorIdentifier, isAttractorKeyword } from "./reserved";

/**
 * How many times one rule is reported before the rest are folded into a single
 * summary. A hand-written blueprint trips a rule a handful of times; a generated
 * one can trip it on every line, and a wall of identical warnings buries the rules
 * it did not trip. Mirrors the parser's own `MAX_PARSE_ERRORS` in spirit.
 */
const MAX_PER_CODE = 20;

/** The five units of the grammar's `Duration` rule. */
const DURATION_UNITS: readonly string[] = Object.freeze(["ms", "s", "m", "h", "d"]);

/** Attractor's node attribute that means "handler override" — never DarkPrint's `type`. */
const HANDLER_OVERRIDE_ATTRIBUTE = "type";

/* --------------------- reporting --------------------- */

/** Accumulates warnings, capping the repeats of any one rule. */
interface Reporter {
  readonly diagnostics: Diagnostic[];
  /** Report one occurrence. `line`/`column` are 1-based, as everywhere else. */
  report(
    code: DiagnosticCode,
    message: string,
    hint: string,
    where?: { line?: number; column?: number; nodeId?: string },
  ): void;
}

function createReporter(file: string | undefined): Reporter {
  const diagnostics: Diagnostic[] = [];
  const counts = new Map<DiagnosticCode, number>();

  const locate = (where?: { line?: number; column?: number; nodeId?: string }): DiagnosticLocation => {
    const location: DiagnosticLocation = {};
    if (file !== undefined) location.file = file;
    if (where?.nodeId !== undefined) location.nodeId = where.nodeId;
    if (where?.line !== undefined) location.line = where.line;
    if (where?.column !== undefined) location.column = where.column;
    return location;
  };

  return {
    diagnostics,
    report(code, message, hint, where) {
      const seen = counts.get(code) ?? 0;
      counts.set(code, seen + 1);
      if (seen < MAX_PER_CODE) {
        diagnostics.push(warning(code, message, { hint, location: locate(where) }));
        return;
      }
      if (seen === MAX_PER_CODE) {
        // One line saying the list was cut, rather than silence: the author needs to
        // know there is more of the same, even though listing it helps nobody.
        diagnostics.push(
          warning(code, `More than ${MAX_PER_CODE} occurrences of this problem; the rest are not listed.`, {
            hint,
            location: locate(),
          }),
        );
      }
    },
  };
}

/* --------------------- token helpers --------------------- */

function isPunct(t: Token | undefined, value: string): boolean {
  return t !== undefined && t.kind === "punct" && t.value === value;
}

/** DOT keywords are case-insensitive; a quoted "graph" is an ordinary id, not a keyword. */
function isKeyword(t: Token | undefined, keyword: string): boolean {
  return t !== undefined && t.kind === "id" && t.value.toLowerCase() === keyword;
}

/** The three token classes that are "ID" in the DOT grammar. */
function isIdLike(t: Token | undefined): boolean {
  return t !== undefined && (t.kind === "id" || t.kind === "number" || t.kind === "string");
}

/**
 * True when `b` starts exactly where `a` ends, with no whitespace between them —
 * how `30s` is told apart from `30 s`. Token values hold their source text, so the
 * length of `a.value` is the length it occupied.
 */
function isAdjacent(a: Token, b: Token): boolean {
  return b.line === a.line && b.column === a.column + a.value.length;
}

/* --------------------- rule 1: one plain digraph --------------------- */

/**
 * `strict` and `graph` are facts about the parsed graph; the token stream is used
 * only to point at where they were written.
 */
function checkGraphHeader(dot: DotGraph, tokens: readonly Token[], report: Reporter): void {
  const first = tokens[0];
  const strictToken = isKeyword(first, "strict") ? first : undefined;
  const keywordToken = strictToken === undefined ? first : tokens[1];

  if (dot.strict) {
    report.report(
      "attractor/strict-graph",
      "The graph is declared `strict`, which Attractor's grammar does not admit.",
      "Drop the `strict` keyword: Attractor reads `digraph <name> { … }` and nothing before it.",
      strictToken === undefined ? undefined : { line: strictToken.line, column: strictToken.column },
    );
  }
  if (!dot.directed) {
    report.report(
      "attractor/undirected-graph",
      "The graph is declared with `graph`, so Attractor will not read it as a workflow.",
      "Write `digraph` and `->` edges. A blueprint is directed anyway: an edge says whose output becomes whose input.",
      keywordToken === undefined ? undefined : { line: keywordToken.line, column: keywordToken.column },
    );
  }
}

/* --------------------- rule 2: node identifiers --------------------- */

/**
 * The Identifier rule, checked against the ids the parser actually built — and the second
 * way a node id stops being one.
 *
 * Matching `[A-Za-z_][A-Za-z0-9_]*` is necessary and not sufficient. `node`, `edge`,
 * `graph`, `subgraph` and `digraph` all match it and none of them can open a `NodeStmt`:
 * the grammar has `NodeDefaults ::= 'node' AttrBlock`, `GraphAttrStmt ::= 'graph'
 * AttrBlock`, `SubgraphStmt ::= 'subgraph' Identifier? '{'`, so `node [label="x"]` sets the
 * defaults for every node after it and `subgraph [label="x"]` does not parse at all. The
 * card's label, shape and prompt are then either lost or leak onto the following node.
 * DarkPrint's own parser is happy to build a node called `node` (`digraph g { node -> b; }`
 * gives two nodes), so nothing else in the pipeline would notice.
 *
 * One code for both, because the author's fix is the same one — rename the node — and the
 * message says which of the two rules was broken. The boundary ids (`start`, `exit`, …) are
 * deliberately *not* reported: Attractor resolves those as the pipeline's entry and exit by
 * name, which is legal and useful in a hand-written file. They only clash with the
 * synthesised `Mdiamond`/`Msquare`, and that is `emit.ts`'s problem, not the author's.
 */
function checkNodeIds(dot: DotGraph, report: Reporter): void {
  for (const stmt of dot.nodes) {
    if (isAttractorKeyword(stmt.id)) {
      report.report(
        "attractor/bad-node-id",
        `Node id \`${stmt.id}\` is a word Attractor's grammar reads as a statement keyword, not as a node.`,
        `\`${stmt.id}\` opens a defaults, attribute or subgraph statement, so the attributes written next to it are applied somewhere else or not at all. Rename the node and put the readable name in \`label\`, or in the card's \`name\`.`,
        { nodeId: stmt.id, line: stmt.line, column: stmt.column },
      );
      continue;
    }
    if (isAttractorIdentifier(stmt.id)) continue;
    report.report(
      "attractor/bad-node-id",
      `Node id \`${stmt.id}\` is not an Attractor identifier.`,
      "Identifiers are `[A-Za-z_][A-Za-z0-9_]*`: no hyphens, no leading digit, no spaces. The readable name belongs in `label`, or in the card's `name`.",
      { nodeId: stmt.id, line: stmt.line, column: stmt.column },
    );
  }
}

/**
 * A quoted id that *would* be legal unquoted still fails, because `NodeStmt` expects an
 * `Identifier` and a quoted id lexes as a `String`. The parser has already thrown the
 * quotes away, so this is decided on the token stream.
 *
 * Judgement call: deciding "is this string token a node id?" without re-parsing is a
 * heuristic. It is deliberately conservative — a token only counts when its value is
 * one of the ids the parser really built AND it sits where only a node can sit: next to
 * an edge operator, or alone at the start of a statement. Anything adjacent to `=` is an
 * attribute key or value and is never considered, which is what keeps `label="planner"`
 * out of the report.
 */
function isNodeIdPosition(tokens: readonly Token[], index: number): boolean {
  const previous = tokens[index - 1];
  const next = tokens[index + 1];
  if (isPunct(previous, "=") || isPunct(next, "=")) return false;
  // `digraph "my graph" { … }` — a quoted graph name, which is the graph's business.
  if (isKeyword(previous, "digraph") || isKeyword(previous, "graph") || isKeyword(previous, "subgraph")) {
    return false;
  }
  if (next?.kind === "edgeop" || previous?.kind === "edgeop") return true;
  const atStatementStart =
    previous === undefined ||
    isPunct(previous, "{") ||
    isPunct(previous, "}") ||
    isPunct(previous, ";") ||
    isPunct(previous, "]");
  return atStatementStart && (isPunct(next, "[") || isPunct(next, ";") || isPunct(next, "}"));
}

/* --------------------- rules 1c, 2b, 3, 5: the token pass --------------------- */

/**
 * One walk over the tokens covering everything the parsed graph cannot answer:
 * whether a second graph follows the first, whether a node id was quoted, whether
 * attributes were comma-separated, and whether a value is a form the grammar admits.
 */
function scanTokens(dot: DotGraph, tokens: readonly Token[], report: Reporter): void {
  const nodeIds = new Set(dot.nodes.map((n) => n.id));
  let depth = 0;
  let opened = false;
  let closedAt = -1;
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "eof") break;

    if (isPunct(t, "{")) {
      depth += 1;
      opened = true;
      i += 1;
      continue;
    }
    if (isPunct(t, "}")) {
      // Clamped: an unbalanced `}` is a `dot/parse-error` the parser owns, and a
      // negative depth here would make every later token look like a second graph.
      depth = depth > 0 ? depth - 1 : 0;
      if (opened && depth === 0 && closedAt < 0) closedAt = i;
      i += 1;
      continue;
    }
    if (isPunct(t, "[")) {
      i = scanAttrList(tokens, i, report);
      continue;
    }
    if (t.kind === "string" && nodeIds.has(t.value) && isNodeIdPosition(tokens, i)) {
      report.report(
        "attractor/quoted-node-id",
        `Node id \`"${t.value}"\` is quoted, and Attractor expects a bare identifier there.`,
        `Write \`${t.value}\` without quotes; put anything that needs quoting in \`label\`.`,
        { nodeId: t.value, line: t.line, column: t.column },
      );
    }
    i += 1;
  }

  if (closedAt >= 0) {
    const trailing = tokens[closedAt + 1];
    if (trailing !== undefined && trailing.kind !== "eof") {
      report.report(
        "attractor/multiple-graphs",
        "More than one graph in the file; Attractor reads one graph per file.",
        "Split the second graph into its own file. DarkPrint reads only the first one either way.",
        { line: trailing.line, column: trailing.column },
      );
    }
  }
}

/**
 * Walk one `[ … ]` block, checking the separator after every attribute and the shape of
 * every value. Returns the index just past the closing `]`.
 *
 * Anything structurally broken (a missing `=`, a value that is not there) is left alone:
 * the parser has already reported it as `dot/parse-error`, and a second opinion from the
 * linter would only double the noise.
 */
function scanAttrList(tokens: readonly Token[], start: number, report: Reporter): number {
  let i = start + 1;
  for (;;) {
    const key = tokens[i];
    if (key === undefined || key.kind === "eof") return i;
    if (isPunct(key, "]")) return i + 1;
    if (!isIdLike(key)) return skipToClose(tokens, i);
    if (!isPunct(tokens[i + 1], "=")) return skipToClose(tokens, i);

    i = scanValue(tokens, i + 2, report);

    const separator = tokens[i];
    if (separator === undefined || separator.kind === "eof") return i;
    if (isPunct(separator, ",")) {
      i += 1;
      continue;
    }
    if (isPunct(separator, "]")) return i + 1;

    report.report(
      "attractor/attr-separator",
      "Attributes are not separated by a comma.",
      "`AttrBlock ::= '[' Attr ( ',' Attr )* ']'`, write `[a=1, b=2]`. Graphviz accepts a semicolon or a space; Attractor does not.",
      { line: separator.line, column: separator.column },
    );
    // The offending separator is stepped over so the rest of the block is still
    // checked; a space between attributes leaves the next key where it already is.
    if (isPunct(separator, ";")) i += 1;
  }
}

/** Skip to just past the next `]`, for a block the parser has already failed on. */
function skipToClose(tokens: readonly Token[], from: number): number {
  let i = from;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "eof") return i;
    if (isPunct(t, "]")) return i + 1;
    i += 1;
  }
  return i;
}

/**
 * One attribute value. Returns the index just past it.
 *
 * `Value` is String / Integer / Float / Boolean / Duration / bare word. Two forms that
 * Graphviz accepts are outside it and are reported: the `"a" + "b"` concatenation, and
 * an HTML-like `<…>` literal (caught by the source scan, which is the only place the
 * angle brackets still exist — the lexer turns them into a plain string token).
 */
function scanValue(tokens: readonly Token[], start: number, report: Reporter): number {
  let i = start;
  const value = tokens[i];
  if (value === undefined || value.kind === "eof") return i;

  if (value.kind === "string") {
    i += 1;
    while (isPunct(tokens[i], "+")) {
      const plus = tokens[i];
      report.report(
        "attractor/unsupported-value",
        "String concatenation with `+` is not one of Attractor's value forms.",
        "Join the pieces into a single quoted string.",
        { line: plus.line, column: plus.column },
      );
      i += 1;
      if (tokens[i]?.kind === "string") i += 1;
    }
    return i;
  }

  if (value.kind === "number") {
    i += 1;
    const unit = tokens[i];
    // `30s` lexes as a number and an id with nothing between them: that is a Duration.
    if (unit !== undefined && unit.kind === "id" && isAdjacent(value, unit)) {
      if (!DURATION_UNITS.includes(unit.value)) {
        report.report(
          "attractor/unsupported-value",
          `\`${value.value}${unit.value}\` is not one of Attractor's value forms.`,
          `A Duration is an integer with one of ${DURATION_UNITS.map((u) => `\`${u}\``).join(", ")}.`,
          { line: value.line, column: value.column },
        );
      }
      i += 1;
    }
    return i;
  }

  // A bare word: an identifier, `true`, `false`, a shape name. All admitted.
  return i + 1;
}

/* --------------------- rule 4 and the HTML-like value: the source pass --------------------- */

/**
 * Comments and HTML-like literals leave no trace in the token stream — the lexer drops
 * the first and flattens the second — so they are found by walking the source text.
 * Newlines are counted the way the lexer counts them (CRLF and a lone CR are one line
 * break) so a position reported here lines up with one reported by the parser.
 */
function scanSource(src: string, report: Reporter): void {
  let i = 0;
  let line = 1;
  let column = 1;

  const at = (offset = 0): string => src.charAt(i + offset);

  const advance = (): void => {
    const c = src.charAt(i);
    i += 1;
    if (c === "\r") {
      if (src.charAt(i) === "\n") i += 1;
      line += 1;
      column = 1;
      return;
    }
    if (c === "\n") {
      line += 1;
      column = 1;
      return;
    }
    column += 1;
  };

  const skipToEndOfLine = (): void => {
    while (i < src.length && at() !== "\n" && at() !== "\r") advance();
  };

  while (i < src.length) {
    const c = at();

    if (c === '"') {
      advance();
      while (i < src.length) {
        const ch = at();
        if (ch === "\\") {
          // Mirrors the lexer: a backslash always takes the next character with it,
          // so an escaped quote does not end the string.
          advance();
          if (i < src.length) advance();
          continue;
        }
        advance();
        if (ch === '"') break;
      }
      continue;
    }

    if (c === "/" && at(1) === "/") {
      skipToEndOfLine();
      continue;
    }

    if (c === "/" && at(1) === "*") {
      advance();
      advance();
      while (i < src.length) {
        if (at() === "*" && at(1) === "/") {
          advance();
          advance();
          break;
        }
        advance();
      }
      continue;
    }

    if (c === "#") {
      report.report(
        "attractor/hash-comment",
        "`#` starts a comment in Graphviz, but Attractor's grammar has no `#` comment.",
        "Use `//` for a line comment or `/* … */` for a block.",
        { line, column },
      );
      skipToEndOfLine();
      continue;
    }

    if (c === "<") {
      report.report(
        "attractor/unsupported-value",
        "An HTML-like `<…>` literal is not one of Attractor's value forms.",
        "Use a quoted string. DarkPrint reads the markup as plain text anyway.",
        { line, column },
      );
      // Skip the whole literal, nesting included, so a `#` or a quote inside its
      // markup is not read as source.
      let depth = 0;
      while (i < src.length) {
        const ch = at();
        advance();
        if (ch === "<") depth += 1;
        else if (ch === ">") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      continue;
    }

    advance();
  }
}

/* --------------------- rule 6: the handler-override attribute --------------------- */

/**
 * Attractor's node `type` selects a *handler*. DarkPrint's `type` is an ontology term
 * that lives in the card, and the contract is explicit that it stays there.
 */
function checkHandlerOverride(dot: DotGraph, report: Reporter): void {
  for (const stmt of dot.nodes) {
    if (!Object.prototype.hasOwnProperty.call(stmt.attrs, HANDLER_OVERRIDE_ATTRIBUTE)) continue;
    report.report(
      "attractor/reserved-attribute",
      `Node \`${stmt.id}\` carries a \`type\` attribute, which Attractor reads as a handler override.`,
      "DarkPrint's node type is an ontology term in the card (doc 3 §3), not a DOT attribute. Remove `type` from the DOT; the shape is what selects the handler.",
      { nodeId: stmt.id, line: stmt.line, column: stmt.column },
    );
  }
}

/* --------------------- the entry point --------------------- */

/**
 * Check a parsed blueprint against the DOT subset Attractor reads.
 *
 * Returns warnings only, sorted: a bundle that breaks one of these rules is a valid
 * DarkPrint bundle that will not run under Attractor. Never throws.
 *
 * Both arguments are needed and neither is redundant. `dot` carries the facts the
 * parser settled — the ids it built, whether the graph was `strict` or directed, the
 * attributes each node ended up with. `src` carries what the parser threw away —
 * comments, quoting, separators, HTML-like literals — and those are four of the six
 * rules. `file` is optional and only decorates the diagnostics, exactly as it does for
 * `parseDot` and `loadCard`.
 */
export function lintAttractor(dot: DotGraph, src: string, file?: string): Diagnostic[] {
  const report = createReporter(file);
  const tokens = lex(src, file).tokens;

  checkGraphHeader(dot, tokens, report);
  checkNodeIds(dot, report);
  checkHandlerOverride(dot, report);
  scanTokens(dot, tokens, report);
  scanSource(src, report);

  return sortDiagnostics(report.diagnostics);
}
