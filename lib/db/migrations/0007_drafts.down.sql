-- Reverse of 0007_drafts.up.sql. Exact inverse, columns dropped in reverse of
-- the order the up script added them.
alter table "bundle" drop column "tags";
alter table "bundle" drop column "category";
alter table "bundle" drop column "description";
alter table "bundle" drop column "summary";
alter table "bundle" drop column "title";
