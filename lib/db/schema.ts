/* ============================================================
   DarkPrint backend — Postgres schema
   The index half of B-01 (bytes live in S3, keyed by digest; the
   index lives here). Covers the ten tables named in T000's
   contract in `backend.md`: account, handle_reservation, bundle,
   release, card_version, ontology_version, ontology_term, target,
   target_actor, audit. Every later task's `Owns` list excludes this
   file, so what is not here has to be added by amending T000's
   contract, not by editing this file from another worktree.

   T005 appends six more at the bottom — save, ballot, note,
   note_vote, run_report, api_key — for five tasks that each have
   this file Forbidden and so could not add their own. That is the
   whole of T005's licence: append, plus one named alteration
   (`handle_reservation.account_id` gains NOT NULL, AC7a). The ten
   above are otherwise untouched.

   Domain shapes (NodeCard, BundleManifest, OntologyTerm, ...) are
   never restated as SQL columns beyond what needs to be queried or
   constrained. The rest of each document is stored verbatim as
   JSONB `body` and reconstructed by callers through `lib/core`,
   which is the one place allowed to know what those shapes mean.
   ============================================================ */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
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

/** What `target_actor` records an account did to a target — a star, or a note vote. */
export const targetActorKind = pgEnum("target_actor_kind", ["star", "note_vote"]);

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
  accountId: uuid("account_id").notNull().references(() => account.id),
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
 * it travels with the release that declares it (`release.localVocabulary`), which since
 * D-90-03 is served AS `ontology/extensions.yaml` at export (T090), byte for byte from the
 * stored `text` rather than generated from the parsed terms, and which T030's merged view
 * folds in per bundle rather than per registry. ("generated from" was this line until
 * D-133-02 F1; re-emitting that file from the parse loses comments, key order and
 * formatting, which is the loss D-90-03 exists to prevent.)
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
  /**
   * `StoredVocabulary` — `{ text, terms }` — or `null` for none.
   *
   * **This comment used to say `OntologyTerm[]`, and that is the shape both readers refuse.**
   * D-90-03 moved the column to `{ text, terms }` so `exportBundle` could write the author's
   * own bytes into a folder unaltered, and it ruled — correctly — that the column type and
   * this file needed no change. What it left behind was this line, and it was not inert:
   * `readonly Record<string, unknown>[]` is what following it produces, and that is what
   * T130's blind author stored. Recorded in those words because the tree's account of that
   * incident was "two authors guessed incompatibly from nothing", and the truth is that one of
   * them read the only documentation there was (D-133-02 F1).
   *
   * The shape is published as `StoredVocabulary` from `@/lib/server/archive` and `addRelease`
   * refuses anything else at the write (T133 AC1). A comment is not an enforcement, which is
   * the whole lesson here — so this one names where the enforcement is rather than restating
   * the shape and hoping.
   */
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

/* --------------------- target_actor (amendment, 2026-08-13) --------------------- */

/**
 * `target` carries aggregate counters only — nothing records *who* acted, so T150's
 * "starring twice yields 1" had no idempotency-key storage to reach for, and every
 * downstream task's `Owns` excludes this file. One row per `(target, account, kind)`;
 * the unique index below is the idempotency guarantee itself, not just an index on
 * top of one.
 *
 * **`kind = "note_vote"` cannot serve T170 and the original wording of this comment
 * claimed it could.** `target_id` references `target`, whose kind is
 * `blueprint | card | term` — there is no `note` — so a note vote recorded here is
 * keyed per *blueprint*, which refuses an account's vote on a second note under the
 * same blueprint and never notices two votes on one note. T170's "a vote from one
 * account counts once" is `note_vote` (T005), below. The enum member is left in place
 * rather than removed: `target_actor_kind` is an existing type and T005 alters none.
 */
export const targetActor = pgTable("target_actor", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetId: uuid("target_id").notNull().references(() => target.id),
  accountId: uuid("account_id").notNull().references(() => account.id),
  kind: targetActorKind("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("target_actor_target_account_kind_key").on(t.targetId, t.accountId, t.kind),
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

/* ============================================================
   T005 — the community and account tables

   Six tables for five tasks (T140, T160, T170, T180, T230) that
   each have this file Forbidden and so could not add their own.
   Column names and shapes are T005's Published signatures block in
   `backend.md`, which is this task's whole acceptance surface: it
   ships no exported function, so the identifiers a raw-SQL test has
   to type ARE the interface.

   The criteria these satisfy are about what the DATABASE enforces,
   not about which columns exist. Four of the five consumers have an
   acceptance criterion only a constraint can deliver — an idempotent
   save, a ballot that replaces rather than accumulates, one vote per
   account per note, a report refused against an unknown digest — and
   a column list held up by caller convention would let all four pass
   their own tests against a store permitting exactly what they
   forbid. Each is measured by dropping it: every one flips from
   refused to accepted, so none is the database refusing for a reason
   of its own (T-03).
   ============================================================ */

/* --------------------- save (T140, B-10) --------------------- */

/**
 * Private bookmarks. `target_kind`/`target_id` carry the target inline rather than
 * referencing `target.id`, and that is the difference between a save and a star: a
 * `target` row is the public counters row, so creating one for a save would put a
 * private bookmark's existence into the table T150 reads aggregates out of. T140's
 * AC1 makes a save invisible to everyone but its owner "including its count", so
 * there must be nothing in a shared row to count.
 *
 * `target_id` therefore holds `target.ref_id`'s grain — a bundle id, a bare card id
 * (never `id@version`, per B-10), or an ontology term id — and is **never** a foreign
 * key to `target.id`, which the name invites and D-05-05 records as the hazard. The
 * name is the one T005's AC1 writes, kept as written so a suite driving the criterion
 * by raw SQL finds the column it names.
 *
 * The unique index IS T140's AC2 ("saving one target twice is idempotent"). A
 * `SELECT`-then-`INSERT` passes every sequential test and loses under two callers.
 */
export const save = pgTable("save", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  targetKind: targetKind("target_kind").notNull(),
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("save_account_target_key").on(t.accountId, t.targetKind, t.targetId),
]);

/* --------------------- ballot (T160, B-11) --------------------- */

/**
 * One row per `(account, bundle)` with a column per writable metric — D-05-02's
 * ruling, and the reason is T160's AC1 rather than tidiness: "a ballot cannot write
 * `autonomy` or `security`" is satisfied **by construction**, because those columns
 * do not exist. A `metric` column would need an enum or a check to say the same
 * thing, and a constraint is something that can be dropped.
 *
 * Keyed on the **bundle**, never the release: B-11 carries one ballot across
 * releases, so keying on a release would silently reset a blueprint's standing every
 * time its author published. The unique index is T160's AC2 — one account voting
 * twice replaces rather than accumulates, because there is only ever one row to
 * update.
 *
 * The three are **nullable**, so a caller may vote on one metric and not the others
 * (`castBallot` takes a `Partial<Ballot>`). The consequence reaches T160 rather than
 * staying here: a sample size is therefore per *metric*, not per ballot, so AC3's
 * "every aggregate carries its sample size" and AC4's five-vote threshold both count
 * per metric.
 *
 * No aggregate is stored. T160's AC5 — "granting a validator badge changes an
 * existing aggregate without any vote being recast" — means the aggregate is computed
 * from these rows against *current* weights at read time; a materialised column
 * passes every other criterion and fails that one.
 */
export const ballot = pgTable("ballot", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  bundleId: uuid("bundle_id").notNull().references(() => bundle.id),
  efficacy: smallint("efficacy"),
  reliability: smallint("reliability"),
  transparency: smallint("transparency"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ballot_account_bundle_key").on(t.accountId, t.bundleId),
  /* B-11's 0-100, bounded here rather than trusted. `smallint` alone admits 101 and
     -1, which is why this is the constraint AC5 asks to be measured at both ends.
     NULL passes: an unwritten metric is not an out-of-range one. */
  check(
    "ballot_metric_range",
    sql`${t.efficacy} between 0 and 100 and ${t.reliability} between 0 and 100 and ${t.transparency} between 0 and 100`,
  ),
]);

/* --------------------- note / note_vote (T170, B-10, B-18) --------------------- */

/**
 * `{ id, author, body, createdAt }` keyed by the B-10 target (`lib/types.ts:182`),
 * carried inline for the same reason `save` carries it: a note attaches to a
 * blueprint or a card, and the identity grain is `target.ref_id`'s.
 *
 * **`votes` is not a column.** `lib/types.ts:182` publishes it and it is a derived
 * count over `note_vote`, so storing it would be a second place holding one fact —
 * and the one that goes stale silently, since nothing reconciles a counter against
 * the rows it counts.
 *
 * `deleted_at` is B-18's tombstone. The row survives a delete so counts and cursors
 * stay honest, and T170's AC6 empties `body` at delete rather than filtering at read,
 * so "its body is unreadable" is true of the storage rather than of the current
 * reader.
 *
 * One timestamp, not a `deleted` flag beside it, and this needs saying because
 * D-70-22 rules the opposite for `handle_reservation.released_at`: there a released
 * handle can be reclaimed, so the timestamp is a history fact and `status` is the
 * only authority on current state. Here B-18 offers no undelete — no appeals, no
 * report queue — so deletion is terminal and the timestamp is both the history and
 * the status. `NoteRecord.deleted` is `deleted_at IS NOT NULL`. If an undelete is
 * ever added, that stops being true and the two facts split again.
 */
export const note = pgTable("note", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  targetKind: targetKind("target_kind").notNull(),
  targetId: text("target_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  /* T170's AC2 cursor is keyset on `(createdAt, id)` — `createdAt` alone collides
     under concurrent inserts, which T010 measured at 32 inserts to 12 distinct
     timestamps. Indexed in the order the page query reads them, so the cursor is a
     range scan rather than a sort. Not a constraint: nothing in T005's criteria rests
     on it, and it is here because the criterion it serves is unaffordable without it. */
  index("note_target_created_idx").on(t.targetKind, t.targetId, t.createdAt, t.id),
]);

/**
 * T170's AC4, "a vote from one account counts once", as a unique constraint.
 *
 * This table exists because `target_actor` cannot express it. That table keys
 * `(target_id, account_id, kind)` where `target_id` references `target`, whose kind
 * is `blueprint | card | term` — there is no `note` member, so `target_actor` with
 * `kind = "note_vote"` constrains one vote per account per *blueprint*: it refuses an
 * account's vote on a second note under the same blueprint, and never notices two
 * votes on one note. The grain is wrong in both directions (D-05-02, ruled).
 */
export const noteVote = pgTable("note_vote", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => note.id),
  accountId: uuid("account_id").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("note_vote_note_account_key").on(t.noteId, t.accountId),
]);

/* --------------------- run_report (T180, B-16) --------------------- */

/**
 * A run that happened on somebody else's machine, keyed by the release digest the
 * CLI submitted (B-16).
 *
 * `reported_at` is the caller's timestamp, from the report; `created_at` is when the
 * registry accepted it. Both, because B-16 says the report carries a time and the
 * platform never claims to have observed the run — collapsing them would make an
 * accepted-at read as an observed-at, which is the one thing this table must not
 * imply. No column is named as a measurement (T180 AC6): the word is `reported`, and
 * `cost_units` is what a caller submitted rather than anything read off a meter.
 *
 * `cost_units` is `numeric` rather than a float because it is a decimal quantity
 * supplied by a caller and B-16's promise is that the registry stores what it was
 * given; `double precision` cannot round-trip every decimal the CLI can send.
 *
 * **Unqualified, with no precision or scale, and D-05-09 is why.** It shipped as
 * `numeric(18, 6)` — which reintroduces the exact failure the paragraph above rejects
 * `double precision` for, and does it silently: `0.0000001` stores as `0.000000` and
 * `0.1234567` as `0.123457`. A submitted cost can become **no cost at all**, with no
 * error, and it then feeds T180's median and p10/p90 where nothing can see it.
 *
 * The general form, because it is not about this column: **a bound that truncates
 * rather than refuses converts a rejectable input into a wrong number.** A refusal is
 * loud and the caller can recover; a truncation is silent and lands in an aggregate.
 * Bounding caller-supplied numeric is defensible — but then the bound is published and
 * it refuses explicitly, rather than being a rounding rule nobody stated.
 *
 * `account_id` is the submitting account, for T180's AC5 — a report on one's own
 * blueprint is accepted and aggregated but must not count toward T130's `validated`,
 * which needs an account to filter on. It is **not** in T005's Published signatures
 * block, which lists no submitter; carried here because AC5 is unimplementable
 * without it, and reported as D-05-07 rather than added silently.
 *
 * **`release_digest` is not a foreign key** (D-05-01, ruled). AC4 asked for one and
 * Postgres refuses it: `release.digest` carries a non-unique index, and the unique
 * constraint that would let it be referenced is closed twice over — AC7 forbids
 * altering `release`, and `bundleDigest({ dot, cardDigests })` reads neither owner nor
 * slug nor version, so an unchanged T110 fork yields a second release at the same
 * digest and uniqueness would make that fork unpublishable. `run_report_release_exists`
 * (migration 0002) raises `foreign_key_violation` — SQLSTATE 23503, the code a real
 * foreign key raises — so a consumer branching on the code cannot tell them apart, and
 * the criterion's own standard is met exactly: it fails at the driver.
 *
 * The trigger fires on insert and update only, so deleting the last release at a
 * digest orphans its reports where a foreign key would refuse. Guarding that needs a
 * trigger on `release`, which AC7 forbids; it is recorded against T120, the task that
 * first deletes a release.
 */
export const runReport = pgTable("run_report", {
  id: uuid("id").primaryKey().defaultRandom(),
  releaseDigest: text("release_digest").notNull(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  model: text("model").notNull(),
  provider: text("provider").notNull(),
  hardware: text("hardware").notNull(),
  inputSize: integer("input_size").notNull(),
  harnessVersion: text("harness_version").notNull(),
  costUnits: numeric("cost_units").notNull(),
  durationMs: integer("duration_ms").notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  /* `reportedCost` aggregates every report at one digest, which is this index. */
  index("run_report_release_digest_idx").on(t.releaseDigest),
  index("run_report_account_id_idx").on(t.accountId),
]);

/* --------------------- api_key (T230, B-17) --------------------- */

/**
 * `token_hash` is the only trace of the secret, which `issueKey` returns exactly once
 * and `ApiKeyRecord` deliberately has no field for. Storing a hash rather than the
 * secret is what makes that structural instead of a rule somebody remembers, and it
 * is unique because `resolveKey(db, secret)` looks a presented key up by hashing it.
 *
 * `ApiKeyRecord.keyId` is this row's `id`: the block publishes no separate public
 * identifier, and `revokeKey(db, actor, keyId)` addresses the row.
 *
 * `revoked_at` is the revocation state, nullable rather than a `revoked` boolean
 * because "when" is worth keeping and "whether" is derivable from it. Nothing here
 * can deliver T230's AC4 — "a revoked key is refused immediately" is a prohibition on
 * caching `resolveKey`, a property of that module and not of this table.
 */
export const apiKey = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("api_key_token_hash_key").on(t.tokenHash),
  index("api_key_account_id_idx").on(t.accountId),
]);
