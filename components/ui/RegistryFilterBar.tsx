"use client";

import { useState } from "react";

import { cx } from "@/lib/format";

/* ============================================================
   The control bar the three registry browsers share.

   `GalleryBrowser.tsx` has documented this extraction since before it was possible: its
   `fieldClass` and its sticky disclosure were near-duplicates of `NodeBrowser.tsx`'s, and
   it said the right home was a shared component "that both browsers and a future
   `/ontology` one mount", deliberately not extracted because that pass owned one file.
   The accounts pass gives the vocabulary its own browser, so there are three consumers and
   the note comes due.

   ── What is shared, and what deliberately is not ──
   Shared: the field and control shapes, the `role="search"` panel, and the sticky
   disclosure that panel hides behind on a phone. All three are chrome, and all three had
   two copies that had already drifted — the gallery's search input carried a comment
   recording that the node browser's contrast fix "was never applied to this file".

   Not shared: which filters exist. A blueprint filters by category, phase, autonomy class
   and tag; a card filters by type, phase and two flags; a term filters by kind. A component
   that took all of those as props would be a second, worse copy of each browser's own
   state, so each one passes its controls in as children and keeps its `useQueryState` to
   itself.

   ── The one thing every caller must keep ──
   The disclosure exists because at 378px the gallery's panel was 282px tall and the first
   tile began one pixel past the fold: a reader who asked for a shelf met a form. It is one
   panel, not two — a second copy behind a media query would duplicate every input, every
   id and every tab stop, which is worse for a screen reader than the problem it solves. So
   the panel is hidden by state below `sm` and forced visible from `sm` up, and the button
   only exists below `sm`.
   ============================================================ */

/**
 * The shape every field and select in a filter bar takes.
 *
 * 40px, so a row of controls is one height. `focus:border-cyan` and no `outline-none`: the
 * unlayered `:focus-visible` rule in `app/globals.css` is the keyboard guarantee and a
 * utility here would outrank it.
 */
export const FIELD_CLASS =
  "h-10 rounded-md border border-line bg-surface-2 px-3 font-mono text-xs text-fg transition-colors focus:border-cyan";

/** The same shape plus the responsive width a `<select>` in that row wants. */
export const CONTROL_CLASS = `${FIELD_CLASS} w-full sm:w-auto`;

/**
 * The search field, with the `/` standing in its left gutter.
 *
 * `placeholder:text-dim` and never `text-faint`: a placeholder is the only hint of what a
 * field accepts, and `--color-faint` reads 1.83:1 and is for decorative separators. That
 * fix was made once on the node browser and lived only there for two passes, which is one
 * of the two reasons this file exists.
 */
export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-w-[14rem] flex-1">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-dim"
      >
        /
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cx(FIELD_CLASS, "w-full pl-8 placeholder:text-dim")}
      />
    </div>
  );
}

export function RegistryFilterBar({
  id,
  label,
  results,
  total,
  active,
  children,
}: {
  /** The panel's id, so the phone button can name what it controls. */
  id: string;
  /** What a screen reader calls this landmark: "Filter blueprints". */
  label: string;
  /** How many rows survive the filters, and how many there are. */
  results: number;
  total: number;
  /** How many filters are on. Drawn as a count beside the word on the phone button. */
  active: number;
  /** The caller's own controls. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* `z-40` — page chrome on the site's one z ladder (header 50 · page chrome 40 ·
          section chrome 30 · card furniture 20 · a card's stretched hit target 10). It was
          `z-20` on the gallery once, which is the tier a card's own furniture sits on, and
          a card `<article>` is `relative` with `z-index: auto`, so its `z-20` children
          competed with the bar directly and won on DOM order: a bookmark covering the
          result count, an avatar punching through the bar's lower border. */}
      <div className="sticky top-16 z-40 -mx-1 bg-void/95 px-1 py-2 backdrop-blur-sm sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          /* `scale-[0.99]`, the >200px band: this bar runs the full width of the phone, and
             0.97 on a 342px element travels 10px sideways, which reads as a wobble rather
             than as a press. `scale` is named beside `transform` because Tailwind v4
             compiles `scale-[…]` to the standalone `scale` property. */
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2.5 font-mono text-xs text-fg transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-line-bright hoverable:active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-cyan">
              {open ? "▾" : "▸"}
            </span>
            Filter
            {active > 0 && (
              <span className="rounded-full bg-cyan/15 px-2 py-0.5 tabular-nums text-cyan">
                {active}
              </span>
            )}
          </span>
          <span className="tabular-nums text-dim">
            {results}/{total}
          </span>
        </button>
      </div>

      {/* `role="search"`, because it is one: without it the landmark list on these pages
          was HEADER / NAV / MAIN / FOOTER, and the thing the page is for had no name in it.

          `px-4 py-3`, not `p-4`: the horizontal padding is the element tier and the
          vertical is the tight tier, because what sits inside is a row of 40px controls
          rather than a paragraph. */}
      <div
        id={id}
        role="search"
        aria-label={label}
        className={cx("panel flex-col gap-4 px-4 py-3 sm:flex", open ? "flex" : "hidden")}
      >
        {children}
      </div>
    </>
  );
}
