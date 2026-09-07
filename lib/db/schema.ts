/* ============================================================
   DarkPrint backend — Postgres schema
   The index half of B-01 (bytes live in S3, keyed by digest; the
   index lives here). Covers the ten tables named in T000's
   contract: account, handle_reservation, bundle,
   release, card_version, ontology_version, ontology_term, target,
   target_actor, audit -- of which `ontology_version` and
   `ontology_term` were dropped by 0009 and are the two this file no
   longer declares, for the reason kept at their old position below.
   Every later task's `Owns` list excludes this file, so what is not
   here has to be added by amending T000's contract, not by editing
   this file from another worktree.

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
  vector,
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

/* --------------------- ontology_version / ontology_term: DROPPED (0009) --------------------- */

/* ── TWO OF T000's TEN CONTRACT TABLES ARE GONE, AND THIS IS WHERE THEY WERE ──
   `ontology_version` and `ontology_term` held published versions of the core vocabulary so
   a release could be resolved against the version its manifest named. Nothing ever consumed
   that. The registry now keeps ONE vocabulary, the Attractor spec language's, so there is no
   second version for a row here to name. `CORE_ONTOLOGY` in the process is that vocabulary,
   and `deprecated: {since, replacedBy}` is how a term is retired inside it.

   This note stays although the code it described is gone, because the header of this file
   still enumerates T000's ten tables by name and a reader who counts them finds eight. It is
   the divergence that needs explaining, not the absent declarations.

   `0009_drop_ontology_versioning` is the migration, and its up script carries the reasoning
   and the ordering the foreign keys forced. Its down script restores the shape and cannot
   restore the rows; the owner approved that trade having been shown it. */

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
  /**
   * 0007_drafts (T280): GitHub-style creation. B-06's "a bundle first exists at
   * its first publish" is relaxed rather than replaced — a bundle may now also
   * first exist at draft creation, the empty-repo analogy, with zero releases.
   * All five nullable: every bundle `publish()` still creates directly carries
   * none of them, and once a release exists its own manifest stays the
   * authoritative title/summary — this column set is never a second copy of it.
   * A release-first bundle's columns stay NULL forever.
   */
  title: text("title"),
  summary: text("summary"),
  description: text("description"),
  category: text("category"),
  tags: text("tags").array(),
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
   * **This comment used to describe the column as a bare array of terms, and that is the shape
   * both readers refuse.** D-90-03 moved the column to `{ text, terms }` so `exportBundle`
   * could write the author's own bytes into a folder unaltered, and it ruled — correctly —
   * that the column type and this file needed no change. What it left behind was this line,
   * and it was not inert: a bare array is what following it produces, and that is what T130's
   * blind author stored. Recorded because the tree's account of that incident was "two authors
   * guessed incompatibly from nothing", and the truth is that one of them read the only
   * documentation there was (D-133-02 F1).
   *
   * **The old spelling is described here rather than quoted, and putting it back is a
   * regression rather than a clarification.** A check greps this docblock for that type name,
   * so a docblock that quotes it reads identically to the docblock that once documented it —
   * and the one instrument that can see this defect's removal then cannot tell it from the
   * defect. It is `lib/server/archive/errors.ts`'s argument in this file: a mechanically
   * checkable clause is worth having *because* it is absolute, and an exception for the
   * mention we meant to keep costs exactly what an exception for the field we meant to
   * publish would.
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("release_bundle_version_key").on(t.bundleId, t.version),
  index("release_digest_idx").on(t.digest),
]);

/* --------------------- card_version (B-04, B-07) --------------------- */

/**
 * One row per `(cardId, version)`, immutable to every write path in `lib/server/**` (T020):
 * nothing in the product updates `body`, `source` or `digest` after the insert. That is a
 * property of the writers rather than of the table, and the distinction is not academic.
 * Commit ed3ae85 updated all 58 rows in place from a migration script, which is how the
 * embedding tables came to hold vectors for text their subject no longer contained. Read
 * `releaseEmbedding` before relying on this row's contents being fixed. `digest` is
 * `cardDigest` —
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
   Column names and shapes are T005's Published signatures block,
   which is this task's whole acceptance surface: it
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
 * What a key is allowed to do (migration `0010_key_scope`, owner ruling 2026-09-05).
 *
 * A type rather than `text` plus a check constraint, following the five enums `0001_init`
 * declares, and it buys the property this column exists for: an unrecognised scope is
 * unrepresentable, so no row can carry a value a reader has to decide how to interpret.
 * That matters here more than anywhere else in this file, because the reader is an
 * authorization decision.
 *
 * `"read"` is FIRST and it is the default, which is the grandfathering rule expressed as a
 * column property. `ApiKeys.tsx` has told every holder so far that a key "authorizes no
 * write", and the ruling is that the sentence stays true of every key already minted for
 * that key's whole life. A default of `"read"` stamps it onto every existing row in the one
 * statement that adds the column, and it keeps a writer that has not learned about scopes
 * minting the least privilege rather than raising a NOT NULL violation.
 *
 * Two labels, and a third costs two migrations rather than one: `lib/db/migrate.ts` wraps
 * each migration in BEGIN/COMMIT, and Postgres forbids USING a label added by
 * `ALTER TYPE ... ADD VALUE` until that transaction commits. Named here because the cost is
 * paid by whoever adds the third scope, not by this change.
 */
export const apiKeyScope = pgEnum("api_key_scope", ["read", "write"]);

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
 *
 * `scope` is NOT NULL with a default, so a row cannot be ambiguous about what its key
 * may do and a row written before `0010_key_scope` reads as `"read"` rather than as
 * absent. It is the authority on the grant; `revoked_at` is the authority on liveness,
 * and `writeActorFor` in `lib/server/limits/keys.ts` reads both off this row at the
 * moment of the write rather than trusting a value read earlier.
 */
export const apiKey = pgTable("api_key", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  tokenHash: text("token_hash").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  /* Last, matching the physical order `ALTER TABLE ... ADD COLUMN` produced. Postgres has
     no way to insert a column at an ordinal, so a declaration ordered by what reads well
     would disagree with every catalogue dump of this table. */
  scope: apiKeyScope("scope").notNull().default("read"),
}, (t) => [
  uniqueIndex("api_key_token_hash_key").on(t.tokenHash),
  index("api_key_account_id_idx").on(t.accountId),
]);

/**
 * T200's vectors (B-12), and the reason they are TABLES rather than a column on `release`
 * and `card_version`.
 *
 * The first version of this put a nullable `embedding` on each of those two directly. Both
 * are in T005's `BASE_TABLES`, and `tests/server/t005/existing.test.ts` holds the delta over
 * those ten to exactly one licensed cell — *"an alteration to a table eight merged tasks
 * already query, and nothing downstream would find out until it broke"*. It redded, and
 * widening the licence would have been negotiating with the instrument.
 *
 * **The separate table is better on its own terms, which is how you can tell the guard was
 * right rather than merely in the way.** `embedding` is `NOT NULL` here, so a row exists **if
 * and only if** that release has been embedded: *never embedded* is the ABSENCE of a row
 * rather than a null inside one, and the state is representable exactly once. As a column it
 * was a nullable field whose null carried that meaning by convention. Nothing eight merged
 * tasks already `select` from gains a field. And `onDelete: "cascade"` keeps a vector from
 * outliving a DELETED subject, which is narrower than the claim this docblock used to make:
 * it says nothing about a subject that is UPDATED, and see the paragraph below for the day
 * that distinction stopped being academic.
 *
 * **AC6's idempotency USED TO read the row's presence and need no second column, and that
 * argument has been falsified rather than merely revised.** It ran: a `release` row is
 * content-addressed, `digest` is derived from the bytes so it cannot change, therefore a row
 * here is already a vector for that digest. The premise is that the described row is never
 * rewritten. Commit ed3ae85 rewrote 58 `card_version` rows and 16 `release` rows IN PLACE
 * under unchanged primary keys, moving `body`, `manifest` and every digest; `onDelete:
 * "cascade"` could not fire because nothing was deleted, and the 42 card and 7 release
 * vectors outlived a content change to their subjects. They happened to stay correct only
 * because that migration moved fields outside `cardText`/`manifestText`, which is a fact
 * about which fields it touched and not a property anything here guarantees.
 *
 * `embedded_input_sha256` (0008) is the second column that failure argued for, and it is
 * deliberately NOT the `embedded_digest` the paragraph above rejected. That objection was
 * right and is kept: a column mirroring a CURRENT value can only agree or be a bug, and
 * `release.digest` is the wrong value twice over, since `bundleDigest` hashes
 * `{dot, cardDigests}` with no manifest in it while this vector is nothing but manifest
 * fields. This column records a PAST value, the identity of the exact input handed to the
 * encoder, so disagreement with today's input is the signal rather than the defect. It is
 * nullable because a row written before 0008 has no honest value to carry: NULL is
 * *provenance unknown*, which `reembedRelease` repairs the same way it repairs disagreement.
 *
 * **384 is a decision, not a default:** pgvector refuses an index on a column declared
 * without a dimension, so the width had to be chosen before anything could be indexed, and
 * changing it later rewrites every row. It is the width of the common small sentence
 * encoders, which is what keeps swapping the derivation for a real provider a drop-in.
 *
 * Indexed `vector_cosine_ops` in `0003_search.up.sql`. **`vector_l2_ops` would rank by
 * magnitude, which for token counts is document LENGTH** — an ordering that looks plausible
 * and puts a long document above a relevant one.
 */
export const releaseEmbedding = pgTable("release_embedding", {
  releaseId: uuid("release_id")
    .primaryKey()
    .references(() => release.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 384 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  embeddedInputSha256: text("embedded_input_sha256"),
});

/** The card half of T200's vectors. Same shape and same reasons as `releaseEmbedding`. */
export const cardVersionEmbedding = pgTable("card_version_embedding", {
  cardVersionId: uuid("card_version_id")
    .primaryKey()
    .references(() => cardVersion.id, { onDelete: "cascade" }),
  embedding: vector("embedding", { dimensions: 384 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  embeddedInputSha256: text("embedded_input_sha256"),
});

/* ============================================================
   T131 — follows, pins and per-account support

   Three tables and one new enum type, appended under D-131-03's
   migration coordinates (`0004_social`; T190 holds `0005`) so two
   schema-extending tasks in flight together cannot collide on a
   number. A textual conflict here at whichever merge lands second
   is expected and is the orchestrator's to resolve.

   ── extension means NEW, and that is a ruling rather than a taste ──
   D-131-02. The section this implements says `target_kind` and
   `target_actor_kind` "both need an `ALTER TYPE`", and the merged
   code corrects it: T005 AC7's guard reds any base enum that
   gained, lost or reordered a label, and its comment names these
   two as the exact temptation — `target_kind` gaining a member
   widens what every merged task's `target` rows may hold. So a
   follow is its OWN table with both sides accounts, rather than a
   `target_actor` row pointing at an account it cannot name.

   ── and not one counter column, which is the whole inheritance ──
   `watchers` and `support` are `count(*)` over the rows below.
   T130's AC1 travels here unchanged: anything countable is
   counted, never stored as a counter. A `watchers integer` on
   `account` would satisfy every sentence in the section and drift
   the first time an account is deleted, with nothing to red.
   ============================================================ */

/** The two arms of `lib/data/profiles.ts:29`'s `PinnedRef`, and NOT `target_kind`'s set — that one is frozen (D-131-02), and it differs by a member besides: `card`/`term` against `node`. */
export const pinKind = pgEnum("pin_kind", ["blueprint", "node"]);

/* --------------------- follow (T131, AC4) --------------------- */

/**
 * One row per `(follower, followed)`, both accounts. `watchers` is the count of
 * rows for one `followedId` and is never a column, per AC1's inherited clause.
 *
 * The unique index IS the idempotency guarantee rather than an index on top of
 * one — T005's reasoning for `save`, and the reason `toggleFollow` cannot
 * double-count under two concurrent callers the way a `SELECT`-then-`INSERT`
 * would.
 *
 * **NO ACTION on both sides, and the CASCADE that stood here was REVOKED at
 * D-131-11 after a merged guard caught it.** I argued for the cascade on the
 * grounds that AC4's derived-versus-stored discriminator needs a FOLLOWER's
 * account row deleted behind the module's back, and the premise was false:
 * **T120 never deletes an account row — D-120-01 rules the tombstone precisely
 * BECAUSE the structure refuses the delete**, so a cascading key removes the
 * structural fact that ruling rests on, and `tests/server/t120/instruments.test.ts`
 * reds naming all five keys.
 *
 * **The discriminator does not need it and never did.** T130's blind author
 * could not separate a derived count from a counter because **no follow table
 * existed** (`test/t130-profiles` `32556b7`, `follow.test.ts`'s header, which
 * reported the hole and declined to fake it). This table is the fix: a cell
 * deletes a row from `follow` directly and watches `watchers` move, touching
 * `account` not at all. The cascade bought a fixture for a state the product
 * cannot reach, at the cost of a merged task's premise.
 */
export const follow = pgTable("follow", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id").notNull().references(() => account.id),
  followedId: uuid("followed_id").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("follow_follower_followed_key").on(t.followerId, t.followedId),
  /* The counted direction. The unique index leads with `follower_id`, which is
     what idempotency needs; `watchers` reads the other column on every profile
     load. `run_report_account_id_idx` is the merged precedent. */
  index("follow_followed_id_idx").on(t.followedId),
]);

/* --------------------- profile_pin (T131, AC3) --------------------- */

/**
 * At most two, which is what the two-column grid holds.
 *
 * `position` carries the ORDER, which the union does not: `pinned` is an array
 * whose first entry is the first card drawn, and a set with no order redraws a
 * profile differently on each read. The unique index on `(accountId, position)`
 * is what makes a slot hold one pin.
 *
 * `kind`/`ref` are `lib/data/profiles.ts:29`'s `PinnedRef` spelled into columns
 * (D-131-01): a `blueprint` pin's `slug`, or a `node` pin's canonical
 * `id@version`. The union is imported by the module and never restated, so a
 * drift is a compile error rather than a quietly empty array.
 *
 * **`ref` has no foreign key, and that is deliberate.** AC3 makes an
 * unresolvable pin ABSENT from the read, so every AC3 cell needs a stored pin
 * whose target is then removed — and a reference, or a write-time resolution
 * check, would make that fixture unbuildable and the criterion undrivable
 * through the published surface (D-131-04's A7: a write-time guard removes the
 * reader's witnesses). Resolution and the actor filter both happen in
 * `getProfile`, which is where the criterion can be observed.
 *
 * The max of two is `setPins`' to refuse and is not written here as a check. It
 * is a published arity bound rather than a shape the storage enforces, and
 * pinning it in the DDL would leave the module's own refusal unfalsifiable —
 * the driver would answer first, with a store fault in place of a refusal.
 */
export const profilePin = pgTable("profile_pin", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  position: smallint("position").notNull(),
  kind: pinKind("kind").notNull(),
  ref: text("ref").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("profile_pin_account_position_key").on(t.accountId, t.position),
]);

/* --------------------- account_support (T131) --------------------- */

/**
 * Community support for a PERSON — one row per supporter, `support` derived by
 * count. The subject being an account is what separates this from every star in
 * the archive, and three merged surfaces say so: the fixture's own docblock
 * (`lib/data/profiles.ts:41-44`, "the same seeded figure `FavoriteStar` prints
 * beside a blueprint"), `ProfileHeader.tsx:174` ("at the one place on the site
 * where the subject is a person rather than a bundle"), and
 * `ProfileShell.tsx:76-78`, which computes the fold over this handle's items as
 * `stars` and passes `support` through untouched.
 *
 * **So it is NOT the sum of stars on the handle's blueprints and cards.** Those
 * are a different figure that the same page already draws beside it, and
 * conflating the two is a defect rather than a saving (D-131-05).
 *
 * **This is not a second copy of T150's decision.** `CounterTargetKind` IS
 * `target_kind`, so `toggleStar` cannot name an account either without the
 * `ALTER TYPE` D-131-02 forbids — the door is shut on both sides, which is why
 * the table is here rather than a widening one module over.
 */
export const accountSupport = pgTable("account_support", {
  id: uuid("id").primaryKey().defaultRandom(),
  supporterId: uuid("supporter_id").notNull().references(() => account.id),
  supportedId: uuid("supported_id").notNull().references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("account_support_supporter_supported_key").on(t.supporterId, t.supportedId),
  /* The counted direction, for `follow_followed_id_idx`'s reason. */
  index("account_support_supported_id_idx").on(t.supportedId),
]);

/* ============================================================
   T190 — notifications (D-190-01, extension only)

   Appended under D-190-01's bounds: NEW tables and a NEW enum
   type, nothing altered. The ten base tables and the five base
   enums are untouched, so `tests/server/t005/existing.test.ts`
   measures the same delta it measured yesterday — its AC7 cell
   diffs only `BASE_TABLES`, and its enum cell compares only the
   five in `baseline.json`.

   `account.notification_preferences` already exists and needed no
   migration: T000 shipped it `jsonb NOT NULL DEFAULT '{}'` with a
   comment reserving it for this task. This task owns its SHAPE,
   which is why the shape lives in `lib/server/notifications` as
   four booleans over a published default rather than as four
   columns here.
   ============================================================ */

/**
 * The four events `lib/data/account.ts:92-117` seeds, in that file's own order.
 *
 * Declared semantically rather than alphabetically, which is the house style for four of
 * the five base enums. `tests/enum-declaration-order.test.ts` pins `target_kind` alone and
 * for a reason that does not reach here: **nothing sorts this column in SQL.** The unique
 * index below is an equality lookup, and the drain orders by `created_at`. A later reader
 * that does sort it must cast to text, exactly as D-140-10 made `saves` do.
 */
export const notificationKind = pgEnum("notification_kind", ["repin", "fork", "deprecation", "digest"]);

/* --------------------- notification_queue (T190, B-19) --------------------- */

/**
 * One row per notification owed to one account, and **the row IS the idempotency**
 * (D-190-01). The unique key is `(kind, account_id, subject_digest)` and `enqueue` inserts
 * with the conflict caught, so a fan-out retried after a partial failure inserts nothing
 * twice — AC5 without a status column and without a counter, which is the shape that passes
 * sequential tests and double-delivers under concurrent workers.
 *
 * `subject_digest` is `contentDigest(canonicalJson(subject))`, both published from
 * `@/lib/core`. **No digest is authored here.** `Record<string, string>` has no canonical
 * byte form of its own, so two spellings of one subject would otherwise be two rows;
 * `canonicalJson` sorts keys by code unit and is what makes them collide.
 *
 * `subject` is kept BESIDE its digest rather than derived back out of it: a digest is
 * one-way, and `deliverPending` has to hand the subject to the mailer. The pair is not two
 * sources for one fact — the digest is the key, the jsonb is the payload, and only the
 * digest is ever compared.
 *
 * **`delivered_at` is a drain cursor, not a retry state machine** (D-190-02). D-190-01
 * forbids "a status column and a counter" — a mechanism that decides whether to send again
 * by counting attempts. This column answers a different question, "has this row been handed
 * to the mailer yet", it is written exactly once, and it never counts. Rows are RETAINED
 * after delivery: deleting them would return the unique key to a state where the same event
 * re-enqueues, which is the idempotency AC5 rests on.
 */
export const notificationQueue = pgTable("notification_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: notificationKind("kind").notNull(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  subject: jsonb("subject").notNull(),
  subjectDigest: text("subject_digest").notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("notification_queue_kind_account_subject_key").on(t.kind, t.accountId, t.subjectDigest),
  /* The drain's own query, which is `delivered_at is null order by created_at`. Partial, so
     the index holds only what is still owed rather than growing with every row ever
     delivered — the retention rule above is what makes that distinction worth having. */
  index("notification_queue_pending_idx")
    .on(t.createdAt)
    .where(sql`${t.deliveredAt} is null`),
]);

/* --------------------- unsubscribe_token (T190, AC6) --------------------- */

/**
 * AC6's working unsubscribe, STORED rather than signed (D-190-01).
 *
 * "No longer valid" needs revocation; a row deleted on use IS revocation. A signed token
 * would put key management on a task with no key owner, and would have no way to stop being
 * valid.
 *
 * **Its own table, not a column on the queue row** (D-190-03). A token deleted on use would
 * take the queue row with it, and that row is the idempotency key AC5 rests on — the two
 * lifetimes are genuinely different and a shared row cannot hold both.
 *
 * Unique on `(account_id, kind)` rather than one token per email: `enqueue` reuses the
 * account's existing token for that kind, so every email about one kind carries one link.
 * The link names the KIND and never the account (AC6) — `token` is opaque and this row is
 * the only thing that resolves it.
 */
export const unsubscribeToken = pgTable("unsubscribe_token", {
  token: text("token").primaryKey(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  kind: notificationKind("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("unsubscribe_token_account_kind_key").on(t.accountId, t.kind),
]);

/* ============================================================
   Federated sign-in identities (0006_identities)

   A second provider could not be added by widening `account`:
   `github_id` is NOT NULL and unique, and the ten base tables'
   column shape is frozen by `tests/server/t005/existing.test.ts`
   with one licensed delta. So identity moved OUT to its own table
   and `account` was left untouched — an extension, the same shape
   T131 and T190 took.

   `account.github_id` therefore keeps holding a value for every
   account, GitHub-authored or not. That is not new: `lib/server/
   seed/run.ts` has always written `"0"` there for the registry
   actor, which is not a GitHub id either. For an account whose
   first provider is Google it holds `google:<sub>` — namespaced so
   it cannot collide with a real GitHub id, and inert, because THIS
   table is what every sign-in resolves against.
   ============================================================ */
export const accountIdentity = pgTable("account_identity", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** `"github" | "google"` — text rather than an enum, so a third provider is data. */
  provider: text("provider").notNull(),
  /** The provider's own stable subject id. Never an email: emails move between people. */
  providerId: text("provider_id").notNull(),
  accountId: uuid("account_id").notNull().references(() => account.id),
  /** The address the provider asserted AT LINK TIME, kept as the record of why two
      identities were joined. Never read as the account's current email. */
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  /* The constraint the upsert races against, rather than a read-then-write: two concurrent
     first sign-ins for one provider identity leave one row, and the loser reads it. */
  uniqueIndex("account_identity_provider_key").on(t.provider, t.providerId),
  index("account_identity_account_id_idx").on(t.accountId),
]);
