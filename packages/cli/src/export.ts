/* ============================================================
   darkprint CLI — `export`
   The owner removed `factory.dot` from every published bundle
   folder on 2026-08-25, and that decision was about WHAT A FOLDER
   CONTAINS: a download carries `topology.dot`, `cards/*.yaml`,
   `README.md` and, where one is used, `ontology/extensions.yaml`.
   Nothing here puts the file back into a folder. A command a
   person runs on purpose is a different surface from a file that
   arrives whether or not anybody wanted it, and the objection the
   removal answered — a second graph of the same pipeline sitting
   beside the first, drifting from it, with no reader able to say
   which one is the blueprint — does not apply to bytes written to
   stdout at the moment they are asked for.

   ── why the engine is called and not just the emitter ──
   `emitAttractorDot` takes a `ResolvedBlueprint`, so something has
   to resolve one, and the something is `validateBundle` — the same
   call `validate` makes and the same one `POST /api/validate/bundle`
   makes (D-270-01 C7). A bundle this command refuses is therefore a
   bundle `darkprint validate` refuses, in the same words, without
   either of them having to be kept in step by hand.

   ── AC6 ──
   Local and offline, like `validate`: the imports are the engine,
   the emitter and the directory reader. No fetch, no credential, no
   environment.
   ============================================================ */

import {
  blocksStorage,
  emitAttractorDot,
  isStorable,
  sortDiagnostics,
  storageBlockers,
  type BundleManifest,
  type Diagnostic,
  type OntologyTerm,
} from "../../../lib/core";
import { ONTOLOGY_EXTENSIONS_FILE } from "../../../lib/content/ontology-file";
import { validateBundle, validateVocabularySource } from "../../../lib/server/engine";
import { CliError } from "./errors";
import { CARDS_DIR, DOT_FILE, readBundleDirectory, stubManifestFor } from "./layout";

/**
 * The formats this build can write.
 *
 * A list of one, and it is a list on purpose: the command requires the format to be named
 * even though only one exists, so the day a second one lands, every script written against
 * the first keeps meaning what it meant. A default format is a promise that the default
 * will never change, and this command is not in a position to make it.
 */
export const EXPORT_FORMATS: readonly string[] = Object.freeze(["attractor"]);

/** The bytes a compile needs, in the shape `validateBundle` takes. */
export interface PipelineInput {
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  extensions?: readonly OntologyTerm[];
}

/** One compiled pipeline. */
export interface AttractorPipeline {
  /**
   * What was compiled, for a message that has to name it: an absolute directory for the
   * `export` verb, and `<owner>/<slug>@<digest>` for a caller that fetched a release.
   */
  source: string;
  /** Always a member of `EXPORT_FORMATS`. Carried so a renderer never has to assume. */
  format: string;
  /** The Attractor DOT, with the disclosure header `emitAttractorDot` writes into it. */
  dot: string;
  /**
   * Everything the engine said on the way, ERRORS INCLUDED.
   *
   * It used to exclude them, because a bundle with any error threw. That gate was severity
   * standing in for two different questions (`lib/core/gate.ts`), and the questions have
   * different answers: an edge whose two cards declare no ports is `bundle/port-mismatch`
   * at error severity, and the pipeline compiled from it is complete and runnable. Such a
   * finding is now printed beside the file rather than withholding it, which is the only
   * honest place for it — it is a fact about the bundle the reader is holding.
   */
  diagnostics: readonly Diagnostic[];
}

/**
 * Compile a bundle that is already in memory.
 *
 * Separate from `exportPipeline` because a caller holding a fetched release has the bytes
 * and no directory, and the alternative is that caller writing a temporary folder to disk
 * so a reader can read it back. `packages/mcp/src/tools.ts` is that caller.
 *
 * `carried` is for a complaint the caller found before the engine ran — today the only one
 * is a folder holding two different local vocabularies (D-270-04(3)), which `validateBundle`
 * cannot see because it is handed one vocabulary or none. It is merged into the same list
 * and weighed by the same rule, so a bundle refused for it is refused the same way as a
 * bundle refused for anything else.
 *
 * **Throws `CliError` on two named conditions, and on nothing else.**
 *
 * The first is `isStorable`: the bytes are not a graph, a card cannot be addressed, or an
 * author's own declared prohibition is broken. The second is a node with no card, which is
 * the hazard this refusal was built for — `emitAttractorDot` writes such a node with no
 * `prompt`, so the file carries a step that runs nothing in the middle of a pipeline that
 * looks complete.
 *
 * It used to throw on ANY error, and the difference is not academic. A bundle whose cards
 * declare no ports raises `bundle/port-mismatch` on every edge at error severity, and every
 * node in it still has a card, a type and a spec: the pipeline compiled from it is complete
 * and runs. Refusing it was severity answering a question nobody had asked it —
 * `lib/core/gate.ts`'s whole subject — and it made `darkprint import` produce a folder
 * `darkprint export` would not read back, which is the pair of verbs contradicting each
 * other. What DarkPrint INFERRED about somebody's graph is printed beside the file now.
 */
export function attractorPipeline(
  input: PipelineInput,
  source: string,
  carried: readonly Diagnostic[] = [],
): AttractorPipeline {
  const result = validateBundle(input);
  const diagnostics = sortDiagnostics([...carried, ...result.diagnostics]);

  if (result.blueprint === undefined || !isStorable(diagnostics)) {
    const blockers = storageBlockers(diagnostics);
    throw new CliError(
      `export: \`${source}\` does not resolve, so there is no pipeline to write. ` +
        `${blockers.length} finding${blockers.length === 1 ? "" : "s"}; run ` +
        `\`darkprint validate\` on it to read them.`,
    );
  }

  /* The second condition, checked on the graph rather than read off a severity. `nodes` are
     the DOT nodes joined to a card and `graph.ids` is every node the topology declares, so
     the difference is exactly the set of nodes that would be written with no `prompt`. */
  const cardless = result.blueprint.graph.ids.length - result.blueprint.nodes.length;
  if (cardless > 0) {
    throw new CliError(
      `export: \`${source}\` does not resolve: ${cardless} node${cardless === 1 ? "" : "s"} ` +
        `point at a card the bundle does not hold, so a pipeline written from it would carry a ` +
        `step that runs nothing. Run \`darkprint validate\` on it to read them.`,
    );
  }

  return {
    source,
    format: "attractor",
    dot: emitAttractorDot(result.blueprint),
    /* Every finding, the storage-blocking ones excluded because those threw above. The
       filter is `blocksStorage` and not a severity test, so the two halves of this function
       cannot disagree about which findings were the refusal. */
    diagnostics: diagnostics.filter((d) => !blocksStorage(d)),
  };
}

/**
 * Compile the bundle directory at `dir` into `format`.
 *
 * The layout is `validate`'s and `/upload`'s (D-270-01 C6), so a folder either of those
 * accepts is a folder this command exports, including one `clone` just wrote.
 *
 * Throws `CliError` for a format this build does not write, for a directory with no
 * `topology.dot`, and for a bundle that resolves with errors.
 */
export function exportPipeline(dir: string, format: string): AttractorPipeline {
  requireFormat(format);
  const directory = readBundleDirectory(dir);
  return attractorPipeline(
    {
      manifest: directory.manifest,
      dot: directory.dot,
      cardFiles: directory.cardFiles,
      ...(directory.extensions === undefined ? {} : { extensions: directory.extensions }),
    },
    directory.root,
    directory.vocabularyConflict === undefined ? [] : [directory.vocabularyConflict],
  );
}

/**
 * The same layout, read out of a file map instead of a directory.
 *
 * For a caller that fetched a release over HTTP and holds bytes: writing them to a
 * temporary folder so `readBundleDirectory` could read them back would put a filesystem in
 * the middle of a pure transformation, and would give the two paths two chances to disagree
 * about what a bundle folder is. `DOT_FILE` and `CARDS_DIR` are imported from that reader
 * rather than restated here for the same reason.
 *
 * `name` supplies the manifest, through the same stub `readBundleDirectory` uses for a
 * folder that carries none — which is every published folder, since `exportBundle` writes
 * no manifest. That is what makes `darkprint clone owner/slug && darkprint export <slug>`
 * and a caller compiling the same release in memory produce the same graph name and the
 * same `label`.
 *
 * Only the flat `cards/<file>` layer is read, matching the reader: a bundle does not nest
 * cards, and taking a deeper path would key a card by a name `resolveBundle` then reports
 * back in a diagnostic nobody can open.
 */
export function pipelineFromFiles(
  files: Readonly<Record<string, string>>,
  name: string,
): PipelineInput {
  const dot = files[DOT_FILE];
  if (dot === undefined) {
    throw new CliError(`\`${name}\` has no ${DOT_FILE}, so there is no blueprint in it to read.`);
  }

  const cardFiles: Record<string, string> = {};
  for (const [path, text] of Object.entries(files)) {
    if (path.startsWith(`${CARDS_DIR}/`) && !path.slice(CARDS_DIR.length + 1).includes("/")) {
      cardFiles[path] = text;
    }
  }

  const vocabulary = files[ONTOLOGY_EXTENSIONS_FILE];
  /* Composed through `validateVocabularySource`, the same function `/api/validate/bundle`
     turns a submitted vocabulary string into terms with. A parse of my own here would be a
     second opinion about a document another module owns. */
  const extensions =
    vocabulary === undefined ? undefined : validateVocabularySource(vocabulary).terms;

  return {
    manifest: stubManifestFor(name),
    dot,
    cardFiles,
    ...(extensions === undefined ? {} : { extensions }),
  };
}

/**
 * Refuse a format nobody writes, naming the ones that exist.
 *
 * Checked in the verb and not only where the flag is parsed, because a programmatic caller
 * reaching `exportPipeline` from the barrel never touches a flag, and a format string that
 * silently means `attractor` today is the thing that breaks when a second format lands.
 */
function requireFormat(format: string): void {
  if (EXPORT_FORMATS.includes(format)) return;
  throw new CliError(
    `export: \`${format}\` is not a format this build writes. ` +
      `Name one of: ${EXPORT_FORMATS.join(", ")}.`,
  );
}
