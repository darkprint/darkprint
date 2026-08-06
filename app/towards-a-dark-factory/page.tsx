import type { Metadata } from "next";
import Link from "next/link";

import { SectionLevels } from "@/components/home/SectionLevels";
import { RoutePager } from "@/components/howto";
import { CLIMB_ROUTE } from "@/components/howto/route";
import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Redesign spec §4.2, on the author's instruction: "/which-tasks
   should be placed in The climb part which I'd rename Towards a
   Dark Factory". So the section is three pages and this is its
   first, and §3 sends the 1-5 ladder here from the landing, which
   was carrying it as one of eight sections nobody reached the
   bottom of.

   The overview is deliberately thin. `SectionLevels` is the whole
   argument for this page and it arrives with five drawings, the
   two-scales panel and its own sources; anything written above it
   competes with the thing a reader came for. Two sentences, then
   the ladder.

   The page reads hero → ladder → what changes around the pipeline
   → the two doors. Every exit is in the last block and nowhere
   else; the note above that block says why that is not a
   preference.

   ── Why the ladder is imported and not rewritten ──
   `components/home/SectionLevels.tsx` is owned elsewhere this pass
   and `levels.test.ts` holds two claims on its copy: that the site
   does not credit its five rung names to the HackerNoon piece,
   which numbers its own ladder 1, 2, 3, 3.5, 4 and names none of
   them, and that the two-scales panel keeps the sentence doc 2
   §1.1 is actually about. Imported by path rather than through the
   `components/home` barrel, so that moving it off the landing's
   index cannot break this route.

   ── Doc 2 §1.1 ──
   The ladder describes an organisation and has a top. A
   blueprint's autonomy class describes one graph and records where
   its author decided a person should stand. `SectionLevels` names
   the two apart under `#autonomy`, and the other two pages of this
   route link there rather than restating it.

   ── `#around`, and why it arrived here (PROJECT.md §3.1) ──
   `/towards-a-dark-factory/the-climb` was 2,024 prose words and
   readers were skipping it. Its closing section, "What changes
   around the pipeline", was the account's risk section: identity,
   buy-in, the bill, and what an engineer's job becomes. None of
   that is about a pipeline. It is about an organisation, which is
   the subject of this page and the thing the 1-5 ladder measures,
   so the block moved here whole rather than being cut, and the
   climb links to it.

   It sits below `SectionLevels` on purpose. The note above about
   keeping the overview thin is about what stands between the
   reader and the ladder; this reads after the ladder has put them
   somewhere, and it answers the question the ladder raises.
   ============================================================ */

export const metadata: Metadata = {
  title: "Towards a Dark Factory",
  description:
    "Five levels of working with agents, and where most teams actually sit. The gap between level 2 and level 5 is architectural and organisational, which makes it a design problem.",
};

const HERE = "/towards-a-dark-factory";

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

/**
 * The account's risk section, moved off the climb.
 *
 * Four risks, each named in the article and each given its own paragraph there. The
 * wording is the wording that shipped on the climb, less the sentences that repeated
 * something the climb said elsewhere: the eighteen-months gloss on "every phase pays for
 * itself" (the phase strip's four captions state it one phase at a time) and the opening
 * of the closing paragraph, which said what the first card says.
 */
const AROUND: { title: string; body: string }[] = [
  {
    title: "People do not want to stop writing code",
    body: "Engineers have identity wrapped up in authorship, and being told the job is now writing specs lands differently than the person saying it expects. The account names this as a real risk and gives it its own paragraph. The phased shape helps, because phase 1 asks nobody to change anything and by phase 2 the results are visible.",
  },
  {
    title: "The saving can be spent badly",
    body: "Automating the coding and then raising the number of specs per sprint produces a different grind and the same exhaustion. The account says the promise about doing more of the interesting work has to be meant.",
  },
  {
    title: "Buy-in was load-bearing",
    body: "The team had already watched agents do useful work unattended and were not frightened of them. That is listed alongside the CI pipeline and the test coverage as a starting condition, which is a claim about where this is easy and where it is not.",
  },
  {
    title: "There is a bill, and it has a cap",
    body: "Retries are capped at three attempts per spec, with token monitoring and alerts. For scale, the account cites its own reference reporting roughly a thousand dollars a day per engineer-equivalent, and observes that this is still cheaper than a salary.",
  },
];

export default function TowardsPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The route"
            title="Towards a Dark Factory"
            /* The phrase is defined before it is used again, which it was not.
               ------------------------------------------------------------
               The term appeared first in the `h1`, and the nearest thing to a definition
               sat 1858px below it — 1.6 desktop viewports, 2.6 phone screens, and behind
               four other level descriptions that arrive first. A reader coming in from
               the nav, which is the only permanent entrance, read the whole ladder before
               learning what the ladder climbs towards. The project's own memory records
               that the phrase misleads everyone who meets it cold; this is that, on the
               page named after it.

               The definition is the five lifecycle phases the rest of the site is built
               on, so it costs no new vocabulary: `planning`, `implementation`, `testing`,
               `debugging` and `deployment` are the closed set doc 3 §2 draws, the same
               five a node card declares a `phase` from and the same five the coverage
               strip counts. A dark factory is the case where all five run unattended.
               Level 5 keeps its own fuller account; this is the one-sentence version a
               reader needs before the ladder means anything. */
            lead="A dark factory is a pipeline where all five phases run unattended: planning, implementation, testing, debugging and deployment. Start by finding yourself on the ladder below. Where you land decides which problem you have, and the two pages after this one answer the two questions that follow."
          />
        </div>
      </header>

      <SectionLevels />

      <section id="around" className="scroll-mt-24 border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The half that is not technical"
            title="What changes around the pipeline"
            lead="The technology in the account this route ends on is ordinary: an orchestrator script, a GitHub Action, containers on infrastructure the team already ran. What it spends its risk section on is people."
          />

          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            {AROUND.map((item) => (
              <li key={item.title} className="panel flex flex-col gap-3 p-5">
                <PanelHeading>{item.title}</PanelHeading>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="prose-lane mt-10 text-[15px] leading-[1.7] text-muted">
            Writing code used to be the floor of what it meant to be an engineer. In the
            account&apos;s model the work is deciding what to build and how to know it is
            right, which is closer to product engineering than to what most people were
            trained for. The team in question is eight people, and the projection it offers
            is the sustained output of twenty-five or thirty. That is a projection from a
            team partway up its own ladder, and it is quoted here as one.{" "}
            <Link href="/towards-a-dark-factory/the-climb" className={INLINE}>
              The climb is the rest of that account
            </Link>
            .
          </p>
        </div>
      </section>

      {/* The two doors, and the page ends on them.
          ------------------------------------------------------------
          They were deleted once, because they sat between the lead and `SectionLevels`:
          a reader met "Stop 3 of 3" before being offered stop 2 and before seeing
          anything the stops were about. That complaint was about *placement*, and the
          deletion answered it by removing the index instead of moving it. Two things
          broke — `components/site/SiteHeader.tsx` justifies keeping these two children
          out of the nav on the grounds that "each sequence carries its own previous/next
          pager and its parent opens with a door per child", which went false the moment
          the cards went; and the nav is the only permanent entrance, so a reader arriving
          through it met the first link to either child at 83% scroll depth, in a pager,
          one stop at a time.

          They came back above "What changes around the pipeline" and that was still
          wrong, in the other direction. `.route-box` is a promise: amber means this box
          leaves the page. The page then fired it three times for two destinations — two
          doors at 60% depth, a full section of substance after them, then a pager whose
          NEXT card was door 02 again, ~1100px lower. A reader who trusts the amber stops
          at the doors and never sees the section; a reader who carries on meets the same
          door twice and cannot tell whether it is new. That is the exact ambiguity the
          device was invented to remove.

          So the index is here, at the end, where an index of what is left belongs, and
          `RoutePager` draws its rail without arrows (`arrows={false}`): this page is the
          parent of the sequence, not a stop inside it, and both of its destinations are
          in the two cards above. Amber now fires once per destination. */}
      <section
        aria-labelledby="route-doors"
        className="border-t border-line bg-surface py-16 sm:py-20"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            <h2 id="route-doors" className="label-lead">
              The two questions that follow
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {CLIMB_ROUTE.filter((stop) => stop.href !== HERE).map((stop, i) => (
                <Link
                  key={stop.href}
                  href={stop.href}
                  className="route-box group flex flex-col gap-2 p-5"
                >
                  <span className="route-label">{`0${i + 2}`}</span>
                  {/* `hoverable:` gates the hover on `(hover: hover) and (pointer: fine)`,
                      the same gate `.route-box:hover` carries in `app/globals.css`: a tap
                      on a phone has no "leave", so an ungated hover latches the amber on
                      whichever door was touched last. */}
                  <span className="font-display text-lg font-semibold text-fg transition-colors hoverable:group-hover:text-amber-bright">
                    {stop.label}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{stop.blurb}</span>
                </Link>
              ))}
            </div>
          </div>

          <RoutePager href={HERE} arrows={false} />
        </div>
      </section>
    </>
  );
}
