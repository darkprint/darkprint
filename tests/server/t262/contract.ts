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

export function lineOf(source: Source, index: number): number {
  return source.raw.slice(0, index).split("\n").length;
}

/** Present in the CODE, so a comment naming it cannot satisfy this. That is direction C. */
export function findInCode(source: Source, needle: string): { line: number } | undefined {
  const at = source.code.indexOf(needle);
  return at === -1 ? undefined : { line: lineOf(source, at) };
}

/** Present in a COMMENT and nowhere else. Used to tell C apart from a genuine absence in a red. */
export function findInCommentOnly(source: Source, needle: string): { line: number } | undefined {
  if (source.code.includes(needle)) return undefined;
  const at = source.raw.indexOf(needle);
  return at === -1 ? undefined : { line: lineOf(source, at) };
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
