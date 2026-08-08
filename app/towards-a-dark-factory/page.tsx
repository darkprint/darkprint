import type { Metadata } from "next";
import Link from "next/link";

import { SectionLevels } from "@/components/home/SectionLevels";
import { WhichTasksGlance } from "@/components/explain/WhichTasksGlance";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   The whole route, as of 2026-08-07. One question, asked in two
   halves: where are you, and is the work in front of you a
   candidate at all?

   ── It was "stop 1 of 2" until the author deleted stop 2 ──
   `/towards-a-dark-factory/the-climb` is gone, and with it the four
   sections narrating somebody else's working autonomous pipeline.
   What that page cost is worth writing down, because the honesty
   ledger lost a row to it: its closing section was the only place
   the route stated its own limits, and the reason it needed to was
   that it spent four sections narrating a factory that runs. This
   page makes no such narration, so the row went out with the
   argument for it rather than being relocated. `/skill`, `/mcp` and
   `/upload` each carry their own refusals and always did.

   Deleted with it, because nothing else mounted them: `RoutePager`,
   `route.ts` and `CLIMB_ROUTE` (a pager needs two stops),
   `PhaseStrip` and `IsolationWall` (its two figures). The same
   pattern `SpecLayers.tsx` set when `/spec` went.

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
   was always the risk section of. `next.config.ts` carries the 308.

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

   The rail is deleted (`RoutePager`), the climb's dim line went
   with the climb, and the sentence itself is now in the
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
   hero → the ladder → the figure that asks the four questions. That
   is the whole page as of 2026-08-07. It read "… → eight worked
   tasks → the four questions in full → what to do with a no → the
   two exits", and the author asked every one of those out over two
   instructions. Every band is still a `border-t` and a change of
   ground; there are two bands left rather than six.
   ============================================================ */

export const metadata: Metadata = {
  title: "Towards a Dark Factory",
  description:
    "Four levels of working with agents, where most teams actually sit, and the four questions that decide whether a task belongs in a pipeline nobody is watching. The gap between level 2 and level 4 is architectural and organisational, which makes it a design problem.",
};


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
            /* "inside a harness somebody wrote" is not decoration, and it was missing.
               ------------------------------------------------------------
               The author, 2026-08-08: "The dark factory itself has a harness. Read the link
               about what a dark factory is and reframe the whole page."

               The linked source defines the pattern as an autonomous delivery environment
               and then spends most of its length on what holds it up — sandboxes, a
               pipeline, policy engines, testing layers, observability — saying the model
               "depends entirely on this layered control system". This lead defined a dark
               factory purely by what is ABSENT from it, which reads as fewer rules rather
               than more, and the second half of this very page is a filter against exactly
               that misreading. Unattended is the consequence; the harness is the cause. */
            lead="A dark factory is one shape a blueprint can take: a graph where planning, implementation, testing, debugging and deployment all run unattended, inside a harness somebody wrote. Unattended is what it costs to build, not what it saves. It is a special case and not a summit: a graph with a person standing in it is a first-class blueprint here, and is shelved beside the rest."
          />
          {/* The two scales, named apart before the five-rung list rather than after it.
              `text-fg` on the clause that does the work: this used to be the dimmest text
              on the route carrying its most load-bearing constraint. */}
          {/* Full width, on the author's instruction 2026-08-07. This is the deck that
              carries doc 2 §1.1 — the paragraph the deleted two-scales panel handed its
              claim to — so it is the one piece of prose on the route a reader must not
              skim past, and it now runs the width of the band the ladder below it fills. */}
          <p className="mt-6 text-[15px] leading-[1.7] text-muted">
            <span className="text-fg">
              Two different things get called autonomy here, and only one of them is a
              number.
            </span>{" "}
            The ladder below counts what an organisation is able to do at all. The class
            printed on a blueprint records where the author of that one graph decided a
            person should stand, and it ranks nothing:{" "}
            <Link href="/blueprints" className={INLINE}>
              the gallery
            </Link>{" "}
            filters on it and prints no number beside it. Find yourself on the ladder
            first; the four questions after it decide whether the work in front of you is a
            candidate at all.
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

          The figure, and nothing after it. This read "Figure, then the eight tasks, then
          the four questions in full, then what to do with a no. A reader settles a
          comparison faster than a definition, so the examples sit above the definitions."
          All three of those sections are gone on the author's instruction, so there is no
          ordering argument left to make: the glance asks the four questions and the page
          ends. The sentence about the unsuitable side being "written at full strength"
          above is now carried by the two `A NO ON …` columns inside the figure itself,
          which is the only place on the route that still says what to do with a no. */}
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

      {/* Three sections stood between the figure above and the end of the page, and the
          author asked all three out on 2026-08-07, in two instructions:

            `WhichTasksExamples`  "The worked half / Eight real tasks, run through the four
                                  questions"
            `WhichTasksChecks`    "The instrument / The four questions in full"
            `WhichTasksRemedies`  "The other half of the filter / What to do with a no"

          What is left asks the four questions once, in `WhichTasksGlance`, in their glance
          form. That is worth naming because the component's own header calls those the
          SHORT forms and points at `WhichTasksChecks` for the asked form — there is no
          asked form on the site any more, and the glance is the whole of it.

          `WhichTasksChecks` took three honesty-ledger rows with it. All three were
          `where: "present"` and all three completed an argument the examples made: the
          `why` on two of them reads "the examples above say the tester passes whatever it
          is given; nothing else says what that makes the graph". The examples went first,
          so the rows were qualifying a claim that had already left. They are removed with
          the reason stated, which is what `honesty.test.ts`'s header asks of a deliberate
          removal — not relocated, because there is nothing left for them to qualify. */}

      {/* The route's last section stood here and is gone with its only contents. It held
          one paragraph — "Four yeses and the task is a candidate", with links to `/build`
          and `/blueprints` — which the author asked out on 2026-08-07, and before that the
          `RoutePager` that went with `/the-climb`.

          Worth stating plainly rather than leaving as an absence somebody rediscovers: the
          route now ends on `WhichTasksGlance`, and it offers a reader no onward link of its
          own. The comment that used to sit here argued the opposite case at length — "a
          filter whose reader has just answered yes four times has to have somewhere to go"
          — and it was overruled directly. The header and the footer still reach `/build`
          and `/blueprints` from every page, so nothing is unreachable; what is gone is this
          page's own exit. */}

    </>
  );
}
