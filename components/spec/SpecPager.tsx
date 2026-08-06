/* ============================================================
   The spec pages, made into a sequence a reader can walk.

   Redesign spec §4.1: the pages "carry next / previous links so the
   four read as a sequence". This is that, and it is one component
   rather than one hand-written footer per page for the reason
   `sequence.ts` gives: the split was made because the single page
   was long, and pagers that disagree about the order would be a
   worse failure than the length.

   Two surfaces, and the rail is the one worth arguing for. A pager
   with two arrows tells a reader what is adjacent and never how far
   through they are, which is the question somebody who left the
   long page is actually asking. The rail names every stop, marks the
   one they are on, and lets them jump, so the sequence is a shape
   rather than a corridor.

   Server-rendered markup, no state. The current page is passed in
   rather than read from `usePathname`, because that hook would make
   every one of the routes carry a client component to render its own
   footer.

   The rail's `aria-label` used to spell the count out ("in four
   parts") as a literal string. The lifecycle-scoring pass appended a
   fifth page (`SPEC_SCORING`) to `SPEC_SEQUENCE` and the literal was
   never touched, so it kept announcing a four-stop rail to a screen
   reader over a five-item `<ol>` — reproduced against the built HTML
   of the page that append added, which rendered five `<li>`s under
   the stale label. Read off `SPEC_SEQUENCE.length` instead, so a
   page appended the same way updates the label by construction
   rather than by whoever remembers to grep for "four" a second time.

   That is not a hypothetical any more in the other direction: the IA
   pass took the sequence back DOWN to four, by deleting `/spec` and
   merging `/spec/scoring` into `/reading-the-radar`, and the label
   followed on its own.
   ============================================================ */

import Link from "next/link";

import { cx } from "@/lib/format";

import { SPEC_OVERVIEW, SPEC_SEQUENCE, specNeighbours, type SpecPage } from "./sequence";

/**
 * The crumb at the top of a child page.
 *
 * It carries the way back and the position, which are the two things a reader who arrived
 * from a search result has no other source for. Rendered on the three layer pages and not
 * on the overview, where both facts would be self-evident.
 *
 * Both halves come off `SPEC_OVERVIEW` rather than being typed. They were a hardcoded
 * `href="/spec"` and a hardcoded "The spec language", and the IA pass deleted that route
 * and moved stop 00 to `/what-a-blueprint-is` — three crumbs pointing at a 308 with the
 * old page's name on them is exactly the drift `sequence.ts` exists to make impossible.
 */
export function SpecCrumb({ href }: { href: string }) {
  const { position, total } = specNeighbours(href);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* `.label` is the site's 11px/0.18em mono tier and it lives in
          `@layer components`, so the `hover:text-cyan` utility beside it wins the
          colour on hover rather than losing to the class's own `text-dim`. */}
      <Link href={SPEC_OVERVIEW.href} className="label transition-colors hover:text-cyan">
        <span aria-hidden>← </span>
        {SPEC_OVERVIEW.title}
      </Link>
      <span className="font-mono text-[11px] text-dim">
        {position} of {total}
      </span>
    </div>
  );
}

/**
 * One arrow of the pager. `side` decides which way the chevron and the text run.
 *
 * ── Why this is a signpost and not a slab ──
 * The author, 2026-08-07: "I don't like the extension of the orange box for moving
 * through pages... Just keep the heading title removing the subtitle and reduce the
 * horizontal size." So the `question` line is gone from here — it is still on the
 * `/spec` doors, which is where a reader chooses between three pages they have not
 * seen; at the foot of a page they have just read, the title alone names the next
 * stop, and the extra line was buying a 700px amber rectangle for eight words.
 *
 * The box hugs its content now (`inline-flex`, no column stretch) and caps at 19rem,
 * which is wide enough for the longest title in `SPEC_SEQUENCE` ("The ontology, the
 * vocabulary both draw from") over two lines at the 16px display tier.
 *
 * ── It still cannot be read as a `ComingSoonBadge` ──
 * `app/globals.css` says the two amber surfaces are told apart by shape, not hue, and
 * the shrink deliberately keeps every part of that shape: a 12px-radius rectangle, the
 * 2px rule down its leading edge, and two stacked lines (mono label over a display
 * title). The badge is a fully-rounded pill of one uppercase line and no rule. Do not
 * take this down to a single line — that is where the two would start to converge.
 */
function PagerLink({ page, side }: { page: SpecPage; side: "previous" | "next" }) {
  const isNext = side === "next";
  return (
    <Link
      href={page.href}
      rel={isNext ? "next" : "prev"}
      /* `route-box`, not `panel`: this leaves the page, and the author asked for the
         boxes that do to be told apart from the ones that carry a concept. See
         `app/globals.css`. */
      className={cx(
        "route-box group inline-flex max-w-full flex-col gap-1.5 px-4 py-3 sm:max-w-[19rem]",
        /* `sm:ms-auto` rather than the old `sm:col-start-2`: on `/spec` and
           `/spec/scoring` only one arrow exists, and the grid pinned that singleton to
           the second column, leaving a hole beside it. Pushed to the end of a flex row
           instead, a lone NEXT sits right and a lone PREVIOUS sits left with nothing
           reserved for the arrow that is not there. */
        isNext && "sm:ms-auto sm:text-right",
      )}
    >
      <span className="route-label">
        {isNext ? (
          <>
            Next <span aria-hidden>→</span>
          </>
        ) : (
          <>
            <span aria-hidden>←</span> Previous
          </>
        )}
      </span>
      <span className="font-display text-base font-semibold leading-snug text-fg transition-colors group-hover:text-amber-bright">
        {page.title}
      </span>
    </Link>
  );
}

/**
 * The rail, and the two arrows.
 *
 * `aria-current="page"` on the rail's own entry, so the sequence is navigable by a screen
 * reader without counting the links; the entry stays a `span` rather than a link to
 * itself, which is a stop that goes nowhere.
 */
export function SpecPager({ href }: { href: string }) {
  const { previous, next } = specNeighbours(href);

  return (
    <nav
      aria-label={`The spec language, in ${SPEC_SEQUENCE.length} parts`}
      className="flex flex-col gap-6 border-t border-line pt-8"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px]">
        {SPEC_SEQUENCE.map((page, i) => (
          <li key={page.href} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-faint">
                ·
              </span>
            )}
            {page.href === href ? (
              <span aria-current="page" className="text-cyan">
                {page.step} {page.nav}
              </span>
            ) : (
              <Link
                href={page.href}
                className="text-dim transition-colors hover:text-fg"
              >
                {page.step} {page.nav}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {(previous !== undefined || next !== undefined) && (
        /* A row of two signposts, not a two-column grid: the boxes are content-sized
           now, so a grid would stretch them straight back to half the measure each. */
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
          {previous !== undefined && <PagerLink page={previous} side="previous" />}
          {next !== undefined && <PagerLink page={next} side="next" />}
        </div>
      )}
    </nav>
  );
}
