import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedCards } from "@/components/profile/OwnedCards";
import { EmptyState, ShelfToolbar } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

/**
 * `/u/[username]/cards` — every node card this handle has authored.
 *
 * Counted off `content/cards/` by the `author:` field each card carries in its own bytes,
 * which is the reason `/settings` says a rename keeps the old handle reserved: this list is
 * the join, and it is made of published documents rather than of a table somebody can edit.
 *
 * Both readers get the list, which is the same arrangement the blueprints tab makes: the
 * two things an account holds are the same object at two scales, and a tile grid said the
 * opposite by cropping a card into something to browse past. What differs between owner and
 * visitor is the toolbar, the controls and the heading, so `OwnedCards` takes `owner` for
 * exactly those and the rows themselves are identical.
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
        /* The find box and nothing else, on both copies of this page. There is no
           visibility filter because every card is public, and no New card because nothing
           on this site writes one: a toolbar that mirrored the blueprints tab control for
           control would be drawing two more affordances whose destinations do not exist.
           Owner and visitor differ here only in whose documents these are, which is not a
           difference the toolbar has anything to say about. */
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

          <OwnedCards tiles={view.cards} owner={view.owner} />
        </div>
      )}
    </ProfileShell>
  );
}
