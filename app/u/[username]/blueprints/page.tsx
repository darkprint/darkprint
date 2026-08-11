import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ContentCard } from "@/components/ui/ContentCard";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedBundles } from "@/components/profile/OwnedBundles";
import { EmptyState } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

/* ============================================================
   /u/[username]/blueprints — the management list for the owner, the shelf for everyone else.

   The visitor gets the same tiles the gallery draws, over the bundles this handle has
   published. The owner gets one list of everything they hold, public and private together,
   which is the arrangement the whole accounts pass is arguing for: a fork is a fact about a
   bundle, so there is no second list to put one in.

   The toolbar is drawn and switched off. Nothing filters five rows and nothing sorts them,
   and a control that swallows a click is the failure this project has twice shipped and
   twice had to fix. `New blueprint` is the exception because its destination is real: the
   workspace at `/build` genuinely hands back a bundle folder.
   ============================================================ */

export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]/blueprints">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return {
    title: `${author.displayName} · blueprints`,
    description: `Blueprints published by ${author.displayName} on DarkPrint.`,
  };
}

/** One switched-off control in the owner's toolbar, drawn as the design has it. */
function DeadControl({ children }: { children: React.ReactNode }) {
  return (
    <Button
      variant="outline"
      disabled
      title="Nothing filters or sorts this list yet: it is five rows in lib/data/bundles.ts."
      className="font-mono! text-[11px]! uppercase! tracking-[0.12em]!"
    >
      {children}
    </Button>
  );
}

export default async function Page({ params }: PageProps<"/u/[username]/blueprints">) {
  const { username } = await params;
  const view = profileView(username);
  if (view === undefined) notFound();

  const { author, blueprints, owned, owner } = view;

  return (
    <ProfileShell view={view} active="blueprints">
      {owner ? (
        <div className="mt-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3">
              <span aria-hidden className="text-[13px] text-dim">
                ⌕
              </span>
              <input
                type="text"
                disabled
                placeholder="Find a blueprint…"
                aria-label="Find a blueprint"
                className="h-full min-w-0 flex-1 cursor-not-allowed bg-transparent text-sm text-fg placeholder:text-dim"
              />
            </span>
            <DeadControl>Visibility: all ▾</DeadControl>
            <DeadControl>Sort: updated ▾</DeadControl>
            <ButtonLink href="/build" variant="outline">
              New blueprint
            </ButtonLink>
          </div>
          <p className="font-mono text-[11px] text-dim">
            <span className="text-amber">◐ seeded</span> · the search, the visibility
            filter and the sort are drawn and switched off. This list is five rows and
            nothing stores them.
          </p>

          <OwnedBundles rows={owned} />
        </div>
      ) : blueprints.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No published blueprints"
            action={{ href: "/blueprints", label: "Browse the registry" }}
          >
            {author.displayName} has not published a blueprint to the registry so far.
            Private bundles are never listed here.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((bp) => (
            <ContentCard key={bp.slug} item={bp} />
          ))}
        </div>
      )}
    </ProfileShell>
  );
}
