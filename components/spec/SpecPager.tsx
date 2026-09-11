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
   followed on its own. It did the same on 2026-09-04, when the author
   asked the graded page off the site and the practice run lost a
   stop. Nothing in this file was edited for either removal.
   ============================================================ */

import Link from "next/link";

import { cx } from "@/lib/format";
import { RouteBoxLink } from "@/components/ui/RouteBoxLink";

import { RUNS, SPEC_OVERVIEW, SPEC_SEQUENCE, runPosition, specNeighbours, type SpecPage } from "./sequence";

/**
 * The crumb at the top of a child page.
 *
 * It carries the way back and the position, which are the two things a reader who arrived
 * from a search result has no other source for. Rendered on every child page under `/spec`
 * and not on the overview, where both facts would be self-evident.
 *
 * Both halves come off `SPEC_OVERVIEW` rather than being typed. They were a hardcoded
 * `href="/spec"` and a hardcoded "The spec language", and the IA pass deleted that route
 * and moved stop 00 to `/what-a-blueprint-is` — three crumbs pointing at a 308 with the
 * old page's name on them is exactly the drift `sequence.ts` exists to make impossible.
 */
export function SpecCrumb({ href }: { href: string }) {
  const at = runPosition(href);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {/* `.label` is the site's 11px/0.18em mono tier and it lives in
          `@layer components`, so the `hover:text-cyan` utility beside it wins the
          colour on hover rather than losing to the class's own `text-dim`. */}
      <Link href={SPEC_OVERVIEW.href} className="label transition-colors hover:text-cyan">
        <span aria-hidden>← </span>
        {SPEC_OVERVIEW.title}
      </Link>
      {/* The position inside the run, not across both. A reader on stop 02 is three
          quarters of the way through the specification and one of two runs into Learn, and
          only the first of those answers "how much of this is left". */}
      {at !== undefined && (
        <span className="font-mono text-[11px] text-dim">
          {RUNS[at.run]} · {at.position} of {at.total}
        </span>
      )}
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
 * The box hugs its content now (`inline-flex`, no column stretch) and caps at 19rem. That
 * width was measured against the longest title the sequence carried when the cap was set,
 * "The ontology, the vocabulary both draw from", which is longer than anything in
 * `SPEC_SEQUENCE` today: the layer titles were shortened to their nav names in 2026-08-08
 * and the stop that had that one folded into `/spec/card` on 2026-09-06. The cap is left
 * where it is because a cap is a ceiling rather than a measurement, and lowering it to the
 * new longest title would only have to move again on the next rename.
 *
 * ── It still cannot be read as a `ComingSoonBadge` ──
 * `app/globals.css` says the two amber surfaces are told apart by shape, not hue, and
 * the shrink deliberately keeps every part of that shape: a 12px-radius rectangle, the
 * 2px rule down its leading edge, and two stacked lines (mono label over a display
 * title). The badge is a fully-rounded pill of one uppercase line and no rule. Do not
 * take this down to a single line — that is where the two would start to converge.
 *
 * ── The card itself lives in `components/ui/RouteBoxLink.tsx` ──
 * It used to be a class string spelled out here, byte-identical to two other copies in
 * `OnwardRoutes` and `RoutePager`; `/build` was about to write a fourth, so the shape was
 * extracted. That route is deleted (owner, 2026-09-06) and the extraction outlived it: the
 * three copies it removed are still three copies removed. Everything above still holds — that file's docblock repeats the shape
 * argument, because that is where the shape now is. What stays here is what only this
 * pager knows: which page is adjacent, which side it sits on, and that `next` is pushed
 * to the end of the row.
 */
function PagerLink({ page, side }: { page: SpecPage; side: "previous" | "next" }) {
  const isNext = side === "next";
  /* The run and the step, so a reader stepping out of the specification is told they are
     leaving it. "Next · In practice 04 →" reads differently from "Next →", and the
     difference is the whole point of grouping the rail: a boundary nobody is told about is
     not a boundary. `step` is filtered rather than assumed present because a stop may carry
     none: the sandbox at `/build` was the one such stop and is deleted, so today every stop
     has a number and the filter is what stops the next unnumbered one printing "undefined".
     */
  const where = [RUNS[page.run], page.step].filter(Boolean).join(" ");
  return (
    <RouteBoxLink
      href={page.href}
      rel={isNext ? "next" : "prev"}
      /* `sm:ms-auto` rather than the old `sm:col-start-2`: on a route with only one
         arrow, the grid pinned that singleton to the second column, leaving a hole
         beside it. Pushed to the end of a flex row instead, a lone NEXT sits right and a
         lone PREVIOUS sits left with nothing reserved for the arrow that is not there. */
      className={cx(isNext && "sm:ms-auto sm:text-right")}
      label={
        isNext ? (
          <>
            Next · {where} <span aria-hidden>→</span>
          </>
        ) : (
          <>
            <span aria-hidden>←</span> Previous · {where}
          </>
        )
      }
      title={page.title}
    />
  );
}

/**
 * The rail, and the two arrows.
 *
 * `aria-current="page"` on the rail's own entry, so the sequence is navigable by a screen
 * reader without counting the links; the entry stays a `span` rather than a link to
 * itself, which is a stop that goes nowhere.
 */
export function SpecPager({
  href,
  showNext = true,
  after,
}: {
  href: string;
  /**
   * One more signpost, at the right end of the arrow row.
   *
   * NO CALLER SINCE 2026-09-06, and that is recorded rather than removed. `/spec/ontology`
   * was the one page that passed it, a Design box on the stop that then ended the
   * specification run: it had a PREVIOUS and no NEXT, so the right end of the row was empty,
   * and a forward exit belongs on the row a reader already reads for "where next" rather
   * than in a band of its own above it. That page folded into `/spec/card`, which has a NEXT
   * of its own and no empty end to fill.
   *
   * The prop is kept because the shape it answers recurs on whichever stop ends a run, and
   * because the argument above is the whole of what it knows. Whether a slot with no caller
   * earns its place is a call for whoever audits this file next, and they should have the
   * reason in front of them.
   *
   * Rendered inside the row rather than beside the pager so the two boxes share one
   * baseline and one wrap; a sibling `<div>` puts them on two lines at every width.
   */
  after?: React.ReactNode;
  /**
   * Whether to draw the NEXT signpost.
   *
   * True everywhere except `/what-a-blueprint-is`, where the author asked it out on
   * 2026-08-08. That page ended on `WhereNext`, three cards carrying all three layer pages
   * in sequence order, and the pager's NEXT was the first of those three a second time,
   * forty pixels below it. Two boxes offering one destination is not a choice.
   *
   * ── THAT PREMISE IS FALSE SINCE 2026-09-06, and the flag is still passed ──
   * The crosswalk moved to stop 01, so the overview's NEXT is `/spec/attractor`, and
   * `WhereNext` draws the LAYER doors, which no longer include it. The two boxes no longer
   * offer one destination; they offer different ones, and the flag now hides the only
   * forward link the door has to the stop that follows it. `app/what-a-blueprint-is` is
   * where `showNext={false}` is written and it is not this file's to change, so what is
   * recorded here is that the reason it was written for has gone. The default is unchanged
   * (`true`), and dropping the prop at the call site is all the repair takes.
   *
   * The rail above it is untouched, so the sequence is still navigable from that page and
   * still announces which stop it is on. PREVIOUS is untouched too; on stop 00 there is
   * none to draw.
   */
  showNext?: boolean;
}) {
  const { previous, next } = specNeighbours(href);

  return (
    <nav
      aria-label={`Learn, in ${SPEC_SEQUENCE.length} parts`}
      className="flex flex-col gap-6 border-t border-line pt-8"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] xl:hidden">
        {SPEC_SEQUENCE.map((page, i) => (
          <li key={page.href} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-faint">
                ·
              </span>
            )}
            {page.href === href ? (
              <span aria-current="page" className="text-cyan">
                {page.step ?? "└"} {page.nav}
              </span>
            ) : (
              <Link
                href={page.href}
                className="text-dim transition-colors hover:text-fg"
              >
                {page.step ?? "└"} {page.nav}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {(previous !== undefined || (showNext && next !== undefined) || after !== undefined) && (
        /* A row of two signposts, not a two-column grid: the boxes are content-sized
           now, so a grid would stretch them straight back to half the measure each. */
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-start">
          {previous !== undefined && <PagerLink page={previous} side="previous" />}
          {showNext && next !== undefined && <PagerLink page={next} side="next" />}
          {after !== undefined && <div className="sm:ms-auto">{after}</div>}
        </div>
      )}
    </nav>
  );
}
