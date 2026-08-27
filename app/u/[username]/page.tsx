import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/Button";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedBundles } from "@/components/profile/OwnedBundles";
import { Pinned } from "@/components/profile/Pinned";
import { VisibilityFilter } from "@/components/profile/VisibilityFilter";
import { SortControl } from "@/components/profile/SortControl";
import { EmptyState, SectionTitle, ShelfToolbar } from "@/components/profile/parts";
import { profileMetadata, profileView } from "@/components/profile/load";
import { readSession } from "@/components/profile/session";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-53 LIVE: the identity, off `@/lib/server/accounts`.
// SEAM-55 LIVE: the pinned selection, off `getProfile` (T131/T280).
// SEAM-63/64 LIVE: the shelf, off `ownedBundles` (T280) — see `components/profile/load.ts`.

/* ============================================================
   /u/[username] — blueprints, the profile's own index (T280).

   This route used to be the overview: pinned items above a link to the terms tab, on the
   argument that the counted totals already lived in `ProfileHeader` so restating a slice
   of either archive-authored list here was a second place for the same fact to drift from
   the first. That argument did not survive accounts becoming real. A profile with drafts
   and releases is a thing readers open a profile TO SEE — the GitHub analogy the whole
   0007_drafts migration is built on — and a second click to reach it is a click a static
   fixture never had to justify. `components/profile/tabs.ts`'s own docblock carries the
   fuller argument; this file is where it lands.

   So Blueprints takes the segmentless slot now (`tabs.ts`), and this page is what used to
   be two: Pinned, unchanged in shape, above the shelf `/u/[username]/blueprints` used to
   own alone. The old overview's terms teaser did not move down with it — Ontology terms is
   still its own tab, and a link to it from here would be the second address for one fact
   the original overview was written to avoid, just aimed at a different tab.

   ── Why one shelf serves both readers now ──
   `owned` (`profileView`) is `ownedBundles(db, actor, username)`, already actor-scoped:
   everything for the owner, public rows only for anyone else (`lib/server/registry/
   owned.ts`). The old route built a second, hand-assembled row list for a visitor out of
   `allBlueprints()` because the only live-shaped reader available then was owner-only
   (`bundlesOwnedBy`, a fixture). There is one reader now and it already answers both
   questions, so there is one shelf.
   ============================================================ */

/* No `dynamicParams`, no `generateStaticParams`, and no `export const dynamic` either — a
   prerendered page cannot render a different view per reader (AC1, D-262-11), and
   `readSession` reaches `next/headers`, which is what makes this route request-time
   without a segment-config token to declare it (`tests/server/t262/per-request.test.ts`
   holds all five profile routes to exactly this shape). */

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = await profileMetadata(username);
  if (author === undefined) return { title: "Builder not found" };
  return { title: author.displayName, ...(author.bio === undefined ? {} : { description: author.bio }) };
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const view = await profileView(username, await readSession());
  if (view === undefined) notFound();

  const { author, owned, owner, pinned } = view;
  const hasContent = pinned.length > 0 || owned.length > 0;

  return (
    <ProfileShell view={view} active="blueprints">
      {pinned.length > 0 && (
        <section className="mt-10 flex flex-col gap-5">
          {/* The `✓ counted` marker left this row on the owner's instruction
              (2026-08-25): the figures are real, and a badge announcing it is noise. */}
          <div className="flex items-center justify-between gap-3">
            <SectionTitle label="Pinned" dot="var(--color-cyan)" count={pinned.length} />
          </div>
          <Pinned items={pinned} />
        </section>
      )}

      {!hasContent ? (
        <div className="mt-10">
          <EmptyState
            title={owner ? "Nothing here yet" : "No published blueprints"}
            action={
              owner
                ? { href: "/new", label: "Start a blueprint" }
                : { href: "/blueprints", label: "Browse the registry" }
            }
          >
            {owner
              ? "Nothing pinned and nothing published or drafted yet. New blueprint starts one."
              : `${author.displayName} has not published a blueprint to the registry so far. Private bundles are never listed here.`}
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-5">
          <ShelfToolbar placeholder="Find a blueprint…" label="Find a blueprint">
            {owner && <VisibilityFilter label="Filter blueprints by visibility" />}
            <SortControl label="Sort blueprints" />
            {owner && (
              <ButtonLink href="/new" variant="outline">
                New blueprint
              </ButtonLink>
            )}
          </ShelfToolbar>

          <OwnedBundles rows={owned} owner={owner} ownerHandle={author.username} />
        </div>
      )}
    </ProfileShell>
  );
}
