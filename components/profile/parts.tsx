import { compact } from "@/lib/format";
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
 * The find box, drawn and switched off.
 *
 * It is `disabled` rather than live for the reason the whole pass is: nothing here is
 * wired. `ShelfToolbar` is the only caller, so the note that says so travels with it and a
 * drawn control cannot be shipped without the sentence explaining it.
 */
function DeadSearch({ placeholder, label }: { placeholder: string; label: string }) {
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

/**
 * The strip above a shelf: the find box, whatever else that shelf offers, and the note
 * saying what is switched off.
 *
 * All four shelves carry one now, the two the owner sees and the two a visitor sees. That
 * is the author's call and it is the right one for a reason worth writing down: a control
 * that appears only on your own copy of a page teaches a reader that finding is an owner's
 * privilege, which is not a claim this site wants to make about a public registry.
 *
 * The note is not optional and not a default. Every one of these boxes is drawn and
 * disabled, and the pass's own rule is that a switched-off control ships with the sentence
 * saying so; making the sentence a required prop is how that rule survives the next shelf.
 */
export function ShelfToolbar({
  placeholder,
  label,
  note,
  children,
}: {
  placeholder: string;
  label: string;
  /** What is switched off here, after the `◐ seeded` marker. */
  note: React.ReactNode;
  /** Controls this shelf has beyond the find box. The owner's blueprints have three. */
  children?: React.ReactNode;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <DeadSearch placeholder={placeholder} label={label} />
        {children}
      </div>
      <p className="font-mono text-[11px] text-dim">
        <span className="text-amber">◐ seeded</span> · {note}
      </p>
    </>
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
