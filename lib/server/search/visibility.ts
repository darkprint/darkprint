/* ============================================================
   DarkPrint backend — the one actor every read in this module uses
   D-200-06 and D-200-07, and this constant is the whole of AC4.

   AC4 excludes even the operator, which contradicts T060's default
   ON PURPOSE: search is a DISCOVERY surface, and an operator
   discovering private content by query is not the break-glass
   case. D-200-07 rules it strictly — public-only for every caller,
   an owner searching their own private work included, who reaches
   it through their own listing surfaces instead.

   ── Why this is a constant and not a filter ──
   `visibleTo` (T060) answers `"all"` for a genuine operator AND
   for the owner, and `registry/snapshot.ts`'s `readable` is
   exactly that predicate. So calling T080's readers with the
   CALLER's actor returns private rows to precisely the caller AC4
   was written against — the sentence in D-200-04 that said
   otherwise was withdrawn by D-200-06 for that reason.

   Passing `{ kind: "anonymous" }` instead re-implements nothing.
   T080's visibility rule stays T080's, T030's stays T030's, and
   AC4 holds BY CONSTRUCTION for all three actor kinds rather than
   by a second filter this module would have to keep correct. A
   filter T200 maintained could get the rule wrong in a direction
   no cell searching for something PRESENT would catch, which is
   the failure D-200-04's surviving half still warns about.
   ============================================================ */

import type { Actor } from "@/lib/server/policy";

/**
 * The actor every registry, ontology and archive read in this module is made with,
 * whoever is asking.
 *
 * Frozen because it is shared across every call and nothing may mutate it into a wider one.
 */
export const PUBLIC_ONLY: Actor = Object.freeze({ kind: "anonymous" as const });
