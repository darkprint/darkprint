import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { OwnedBundles, type OwnedRow } from "@/components/profile/OwnedBundles";
import { EmptyState, ShelfToolbar } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-63) (cited at line 64): GET /api/authors/{handle}/bundles?include=private

/* ============================================================
   /u/[username]/blueprints — the management list for the owner, the shelf for everyone else.

   Both readers get the same list. The owner's holds everything they have, public and
   private together, which is the arrangement the whole accounts pass is arguing for: a fork
   is a fact about a bundle, so there is no second list to put one in. A visitor's holds
   what the archive publishes under this handle, on the author's instruction that a profile
   is a shelf rather than a gallery. What differs between the two is the toolbar, the
   controls and the destination of a row, and `OwnedBundles` takes `owner` for exactly
   those.

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

  /* A visitor's rows come from the archive, not from `lib/data/bundles.ts`. That file seeds
     one handle's shelf and nothing else, so `bundlesOwnedBy` answers with an empty list for
     every other author, and a visitor list built from it would be blank on five profiles
     out of six. The `OwnedBundle` half of a row is a published bundle's three true facts,
     and the row's own guard against inventing more is the type: there is no `draft` and no
     `forkedFrom` to give a published bundle, because the archive has neither. */
  const visitorRows: OwnedRow[] = blueprints.map((blueprint) => ({
    bundle: { owner: author.username, slug: blueprint.slug, visibility: "public" },
    blueprint,
  }));

  return (
    <ProfileShell view={view} active="blueprints">
      {owner ? (
        <div className="mt-10 flex flex-col gap-5">
          <ShelfToolbar
            placeholder="Find a blueprint…"
            label="Find a blueprint"
            note={
              <>
                the search, the visibility filter and the sort are drawn and switched off.
                This list is {owned.length} row{owned.length === 1 ? "" : "s"} and nothing
                stores {owned.length === 1 ? "it" : "them"}.
              </>
            }
          >
            <DeadControl>Visibility: all ▾</DeadControl>
            <DeadControl>Sort: updated ▾</DeadControl>
            <ButtonLink href="/build" variant="outline">
              New blueprint
            </ButtonLink>
          </ShelfToolbar>

          <OwnedBundles rows={owned} owner />
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
        /* The find box and nothing beside it. Visibility and sort are the owner's, and
           New blueprint on somebody else's shelf would read as an offer to add one to it. */
        <div className="mt-10 flex flex-col gap-5">
          <ShelfToolbar
            placeholder="Find a blueprint…"
            label="Find a blueprint"
            note={
              <>
                the search is drawn and switched off. This list is {visitorRows.length}{" "}
                bundle{visitorRows.length === 1 ? "" : "s"} read off{" "}
                <span className="text-muted">content/</span> at build time.
              </>
            }
          />

          <OwnedBundles rows={visitorRows} owner={false} />
        </div>
      )}
    </ProfileShell>
  );
}
