/* ============================================================
   DarkPrint backend — naming: the slugs the profile tabs occupy
   Four slugs are unreachable as bundle names because a bundle a
   reader owns lives at `/u/<handle>/<slug>` and Next resolves a
   static segment before a dynamic sibling, so `/u/mara-veil/saved`
   is the tab forever. The list is *read* from the tabs module
   rather than restated, on the contract's own instruction: a fifth
   tab added there is a fifth reserved slug here with nothing to
   remember, and the two cannot drift into disagreeing about which
   names a reader may take.
   ============================================================ */

import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";

/** Pure, no `Db`. True when `slug` is a segment the profile tabs already occupy. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_PROFILE_SEGMENTS.includes(slug);
}
