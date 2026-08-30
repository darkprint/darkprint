/* ============================================================
   darkprint CLI — `import`
   The inverse of `export`, and deliberately not its mirror image.

   `export` writes to stdout because a pipeline is ONE file and the
   shell already owns redirection, an overwrite rule and a collision
   rule. A bundle is a folder — a `topology.dot` and one card per
   node — and a folder cannot go down a pipe, so this verb writes to
   disk and therefore has to answer all three questions itself:
   `--out` is required, the directory must be empty or absent, and
   nothing is written until every byte is ready. Half a bundle on
   disk after a refusal would be a folder that looks like a draft
   and is not one.

   ── the two required flags, and why neither has a default ──
   `--out` because of the above. `--as` because a `prompt=` is
   somebody's writing: compiling it into cards and leaving no name
   on them launders it, and afterwards a compiled card in an archive
   is indistinguishable from a written one. The handle goes in
   `author` and the pipeline's own address goes in `provenance`,
   marked `derived:attractor`. `lib/core/attractor/import.ts` owns
   both decisions and this file consumes them.

   ── the refusal is `gate.ts`'s, not `hasErrors` ──
   A draft synthesised from a foreign pipeline has no ports on any
   card, so every edge in it raises `bundle/port-mismatch` at error
   severity and `hasErrors` calls the folder rejected. It is not
   rejected: it parses, it is addressable and it is attributable,
   and what is wrong with it is a reading published beside it. So
   the question asked here is `isStorable`, which is the named
   blocking set — a file that does not parse or that cannot be
   addressed is refused, and everything else is written with its
   findings printed. That is the one live call site where storable
   and approved give different answers, which is why the separation
   is a decision and not a refactor.

   ── AC6 ──
   Local and offline like `validate` and `export`: the imports are
   the engine, the importer and `node:fs`. No fetch, no credential,
   no environment.
   ============================================================ */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

import {
  importAttractorDot,
  isStorable,
  sortDiagnostics,
  storageBlockers,
  type Diagnostic,
} from "../../../lib/core";
import { validateBundle } from "../../../lib/server/engine";
import { CliError } from "./errors";
import { DOT_FILE } from "./layout";

/** What the caller has to say before a foreign pipeline becomes a folder. */
export interface ImportOptions {
  /**
   * The handle answerable for the draft, written into every synthesised card's `author`.
   * No default — see the file header.
   */
  as: string;
  /** Where the folder goes. No default: a bundle is many files and cannot go to stdout. */
  out: string;
}

/** One imported draft, after it has been written. */
export interface ImportResult {
  /** The pipeline that was read, absolute. */
  source: string;
  /** The directory that was written, absolute. */
  root: string;
  /** Bundle-relative paths, `topology.dot` first and then the cards in node order. */
  files: readonly string[];
  /**
   * Everything the import and the engine had to say about the draft, sorted.
   *
   * **Errors included**, which is the opposite of what `export` returns. `export` refuses a
   * bundle with errors because a pipeline compiled from one looks complete and is not; a
   * draft is not pretending to be finished, and the errors in it are the list of what the
   * person who ran this command now has to write.
   */
  diagnostics: readonly Diagnostic[];
}

/**
 * Read an Attractor pipeline at `file` and write the draft bundle it describes into `out`.
 *
 * Throws `CliError` for a file that cannot be read, for a target directory that already
 * holds something, and for a pipeline whose findings refuse storage — which is
 * `isStorable`'s list and not `hasErrors`.
 */
export function importPipeline(file: string, options: ImportOptions): ImportResult {
  const author = options.as.trim();
  if (author === "") {
    throw new CliError(
      "import: say who this draft belongs to with `--as <handle>`. A `prompt` is somebody's " +
        "writing, and a card compiled out of one has to carry the name of whoever brought it here.",
    );
  }

  const source = resolve(file);
  let pipeline: string;
  try {
    pipeline = readFileSync(source, "utf8");
  } catch (cause) {
    throw new CliError(`import: \`${file}\` is not a file I can read.`, { cause });
  }

  const root = resolve(options.out);
  /* Checked before anything is synthesised, so a refusal happens with the target untouched.
     Refusing a non-empty directory rather than merging into it: a draft written over half of
     somebody else's bundle is a folder whose two halves came from different graphs, and
     nothing downstream would say so. */
  if (existsSync(root) && readdirSync(root).length > 0) {
    throw new CliError(
      `import: \`${options.out}\` is not empty, and a draft written into it would mix with ` +
        `whatever is already there. Name a directory that does not exist yet.`,
    );
  }

  const imported = importAttractorDot(pipeline, { origin: file, author, file });

  /* The draft, read back by the same engine `darkprint validate` and `/upload` use, so the
     findings printed here are the findings the author will see next time they ask. */
  const checked = validateBundle({
    manifest: imported.manifest,
    dot: imported.dot,
    cardFiles: imported.cardFiles,
  });
  const diagnostics = sortDiagnostics([...imported.diagnostics, ...checked.diagnostics]);

  if (!isStorable(diagnostics)) {
    const blockers = storageBlockers(diagnostics);
    throw new CliError(
      `import: \`${file}\` cannot be read as a pipeline. ` +
        `${blockers.length} finding${blockers.length === 1 ? "" : "s"} stop${blockers.length === 1 ? "s" : ""} ` +
        `it from being a bundle at all: ${blockers[0]?.message ?? ""}`,
    );
  }

  const files: Record<string, string> = { [DOT_FILE]: imported.dot, ...imported.cardFiles };
  const written: string[] = [];
  for (const [path, text] of Object.entries(files)) {
    /* The paths are built from card ids, which pass `card/schema.ts`'s `CARD_ID` grammar —
       lowercase, hyphens, one optional namespace segment — so none of them can carry a `..`
       today. The check is here anyway because the ids come from a FOREIGN file: the day
       something widens that grammar, this refuses instead of walking `writeFileSync` out of
       the target directory (CWE-22). `resolve` also collapses an absolute path. */
    const destination = resolve(root, path);
    if (!destination.startsWith(root + sep)) {
      throw new CliError(`import: \`${path}\` escapes the target directory.`);
    }
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, text);
    written.push(path);
  }

  return { source, root, files: written, diagnostics };
}
