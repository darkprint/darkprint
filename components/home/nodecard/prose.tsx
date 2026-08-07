/* ============================================================
   The three ways this section spells things, in one place.

   `CardWalk` and `CardBreakdown` are two mounts of one figure —
   the landing walks the nine parts on scroll, `/spec/card` lets a
   reader pick them — and everything that is not the interaction is
   shared between them: `annotations.ts` resolves the same nine runs
   against the same bytes, `yaml.ts` tokenises them, `YamlListing`
   draws them. These three functions are the last of that shared
   half, and they were about to become a second copy in the second
   file.

   Small enough that copying them would have looked free, and none
   of them is: the step number, the line span and the inline-code
   rule are how the rail and the listing say the SAME thing about
   the same run, and a figure that spelled a run `L24-27` in one
   mount and `L24–27` in the other would be two figures.

   `components/panes/DotBreakdown.tsx` carries its own `ordinal`,
   `lineSpan` and `body`, with the same bodies and a note that the
   en dash is spelled "the way `CardWalk` spells it". That is a
   third copy and it is deliberately left alone here: this module
   lives under `components/home/nodecard/`, the DOT breakdown is a
   different register on a different layer, and collapsing the two
   is a decision for whoever owns both directories rather than a
   side effect of this change.
   ============================================================ */

/**
 * Two digits, so a column of step numbers has a straight left edge rather than a ragged
 * one. Nine steps never reach three digits; `padStart` is the cheap way to say so.
 */
export function ordinal(step: number): string {
  return String(step).padStart(2, "0");
}

/**
 * `L17` for one line, `L24–27` for a run.
 *
 * An en dash, not a hyphen: it is a range rather than a compound. It is also why anything
 * that reads a span ALOUD has to respell it — a screen reader gives "L24 dash 27" or
 * nothing at all — which is what the live region in `CardBreakdown` does in words.
 */
export function lineSpan(from: number, to: number): string {
  return from === to ? `L${from}` : `L${from}–${to}`;
}

/**
 * Backticked identifiers in an annotation body render as inline code.
 *
 * The bodies in `annotations.ts` are strings rather than JSX because
 * `nodecard.test.ts` measures their length and greps them for diagnostic codes, and a
 * tree of elements is neither measurable nor greppable. The backtick is the seam, and
 * this is the only place it is read.
 */
export function body(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code
        key={i}
        className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-fg"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
