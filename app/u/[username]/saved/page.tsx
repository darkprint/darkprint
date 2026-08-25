import { notFound } from "next/navigation";

import { ProfileShell } from "@/components/profile/ProfileShell";
import { SavedList } from "@/components/profile/SavedList";
import { EmptyState, SectionTitle } from "@/components/profile/parts";
import { profileMetadata, profileView } from "@/components/profile/load";
import { readSession } from "@/components/profile/session";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-61 LIVE: the Saved tab, off `@/lib/server/saves` via `profileView`
//   (see components/profile/load.ts) — not this file's own fetch.

/* ============================================================
   /u/[username]/saved — the owner's bookmark list, and nobody else's.

   The tab is not rendered on a visitor's profile, so this route is only ever reached by
   typing it. It still has to answer, and what it answers is the rule rather than the list:
   a save is private, so a visitor is told that and shown nothing. The count is private too
   — `components/profile/tabs.ts` records why the design's `Saved 8` on a public profile is
   the one place the handoff contradicts its own copy.
   ============================================================ */

/* No `dynamicParams` and no `generateStaticParams`, and the deletion is the criterion
   rather than tidying: **a prerendered page cannot render a different view per reader**
   (AC1, D-262-11). Both stood on `AUTHOR_LIST`, a fixed fixture list, which could not
   have served a registry that grows between deploys either. `readSession` reaches
   `next/headers`, so these routes are request-time by construction now. */

export async function generateMetadata({ params }: PageProps<"/u/[username]/saved">) {
  const { username } = await params;
  const author = await profileMetadata(username);
  if (author === undefined) return { title: "Builder not found" };
  return {
 title: `${author.displayName} · saved`, description: "A private bookmark list." };
}

export default async function Page({ params }: PageProps<"/u/[username]/saved">) {
  const { username } = await params;
  const view = await profileView(username, await readSession());
  if (view === undefined) notFound();

  return (
    <ProfileShell view={view} active="saved">
      {view.owner ? (
        <section className="mt-10 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle label="Saved" dot="var(--color-amber)" count={view.saves.length} />
            {/* `✓ on your account`, and the marker moved because the thing under it became
                real in the same change (AC3, D-78). It read `◐ seeded` over five fixture
                rows; these come out of `listSaves` for the reader's own account id. The
                blueprint gap that survives is stated where it bites, at the foot of the
                list, rather than as a marker over rows that are not affected by it. */}
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
              ✓ on your account
            </span>
          </div>
          {view.saves.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              action={{ href: "/blueprints", label: "Browse the registry" }}
            >
              The bookmark on a node card adds it here. A save is private: nobody else can
              see this list, and nothing counts it.
            </EmptyState>
          ) : (
            <SavedList saves={view.saves} />
          )}
        </section>
      ) : (
        <div className="mt-10">
          <EmptyState
            title="Saves are private"
            action={{ href: `/u/${view.author.username}`, label: "Back to the profile" }}
          >
            A save is a bookmark, and it belongs to whoever made it. Nobody can read
            {" "}{view.author.displayName}&rsquo;s list, and neither the list nor its size is
            shown on a public profile.
          </EmptyState>
        </div>
      )}
    </ProfileShell>
  );
}
