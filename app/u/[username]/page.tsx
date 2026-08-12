import Link from "next/link";
import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { Pinned } from "@/components/profile/Pinned";
import { EmptyState, SectionTitle } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-53) (cited at line 40): GET /api/authors/{handle}

/* ============================================================
   /u/[username] — the overview tab.

   One route, two views. `lib/data/account.ts` seeds one handle as the signed-in account,
   so that handle's page renders the owner chrome and every other renders the visitor's.
   Both are prerendered: with no server there is no other way to have an owner view at all,
   and `ProfileShell` says so in the open above the header rather than letting a reader
   conclude they are logged in.

   What the overview holds is what this builder chose to put here: pinned items and local
   vocabulary terms. It is not a shrunken Blueprints tab or Cards tab any more — those two
   sections drew a `ContentRow` list and a `NodeCardSummary` grid here until the author
   asked for them removed, on the grounds that a builder's full archive count already lives
   in `ProfileHeader`'s summary line and the tab strip's own count pills, so this page
   restating a slice of either list was a second place for the same fact to drift from the
   first. The owner's *management* list, with the private bundles, the private cards and
   the visibility controls, is the Blueprints and Cards tabs. Keeping the two apart is what
   stops the overview from being two different pages depending on who is reading.

   ── The empty state, after the removal ──
   It used to gate on `published === 0` (no archive blueprint or card), because those were
   the two things this page could be empty OF. With both sections gone, `published` is no
   longer a fact about this page — a handle can have five published blueprints and an
   overview with nothing on it, if they pinned none and named no local term, and saying
   "Nothing published yet" to that reader would be false. So the empty state now asks the
   question this page can actually answer — is there a pin or a term to show — and only
   falls back to talking about the registry when `published` really is zero too.
   ============================================================ */

/** The author table is a fixed list; an unknown handle is a 404, not an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return { title: author.displayName, description: author.bio };
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const view = profileView(username);
  if (view === undefined) notFound();

  const { author, blueprints, cards, pinned, terms } = view;
  const published = blueprints.length + cards.length;
  const hasOverviewContent = pinned.length > 0 || terms.length > 0;

  return (
    <ProfileShell view={view} active="overview">
      {/* Pinned. The selection is seeded and everything drawn on the two cards is counted
          off the archive, which is why the marker is `✓ counted`: a pin is a preference,
          and the card is a fact. */}
      {pinned.length > 0 && (
        <section className="mt-10 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <SectionTitle label="Pinned" dot="var(--color-cyan)" count={pinned.length} />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
              ✓ counted
            </span>
          </div>
          <Pinned items={pinned} />
        </section>
      )}

      {/* "Published here" (the counted totals) and "Preview signals" (downloads, stars,
          validated) used to sit here as a two-panel section. Both now live in
          `ProfileHeader` — the counted totals were already restated there as the
          blueprint/card summary line, and Preview signals moved up into the same panel
          on the author's instruction, so nothing on this page states either fact twice. */}

      <div className="mt-14 flex flex-col gap-14">
        {!hasOverviewContent ? (
          <EmptyState
            title={published === 0 ? "Nothing published yet" : "Nothing pinned"}
            action={
              published === 0
                ? { href: "/blueprints", label: "Browse the registry" }
                : { href: `/u/${author.username}/blueprints`, label: "See what's published" }
            }
          >
            {published === 0
              ? `${author.displayName} has not shared a blueprint or a node card with the registry so far.`
              : `${author.displayName} has not pinned anything to the overview, and named no local vocabulary term. What is published lives on the Blueprints and Cards tabs.`}
          </EmptyState>
        ) : (
          terms.length > 0 && (
            <section className="flex flex-col gap-5">
              <SectionTitle
                label="Ontology terms"
                dot="var(--color-violet)"
                count={terms.length}
              />
              <Link
                href={`/u/${author.username}/terms`}
                className="self-start font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:text-cyan-bright"
              >
                See the {terms.length === 1 ? "term" : "terms"} this handle added →
              </Link>
            </section>
          )
        )}
      </div>
    </ProfileShell>
  );
}
