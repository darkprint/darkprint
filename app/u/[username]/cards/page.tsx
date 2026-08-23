import { notFound } from "next/navigation";

import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedCards } from "@/components/profile/OwnedCards";
import { VisibilityFilter } from "@/components/profile/VisibilityFilter";
import { EmptyState, ShelfToolbar } from "@/components/profile/parts";
import { nodeSummaryFor, profileMetadata, profileView } from "@/components/profile/load";
import { readSession } from "@/components/profile/session";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-59) (cited at line 48): GET /api/authors/{handle}/cards
// TODO(SEAM-113) (cited at line 55): GET /api/authors/{handle}/cards?include=private&visibility

/**
 * `/u/[username]/cards` — every node card this handle has authored, public and (for the
 * owner) private together.
 *
 * A public row is counted off `content/cards/` by the `author:` field each card carries in
 * its own bytes, which is the reason `/settings` says a rename keeps the old handle
 * reserved: this list is the join, and it is made of published documents rather than of a
 * table somebody can edit. A private row is seeded in `lib/data/cards.ts`, the same
 * arrangement `lib/data/bundles.ts` gives a private blueprint — see that file's docblock
 * for the rule this follows: a fixture can only ever claim something private, never
 * something public, because a public claim is a claim about the registry.
 *
 * Both readers get a list, which is the same arrangement the blueprints tab makes: the two
 * things an account holds are the same object at two scales, and a tile grid said the
 * opposite by cropping a card into something to browse past. What differs between owner
 * and visitor is which rows exist to show (a visitor's is always `view.cards`, always
 * public) and the toolbar's one live control.
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
            note={
              <>
                the search is drawn and switched off. This list is{" "}
                {view.ownedCards.length} document
                {view.ownedCards.length === 1 ? "" : "s"} and nothing stores the private
                ones.
              </>
            }
          >
            <VisibilityFilter label="Filter cards by visibility" />
          </ShelfToolbar>

          <OwnedCards cards={view.ownedCards} owner />
        </div>
      ) : view.cards.length === 0 ? (
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
            note={
              <>
                the search is drawn and switched off. This list is {view.cards.length}{" "}
                document{view.cards.length === 1 ? "" : "s"} read straight off{" "}
                <span className="text-muted">content/cards/</span> and nothing indexes{" "}
                {view.cards.length === 1 ? "it" : "them"} here.
              </>
            }
          />

          <OwnedCards cards={view.cards.map((tile) => nodeSummaryFor(tile, view.author))} owner={false} />
        </div>
      )}
    </ProfileShell>
  );
}
