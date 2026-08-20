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
   through a parse rather than through a column. The parser's own
   message quotes the offending entry's index and `kind` — stored
   content — so it must never reach a caller unsealed, and the
   caller runs this inside `withProfileStore` for exactly that.
   ============================================================ */

import { and, eq, inArray } from "drizzle-orm";
import { parseOntologyTerms } from "@/lib/content/ontology-file";
import { schema, type Db } from "@/lib/db";

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
    for (const term of parseOntologyTerms(row.vocabulary, STORED_VOCABULARY)) {
      if (term.id.startsWith(prefix)) ids.add(term.id);
    }
  }
  return ids.size;
}
