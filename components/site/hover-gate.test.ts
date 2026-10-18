/* ============================================================
   Every hover state is behind `hoverable`.

   A phone matches `:hover` on tap and keeps it until the next tap lands elsewhere, so an
   ungated `hover:` utility leaves a tapped link or card lit until the route changes.
   `app/globals.css` declares `hoverable` for exactly this. The scan reads string and
   template literals through the TypeScript parser, so a comment that names `hover:` and a
   media query such as `(hover: hover)` are neither of them a class.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }
  return found;
}

/** A class token whose hover variant is not preceded by `hoverable:`. */
const UNGATED = /(^|[\s"'`])([^\s"'`{()]*?)((?:group-|peer-)?hover:)(?=[\w[!&-])/g;

function ungatedIn(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const raw = node.getText(source);
      for (const match of raw.matchAll(UNGATED)) {
        if (/(^|:)hoverable:$/.test(match[2]!)) continue;
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push(`${relative(ROOT, file)}:${line} ${match[2]}${match[3]}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("hover states on a touch screen", () => {
  const files = [...sources(join(ROOT, "app")), ...sources(join(ROOT, "components"))];

  it("scans the tree it claims to", () => {
    expect(files.length, "the scan found almost no source, so it would pass vacuously")
      .toBeGreaterThan(100);
  });

  it("gates every hover variant behind `hoverable`", () => {
    expect(files.flatMap(ungatedIn), "a hover state that latches after a tap").toEqual([]);
  });
});
