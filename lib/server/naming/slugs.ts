/* ============================================================
   DarkPrint backend — naming: bundle slugs
   B-09: a slug is unique **per owner**, so two owners may both
   hold `frontline-triage` (AC2) and one owner may not hold it
   twice (AC3). The uniqueness itself is `bundle_owner_slug_key`'s
   and is enforced where the bundle is created, which is T100's —
   creating the bundle is out of scope here. What this file
   answers is whether a name is available, against the same
   `(owner_id, slug)` pair that index is declared on.

   AC1's four reserved slugs are read from `components/profile/tabs.ts`
   through `./reserved` rather than restated, so a fifth profile
   tab is a fifth reserved slug with nothing to remember.

   The grammar check runs before the driver is reached, for the
   reason `./handles.ts` gives at length: `slug` is a `text`
   column, and a `SELECT` parameter carrying an unpaired surrogate
   is sent as U+FFFD, so the answer would be about a name nobody
   typed and "free" would be the likeliest wrong answer.
   ============================================================ */

import { and, eq, inArray } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { namingStoreError } from "./errors";
import { isNameSegment } from "./grammar";
import { isReservedSlug } from "./reserved";
import { firstFreeSuggestion, firstWindow } from "./suggest";
import type { Availability } from "./types";

/** Which of `slugs` this owner already has a bundle at, in one statement. */
async function existingSlugs(db: Db, ownerId: string, slugs: readonly string[]): Promise<Set<string>> {
  if (slugs.length === 0) return new Set();
  try {
    const rows = await db
      .select({ slug: schema.bundle.slug })
      .from(schema.bundle)
      .where(and(eq(schema.bundle.ownerId, ownerId), inArray(schema.bundle.slug, [...slugs])));
    return new Set(rows.map((row) => row.slug));
  } catch (err) {
    throw namingStoreError("checkSlug", err);
  }
}

/**
 * `{ available: false }` for a reserved slug (AC1), for one this owner already holds
 * (AC3), and for a value that is not a legal slug at all. A different owner holding
 * it is not consulted, which is AC2: the query is scoped to `ownerId`, matching the
 * `(owner_id, slug)` the unique index is declared on.
 *
 * Both refusals answer rather than throw, which is what makes AC1 and AC3 checkable
 * through the published surface: `checkSlug` returns `Availability`. The contract
 * also publishes `SlugTakenError` and `ReservedSlugError` with a `checkSlug:` prefix,
 * and those two cannot both be true of one function — reported in this task's Log
 * rather than resolved by inventing a control flow the signature contradicts.
 *
 * A candidate that is itself reserved is never suggested, and that is derived from
 * `isReservedSlug` rather than argued from the current four not being hyphenated.
 */
export async function checkSlug(db: Db, ownerId: string, slug: string): Promise<Availability> {
  /* D-70-14a: the grammar's refusal is its own reason, and it is the only one of the three
     the caller can fix by rewording the input. No `suggestion` goes with it. */
  if (!isNameSegment(slug)) return { available: false, reason: "illegal" };

  const admissible = (candidate: string): boolean => !isReservedSlug(candidate);
  const candidates = firstWindow(slug, admissible);
  const existing = await existingSlugs(db, ownerId, [slug, ...candidates]);
  const reserved = isReservedSlug(slug);
  if (!existing.has(slug) && !reserved) return { available: true };

  /* `reserved` wins when a row somehow exists at a reserved slug too. The tabs occupy that
     segment permanently, so it is the answer that stays true after the row is gone, and a
     caller told `taken` would reasonably wait for it to free up. */
  const reason = reserved ? "reserved" : "taken";
  /* D-70-18, same obligation as the handle side: both refusals here are well-formed names
     and both are owed a suggestion, so the search widens rather than stopping at one
     window. A candidate that is itself a profile tab is never offered, and that is derived
     from `isReservedSlug` rather than argued from the current four having no hyphen. */
  const suggestion = await firstFreeSuggestion(
    slug,
    admissible,
    (names) => existingSlugs(db, ownerId, names),
    { candidates, taken: existing },
  );
  return suggestion === undefined
    ? { available: false, reason }
    : { available: false, reason, suggestion };
}
