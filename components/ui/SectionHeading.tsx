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
   * The element the title renders as. A section inside a page is an `h2` and that is
   * the default; a route that uses this block *as* its page title passes `h1`, so the
   * document has a level-one heading instead of starting the outline at two. Purely
   * semantic — the type scale is the same either way.
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
      <Title className="font-display text-3xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">
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
