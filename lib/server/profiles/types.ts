/* ============================================================
   DarkPrint backend — the profile record
   D-130-06, the owner's scope cut of 2026-08-20. The record this
   task ships is the COUNTABLE half of what
   `lib/data/profiles.ts:33-60` fixtures.

   `watchers`, `support` and `pinned` were removed because no
   column holds them — measured over all 125 columns across all 16
   tables, with `target_kind` (`blueprint|card|term`) and
   `target_actor_kind` (`star|note_vote`) unable to name an account
   as a target or a follow as an act. `validated` was removed
   because D-130-01 makes it a COUNT, which depends on T180's run
   reports. `counts.cards` was removed by D-130-04, because
   `CardSummary` carries no owner and re-implementing T080's
   visibility filter against `card_version` is the one thing this
   task's inherited-read-semantics paragraph exists to prevent.

   The follow-up task inherits all four and owes the tables before
   it owes the behaviour. Nothing here is a placeholder for them:
   an absent field is why a caller cannot read a fabricated one.

   **`counts.cards` IS BACK, and the block above is why it took an
   amendment to a merged task rather than a line here (T132).**
   D-130-04 was never a rule against the figure; it was a rule
   against WHERE the figure could come from. D-132-02 ruled the
   reading — cards this handle OWNS and the actor may see, not
   cards the index carries for it, because the two differ by a row
   no release pins and a count that drops one is quietly short — and
   T080 published `cardsOwnedBy` to serve it. So the visibility
   decision still has exactly one author, one module over, and this
   file consumes it the same way it consumes `blueprints()`.
   `watchers`, `support`, `pinned` and `validated` stay out.
   ============================================================ */

import type { PublicAuthor } from "@/lib/server/accounts";

/**
 * One handle's public profile, as of this request and this actor.
 *
 * **`counts` is computed at read time and is not a column (AC1).** The contract's own
 * sentence — *anything countable is counted, never stored as a counter* — is the reason
 * rather than a preference: a stored count satisfies every criterion in this task and
 * drifts silently the first time a bundle is deleted, transferred (T120) or made private,
 * and nothing reds when it does.
 *
 * **The record is a function of the ACTOR as well as the handle (AC2)**, because an owner
 * sees their own private bundles and a visitor does not. That is why no value here may be
 * memoised on `handle` alone: a process-level cache keyed that way serves the owner's
 * counts to a visitor, which is the private-row leak B-13 exists to prevent, arriving
 * through a cache rather than through a query.
 */
export interface ProfileRecord {
  author: PublicAuthor;
  joinedAt: Date;
  counts: { blueprints: number; cards: number; terms: number };
}
