import { cx } from "@/lib/format";

/**
 * One file of the folder, drawn as the file.
 *
 * The shell is `SourcePanel`'s, down to the radius and the title bar, because a reader who
 * has seen a bundle's source on `/blueprints/<owner>/<slug>` should recognise this as the
 * same object. What it cannot be is `SourcePanel` itself: that component takes a string
 * and splits it into read-only lines, and every panel here is half input fields.
 *
 * ── one block element per line, and this is not a style choice ──
 * JSX drops a text node that is only a newline, so a `<pre>` whose children are elements
 * separated by line breaks in the source renders as one long line. Every line inside a
 * panel is therefore its own `<Line>`, and the `<pre>` sets no `white-space` of its own
 * beyond `pre` for the leading indentation each line carries.
 */
export function FilePanel({
  name,
  meta,
  children,
  className,
}: {
  /** The path, mirrored live: `cards/<id>@1.0.0.yaml` moves as the reader types the id. */
  name: React.ReactNode;
  /** Which part of the file this panel is, when a file is split across two steps. */
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("panel min-w-0 overflow-hidden", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="label normal-case tracking-[0.06em]">{name}</span>
        {meta === undefined ? null : <span className="label">{meta}</span>}
      </div>
      <pre className="min-w-0 overflow-x-auto whitespace-pre px-4 py-3 font-mono text-[13px] leading-[2.1]">
        {children}
      </pre>
    </div>
  );
}

/** One line of a file. See the panel's docblock for why every line is an element. */
export function Line({ children }: { children?: React.ReactNode }) {
  return <div>{children ?? " "}</div>;
}

/** A YAML key, or a DOT attribute name: the part of a line the reader does not write. */
export function Key({ children }: { children: React.ReactNode }) {
  return <span className="text-copper-line">{children}</span>;
}

/**
 * A line, or part of one, that the tutorial supplies rather than asking for.
 *
 * Dim rather than absent, because the reader has to be able to see what a card carries
 * around the four fields they are filling in. A file panel showing only the blanks would
 * teach the blanks and not the card.
 */
export function Given({ children }: { children: React.ReactNode }) {
  return <span className="text-dim">{children}</span>;
}

/** An aside on a line, in the file's own comment syntax. */
export function Note({ children }: { children: React.ReactNode }) {
  return <span className="text-dim">{children}</span>;
}
