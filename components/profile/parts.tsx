import { compact } from "@/lib/format";
import { ButtonLink } from "@/components/ui/Button";
import { FindBox } from "./FindBox";

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
 * The strip above a shelf: the live find box, whatever else that shelf offers, and an
 * optional line of context beneath both.
 *
 * All the shelves carry the find box now, the ones the owner sees and the ones a visitor
 * sees alike. That is the author's call and it is the right one for a reason worth writing
 * down: a control that appears only on your own copy of a page teaches a reader that
 * finding is an owner's privilege, which is not a claim this site wants to make about a
 * public registry.
 *
 * `note` used to be required, because the pass's own rule was that a switched-off control
 * ships with the sentence explaining it. The find box is live now — `FindBox` and the shelf
 * it narrows share `?q=` through `useQueryState`, no server round trip — so there is
 * nothing left to apologise for by default; a caller still passes `note` where a shelf has
 * something else worth saying (a row count, what a filter does or does not reach).
 */
export function ShelfToolbar({
  placeholder,
  label,
  note,
  children,
}: {
  placeholder: string;
  label: string;
  /** A line of context under the toolbar. Optional now that the find box is live. */
  note?: React.ReactNode;
  /** Controls this shelf has beyond the find box. The owner's blueprints have three. */
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <FindBox placeholder={placeholder} label={label} />
        {children}
      </div>
      {note !== undefined && <p className="font-mono text-[11px] text-dim">{note}</p>}
    </>
  );
}

/**
 * What a shelf's own inline empty state says, once `visibility` and `q` have narrowed it
 * to nothing.
 *
 * **The bug this replaces:** both shelves printed `No {visibility} rows on this shelf.`
 * unconditionally, and `visibility` is `string | null` straight off `useQueryState` — so
 * the unfiltered state (every option, "Visibility: all") rendered the literal sentence
 * `No null rows on this shelf.` The fix has to name a case for "no filter is active" rather
 * than trust that `visibility` is always a word, and it has to do the same for `q` now that
 * a shelf can be empty because a search matched nothing rather than because the filter did.
 */
export function shelfEmptyMessage(noun: string, visibility: string | null, query: string): string {
  const trimmed = query.trim();
  if (trimmed !== "" && visibility !== null) return `No ${visibility} ${noun} match “${trimmed}”.`;
  if (trimmed !== "") return `No ${noun} match “${trimmed}”.`;
  if (visibility !== null) return `No ${visibility} ${noun} on this shelf.`;
  return `No ${noun} on this shelf.`;
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
