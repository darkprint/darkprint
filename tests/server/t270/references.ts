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

import type { BumpAnalysis, Diagnostic } from "@/lib/core";

import type { ExportedFile } from "@/lib/content/bundle-export";
import { exportBundle } from "@/lib/content/bundle-export";
import type { BlueprintSnapshot } from "@/lib/server/versioning";
import { checkDeclaredBump, inferBlueprintBump } from "@/lib/server/versioning";
import { contentOntology, contentVocabulary } from "@/lib/content/read";

import { ARCHIVE } from "./fixtures";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** `bundle-export.ts`'s own constant name for the topology file, consumed not retyped. */
const TOPOLOGY = "blueprint.dot";

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

/*
 * RETARGETED at D-270-05 (1), and the retarget is the point.
 *
 * This section used to build `inferBump` over CARD pairs. That was the CARD subject — a
 * different function over different inputs producing different reasons — and every AC2 cell
 * built on it would have compared the CLI against the wrong oracle while looking entirely
 * green. The section named no subject at all when those pairs were written; the ruling now
 * names it, and it is the BUNDLE.
 *
 * The card-pair reference is not merely repointed, it is DELETED. Left in place it would
 * still resolve, still pass its own instrument cells, and still be available to a later cell
 * that reached for the nearest bump helper.
 */

/** Two snapshots of one blueprint, differing in a way the engine must price. */
export interface SnapshotPair {
  readonly slug: string;
  /** Which pinned card id was moved between the two snapshots. */
  readonly movedId: string;
  readonly previous: BlueprintSnapshot;
  readonly next: BlueprintSnapshot;
  /** `inferBlueprintBump(previous, next)` — the level the ENGINE requires, and its reasons. */
  readonly inferred: BumpAnalysis;
  /** A version string the archive treats as this blueprint's current release. */
  readonly previousVersion: string;
  /**
   * The export the registry serves AS the previous release — the archive's own files with one
   * card pin rewritten to the other published version of the same id.
   *
   * This is the correction that first contact forced. The pairs used to hold a HYPOTHETICAL
   * `next` (the archive's refs with one moved) while the folder written to disk was the
   * archive UNCHANGED and the stub served the archive UNCHANGED — so the CLI saw
   * previous == next, inferred `none`, and correctly answered "is enough" on eleven cells that
   * charged it with losing the reasons. The reasons were never there to lose: my two snapshots
   * described a change that existed nowhere on disk or on the wire.
   *
   * Now the DIFFERENCE IS REAL and lives where the CLI can see it: the served release pins the
   * other version, the local folder pins the archive's, and `inferred` is computed over those
   * same two snapshots rather than over a pair only this file knew about.
   */
  readonly previousFiles: readonly ExportedFile[];
}

export let SNAPSHOT_PAIRS_ERROR: string | undefined;

/**
 * One pair per archive blueprint that pins a twice-published card id.
 *
 * Built by moving a pinned ref from the archive's version to the OTHER published version of
 * the same id — which is exactly D-270-05's "two releases of one blueprint differing in a
 * pinned ref", and is constructible precisely because four card ids ship at two versions.
 *
 * The refs come out of the resolved blueprint rather than being parsed out of the DOT here:
 * `entry.bundle` already went through the engine, so `cardRefs` is what the engine saw.
 *
 * Captured rather than thrown, for the reason the card-pair version was: a module-scope throw
 * reports `(0 test)` and deletes every cell in the file, including ones that depend on none
 * of this.
 */
export const SNAPSHOT_PAIRS: readonly SnapshotPair[] = (() => {
  try {
    return buildSnapshotPairs();
  } catch (err) {
    SNAPSHOT_PAIRS_ERROR = err instanceof Error ? err.message : String(err);
    return [];
  }
})();

function buildSnapshotPairs(): SnapshotPair[] {
  const cardsDir = join(REPO, "content", "cards");
  const versionsById = new Map<string, string[]>();
  for (const name of readdirSync(cardsDir).sort()) {
    const match = name.match(/^(.+)@(\d+\.\d+\.\d+)\.yaml$/);
    if (match === null) continue;
    versionsById.set(match[1], [...(versionsById.get(match[1]) ?? []), match[2]]);
  }

  const pairs: SnapshotPair[] = [];
  for (const entry of ARCHIVE) {
    /* Refs off the engine's own resolved nodes, D-270-07 (3)'s symmetric derivation — not
       parsed out of the DOT by a second rule that could disagree with the one the CLI uses. */
    const refs = entry.blueprint.nodes.map((node) => node.ref);

    for (const ref of refs) {
      const at = ref.lastIndexOf("@");
      const id = ref.slice(0, at);
      const version = ref.slice(at + 1);
      const other = (versionsById.get(id) ?? []).find((candidate) => candidate !== version);
      if (other === undefined) continue;

      /* The pin as the DOT writes it. If this substring is absent the rewrite would silently
         no-op and the pair would describe a change that is not in the served bytes — the exact
         defect this rebuild exists to remove — so it is checked rather than assumed. */
      const pin = `card="${id}@${version}"`;
      if (!entry.bundle.dot.includes(pin)) continue;
      const previousDot = entry.bundle.dot.replace(pin, `card="${id}@${other}"`);

      const movedFrom = `cards/${id}@${version}.yaml`;
      const movedTo = `cards/${id}@${other}.yaml`;
      let otherText: string;
      try {
        otherText = readFileSync(join(cardsDir, `${id}@${other}.yaml`), "utf8");
      } catch {
        continue;
      }

      const previousFiles = computedExport(entry.slug)
        .filter((file) => file.path !== movedFrom)
        .map((file) => (file.path === TOPOLOGY ? { path: TOPOLOGY, text: previousDot } : file))
        .concat([{ path: movedTo, text: otherText }])
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

      const previous: BlueprintSnapshot = {
        dot: previousDot,
        cardRefs: refs.map((candidate) => (candidate === ref ? `${id}@${other}` : candidate)),
      };
      const next: BlueprintSnapshot = { dot: entry.bundle.dot, cardRefs: refs };

      pairs.push({
        slug: entry.slug,
        movedId: id,
        previous,
        next,
        inferred: inferBlueprintBump(previous, next),
        previousVersion: "1.0.0",
        previousFiles,
      });
      break;
    }
  }

  if (pairs.length === 0) {
    throw new Error(
      "no archive blueprint pins a card id published at two versions with a rewritable DOT pin.\n" +
        "  Every AC2 cell is quantified over these pairs, so an empty list reports a pass per " +
        "cell that never ran. BROKEN TEST.",
    );
  }
  return pairs;
}

/**
 * What the SERVER says when a caller declares `declared` against a snapshot pair.
 *
 * `checkDeclaredBump("bundle", ...)` — the BUNDLE subject, per D-270-05 (1). Its message
 * already carries the verdict and its `hint` carries `inferred.reasons`, which is the split
 * D-270-04 (2) rules and the reason a CLI rendering `message` alone fails AC2.
 */
export function serverBumpDiagnostics(
  pair: SnapshotPair,
  declared: string,
): readonly Diagnostic[] {
  return checkDeclaredBump("bundle", pair.previousVersion, declared, pair.inferred);
}
