-- Reverse of 0008_embedding_input.up.sql. Exact inverse, columns dropped in
-- reverse of the order the up script added them. Nothing else to undo: the up
-- script creates no table, no index and no type, and writes no row.
alter table "card_version_embedding" drop column "embedded_input_sha256";
alter table "release_embedding" drop column "embedded_input_sha256";
