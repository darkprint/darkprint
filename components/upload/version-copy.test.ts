/* ============================================================
   /upload may not tell a reader a bundle names an ontology version
   D-93 (2026-08-30) took the version off the manifest and off
   `openView`'s signature; D-131 (2026-09-05) deleted ontology
   versioning outright. The sentence beside the wizard's result
   went on saying the registry resolves a bundle "against the
   ontology version this bundle's manifest names" for six days
   after the first of those and one day after the second, and it
   is the SECOND time that sentence has had to be rewritten: the
   note above it in `UploadFlow.tsx` records D-263-01 doing the
   same job in August. Twice is a pattern, and a pattern with no
   test under it comes back a third time.

   ── What this pins, and what it deliberately does not ──
   Not the wording. The rewrite is free to say the divergence any
   way it likes, and §11.0 Q32 says the sentence must SURVIVE
   rather than be deleted, so a guard that froze the bytes would
   forbid the next honest edit.

   What it pins is the CLAIM: that some artefact a reader hands
   over carries, names or is resolved against an ontology version.
   The denial is not caught, on purpose — `references/ontology.md`
   ships "the vocabulary carries no version of its own" and a page
   is entitled to say that here too. A guard that outlawed the
   words rather than the assertion would red the correction.
   ============================================================ */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* Blanked to spaces rather than removed, so a red can still cite an offset into the real
   file. TypeScript's own parser rather than a regex because a JSX comment is not trivia:
   `{/* … *\/}` is a JsxExpression with no expression, and both comment-range calls miss it.
   This route's files are full of them, and a stripper that leaves them behind reads a note
   SAYING the version sentence was retired as the sentence itself. */
function stripComments(text: string, fileName: string): string {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = text.split("");
  const blank = (pos: number, end: number) => {
    for (let i = pos; i < end; i++) if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  const visit = (node: ts.Node) => {
    for (const r of ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []) blank(r.pos, r.end);
    for (const r of ts.getTrailingCommentRanges(text, node.getEnd()) ?? []) blank(r.pos, r.end);
    if (ts.isJsxExpression(node) && node.expression === undefined) blank(node.getStart(), node.getEnd());
    node.forEachChild(visit);
  };
  visit(sf);
  return out.join("");
}

/**
 * Every file that can put copy on `/upload`, read off the filesystem rather than listed.
 *
 * Enumerated so a file somebody adds to the route next year is swept without that person
 * having to know this guard exists. `components/site/honesty.test.ts` builds its own domain
 * the same way and for the same reason, after a guard scoped to the one file a criterion
 * cited passed while a sibling rendered the retired claim.
 */
function routeSources(): { path: string; copy: string }[] {
  const out: { path: string; copy: string }[] = [];
  for (const dir of ["app/upload", "components/upload"]) {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })) {
      if (!entry.isFile()) continue;
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      const path = join(entry.parentPath ?? join(ROOT, dir), entry.name);
      out.push({ path, copy: stripComments(readFileSync(path, "utf8"), entry.name) });
    }
  }
  return out;
}

/**
 * The assertion, in three shapes, because one sentence can make the claim three ways.
 *
 * Every entry carries the sentence it was written against, and the premise cell below fails
 * if a pattern stops matching its own example. That check earned itself on the first run: the
 * verb-first pattern matched NOTHING, because the sentence that provoked this file puts the
 * noun first ("against the ontology version this bundle's manifest names") and the pattern
 * had been written from the shape the claim takes in conversation rather than from the shape
 * it took on the page. Two of three would have passed and read as coverage.
 *
 * `example` is not proof the pattern is right, only that it is not vacuous. What proves the
 * set is the mutation: put `RETIRED_SENTENCE` back into `UploadFlow.tsx` and the last cell
 * reds. It was run.
 */
const VERSION_CLAIMS: readonly { pattern: RegExp; says: string; example: string }[] = [
  {
    pattern: /(?:ontology|vocabulary) version[^.]{0,80}\bmanifest\b/i,
    says: "the ontology version is something the manifest has",
    example: "against the ontology version this bundle's manifest names",
  },
  {
    pattern: /\b(?:manifest|bundle|card|folder)\b[^.]{0,60}(?:names|naming|declares|declaring|pins|pinning)[^.]{0,30}(?:an?|the|its own)\s+(?:ontology|vocabulary) version/i,
    says: "an artefact the reader hands over names an ontology version",
    example: "every manifest declares the ontology version it was written against",
  },
  {
    pattern: /\b(?:against|judged on|resolved by)\b[^.]{0,40}(?:ontology|vocabulary) version/i,
    says: "something is resolved against an ontology version",
    example: "the registry resolves it against the ontology version it stores",
  },
];

/** The sentence `/upload` shipped until 2026-09-05, verbatim, as the instrument's own subject. */
const RETIRED_SENTENCE =
  "The registry takes its own reading when you publish, against the ontology version this " +
  "bundle's manifest names. A bundle declaring an older version can be judged on different " +
  "terms there than here.";

describe("/upload does not claim a bundle names an ontology version", () => {
  it("premise: the route's copy is readable and the comment stripper actually strips", () => {
    const sources = routeSources();
    expect(sources.length, "the route's source files could not be read").toBeGreaterThan(3);

    const flow = sources.find((s) => s.path.endsWith("UploadFlow.tsx"));
    expect(flow, "UploadFlow.tsx is not in the swept set").toBeDefined();
    if (flow === undefined) return;

    /* Both directions. The stripper has to remove SOMETHING, or every cell below is an
       assertion about an unchanged file; and it has to leave the shipped sentence standing,
       or every cell below is an assertion about an empty string. */
    const raw = readFileSync(flow.path, "utf8");
    expect(flow.copy.trim().length, "stripping removed everything").toBeGreaterThan(0);
    expect(
      raw.length - flow.copy.replace(/ +$/gm, "").length,
      "the stripper blanked no commentary, so the cells below read the comments too",
    ).toBeGreaterThan(1000);
    expect(
      flow.copy,
      "the shipped sentence this guard is scoped around is not in the stripped copy",
    ).toContain("The registry's reading decides.");
  });

  it("premise: no pattern is vacuous, and the set catches the sentence that provoked it", () => {
    for (const { pattern, says, example } of VERSION_CLAIMS) {
      expect(
        pattern.test(example),
        `the pattern for "${says}" matches nothing, not even its own example, so it guards an empty set`,
      ).toBe(true);
    }
    /* The set, not each member: the retired sentence makes the claim two of the three ways
       and a third pattern is here for a phrasing it did not use. Requiring all three of it
       would force every pattern to be a rewrite of one sentence. */
    expect(
      VERSION_CLAIMS.filter(({ pattern }) => pattern.test(RETIRED_SENTENCE)).length,
      "no pattern catches the sentence this file exists to keep out",
    ).toBeGreaterThan(0);
  });

  it("no file that renders the route says a bundle carries an ontology version", () => {
    for (const { path, copy } of routeSources()) {
      for (const { pattern, says } of VERSION_CLAIMS) {
        const hit = pattern.exec(copy);
        expect(
          hit === null,
          `${path} tells a reader that ${says}: "${hit?.[0] ?? ""}". No manifest has named one since D-93 and D-131 deleted ontology versioning outright.`,
        ).toBe(true);
      }
    }
  });
});
