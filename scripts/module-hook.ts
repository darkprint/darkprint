/* ============================================================
   DarkPrint — resolving the app's imports from a script
   Node strips the types (22.18+, the floor `package.json`
   declares in `engines.node`), but its ESM resolver knows nothing
   about the `@/…` alias or the extensionless relative imports the
   engine uses. This module installs a resolve hook for both.

   Import it FIRST, as a bare side-effect import with its `.ts`
   extension spelled out, and load everything under `lib/` with a
   dynamic `import()` afterwards: a static import is evaluated
   before any statement of the importing file runs, so the hook has
   to be in place through module evaluation order rather than
   through a call.

       import "./module-hook.ts";
       const { createDbClient } = await import("@/lib/db");
   ============================================================ */

import * as nodeModule from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * `module.registerHooks` (Node 22.15+) is not declared by the @types/node this repository
 * pins. Declared locally rather than cast at the call site, so the hook body is still
 * type-checked against the shape Node documents.
 */
interface ResolveContext {
  readonly conditions?: readonly string[];
  readonly importAttributes?: Record<string, string>;
  readonly parentURL?: string;
}
interface ResolveOutcome {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}
type NextResolve = (specifier: string, context?: ResolveContext) => ResolveOutcome;
type ResolveHook = (specifier: string, context: ResolveContext, nextResolve: NextResolve) => ResolveOutcome;

/** The floor `package.json` declares and `.nvmrc` names, quoted in the failure below. */
const REQUIRED_NODE = "22.18.0";

const { registerHooks } = nodeModule as unknown as {
  registerHooks?: (hooks: { resolve?: ResolveHook }) => void;
};

if (typeof registerHooks !== "function") {
  throw new Error(
    [
      `DarkPrint needs Node ${REQUIRED_NODE} or newer to run this script. This is ${process.version}.`,
      "",
      "It resolves the app's `@/…` imports through `module.registerHooks`, which arrived in",
      "Node 22.15, and it is TypeScript, which Node strips from 22.18 on.",
      "",
      "package.json declares the floor in `engines.node` and .nvmrc names it: `nvm use` picks it up.",
    ].join("\n"),
  );
}

/** Repo root: this file sits in `scripts/`. */
export const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Extensions tried, in order, for a specifier that names no file. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

/** The file a bare path names: itself, itself plus an extension, or its `index`. */
function fileFor(base: string): string | undefined {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of EXTENSIONS) {
      const index = join(base, `index${extension}`);
      if (existsSync(index)) return index;
    }
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target: string | undefined;
    if (specifier.startsWith("@/")) {
      target = resolve(ROOT, specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") === true) {
      target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target !== undefined) {
      const hit = fileFor(target);
      if (hit !== undefined) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
