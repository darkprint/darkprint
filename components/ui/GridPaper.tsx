import { cx } from "@/lib/format";

/* ============================================================
   The graph paper, at the weight the site draws it, under a mask the caller chooses.

   ── What is shared here, and what deliberately is not ──
   Shared: how heavy the ruling is. Not shared: where the clearing opens. That split is not a
   guess — it is what the author's two reports over 2026-08-12 came down to. Asked for the
   hero's ground on the two registry shelves, I shared the hero's mask string; the shelves
   drew their clearing behind an opaque filter panel and the author could not see a pattern
   at all. The geometry has to be tuned per box, because a percentage means a different pixel
   in an 886px section than in a 544px band. The WEIGHT has to be one thing, because two
   grounds that are meant to read alike will drift the moment only one of them is adjusted —
   which is the state this component was extracted out of.

   ── Two layers, and why not one class at twice the opacity ──
   `.tech-grid` is one 48px rule in cyan at 6%. That is calibrated for the hero as it was:
   a full screen of paper with a lockup on it. It is too faint anywhere a title, a lead and
   an opaque panel sit over 500px of it, and the author read the first attempt and reported
   no pattern.

   So the ruling is drawn twice and the two add. That is this site's own move rather than a
   new one: `GridSpotlight` reveals a second copy of the hero's grid under the pointer, and
   its docblock says exactly what happens — "the two layers add and the ruling roughly
   doubles". This is that, held still. A second grid class at 12% would be one more number to
   keep in step with the first, for the same pixels.

   Three was tried and rejected on the built page: at 18% the ruling starts competing with
   the wordmark for the eye, which is the one thing a ground may not do.

   The mask sits on the outer element, so one clearing clips both layers and the inner one
   carries no geometry at all.
   ============================================================ */

export function GridPaper({
  mask,
  className,
}: {
  /** The clearing, as a `mask-image` value. Tuned to the box — see the note above. */
  mask: string;
  /** Where the paper sits. `inset-0` for a whole section, a height for a band. */
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cx("tech-grid pointer-events-none absolute", className)}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <span aria-hidden className="tech-grid absolute inset-0 block" />
    </div>
  );
}
