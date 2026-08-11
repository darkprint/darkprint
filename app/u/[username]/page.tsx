import Link from "next/link";
import { notFound } from "next/navigation";

import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import { compact } from "@/lib/format";
import { Stat } from "@/components/ui/Stat";
import { ContentCard } from "@/components/ui/ContentCard";
import { ProfileShell } from "@/components/profile/ProfileShell";
import { Pinned } from "@/components/profile/Pinned";
import { EmptyState, NodeCardTile, SectionTitle } from "@/components/profile/parts";
import { profileView } from "@/components/profile/load";

/* ============================================================
   /u/[username] — the overview tab.

   One route, two views. `lib/data/account.ts` seeds one handle as the signed-in account,
   so that handle's page renders the owner chrome and every other renders the visitor's.
   Both are prerendered: with no server there is no other way to have an owner view at all,
   and `ProfileShell` says so in the open above the header rather than letting a reader
   conclude they are logged in.

   What the overview holds is the public shape of the profile — what this builder pinned,
   what the archive counts, and the two grids. The owner's *management* list, with the
   private bundles and the visibility controls, is the Blueprints tab. Keeping the two apart
   is what stops the overview from being two different pages depending on who is reading.
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

  const { author, blueprints, cards, pinned, owner, terms } = view;
  const totalDownloads = blueprints.reduce((n, b) => n + b.downloads, 0);
  const published = blueprints.length + cards.length;

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

      {/* Counted archive facts and illustrative community signals are different kinds of
          evidence. They get different panels instead of sharing one undifferentiated row. */}
      <section
        aria-label="Profile summary"
        className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"
      >
        <article className="rounded-xl border border-line bg-surface-2 p-5">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
            <h2 className="label-lead">Published here</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
              ✓ counted
            </span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-5">
            <Stat value={published} label="Total" />
            <Stat
              value={blueprints.length}
              label="Blueprints"
              accent="var(--color-cyan)"
            />
            <Stat
              value={cards.length}
              label="Node cards"
              accent="var(--color-copper-line)"
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-dim">
            Counted from the versioned archive at build time.
          </p>
        </article>

        <article className="rounded-xl border border-amber/25 bg-amber/5 p-5">
          <div className="flex items-center justify-between gap-3 border-b border-amber/20 pb-4">
            <h2 className="label-lead">Preview signals</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
              ◐ seeded
            </span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5">
            <Stat
              value={compact(totalDownloads)}
              label="Downloads"
              accent="var(--color-emerald)"
            />
            <Stat
              value={compact(author.reputation)}
              label="Reputation"
              accent="var(--color-violet)"
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-dim">
            Illustrative index rows. No telemetry, ballot, or accruing reputation is connected.
          </p>
        </article>
      </section>

      <div className="mt-14 flex flex-col gap-14">
        {published === 0 ? (
          <EmptyState
            title="Nothing published yet"
            action={{ href: "/blueprints", label: "Browse the registry" }}
          >
            {author.displayName} has not shared a blueprint or a node card with the registry
            so far.
          </EmptyState>
        ) : (
          <>
            {blueprints.length > 0 && (
              <section className="flex flex-col gap-5">
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle
                    label="Blueprints"
                    dot="var(--color-cyan)"
                    count={blueprints.length}
                  />
                  {owner && (
                    <Link
                      href={`/u/${author.username}/blueprints`}
                      className="font-mono text-[11px] text-cyan transition-colors hoverable:hover:text-cyan-bright"
                    >
                      Your private bundles are on the Blueprints tab →
                    </Link>
                  )}
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {blueprints.map((bp) => (
                    <ContentCard key={bp.slug} item={bp} />
                  ))}
                </div>
              </section>
            )}

            {cards.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionTitle
                  label="Node cards"
                  dot="var(--color-amber)"
                  count={cards.length}
                />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.slice(0, 3).map((tile) => (
                    <NodeCardTile key={tile.record.ref} {...tile} />
                  ))}
                </div>
                {cards.length > 3 && (
                  <Link
                    href={`/u/${author.username}/cards`}
                    className="self-start font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:text-cyan-bright"
                  >
                    See all {cards.length} cards →
                  </Link>
                )}
              </section>
            )}

            {terms.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionTitle
                  label="Vocabulary terms"
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
            )}
          </>
        )}
      </div>
    </ProfileShell>
  );
}
