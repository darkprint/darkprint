-- Reverse of 0009_drop_ontology_versioning.up.sql.
--
-- ══════════════════════════════════════════════════════════════════════════
-- THIS DOWN MIGRATION LOSES DATA, AND HERE IS EXACTLY WHICH.
--
-- It restores the SHAPE of what 0009 dropped and none of the CONTENT. After
-- running it you have an empty `ontology_version`, an empty `ontology_term`,
-- and a `release.scored_ontology_version_id` that is NULL on every row --
-- including rows that carried a value before 0009 ran.
--
-- The irrecoverable fact is which published vocabulary each stored score was
-- computed under, as a foreign key. Nothing in the database remembers it after
-- 0009, because the column WAS the memory. A down migration cannot invent it
-- and this one does not try: writing a plausible id back into every row would
-- be worse than leaving NULL, since NULL is readable as "not known" and a
-- fabricated id is readable as a fact.
--
-- Say so here rather than leave a reader to discover it. The owner approved
-- this trade with it in front of them. What makes it survivable: the version
-- string is also stamped inside the score itself, at
-- `release.autonomy ->> 'ontologyVersion'`, which is the copy every reader in
-- `lib/server/**` has always used. So a rollback loses the redundant foreign
-- key and not the answer to "which vocabulary scored this release" -- read the
-- jsonb. If `release.autonomy` is NULL on a row, that row never had a score and
-- so never had a version either, and the NULL column is then correct rather
-- than lossy.
--
-- ONE SHAPE DIFFERENCE THIS CANNOT AVOID, NAMED SO IT IS NOT MISTAKEN FOR A BUG.
-- `scored_ontology_version_id` comes back as the LAST column of `release`
-- rather than in its original position before `created_at`. `ALTER TABLE ... ADD
-- COLUMN` appends, and Postgres has no way to insert a column at an ordinal.
-- No instrument in this repository reads `ordinal_position` -- `shapeOf` and
-- `readCatalogue` in `tests/server/t005/catalogue.ts` both order BY it or by
-- name and neither records it -- so the round trip still compares equal. It is
-- written down because "equal to every check we own" is not the same claim as
-- "identical", and the next person to add an ordinal-aware check should find
-- this paragraph rather than a surprise.
-- ══════════════════════════════════════════════════════════════════════════
--
-- Rebuilt in dependency order, the mirror of the up script's drops: parent
-- table, then the child that references it, then the column on `release`.
-- Every object is recreated under the name `0001_init.up.sql` gave it --
-- constraint names and index names included -- because `reversibility.test.ts`
-- rolls this pair back one step at a time and compares `pg_constraint.conname`
-- and `pg_indexes.indexname`, so a differently-named but structurally identical
-- constraint reds there and reds correctly.
create table "ontology_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
create table "ontology_term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ontology_version_id" uuid NOT NULL,
	"term_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
alter table "ontology_term" add constraint "ontology_term_ontology_version_id_ontology_version_id_fk" foreign key ("ontology_version_id") references "public"."ontology_version"("id") on delete no action on update no action;
create unique index "ontology_version_version_key" on "ontology_version" using btree ("version");
create unique index "ontology_term_version_term_key" on "ontology_term" using btree ("ontology_version_id","term_id");
alter table "release" add column "scored_ontology_version_id" uuid;
alter table "release" add constraint "release_scored_ontology_version_id_ontology_version_id_fk" foreign key ("scored_ontology_version_id") references "public"."ontology_version"("id") on delete no action on update no action;
