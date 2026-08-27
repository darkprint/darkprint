/* ============================================================
   DarkPrint backend — counting a handle's namespaced terms
   AC1's third figure. A namespaced term is NOT a global row: the
   `ontology_term` table stores the curated core only, and
   `lib/db/schema.ts:121-125` says a bundle's own overlay "travels
   with the release that declares it (`release.localVocabulary`)".
   So the count is over releases, not over the ontology store —
   which is why `@/lib/server/ontology` is correctly not a
   dependency of this task. Measured rather than assumed:
   `content/ontology/extensions.yaml:24` is `lupo/pii-handling`,
   handle-namespaced, and it reaches the merged view as a release's
   overlay.

   ── Three readings this file takes, each with its reason ──

   **Visibility is INHERITED, never re-implemented.** The caller
   passes the slugs `blueprints(db, actor)` already returned, so
   which bundles an actor may see is decided by T080 and this
   module authors no second copy of `readable()`. That is D-130-04's
   ruling honoured rather than worked around: the thing forbidden
   there was a second visibility filter, and there is none here.

   **Every release counts, not only the current one.** Picking a
   current release means re-implementing D-80-03's highest-semver-
   tiebroken-on-row-id rule, and a second copy of THAT is the same
   hazard one table over. Counting every visible release needs no
   such rule, and it matches the question the figure answers —
   which terms this handle has published — rather than which are
   still pinned by a current release. Ids are de-duplicated, so a
   term carried across five releases counts once.

   **The shape is `StoredVocabulary`, and this file no longer has
   an opinion about it (D-132-02 C-7).**
   `release.local_vocabulary` is `jsonb`, and until T133 its
   interpretation was held by no type anywhere: T010 published the
   writer's input as `vocabulary?: unknown`, so any caller of
   `addRelease` could store any shape and three modules each read it
   their own way. T133 ended that — the column has one published
   shape, `StoredVocabulary`, and one published reading of it,
   `parseStoredVocabulary` on `@/lib/server/archive`, which
   `addRelease` and `lib/server/export/vocabulary.ts` already
   consume. This file consumes it too, so there is one reader of
   this column again.

   ── The divergence this file used to carry, and why it is gone ──
   It read the column through `parseOntologyTerms` directly and
   therefore did NOT require `text`, on the argument that `text`
   exists so `exportBundle` can write the author's own bytes into a
   folder unaltered while a COUNT emits no bytes. So a `{ terms }`
   row with no `text` was refused by T090 and counted here,
   deliberately, and D-130-07 upheld it.

   **D-132-02 withdrew that licence and the reading is now STRICT:
   such a row is not a `StoredVocabulary`, `addRelease` refuses to
   create one, and counting it is counting a row the column says was
   never legal.** The cost is real and is stated rather than
   discovered: a release stored in that shape BEFORE T133 published
   the type takes this handle's profile from a count to a refusal.
   That is the same cost D-130-07 priced in the other direction, and
   the difference is that the column now has an answer.

   A reader more permissive than its column is not a reader
   disagreeing about the shape, and D-132-01 would have allowed one
   here on condition it said so against `StoredVocabulary` by name.
   The licence went unexercised: there is no permissive branch to
   name, and this paragraph is the record that there was a choice.

   A value the reading cannot accept is REFUSED rather than skipped,
   which is the behaviour D-90-03 already ruled for this column.
   Skipping would make the count silently wrong, and a count that
   is quietly short is the failure AC1 exists to prevent, arriving
   through a parse rather than through a column.

   **It refuses with its OWN class (D-130-10), not as a store
   fault.** The shipped version sealed it through `withProfileStore`
   and rendered `the profile store failed.` — false about a store
   that had just answered, and the same relabelling `http.ts`
   refuses to do to foreign faults, committed one layer in by the
   file arguing against it. The parser's own message still must not
   travel: it quotes the offending entry's index and `kind`, which
   is stored content, so it lives on `cause` and nowhere else.
   ============================================================ */

import { and, eq, inArray } from "drizzle-orm";
import { parseStoredVocabulary } from "@/lib/server/archive";
import { schema, type Db } from "@/lib/db";

import { MalformedStoredVocabularyError } from "./errors";

/**
 * How many distinct `<handle>/…` terms this handle has published, across every release of
 * the bundles named by `slugs`.
 *
 * `slugs` is the visible set the caller already obtained from `blueprints(db, actor)`; an
 * empty one answers 0 without issuing a statement, because `inArray` over an empty list is
 * not a query anybody should have to reason about.
 */
export async function countNamespacedTerms(
  db: Db,
  accountId: string,
  handle: string,
  slugs: readonly string[],
): Promise<number> {
  if (slugs.length === 0) return 0;

  /* `eq(bundle.ownerId, accountId)` is LOAD-BEARING, not redundant beside the slug list.
     `bundle_owner_slug_key` is unique on `(ownerId, slug)` and NOT on `slug` — B-09 makes
     slugs unique **per owner** — so `inArray(bundle.slug, slugs)` alone reaches another
     owner's identically-slugged bundle and counts their vocabulary under this handle.
     Written here rather than in a thread because the person who would delete it as
     duplication is reading this line, not the thread. */
  const rows = await db
    .select({ vocabulary: schema.release.localVocabulary })
    .from(schema.release)
    .innerJoin(schema.bundle, eq(schema.release.bundleId, schema.bundle.id))
    .where(and(eq(schema.bundle.ownerId, accountId), inArray(schema.bundle.slug, [...slugs])));

  /* The prefix is built from the handle the caller asked for, which `getPublicAuthor` has
     already put through T070's grammar — so it cannot carry a separator and cannot match
     a second namespace by accident (D-70-16: a handle is one URL segment). */
  const prefix = `${handle}/`;
  const ids = new Set<string>();
  for (const row of rows) {
    /* D-130-10. The parser's own `Error` must not travel: its message quotes the offending
       entry's index and `kind`, which is stored content. Sealing it as a store fault was
       the shipped shape and it was wrong — the store answered, so naming it as failing is
       false about a component that was working, which is `http.ts`'s own argument about
       foreign faults arriving one layer in. Its own class, its own `type`. */
    let stored;
    try {
      stored = parseStoredVocabulary(row.vocabulary, "getProfile");
    } catch (cause) {
      /* `getProfile`, not `countNamespacedTerms`: `operation` is the PUBLISHED reader
         throughout this module, and the ruling that the two wrapped statements share one
         name still holds. What distinguishes this condition from a store fault is the
         CLASS and its `type`, which is D-130-10's whole point — not the operation. */
      throw new MalformedStoredVocabularyError("getProfile", cause);
    }
    /* `undefined` is the release declaring no local vocabulary, which is the ordinary case
       and contributes nothing — never an error, and never a skipped refusal either: the
       reading above has already refused everything that is neither absent nor the shape. */
    for (const term of stored?.terms ?? []) {
      if (term.id.startsWith(prefix)) ids.add(term.id);
    }
  }
  return ids.size;
}
