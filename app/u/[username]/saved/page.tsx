import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { SavedList } from "@/components/profile/SavedList";
import { EmptyState, SectionTitle } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-61) (cited at line 39): GET /api/account/saves

/* ============================================================
   /u/[username]/saved — the owner's bookmark list, and nobody else's.

   The tab is not rendered on a visitor's profile, so this route is only ever reached by
   typing it. It still has to answer, and what it answers is the rule rather than the list:
   a save is private, so a visitor is told that and shown nothing. The count is private too
   — `components/profile/tabs.ts` records why the design's `Saved 8` on a public profile is
   the one place the handoff contradicts its own copy.
   ============================================================ */

export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({ params }: PageProps<"/u/[username]/saved">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return { title: `${author.displayName} · saved`, description: "A private bookmark list." };
}

export default async function Page({ params }: PageProps<"/u/[username]/saved">) {
  const { username } = await params;
  const view = profileView(username);
  if (view === undefined) notFound();

  return (
    <ProfileShell view={view} active="saved">
      {view.owner ? (
        <section className="mt-10 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle label="Saved" dot="var(--color-amber)" count={view.saves.length} />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
              ◐ seeded
            </span>
          </div>
          <SavedList saves={view.saves} />
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
