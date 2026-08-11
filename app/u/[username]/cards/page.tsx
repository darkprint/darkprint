import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { EmptyState, NodeCardTile } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

/**
 * `/u/[username]/cards` — every node card this handle has authored.
 *
 * Counted off `content/cards/` by the `author:` field each card carries in its own bytes,
 * which is the reason `/settings` says a rename keeps the old handle reserved: this list is
 * the join, and it is made of published documents rather than of a table somebody can edit.
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
