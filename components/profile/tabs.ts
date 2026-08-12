
// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-58) (cited at line 39): folded into SEAM-53
/* ============================================================
   The five tabs on a profile, and the four route segments they cost.

   Tabs here are routes rather than client state, so each one is
   prerendered per handle and a reader can link somebody straight to
   the list they mean. That decision has a price worth writing down:

   **Four slugs are now unreachable as bundle names.** A bundle a
   reader owns lives at `/u/<handle>/<slug>`, and Next resolves a
   static segment before a dynamic sibling — so `/u/mara-veil/saved`
   is this tab, forever, and a bundle called `saved` would be a page
   nobody can open. `tabs.test.ts` holds every slug in the archive
   and every owned bundle against `RESERVED_PROFILE_SEGMENTS`, so
   that collision fails a named case instead of 404ing in the wild.

   The alternative was `?tab=`, which costs no names and is not a
   route: the same URL for five different pages, resolved in the
   browser. This site prerenders everything and the handoff asks for
   real routes, so the four names are the price paid.
   ============================================================ */

export type ProfileTabId = "overview" | "blueprints" | "cards" | "saved" | "terms";

export interface ProfileTab {
  id: ProfileTabId;
  label: string;
  /** The path segment under `/u/<handle>`. Empty for the overview, which is the index. */
  segment: string;
  /**
   * Rendered only when the reader owns the profile.
   *
   * Saved is the only one. A save is a private bookmark — the handoff's own copy says so
   * where the list renders — so a visitor may not see the list OR the count. The design
   * draws `Saved 8` on the public profile and that is the one place it contradicts itself;
   * this resolves it the way the copy does, since a count is a fact about a private list.
   */
  ownerOnly?: boolean;
}

export const PROFILE_TABS: readonly ProfileTab[] = [
  { id: "overview", label: "Overview", segment: "" },
  { id: "blueprints", label: "Blueprints", segment: "blueprints" },
  { id: "cards", label: "Cards", segment: "cards" },
  { id: "saved", label: "Saved", segment: "saved", ownerOnly: true },
  /* "Ontology terms" since 2026-08-12, with the nav rows and the browser's count line: one
     word for the thing across the whole site, on the author's instruction. */
  { id: "terms", label: "Ontology terms", segment: "terms" },
];

/** Where a tab points, for one handle. */
export function profileTabHref(username: string, tab: ProfileTab): string {
  return tab.segment === "" ? `/u/${username}` : `/u/${username}/${tab.segment}`;
}

/** The segments a bundle slug may never be. See the header. */
export const RESERVED_PROFILE_SEGMENTS: readonly string[] = PROFILE_TABS.map(
  (tab) => tab.segment,
).filter((segment) => segment !== "");
