import Link from "next/link";

import { cx } from "@/lib/format";

/* ============================================================
   The sentence and the one link that close beats 2 and 3.

   Both beats open on a figure that turns into the file behind it —
   `BlueprintWalk` for the graph, `CardWalk` for the card — and both
   used to end on the last line of that scroll with nowhere to go.
   The author asked for a caption under each drawing: what the beat
   just showed, in one sentence, and a link to the page that owns the
   subject in full.

   One component rather than two blocks of identical markup, because
   the pair are the same move on the same page and a reader meets them
   forty seconds apart. If they drift, the second one reads as a
   different kind of thing than the first.

   Centred, because the heading above each figure is centred and the
   figure itself is a centred box. Left-aligning the caption under a
   centred column is the mismatch `SectionNodeIsCard`'s own note
   describes, pointing the other way.

   The sentence is `text-muted` and the link carries the colour, because
   `app/globals.css` spends colour on "you can act on this" and the link
   is the only actionable thing in the block.

   WHICH colour is now the caller's, on the author's instruction
   (2026-08-12: "use the orange color for the text in the homepage
   'Card format reference →'"). It was cyan for both beats, on the
   argument that the poles — `blueprint-line` above, `copper-line`
   below — belong to the headings and a caption should not put a third
   colour under a two-colour scene. The author has read the built page
   and ruled the other way for the card beat, and the reasoning is
   available: a reader who has just watched a copper figure turn into a
   copper listing arrives at a cyan link, and the one thing on the site
   that has an established colour of its own hands off in the site
   default. Cyan stays the default here, so the blueprint beat is
   untouched and any future caption gets the general rule.
   ============================================================ */

/**
 * Which pole the link wears.
 *
 * Tailwind classes are written out per tone rather than interpolated: `cx` is not
 * `tailwind-merge`, so a `text-${tone}` would emit a class the compiler never scanned and
 * the link would render with no colour at all.
 */
const TONE = {
  cyan: "text-cyan decoration-cyan/40 hoverable:hover:decoration-cyan",
  copper: "text-copper-line decoration-copper-line/40 hoverable:hover:decoration-copper-line",
} as const;

export function BeatCaption({
  children,
  href,
  cta,
  tone = "cyan",
}: {
  /** The sentence under the drawing. One sentence; the figure has already argued it. */
  children: React.ReactNode;
  /** The page that owns this subject at full length. */
  href: string;
  /** What the link says. Names the destination, never "learn more". */
  cta: string;
  /** The link's pole. `copper` where the beat above it is the node card's. */
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="mx-auto mt-10 max-w-2xl text-center">
      <p className="text-[15px] leading-relaxed text-muted">{children}</p>
      <Link
        href={href}
        className={cx(
          "mt-5 inline-block font-mono text-[13px] underline underline-offset-4 transition-colors",
          TONE[tone],
        )}
      >
        {cta} →
      </Link>
    </div>
  );
}
