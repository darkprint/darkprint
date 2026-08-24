/* ============================================================
   DarkPrint backend — the one actor every MCP read is made with
   D-220-03, which is D-200-06/07's rule reaching this surface
   unchanged: the MCP server is a DISCOVERY surface and is
   public-only for every caller, an owner's own private bundle
   included.

   The `actor` parameter stays in all four published signatures and
   is accepted-and-deliberately-unused — T200's construction, not a
   new one. It is not quietly dropped, because the published block
   is fixed and because a later ruling could make it load-bearing;
   a reader wondering whether its absence is an oversight is
   answered here rather than left to guess.

   AC3 is one filter and not four, and this constant is where the
   one filter starts: every reader below it takes an `Actor` and
   applies T060's `can` for itself, so private content is
   unreachable through all four verbs by construction rather than
   by four checks that each have to remember.
   ============================================================ */

import type { Actor } from "@/lib/server/policy";

/** The only actor this module hands to a reader. */
export const MCP_ACTOR: Actor = { kind: "anonymous" };
