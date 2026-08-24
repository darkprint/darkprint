/* ============================================================
   The instruments, falsified against inputs whose answers are known

   Not an acceptance criterion. Every cell here is about THIS SUITE
   and a red is a broken test, not a failed criterion — which is
   exactly why it exists: an all-green suite is a claim about an
   instrument until something shows the instrument still fires.

   Two of them are checked, and the reasons are different failures
   this repository has already paid for.

   `strip` + `importsOf` is AC1's whole discriminating power, and it
   can fail in BOTH directions. Blind to a real import, and AC1 reds
   nothing whatever the module does. Sighted on prose, and it reds a
   correct module on its own docblock — `lib/server/export/index.ts`
   discusses `recordDownload` by name in a comment, and
   `export-release.ts`'s header names the serving verbs to explain
   why it is not one of them. So the fixtures below include both a
   real import that MUST be found and three mentions that MUST NOT.

   `stringsIn` is AC3's leak scan, and its known blindness is the
   shape D-13's hygiene clause rewards: `rateLimitedError` hangs its
   payload off a symbol so `Object.keys`, `JSON.stringify` and a
   spread all skip it. An enumerable-only walk reads `{}` and
   reports no leak while the payload sits there — measured in this
   repository at zero reds across 6202 cells with a nonce on the
   error. So the fixtures include a symbol-keyed non-enumerable
   payload and a `cause` chain.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { importsOf, reveals, stringsIn, strip, type Outcome } from "./contract";

const names = (source: string): string[] =>
  importsOf("x.ts", source).flatMap((i) => i.names);
const specs = (source: string): string[] =>
  importsOf("x.ts", source).map((i) => i.specifier);

describe("the AC1 source scan finds what it must find", () => {
  it("reads a plain named import", () => {
    const src = `import { serveCard } from "@/lib/server/export";\n`;
    expect(names(src)).toContain("serveCard");
    expect(specs(src)).toEqual(["@/lib/server/export"]);
  });

  it("reads a multi-line import with a type member and an alias", () => {
    const src = [
      "import {",
      "  exportRelease,",
      "  type ExportedFile,",
      "  serveFile as serve,",
      '} from "@/lib/server/export";',
      "",
    ].join("\n");
    expect(names(src)).toContain("exportRelease");
    expect(names(src)).toContain("serveFile");
    expect(names(src)).toContain("ExportedFile");
  });

  it("reads a deep path as its own specifier", () => {
    const src = `import { recordDownload } from "@/lib/server/export/downloads";\n`;
    expect(specs(src)).toEqual(["@/lib/server/export/downloads"]);
  });
});

describe("the AC1 source scan does NOT fire on prose", () => {
  /* The three shapes that would red a correct module. Each is a real pattern from
     `lib/server/**`, not an invented one. */
  /* The comment carries a WHOLE import statement, not merely the forbidden name. A comment
     that only mentions `serveCard` is filtered by the `import … from` shape and would pass
     against a stripper that does nothing at all — measured: neutering `strip` reddened this
     cell only after the statement was put inside the comment. */
  it("ignores a line comment containing an entire import statement", () => {
    const src = `// import { serveCard } from "@/lib/server/export"; // never do this\n`;
    expect(names(src)).toEqual([]);
    expect(specs(src)).toEqual([]);
  });

  it("ignores a block comment that contains an entire import statement", () => {
    const src = [
      "/* This module deliberately does NOT write:",
      '   import { serveCard } from "@/lib/server/export";',
      "   would record a download. `exportRelease` is the read-only verb. */",
      'import { exportRelease } from "@/lib/server/export";',
      "",
    ].join("\n");
    expect(names(src)).toEqual(["exportRelease"]);
    expect(specs(src)).toEqual(["@/lib/server/export"]);
  });

  /* Same correction: the literal holds a whole statement, so the cell fails when the string
     body is not blanked. A refusal message quoting the import it forbids is a real shape. */
  it("ignores an entire import statement inside a string literal", () => {
    const src = [
      'import { exportRelease } from "@/lib/server/export";',
      `const why = 'never import { serveCard } from "@/lib/server/export": it writes.';`,
      "",
    ].join("\n");
    expect(names(src)).toEqual(["exportRelease"]);
    expect(specs(src)).toEqual(["@/lib/server/export"]);
  });

  it("blanks comment bodies without moving any offset", () => {
    const src = `import { a } from "@/lib/db"; // serveCard\n`;
    expect(strip(src)).toHaveLength(src.length);
    expect(strip(src).slice(0, 8)).toBe("import {");
    /* The blanking itself, asserted rather than inferred from the length: a `strip` that
       returned its input unchanged satisfies both lines above. */
    expect(strip(src)).not.toContain("serveCard");
  });

  it("keeps a template literal from swallowing the rest of the file", () => {
    const src = ["const q = `select 1`;", 'import { serveFile } from "@/lib/server/export";', ""].join(
      "\n",
    );
    expect(names(src)).toEqual(["serveFile"]);
  });
});

describe("the AC3 leak scan reads what an enumerable-only walk cannot", () => {
  const NONCE = "t220-nonce-9f3a";

  it("finds a string on a plain value", () => {
    expect(stringsIn({ a: { b: [NONCE] } })).toContain(NONCE);
  });

  it("finds a string in an error message", () => {
    expect(reveals({ ok: false, error: new Error(`no: ${NONCE}`) }, NONCE)).toBe(true);
  });

  it("finds a string down a `cause` chain", () => {
    const inner = new Error(NONCE);
    const outer = new Error("wrapped", { cause: new Error("middle", { cause: inner }) });
    expect(reveals({ ok: false, error: outer }, NONCE)).toBe(true);
  });

  it("finds a string behind a NON-ENUMERABLE symbol key, which `JSON.stringify` cannot", () => {
    const err = new Error("opaque");
    const CONTEXT = Symbol("context");
    Object.defineProperty(err, CONTEXT, { value: { secret: NONCE }, enumerable: false });
    /* The blindness this cell exists to rule out, stated as a measurement rather than a
       claim: the enumerable-only reading sees nothing here. */
    expect(JSON.stringify(err)).not.toContain(NONCE);
    expect(Object.keys(err)).toEqual([]);
    expect(reveals({ ok: false, error: err }, NONCE)).toBe(true);
  });

  it("finds a string inside returned bytes", () => {
    const bytes = new TextEncoder().encode(`---\n${NONCE}\n`);
    expect(reveals({ ok: true, value: [{ path: "x", bytes }] }, NONCE)).toBe(true);
  });

  it("terminates on a circular `cause`", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    (a as { cause?: unknown }).cause = b;
    expect(reveals({ ok: false, error: a }, NONCE)).toBe(false);
  });

  it("does NOT fire on a value that does not carry the needle", () => {
    const clean: Outcome = { ok: true, value: { path: "README.md", text: "nothing here" } };
    expect(reveals(clean, NONCE)).toBe(false);
  });
});
