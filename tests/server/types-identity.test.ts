import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as core from "@/lib/core";
import type { Diagnostic as EngineDiagnostic } from "@/lib/core";
import type { Diagnostic as ServerDiagnostic } from "@/lib/server/types";

import { loadServerTypes } from "./contract";

/* ============================================================
   T000 acceptance criterion 6 — the types are the engine's

   (6) every type exported from `lib/server/types.ts` is the
       engine's own, verified by identity and not by shape

   "Not by shape" rules out the obvious test. TypeScript is
   structural: two identically shaped `interface Diagnostic`
   declarations, one in the engine and one restated on the server,
   are the same type to the compiler and to `expectTypeOf`. Any
   assertion written in the type system alone would pass on the
   copy, which is precisely the failure this criterion exists to
   catch, because a copy compiles on the day it is written and
   drifts on the day somebody adds a diagnostic code to one of them.

   So identity is checked three ways, and the middle one carries the
   criterion:

   1. runtime identity. Whatever `lib/server/types.ts` re-exports
      that survives to runtime must be the *same object* as the
      engine's, compared with `===`. A copy fails this outright.

   2. source identity, and the only universal check available. Every
      export in the file must be an `export ... from` pointing at
      `lib/core` or `lib/types`, and the file must declare no type
      of its own. This is what "every type exported" needs: a type
      has no runtime identity to compare, so the thing to verify is
      that the file re-exports rather than restates. `lib/types.ts`
      already works this way and says why in its own header: "The
      three analysis shapes are the engine's own — restating them
      would let the two drift."

   3. a drift guard on the one name the contract states literally.
      `Diagnostic` is named in the envelope clause ("payloads that
      carry `diagnostics: Diagnostic[]`"), so it is pinned against
      the engine's declaration at compile time. Structural, and
      therefore weaker than (2) on identity, but it is what fails
      `npm run typecheck` the moment either side gains a field.
   ============================================================ */

/** True only when A and B are the same type to the compiler, not merely assignable. */
type Exact<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/**
 * Two compile-time failures for the price of one: `Exact<…>` resolving to `false` makes
 * both the assertion and the `Record<string, true>` illegal. Nothing at runtime asserts
 * this; `npm run typecheck` does, and the definition of done runs it.
 */
const TYPE_DRIFT_GUARD: Record<string, true> = {
  Diagnostic: true as Exact<ServerDiagnostic, EngineDiagnostic>,
};

const SERVER_TYPES_PATH = new URL("../../lib/server/types.ts", import.meta.url);

/** Comment-stripped, so a name inside a prose paragraph never reads as a declaration. */
function sourceWithoutComments(): string {
  const source = readFileSync(SERVER_TYPES_PATH, "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** `@/lib/core/x`, `./x` and `../core/x` all name a file; only where it lands matters. */
function normalizeSpecifier(specifier: string): string {
  if (specifier.startsWith("@/")) return specifier.slice(2);
  if (!specifier.startsWith(".")) return specifier;

  const segments = "lib/server".split("/");
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

function isEngineSource(specifier: string): boolean {
  const target = normalizeSpecifier(specifier).replace(/\.ts$/, "");
  return target === "lib/core" || target.startsWith("lib/core/") || target === "lib/types";
}

describe("T000 AC6 — every type is re-exported from the engine, never restated", () => {
  it("AC6 (1): every runtime value it re-exports is the engine's own object", async () => {
    const server = await loadServerTypes();

    const copies = Object.keys(server)
      .filter((name) => name !== "default")
      .filter((name) => core[name as keyof typeof core] !== undefined)
      .filter((name) => server[name] !== core[name as keyof typeof core]);

    expect(copies).toEqual([]);
  });

  it("AC6 (1): it publishes no runtime value the engine does not have", async () => {
    const server = await loadServerTypes();

    /* A value here that `lib/core` does not export is either engine logic restated on the
       server or feature logic, and T000's scope is "contracts and schema, no feature
       logic". Either way it belongs somewhere else. */
    const invented = Object.keys(server)
      .filter((name) => name !== "default")
      .filter((name) => !(name in core));

    expect(invented).toEqual([]);
  });

  it("AC6 (2): the file declares no type of its own", async () => {
    const source = sourceWithoutComments();

    /* The restatement this criterion is about looks exactly like an ordinary declaration,
       compiles, and is invisible to any structural comparison. */
    const declarations = [
      ...source.matchAll(/^\s*(?:export\s+)?(?:declare\s+)?(interface|enum|class)\s+(\w+)/gm),
      ...source.matchAll(/^\s*(?:export\s+)?type\s+(\w+)\s*[=<]/gm),
    ].map((m) => m[0].trim());

    expect(declarations).toEqual([]);
  });

  it("AC6 (2): every export re-exports from lib/core or lib/types", async () => {
    const source = sourceWithoutComments();

    const reExports = [...source.matchAll(/\bexport\s+(?:type\s+)?[^;]*?\bfrom\s+["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    /* Vacuously true on an empty file, so the count is part of the assertion: a
       `lib/server/types.ts` that exports nothing is not a contract the other twenty-nine
       tasks can build on. */
    expect(reExports.length).toBeGreaterThan(0);
    expect(reExports.filter((specifier) => !isEngineSource(specifier))).toEqual([]);
  });

  it("AC6 (2): it exports nothing that is not a re-export", async () => {
    const source = sourceWithoutComments();

    /* `export { X }` with no `from` re-publishes a local binding, which is the
       restatement in (2) wearing an import statement. */
    const local = [...source.matchAll(/^\s*export\s+(?!type\s+\{|\{|\*)[^\n]*/gm)]
      .map((m) => m[0].trim())
      .filter((line) => !/\bfrom\s+["']/.test(line));
    const localBraced = [...source.matchAll(/^\s*export\s+(?:type\s+)?\{[^}]*\}\s*;?\s*$/gm)].map((m) =>
      m[0].trim(),
    );

    expect([...local, ...localBraced]).toEqual([]);
  });

  it("AC6 (3): the compile-time drift guard covers the name the contract states", async () => {
    /* The assertion this test names lives in `TYPE_DRIFT_GUARD` and is checked by tsc,
       not here. What runs at runtime is the list, so the guard cannot be quietly emptied
       and still look like it is watching something. */
    await loadServerTypes();
    expect(Object.keys(TYPE_DRIFT_GUARD)).toContain("Diagnostic");
  });
});
