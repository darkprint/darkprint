/* ============================================================
   Tests for the DOT lexer (engine spec §7).
   ============================================================ */

import { describe, expect, it } from "vitest";
import { lex } from "./lexer";
import type { Token, TokenKind } from "./lexer";

/** Tokens without the trailing eof, as `kind:value` pairs — compact enough to assert on. */
function shape(src: string): string[] {
  const { tokens } = lex(src);
  return tokens.slice(0, -1).map((t) => `${t.kind}:${t.value}`);
}

function kinds(src: string): TokenKind[] {
  return lex(src).tokens.map((t) => t.kind);
}

function first(src: string): Token {
  return lex(src).tokens[0];
}

describe("lex — token classes", () => {
  it("tokenizes a minimal digraph", () => {
    expect(shape("digraph g { a -> b; }")).toEqual([
      "id:digraph",
      "id:g",
      "punct:{",
      "id:a",
      "edgeop:->",
      "id:b",
      "punct:;",
      "punct:}",
    ]);
  });

  it("always terminates the stream with eof", () => {
    expect(kinds("")).toEqual(["eof"]);
    expect(kinds("a")).toEqual(["id", "eof"]);
    expect(lex("").tokens[0]).toEqual({ kind: "eof", value: "", line: 1, column: 1 });
  });

  it.each([
    ["{", "punct"],
    ["}", "punct"],
    ["[", "punct"],
    ["]", "punct"],
    [";", "punct"],
    [",", "punct"],
    ["=", "punct"],
    [":", "punct"],
    ["+", "punct"],
    ["->", "edgeop"],
    ["--", "edgeop"],
  ] as const)("lexes %s as %s", (src, kind) => {
    expect(first(src)).toMatchObject({ kind, value: src });
  });

  it("accepts underscores, digits and non-ASCII letters inside ids", () => {
    expect(shape("_a1 nodeÉ2 Ω")).toEqual(["id:_a1", "id:nodeÉ2", "id:Ω"]);
  });

  it("does not treat a leading digit as an id", () => {
    expect(shape("1a")).toEqual(["number:1", "id:a"]);
  });
});

describe("lex — numerals", () => {
  it.each([
    ["1", "1"],
    ["17", "17"],
    ["-1", "-1"],
    ["1.5", "1.5"],
    ["-1.5", "-1.5"],
    [".5", ".5"],
    ["-.5", "-.5"],
    ["2.", "2."],
  ])("lexes %s", (src, value) => {
    expect(first(src)).toMatchObject({ kind: "number", value });
  });

  it("prefers the edge operator over a negative numeral", () => {
    expect(shape("a->-1")).toEqual(["id:a", "edgeop:->", "number:-1"]);
  });

  it("reports a lone minus sign without stopping", () => {
    const { tokens, diagnostics } = lex("a - b");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "dot/parse-error",
      severity: "error",
      location: { line: 1, column: 3 },
    });
    expect(tokens.map((t) => t.value)).toEqual(["a", "b", ""]);
  });
});

describe("lex — quoted strings", () => {
  it("strips the quotes and keeps the content", () => {
    expect(first('"hello world"')).toMatchObject({ kind: "string", value: "hello world" });
  });

  it('unescapes \\" only', () => {
    expect(first('"say \\"hi\\""').value).toBe('say "hi"');
  });

  it("passes other backslash sequences through verbatim (they are label directives)", () => {
    expect(first('"line\\nbreak\\l"').value).toBe("line\\nbreak\\l");
  });

  it("honours a backslash-newline line continuation", () => {
    expect(first('"abc\\\ndef"').value).toBe("abcdef");
  });

  it("keeps a raw newline inside a string and counts the line", () => {
    const { tokens } = lex('"a\nb" x');
    expect(tokens[0].value).toBe("a\nb");
    expect(tokens[1]).toMatchObject({ kind: "id", value: "x", line: 2, column: 4 });
  });

  it("lexes `+` concatenation as three tokens", () => {
    expect(shape('"a" + "b"')).toEqual(["string:a", "punct:+", "string:b"]);
  });

  it("reports an unterminated string at its opening quote", () => {
    const { tokens, diagnostics } = lex('digraph g {\n  a [label="oops];\n}');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "dot/parse-error",
      severity: "error",
      message: "Unterminated quoted string.",
      location: { line: 2, column: 12 },
    });
    // The partial string is still emitted so the parser can keep its footing.
    expect(tokens[tokens.length - 2].kind).toBe("string");
  });

  it("carries the file name into the location when given", () => {
    const { diagnostics } = lex('"oops', "blueprint.dot");
    expect(diagnostics[0].location).toEqual({ file: "blueprint.dot", line: 1, column: 1 });
  });

  it("omits the file key when no file is given", () => {
    const { diagnostics } = lex('"oops');
    expect(diagnostics[0].location).toEqual({ line: 1, column: 1 });
  });
});

describe("lex — comments", () => {
  it("skips // line comments", () => {
    expect(shape("a // b -> c\nd")).toEqual(["id:a", "id:d"]);
  });

  it("skips # line comments", () => {
    expect(shape("# a comment\na")).toEqual(["id:a"]);
  });

  it("skips /* */ block comments and keeps counting lines", () => {
    const { tokens } = lex("a /* one\ntwo\nthree */ b");
    expect(tokens[1]).toMatchObject({ kind: "id", value: "b", line: 3, column: 10 });
  });

  it("does not start a comment inside a quoted string", () => {
    expect(first('"a // b"').value).toBe("a // b");
  });

  it("reports an unterminated block comment", () => {
    const { diagnostics } = lex("a /* never closed");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/parse-error",
        message: "Unterminated block comment.",
        location: { line: 1, column: 3 },
      }),
    ]);
  });
});

describe("lex — positions", () => {
  it("reports 1-based line and column", () => {
    const { tokens } = lex("digraph g {\n  a -> b;\n}");
    expect(tokens[0]).toMatchObject({ value: "digraph", line: 1, column: 1 });
    expect(tokens[3]).toMatchObject({ value: "a", line: 2, column: 3 });
    expect(tokens[4]).toMatchObject({ value: "->", line: 2, column: 5 });
    expect(tokens[7]).toMatchObject({ value: "}", line: 3, column: 1 });
  });

  it("treats CRLF and a lone CR as a single line break", () => {
    expect(lex("a\r\nb").tokens[1]).toMatchObject({ value: "b", line: 2, column: 1 });
    expect(lex("a\rb").tokens[1]).toMatchObject({ value: "b", line: 2, column: 1 });
  });

  it("places the eof token after the last character", () => {
    const { tokens } = lex("ab");
    expect(tokens[tokens.length - 1]).toMatchObject({ kind: "eof", line: 1, column: 3 });
  });
});

describe("lex — recovery", () => {
  it("reports an unexpected character once and carries on", () => {
    const { tokens, diagnostics } = lex("a % b");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "dot/parse-error",
      message: "Unexpected character `%`.",
      location: { line: 1, column: 3 },
    });
    expect(tokens.map((t) => t.value)).toEqual(["a", "b", ""]);
  });

  it("reads an HTML-like label as plain text and flags it", () => {
    const { tokens, diagnostics } = lex("a [label=<<b>hi</b>>]");
    expect(diagnostics).toEqual([
      expect.objectContaining({ code: "dot/unsupported", severity: "warning" }),
    ]);
    expect(tokens[4]).toMatchObject({ kind: "string", value: "<b>hi</b>" });
  });

  it("reports an unterminated HTML-like label", () => {
    const { diagnostics } = lex("a [label=<oops]");
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "dot/parse-error",
        message: "Unterminated HTML-like string.",
      }),
    ]);
  });
});
