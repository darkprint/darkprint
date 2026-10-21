/* ============================================================
   Shipped text never cites the design documents
   A reader of a diagnostic, a card or a downloaded DOT has no
   "doc 2 §5.5" to open. Comments may cite the documents; strings
   and the archive may not.
   ============================================================ */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();

/** "Doc 2 §5.5", "doc 3 §4.1's", and a ruling id such as "§11.0 Q17". Attractor's bare "§3.3" is a public spec and passes. */
const INTERNAL_CITATION = /\bdoc(?:ument)?\s*\d+\s*§|§\s*\d+(?:\.\d+)*\s+Q\d+\b/i;

const SOURCE_ROOTS = ["lib/", "components/", "app/", "packages/"];

function tracked(): string[] {
  return execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf-8" }).split("\n");
}

/** Every string a source file can put in front of someone: literals, template text and JSX text. */
function shippedStrings(path: string): { line: number; text: string }[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(join(REPO_ROOT, path), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      found.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("internal citations", () => {
  it("appear in no string a shipped source file holds", () => {
    const files = tracked().filter(
      (path) =>
        SOURCE_ROOTS.some((root) => path.startsWith(root)) &&
        /\.tsx?$/.test(path) &&
        !/\.test\.tsx?$/.test(path) &&
        (!path.startsWith("packages/") || path.includes("/src/")),
    );
    expect(files.length).toBeGreaterThan(500);
    const offenders = files.flatMap((path) =>
      shippedStrings(path)
        .filter(({ text }) => INTERNAL_CITATION.test(text))
        .map(({ line, text }) => `${path}:${line}: ${text.slice(0, 120)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("appear nowhere in the archive a reader downloads, comments included", () => {
    const files = tracked().filter((path) => path.startsWith("content/"));
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.flatMap((path) =>
      readFileSync(join(REPO_ROOT, path), "utf8")
        .split("\n")
        .flatMap((text, i) => (INTERNAL_CITATION.test(text) ? [`${path}:${i + 1}: ${text.trim().slice(0, 120)}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
