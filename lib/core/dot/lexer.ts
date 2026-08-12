/* ============================================================
   DarkPrint core — DOT lexer
   Hand-written tokenizer for the DOT subset a blueprint needs:
   keywords, ids, numerals, quoted strings, edge operators,
   punctuation and all three comment styles. No dependency, no
   I/O — pure function of its input.
   Design doc §2, engine spec §7.
   ============================================================ */

import { error, warning } from "../diagnostics";
import type { Diagnostic, DiagnosticLocation } from "../diagnostics";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-29): POST /api/validate/dot (server counterpart, for publish-time re-validation)

/** Token classes. `id`, `number` and `string` are all "ID" in the DOT grammar. */
export type TokenKind = "id" | "number" | "string" | "punct" | "edgeop" | "eof";

/** One token. `line`/`column` are 1-based and point at its first character. */
export interface Token {
  kind: TokenKind;
  /** For `string`, the unescaped content without the surrounding quotes. */
  value: string;
  line: number;
  column: number;
}

/** Tokens always end with an `eof` token, even when the source is malformed. */
export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

/** Single-character punctuation. `+` is here because DOT concatenates quoted strings with it. */
const PUNCTUATION = "{}[];,=:+";

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

/** DOT ids are `[a-zA-Z_\200-\377][a-zA-Z_0-9\200-\377]*`; we allow any non-ASCII as a letter. */
function isIdStart(c: string): boolean {
  return (
    (c >= "a" && c <= "z") ||
    (c >= "A" && c <= "Z") ||
    c === "_" ||
    c.charCodeAt(0) >= 0x80
  );
}

function isIdChar(c: string): boolean {
  return isIdStart(c) || isDigit(c);
}

function isSpace(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v";
}

/**
 * Tokenize DOT source. Never throws: an unterminated string, an unterminated
 * block comment or a stray character becomes a `dot/parse-error` and lexing
 * resumes at the next character so one typo does not swallow the file.
 */
export function lex(src: string, file?: string): LexResult {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const end = src.length;
  let i = 0;
  let line = 1;
  let column = 1;

  const at = (offset = 0): string => src.charAt(i + offset);

  const loc = (l: number, c: number): DiagnosticLocation =>
    file === undefined ? { line: l, column: c } : { file, line: l, column: c };

  const fail = (message: string, l: number, c: number, hint?: string): void => {
    diagnostics.push(error("dot/parse-error", message, { hint, location: loc(l, c) }));
  };

  /** Consume one character. CRLF and a lone CR are normalized to a single "\n". */
  const eat = (): string => {
    const c = src.charAt(i);
    i += 1;
    if (c === "\r") {
      if (src.charAt(i) === "\n") i += 1;
      line += 1;
      column = 1;
      return "\n";
    }
    if (c === "\n") {
      line += 1;
      column = 1;
      return "\n";
    }
    column += 1;
    return c;
  };

  const push = (kind: TokenKind, value: string, l: number, c: number): void => {
    tokens.push({ kind, value, line: l, column: c });
  };

  /** Digits with an optional sign and an optional fractional part: `-.5`, `2.`, `17`. */
  const readNumber = (): void => {
    const l = line;
    const c = column;
    let text = "";
    if (at() === "-") text += eat();
    if (at() === ".") {
      text += eat();
      while (isDigit(at())) text += eat();
    } else {
      while (isDigit(at())) text += eat();
      if (at() === ".") {
        text += eat();
        while (isDigit(at())) text += eat();
      }
    }
    push("number", text, l, c);
  };

  while (i < end) {
    const c = at();

    if (isSpace(c)) {
      eat();
      continue;
    }

    // Comments: `//` to end of line, `/* */` block, `#` to end of line.
    if (c === "/" && at(1) === "/") {
      while (i < end && at() !== "\n" && at() !== "\r") eat();
      continue;
    }
    if (c === "#") {
      while (i < end && at() !== "\n" && at() !== "\r") eat();
      continue;
    }
    if (c === "/" && at(1) === "*") {
      const l = line;
      const col = column;
      eat();
      eat();
      let closed = false;
      while (i < end) {
        if (at() === "*" && at(1) === "/") {
          eat();
          eat();
          closed = true;
          break;
        }
        eat();
      }
      if (!closed) {
        fail("Unterminated block comment.", l, col, "Close it with `*/`.");
      }
      continue;
    }

    // Quoted string. Only \" and a backslash-newline continuation are interpreted;
    // every other backslash escape is passed through verbatim, as Graphviz does
    // (`\n` and `\l` are label directives, not lexical escapes).
    if (c === '"') {
      const l = line;
      const col = column;
      eat();
      let text = "";
      let closed = false;
      while (i < end) {
        const ch = eat();
        if (ch === '"') {
          closed = true;
          break;
        }
        if (ch === "\\") {
          if (i >= end) break;
          const esc = eat();
          if (esc === '"') text += '"';
          else if (esc === "\n") continue; // line continuation
          else text += "\\" + esc;
          continue;
        }
        text += ch;
      }
      if (!closed) {
        fail("Unterminated quoted string.", l, col, 'Close it with a `"`.');
      }
      push("string", text, l, col);
      continue;
    }

    // HTML-like label `<...>`. DarkPrint has no use for markup, so the content is
    // kept as plain text and flagged rather than dropped.
    if (c === "<") {
      const l = line;
      const col = column;
      eat();
      let depth = 1;
      let text = "";
      while (i < end) {
        const ch = eat();
        if (ch === ">") {
          depth -= 1;
          if (depth === 0) break;
        } else if (ch === "<") {
          depth += 1;
        }
        text += ch;
      }
      if (depth > 0) {
        fail("Unterminated HTML-like string.", l, col, "Close it with `>`.");
      } else {
        diagnostics.push(
          warning("dot/unsupported", "HTML-like label is read as plain text.", {
            hint: "Use a quoted string if the markup matters.",
            location: loc(l, col),
          }),
        );
      }
      push("string", text, l, col);
      continue;
    }

    // `->` / `--`, or a negative numeral.
    if (c === "-") {
      if (at(1) === ">" || at(1) === "-") {
        const l = line;
        const col = column;
        eat();
        const second = eat();
        push("edgeop", "-" + second, l, col);
        continue;
      }
      if (isDigit(at(1)) || (at(1) === "." && isDigit(at(2)))) {
        readNumber();
        continue;
      }
      fail("Unexpected character `-`.", line, column, "Edges are written `->`.");
      eat();
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(at(1)))) {
      readNumber();
      continue;
    }

    if (isIdStart(c)) {
      const l = line;
      const col = column;
      let text = "";
      while (i < end && isIdChar(at())) text += eat();
      push("id", text, l, col);
      continue;
    }

    if (PUNCTUATION.includes(c)) {
      const l = line;
      const col = column;
      eat();
      push("punct", c, l, col);
      continue;
    }

    fail(`Unexpected character \`${c}\`.`, line, column);
    eat();
  }

  push("eof", "", line, column);
  return { tokens, diagnostics };
}
