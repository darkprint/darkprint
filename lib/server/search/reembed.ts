/* ============================================================
   DarkPrint backend — reembedRelease
   AC6: re-embedding is triggered by a release and is idempotent
   for unchanged content. B-12 names the manifest AND the card
   specs, so this writes BOTH vectors and "idempotent" has two
   subjects (D-200-12) — `card_version_embedding` has no other
   published writer, and inventing a second entry point would put
   two owners on one table.

   ── The row's presence WAS the whole of the idempotency, and
      what falsified that ──
   D-200-03 argued: a `release` row is content-addressed, `digest`
   is derived from the bytes, so a row's digest CANNOT CHANGE, and
   therefore a `release_embedding` row is already a vector for that
   digest. No `embedded_digest`, no `embedded_at`, because those
   columns detect a drift this shape makes impossible.

   The shape does not make it impossible. Commit ed3ae85, the
   stored-card registry migration, ran `update card_version set
   body, source, digest where id = ...` over all 58 rows and
   `update release set manifest, card_digests, digest` over all 16,
   in place, under unchanged primary keys. Digests moved. The
   `on delete cascade` that was supposed to make a stale vector
   unrepresentable never fired, because nothing was deleted. 42
   card vectors and 7 release vectors written on 2026-08-25
   survived a rewrite of their subjects on 2026-09-01 with nothing
   recording which text they were computed from.

   Nothing broke, and the reason is which fields that migration
   happened to touch. It moved `cannot`, `will_not`, `notes`,
   `requires_human` and `ontology_version`, and `cardText` and
   `manifestText` below read none of them. Re-encoding all 49
   subjects from their post-migration bodies reproduced all 49
   stored vectors to within float32 round-trip. That is luck about
   one migration's field list, and the same script touching `spec`
   would have left every card vector wrong with no column able to
   say so.

   ── What replaced it: `embedded_input_sha256` (0008) ──
   The row now carries the identity of the exact input it was
   encoded from, and idempotency reads THAT rather than presence.
   Equal input, nothing written and not even a model load. Absent
   or unequal, the row is rewritten.

   Three decisions inside that, none of them free:

     * It is NOT `embedded_digest`, and D-200-03's objection to
       that column is kept rather than overruled. A column
       mirroring a CURRENT value can only agree or be a bug.
       `release.digest` is also simply the wrong quantity:
       `bundleDigest` hashes `{dot, cardDigests}` with no manifest
       in it, while the release vector is nothing but manifest
       fields, so it would have called all 16 releases stale last
       week and would not move at all if someone edited
       `manifest.title`. This column records a PAST value, and
       disagreement with the present one is the signal.

     * The model's identity is IN the hash, not beside it. A text
       hash alone is blind to a swapped encoder: change the
       weights and every stamp still matches while every vector
       becomes incomparable to the next one written. `MODEL_BLOB`
       is the frozen identity of the vendored weights and
       `derivation.test.ts` is what keeps that pin honest, so
       folding it in makes a model swap invalidate every row for
       free. It is not total. Changing the pooling or the
       normalisation in `embed.ts` moves no stamp, and nothing
       here claims otherwise.

     * The write is now an upsert where it used to be
       `onConflictDoNothing`, and `created_at` moves with it. AC6
       is untouched, because a second call with unchanged content
       returns before reaching the insert and leaves `embedding`
       AND `created_at` byte-identical. What changed is the case
       AC6 never covered: content that DID change, which the old
       insert-only writer could not repair at all. Two concurrent
       triggers now both write instead of one losing the race, and
       they write the same bytes, because the encoder is
       deterministic across processes.

   `embedding` is `NOT NULL`, so "never embedded" is still the
   ABSENCE of a row rather than a null inside one. `NULL` in
   `embedded_input_sha256` is a different statement: the row was
   written before 0008 and its input is unknown. It cannot be
   backfilled honestly, because deriving it from today's text
   would stamp agreement onto a vector nobody checked, so unknown
   is treated exactly as disagreement and one sweep clears it.

   ── `(bundleId, digest)` is not unique, and that is inherited ──
   The unique index is `release_bundle_version_key` on
   `(bundle_id, version)`; `release_digest_idx` is non-unique, and
   `bundleDigest` takes `{dot, cardDigests}` with NO VERSION IN IT,
   so two versions of identical content legitimately share a
   digest. Merged T010's `getRelease` already resolves that by
   taking the first row, and this module consumes its answer rather
   than inventing a second resolver — which is also where the
   malformed-digest handling already lives.
   ============================================================ */

import { eq, inArray, sql } from "drizzle-orm";
import { cardRef, parseCardRef, sha256Hex } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { getRelease } from "@/lib/server/archive";
import type { BundleManifest, NodeCard } from "@/lib/server/types";
import { MODEL_BLOB, embed } from "./embed";
import { withSearchStore } from "./store";

/**
 * The identity of everything a stored vector is a function of: the encoder that produced it
 * and the exact string it was handed.
 *
 * Prefixed `sha256:` to match `lib/core/hash/digest.ts`'s convention, so a value read out of
 * the database says which algorithm made it and a second one can coexist later. The model
 * pin goes first and is a fixed 64 hex characters, so no text can be confused for it however
 * the newline lands.
 *
 * Exported so the decision that the MODEL PIN participates is observable. It is the half of
 * this column that no database cell can drive: every vector in a scratch database is written
 * by the one vendored encoder, so a run cannot show that swapping the weights invalidates a
 * stamp. Kept out of `index.ts`, which is the published barrel and is pinned by
 * `tests/server/t300/surface.test.ts` to exactly the four verbs and their approved
 * additions. `cardText` and `manifestText` stay private and are driven through behaviour.
 */
export function embeddedInput(text: string): string {
  return `sha256:${sha256Hex(`${MODEL_BLOB.sha256}\n${text}`)}`;
}

/**
 * Embed a release and every card version it pins, writing what is missing or out of date.
 *
 * An absent release is a NO-OP returning `void` rather than a throw (D-200-13): it matches
 * the value-not-refusal convention this module's `errors.ts` measures, and a typed refusal
 * would add a class to the published surface that no caller could bind to yet.
 * `getRelease` answers `undefined` for a release that is not there and for a malformed
 * digest alike, and both are the same nothing-to-do here.
 */
export async function reembedRelease(db: Db, bundleId: string, digest: string): Promise<void> {
  return withSearchStore("reembedRelease", async () => {
    const release = await getRelease(db, bundleId, digest);
    if (release === undefined) return;

    const encoded = await embedManifest(db, release.id, release.manifest);

    /* NO ENCODER, NOTHING WRITTEN, NO REFUSAL (D-300-05). The model directory is an
       explicit operator step and a machine without it must keep publishing: the vector is
       an ADDITIONAL recall channel, so its absence narrows what search can reach and
       breaks nothing that worked before. Returning here rather than inside the loop
       because the answer is a property of the process, not of this release — one absent
       encoder cannot embed the cards either.

       This is no longer the ONLY place that answer is read, and it cannot be: an up-to-date
       manifest returns `true` without touching the encoder, so a release whose vector is
       current and whose cards are not reaches the loop below on a machine with no weights.
       `embedCards` checks for itself, and the loader is memoised, so the cost of arriving
       there is one cached miss rather than a load per card. */
    if (!encoded) return;

    await embedCards(db, release.cardRefs);
  });
}

/**
 * The release half. `true` means the row is now a vector for `manifest`, whether this call
 * wrote it or found it already correct; `false` means only that this process cannot encode.
 *
 * The stamp is read BEFORE the encoder is consulted, which is what makes the unchanged case
 * cost one indexed lookup instead of a 23MB model load, and it is also what makes the
 * idempotency criterion checkable without weights at all.
 */
async function embedManifest(db: Db, releaseId: string, manifest: BundleManifest): Promise<boolean> {
  const text = manifestText(manifest);
  const input = embeddedInput(text);

  const [current] = await db
    .select({ input: schema.releaseEmbedding.embeddedInputSha256 })
    .from(schema.releaseEmbedding)
    .where(eq(schema.releaseEmbedding.releaseId, releaseId));
  if (current?.input === input) return true;

  const vector = await embed(text);
  if (vector === undefined) return false;

  /* `createdAt` moves on a rewrite because the alternative is a column that dates a vector
     it does not describe. AC6's byte-identical `created_at` is preserved by the return
     above rather than by this clause: an unchanged input never reaches here.

     What makes the upsert safe for two concurrent triggers is the encoder rather than the
     conflict clause. The ruled model is deterministic across PROCESSES and not merely within
     one, measured byte-identical over four texts across three separate pids, so the racer
     that arrives second overwrites the first with the same 384 numbers. Under the previous
     `onConflictDoNothing` the loser wrote nothing, which was the same outcome by a different
     route; only `created_at` now belongs to the later writer. */
  await db
    .insert(schema.releaseEmbedding)
    .values({ releaseId, embedding: vector, embeddedInputSha256: input })
    .onConflictDoUpdate({
      target: schema.releaseEmbedding.releaseId,
      set: { embedding: vector, embeddedInputSha256: input, createdAt: sql`now()` },
    });
  return true;
}

/**
 * The manifest as one document.
 *
 * Field order is fixed so the text is a function of the release and of nothing else. Under
 * the 3-gram derivation this was belt-and-braces — a bag of 3-grams survives a reordering —
 * and **under the encoder it is load-bearing**: a transformer reads the document as a
 * sequence, so two orderings of the same fields are two different vectors. `manifest` is
 * `jsonb` and arrives unvalidated, so every field is guarded the way `registry/snapshot.ts`
 * guards the same column.
 *
 * THE LIST STAYS WIDE, and that is ruled rather than inherited (D-300-04 D6). D-300-01
 * names `title + summary + description` as the purpose, and it named it as the CORE of the
 * document and not as a replacement for this list: `slug`, `category` and `tags` stay in,
 * so two releases differing only in `category` embed differently.
 */
function manifestText(manifest: BundleManifest): string {
  const parts: string[] = [];
  for (const field of [manifest.slug, manifest.title, manifest.summary, manifest.description, manifest.category]) {
    if (typeof field === "string") parts.push(field);
  }
  if (Array.isArray(manifest.tags)) {
    for (const tag of manifest.tags) if (typeof tag === "string") parts.push(tag);
  }
  return parts.join("\n");
}

/**
 * A card's spec as one document: what the node is, what it does, and the prose handed to
 * the agent that runs it.
 *
 * `spec` is the field B-12 means by "card specs" and it is the longest text in the archive,
 * which is what makes the card vectors worth storing at all. `author` and `provenance` are
 * excluded, for `cardDigest`'s reason — who typed the file says nothing about what the node
 * does, and two authors contributing the same card should reach the same vector.
 */
function cardText(card: NodeCard): string {
  const parts: string[] = [];
  for (const field of [card.id, card.name, card.type, card.action, card.spec]) {
    if (typeof field === "string") parts.push(field);
  }
  for (const list of [card.phases, card.tools, card.riskMarkers]) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) if (typeof entry === "string") parts.push(entry);
  }
  return parts.join("\n");
}

/**
 * Embed each pinned card version whose stored vector is missing, unstamped or out of date.
 *
 * The query is a deliberate SUPERSET — one `IN` over card ids rather than one over every
 * `id@version` pair — narrowed here to the pin set, which is `registry/snapshot.ts`'s own
 * construction and for its reason: selecting by id alone returns every version of a pinned
 * id, including versions this release does not pin.
 *
 * A pin that does not parse names no row and is dropped. `resolveBundle` reports it as
 * `bundle/unpinned-card` at publish, and there is nothing here to attach a vector to.
 *
 * VISIBILITY IS NOT CONSULTED, and that is deliberate rather than an omission (D-200-25).
 * D-200-07's public-only rule is applied at the three searchers, where a caller can
 * actually observe it. D-82 excludes private content from the SEARCHABLE INDEX, which is
 * not the storage a vector lives in.
 *
 * **The premise this rested on has CHANGED and the conclusion has not.** It used to read
 * "nothing reads these tables", which stopped being true at T300: D-300-02 gives them their
 * first reader, and `blueprints.ts`/`cards.ts` now query them by cosine distance. That
 * makes the reasoning MORE load-bearing rather than less — an unfiltered vector table is
 * now reachable by a query, so the searchers' own filtering is the only thing keeping a
 * private card out of a result set, and it is written there (`semanticCandidates` narrows
 * to the public universe before it ranks). A vector for a private card exists and is never
 * an answer.
 *
 * Two reasons, and the second is the stronger one:
 *
 *   * Visibility is FLIPPABLE and re-embedding is triggered by a RELEASE. Skipping a
 *     private card leaves it with no vector and NOTHING TO TRIGGER ONE on the day it goes
 *     public — a staleness bug that raises no error and appears in no test.
 *   * `reembedRelease` takes no actor, deliberately. A visibility check inside it would
 *     make this table a SECOND AUTHOR of the visibility rule, which is exactly the defect
 *     D-200-06 corrected in the other direction: one rule, owned by T060 and applied by
 *     T080, consumed everywhere and restated nowhere.
 */
async function embedCards(db: Db, pins: readonly string[]): Promise<void> {
  const wanted = new Map<string, { id: string; version: string }>();
  for (const pin of pins) {
    const parsed = parseCardRef(pin);
    if (parsed === undefined) continue;
    wanted.set(cardRef(parsed.id, parsed.version), parsed);
  }
  if (wanted.size === 0) return;

  /* Left joined rather than queried per card: the stamp decides whether this row needs the
     encoder at all, and asking the database once for 20 pins beats 20 round trips to skip
     20 rows. `input` is null both for a card with no vector and for one whose vector predates
     0008, which are two different states and the same instruction here. */
  const rows = await db
    .select({
      id: schema.cardVersion.id,
      cardId: schema.cardVersion.cardId,
      version: schema.cardVersion.version,
      body: schema.cardVersion.body,
      input: schema.cardVersionEmbedding.embeddedInputSha256,
    })
    .from(schema.cardVersion)
    .leftJoin(schema.cardVersionEmbedding, eq(schema.cardVersionEmbedding.cardVersionId, schema.cardVersion.id))
    .where(inArray(schema.cardVersion.cardId, [...new Set([...wanted.values()].map((pin) => pin.id))]));

  for (const row of rows) {
    if (!wanted.has(cardRef(row.cardId, row.version))) continue;
    const text = cardText(row.body as NodeCard);
    const input = embeddedInput(text);
    if (row.input === input) continue;

    const vector = await embed(text);
    /* Reachable now that the caller no longer probes the encoder for every release (an
       up-to-date manifest returns without one), and checked for the same reason as before:
       the alternative is passing `undefined` into a `NOT NULL vector(384)` column and
       reading about it in a driver message. `return` and not `continue`, because an absent
       encoder is a property of the process and the next card cannot fare better. */
    if (vector === undefined) return;
    await db
      .insert(schema.cardVersionEmbedding)
      .values({ cardVersionId: row.id, embedding: vector, embeddedInputSha256: input })
      .onConflictDoUpdate({
        target: schema.cardVersionEmbedding.cardVersionId,
        set: { embedding: vector, embeddedInputSha256: input, createdAt: sql`now()` },
      });
  }
}
