import { cx } from "@/lib/format";

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cx("eyebrow", className)}>{children}</span>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "left",
  as: Title = "h2",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  /**
   * The element the title renders as, and the size it renders at.
   *
   * It used to be "purely semantic — the type scale is the same either way", and that
   * was the defect. Both levels drew at `text-3xl sm:text-4xl`, so on any page using
   * this block for its title *and* for a section, the two were pixel-identical at 36px
   * and the page appeared to start twice. Measured on `/spec`: `h1` 36 → `h2` 24 → `h2`
   * 24 → `h2` **36**, three sizes at one level. `/spec/scoring` had already tried to
   * cure the same boundary by deleting a second eyebrow, recording that it "made the
   * page look like it started twice" — the eyebrow went and the 36px stayed, which was
   * the louder half of the signal.
   *
   * The first cure applied only at `sm` and above, so the defect survived on every
   * phone: `text-3xl sm:text-5xl` and `text-3xl sm:text-4xl` are BOTH 30px below `sm`.
   * Confirmed in the DOM at 378px on `/spec/card` — h1 "The node card, in YAML" 30px,
   * h2 "A node is a card, and the card is checkable" 30px. Both halves are now fixed:
   * h1 is 36 → 48, h2 is 28 → 32, so the step is 1.5× at every width.
   *
   * h2 went DOWN, not up. A 44px h2 was considered, to close the cliff from the hero
   * down to the first section; it was rejected because it lands 4px from the h1 and
   * re-creates the exact defect this component exists to prevent. The hero comes down
   * to 7rem instead, and the cliff closes from the other end.
   *
   * Leading and tracking are part of the step, not decoration: h1 sets 1.05/-0.02em,
   * h2 sets 1.15/-0.015em. Display type tightens as it grows; a shared `leading-tight`
   * (1.25) left a wrapped 48px title with a 12px gutter it did not need.
   */
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Title
        className={cx(
          "font-display font-semibold text-fg",
          Title === "h1"
            ? "text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl"
            : "text-[28px] leading-[1.15] tracking-[-0.015em] sm:text-[32px]",
        )}
      >
        {title}
      </Title>
      {/* Full width, not `max-w-2xl`, and not `.prose-lane` either. The measure was set
          for readability and the author overruled it twice by pointing at the wrapped
          result: "the subdescription of the title ... should occupy the full horizontal
          span ... the text should reach the right." That ruling stands.

          What was wrong was the SIZE, not the span. At 16px across a 1152px column this
          lead ran 137–150 characters and was the hardest paragraph on its page. At 20px
          it runs ~126 and reads as a deck at full span — which is what the author was
          asking for. `--measure` (via `.prose-lane`) governs body prose; a deck is not
          body prose. Do not re-narrow this. A centred block keeps its measure through
          `align`, and a caller that genuinely wants a narrow lead can pass one on
          `className`. */}
      {lead && <p className="text-lg leading-[1.6] text-muted sm:text-xl">{lead}</p>}
    </div>
  );
}

/**
 * The third and fourth display steps: a panel title, and a sub-block inside one.
 *
 * This tier was missing, and its absence is measurable. On `/nodes/acceptance-tester`
 * the sans sizes run 12, 13, 14, 15, 16, 18 — and then jump straight to 36. There was
 * nothing between a caption and a section title, so panel titles fell back to a 13px
 * mono run and every panel on the page opened at label weight.
 *
 * The rule that comes with it: **a mono uppercase run is a LABEL, and a label is not a
 * heading level.** The seven repo-wide instances of `<h3 className="font-mono
 * text-[11px] uppercase tracking-[0.18em] text-dim">` are each one of two things —
 * a genuine heading, which becomes `<PanelHeading>`, or a column header / meta label,
 * which becomes `<span className="label">` and stops claiming an outline position it
 * never earned. Use `as="h4"` only where an `h3` already sits above it in the document.
 */
const PANEL_HEADING_SIZE = {
  base: "text-base",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;

export function PanelHeading({
  as: Tag = "h3",
  size,
  children,
  className,
}: {
  /**
   * `h2` was added 2026-08-11 for `/skill`'s numbered spine.
   *
   * The size does not follow from it, and that is the point of allowing it here rather
   * than reaching for `SectionHeading`: those three steps are the page's own top-level
   * sections and want to be `h2` in the outline a screen reader walks, but they are panel
   * titles on the screen and drawing them at `SectionHeading`'s 28/32px would put four
   * things at that size on one page. Level and size are separate questions, and this
   * component answers them separately.
   */
  as?: "h2" | "h3" | "h4";
  /**
   * The type size, when the level's default is not the one wanted.
   *
   * A prop rather than a `className`, which is what it was tried as first and does not
   * work: `text-2xl` passed through `className` loses to the `text-xl` below it, because
   * both are font-size utilities at the same specificity and the winner is whichever
   * Tailwind emits later — not whichever the caller wrote last. Measured in the browser at
   * 20px, which is how the assumption was caught.
   *
   * Added 2026-08-11 for `/skill`, whose steps stopped being `.panel` cards: off the
   * chrome the step headings are the only thing separating one step from the next, and the
   * mock draws them at 24. Every other caller omits this and gets exactly what it got
   * before.
   */
  size?: keyof typeof PANEL_HEADING_SIZE;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cx(
        "font-display font-semibold leading-snug tracking-[-0.01em] text-fg",
        PANEL_HEADING_SIZE[size ?? (Tag === "h4" ? "base" : "xl")],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
