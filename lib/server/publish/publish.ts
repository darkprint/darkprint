/* ============================================================
   DarkPrint backend — publish
   backend.md T100, as amended by D-100-01. B-06: one verb, because
   one endpoint serves the wizard, the bundle page and the CLI.
   `created` distinguishes a new bundle from an appended release; a
   caller does not choose which act it is performing, the slug's
   availability decides.

   ── This module composes and owns no storage ──
   Every decision below belongs to somebody else and is CALLED
   rather than restated. The visibility grant is T060's `can`; the
   digest is `lib/core`'s, computed by the engine during resolution
   and never recomputed here; the card chain check is T020's inside
   `addCard`; the vocabulary's shape is T010's `parseStoredVocabulary`;
   the unfinished/in-error distinction is `bundleProgress`'s; the
   merged ontology view is T030's `openView`. The only things this
   file decides are the ORDER those questions are asked in and the
   transaction they are asked inside.

   ── AC5 is why this is a transaction and not a sequence ──
   "A card version whose bump is too small aborts the whole publish,
   bundle included." So every card, the bundle row and the release
   are written inside one `db.transaction` and any refusal rolls all
   of it back. The discriminating test publishes a bundle whose
   *second* card fails its chain check and asserts the first card is
   not stored either — which a step-by-step implementation fails
   while passing every other criterion.

   ── AC4 is a non-effect ──
   "Publishing a fork leaves the upstream's bytes, digest and
   releases untouched." Nothing here reaches an upstream row:
   `lineage` is resolved to an id and written as three plain columns
   on the NEW bundle, never as a foreign key and never as a read of
   the upstream's releases (`archive/bundle.ts`'s own header).
   ============================================================ */

import {
  cardRef,
  compareVersionStrings,
  latestVersion,
  loadCard,
  summarize,
  type BundleManifest,
  type CardRef,
  type NodeCard,
  type OntologyView,
} from "@/lib/core";
import { bundleProgress } from "@/components/upload/progress";
import { createObjectStorage, type Db, type ObjectStorage } from "@/lib/db";
import { resolveOwner } from "@/lib/server/accounts";
import {
  addRelease,
  createBundle,
  getBundle,
  getRelease,
  listReleases,
  parseStoredVocabulary,
  type StoredVocabulary,
} from "@/lib/server/archive";
import { addCard, getCard } from "@/lib/server/cards";
import { validateBundle } from "@/lib/server/engine";
import { exportRelease } from "@/lib/server/export";
import { getOntologyVersion, openView } from "@/lib/server/ontology";
import { can, type Actor } from "@/lib/server/policy";
import { reembedRelease } from "@/lib/server/search";
import { enqueueRepinEvents } from "@/lib/server/notifications";
import { persistArtefacts } from "./artefacts";
import { cardConflict, conflict, inError, notOwner, unfinished, versionNotHigher } from "./errors";

type Visibility = "public" | "private";

export interface PublishInput {
  ownerHandle: string;
  slug: string;
  version: string;
  manifest: BundleManifest;
  dot: string;
  cardFiles: Record<string, string>;
  /**
   * D-133-09. `StoredVocabulary`, never `readonly OntologyTerm[]` — `addRelease` refuses the
   * bare array at the write, so the older reading is not a style difference. `text` is the
   * author's `ontology/extensions.yaml` byte for byte (D-90-03, so `exportBundle` can write
   * it out unaltered) and `terms` is its parse.
   */
  vocabulary?: StoredVocabulary;
  visibility?: Visibility;
  lineage?: { ownerHandle: string; slug: string; version: string };
}

export interface PublishResult {
  bundleId: string;
  releaseId: string;
  digest: string;
  /** Whether this call CREATED the bundle, as against appending a release to one that existed. */
  created: boolean;
}

/**
 * Turn validated bytes into a bundle and its first release, or append a release to one that
 * exists.
 *
 * Throws `PublishRefusedError` for the five refusals this task owns. Three other typed
 * rejections pass through with their messages unaltered, so that each keeps ONE author
 * (D-50-08's rule, applied here): `MalformedVocabularyError` from T010 when `vocabulary` is
 * not the published shape, `UnknownOntologyVersionError` from T030 when the manifest names a
 * version nobody published, and `CardStoreError` from T020 when a card fails its chain check.
 * Re-rendering any of them as a publish refusal would put a second author on one sentence.
 */
export async function publish(
  db: Db,
  actor: Actor,
  input: PublishInput,
  /**
   * Where the frozen artefacts go, so the three-argument call the contract publishes is
   * unchanged and a caller with no reason to name a bucket does not have to.
   *
   * **`= undefined` and NOT `?`, and the difference is observable rather than stylistic.**
   * TypeScript's `?` erases to nothing, so `publish?: (a, b, c, d)` still reports
   * `Function.length === 4` and a suite asserting the published three-parameter arity reds
   * against it. Only a default-value expression or a rest element stops a parameter
   * counting. The `?` spelling shipped here once and was charged as F5.
   *
   * The default is `undefined` rather than `createObjectStorage()`, and that is what keeps
   * the reason the `?` was standing in for: `objectStorageConfigFromEnv()` throws for an
   * unset `S3_*`, so a default evaluated on entry would make every refusal on this path —
   * an unowned slug, an unfinished bundle — depend on storage being configured. The handle
   * is still built lazily, at the one point that actually writes.
   */
  storage: ObjectStorage | undefined = undefined,
): Promise<PublishResult> {
  /* The owner is resolved from the handle rather than taken off the actor's session, and the
     difference is not stylistic. Deriving `ownerId` from `actor.accountId` when the handles
     match makes the `can` call below trivially true, which hands AC7 to a `===` in this file
     instead of to T060 — and the session's handle goes stale: `changeHandle` updates the
     account row while the cookie keeps the old handle, so that comparison would refuse a
     rightful owner right after a rename and accept a handle they no longer hold. */
  const owner = await resolveOwner(db, input.ownerHandle);
  /* A handle nobody holds and a handle you do not own answer identically, which is B-03's
     404-over-403 rule one layer down: a distinct refusal for "no such author" would confirm
     which handles exist to anyone who asks. */
  if (owner === undefined) throw notOwner();

  const existing = await getBundle(db, owner.accountId, input.slug);

  /* B1/D-100-01: the account's own default, never a module constant. Somebody who set their
     account to private and omitted the field must not have something published publicly by a
     default that was not theirs. Ignored on an append — a release being added is not an
     occasion to rewrite the bundle row's visibility, and changing it is nobody's here. */
  const visibility: Visibility = existing?.visibility ?? input.visibility ?? owner.defaultVisibility;

  /* T060 decides, with the resource as it will actually stand. `can` is total and never
     throws: a malformed actor is a denial. */
  if (!can(actor, "publish", { kind: "bundle", ownerId: owner.accountId, visibility })) {
    throw notOwner();
  }

  /* T010's published reader, not a predicate written beside it: a second reading of this
     column is the defect T133 exists to end, and this is the first production caller of the
     write it guards. `addRelease` runs the same check again on the value stored — asked
     here so a malformed vocabulary is refused before a transaction is opened. */
  const vocabulary = parseStoredVocabulary(input.vocabulary, "publish");

  /* A2/D-100-01, and this line is the one that keeps a publish and its own export agreeing.
     `validateBundle` defaults to the SHIPPED core; `lib/server/export/build.ts` resolves a
     stored release against the version its manifest names. Left to default, a bundle
     declaring an older ontology version would be scored here against terms the export never
     uses, and the first export of it would throw `releaseDoesNotResolve` on a release this
     function had accepted. `openView` also refuses a version nobody published, which is what
     moves that failure from first-export to the write. */
  const ontology = await openView(db, input.manifest.ontologyVersion, vocabulary?.terms);

  const result = validateBundle({
    manifest: input.manifest,
    dot: input.dot,
    cardFiles: input.cardFiles,
    ontology,
  });

  /* AC1 and AC2. The distinction between "still being written" and "wrong" is
     `components/upload/progress.ts`'s and is consumed rather than re-derived — its
     `shadowsAnUnwrittenCard` rule reads the graph's predecessors to decide whether an unmet
     dependency is only the shadow of a card nobody has written yet, which no second
     implementation would rediscover. Doc 2 §1.1: the site must never make somebody feel
     penalised for the state their graph is honestly in. */
  const progress = bundleProgress(result);
  const { blueprint, analysis } = result;
  if (progress.state !== "resolves" || blueprint === undefined || analysis === undefined) {
    /* The two `undefined` disjuncts above are redundant against `bundleProgress`, which
       returns `resolves` only when both are present — they are here to narrow the types, not
       as a second opinion about the verdict. */
    if (progress.state === "unfinished") throw unfinished(progress.placed, progress.total);
    throw inError(summarize(result.diagnostics).error);
  }

  /* AC3. The ENGINE's digest, taken as computed during resolution and never recomputed:
     `bundleDigest` over the DOT source and one card digest per NODE (`lib/core/bundle/resolve.ts`
     — duplicates included, orphan cards excluded, "pinning one card twice is not the same
     bundle as pinning it once"). `addRelease` recomputes it from `dot` and `cardDigests`,
     which is why those two are passed through below exactly as the blueprint pinned them: a
     deduplicated array would store a different digest from the one the engine reported and
     the release would still look correct. */
  const digest = blueprint.digest;
  const cardRefs = blueprint.nodes.map((node) => node.ref);
  const cardDigests = blueprint.nodes.map((node) => node.digest);

  /* D-260-24: the fourth field of the scorecard, resolved HERE because this function is the
     one production writer of scores. `analysis.ontologyVersion` is the version the score was
     actually computed against (`lib/core/analysis/analyze.ts:94` reads it off the view this
     function built above), and `registry/scores.ts` refuses to call a scorecard complete
     without the row id it names. `getOntologyVersion` cannot miss on this path — `openView`
     above already refused a version nobody published, and `analysis.ontologyVersion` IS that
     view's version — but a miss still stamps nothing rather than throwing: an incomplete
     scorecard is the honest record of a score whose vocabulary row cannot be named. The
     published reader is consumed even though it loads terms this caller discards; a lean
     id-only reader would be a second query beside it, and the cost is one publish-time read. */
  const scored = await getOntologyVersion(db, analysis.ontologyVersion);

  if (existing !== undefined) {
    /* AC6, before AC8 (B3/D-100-01): a conflict is a statement about IDENTITY, and the
       contract has the digest computed before the write is attempted for exactly this. By
       digest and never by version, and the refusal names the version the EXISTING release
       holds — which is the fact the caller does not have. */
    const held = await getRelease(db, existing.id, digest);
    if (held !== undefined) throw conflict(held.version);

    /* AC8. `previous` is the highest SEMVER among the bundle's releases, not the most
       recently created one: `listReleases` orders by `createdAt`, and the two diverge the
       moment a patch on an older line is published, so only a semver reading makes "not
       higher" total. `compareVersionStrings` is `compareSemver` over strings and orders
       unparseable versions below every valid one rather than throwing, taken from
       `@/lib/core` directly on T020's precedent — `addCard` consumes the same primitives
       there rather than through `lib/server/versioning`, which is Forbidden to this task.

       `<= 0` and not `< 0`: the published wording is "not higher", which ADMITS EQUAL. That
       is deliberate, and it is what keeps a re-declared version refused HERE, holding both
       version strings, rather than reaching the unique index and coming back as a constraint
       name. It makes `ArchiveConflictError("release-version")` unreachable SEQUENTIALLY and
       not absolutely: this read and the write below are not one atomic act, so two concurrent
       publishes can both pass it and the index arbitrates. That is the right arbiter — no
       check in a reader could be atomic — and the route maps that conflict rather than
       letting it become a 500. */
    const previous = latestVersion(await releaseVersions(db, existing.id));
    if (previous !== undefined && compareVersionStrings(input.version, previous) <= 0) {
      throw versionNotHigher(input.version, previous);
    }
  }

  /* The verbatim bytes each pinned card was parsed from. Needed before the transaction
     opens because `addCard` stores `source` as text and the export folder is rebuilt from
     it (`lib/server/export/build.ts` reads `card_version.source`, not `body`, so that the
     digest printed in the README stays verifiable). */
  const sources = sourcesByRef(input.cardFiles, ontology);

  /* Resolved BEFORE the transaction opens, not inside it, and for two reasons. It is a read
     about the upstream and AC4 is that the fork's write does not touch that row, so it has no
     business inside the write's own transaction — and reading it on `db` from inside the
     callback would hold a second pooled connection for the length of the publish while the
     first one sits open. An upstream handle nobody holds fails here, before anything is
     written, rather than as a rollback. */
  const lineage = input.lineage === undefined ? undefined : await resolveLineage(db, input.lineage);

  return await db.transaction(async (tx) => {
    const bundle =
      existing ??
      (await createBundle(tx, {
        ownerId: owner.accountId,
        slug: input.slug,
        visibility,
        ...(lineage === undefined ? {} : { lineage }),
      }));

    /* Deduplicated: `cardRefs` is one entry per node, so a card pinned twice appears twice
       and must be stored once. The ORDER is the blueprint's, which is the DOT's. */
    const seen = new Set<CardRef>();
    for (const node of blueprint.nodes) {
      if (seen.has(node.ref)) continue;
      seen.add(node.ref);
      const added = await publishCard(tx, actor, node.ref, node.card, sources, owner.accountId, visibility);
      /* D-190-04's deferred wiring, the orchestrator's merge-time visit: a card VERSION first
         landing in the store announces itself to everyone pinning any version of that card.
         Only `added` announces — a byte-identical re-publish stored nothing and was announced
         when it first landed. Inside the transaction on purpose: a rolled-back publish must
         not have mailed anyone, and the queue's unique key makes a retried publish enqueue
         the same rows, not new ones. The publisher is excluded per D-190-09(2). This runs
         before `addRelease`, so the recipient set cannot include this release's own pins. */
      if (added) await enqueueRepinEvents(tx, node.card.id, node.card.version, owner.accountId);
    }

    const release = await addRelease(tx, {
      bundleId: bundle.id,
      version: input.version,
      dot: input.dot,
      manifest: input.manifest,
      cardRefs,
      cardDigests,
      /* Stored AS GIVEN, not as parsed. `parseStoredVocabulary` normalises — a YAML
         `since: 0.1` arrives as the number and leaves as `"0.1"` — so writing the parsed
         copy would rewrite the author's content, and `text` exists precisely so
         `exportBundle` can re-emit the file byte for byte. */
      ...(input.vocabulary === undefined ? {} : { vocabulary: input.vocabulary }),
      /* Passed through unmodified. `BlueprintAnalysis` carries a fourth field,
         `ontologyVersion`, that this column has no room for; the export reads it back off
         `autonomy` instead, because that is the vocabulary the score was actually computed
         against rather than the one the manifest declares. */
      analysis: {
        autonomy: analysis.autonomy,
        security: analysis.security,
        phaseCoverage: analysis.phaseCoverage,
        ...(scored === undefined ? {} : { scoredOntologyVersionId: scored.id }),
      },
    });

    /* The freeze, and it is inside the transaction on purpose (D-100-01 A4 as amended).
       B-08 re-scores `release.autonomy`/`security` on an ontology release, and
       `bundle-export.ts` quotes both into `README.md` — so without this write ONE DIGEST
       SERVES DIFFERENT BYTES OVER TIME, at the address `/mcp` calls load-bearing precisely
       because it does not move. Postgres holds the canonical record and the current
       projection; object storage holds the frozen artefact (B-01).

       Through `exportRelease` rather than by assembling the folder here, and the published
       signature says so in terms — *"T100, at publish, after `exportRelease` returns"*. It
       is also the only construction that makes the frozen bytes the SAME bytes the read
       path generates: `buildExport` decides the file set, the card dedup order and which
       analysis wins, and a second assembly here would be a second opinion about all three
       — so the freeze could differ from the fallback it exists to make unnecessary.

       Inside the transaction rather than after it, so a release is never committed
       unfrozen. An object left behind by a rollback is inert: its key IS the content
       digest and `exportBundle` is pure, so nothing can ever claim that key with different
       content, and a retry writes the identical object. */
    const files = await exportRelease(tx, actor, bundle.id, release.digest);
    await persistArtefacts(storage ?? createObjectStorage(), release.digest, files);

    /* D-300-06 F4.2: the one production trigger of re-embedding, wired in the same visit as
       D-260-24's stamp. Inside the transaction on purpose: the vectors live in the SAME
       database as the release, so a driver fault here is a release-write fault and "publish
       succeeded but the error said it failed" cannot happen; and a derived row never exists
       for a release that did not commit. Idempotent by row presence (D-200-03), no-op when
       the embedder degrades to absent (D-300-05's arm), so a publish never waits on an
       encoder that is not provisioned. */
    await reembedRelease(tx, bundle.id, release.digest);

    return { bundleId: bundle.id, releaseId: release.id, digest: release.digest, created: existing === undefined };
  });
}

/* --------------------- the parts this file does decide --------------------- */

/**
 * Store one pinned card, or confirm the store already holds exactly it. Answers `true` when
 * it STORED a new version and `false` when the identical row already existed — the repin
 * fan-out hangs on that distinction (D-190-04), and nothing else does.
 *
 * **A version that exists with DIFFERENT content is refused (B2/D-100-01), folded into
 * `conflict` rather than given a sixth kind.** Letting the stored row win silently is the
 * failure worth spelling out: the release digest is computed over the SUBMITTED bytes while
 * the export rebuilds the folder from `card_version.source`, so the folder and the digest
 * would disagree permanently and the release would look entirely healthy.
 *
 * **Compared by SOURCE BYTES, not by digest, and the stricter reading is the ruling.** A
 * digest comparison is the obvious one — it is the identity T020 indexes by and the one the
 * release digest is built from — and it is wrong here, because `cardDigest` runs over `body`
 * and is blind by construction to comments, whitespace and key order. Two cards differing
 * only that way compare equal, the stored `source` wins, and the folder that ships is not the
 * author's bytes. That is the failure D-90-03 exists to prevent one field over: a
 * vocabulary's `text` is stored byte for byte precisely so a parse cannot re-emit it. A card
 * version is a content identity; if the bytes differ at all, the stored row is not what was
 * submitted, and a comment-only edit needing a new version is the semantics rather than a cost.
 *
 * `getCard` takes the actor, so a private card owned by somebody else answers `undefined` and
 * this falls through to `addCard`, which refuses it as a duplicate. That refusal is T020's
 * and is left as T020's: it is a fact about an immutable row, not this task's to re-render.
 */
async function publishCard(
  db: Db,
  actor: Actor,
  ref: CardRef,
  card: NodeCard,
  sources: ReadonlyMap<CardRef, string>,
  ownerId: string,
  visibility: Visibility,
): Promise<boolean> {
  const source = sources.get(ref);
  /* Unreachable through a resolved blueprint: every pinned ref was parsed out of one of
     these files, and `sourcesByRef` walks the same record with the same reader. Kept because
     the alternative is storing `""` as a card's archived bytes, which no later reader could
     tell from a card that genuinely had none. */
  if (source === undefined) throw cardConflict(ref);

  const stored = await getCard(db, actor, card.id, card.version);
  if (stored !== undefined) {
    /* `source` is `text` and round-trips BYTE-identical (T020's own `CardRecord` note), which
       is what makes this comparison meaningful. `body` is `jsonb` and round-trips
       value-identical only, so comparing that would reintroduce exactly the blindness the
       ruling rejected. */
    if (stored.source !== source) throw cardConflict(ref);
    return false;
  }

  /* The chain check is T020's, run inside `addCard` against the stored version's immediate
     neighbours. NOT `checkDeclaredBump` from T025 as well (A3/D-100-01): the block said
     "through T025" and the tree has T020 consuming `lib/core` directly and declaring no
     dependency on T025, so a second call would be one refusal with two messages and two
     classes. A `CardStoreError` raised here aborts the whole transaction, which is AC5. */
  await addCard(db, { cardId: card.id, version: card.version, ownerId, visibility, body: card, source });
  return true;
}

/**
 * Every pinned card's verbatim bytes, keyed by the ref the card DECLARES.
 *
 * Keyed by declaration and not by filename because that is what the resolver does: it reads
 * `card.id` and `card.version` out of the parsed document, so `cards/foo@1.0.0.yaml` may hold
 * `bar@2.0.0` and the blueprint will pin `bar@2.0.0`. Sorted keys with the first file
 * winning, mirroring `lib/core/bundle/resolve.ts` — a bundle carrying one ref in two files
 * with different content is already an error there, so the two cannot disagree about a
 * bundle that reached this point.
 *
 * `loadCard` with the SAME view the bundle resolved against, never `validateCardSource`:
 * that verb checks against the curated core alone and withholds its `card` when anything of
 * error severity was reported, so every card using a local term would come back empty here
 * and its bytes would be lost.
 *
 * **This mirrors a rule it cannot import**, which is the one copy in this file worth naming:
 * `ResolvedBlueprint` exposes each node's parsed card but not the file it came from, so
 * there is no published route from a ref back to its source bytes. A `file` on `ResolvedNode`
 * would delete this function.
 */
function sourcesByRef(cardFiles: Record<string, string>, ontology: OntologyView): Map<CardRef, string> {
  const sources = new Map<CardRef, string>();
  for (const file of Object.keys(cardFiles).sort()) {
    const { card } = loadCard(cardFiles[file], { ontology, format: "yaml" });
    if (card === undefined) continue;
    const ref = cardRef(card.id, card.version);
    if (!sources.has(ref)) sources.set(ref, cardFiles[file]);
  }
  return sources;
}

/**
 * The upstream's owner id, for the three lineage columns.
 *
 * An upstream handle nobody holds is `notOwner`, for the same reason the publisher's own is:
 * a distinct refusal would say which authors exist.
 *
 * Nothing about the upstream is verified beyond its owner existing — not that the slug is
 * there, not that the version was ever released. That is `createBundle`'s published rule
 * rather than a gap here: lineage is "a plain optional pointer on the row, never a foreign
 * key to a specific release", because the release it names may be superseded or the upstream
 * deleted (T120) without this row's own history changing.
 */
async function resolveLineage(
  db: Db,
  lineage: { ownerHandle: string; slug: string; version: string },
): Promise<{ ownerId: string; slug: string; version: string }> {
  const upstream = await resolveOwner(db, lineage.ownerHandle);
  if (upstream === undefined) throw notOwner();
  return { ownerId: upstream.accountId, slug: lineage.slug, version: lineage.version };
}

/** The bundle's release versions. Split out only so AC8's rule above reads as one sentence. */
async function releaseVersions(db: Db, bundleId: string): Promise<string[]> {
  return (await listReleases(db, bundleId)).map((release) => release.version);
}
