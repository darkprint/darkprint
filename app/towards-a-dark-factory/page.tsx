import type { Metadata } from "next";

import { SectionLevels } from "@/components/home/SectionLevels";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
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

const HERE = "/towards-a-dark-factory";


/* `INLINE` and the `next/link` import went with the two paragraphs the author removed on
   2026-08-08 — the deck's link to `/blueprints` and the section that carried the four
   questions. Nothing on this route links inline any more; the header, the footer and the
   ladder's own source list are the ways out. Recorded rather than dropped silently, because
   the next inline link written here will want the class and there is no shared token for
   it. */

export default function TowardsPage() {
  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecCrumb href={HERE} />
          <SectionHeading
            className="mt-5"
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
          {/* This slot held "Two different things get called autonomy here, and only one of
              them is a number …" and the author asked it out on 2026-08-08.

              What stands here instead is the sentence they asked moved up from the foot of
              the page, where it was the lead of the section that is now gone. It belongs
              here: the ladder under it measures how much of a run goes unattended, and this
              is the one property that decides whether unattended is possible at all. The
              route opens on its constraint and then counts the rungs, rather than counting
              first and naming the constraint 2,500px later.

              `text-fg` across the whole line rather than on a clause: it is one sentence, it
              is the page's premise, and it is the only body prose in this header. */}
          <p className="mt-6 text-[15px] leading-[1.7] text-fg">
            A dark factory runs with nobody watching it, so the design rests on one property
            of the work: whether something other than your judgement can tell the graph it
            is finished.
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
      {/* The whole "Before you build one / Which tasks a dark factory can take" section
          stood here, with `WhichTasksGlance` under it, and the author asked it out on
          2026-08-08: "totally remove the section".

          It was the second of this page's two jobs, and the sentence it opened with is now
          the page's own deck — moved up in the same instruction, so the one claim that was
          doing work at the foot of the route opens it instead.

          `#which-tasks` was a live anchor and `next.config.ts` still redirects
          `/which-tasks` here; the page resolves and the fragment matches nothing, which is
          the state every other merged route on this site is already in. */}

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

      {/* ---------- where to next ----------
          Restored 2026-08-08 on the author's instruction: "add section Where to next at the
          bottom as for the other pages and add to the left the button towards
          /reading-the-radar."

          The note directly above records the 2026-08-07 removal and the argument it
          overruled, and both stand: what came out was a paragraph and its two links, and
          what goes back is the band every other route on this site ends with. `/build` and
          `/blueprints` are still not offered here — the header carries them from every page,
          and this route's own next step is the scorecard, because the ladder above measures
          autonomy and `/reading-the-radar` is where that reading is explained. */}
      {/* No `border-t`, and the same ground as the band above it, since 2026-08-11.
          `SectionLevels` ends on the sources band on `--color-surface`, and 4a puts the
          sources and this pager on one ground with no seam between them — they are the
          route's one closing block, not two. The band above draws its own top edge and
          spends its own bottom padding, so this one only has to close the page. */}
      <section className="bg-surface pb-20">
        <div className="container-page">
          {/* The pager is back with the route's place in the sequence. It is the last stop
              of the practice run, so it draws a PREVIOUS and no NEXT — which is what the
              hand-built signpost that stood here for one pass was standing in for. */}
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
