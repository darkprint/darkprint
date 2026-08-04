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
   * The element the title renders as, and now the size it renders at.
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
   * A page title now steps up rather than a section stepping down, so nothing that was
   * legible gets smaller: `h1` gains a size at `sm` and above, `h2` keeps exactly what
   * every section already had.
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
          "font-display font-semibold leading-tight tracking-tight text-fg",
          Title === "h1" ? "text-3xl sm:text-5xl" : "text-3xl sm:text-4xl",
        )}
      >
        {title}
      </Title>
      {/* Full width, not `max-w-2xl`. The measure was set for readability and the author
          overruled it twice by pointing at the wrapped result: "the subdescription of the
          title ... should occupy the full horizontal span ... the text should reach the
          right." A centred block keeps its measure through `align`, and a caller that
          genuinely wants a narrow lead can pass one on `className`. */}
      {lead && <p className="text-base leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}
