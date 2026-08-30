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
   Attractor parses and lints before it executes, so a graph that
   fails either check would fail on the user's machine the moment
   their own harness compiled it. `scripts/generate-bundles.ts` runs
   the same two checks at build time; a release stored before a
   lint rule changed would have passed that one and would be served
   unchecked forever, so the check is at the serving edge, on the
   graph about to be exported.

   Owner instruction, 2026-08-25: `exportBundle` no longer writes a
   compiled `factory.dot` into the folder it hands over — a
   published bundle carries only what an author wrote, and turning
   it into a runnable pipeline is the reader's own harness's job.
   AC4 still means something without that file: it is a claim about
   the GRAPH, not about a download, so the check below compiles the
   same graph the same way (`emitAttractorDot`, exactly what a
   reader's own harness would call on the topology and cards this
   release exports) and refuses to serve a release whose graph would
   not survive Attractor's own gate — without writing the compiled
   bytes into the folder or serving them under any path.
   ============================================================ */

import {
  CORE_ONTOLOGY,
  emitAttractorDot,
  hasErrors,
  isReleasable,
  lintAttractor,
  loadBundle,
  parseDot,
  sortDiagnostics,
  type BlueprintAnalysis,
  type Bundle,
  type CardRef,
  type Diagnostic,
  type ResolvedBlueprint,
} from "@/lib/core";
import {
  cardFilePath,
  exportBundle,
  type ExportedCard,
  type ExportedFile,
} from "@/lib/content/bundle-export";
import type { Db } from "@/lib/db";
import type { ReleaseRecord } from "@/lib/server/archive";
import { resolveCardRef } from "@/lib/server/cards";
import { openView } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import {
  factoryDotRejected,
  pinnedCardUnavailable,
  readFailed,
  releaseDoesNotResolve,
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

  /* The overlay the release itself declares, layered over the living vocabulary. This used
     to read the core terms of the version the manifest named, so that a folder was resolved
     against the vocabulary the site had scored it with rather than a newer one. There is no
     newer one to be resolved against: `openView` is a merge over `CORE_ONTOLOGY` and reaches
     no store, so it cannot fail and neither of the two failure arms this call carried
     (`unpublishedOntologyVersion` for a dangling stamp, `readFailed` for a driver fault)
     has anything left to catch. The stamp the export prints is still the one the score
     carries: `storedAnalysis` reads it off `autonomy`, below. */
  const ontology = openView(vocabulary?.terms);

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
  // A stored release is held to the release bar, not to "no error anywhere" (D-109). What
  // still refuses: bytes the registry cannot hold, and a node pinning a card the input does
  // not carry, which arrives here as `bundle/missing-card` and is exactly what keeps
  // `exportBundle` from throwing further down. What no longer refuses: a port that does not
  // fit, a type that cannot flow, a term nobody has minted. Those are readings, they ship
  // on the scorecard, and this function is not where DarkPrint gets to veto them.
  if (!isReleasable(loaded.diagnostics)) throw releaseDoesNotResolve();

  const files = exportBundle({
    blueprint: loaded.blueprint,
    analysis: storedAnalysis(release) ?? loaded.analysis,
    cards,
    ...(vocabulary === undefined ? {} : { vocabulary }),
  });

  checkFactoryDot(loaded.blueprint);
  return files;
}

/**
 * Refuse unless this actor may read every card the release pins.
 *
 * **B-07 at the serving edge, for the path that does not build the folder (T091).** Once
 * `serveFile` answers from a frozen artefact it never reaches `buildExport`, and the check
 * below travels inside it — so a folder frozen by someone who may read its private cards
 * would otherwise serve those cards' bytes to anyone who passes the BUNDLE's visibility
 * check. Measured, not feared: an anonymous caller was refused before a freeze and served
 * the private card afterwards, with the freeze the only thing that changed.
 *
 * **It delegates to `pinnedCards` rather than repeating its condition**, which is the whole
 * point of it existing here instead of in `serve-file.ts`. "May this actor have this folder"
 * then has exactly one author, and the frozen path cannot drift from the generated one the
 * day the rule changes. It costs the card reads and none of the rest — no `openView`, no
 * `loadBundle`, no analysis, no render — so what the freeze exists to save is still saved.
 */
export async function assertPinnedCardsReadable(
  db: Db,
  actor: Actor,
  cardRefs: readonly string[],
): Promise<void> {
  await pinnedCards(db, actor, cardRefs);
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
 * `ontologyVersion` comes off `autonomy`, which is where `computeAutonomy` stamped the
 * version of the view the score was actually computed against. It is the only place it has
 * ever been readable from: the manifest used to declare one too, and that copy was the
 * version the AUTHOR wrote against rather than the one the score used. `CORE_ONTOLOGY`'s
 * version is the fallback for a scorecard stored without the field, since that is the
 * vocabulary this build would compute against if it recomputed. `diagnostics` are merged
 * the way `analyzeBlueprint` merges them: the same fact said once, however many stages
 * noticed it.
 */
function storedAnalysis(release: ReleaseRecord): BlueprintAnalysis | undefined {
  const stored = release.analysis;
  if (stored === undefined) return undefined;
  return {
    // The three the README quotes, taken as stored: they are the answer B-08 makes
    // authoritative and this layer has no business second-guessing them.
    autonomy: stored.autonomy,
    security: stored.security,
    phaseCoverage: stored.phaseCoverage,
    // The two the export never reads, derived defensively. `release.autonomy` and
    // `release.security` are `jsonb` columns written by T100, and `ReleaseRecord` types
    // them as `AutonomyResult`/`SecurityResult` by assertion rather than by validation —
    // so a scorecard stored without `diagnostics`, which the type says is required and
    // the column cannot enforce, made `[...stored.autonomy.diagnostics]` throw a bare
    // `TypeError` out of this module. That reached a route as a 500 for a release whose
    // folder is otherwise perfectly servable, and it is the same class as D-90-A: an
    // unsealed throw escaping where a fact about the release was meant.
    ontologyVersion: asString(stored.autonomy?.ontologyVersion) ?? CORE_ONTOLOGY.version,
    diagnostics: dedupe([
      ...asDiagnostics(stored.autonomy?.diagnostics),
      ...asDiagnostics(stored.security?.diagnostics),
    ]),
  };
}

/** A stored `diagnostics` that is absent or not an array reads as none, never as a throw. */
function asDiagnostics(value: unknown): readonly Diagnostic[] {
  return Array.isArray(value) ? (value as readonly Diagnostic[]) : [];
}

/**
 * The scored ontology version, when the stored scorecard carries one.
 *
 * The fallback is the version the release **declares**, which is the honest second
 * answer: it is what the manifest says the bundle was written against, and it is what
 * `README.md` already prints. It is not always the version the scores were computed
 * under — a B-08 re-score moves one and not the other, which is a defect the contract
 * records against `bundle-export.ts` and an owner owes — so this fallback is the weaker
 * answer and is only reached when the stronger one was never stored.
 */
function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
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
 * AC4, on the graph about to be exported rather than on a file the folder no longer carries.
 *
 * The two checks Attractor itself runs before it will execute a pipeline, in the order it
 * runs them: a graph that does not parse cannot be linted. Compiled here with
 * `emitAttractorDot` — the same call `exportBundle` used to make when it still wrote
 * `factory.dot` into the folder — rather than read back out of `files`, because that path
 * no longer exists among them. The diagnostics stay here — they quote node ids and source
 * spans, and the refusal is a fixed sentence naming `factory.dot` by the name Attractor
 * gives this shape of file, not by a path this release serves.
 */
function checkFactoryDot(blueprint: ResolvedBlueprint): void {
  const factory = emitAttractorDot(blueprint);

  const parsed = parseDot(factory, "factory.dot");
  if (parsed.graph === undefined || hasErrors(parsed.diagnostics)) throw factoryDotRejected();
  if (lintAttractor(parsed.graph, factory, "factory.dot").length > 0) throw factoryDotRejected();
}
