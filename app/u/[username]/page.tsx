import Link from "next/link";
import { notFound } from "next/navigation";
import type { Blueprint } from "@/lib/types";
import type { CardVersionRecord } from "@/lib/core";
import { AUTHOR_LIST, getAuthor } from "@/lib/data";
import {
  allBlueprints,
  allNodeCards,
  getOntologyView,
  getRegistry,
} from "@/lib/content";
import { HUMAN_PRESENCE_MARK, compact } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { Badge } from "@/components/ui/Badge";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { Stat } from "@/components/ui/Stat";
import { ContentCard } from "@/components/ui/ContentCard";
import { ButtonLink } from "@/components/ui/Button";

/** The author table is a fixed list; an unknown handle is a 404, not an on-demand render. */
export const dynamicParams = false;

export function generateStaticParams() {
  return AUTHOR_LIST.map((a) => ({ username: a.username }));
}

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) return { title: "Builder not found" };
  return { title: author.displayName, description: author.bio };
}

/** Section header: a keyed dot, the label, and how many there are. */
function SectionTitle({
  label,
  dot,
  count,
}: {
  label: string;
  dot: string;
  count: number;
}) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-fg">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />
      {label}
      <span className="font-mono text-sm font-normal text-dim">{count}</span>
    </h2>
  );
}

/**
 * One authored node card, at gallery altitude: what it is, what it does, and how
 * far it has travelled. The full interface, version history and source live on the
 * card's own page.
 */
function NodeCardTile({
  record,
  typeLabel,
  usedIn,
}: {
  record: CardVersionRecord;
  typeLabel: string;
  usedIn: number;
}) {
  const { card } = record;
  return (
    <Link
      href={nodeHref(record.id)}
      className="group flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-amber)]"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge color="var(--color-amber)">{typeLabel}</Badge>
        <span className="font-mono text-[11px] text-dim">
          {record.id}@{record.version}
        </span>
      </div>
      <h3 className="font-display text-base font-semibold leading-snug text-fg group-hover:text-cyan">
        {card.name}
      </h3>
      <p className="line-clamp-2 flex-1 text-sm leading-snug text-muted">{card.action}</p>
      <div className="flex items-center gap-3 border-t border-line pt-3 font-mono text-[11px] text-dim">
        <span>
          used in {usedIn} blueprint{usedIn === 1 ? "" : "s"}
        </span>
        {/* Violet, from `HUMAN_PRESENCE_MARK`, like every other row that says where a
            person acts. Doc 2 §1.1: an author's shelf is the last place a human node
            should be marked in the colour the site uses for defects. */}
        {card.requiresHuman && (
          <span className={HUMAN_PRESENCE_MARK.className}>
            {HUMAN_PRESENCE_MARK.glyph} human in the loop
          </span>
        )}
      </div>
    </Link>
  );
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const author = getAuthor(username);
  if (!author) notFound();

  const blueprints: Blueprint[] = allBlueprints().filter(
    (b) => b.author.username === username,
  );
  const cards = allNodeCards().filter((record) => record.card.author === username);

  const ontology = getOntologyView();
  const registry = getRegistry();
  const totalDownloads = blueprints.reduce((n, b) => n + b.downloads, 0);
  const published = blueprints.length + cards.length;

  return (
    <div className="container-page py-12">
      <ProfileHeader author={author} />

      {/* Counted archive facts and illustrative community signals are different kinds of
          evidence. They get different panels instead of sharing one undifferentiated row. */}
      <section
        aria-label="Profile summary"
        className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"
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

      {/* Published content */}
      <div className="mt-14 flex flex-col gap-14">
        {published === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-surface/40 px-6 py-16 text-center">
            <p className="font-display text-lg text-fg">Nothing published yet</p>
            <p className="max-w-md text-sm text-muted">
              {author.displayName} hasn&apos;t shared a blueprint or a node card
              with the registry so far.
            </p>
            <ButtonLink href="/blueprints" variant="outline" size="sm">
              Browse the registry
            </ButtonLink>
          </div>
        ) : (
          <>
            {blueprints.length > 0 && (
              <section className="flex flex-col gap-5">
                <SectionTitle
                  label="Blueprints"
                  dot="var(--color-cyan)"
                  count={blueprints.length}
                />
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
                  {cards.map((record) => (
                    <NodeCardTile
                      key={record.ref}
                      record={record}
                      typeLabel={
                        ontology.resolve(record.card.type, "node-type")?.term.label ??
                        record.card.type
                      }
                      usedIn={registry.usersOf(record.id).length}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* Forks. The author settled the model this pass: "the fork can be private to a
            user, the idea follows exactly the idea of github", and said it lands on this
            page. It does, eventually — a fork belongs to an account and the owner's
            profile is where their own would be listed. Nothing of that exists, so this
            states the shape and marks it, rather than rendering an empty section that
            reads as "this builder has forked nothing". Same treatment as the seeded stats
            above: say which half is real. */}
        <aside className="flex flex-col gap-3 rounded-lg border border-dashed border-amber/25 bg-amber/5 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-lg font-semibold text-fg">
                Private forks
              </h2>
              <ComingSoonBadge />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Account-owned copies are not stored yet. Today, adapting a blueprint means
              copying its folder locally; this profile never learns that you did.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
