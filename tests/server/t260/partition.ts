/* ============================================================
   T260 — the six files the cutover moves, and the readings taken
   off them

   ROUTE files are NAMED and never walked. A route path is a URL:
   it cannot be renamed without changing the product, so naming the
   three means a DELETED route reds here instead of quietly
   shrinking the scan. `tests/server/t262/partition.ts` established
   the rule and its own recorded failure mode is why — a walk that
   returns nothing passes every absence assertion at once.

   BROWSER components are also named, and for a second reason on top
   of that one: D-260-02 makes `GalleryBrowser.tsx`'s exact path
   load-bearing. `components/ui/autonomy-surfaces.test.ts:259` finds
   it with `STRIPPED.find((f) => f.path === …)` and carries
   `expect(gallery).toBeDefined()`, so a rename reds THAT suite
   loudly and it is right to. Naming the path here means this suite
   reds with it and says why, instead of going quiet at the moment
   the merged guard goes loud.

   ── what this author has not read ──
   All six files are in T260's `Owns`. None has been opened. Every
   one is PARSED, which is the construction
   `tests/server/t262/frozen.test.ts` used for `SiteHeader.tsx` and
   the only way a blind author holds a surface it may not read.
   ============================================================ */

import ts from "typescript";

/** The three shelves. Named: a route path is a URL. */
export const ROUTES = {
  blueprints: "app/blueprints/page.tsx",
  nodes: "app/nodes/page.tsx",
  /* `app/ontology/page.tsx` until 2026-09-06, then `app/spec/ontology/page.tsx` for part of
     the same day. TWO REPOINTS, one instruction apart, and the shelf itself never moved.

     The first: the owner folded the vocabulary browser into the spec page and deleted the
     index ("move the ontology page in the /spec/ontology substituing the every term box.
     Then, you can delete the /ontology page"), so the shelf was served from a route that
     also specified the format.

     The second: the owner asked whether the ontology should exist at all or unify under the
     Attractor specification, accepted the answer that it should stay and be reframed ("The
     motivations you provided are sound. Apply them."), and the reframing folds
     `/spec/ontology` into `/spec/card`. Every term is a legal value of a card FIELD, so each
     one now sits beside the field that consumes it and there is no separate ontology
     document to choose between.

     Both times the shelf kept its browser, its query keys and its cleared set, and only its
     address changed, which is why each is a repoint rather than a shelf coming out of the
     set. One consequence is priced in `cutover.test.ts`'s AC1 archive cell, and the
     exemption there had to be rewritten for the second repoint rather than carried across.
     `components/ontology/canonical-route.test.ts` holds the route question itself. */
  ontology: "app/spec/card/page.tsx",
} as const;

/** The client component each route mounts its shelf through. */
export const BROWSERS = {
  blueprints: "components/gallery/GalleryBrowser.tsx",
  nodes: "components/nodes/NodeBrowser.tsx",
  ontology: "components/ontology/VocabularyBrowser.tsx",
} as const;

export type Shelf = keyof typeof ROUTES;
export const SHELVES = Object.keys(ROUTES) as readonly Shelf[];

/* ============================================================
   THE QUERY KEYS AND THE `Clear filters` SETS

   B-12 and the Contract: unchanged, so existing shared links keep
   working. This author cannot read the three components that
   declare them, so both readings were taken from the frontend's
   seam notes and then CHECKED AGAINST THE CODE by the
   orchestrator, which read the three declarations and confirmed
   them element-wise (D-260-12):

       GalleryBrowser.tsx:301    ["q","tag","cat","phase","autonomy","df"]
       NodeBrowser.tsx:595       ["q","type","phase","human","risk"]
       VocabularyBrowser.tsx:227 ["q","kind","origin"]

   That check mattered and is not ceremony: CLAUDE.md's rule is that
   the code wins over a document, and those notes WERE stale elsewhere
   on these very rows — they listed `sort = recency | downloads |
   votes`, two of which are exactly what
   `autonomy-surfaces.test.ts` exists to forbid.

   `forks` and `sort` are deliberately NOT in the cleared sets. They
   are stances rather than filters: the shelf is always in one, so
   "clear" has nothing to mean for them, and dropping `forks` would
   move the shelf rather than empty a control.
   ============================================================ */

export interface Keys {
  /** Every key the URL carries for this shelf, in the API's published order. */
  readonly all: readonly string[];
  /** What `Clear filters` drops, exactly. */
  readonly cleared: readonly string[];
  /** Carried in the URL and NOT cleared, with the reason it is not a filter. */
  readonly kept: readonly string[];
}

export const KEYS: Readonly<Record<Shelf, Keys>> = {
  /* `df` left with the dark-factory control the owner removed from the shelf. The server's
     `searchBlueprints` still accepts the key, so a hand-written URL carrying it is not an
     error; what is gone is any way for the browser to set it, and `Clear filters` cannot
     drop a key the shelf never reads. */
  blueprints: {
    all: ["q", "tag", "cat", "phase", "autonomy", "forks", "sort"],
    cleared: ["q", "tag", "cat", "phase", "autonomy"],
    kept: ["forks", "sort"],
  },
  nodes: {
    all: ["q", "type", "phase", "human", "risk", "sort"],
    cleared: ["q", "type", "phase", "human", "risk"],
    kept: ["sort"],
  },
  ontology: {
    all: ["q", "kind", "origin"],
    cleared: ["q", "kind", "origin"],
    kept: [],
  },
};

/* ============================================================
   PARSING
   ============================================================ */

export function parse(path: string, raw: string): ts.SourceFile {
  return ts.createSourceFile(path, raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Every module specifier the file imports from, including `import type`. */
export function importsOf(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      out.push(node.moduleSpecifier.text);
    }
    /* `await import("…")` reaches the same module and would otherwise slip past a check
       that only reads static imports — which is how a build-time read survives a cutover
       that looks complete. */
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] !== undefined &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      out.push((node.arguments[0] as ts.StringLiteral).text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** The initializer of a module-scope `export const <name> = …`, or `undefined`. */
export function exportedConst(sf: ts.SourceFile, name: string): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const isExported = (ts.getModifiers(statement) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        found = declaration.initializer;
      }
    }
  }
  return found;
}

/** Every string literal in the file, in source order. Comments are not literals. */
export function stringLiterals(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text);
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/**
 * Every array-literal of plain strings in the file, as string arrays.
 *
 * Used to find a `Clear filters` key set without depending on the name the component gives
 * it: the criterion is that the SET is unchanged, not that a particular identifier survives
 * a rewrite, and pinning the identifier would red a correct cutover over a rename. That is
 * the mistake that cost T263's blind author 29 of 31 cells.
 */
export function stringArrays(sf: ts.SourceFile): string[][] {
  const out: string[][] = [];
  const walk = (node: ts.Node) => {
    if (ts.isArrayLiteralExpression(node)) {
      const values = node.elements.map((element) =>
        ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element)
          ? element.text
          : undefined,
      );
      if (values.length > 0 && values.every((value) => value !== undefined)) {
        out.push(values as string[]);
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** Does the file open with a `"use client"` / `'use client'` directive prologue? */
export function isClientComponent(sf: ts.SourceFile): boolean {
  const first = sf.statements[0];
  if (first === undefined || !ts.isExpressionStatement(first)) return false;
  const expression = first.expression;
  return (
    (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) &&
    expression.text === "use client"
  );
}

/** The names of every JSX element the file mounts, e.g. `GalleryBrowser`. */
export function jsxElementNames(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const nameOf = (tag: ts.JsxTagNameExpression): string => tag.getText(sf);
  const walk = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      out.push(nameOf(node.tagName));
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** The attribute names on the first JSX mount of `element`, or `undefined` if it is absent. */
export function jsxPropsOf(sf: ts.SourceFile, element: string): string[] | undefined {
  let props: string[] | undefined;
  const walk = (node: ts.Node) => {
    if (props !== undefined) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === element) {
        props = node.attributes.properties.flatMap((property) =>
          ts.isJsxAttribute(property) ? [property.name.getText(sf)] : [],
        );
        return;
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return props;
}

/**
 * Every string value assigned to a property called `name`, anywhere in the file.
 *
 * Deliberately blind to HOW the object is built: `{ forks: "all" }` and
 * `params.set("forks", "all")` are both ways of saying the same thing to the same reader,
 * and a cell that insisted on one spelling would red a correct cutover that chose the
 * other. Both are covered here — the property assignment by this walk, the setter call by
 * `callArguments` below.
 */
export function propertyValues(sf: ts.SourceFile, name: string): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      ((ts.isIdentifier(node.name) && node.name.text === name) ||
        (ts.isStringLiteral(node.name) && node.name.text === name))
    ) {
      const init = node.initializer;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) out.push(init.text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/**
 * The string arguments of every call whose first argument is the literal `key`.
 *
 * Covers `params.set("forks", "all")` and `searchParams.append("forks", "all")` without
 * naming the receiver, because the receiver is a variable name and a variable name is not a
 * criterion.
 */
export function callArguments(sf: ts.SourceFile, key: string): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const [first, second] = node.arguments;
      if (
        first !== undefined &&
        ts.isStringLiteral(first) &&
        first.text === key &&
        second !== undefined &&
        (ts.isStringLiteral(second) || ts.isNoSubstitutionTemplateLiteral(second))
      ) {
        out.push(second.text);
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** Names of every function called in the file, e.g. `blueprints`, `connection`, `fetch`. */
export function calledNames(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isIdentifier(callee)) out.push(callee.text);
      else if (ts.isPropertyAccessExpression(callee)) out.push(callee.name.text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/**
 * Every property NAME the file reads or writes, comment-immune by construction.
 *
 * A raw-text search for `updatedAt` matches the prose that explains the ordering as
 * readily as the code that performs it, and these route files carry more prose than code.
 * Comments never enter the AST, so asking the tree is the only reading that says whether
 * the CODE changed rather than whether the FILE did.
 */
export function propertyNames(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const walk = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node)) out.add(node.name.text);
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) out.add(node.name.text);
    if (ts.isShorthandPropertyAssignment(node)) out.add(node.name.text);
    if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) out.add(node.name.text);
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      ts.isStringLiteral(node.argumentExpression)
    ) {
      out.add(node.argumentExpression.text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/**
 * Everything the file actually RENDERS: JSX text and string literals, whitespace collapsed.
 *
 * Not the raw source. A marker is copy a reader sees, and `app/blueprints/page.tsx` and
 * `GalleryBrowser.tsx` each carry the word "seeded" in a COMMENT while rendering it
 * nowhere — measured, and it is why this returns the tree's text rather than the file's.
 */
export function renderedText(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text !== "") out.push(text);
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text !== "") out.push(text);
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** The iteration constructs a per-item database read hides inside. */
const ITERATORS = ["map", "forEach", "flatMap", "filter", "reduce", "some", "every", "find"];

/**
 * Calls to any of `readers` that sit inside a loop or an iterator callback.
 *
 * This is the N+1 shape and nothing else: a batch reader called once over an array of keys
 * is invisible here, and a per-item reader called once for a single blueprint is too. What
 * it finds is a reader invoked once per row — which on a page that renders per request
 * (D-260-05) and holds every row (D-260-06) is one round trip per tile, growing with a
 * registry whose whole premise under AC1 is that it grows.
 *
 * Returns `<reader> inside <construct>` strings so a red names both halves.
 */
export function readersCalledPerItem(
  sf: ts.SourceFile,
  readers: readonly string[],
): string[] {
  const out: string[] = [];

  const enclosingIteration = (node: ts.Node): string | undefined => {
    for (let cursor = node.parent; cursor !== undefined; cursor = cursor.parent) {
      if (
        ts.isForStatement(cursor) ||
        ts.isForOfStatement(cursor) ||
        ts.isForInStatement(cursor) ||
        ts.isWhileStatement(cursor) ||
        ts.isDoStatement(cursor)
      ) {
        return ts.SyntaxKind[cursor.kind];
      }
      /* An arrow or function expression is only an iteration if something ITERATES with it.
         A callback handed to `Promise.all` is not a loop; `rows.map(...)` is. */
      if (ts.isArrowFunction(cursor) || ts.isFunctionExpression(cursor)) {
        const call = cursor.parent;
        if (
          call !== undefined &&
          ts.isCallExpression(call) &&
          ts.isPropertyAccessExpression(call.expression) &&
          ITERATORS.includes(call.expression.name.text)
        ) {
          return `.${call.expression.name.text}()`;
        }
      }
    }
    return undefined;
  };

  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee)
        ? callee.text
        : ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : undefined;
      if (name !== undefined && readers.includes(name)) {
        const construct = enclosingIteration(node);
        if (construct !== undefined) out.push(`${name}() inside ${construct}`);
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/** The named bindings a file imports from `specifier`. Empty when it imports nothing from it. */
export function importedFrom(sf: ts.SourceFile, specifier: string): string[] {
  const out: string[] = [];
  const walk = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === specifier
    ) {
      const clause = node.importClause;
      if (clause?.namedBindings !== undefined) {
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) out.push(element.name.text);
        }
        /* `import * as registry` binds every export under one name, so every call through
           it is a call to a reader. Reported as the namespace so a red says which shape. */
        if (ts.isNamespaceImport(clause.namedBindings)) out.push(`*:${clause.namedBindings.name.text}`);
      }
    }
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}

/**
 * Property names used as an object-literal KEY, never as a property being read.
 *
 * `propertyNames` unions both, which makes it useless as a premise about what a file
 * PRODUCES: measured at the adversary round, deleting `createdAt: manifest.createdAt ?? ""`
 * from `app/blueprints/page.tsx` left the premise green, because `manifest.createdAt` still
 * appears one line below inside the `updatedAt` fallback. The premise read as coverage and
 * measured nothing.
 */
export function assignedKeys(sf: ts.SourceFile): Set<string> {
  const out = new Set<string>();
  const walk = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) out.add(node.name.text);
    if (ts.isShorthandPropertyAssignment(node)) out.add(node.name.text);
    node.forEachChild(walk);
  };
  walk(sf);
  return out;
}
