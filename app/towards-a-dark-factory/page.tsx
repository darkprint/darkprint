import type { Metadata } from "next";
import Link from "next/link";

import { SectionLevels } from "@/components/home/SectionLevels";
import { WhichTasksChecks } from "@/components/explain/WhichTasksChecks";
import { WhichTasksExamples } from "@/components/explain/WhichTasksExamples";
import { WhichTasksGlance } from "@/components/explain/WhichTasksGlance";
import { WhichTasksRemedies } from "@/components/explain/WhichTasksRemedies";
import { RoutePager } from "@/components/howto";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Stop 1 of 2. One question, asked in two halves: where are you,
   and is the work in front of you a candidate at all?

   ── The merge (2026-08-07), and what it reverses ──
   Redesign spec §4.2 made this route three pages on the author's
   instruction ("/which-tasks should be placed in The climb part
   which I'd rename Towards a Dark Factory"). Three was one too
   many, and this file was the surplus one: strip `SectionLevels`,
   which `components/home` owns, and `#around`, which an earlier
   pass had moved here off `/the-climb`, and what remained was a
   three-sentence lead and an index of two links. A table of
   contents wearing a stop's clothes.

   So `/towards-a-dark-factory/which-tasks` is folded in whole —
   the glance figure, the eight worked tasks, the four questions and
   what to do with a no — and `#around` goes back to the account it
   was always the risk section of. `components/howto/route.ts`
   records the reasoning; `next.config.ts` carries the 308.

   Two documented earlier decisions are reversed here and both are
   named rather than quietly overwritten:

     1. `#around` was moved here on the argument that "its subject
        is an organisation, which is the subject of this page and
        the thing the 1-5 ladder measures". The block's own lead
        opens "the technology in the account this route ends on",
        which is a sentence only readable on the page that IS the
        account, and it forward-linked past the stop between them.
        It goes back.
     2. The two-door index at the foot of this page was deleted
        once and restored once and carried ~26 lines of comment
        about where it belonged. With one other page in the
        sequence an index of "the one other page" is the pager, and
        the deletion also takes the last of the three amber firings
        that comment was agonising over.

   ── Doc 2 §1.1, said once, before the picture ──
   This is the change the whole pass is for. Every framing device on
   this route said "journey with a destination" — the name, the
   eyebrow, a numbered progress rail, an ascending list of five
   ending on the rung the page is named after — and the correction
   was always downstream of the picture and always drawn smaller: it
   was the last paragraph of the `#autonomy` panel at 51% depth,
   and a 14px `text-dim` line under the climb's `h1`. Three
   disclaimers do not fix a layout.

   The rail is deleted (`RoutePager`), the climb's dim line is
   folded into its own lead, and the sentence itself is now in the
   deck of this page, above everything: a dark factory is one shape
   a blueprint can take, and a graph with a person standing in it is
   a first-class blueprint shelved beside the rest. `SectionLevels`
   still states the two scales apart in full under `#autonomy`, and
   the paragraph under the deck links there rather than restating
   it a third time.

   ── Why the ladder is imported and not rewritten ──
   `components/home/SectionLevels.tsx` is owned elsewhere and
   `levels.test.ts` holds two claims on its copy: that the site does
   not credit its five rung names to the HackerNoon piece, which
   numbers its own ladder 1, 2, 3, 3.5, 4 and names none of them,
   and that the two-scales panel keeps the sentence doc 2 §1.1 is
   actually about. Imported by path rather than through the
   `components/home` barrel, so that moving it off the landing's
   index cannot break this route.

   ── The running order ──
   hero → the ladder → the figure that asks the four questions →
   eight worked tasks → the four questions in full → what to do with
   a no → the two exits and the pager. Every band is a `border-t`
   and a change of ground, which is the device the other page of
   this route already uses at every seam.
   ============================================================ */

export const metadata: Metadata = {
  title: "Towards a Dark Factory",
  description:
    "Five levels of working with agents, where most teams actually sit, and the four questions that decide whether a task belongs in a pipeline nobody is watching. The gap between level 2 and level 5 is architectural and organisational, which makes it a design problem.",
};

const HERE = "/towards-a-dark-factory";

const INLINE =
  "font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan";

export default function TowardsPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The route"
            title="Towards a Dark Factory"
            /* The phrase is defined before it is used, and it is defined as a SPECIAL
               CASE.
               ------------------------------------------------------------
               The term used to appear first in the `h1` with the nearest thing to a
               definition 1858px below it, behind four other level descriptions. That was
               fixed by putting the five phases in this lead. What the fix did not do was
               say what kind of thing a dark factory is, and the project's own memory
               records the consequence: the phrase misleads everybody who meets it cold,
               and every agent that reads the docs takes it for the headline concept. It
               is not. The site's spine is blueprints and nodes; this names one class of
               blueprint.

               The definition costs no new vocabulary: `planning`, `implementation`,
               `testing`, `debugging` and `deployment` are the closed set doc 3 §2 draws,
               the same five a node card declares a `phase` from and the same five the
               coverage strip counts.

               The second sentence is doc 2 §1.1, in the deck, ahead of the ladder rather
               than 2,586px below it. It is the constraint a deleted landing beat used to
               guard and it belongs upstream of the picture that puts it at risk. */
            lead="A dark factory is one shape a blueprint can take: a graph where planning, implementation, testing, debugging and deployment all run unattended. It is a special case and not a summit. A graph with a person standing in it is a first-class blueprint here, and is shelved beside the rest."
          />
          {/* The two scales, named apart before the five-rung list rather than after it.
              `text-fg` on the clause that does the work: this used to be the dimmest text
              on the route carrying its most load-bearing constraint. */}
          <p className="prose-lane mt-6 text-[15px] leading-[1.7] text-muted">
            <span className="text-fg">
              Two different things get called autonomy here, and only one of them is a
              number.
            </span>{" "}
            The ladder below counts what an organisation is able to do at all. The class
            printed on a blueprint records where the author of that one graph decided a
            person should stand, and it ranks nothing. The two are{" "}
            <Link href="/towards-a-dark-factory#autonomy" className={INLINE}>
              named apart in full
            </Link>{" "}
            under the ladder. Find yourself on it first; the four questions after it decide
            whether the work in front of you is a candidate at all.
          </p>
        </div>
      </header>

      <SectionLevels />

      {/* ---------- the filter, folded in from /which-tasks ---------- */}
      {/* The page's second half has two jobs at once. The first is the one the tester
          asked for and nobody answers. The second is to work as a filter: somebody who
          takes an unverifiable task to a factory gets confident garbage back and concludes
          the pattern is vapour, and that reader is lost for good. Which is why the
          unsuitable side is written at full strength.

          Figure, then the eight tasks, then the four questions in full, then what to do
          with a no. A reader settles a comparison faster than a definition, so the
          examples sit above the definitions. */}
      <section
        id="which-tasks"
        className="scroll-mt-24 border-t border-line bg-void py-16 sm:py-20"
      >
        <div className="container-page">
          <SectionHeading
            eyebrow="Before you build one"
            title="Which tasks a dark factory can take"
            lead="Four questions settle it, and all four are about the task rather than about the graph you would draw for it."
          />
          {/* The block tier. `SectionHeading` → content is 40px everywhere the scale
              reached, and the figure is what the lead hands the reader to. */}
          <div className="mt-10">
            <WhichTasksGlance />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksExamples />
        </div>
      </section>

      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksChecks />
        </div>
      </section>

      <section className="border-t border-line bg-surface py-16 sm:py-20">
        <div className="container-page">
          <WhichTasksRemedies />
        </div>
      </section>

      <section className="border-t border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-10">
          {/* Kept, against the proposal that folded this route to two pages, which listed
              it as a duplicate of the two buttons at the foot of `/the-climb`. They are on
              a different page and this is the one a reader reaches first: a filter whose
              only exit is "now read the account" leaves the reader who just answered yes
              four times with nowhere to go. It is also the move that keeps this route a
              feeder into the registry rather than a destination of its own, which is what
              stops a special case reading as the headline. */}
          <p className="prose-lane text-sm leading-relaxed text-muted">
            Four yeses and the task is a candidate. A yes has somewhere to go: the{" "}
            <Link href="/build" className={INLINE}>
              build workspace
            </Link>
            , and the{" "}
            <Link href="/blueprints" className={INLINE}>
              published graphs
            </Link>
            , whose authors settled the same four answers before drawing a node.
          </p>
          <RoutePager href={HERE} />
        </div>
      </section>
    </>
  );
}
