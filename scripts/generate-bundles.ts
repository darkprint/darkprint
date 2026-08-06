/* ============================================================
   DarkPrint — the downloadable bundles, generated at build time
   Doc 2 §11 item 10. `lib/content/bundle-export.ts` decides what a
   bundle *is* once it leaves the site; this decides *where it
   lands*, and it is the only part that touches a filesystem.

   ── Why a `prebuild` script and not a module the loader calls ──
   The site is fully static (SSG), so there is no request-time place
   to build an archive: the artefacts have to exist as files before
   the pages that link them are rendered. `lib/content/read.ts` runs
   inside `next build`, and writing into `public/` from there races
   the build's own handling of that directory — Next decides what
   `public/` contains while the pages are being generated, and a
   page render has no business writing to disk in the first place.
   An npm `prebuild` hook finishes before `next build` starts, so
   the files are simply there when Next collects them. It also means
   `npm run build` fails at the generator rather than three minutes
   later inside a page.

   ── Running TypeScript ──
   Node strips the types (v22.18+, or v23.6+ where it is on by
   default; the `prebuild` line passes `--experimental-strip-types`
   so both work). The `@/…` alias and the extensionless relative
   imports the engine uses are resolved by the hook installed below,
   which is why every `lib/…` import in this file is dynamic: static
   imports are evaluated before any statement runs, and the hook has
   to be in place first.

   That makes **Node 22.18** the floor for the whole project, above
   Next's own >=20.9: this script runs before `next build` and cannot
   run at all without both features. The floor is declared in
   `package.json`'s `engines.node` and named in `.nvmrc`, and it is
   enforced below, because `npm` does not fail an install on `engines`
   unless the host opted into `engine-strict` and a build image that
   ignored both would otherwise die on `registerHooks is not a
   function` with nothing saying why.

   ── What it guarantees ──
   1. Deterministic. `exportBundle` is pure and sorted, the output
      directory is cleared before writing, and nothing here reads a
      clock or a random source. Two builds of the same archive
      produce byte-identical files.
   2. The build fails if a bundle does not resolve. `readContent()`
      throws on any error-severity diagnostic, and every emitted
      `factory.dot` is then fed back through `parseDot` and
      `lintAttractor` — the two checks Attractor runs before it will
      execute a pipeline. A file that would be rejected at the
      command line never ships.
   ============================================================ */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* --------------------- module resolution --------------------- */

/**
 * `module.registerHooks` (Node ≥22.15) is not declared by @types/node 20, which is what
 * this repository pins. Declared locally rather than cast at the call site, so the hook
 * body below is still type-checked against the shape Node documents.
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
/** The default resolver, which Node passes in and which takes the context optionally. */
type NextResolve = (specifier: string, context?: ResolveContext) => ResolveOutcome;
type ResolveHook = (
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
) => ResolveOutcome;

/** The floor `package.json` declares and `.nvmrc` names, quoted in the failure below. */
const REQUIRED_NODE = "22.18.0";

const { registerHooks } = nodeModule as unknown as {
  registerHooks?: (hooks: { resolve?: ResolveHook }) => void;
};

if (typeof registerHooks !== "function") {
  throw new Error(
    [
      `DarkPrint needs Node ${REQUIRED_NODE} or newer to build. This is ${process.version}.`,
      "",
      "`npm run prebuild` writes public/bundles/ before `next build` collects it, and it resolves",
      "the app's `@/…` imports through `module.registerHooks`, which arrived in Node 22.15. The",
      "script is TypeScript, which Node strips from 22.18 on, so 22.18 is the floor for both.",
      "",
      `package.json declares it in \`engines.node\` and .nvmrc names it: \`nvm use\` picks it up.`,
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

/**
 * Teach Node the two things the app's TypeScript assumes and the ESM resolver does not:
 * the `@/…` alias from `tsconfig.json`, and extensionless relative imports (`./diagnostics`,
 * `../card/schema`) with directory `index` files. Anything it cannot place is handed back
 * to the default resolver, so `node:*` and `node_modules` behave normally.
 */
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

/* --------------------- the engine, once the hook is in place --------------------- */

const { hasErrors, lintAttractor, parseDot } = await import("@/lib/core");
const { contentVocabulary, readContent } = await import("@/lib/content/read");
const { CARD_LIBRARY_DIR, FACTORY_DOT, bundleDir, exportBundle } = await import(
  "@/lib/content/bundle-export"
);

/* --------------------- generation --------------------- */

const OUTPUT_ROOT = join(ROOT, "public", "bundles");

/**
 * The card library, written a second time at the site root.
 *
 * A bundle's copy of a card is addressable only through the blueprint that pins it, and
 * `/nodes/[...id]` is a page about the card rather than about any blueprint: naming one
 * there would print a slug the reader did not ask about, and would 404 the day that
 * blueprint left the archive. The bytes are identical — the same `card.text` the export
 * puts in the folder — so this is a second address for one document, not a second
 * document, which is why it is written from the same loop.
 *
 * Outside `OUTPUT_ROOT` on purpose: `lib/content/bundle-export.test.ts` asserts the exact
 * file set `exportBundle` returns, and a tenth file inside a bundle would break it. This
 * adds no file to any bundle.
 */
const CARD_LIBRARY_ROOT = join(ROOT, "public", CARD_LIBRARY_DIR);

function main(): void {
  // Cleared rather than merged into: a blueprint removed from the archive, or a card
  // whose pin moved to a new version, would otherwise leave a stale file behind that
  // nothing links to and every later build would keep.
  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  rmSync(CARD_LIBRARY_ROOT, { recursive: true, force: true });

  // Throws, loudly and with every diagnostic, if any bundle under `content/` carries an
  // error. That is the "fail the build if a bundle does not resolve" half of the contract.
  const loaded = readContent();
  if (loaded.length === 0) {
    throw new Error("No blueprints under content/blueprints — nothing to export.");
  }

  // Doc 3 §7's local terms. Handed to every bundle; the exporter puts the file in the ones
  // whose cards actually declare one, so a folder is never short a definition its own
  // README quotes and never carries a vocabulary nothing in it reads.
  const vocabulary = contentVocabulary();

  const problems: string[] = [];
  const summary: string[] = [];
  /** Every distinct card version any bundle pins, keyed by ref. See `CARD_LIBRARY_ROOT`. */
  const library = new Map<string, string>();

  for (const entry of loaded) {
    const files = exportBundle({
      blueprint: entry.blueprint,
      analysis: entry.analysis,
      cards: entry.cardFiles.map((card) => ({
        ref: card.file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
        text: card.text,
      })),
      ...(vocabulary === undefined
        ? {}
        : { vocabulary: { text: vocabulary.text, terms: vocabulary.terms } }),
    });

    // Collected from the exported files rather than from `entry.cardFiles`, so the library
    // copy and the bundle copy are the same string by construction. A ref pinned by two
    // blueprints is one published version and therefore one document (§4: a published
    // version is immutable); if two bundles ever disagreed about its bytes, that is a
    // corrupt archive and the build says so rather than letting the last write win.
    for (const file of files) {
      if (!file.path.startsWith(`${CARD_LIBRARY_DIR}/`)) continue;
      const ref = file.path.slice(CARD_LIBRARY_DIR.length + 1).replace(/\.yaml$/, "");
      const seen = library.get(ref);
      if (seen !== undefined && seen !== file.text) {
        problems.push(`${ref}: two bundles carry different bytes for one published version.`);
      }
      library.set(ref, file.text);
    }

    const dir = join(OUTPUT_ROOT, entry.slug);
    let bytes = 0;
    for (const file of files) {
      const path = join(dir, ...file.path.split("/"));
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.text, "utf8");
      bytes += Buffer.byteLength(file.text, "utf8");
    }

    // The second half of the contract, and the only claim in this whole feature that a
    // reader cannot verify from the site alone: the artefact runs from a command line.
    // Attractor parses and lints before it executes, so an emitted file that fails either
    // check would fail on the user's machine, and it fails here instead.
    const factory = files.find((f) => f.path === FACTORY_DOT);
    if (factory === undefined) {
      problems.push(`${entry.slug}: no ${FACTORY_DOT} was emitted.`);
      continue;
    }
    const parsed = parseDot(factory.text, FACTORY_DOT);
    if (parsed.graph === undefined || hasErrors(parsed.diagnostics)) {
      problems.push(
        `${entry.slug}: the emitted ${FACTORY_DOT} does not parse.`,
        ...parsed.diagnostics.map((d) => `    ${d.severity}  ${d.code}  ${d.message}`),
      );
      continue;
    }
    const lint = lintAttractor(parsed.graph, factory.text, FACTORY_DOT);
    if (lint.length > 0) {
      problems.push(
        `${entry.slug}: Attractor would reject the emitted ${FACTORY_DOT}.`,
        ...lint.map((d) => `    ${d.severity}  ${d.code}  ${d.message}`),
      );
      continue;
    }

    summary.push(
      `  ${entry.slug.padEnd(28)} ${String(files.length).padStart(2)} files  ${String(bytes).padStart(6)} bytes  ${entry.blueprint.digest.slice(0, 15)}…`,
    );
  }

  // Written after the loop rather than inside it, so a build that is about to fail on a
  // bundle does not leave a card library behind that no bundle backs.
  if (problems.length === 0) {
    mkdirSync(CARD_LIBRARY_ROOT, { recursive: true });
    for (const [ref, text] of [...library].sort(([a], [b]) => (a < b ? -1 : 1))) {
      writeFileSync(join(CARD_LIBRARY_ROOT, `${ref}.yaml`), text, "utf8");
    }
  }

  if (problems.length > 0) {
    throw new Error(
      [
        `Bundle export failed: ${problems.length} problem${problems.length === 1 ? "" : "s"}.`,
        "",
        ...problems,
        "",
        "A blueprint that cannot be run from a command line must not be offered for download.",
      ].join("\n"),
    );
  }

  console.log(`public/${bundleDir("<slug>")} — ${loaded.length} bundles`);
  for (const line of summary) console.log(line);
  console.log(`public/${CARD_LIBRARY_DIR} — ${library.size} card versions`);
}

main();
