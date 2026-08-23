/* ============================================================
   T262 — the blind contract surface, and the source-scan instrument

   Not a test file. `vitest.config.ts` collects `tests/**\/*.test.ts`
   and this module is imported by the suites beside it.

   ── what this author could and could not see ──
   GIVEN, and read: `backend.md`'s §T260-§T263 and every `D-263-NN`
   ruling; `vitest.config.ts`; `tests/server/contract.ts`;
   `tests/error-hygiene.test.ts`; the merged blind suites under
   `tests/server/t0NN/`.

   T262's OWN, and NEVER OPENED: `app/u/**`, `app/settings/**`,
   `components/profile/**`, `components/settings/**`, and the branch
   `feat/t262-profile`. Where those paths appear in this file they
   appear as PATH STRINGS handed to a scanner. No sentence in this
   file was transcribed from any of them, which is also why nothing
   here pins a survivor's wording: see PIN THE CRITERION below.

   ── why a source scan at all ──
   T262 publishes no module surface. Its criteria are a route's
   behaviour and its COPY, and `vitest.config.ts:49` is
   `environment: "node"` with no jsdom and no testing-library in the
   tree, so a rendered assertion is not available. D-263-03 met this
   exactly and ruled the criterion source-level rather than adding a
   DOM environment for one test's convenience. The same shape is
   used here.

   ============================================================
   THE INSTRUMENT, AND THE TWO WAYS IT FAILS IF BUILT NAIVELY

   A copy check over source text is wrong in BOTH directions unless
   comments are removed first. Both were measured on this tree
   before this file was written, not reasoned about:

     B. A sentence is retired from the JSX and a comment is left
        explaining the retirement. A raw grep still matches and REDS
        A CORRECT TREE.

     C. A sentence that must SURVIVE is deleted from the JSX but is
        still named in a comment. A raw grep still matches, so the
        presence premise PASSES while the sentence is off the
        reader's screen. This is the false GREEN and it is the
        direction a reviewer does not write.

   Measured over the 2x2 of {retired present, retired absent} x
   {survivor on screen, survivor in comment only}: the raw-grep
   guard is wrong on 2 of 4 cells, the comment-stripped guard on 0
   of 4. C is why `mustContain` below strips as well as
   `mustNotContain` does; stripping only the absence side would
   leave the premise satisfiable by a comment.

   ── and the stripper is a PARSER, not a regex ──
   The regex a reviewer writes first,
     `s.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"")`,
   was disqualified on six probes drawn from shapes this repository
   actually contains. It eats `https://` inside a string literal and
   inside JSX text, empties a template holding a protocol-relative
   URL, and treats a block-comment opener sitting in JSX TEXT as a
   comment. Four of six mangled. TypeScript's own parser is used
   instead, and comments are blanked to SPACES rather than removed
   so that byte offsets and line numbers survive: a failure message
   that cannot cite a line sends the reader to a 475-line file with
   no anchor. Validated over 40 real files in this tree: 40 stripped
   something, 0 gained a parse diagnostic, 0 drifted in byte length
   or line count.
   ============================================================ */

import { readFileSync, existsSync } from "node:fs";

import ts from "typescript";

/* Blanked rather than deleted, so `indexOf` on the stripped text is still an offset into the
   original file and a red can name a line. `getFullStart` walks trivia, which is where a leading
   comment lives; the `seen` set is because a range is reachable as one node's trailing trivia and
   the next node's leading trivia, and blanking twice is harmless but scanning twice is not free. */
export function stripComments(text: string, fileName = "f.tsx"): string {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = text.split("");
  const seen = new Set<string>();
  const blank = (pos: number, end: number) => {
    const key = `${pos}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    for (let i = pos; i < end; i++) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  const visit = (node: ts.Node) => {
    for (const r of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) blank(r.pos, r.end);
    for (const r of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) blank(r.pos, r.end);
    /* ── A JSX COMMENT IS NOT TRIVIA, AND THE TWO CALLS ABOVE CANNOT SEE ONE ──
       `{/* ... *\/}` parses as a JsxExpression with NO expression; the comment sits inside the
       braces, so it is never leading or trailing trivia of any node and both range calls miss it
       entirely. Measured before this line existed: `app/settings/page.tsx` holds 12 and
       `SiteHeader.tsx` 7, and a stripper that leaves them behind leaves the FALSE-RED direction
       wide open on the exact files this suite scans — a `{/* the ... line was retired here *\/}`
       would be read as the sentence itself and charge a correct implementer with the removal
       they performed. Blanked as a whole node, which is safe: a JsxExpression with no expression
       carries nothing but the comment. */
    if (ts.isJsxExpression(node) && node.expression === undefined) blank(node.getStart(), node.getEnd());
    node.forEachChild(visit);
  };
  visit(sf);
  return out.join("");
}

export interface Source {
  path: string;
  raw: string;
  /** The file with every comment blanked to spaces. Offsets match `raw`. */
  code: string;
}

/* ============================================================
   THE POSITIVE PREMISE, AND WHY EVERY NEGATIVE DEPENDS ON ONE

   A negative grep is GREEN AGAINST AN ABSENT TREE. No files, no
   matches, pass — and no mutation to the implementation can red it,
   because the instrument never reached the implementation. That is
   the `rejects`-wrapper defect in grep form.

   So `sources()` REFUSES rather than returning an empty list, and
   it refuses on three separate grounds: the path does not exist,
   the file is below a byte floor, and the set is smaller than the
   caller said it would be. A file truncated to nothing satisfies
   "exists" and every absence assertion over it at the same time.
   ============================================================ */

export class PartitionError extends Error {
  override readonly name = "PartitionError";
}

/** Below this a file cannot be carrying the copy any criterion is about. */
export const BYTE_FLOOR = 200;

export function sources(paths: readonly string[], atLeast: number): Source[] {
  if (paths.length < atLeast) {
    throw new PartitionError(
      `expected at least ${atLeast} files in this partition, the list names ${paths.length}. ` +
        `A shrunken list is how an absence assertion goes vacuous without anything redding.`,
    );
  }
  const missing = paths.filter((p) => !existsSync(p));
  if (missing.length > 0) {
    throw new PartitionError(
      `these files do not exist: ${missing.join(", ")}. Every absence assertion below is ` +
        `GREEN against a missing file, so this is raised as the premise rather than passed over.`,
    );
  }
  const read = paths.map((path) => {
    const raw = readFileSync(path, "utf8");
    return { path, raw, code: stripComments(raw, path) };
  });
  const thin = read.filter((s) => s.raw.length < BYTE_FLOOR);
  if (thin.length > 0) {
    throw new PartitionError(
      `below the ${BYTE_FLOOR}-byte floor: ${thin.map((s) => `${s.path} (${s.raw.length}B)`).join(", ")}. ` +
        `An emptied file satisfies "exists" and every absence assertion over it at once.`,
    );
  }
  return read;
}

/* ============================================================
   SCOPE EACH CLAUSE TO THE FILE THAT MUST CARRY IT

   A cell asserting that a body names three words, run over a SET of
   files, stays green when one word is removed from the file that
   owed it, because the word occurs in another file the scan covers.
   Three such maskings were found in one T263 suite and two of them
   surfaced only in the round AFTER the repairs. So the two helpers
   below take a SINGLE `Source`, never a list, and there is
   deliberately no list-shaped variant to reach for.
   ============================================================ */

/* ============================================================
   A RENDERED SENTENCE IS NOT A SOURCE LINE, AND A LITERAL MATCHER
   READS A WRAPPED ONE AS ABSENT

   Measured on this tree: `never sent anywhere` and `stays in this
   browser` each occur ZERO times literally and ONCE after
   normalisation. The first wraps across a line break, the second
   wraps with a `</span>` inside it. Both are single sentences to a
   reader and three fragments to a scanner.

   The consequence is a FALSE GREEN in the direction that matters
   most here: a retirement cell asks whether a claim is gone, and a
   claim that merely WRAPPED reads as gone. The pin passes, the
   sentence is still on the page, and nothing reds — the same shape
   as the comment-only defect, reached by a different route.

   This was first diagnosed here as the published quotations being
   PARAPHRASES, which was wrong and would have led to the opposite
   repair: distrusting the rulings' text and re-deriving every pin
   from source, instead of fixing the matcher. Recorded because the
   measurement was right and the diagnosis was not, and only the
   diagnosis decides what changes.

   Normalisation drops JSX markup and collapses whitespace. It
   destroys offsets, so presence is decided on normalised text while
   the line number is still taken from a literal hit when there is
   one — and a red says `wrapped` when there is not, because that
   tells the reader why grepping the file by hand will not find it.
   ============================================================ */
export function collapse(text: string): string {
  return text.replace(/\s+/g, " ");
}

/* Tags dropped AS WELL as whitespace collapsed. Used only as the third pass, never alone: this
   also eats JSX ATTRIBUTES, and attribute text is rendered copy — `why="no ownership to move"`
   and the `title=` tooltip D-262-17 identified are both sentences a reader sees. Stripping tags
   as the only normalisation made two premise cells red against strings that are plainly there. */
export function stripTags(text: string): string {
  return collapse(text.replace(/<\/?[A-Za-z][^>]*>/g, " "));
}

/**
 * Three passes, because a rendered sentence can be hidden from a literal matcher three ways and
 * each pass recovers one without losing what the earlier ones see:
 *   1. literal      — an attribute value, or any sentence on one line
 *   2. collapsed    — a sentence broken over a line break
 *   3. tags dropped — a sentence interrupted by markup, `appearance</span>, which stays in ...`
 * More permissive is the SAFE direction here: every rendered pin in this suite is an ABSENCE,
 * so a matcher that finds more is a matcher that lets less through.
 */
export function contains(haystack: string, needle: string): boolean {
  return (
    haystack.includes(needle) ||
    collapse(haystack).includes(collapse(needle)) ||
    stripTags(haystack).includes(stripTags(needle))
  );
}

/** Occurrences under whichever pass finds the most, for a premise that must not undercount. */
export function countIn(haystack: string, needle: string): number {
  return Math.max(
    haystack.split(needle).length - 1,
    collapse(haystack).split(collapse(needle)).length - 1,
    stripTags(haystack).split(stripTags(needle)).length - 1,
  );
}

export function lineOf(source: Source, index: number): number {
  return source.raw.slice(0, index).split("\n").length;
}

/**
 * Present in the CODE, so a comment naming it cannot satisfy this (direction C), and present
 * after normalisation, so a sentence broken over two lines or split by a `</span>` is still
 * found (the wrapped-sentence false green). `line` is -1 when the only match is a wrapped one.
 */
export function findInCode(source: Source, needle: string): { line: number } | undefined {
  const literal = source.code.indexOf(needle);
  if (literal !== -1) return { line: lineOf(source, literal) };
  return contains(source.code, needle) ? { line: -1 } : undefined;
}

/** Present in a COMMENT and nowhere else. Used to tell C apart from a genuine absence in a red. */
export function findInCommentOnly(source: Source, needle: string): { line: number } | undefined {
  if (findInCode(source, needle) !== undefined) return undefined;
  const literal = source.raw.indexOf(needle);
  if (literal !== -1) return { line: lineOf(source, literal) };
  return contains(source.raw, needle) ? { line: -1 } : undefined;
}

/* ============================================================
   PIN THE CRITERION, NOT AN INCIDENTAL FORM

   T263's blind author lost 29 of 31 first-contact cells to one
   cause: it transcribed a survivor sentence whose grammar only
   parsed while the sentences being retired stood in front of it.
   When those went, the implementer rewrote it to stand alone and
   moved the pin with it, which is correct D-78 behaviour, and the
   cell redded it.

   So a survivor is asserted by the CLAIM it makes, expressed as
   every alternative wording that would still make it, and a red
   says which claim went missing rather than which words changed.
   A single-string pin on a survivor is not used anywhere in this
   suite. On the RETIRED side the opposite holds: a retired claim
   must be gone in EVERY form it could take, so those are lists
   whose members are all required to be absent.
   ============================================================ */

export interface Claim {
  /** What the sentence must still say, for a failure message a reader can act on. */
  readonly claim: string;
  /** Any one of these standing in the code satisfies the claim. */
  readonly anyOf: readonly string[];
}

export function claimHolds(source: Source, c: Claim): { hit: string; line: number } | undefined {
  for (const form of c.anyOf) {
    const found = findInCode(source, form);
    if (found) return { hit: form, line: found.line };
  }
  return undefined;
}

/* Reports the comment-only near miss by name, because "the claim is gone" and "the claim survives
   only in a comment" send a reader to two different repairs and a bare absence red conflates them. */
export function whyClaimFailed(source: Source, c: Claim): string {
  const ghosts = c.anyOf
    .map((form) => ({ form, at: findInCommentOnly(source, form) }))
    .filter((g) => g.at !== undefined);
  if (ghosts.length > 0) {
    return (
      `\`${c.claim}\` is present ONLY INSIDE A COMMENT in ${source.path} ` +
      ghosts.map((g) => `(\`${g.form}\` at line ${g.at!.line})`).join(", ") +
      `. A comment is not on the reader's screen, so the claim has been retired while the ` +
      `presence premise still looked satisfied. This is the false-green direction of the 2x2.`
    );
  }
  return (
    `\`${c.claim}\` is absent from ${source.path} in every form this suite knows: ` +
    c.anyOf.map((f) => `\`${f}\``).join(", ") +
    `. If the claim is still made in wording not listed here, the LIST is wrong and the fix is ` +
    `to widen it — a survivor pin that keeps an incidental form reds a correct rewrite (D-263-13).`
  );
}

/* ============================================================
   MODULE SPECIFIERS, AND WHY AC6 IS NOT A GREP FOR A STRING

   D-262-10 measured three populations of `lib/data` on this route
   and they need three different verdicts:

     19 REAL IMPORT LINES        AC6's subject. Must reach zero.
     20 COMMENT-ONLY MENTIONS    Must NOT red anything. A docblock
                                 explaining a retired fixture is the
                                 false-red direction of the 2x2.
     10 LINES SURVIVING STRIPPING and not imports. RENDERED PROSE:
                                 `<span className="font-mono">` in
                                 six places, a `title=` tooltip in
                                 one, a ternary in another. These are
                                 honesty copy under D-78, and
                                 D-262-10 rules they are NOT exempt.

   A string grep cannot tell the first from the third, and cannot
   tell either from the second. So an import is decided by the
   PARSER — a module specifier is a parse fact — and the rendered
   half is decided on comment-stripped text with the specifier lines
   removed. The two assertions are separate cells because they have
   separate repairs: one is a rewire, the other is a rewrite.
   ============================================================ */

export interface Specifier {
  readonly spec: string;
  readonly line: number;
  /** `import type` / `export type`. Erased at build, so it moves no data to any reader. */
  readonly typeOnly: boolean;
}

export function importSpecifiers(source: Source): Specifier[] {
  const sf = ts.createSourceFile(
    source.path,
    source.raw,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: Specifier[] = [];
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    if (
      (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) &&
      n.moduleSpecifier !== undefined &&
      ts.isStringLiteral(n.moduleSpecifier)
    ) {
      const typeOnly =
        (ts.isImportDeclaration(n) && n.importClause?.isTypeOnly === true) ||
        (ts.isExportDeclaration(n) && n.isTypeOnly);
      found.push({ spec: n.moduleSpecifier.text, line: at(n), typeOnly });
    }
    /* `await import("@/lib/data/...")` is the obvious way to keep a fixture while passing a check
       that only reads top-level imports, so the dynamic form is collected by the same walk. */
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      n.arguments.length > 0 &&
      ts.isStringLiteral(n.arguments[0])
    ) {
      found.push({ spec: n.arguments[0].text, line: at(n), typeOnly: false });
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return found;
}

/** Lines that still name `lib/data` after comments go, excluding the import lines themselves. */
export function renderedMentions(source: Source, needle = "lib/data"): Specifier[] {
  const importLines = new Set(importSpecifiers(source).map((i) => i.line));
  const lines = source.code.split("\n");
  const out: Specifier[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(needle)) continue;
    if (importLines.has(i + 1)) continue;
    out.push({ spec: lines[i].trim(), line: i + 1, typeOnly: false });
  }
  return out;
}
