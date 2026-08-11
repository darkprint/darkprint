/* ============================================================
   The paper, and the drawing on it.

   `Sheet` is the cyanotype register the site already uses: the
   `.bp-grid` graticule, a hairline border, corner ticks from
   `.tick-frame`, and a title block along the bottom. Nothing new
   goes into `app/globals.css` for it; both classes are already
   there and already used by `ContentCard`, `SectionDoors` and the
   ontology page, which is the point — a scene drawn on a Sheet
   sits in the same visual family as the pages around it.

   `Scene` is the `<svg>` itself, and it exists so that no scene
   author has to remember the four attributes that keep spec §1
   true: a `viewBox` and a matching `aspect-ratio` so the box is
   reserved before anything paints and nothing shifts, an
   accessible name because a drawing is an image, and the mono
   family so a label inside a drawing matches a label outside one.

   Neither is a client component. They render markup and nothing
   else, so a server page may draw a static scene with them, and a
   client scene that animates the same glyphs pulls them into its
   own bundle unchanged.
   ============================================================ */

import { cx } from "@/lib/format";

import { SHEET_REGISTER, VIZ, type SheetRegister } from "./tokens";

export function Sheet({
  children,
  register = "blueprint",
  border,
  label,
  title,
  note,
  className,
  bodyClassName,
  ref,
}: {
  children: React.ReactNode;
  /** Which pole the sheet is drawn on. Blueprint by default. */
  register?: SheetRegister;
  /**
   * The frame's colour, when it should differ from the register's own.
   *
   * A prop rather than something `className` can do, because the border is set through
   * `style` here and inline wins. Added 2026-08-11 for beat 2, where the two sheets are the
   * same drafting paper and only one of them is a blueprint: the left panel draws what a
   * harness did without one, and framing it in `--color-blueprint` puts the site's word for
   * a specification around the figure that says there isn't one. The surface and the
   * graticule stay the register's, because it is still the same sheet of paper.
   */
  border?: string;
  /** Mono caption along the top edge. The drawing's number or subject. */
  label?: React.ReactNode;
  /** Title block, left. What the drawing is of. */
  title?: React.ReactNode;
  /** Title block, right. A scale, a count, a version. */
  note?: React.ReactNode;
  className?: string;
  /** Padding around the drawing. Override to run a scene to the sheet's edge. */
  bodyClassName?: string;
  ref?: React.Ref<HTMLDivElement>;
}) {
  const paper = SHEET_REGISTER[register];

  /* The two variables every glyph reads (see `tokens.ts`). Declared on the sheet so a
     `NodeBox` inside it needs no colour of its own and stays legible on either register.
     The cast is the standard one: `CSSProperties` has no index signature for custom
     properties. */
  const style = {
    background: paper.surface,
    borderColor: border ?? paper.border,
    color: paper.ink,
    "--viz-ink": paper.ink,
    "--viz-line": paper.line,
  } as React.CSSProperties;

  const rule = { borderColor: border ?? paper.border };

  return (
    <div
      ref={ref}
      /* A flex column, so that a sheet which is TALLER than its contents can say where the
         slack goes. Nothing stretched a sheet until beat 2 put two of them in a subgrid row;
         a block sheet stacks body then title block and leaves the surplus underneath, which
         floats the title block off the bottom edge and reads as an unfinished frame. The
         strip below takes `mt-auto` and the slack falls above it instead.

         A no-op at the other call sites, checked in the browser and not only reasoned about:
         with no free space `margin-top: auto` resolves to zero, and every child here is a
         full-width block with no vertical margin, so a column flex box lays them out exactly
         as block flow did. Beat 2's left sheet is the only one that reports a non-zero top
         margin on the strip. */
      className={cx("relative isolate flex flex-col overflow-hidden rounded-lg border", className)}
      style={style}
    >
      <div aria-hidden className={cx("pointer-events-none absolute inset-0", paper.grid)} />
      {/* `.tick-frame` hangs its ticks a pixel outside the element, so it goes on an inset
          overlay rather than on the sheet, where `overflow-hidden` would shave them. */}
      <div aria-hidden className="tick-frame pointer-events-none absolute inset-2" />

      {label !== undefined && (
        <div className="relative border-b px-4 py-2.5" style={rule}>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: paper.line }}
          >
            {label}
          </span>
        </div>
      )}

      <div className={cx("relative", bodyClassName ?? "p-4 sm:p-6")}>{children}</div>

      {(title !== undefined || note !== undefined) && (
        <div
          /* `px-5` and not `px-4`, and the single pixel is the whole reason.
             ------------------------------------------------------------
             `.tick-frame` sits at `inset-2` and hangs its ticks a pixel outside itself, so a
             corner tick occupies 7px to 19px in from the sheet's edge. At `px-4` this rail's
             text ended at 16px — inside that span — and every sheet on the site drew its
             bottom-right note through the corner tick. It is visible on the blueprint pages
             and on the ladder, and it is the kind of defect that reads as "unfinished" long
             before a reader can say why.

             20px clears 19 by one pixel. That is thin, but it is measured rather than
             guessed, and 20 is the canonical spacing tier — 24 is not one, and the next tier
             up (40) would put the note a quarter of the way into the sheet. If a tick ever
             grows past 12px, this has to move with it. */
          className="relative mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t px-5 py-2.5"
          style={rule}
        >
          <span className="font-mono text-[11px] tracking-[0.06em]">{title}</span>
          <span className="font-mono text-[11px]" style={{ color: paper.line }}>
            {note}
          </span>
        </div>
      )}
    </div>
  );
}

export function Scene({
  width,
  height,
  label,
  children,
  className,
  id,
  ref,
}: {
  /** viewBox width in scene units. `tokens.ts` metrics are in the same units. */
  width: number;
  height: number;
  /**
   * The accessible name, required.
   *
   * A scene carries its meaning in a drawing, and `role="img"` with no name is an image a
   * screen reader announces as nothing at all. The name says what the drawing shows; the
   * prose beside it carries the argument.
   */
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Written as `data-viz-scene`, for an anime.js scope rooted on this element. */
  id?: string;
  ref?: React.Ref<SVGSVGElement>;
}) {
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      /* Belt and braces against layout shift: `height: auto` on a viewBox'd svg is
         enough in current browsers, and the declared ratio is what reserves the box
         before the svg is laid out at all. */
      style={{ aspectRatio: `${width} / ${height}` }}
      className={cx("block h-auto w-full", className)}
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      fontFamily={VIZ.font.family}
      data-viz-scene={id}
    >
      {children}
    </svg>
  );
}
