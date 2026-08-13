-- Reverse of 0001_init.up.sql, table drops in dependency order (children before the
-- parents they reference) so this runs cleanly without CASCADE.
DROP TABLE IF EXISTS "target";
DROP TABLE IF EXISTS "release";
DROP TABLE IF EXISTS "ontology_term";
DROP TABLE IF EXISTS "ontology_version";
DROP TABLE IF EXISTS "handle_reservation";
DROP TABLE IF EXISTS "card_version";
DROP TABLE IF EXISTS "bundle";
DROP TABLE IF EXISTS "audit";
DROP TABLE IF EXISTS "account";

DROP TYPE IF EXISTS "public"."visibility";
DROP TYPE IF EXISTS "public"."target_kind";
DROP TYPE IF EXISTS "public"."audit_decision";
DROP TYPE IF EXISTS "public"."actor_kind";

-- The extension is left in place deliberately: dropping it is a decision about the
-- database, not about this migration's own tables, and another migration may already
-- depend on it existing by the time this one is ever rolled back.
