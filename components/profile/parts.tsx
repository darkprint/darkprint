import Link from "next/link";

import type { CardVersionRecord } from "@/lib/core";
import { HUMAN_PRESENCE_MARK, compact } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

/** Section header: a keyed dot, the label, and how many there are. */
export function SectionTitle({
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
 * The seeded community-support figure, in the pill `FavoriteStar` draws for its own
 * `count`/`seeded` branch.
 *
 * A node card had no support figure at all before this pass, and the design asks for one
 * on the tile. It is spelled out here rather than mounted from `FavoriteStar` because that
 * component pairs the pill with a bookmark button, and a tile inside a stretched link has
 * exactly one control on it already. Same border, same ground, same amber `◐`, same
 * `aria-label`, so the two read as one figure wherever they appear together.
 */
export function SupportPill({ count }: { count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-0.5 font-mono text-[11px] text-muted"
      title="Seeded support count; no community backend is connected"
      aria-label={`${count} community stars, seeded`}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      >
        <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
      </svg>
      {compact(count)}
      <span className="text-amber" aria-hidden>
        ◐
      </span>
    </span>
  );
}

/**
 * One authored node card, at gallery altitude: what it is, what it does, and how far it
 * has travelled. The full interface, version history and source live on the card's page.
 */
export function NodeCardTile({
  record,
  typeLabel,
  usedIn,
  support,
}: {
  record: CardVersionRecord;
  typeLabel: string;
  usedIn: number;
  support: number;
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
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3 font-mono text-[11px] text-dim">
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
        <span className="ml-auto">
          <SupportPill count={support} />
        </span>
      </div>
    </Link>
  );
}

/**
 * The find box on an owner's shelf, drawn and switched off.
 *
 * Both owner lists carry one, so it is one component: the blueprints tab had it inline and
 * the cards tab was asked for the same control, and two copies of a disabled input is two
 * places for the placeholder, the height and the cursor to drift apart.
 *
 * It is `disabled` rather than live for the reason the whole pass is: nothing here is
 * wired. A note under the toolbar says so in the site's own vocabulary, which is the rule
 * that keeps a drawn control from reading as a broken one.
 */
export function DeadSearch({ placeholder, label }: { placeholder: string; label: string }) {
  return (
    <span className="flex h-10 min-w-[16rem] flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3">
      <span aria-hidden className="text-[13px] text-dim">
        ⌕
      </span>
      <input
        type="text"
        disabled
        placeholder={placeholder}
        aria-label={label}
        className="h-full min-w-0 flex-1 cursor-not-allowed bg-transparent text-sm text-fg placeholder:text-dim"
      />
    </span>
  );
}

/** What a section says when it has nothing to list. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-surface/40 px-5 py-16 text-center">
      <p className="font-display text-lg text-fg">{title}</p>
      <p className="max-w-md text-sm text-muted">{children}</p>
      {action !== undefined && (
        <ButtonLink href={action.href} variant="outline" size="sm">
          {action.label}
        </ButtonLink>
      )}
    </div>
  );
}
