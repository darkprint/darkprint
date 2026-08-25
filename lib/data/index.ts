/* ============================================================
   DarkPrint data — the plain re-export barrel

   `SEED_BLUEPRINTS`, `FEATURED_BLUEPRINTS` and `PLATFORM_STATS` lived
   here — three counters derived off `@/lib/content` for a homepage
   section, `SectionDoors.tsx`, that a later commit deleted and
   replaced with `SectionLifecycle.tsx` (static `.webp` art, no data).
   `docs/audit/REPORT.md`'s "PLATFORM_STATS cluster" traced the same
   evidence and the owner answered Q1 "no, don't revive"; this branch
   had not picked that up. Removed rather than left orphaned — the two
   comments in `components/hero/Hero.tsx` and `Wordmark.tsx` that
   still cite this file as their home are the audit's, not this
   barrel's, to correct.

   What is left is a straight re-export, not a derivation, so nothing
   here reaches the filesystem: `./users`, like `./community`, is
   plain data and importable from a client component. A caller wanting
   `AUTHOR_LIST` or `getAuthor` may still take it from this barrel or
   from `./users` directly — both resolve to the same module.
   ============================================================ */

export { AUTHOR_LIST, getAuthor } from "./users";
