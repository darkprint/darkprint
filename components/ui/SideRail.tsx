import Link from "next/link";

import { cx } from "@/lib/format";
import { RAIL_NAV_ID, RailScrollSpy } from "./RailScrollSpy";

/* ============================================================
   The documentation rail: one sticky column on the left, and the page beside it.

   `LearnShell` drew this for the seven Learn routes and nothing else could reuse it,
   because the markup and the data were the same component. The author then asked for the
   same treatment on two more surfaces — "In each blueprint we have `On this blueprint` as
   a panel. Make it on the left as you did for the pages in Learn", and an `On this node`
   rail for the card pages — so the chrome moved here and the three callers now differ only
   in what they put in it.

   ── Why this is presentational, and takes no pathname ──
   Learn's rail is a route list and knows which entry is active from `usePathname`, so its
   caller is a client component. A blueprint's rail is a list of that blueprint's own
   sections, which only the server knows, because the sections come off the resolved bundle.
   A component that reached for `usePathname` itself would force the second case to ship the
   whole page to the browser to draw a list of six links.

   So this file has no hooks and no `"use client"`. It renders whatever it is handed, and
   each caller decides what `active` means on its own surface.

   ── One rail, two kinds of entry ──
   Learn's entries are seven routes with a step number each, and the active one unfolds its
   sections. A blueprint's entries are six anchors into the page a reader is already on:
   nothing is "active", and there is nothing to unfold. Both are `SideRailItem`, and the
   difference is which optional fields are filled rather than which component is mounted.
   Two components would drift the moment one of them got a padding change.
   ============================================================ */

/** One anchor under the rail's heading. */
export interface SideRailSection {
  href: string;
  label: string;
}

/** One top-level row: a route, or a section of the page being read. */
export interface SideRailItem {
  href: string;
  label: string;
  /** Two digits, when the rail numbers its rows. Learn's steps, or a section's position. */
  step?: string;
  /** Whether this row is the page the reader is on. Only a route rail has an answer. */
  active?: boolean;
  /** Shown indented under this row, and only while it is active. */
  sections?: readonly SideRailSection[];
  /** A small figure at the row's right: how much is behind this section. */
  meta?: string;
  /**
   * A run label drawn above this row, with a rule when it is not the first.
   *
   * Learn's rail is two named runs over one list: a specification, and a reading of it. The
   * grouping is presentational, so it is a property of the ROW rather than a second list
   * the caller has to keep in step with the first — a rail built from groups would have to
   * be flattened again for the walk, and the two shapes would drift the first time a stop
   * changed run.
   */
  heading?: string;
  /**
   * Drawn one level in, under the row above it, with a `└` where the step number goes.
   *
   * Not the same thing as `sections`. Those are anchors into the page a reader is already
   * on and only appear under the active row; this is a route of its own that belongs under
   * another one — the worked example under the stop it is an example of — and it is always
   * visible, because a reader has to be able to see it exists.
   */
  indent?: boolean;
  /**
   * A row that leads somewhere destructive, drawn in `--color-signal`.
   *
   * The one place on `/settings` a rail row is not a peer of the rows above it: §07 is
   * the only section whose controls cannot be undone, and a reader jumping down a rail
   * should be told that before they arrive rather than on arrival. Deliberately not a
   * free colour prop — signal means "a defect or a loss" sitewide and a rail that could
   * be painted any hue would be spending the palette rather than reading from it.
   *
   * Ignored on the active row: `active` already owns the row's colour, and two claims
   * about one row is one too many.
   */
  tone?: "signal";
  /**
   * Extra classes for this row.
   *
   * It was the `:target` mark — `body:has(#fields:target) &`, spelled out per row because
   * Tailwind only compiles a class it can read in the source. That mechanism is gone:
   * `RailScrollSpy` marks the row a reader is IN rather than the row they last clicked, and
   * two things lighting two different rows is worse than either alone. Nothing sets this
   * today; it stays because a rail row wanting one class of its own is a cheap escape hatch
   * and removing the prop would be the third edit to this signature in a week.
   *
   * If you do set it: never derive it from `label` or `href`. A computed class is a class
   * the scanner never sees and therefore one that never ships.
   */
  mark?: string;
}

/**
 * The row's track list, keyed `hasStep:hasMeta`.
 *
 * Every one is a literal for the reason `mark` is: Tailwind compiles the classes it can
 * read in the source, and `grid-cols-[${…}]` is not one of them.
 */
const COLUMNS: Record<string, string> = {
  "false:false": "grid-cols-[minmax(0,1fr)]",
  "true:false": "grid-cols-[1.5rem_minmax(0,1fr)]",
  "false:true": "grid-cols-[minmax(0,1fr)_auto]",
  "true:true": "grid-cols-[1.5rem_minmax(0,1fr)_auto]",
};

/**
 * The two-column shell, with the rail pinned under the header.
 *
 * `xl` and not `lg`: the rail costs 16rem, and below 1280px that is taken out of the reading
 * column rather than out of the margin. Under that breakpoint the rail is not rendered at
 * all — it is not hidden behind a toggle — because every surface that mounts one already
 * carries its own way through the page on a phone: Learn keeps the compact sequence in each
 * page footer, and a blueprint is one scroll whose sections announce themselves.
 */
export function SideRail({
  label,
  meta,
  items,
  ariaLabel,
  footer,
  compact = false,
  children,
}: {
  /** The rail's own heading. "Learn", "On this blueprint", "On this node". */
  label: string;
  /** The small mono line under it, when there is a count worth printing. */
  meta?: string;
  items: readonly SideRailItem[];
  /** What a screen reader calls this landmark. Defaults to the visible heading. */
  ariaLabel?: string;
  /**
   * A way out, under a rule, after the last row.
   *
   * The three rails that existed before this one are all complete maps of where a reader
   * already is — a Learn sequence, a page's own sections — so leaving is what the header
   * is for. `/settings` is the first rail whose subject has an owner and therefore a
   * place to go back to, and the design puts that link at the foot of the rail rather
   * than in the page, where it would read as an eighth section.
   *
   * A slot rather than a `backHref` pair, so the rail stays presentational: it draws
   * whatever the caller puts here and holds no opinion about what a way out looks like.
   */
  footer?: React.ReactNode;
  /**
   * The page beside the rail.
   *
   * Optional in the type and required in practice: every route that mounts this passes its
   * whole body. What the optionality buys is a render of the chrome ALONE, which is what
   * `side-rail.test.ts` does — and `react/no-children-prop` forbids putting `children` in a
   * `createElement` props object, so a required `children` would force that guard to choose
   * between the lint rule and the type. `{children}` renders nothing for `undefined`.
   */
  children?: React.ReactNode;
  /**
   * Draw a compact list of the same rows above the page, below `xl`.
   *
   * Opt-in, and the three existing callers deliberately do not take it. The rail is not
   * rendered under `xl` at all — it costs 16rem, and below 1280px that comes out of the
   * reading column — and every surface that mounts one was chosen for having its own way
   * through the page on a phone: Learn keeps the compact sequence in each page footer, and
   * a blueprint or a node is one scroll whose sections announce themselves.
   *
   * `/settings` is the case that has neither. Seven numbered sections, no footer sequence,
   * and a reader on a phone met a page with no map at all — so it asks for this and the
   * others carry on without it. A default-on version would have put a second navigation
   * above four pages that had already decided they did not want one.
   */
  compact?: boolean;
}) {
  return (
    /* The rail and the page it belongs to are one object, centred together.
       ------------------------------------------------------------
       The grid used to be `[16rem_minmax(0,1fr)]` across the whole viewport, and the page
       inside the right column is a `.container-page` — max 1200px with `margin-inline:
       auto`. On a 2044px window that left the column 1788 wide, the container centred
       inside it, and the reading began **318px** to the right of the rail's own rule. A
       reader following a row across to the section it names had a third of a screen of
       nothing to cross.

       Capping the whole shell at `16rem + 75rem` — the rail plus `container-page`'s own
       max-width — is what closes it: the container now fills its column exactly, its 1.5rem
       padding is the entire gap, and the pair sits centred in the window as one block
       rather than as a pinned rail with a floating page beside it. */
    <div className="mx-auto min-w-0 xl:grid xl:max-w-[calc(16rem+75rem)] xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface/25 xl:block">
        {/* `RailScrollSpy` marks the row a reader is actually in, by scroll position. It
            replaced the `:target` marks the three anchor rails carried: `:target` lights
            the row somebody CLICKED and leaves it there, which answers a different question
            from the one a rail is for. See that file for why it is a scroll pass rather
            than an observer. */}
        <RailScrollSpy />
        {/* The list sits in the middle of the viewport, not at the top of it.
            ------------------------------------------------------------
            The rail is `sticky top-16`, so its content used to begin immediately under the
            header and leave the rest of a 900px column empty — a six-row list pinned to the
            ceiling with two thirds of the rule below it blank. The author asked for it
            centred.

            `min-h` fills the viewport and `my-auto` on the inner block does the centring.
            NOT `justify-center` on the flex column: when the list is taller than the
            viewport — the eight-row blueprint rail on a short window — a centred flex child
            overflows in BOTH directions and the scroll container cannot reach the top of it,
            so the first rows become unreachable. Auto margins collapse to zero instead of
            overflowing, so the same markup centres a short list and scrolls a long one.

            ── Above the middle, not on it ──
            True centring put a six-row list halfway down a 900px column, which is further
            from where the reading starts than the ceiling was. The extra bottom padding is
            what moves it: an auto-centred child centres inside the padding box, so 16vh at
            the foot and 1.5rem at the head shifts the block up by roughly 7vh — it lands
            near the upper third, which is where an eye entering the page is already
            looking. The padding is inside the scroll container, so a long list still
            reaches its last row. */}
        <nav
          id={RAIL_NAV_ID}
          aria-label={ariaLabel ?? label}
          className="sticky top-16 flex max-h-[calc(100vh-4rem)] min-h-[calc(100vh-4rem)] flex-col overflow-y-auto px-4 pb-[16vh] pt-6"
        >
          <div className="my-auto">
          <div className="border-b border-line px-3 pb-4">
            <p className="label-lead">{label}</p>
            {meta !== undefined && (
              <p className="mt-2 font-mono text-[11px] text-dim">{meta}</p>
            )}
          </div>
          <ol className="mt-3 flex flex-col gap-1">
            {items.map((item, index) => {
              /* A row into the page a reader is already on is a plain `<a>`, and a row
                 into another route is a `<Link>`.

                 ── Why, and it is not a preference ──
                 `next/link` handles a same-document fragment through the router, which
                 pushes history and scrolls but never puts the document into a `:target`
                 state. So on `/nodes/<id>`, where every row is an anchor and every row
                 carries a `:target` mark, the mark lit only for a reader who ARRIVED on
                 the fragment: opening `#interfaces` in the address bar drew the cyan edge,
                 clicking `Cannot receive` in the rail moved the scroll and left the edge
                 where it was. Measured in Chrome, both halves, before and after.

                 A native anchor to a fragment in the same document is exactly the case the
                 router adds nothing to — nothing is fetched, nothing is prefetched, and
                 `scroll-behavior: smooth` is a CSS property that does not care which of
                 the two produced the jump. */
              const Anchor = item.href.startsWith("#") ? "a" : Link;
              return (
              <li key={item.href}>
                {item.heading !== undefined && (
                  <p
                    className={cx(
                      "label px-3 pb-1.5 pt-1 text-cyan",
                      index > 0 && "mt-3 border-t border-line pt-4",
                    )}
                  >
                    {item.heading}
                  </p>
                )}
                <Anchor
                  href={item.href}
                  aria-current={item.active === true ? "page" : undefined}
                  className={cx(
                    "group grid items-baseline gap-2 rounded-md border-l-2 px-3 py-2.5 transition-colors",
                    /* One level in, behind the same hairline the sections list uses, so a
                       route that hangs under another one reads as belonging to it. */
                    item.indent === true && "ml-[1.4rem] border-l border-line",
                    /* Four shapes, written out rather than composed, because Tailwind
                       scans source text: a template-built `grid-cols-[…]` is a class the
                       scanner never sees and so never compiles. A step column when there
                       is a step, a figure column when there is a figure, and the label
                       takes what is left in every case. */
                    /* A row with a step AND a figure stacks them, rather than taking the
                       third column.
                       ------------------------------------------------------------
                       The arithmetic: the rail is 16rem, `px-4` takes 32 and the row's own
                       `px-3` another 24, leaving 200px — and a step column costs 24 more
                       plus its gap. "Customize the starter" beside "worked example" needs
                       about 220 in the 168 that leaves, so it wrapped to three lines and
                       the tag printed across them. Measured at 1456px.

                       The node rail is the case that keeps the column: its rows carry a
                       figure and no step ("123 words", "1 in · 2 out") beside short labels,
                       and stacking those would double the height of six rows to solve a
                       problem they do not have. */
                    COLUMNS[
                      `${item.step !== undefined || item.indent === true}:${
                        item.meta !== undefined && item.step === undefined && item.indent !== true
                      }`
                    ],
                    item.active === true
                      ? "border-cyan bg-cyan/5 text-fg"
                      : item.tone === "signal"
                        ? /* A destructive row keeps its own colour when it is the one a
                             reader is in: lighting it cyan would say "interactive" about
                             the one section on the page that is not safe to poke. */
                          "border-transparent text-signal hoverable:hover:bg-surface-2 data-[rail-active=true]:border-signal data-[rail-active=true]:bg-signal/5"
                        : "border-transparent text-muted hoverable:hover:bg-surface-2 hoverable:hover:text-fg data-[rail-active=true]:border-cyan data-[rail-active=true]:bg-cyan/5 data-[rail-active=true]:text-fg",
                    item.mark,
                  )}
                >
                  {item.step !== undefined && (
                    <span
                      className={cx(
                        "font-mono text-[10px] tabular-nums",
                        item.active === true ? "text-cyan" : "text-dim",
                      )}
                    >
                      {item.step}
                    </span>
                  )}
                  {/* An indented row has no number, and the glyph stands where one would.
                      `aria-hidden`: it is a drawing of the indent the CSS already makes,
                      and a screen reader reading "corner" before every child row is noise. */}
                  {item.step === undefined && item.indent === true && (
                    <span aria-hidden className="font-mono text-[10px] text-dim">
                      └
                    </span>
                  )}
                  <span className="min-w-0 text-[13px] leading-snug">
                    {item.label}
                    {item.meta !== undefined && item.step !== undefined && (
                      <span className="label mt-1 block">{item.meta}</span>
                    )}
                    {item.meta !== undefined && item.indent === true && (
                      <span className="label mt-1 block">{item.meta}</span>
                    )}
                  </span>
                  {item.meta !== undefined && item.step === undefined && item.indent !== true && (
                    <span className="label shrink-0 justify-self-end">{item.meta}</span>
                  )}
                </Anchor>

                {/* Indented one level, and only under the row a reader is on.

                    Expanding every row at once is what this replaced: seven pages with
                    three sections each is 21 rows under 7, and a rail that lists every
                    section of every page stops being a map of where you are. The closed
                    rows keep their one-line shape, so the sequence stays scannable and the
                    page you are in is the only one that goes deep.

                    `<ul>` inside the `<li>`, not a sibling, so a screen reader announces
                    these as belonging to the row above rather than as more stops in the
                    sequence. */}
                {item.active === true && item.sections !== undefined && item.sections.length > 0 && (
                  <ul className="mb-1 ml-[1.4rem] flex flex-col border-l border-line">
                    {item.sections.map((section) => (
                      <li key={section.href}>
                        <Link
                          href={section.href}
                          className="block py-1.5 pl-4 pr-3 text-[12px] leading-snug text-muted transition-colors hoverable:hover:text-cyan data-[rail-active=true]:text-cyan"
                        >
                          {section.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ol>
          {footer !== undefined && (
            <div className="mt-3 border-t border-line px-3 pt-3">{footer}</div>
          )}
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        {compact && (
          /* A row of chips rather than a stack: seven sections as a list would be a
             screenful before the page starts, which is the thing the rail's own `xl` rule
             exists to avoid. Scrolls sideways rather than wrapping to four lines. */
          <nav
            aria-label={`${ariaLabel ?? label}, compact`}
            className="flex gap-2 overflow-x-auto border-b border-line px-6 py-3 xl:hidden"
          >
            {items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cx(
                  "shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
                  item.tone === "signal"
                    ? "border-signal/40 text-signal"
                    : "border-line text-muted hoverable:hover:border-line-bright hoverable:hover:text-fg",
                )}
              >
                {item.step !== undefined && (
                  <span className="mr-1.5 text-dim">{item.step}</span>
                )}
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {children}
      </div>
    </div>
  );
}
