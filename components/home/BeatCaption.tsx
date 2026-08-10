import Link from "next/link";

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

   The link is cyan and the sentence is `text-muted`: `app/globals.css`
   spends cyan on "you can act on this", and this is the only actionable
   thing in the block. The beats' own poles — `blueprint-line` above,
   `copper-line` below — stay on the headings, so the caption does not
   put a third colour under a figure that is already a two-colour scene.
   ============================================================ */

export function BeatCaption({
  children,
  href,
  cta,
}: {
  /** The sentence under the drawing. One sentence; the figure has already argued it. */
  children: React.ReactNode;
  /** The page that owns this subject at full length. */
  href: string;
  /** What the link says. Names the destination, never "learn more". */
  cta: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-2xl text-center">
      <p className="text-[15px] leading-relaxed text-muted">{children}</p>
      <Link
        href={href}
        className="mt-5 inline-block font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
      >
        {cta} →
      </Link>
    </div>
  );
}
