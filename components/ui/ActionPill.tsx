import { compact, cx } from "@/lib/format";

/* ============================================================
   The header's action control: a label and a figure in one outlined pill.

   GitHub's split button, and the reason to copy it here is not the look. The header actions
   each carry a number a reader compares across bundles (forks, stars), and before this the
   number was a `<span>` tacked inside a `Button` label — so "Fork 12" read as one word and
   the figure sat at whatever width the label left it. Splitting the count into its own cell
   with its own rule gives the pills a shared column of figures, which is what makes a row of
   them scannable.

   The figure half is `font-mono text-[11px]`, the same treatment every other count on this
   site gets, and it runs through `compact` so a four-figure count cannot stretch the row.

   ── Why this is not a `Button` variant ──
   `Button` puts one padding box around one label; the whole point here is two boxes with a
   rule between them, and every caller would have had to re-declare the inner spans anyway.
   What IS copied from `Button`, deliberately, is the press: `duration-[120ms]` with the
   site ease and `scale` NAMED in the transition list, because Tailwind v4 compiles
   `scale-[0.97]` to the standalone `scale` property and a list naming only `transform`
   does not cover it (see `Button.tsx`'s own note).

   ── Disabled ──
   `opacity-60` and no `pointer-events-none`, for `Button`'s reason: the `disabled`
   attribute already blocks activation, and killing pointer events is what stops a
   switched-off control from showing the `title` that says why it is off. Every disabled
   caller here has one.
   ============================================================ */

/**
 * `"watch"` was the third member, an eye over a pupil, and it left with the Watch pill the
 * owner asked off the blueprint band on 2026-09-06. Nothing else drew it: the profile page's
 * own Watch control (`components/profile/SocialControls.tsx`) is a `Button` over the same
 * `/api/authors/{handle}/watch` route and never used this component, so the route keeps its
 * reader and this union keeps only the glyphs something renders.
 */
export type ActionGlyph = "fork" | "star";

/** 14px, `aria-hidden`: the label beside it already carries the meaning. */
function Glyph({ name, filled }: { name: ActionGlyph; filled: boolean }) {
  const common = {
    "aria-hidden": true,
    viewBox: "0 0 24 24",
    width: 14,
    height: 14,
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
  };

  if (name === "fork") {
    return (
      <svg {...common} fill="none">
        <circle cx="6.5" cy="5.5" r="2.25" />
        <circle cx="17.5" cy="5.5" r="2.25" />
        <circle cx="12" cy="18.5" r="2.25" />
        <path d="M6.5 7.75v1.5a2.5 2.5 0 0 0 2.5 2.5h6a2.5 2.5 0 0 0 2.5-2.5v-1.5M12 11.75v4.5" />
      </svg>
    );
  }

  return (
    <svg {...common} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
    </svg>
  );
}

const BASE =
  "inline-flex h-9 select-none items-stretch overflow-hidden whitespace-nowrap rounded-md border text-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)]";

export function ActionPill({
  glyph,
  label,
  count,
  active = false,
  disabled = false,
  title,
  pressed,
  onClick,
  ariaLabel,
  marker,
  className,
}: {
  glyph: ActionGlyph;
  label: string;
  count: number;
  /** The reader has already done this: their star, the author they watch. */
  active?: boolean;
  disabled?: boolean;
  /** Why the control is off, or what pressing it would ask of the reader. */
  title?: string;
  /** Omitted rather than `false` for a control that is an action instead of a toggle. */
  pressed?: boolean;
  onClick?: () => void;
  /** Replaces the label+count a screen reader would otherwise read as one run. */
  ariaLabel?: string;
  /** A glyph inside the figure cell, for a number that is not read from a live store. */
  marker?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      title={title}
      className={cx(
        BASE,
        active ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-line-bright bg-transparent text-fg",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hoverable:hover:border-cyan hoverable:hover:text-cyan hoverable:active:scale-[0.97]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5 pl-3 pr-2.5">
        <Glyph name={glyph} filled={active} />
        {label}
      </span>
      {/* The rule between the halves is the control's own border colour when it is active,
          so a starred pill does not draw a grey line across a cyan box. */}
      <span
        className={cx(
          "inline-flex items-center gap-1 border-l px-2.5 font-mono text-[11px]",
          active ? "border-cyan/50 text-cyan" : "border-line text-dim",
        )}
      >
        {compact(count)}
        {marker}
      </span>
    </button>
  );
}
