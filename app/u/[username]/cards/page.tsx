import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedCards } from "@/components/profile/OwnedCards";
import { EmptyState, NodeCardTile } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

/**
 * `/u/[username]/cards` — every node card this handle has authored.
 *
 * Counted off `content/cards/` by the `author:` field each card carries in its own bytes,
 * which is the reason `/settings` says a rename keeps the old handle reserved: this list is
 * the join, and it is made of published documents rather than of a table somebody can edit.
 *
 * The owner reads it as a list and a visitor reads it as a shelf, which is the same fork
 * the blueprints tab makes one route over: `Your cards` is the panel `OwnedBundles` draws,
 * because the two things an account holds are the same object at two scales and a tile grid
 * said the opposite. Nothing about the rows differs between the two views; what differs is
 * whether the page is answering *what have I got* or *what has this person published*.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({ params }: PageProps<"/u/[username]/cards">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return {
    title: `${author.displayName} · node cards`,
    description: `Node cards authored by ${author.displayName} on DarkPrint.`,
  };
}

export default async function Page({ params }: PageProps<"/u/[username]/cards">) {
  const { username } = await params;
  const view = profileView(username);
  if (view === undefined) notFound();

  return (
    <ProfileShell view={view} active="cards">
      {view.cards.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No node cards"
            action={{ href: "/nodes", label: "Browse the card library" }}
          >
            {view.author.displayName} has not published a node card so far.
          </EmptyState>
        </div>
      ) : view.owner ? (
        <div className="mt-10">
          <OwnedCards tiles={view.cards} />
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {view.cards.map((tile) => (
            <NodeCardTile key={tile.record.ref} {...tile} />
          ))}
        </div>
      )}
    </ProfileShell>
  );
}
