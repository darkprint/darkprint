import type { Metadata } from "next";
import Link from "next/link";

import { SectionLevels } from "@/components/home/SectionLevels";
import { CLIMB_ROUTE, RoutePager } from "@/components/howto";
import { SectionHeading } from "@/components/ui/SectionHeading";

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
   competes with the thing a reader came for. Two sentences and a
   two-item index, then the ladder.

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
  const [, ...onwards] = CLIMB_ROUTE;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The route"
            title="Towards a Dark Factory"
            lead="Start by finding yourself on the ladder below. Where you land decides which problem you have, and the two pages after this one answer the two questions that follow."
          />

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {onwards.map((stop, i) => (
              <li key={stop.href}>
                <Link
                  href={stop.href}
                  /* `route-box`, like the pagers and the layer doors: these two leave the
                     page, and the author asked for the boxes that do to be told apart
                     from the ones carrying a concept. They wore `panel` when the language
                     was introduced, which made this header the one place on the route
                     where an exit looked like content. */
                  className="route-box group flex h-full flex-col gap-1.5 p-5"
                >
                  {/* The position, so a reader knows this card is a stop on a route and
                      how far along. Derived from `CLIMB_ROUTE`, never typed: `onwards`
                      drops the first stop, so index 0 here is stop 2. `SpecPager`'s own
                      label was a hand-written "in four parts" against a five-item rail
                      once, which is the failure this avoids by construction. */}
                  <span className="route-label">
                    Stop {i + 2} of {CLIMB_ROUTE.length} <span aria-hidden>→</span>
                  </span>
                  <span className="font-display text-lg font-semibold leading-snug text-fg transition-colors group-hover:text-amber-bright">
                    {stop.label}
                  </span>
                  <span className="text-sm leading-relaxed text-muted">{stop.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <SectionLevels />

      <section id="around" className="scroll-mt-24 border-t border-line bg-void py-14 sm:py-20">
        <div className="container-page">
          <SectionHeading
            eyebrow="The half that is not technical"
            title="What changes around the pipeline"
            lead="The technology in the account this route ends on is ordinary: an orchestrator script, a GitHub Action, containers on infrastructure the team already ran. What it spends its risk section on is people."
          />

          <ul className="mt-10 grid gap-4 md:grid-cols-2">
            {AROUND.map((item) => (
              <li key={item.title} className="panel flex flex-col gap-2.5 p-6">
                <h3 className="font-display text-lg font-semibold leading-snug text-fg">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-muted">
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

      <section className="border-t border-line bg-surface py-14">
        <div className="container-page">
          <RoutePager href={HERE} />
        </div>
      </section>
    </>
  );
}
