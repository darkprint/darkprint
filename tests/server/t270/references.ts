/* ============================================================
   T270 — the server-side halves the CLI is compared AGAINST

   Nothing here is a criterion cell and nothing here binds
   `packages/cli`. Every export is one half of a comparison whose
   other half is the CLI, built now because it depends on no
   ruling: it is assembled entirely out of merged modules written
   by other tasks.

   That authorship is the whole point. AC1 and AC4 are equalities
   against "the server", and a reference written by the author of
   the assertions is a consistency check, never a second axis — one
   round of this project lost a 26-mutation sweep to an oracle
   carrying the identical misreading as its cells. So the rule
   here is: IMPORT the server's answer, never model it. Where this
   file computes anything, it computes it the way an existing
   merged caller computes it and says which caller.

   `references.instrument.test.ts` beside this file is what stops
   these being trusted on their say-so: a reference that cannot be
   shown to discriminate is a reference that will agree with
   anything the CLI does.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { BumpAnalysis, Diagnostic, NodeCard } from "@/lib/core";
import { inferBump, loadCard } from "@/lib/core";
import type { ExportedFile } from "@/lib/content/bundle-export";
import { exportBundle } from "@/lib/content/bundle-export";
import { checkDeclaredBump } from "@/lib/server/versioning";
import { contentOntology, contentVocabulary } from "@/lib/content/read";

import { ARCHIVE } from "./fixtures";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/* ==================== AC4: what the server exports ==================== */

/**
 * `exportBundle`'s answer for one archive bundle — the bytes AC4 calls "the server's export".
 *
 * The input is assembled exactly as `scripts/generate-bundles.ts:202-211` assembles it,
 * including its `ref` derivation off `card.file` and its conditional `vocabulary`. Cited
 * rather than invented, because a DIFFERENT assembly here would produce a plausible export
 * that is not the one the site publishes, and every AC4 cell would then compare the CLI to a
 * folder nothing serves.
 *
 * `generatedExport` below is what keeps that citation honest.
 */
export function computedExport(slug: string): readonly ExportedFile[] {
  const entry = ARCHIVE.find((bundle) => bundle.slug === slug);
  if (entry === undefined) {
    throw new Error(
      `no archive bundle called \`${slug}\`. Available: ${ARCHIVE.map((b) => b.slug).join(", ")}`,
    );
  }
  const vocabulary = contentVocabulary();

  return exportBundle({
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
}

/**
 * The same bundle as it actually sits on disk under `public/bundles/<slug>/`.
 *
 * This is the SECOND AXIS for `computedExport`, and it is a real one: that folder is written
 * by `scripts/generate-bundles.ts`, whose `BundleExportInput` assembly was written by
 * somebody else. If this file assembles the input wrongly — a ref derived differently, a
 * vocabulary passed where the generator omits it — the two disagree and
 * `references.instrument.test.ts` reds. Agreement is what licenses using either as AC4's
 * reference.
 *
 * It is NOT an independent implementation of `exportBundle` and is not offered as one. What
 * it independently checks is the INPUT, plus one condition nothing else here would catch:
 * `public/bundles/**` being stale against `content/**`, which `npm run build` rewrites and
 * which this repository's own CLAUDE.md warns produces a diff.
 */
export function generatedExport(slug: string): readonly ExportedFile[] {
  const root = join(REPO, "public", "bundles", slug);
  const files: ExportedFile[] = [];

  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      files.push({
        /* Forward slashes always, matching `ExportedFile.path`'s own contract — otherwise
           this comparison would pass on posix and fail on win32 for a reason about neither
           half. */
        path: relative(root, path).split(sep).join("/"),
        text: readFileSync(path, "utf8"),
      });
    }
  };
  walk(root);

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

/* ==================== AC2: what the server says about a bump ==================== */

/** A published card pair: the same id at two versions, both already in the archive. */
export interface CardPair {
  readonly id: string;
  readonly previousVersion: string;
  readonly nextVersion: string;
  readonly previous: NodeCard;
  readonly next: NodeCard;
  /** `inferBump(previous, next)` — the level the ENGINE requires, and its reasons. */
  readonly inferred: BumpAnalysis;
}

/**
 * Every card id `content/cards/` publishes at two or more versions, as ordered pairs.
 *
 * Real published pairs rather than a hand-mutated card, deliberately. `lib/content/read.test.ts`
 * already holds the archive to *"publishes every card version at a number `inferBump` agrees
 * with"*, so these pairs are known-good inputs whose right answer another task's test is
 * already asserting — which is exactly the kind of driver a blind author is entitled to use.
 * A card I mutated myself would make the expected bump level my own opinion.
 */
/**
 * Why this cannot throw at module scope.
 *
 * It did, on the first run: `loadCard` was called without an `ontology` and raised, and
 * because this is a module-scope constant the WHOLE FILE reported `(0 test)` — the export
 * cells beside it, which depend on none of this, were deleted along with the bump cells. A
 * premise evaluated at module scope does not red a cell, it removes every cell in the file.
 *
 * So the failure is CAPTURED and `CARD_PAIRS_ERROR` carries it to exactly one cell, which is
 * the same rule as putting per-criterion reds in the cells rather than in a `beforeAll`.
 */
export let CARD_PAIRS_ERROR: string | undefined;

export const CARD_PAIRS: readonly CardPair[] = (() => {
  try {
    return buildCardPairs();
  } catch (err) {
    CARD_PAIRS_ERROR = err instanceof Error ? err.message : String(err);
    return [];
  }
})();

function buildCardPairs(): CardPair[] {
  const dir = join(REPO, "content", "cards");
  const byId = new Map<string, string[]>();

  for (const name of readdirSync(dir).sort()) {
    const match = name.match(/^(.+)@(\d+\.\d+\.\d+)\.yaml$/);
    if (match === null) continue;
    byId.set(match[1], [...(byId.get(match[1]) ?? []), match[2]]);
  }

  const pairs: CardPair[] = [];
  for (const [id, versions] of [...byId].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (versions.length < 2) continue;
    const sorted = versions.slice().sort();
    const previousVersion = sorted[0];
    const nextVersion = sorted[sorted.length - 1];

    const previous = readCard(dir, id, previousVersion);
    const next = readCard(dir, id, nextVersion);
    pairs.push({
      id,
      previousVersion,
      nextVersion,
      previous,
      next,
      inferred: inferBump(previous, next),
    });
  }

  if (pairs.length === 0) {
    throw new Error(
      "`content/cards/` publishes no card id at two versions.\n" +
        "  Every AC2 cell is quantified over these pairs, so an empty list reports a pass per " +
        "cell that never ran. BROKEN TEST.",
    );
  }
  return pairs;
}

function readCard(dir: string, id: string, version: string): NodeCard {
  const file = `${id}@${version}.yaml`;
  /* `contentOntology()` and not `ontologyView(CORE_ONTOLOGY)`: the archive's cards are
     written against the core PLUS the local overlay, and validating one against the core
     alone reports every local term as unknown. The view is the merged reader's own, so this
     cannot drift from what the build validated these same files with.

     `previous` is deliberately NOT passed. With it, `validateCard` runs the version-chain
     check itself and would fold the very bump verdict AC2 is about into the card load —
     making the driver and the thing under test the same call. */
  const validation = loadCard(readFileSync(join(dir, file), "utf8"), {
    file,
    ontology: contentOntology(),
  });
  if (validation.card === undefined) {
    throw new Error(
      `\`${file}\` did not load as a card: ` +
        `${validation.diagnostics.map((d) => d.message).join("; ")}\n` +
        `  This is an archive the build already validates, so a failure here is a BROKEN TEST.`,
    );
  }
  return validation.card;
}

/**
 * What the SERVER says when a caller declares `declared` against `pair`.
 *
 * `checkDeclaredBump` is T025's, consumed never restated — it is the function whose "own
 * shape" D-270-01 C8 cites when it restates `--declare` as a version string. Its message
 * already carries `inferred.reasons.join("; ")`, which is AC2's *"naming the reasons"* with
 * an author it already has, and the reason a CLI that renders this diagnostic cannot lose
 * them while a CLI that rewrites the sentence can.
 *
 * Subject is `"card"` here. A bundle-level `bump` would pass `"bundle"`, and which one the
 * CLI uses follows from D-270-01 C8's *"the folder is a blueprint"* — bound at the cell, not
 * assumed here, so this helper serves either reading.
 */
export function serverBumpDiagnostics(
  pair: CardPair,
  declared: string,
  subject: "card" | "bundle" = "card",
): readonly Diagnostic[] {
  return checkDeclaredBump(subject, pair.previousVersion, declared, pair.inferred);
}
