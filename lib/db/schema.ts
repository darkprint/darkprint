/* ============================================================
   DarkPrint backend — Postgres schema
   The index half of B-01 (bytes live in S3, keyed by digest; the
   index lives here). Covers the nine tables named in T000's
   contract in `backend.md`: account, handle_reservation, bundle,
   release, card_version, ontology_version, ontology_term, target,
   audit. Every later task's `Owns` list excludes this file, so
   what is not here has to be added by amending T000's contract,
   not by editing this file from another worktree.

   Domain shapes (NodeCard, BundleManifest, OntologyTerm, ...) are
   never restated as SQL columns beyond what needs to be queried or
   constrained. The rest of each document is stored verbatim as
   JSONB `body` and reconstructed by callers through `lib/core`,
   which is the one place allowed to know what those shapes mean.
   ============================================================ */

import {
  boolean,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** B-07: cards may be private; ontology terms stay public. Shared by three tables. */
export const visibility = pgEnum("visibility", ["public", "private"]);

/** B-10's polymorphic target covers exactly these two kinds; T140 (saves) adds "term". */
export const targetKind = pgEnum("target_kind", ["blueprint", "card", "term"]);

/**
 * B-13: the only two subjects. `system` covers a state change no account initiated
 * (e.g. an ontology release re-scoring every affected bundle, B-08).
 */
export const actorKind = pgEnum("actor_kind", ["owner", "operator", "system"]);

/** AC5: a refused-by-policy operation must read differently from one that errored. */
export const auditDecision = pgEnum("audit_decision", ["allowed", "denied", "error"]);

/* --------------------- account (B-02, B-05) --------------------- */

/**
 * The GitHub identity and the handle are separate columns on purpose (B-02, B-05): a
 * GitHub rename must move neither. `handle` is nullable because a first sign-in
 * reaches this row before a handle is chosen — T050's own acceptance criterion 1 is
 * that sign-in cannot *complete* until one is allocated through T070, not that the
 * account cannot exist yet.
 */
export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull(),
  githubLogin: text("github_login").notNull(),
  handle: text("handle"),
  displayName: text("display_name"),
  email: text("email"),
  bio: text("bio"),
  avatarHue: smallint("avatar_hue"),
  validator: boolean("validator").notNull().default(false),
  validatorSince: timestamp("validator_since", { withTimezone: true }),
  validatorWeight: numeric("validator_weight", { precision: 6, scale: 3 }).notNull().default("1"),
  defaultVisibility: visibility("default_visibility").notNull().default("public"),
  /** T190's event/preference shape lives in the frontend fixtures today; stored open-ended
   *  here so T190 can read and write it without a column added to this file later. */
  notificationPreferences: jsonb("notification_preferences").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("account_github_id_key").on(t.githubId),
  uniqueIndex("account_handle_key").on(t.handle),
]);

/* --------------------- handle_reservation (B-05) --------------------- */

/**
 * Permanent, append-only history of every handle ever claimed. `account.handle` is
 * the account's *current* handle; this table is what makes a released one
 * unclaimable forever — a rename inserts a new row rather than moving this one.
 */
export const handleReservation = pgTable("handle_reservation", {
  handle: text("handle").primaryKey(),
  accountId: uuid("account_id").references(() => account.id),
  status: text("status", { enum: ["active", "released"] }).notNull().default("active"),
  reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
}, (t) => [
  index("handle_reservation_account_id_idx").on(t.accountId),
]);

/* --------------------- ontology_version / ontology_term (B-04, B-07, B-08) --------------------- */

/** One row per published version of the *core*, shared vocabulary. */
export const ontologyVersion = pgTable("ontology_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: text("version").notNull(),
  digest: text("digest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ontology_version_version_key").on(t.version),
]);

/**
 * Core terms only. A bundle's own local/namespaced overlay is not a global row here —
 * it travels with the release that declares it (`release.localVocabulary`), which is
 * what `ontology/extensions.yaml` is generated from at export (T090) and what T030's
 * merged view folds in per bundle rather than per registry.
 */
export const ontologyTerm = pgTable("ontology_term", {
  id: uuid("id").primaryKey().defaultRandom(),
  ontologyVersionId: uuid("ontology_version_id").notNull().references(() => ontologyVersion.id),
  termId: text("term_id").notNull(),
  kind: text("kind", { enum: ["phase", "node-type", "risk-marker", "data-type", "tool"] }).notNull(),
  /** Full `OntologyTerm` (lib/core/ontology/types.ts) — label, broader, deprecated, etc. */
  body: jsonb("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ontology_term_version_term_key").on(t.ontologyVersionId, t.termId),
]);

/* --------------------- bundle / release (B-04, B-06, B-08, B-09) --------------------- */

/**
 * B-06: a bundle first exists at its first publish, one record per `(owner, slug)`.
 * Lineage (T110) is a plain optional pointer on the row, not a second entity —
 * `{ owner, slug, version }`, stored as three columns rather than a foreign key to a
 * specific release, because the upstream release a fork was cut from may itself be
 * superseded or the upstream deleted (T120) without the fork's own history changing.
 */
export const bundle = pgTable("bundle", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => account.id),
  slug: text("slug").notNull(),
  visibility: visibility("visibility").notNull().default("public"),
  lineageOwnerId: uuid("lineage_owner_id").references(() => account.id),
  lineageSlug: text("lineage_slug"),
  lineageVersion: text("lineage_version"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("bundle_owner_slug_key").on(t.ownerId, t.slug),
]);

/**
 * Append-only per bundle (B-06). `dot` and `cardRefs`/`cardDigests` are exactly the
 * inputs `bundleDigest(dot, sortedCardDigests)` (`lib/core/hash/digest.ts:61`) takes,
 * so the stored digest can be recomputed and checked rather than trusted blindly.
 * `cardDigests` is an array, not a set: pinning one card twice is a different digest
 * from pinning it once, and deduplicating here would erase that.
 *
 * `autonomy`/`security`/`phaseCoverage` are nullable because T000 stores no feature
 * logic to compute them — they are written by T100 at publish and rewritten by
 * whichever task re-scores on an ontology release (B-08), stamped with the ontology
 * version they were computed under.
 */
export const release = pgTable("release", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id").notNull().references(() => bundle.id),
  version: text("version").notNull(),
  digest: text("digest").notNull(),
  dot: text("dot").notNull(),
  manifest: jsonb("manifest").notNull(),
  cardRefs: text("card_refs").array().notNull(),
  cardDigests: text("card_digests").array().notNull(),
  /** Local/namespaced `OntologyTerm[]` this release's cards declare, or `null` for none. */
  localVocabulary: jsonb("local_vocabulary"),
  autonomy: jsonb("autonomy"),
  security: jsonb("security"),
  phaseCoverage: jsonb("phase_coverage"),
  scoredOntologyVersionId: uuid("scored_ontology_version_id").references(() => ontologyVersion.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("release_bundle_version_key").on(t.bundleId, t.version),
  index("release_digest_idx").on(t.digest),
]);

/* --------------------- card_version (B-04, B-07) --------------------- */

/**
 * One immutable row per `(cardId, version)` (T020). `digest` is `cardDigest` —
 * sha256 over the card minus `author`/`provenance` — kept as a plain indexed column
 * rather than a unique one: two different `(id, version)` rows legitimately sharing a
 * digest is the dedup signal T020 reads, not a collision to reject.
 */
export const cardVersion = pgTable("card_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: text("card_id").notNull(),
  version: text("version").notNull(),
  digest: text("digest").notNull(),
  ownerId: uuid("owner_id").notNull().references(() => account.id),
  visibility: visibility("visibility").notNull().default("public"),
  /** Full `NodeCard` (lib/core/card/schema.ts), parsed. */
  body: jsonb("body").notNull(),
  /** Raw YAML bytes, kept verbatim so a read-back is byte-identical to what was stored. */
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("card_version_id_version_key").on(t.cardId, t.version),
  index("card_version_digest_idx").on(t.digest),
]);

/* --------------------- target (B-10) --------------------- */

/**
 * One row per `(kind, id)` a star, download or note can attach to. `refId` is text
 * because the identity grain differs by kind: a bundle's is its `bundle.id` (a
 * blueprint is counted as a whole, current-release-independent thing), a card's is
 * its bare `cardId` — never `id@version` — because B-10 aggregates card counters per
 * id, not per version, and a term's is its ontology term id.
 */
export const target = pgTable("target", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: targetKind("kind").notNull(),
  refId: text("ref_id").notNull(),
  starCount: numeric("star_count", { precision: 12, scale: 0 }).notNull().default("0"),
  downloadCount: numeric("download_count", { precision: 12, scale: 0 }).notNull().default("0"),
  noteCount: numeric("note_count", { precision: 12, scale: 0 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("target_kind_ref_id_key").on(t.kind, t.refId),
]);

/* --------------------- audit (B-14) --------------------- */

/**
 * Every state change, permanent (unlike the ~90-day operational request log B-14
 * describes, which is not a table here — it never becomes product data and so never
 * needed a schema). `targetKind`/`targetId` are plain text rather than a foreign key
 * to `target`, because an audited action (e.g. a handle rename) can concern a subject
 * `target` has no row for.
 */
export const audit = pgTable("audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => account.id),
  actorKind: actorKind("actor_kind").notNull().default("owner"),
  action: text("action").notNull(),
  targetKind: text("target_kind"),
  targetId: text("target_id"),
  decision: auditDecision("decision").notNull().default("allowed"),
  /** Structured context (e.g. old/new handle). Never a stack, a query or a credential. */
  detail: jsonb("detail").notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("audit_actor_id_idx").on(t.actorId),
  index("audit_target_idx").on(t.targetKind, t.targetId),
  index("audit_occurred_at_idx").on(t.occurredAt),
]);
