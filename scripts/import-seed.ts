#!/usr/bin/env node
/* ============================================================
   DarkPrint — the seed import, run from a terminal
   T250's entry point. Plans the import off `content/`, prints the
   plan, then writes it through the merged stores under the
   registry handle.

   ── Running TypeScript ──
   Node strips the types (22.18+, the floor `package.json` declares
   in `engines.node`). The `@/…` alias and the extensionless
   relative imports the engine uses are NOT resolved by Node's ESM
   resolver, so the hook below is installed first and every
   `lib/…` import in this file is dynamic: a static import is
   evaluated before any statement runs, and the hook has to be in
   place before that.

   The hook is the same mechanism `scripts/generate-bundles.ts`
   installs, and it is spelled out again rather than shared
   because `scripts/` holds no module either file may import —
   `Owns` for this task is this one file. It is Node plumbing with
   no decision in it; a shared `scripts/module-hook.ts` would be
   better and is somebody's to create.

   ── What it does not do ──
   It reads no argument that changes the import. There is no
   `--root`: `lib/content/read.ts` is fixed to `process.cwd()/content`
   and memoizes, so a second root would return the first root's
   answer (D-250-01). `--plan` stops before the write, which is what
   makes AC1 checkable without a database.
   ============================================================ */

import * as nodeModule from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* --------------------- module resolution --------------------- */

/**
 * `module.registerHooks` (Node ≥22.15) is not declared by the @types/node this repository
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
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

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

/* --------------------- the import, once the hook is in place --------------------- */

const { planImport, runImport } = await import("@/lib/server/seed");
const { createDbClient } = await import("@/lib/db");

const planOnly = process.argv.includes("--plan");

/* `readContent` reads `process.cwd()/content`, so running this from anywhere but the repo
   root reads an archive that is not there and throws from the loader. Said here, once,
   because the loader's message is about a missing directory rather than about a cwd. */
if (!existsSync(join(process.cwd(), "content"))) {
  throw new Error(
    `No \`content/\` directory under ${process.cwd()}. Run this from the repository root: the archive reader resolves \`content/\` against the working directory.`,
  );
}

const plan = await planImport();

console.log(`plan: ${plan.bundles.length} bundles, ${plan.cards.length} cards`);
console.log(`      owner @${plan.registryHandle}`);
for (const bundle of plan.bundles) {
  console.log(`      ${bundle.slug.padEnd(28)} ${bundle.digest}  ${bundle.releases} release`);
}

if (planOnly) {
  console.log("--plan: nothing written.");
} else {
  const client = createDbClient();
  try {
    const result = await runImport(client.db, plan);
    console.log(`imported: created ${result.created}, skipped ${result.skipped}`);
  } finally {
    await client.close();
  }
}
