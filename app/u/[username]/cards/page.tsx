import { notFound } from "next/navigation";

import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedCards } from "@/components/profile/OwnedCards";
import { VisibilityFilter } from "@/components/profile/VisibilityFilter";
import { EmptyState, ShelfToolbar } from "@/components/profile/parts";
import { profileMetadata, profileView } from "@/components/profile/load";
import { readSession } from "@/components/profile/session";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-59 LIVE (T132): the visitor branch below, off `cardsOwnedBy` — see `load.ts`.
// SEAM-113 LIVE (T132): the owner branch below, public and private together, off
//   `cardsOwnedBy` — see `load.ts`.

/**
 * `/u/[username]/cards` — every node card this handle's account HOLDS, public and (for the
 * owner) private together.
 *
 * `view.ownedCards` (`components/profile/load.ts`) is `cardsOwnedBy(db, actor, username)`
 * mapped to a tile, already actor-scoped: everything for the owner, public rows only for
 * anyone else (`lib/server/registry/cards.ts`, D-132-04 C-C) — the same reader
 * `view.counts.cards` is built from, so the number the tab strip prints and the shelf
 * under it cannot disagree (T132: they used to, for an account whose card exists only in
 * the registry, with no matching `content/cards/` file for the archive-era reader to find).
 *
 * Both branches below read this one field, which is the same arrangement the blueprints
 * index makes: the two things an account holds are the same object at two scales, and a
 * tile grid said the opposite by cropping a card into something to browse past. What
 * differs between owner and visitor is only the chrome — the owner's shelf carries a
 * visibility filter, a visitor's does not, because every row a visitor can see is already
 * public.
 */
/* No `dynamicParams` and no `generateStaticParams`, and the deletion is the criterion
   rather than tidying: **a prerendered page cannot render a different view per reader**
   (AC1, D-262-11). Both stood on `AUTHOR_LIST`, a fixed fixture list, which could not
   have served a registry that grows between deploys either. `readSession` reaches
   `next/headers`, so these routes are request-time by construction now. */

export async function generateMetadata({ params }: PageProps<"/u/[username]/cards">) {
  const { username } = await params;
  const author = await profileMetadata(username);
  if (author === undefined) return { title: "Builder not found" };
  return {
    title: `${author.displayName} · node cards`,
    description: `Node cards authored by ${author.displayName} on DarkPrint.`,
  };
}

export default async function Page({ params }: PageProps<"/u/[username]/cards">) {
  const { username } = await params;
  const view = await profileView(username, await readSession());
  if (view === undefined) notFound();

  return (
    <ProfileShell view={view} active="cards">
      {view.owner ? (
        /* The owner's list can hold a private card, so it gets the same live Visibility
           filter the blueprints tab has — no New card beside it, because nothing on this
           site writes one, and drawing a control whose destination does not exist would
           be the failure `New blueprint` on this page's sibling was written to avoid. */
        <div className="mt-10 flex flex-col gap-5">
          <ShelfToolbar
            placeholder="Find a card…"
            label="Find a card"
            note={`${view.ownedCards.length} card${view.ownedCards.length === 1 ? "" : "s"}, read live off the registry, public and private together.`}
          >
            <VisibilityFilter label="Filter cards by visibility" />
          </ShelfToolbar>

          <OwnedCards cards={view.ownedCards} owner />
        </div>
      ) : view.ownedCards.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No node cards"
            action={{ href: "/nodes", label: "Browse the card library" }}
          >
            {view.author.displayName} has not published a node card so far.
          </EmptyState>
        </div>
      ) : (
        /* The find box and nothing else. There is no visibility filter here — every card
           a visitor's list can hold is public, so every option would answer with the same
           rows, which is the same reasoning `VisibilityFilter` is withheld from a
           visitor's Blueprints tab. */
        <div className="mt-10 flex flex-col gap-5">
          <ShelfToolbar
            placeholder="Find a card…"
            label="Find a card"
            note={`${view.ownedCards.length} card${view.ownedCards.length === 1 ? "" : "s"}, read live off the registry.`}
          />

          <OwnedCards cards={view.ownedCards} owner={false} />
        </div>
      )}
    </ProfileShell>
  );
}
