/* ============================================================
   DarkPrint backend — a stored release as the files it exports
   Everything `exportBundle` needs is in Postgres: the DOT and the
   manifest on `release`, the pinned cards' verbatim YAML on
   `card_version.source`, the local vocabulary's bytes and terms on
   `release.local_vocabulary`. This module reassembles them and
   hands them over; the file set itself is
   `lib/content/bundle-export.ts`'s decision and is never restated
   here.

   ── AC2 is a promise this layer can only break ──
   `exportBundle` is pure and sorts by path, so two exports of one
   release are byte-identical unless something time-, order- or
   environment-dependent is added underneath it. Nothing in this
   file reads a clock, a random source or an environment variable,
   and the two orderings that could vary are pinned rather than
   inherited: `cardRefs` is deduplicated in the order the release
   stored it, and the card documents are gathered by that order.
   No `Map` is iterated for its insertion order and no `Date` is
   read.

   ── AC4 is checked here rather than at publish ──
   Attractor parses and lints before it executes, so an emitted
   `factory.dot` that fails either check would fail on the user's
   machine. `scripts/generate-bundles.ts` runs the same two checks
   at build time; a release stored before a lint rule changed would
   have passed that one and would be served unchecked forever, so
   the check is at the serving edge, on the bytes about to leave.
   ============================================================ */

import {
  hasErrors,
  lintAttractor,
  loadBundle,
  parseDot,
  sortDiagnostics,
  type BlueprintAnalysis,
  type Bundle,
  type CardRef,
  type Diagnostic,
} from "@/lib/core";
import {
  FACTORY_DOT,
  cardFilePath,
  exportBundle,
  type ExportedCard,
  type ExportedFile,
} from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import type { ReleaseRecord } from "@/lib/server/archive";
import { resolveCardRef } from "@/lib/server/cards";
import { UnknownOntologyVersionError, openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import {
  factoryDotRejected,
  pinnedCardUnavailable,
  readFailed,
  releaseDoesNotResolve,
  unpublishedOntologyVersion,
} from "./errors";
import { storedVocabulary } from "./vocabulary";

/**
 * The files this release exports, sorted by path, byte-identical across calls.
 *
 * The caller has already decided the actor may read the bundle; `actor` is passed on
 * because the pinned cards carry their own visibility (B-07) and a private one may not
 * travel inside a public bundle's folder just because the bundle is public.
 */
export async function buildExport(
  db: Db,
  actor: Actor,
  release: ReleaseRecord,
): Promise<readonly ExportedFile[]> {
  const vocabulary = storedVocabulary(release.vocabulary);

  // The overlay the release itself declares, layered over the published core version its
  // manifest names — never the latest one. B-08 stamps a release's scores with the
  // vocabulary they were computed under, and resolving against a newer core would score
  // the folder against terms the site never used for it.
  let ontology;
  try {
    ontology = await openView(db, release.manifest.ontologyVersion, vocabulary?.terms);
  } catch (err) {
    // A fact about the release — it names a version nobody published — and a 404.
    if (err instanceof UnknownOntologyVersionError) throw unpublishedOntologyVersion(err);
    // Anything else here is the ontology *read* failing, and D-90-A is what makes this
    // branch exist: an unwrapped driver error escaped raw, so the same Postgres outage
    // answered 500 from this line and 404 from `lookup.ts`. One outage, one status.
    throw readFailed(err);
  }

  const cards = await pinnedCards(db, actor, release.cardRefs);

  const bundle: Bundle = {
    manifest: release.manifest,
    dot: release.dot,
    cardFiles: Object.fromEntries(cards.map((card) => [cardFilePath(card.ref), card.text])),
  };

  const loaded = loadBundle(bundle, { ontology });
  if (loaded.blueprint === undefined || loaded.analysis === undefined) {
    throw releaseDoesNotResolve();
  }
  // `readContent()` refuses a bundle carrying any error-severity diagnostic and the build
  // fails rather than shipping it; a stored release is held to the same bar. This is also
  // what keeps `exportBundle` from throwing on a node pinning a card the input does not
  // carry — that arrives here first, as `bundle/missing-card`.
  if (hasErrors(loaded.diagnostics)) throw releaseDoesNotResolve();

  const files = exportBundle({
    blueprint: loaded.blueprint,
    analysis: storedAnalysis(release) ?? loaded.analysis,
    cards,
    ...(vocabulary === undefined ? {} : { vocabulary }),
  });

  checkFactoryDot(files);
  return files;
}

/**
 * The pinned cards, in the order the release stored their refs, deduplicated.
 *
 * Read through `resolveCardRef`, which takes the actor — so a card this caller may not
 * read comes back `undefined` and the whole export is refused (D-90-05). Serving the
 * folder without it is not an option: `exportBundle` throws on a pinned card its input
 * does not carry, and a folder short a card resolves to neither of the two scores its own
 * README quotes. Reading the cards on the *bundle's* authority instead would leak a
 * private card through any public bundle that pins it.
 */
async function pinnedCards(
  db: Db,
  actor: Actor,
  cardRefs: readonly string[],
): Promise<ExportedCard[]> {
  const seen = new Set<string>();
  const cards: ExportedCard[] = [];
  for (const ref of cardRefs) {
    if (seen.has(ref)) continue;
    seen.add(ref);
    let record;
    try {
      record = await resolveCardRef(db, actor, ref as CardRef);
    } catch (err) {
      // Same reason as `openView` above: a driver failure reading a card is the
      // infrastructure, not a fact about the release, and must not escape raw carrying
      // the statement and its bound parameters.
      throw readFailed(err);
    }
    if (record === undefined) throw pinnedCardUnavailable();
    // `source`, not `body`: the YAML bytes as archived. `body` is `jsonb` and round-trips
    // value-identical only, so a folder built from it would hash to something else and the
    // digest printed in the README would be unverifiable.
    cards.push({ ref: ref as CardRef, text: record.source });
  }
  return cards;
}

/**
 * The scores as stored, or `undefined` to fall back to a fresh computation.
 *
 * B-08 makes the stored pair authoritative: they were computed when the release was cut
 * and are rewritten when an ontology release re-scores. Recomputing them here would
 * quietly answer a different question — what this build of the engine says today — under
 * the same two numbers the site prints elsewhere.
 *
 * `ontologyVersion` comes off `autonomy` rather than off the manifest, because that field
 * is the vocabulary the score was actually computed against and the manifest's is the one
 * the release declares. `diagnostics` are merged the way `analyzeBlueprint` merges them:
 * the same fact said once, however many stages noticed it.
 */
function storedAnalysis(release: ReleaseRecord): BlueprintAnalysis | undefined {
  const stored = release.analysis;
  if (stored === undefined) return undefined;
  return {
    autonomy: stored.autonomy,
    security: stored.security,
    phaseCoverage: stored.phaseCoverage,
    ontologyVersion: stored.autonomy.ontologyVersion,
    diagnostics: dedupe([...stored.autonomy.diagnostics, ...stored.security.diagnostics]),
  };
}

function dedupe(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  const out: Diagnostic[] = [];
  for (const diagnostic of diagnostics) {
    const key = JSON.stringify(diagnostic);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return sortDiagnostics(out);
}

/**
 * AC4, on the bytes about to be served rather than on the ones that were stored.
 *
 * The two checks Attractor itself runs before it will execute a pipeline, in the order it
 * runs them: a graph that does not parse cannot be linted. The diagnostics stay here —
 * they quote node ids and source spans, and the refusal is a fixed sentence.
 */
function checkFactoryDot(files: readonly ExportedFile[]): void {
  const factory = files.find((file) => file.path === FACTORY_DOT);
  if (factory === undefined) throw factoryDotRejected();

  const parsed = parseDot(factory.text, FACTORY_DOT);
  if (parsed.graph === undefined || hasErrors(parsed.diagnostics)) throw factoryDotRejected();
  if (lintAttractor(parsed.graph, factory.text, FACTORY_DOT).length > 0) throw factoryDotRejected();
}
