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

   **The shape is decided by `parseOntologyTerms`, not here.**
   `release.local_vocabulary` is `jsonb` and T010 publishes its
   input as `vocabulary?: unknown` (`archive/types.ts:31`), so the
   column's interpretation is held by no type anywhere and any
   caller of `addRelease` can store any shape. This file consumes
   `lib/content/ontology-file.ts`'s parser — the same one T090
   consumes — rather than writing a second opinion about what a
   stored vocabulary is. It is the shared standard, so it cannot
   disagree with itself.

   ── Where this DIVERGES from `lib/server/export/vocabulary.ts` ──
   That module's `storedVocabulary` is the only other reader of
   this column, it is NOT on T090's barrel, and it additionally
   requires `text` to be a string (D-90-03), refusing a release
   stored before that amendment. This file does not require `text`,
   because `text` exists so `exportBundle` can write the author's
   own bytes into a folder unaltered, and a COUNT emits no bytes.
   So a `{ terms }` row with no `text` is refused by T090 and
   counted here, deliberately.

   Said out loud because a cross-task divergence on a merged
   precedent is invisible to every instrument this run has — both
   suites stay green and only a session holding two modules at once
   sees it. The durable fix is T090 publishing its reader; this is
   reported, not worked around silently.

   A value the parser cannot read is REFUSED rather than skipped,
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
import { parseOntologyTerms } from "@/lib/content/ontology-file";
import { schema, type Db } from "@/lib/db";

import { MalformedStoredVocabularyError } from "./errors";

/** The name the parser's diagnostics quote. A column, since that is where the bytes are. */
const STORED_VOCABULARY = "release.local_vocabulary";

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
    let terms;
    try {
      terms = parseOntologyTerms(row.vocabulary, STORED_VOCABULARY);
    } catch (cause) {
      /* `getProfile`, not `countNamespacedTerms`: `operation` is the PUBLISHED reader
         throughout this module, and the ruling that the two wrapped statements share one
         name still holds. What distinguishes this condition from a store fault is the
         CLASS and its `type`, which is D-130-10's whole point — not the operation. */
      throw new MalformedStoredVocabularyError("getProfile", cause);
    }
    for (const term of terms) {
      if (term.id.startsWith(prefix)) ids.add(term.id);
    }
  }
  return ids.size;
}
