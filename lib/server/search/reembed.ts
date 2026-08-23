/* ============================================================
   DarkPrint backend — reembedRelease
   AC6: re-embedding is triggered by a release and is idempotent
   for unchanged content. B-12 names the manifest AND the card
   specs, so this writes BOTH vectors and "idempotent" has two
   subjects (D-200-12) — `card_version_embedding` has no other
   published writer, and inventing a second entry point would put
   two owners on one table.

   ── Why the row's presence is the whole of the idempotency ──
   D-200-03. A `release` row is content-addressed: `digest` is
   derived from the bytes, so a row's digest CANNOT CHANGE, and
   therefore a `release_embedding` row is already a vector for that
   digest. No `embedded_digest`, no `embedded_at` — those columns
   exist to detect a drift this shape makes impossible, and a
   second source for one quantity is how two sources come to
   disagree. `embedding` is `NOT NULL`, so "never embedded" is the
   ABSENCE of a row rather than a null inside one.

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

import { inArray } from "drizzle-orm";
import { cardRef, parseCardRef } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { getRelease } from "@/lib/server/archive";
import type { BundleManifest, NodeCard } from "@/lib/server/types";
import { embed } from "./embed";
import { withSearchStore } from "./store";

/**
 * Embed a release and every card version it pins, writing only what is missing.
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

    /* `onConflictDoNothing` and not an upsert, and the difference is the whole criterion: a
       second call must leave `embedding` AND `created_at` byte-identical, and an upsert
       would rewrite both with values that only happen to match. It also makes two
       concurrent triggers safe without a transaction — the loser of the race writes
       nothing, which is exactly what it should have written. */
    await db
      .insert(schema.releaseEmbedding)
      .values({ releaseId: release.id, embedding: embed(manifestText(release.manifest)) })
      .onConflictDoNothing();

    await embedCards(db, release.cardRefs);
  });
}

/**
 * The manifest as one document.
 *
 * Field order is fixed so the text is a function of the release and of nothing else — the
 * vector is a bag of 3-grams and would survive a reordering, but AC6's determinism claim is
 * about the whole derivation and a reader should not have to work out that this line does
 * not matter. `manifest` is `jsonb` and arrives unvalidated, so every field is guarded the
 * way `registry/snapshot.ts` guards the same column.
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
 * Embed each pinned card version that has no vector yet.
 *
 * The query is a deliberate SUPERSET — one `IN` over card ids rather than one over every
 * `id@version` pair — narrowed here to the pin set, which is `registry/snapshot.ts`'s own
 * construction and for its reason: selecting by id alone returns every version of a pinned
 * id, including versions this release does not pin.
 *
 * A pin that does not parse names no row and is dropped. `resolveBundle` reports it as
 * `bundle/unpinned-card` at publish, and there is nothing here to attach a vector to.
 *
 * VISIBILITY IS NOT CONSULTED, and that is deliberate rather than an omission. These tables
 * are storage and not the answer: nothing reads them, and D-200-07's public-only rule is
 * applied at the three searchers, where a caller can actually observe it. Skipping a
 * private bundle here would instead leave a blueprint with no vector on the day it is made
 * public, which is a staleness bug with no trigger to repair it.
 */
async function embedCards(db: Db, pins: readonly string[]): Promise<void> {
  const wanted = new Map<string, { id: string; version: string }>();
  for (const pin of pins) {
    const parsed = parseCardRef(pin);
    if (parsed === undefined) continue;
    wanted.set(cardRef(parsed.id, parsed.version), parsed);
  }
  if (wanted.size === 0) return;

  const rows = await db
    .select({ id: schema.cardVersion.id, cardId: schema.cardVersion.cardId, version: schema.cardVersion.version, body: schema.cardVersion.body })
    .from(schema.cardVersion)
    .where(inArray(schema.cardVersion.cardId, [...new Set([...wanted.values()].map((pin) => pin.id))]));

  for (const row of rows) {
    if (!wanted.has(cardRef(row.cardId, row.version))) continue;
    await db
      .insert(schema.cardVersionEmbedding)
      .values({ cardVersionId: row.id, embedding: embed(cardText(row.body as NodeCard)) })
      .onConflictDoNothing();
  }
}
