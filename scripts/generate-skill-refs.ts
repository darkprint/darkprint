/* ============================================================
   DarkPrint — write the authoring skill's generated references
   `npm run generate:skill-refs`. The thin half of the split
   `scripts/skill-refs.ts` opens with: that module decides *what*
   the references say, this one installs the resolver hook Node
   needs to import the engine's TypeScript and then writes the
   bytes to disk.

   Deliberately NOT wired into `prebuild`. `prebuild` runs inside
   `next build`, which would silently rewrite a stale reference on
   CI, leave the deployed site correct, and let the fix never reach
   git — while the file the skills CLI clones stayed wrong.
   `scripts/generate-skill-refs.test.ts` is the gate; this is the fix.
   ============================================================ */

import { mkdirSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-98): n/a — build script

/* --------------------- module resolution --------------------- */
/* The same hook `scripts/generate-bundles.ts` installs, and for the same reason: the
   engine's sources use the `@/…` alias and extensionless relative imports, and Node's ESM
   resolver knows neither. Duplicated rather than shared because a shared module would
   itself have to be imported before the hook that resolves imports is in place. */

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
type ResolveHook = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
) => ResolveOutcome;

/** The floor `package.json` declares and `.nvmrc` names. */
const REQUIRED_NODE = "22.18.0";

const { registerHooks } = nodeModule as unknown as {
  registerHooks?: (hooks: { resolve?: ResolveHook }) => void;
};

if (typeof registerHooks !== "function") {
  throw new Error(
    [
      `DarkPrint needs Node ${REQUIRED_NODE} or newer. This is ${process.version}.`,
      "",
      "This script is TypeScript and resolves the app's `@/…` imports through",
      "`module.registerHooks`, which arrived in Node 22.15; type stripping arrived in 22.18.",
      "`nvm use` picks up the version .nvmrc names.",
    ].join("\n"),
  );
}

/** Repo root: this file sits in `scripts/`. */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

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

/* --------------------- the renderers, once the hook is in place --------------------- */

const { GENERATED_REFS, absolutePathOf } = await import("./skill-refs.ts");

/* --------------------- generation --------------------- */

function main(): void {
  for (const ref of GENERATED_REFS) {
    const path = absolutePathOf(ref);
    mkdirSync(dirname(path), { recursive: true });
    const text = ref.render();
    writeFileSync(path, text, "utf8");
    console.log(`${ref.path.padEnd(44)} ${String(text.length).padStart(6)} bytes`);
  }
}

main();
