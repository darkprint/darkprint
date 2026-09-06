import type { Metadata } from "next";

import { bundleSource } from "@/lib/content";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { TOPOLOGY_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DotBreakdown } from "@/components/panes/DotBreakdown";

/* ============================================================
   /spec/topology — layer 1 of the spec language.

   Redesign spec §4.1 split the single `/spec` page into an
   overview and one page per layer, on the author's reading of it:
   "the spec language is ok, but you should reorganize the content
   otherwise it is a very long single page that makes the user
   leave." This is the first of the three, and §4.1 asks that each
   one open with its figure.

   ── The figure this page opened with, and why it is gone ──
   §3 had moved the five roles here from the landing — the
   `SectionRoles` band, eyebrow "The shape of the work", DRW-003 and
   three paragraphs — and this page opened with it for a release.
   The author asked for that subsection off the page in this pass.
   The reasoning it carried is not lost: the loop and the absent
   edge are the whole subject of `TOPOLOGY_ROWS` below, and the DOT
   breakdown under the prose prints the five nodes and five edges the
   drawing traced. What the page loses is a picture; what it gains
   is a route that starts at its own subject, the file, rather than
   at a second telling of the landing's argument.

   ── The file, since the author asked for it to be readable ──
   The `SourcePanel` that stood in the right half of the first band
   is now `components/panes/DotBreakdown.tsx`, the figure the
   blueprint pages mount: full container width, and a rail of buttons
   that lights one block of the file at a time. Same component, same
   behaviour, same source — `bundleSource(STARTER).dot` is
   byte-for-byte the `bp.graph.dot` a blueprint page passes it.

   One sentence went with the change. The first paragraph used to
   read "One attribute does the joining. A node writes
   card="id@version", and the version is exact…", which is
   `NODES_BODY` in `components/panes/dot-breakdown.ts` restated a
   second time on the same screen. The paragraph keeps the claim only
   this page makes — that DOT attribute values are flat strings, which
   is WHY the format splits in two — and hands the rest to the figure
   that says it beside the lines it is about.

   `components/home/SectionRoles.tsx` was mounted here and nowhere
   else, so it is now mounted nowhere. The component and its guards
   stay: `components/home/roles-labels.test.ts` and
   `components/home/roles.test.ts` both render it directly and
   reparse `content/blueprints/starter-software-factory/topology.dot`,
   and `architecture/website.md` names the first of those the
   highest-value guard on the site. A guard is not deleted because a
   mount moved; deleting it is how the drawing would come back
   wrong.

   ── What was cut (spec §5) ──
   The paragraph that used to introduce the DOT listing ended on
   "its lesson is an edge that is not written: nothing runs from
   planner to builder". It was cut when the roles band arrived
   saying the same thing at length, and it is not re-added now the
   band has gone. The prohibition is not a topology check and no row
   in `TOPOLOGY_ROWS` could carry it: a missing edge is not a
   diagnostic, it is a card's `cannot` line, and `/spec/card` is
   where that line is printed and argued. Restating it here would
   put the claim back in the layer that cannot express it, which is
   the one thing this page's three paragraphs exist to explain.

   ── No route config ──
   A static segment, so there is no `generateStaticParams` and no
   `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "The topology file (DOT)",
  description:
    "Layer 1 of a DarkPrint blueprint: one directed graph per bundle, written in a subset of DOT that Attractor parses. One added attribute pins each node to the card that describes it. Compiling the two into a file Attractor runs is a separate step.",
};

const HERE = "/spec/topology";

/** The blueprint this page reads. The same one the drawing above is parsed from. */
const STARTER = "starter-software-factory";

/**
 * The canonical h2, spelled the way `components/ui/SectionHeading.tsx` spells it.
 *
 * Every band below opens with a `.label-lead` and one of these. Two things were wrong
 * with the sub-sections before: they drew at `text-2xl` (24px), which is neither of the
 * two display steps the site has, and they carried no mono cue at all, so a page whose
 * `h1` and whose opening figure each spent a cyan `.eyebrow` had three more sections a
 * reader could not tell apart by scanning. `.label-lead` is the answer rather than a
 * third eyebrow: the eyebrow names a page or a full-bleed band, and the `h1` has spent
 * it. (The figure has since been cut, so one eyebrow is now drawn on the route rather
 * than two. That is a reason to leave this alone, not to promote a band: the two bands
 * below are peers of each other, and an eyebrow on one would rank it over the other.)
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

export default function SpecTopologyPage() {
  const { page } = specNeighbours(HERE);
  const dot = bundleSource(STARTER).dot;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-6">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            /* "a few names of its own" and no longer "one attribute", since 2026-09-06. The
               band below now names three: `card` on a node, `in` and `out` on an edge. A
               lead counting one over a paragraph naming three is a contradiction a reader
               meets on one screen, and the count was the only part of the sentence doing no
               work. The clause after it still narrows to the joining attribute, which is the
               band's subject and the figure's. */
            lead="The wiring, in one file. DarkPrint reads a subset of DOT and adds a few names of its own. The one every node carries joins it to the card that describes it."
          />
        </div>
      </header>

      {/* ---------- the file, and what one attribute joins ----------
          A band, not a row in a flex stack. The three sections of this page used to sit
          inside one `container-page flex flex-col gap-14 py-14`, so the only thing
          separating the prose above from the check table below was 56px of nothing —
          while the two pages in the same nav group next door mark every seam with a
          full-bleed edge and a ground change. Same device here: `border-t` and an
          alternating ground, no new token and no new colour.

          No `border-t` on this one. It used to sit under the roles band, which was
          `bg-surface`, so the rule was the seam between two grounds. It now sits directly
          under the header, which already draws a `border-b` at full bleed: a `border-t`
          here would stack a second hairline on the first and print a 2px rule nothing
          asked for. The header's rule is the seam. */}
      <section
        className="bg-void py-16 sm:py-20"
        aria-labelledby="dot-file-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The file</span>
            <h2 id="dot-file-heading" className={`${BAND_H2} scroll-mt-24`}>
              One file, and the attribute DarkPrint adds
            </h2>
          </div>
          {/* ---------- prose above, figure below, and why the grid went ----------
              This band was a `lg:grid-cols-[1fr_1fr]` with the three paragraphs on the left
              and a `SourcePanel` on the right. The panel measured 564px against a longest
              line of 690px and capped at `max-h-80`, so it clipped line 12 mid-sentence at
              the right edge and cut the 27-line file at about line 16 — a figure whose
              whole job is "here is the file" showing two thirds of it.

              `DotBreakdown` is the same figure the blueprint pages mount, over byte-for-byte
              the same DOT (`bundleSource(STARTER).dot` is `bp.graph.dot`), and it needs the
              container's full 1152px: it splits 2:1 into a 727px listing and a 363px rail,
              and 564px is below the longest line before the rail is even allowed for. So
              the prose stops being a column and becomes what it always should have been —
              body prose at `.prose-lane`'s measure — and the figure takes the width.

              `gap-10` between them, unchanged from the grid this replaces.

              ── No `.prose-lane` here, deliberately ──
              Every other body block on the site is capped at the 36rem measure, and that
              is still the default: long lines hurt reading. The author asked, for THIS
              section only, that the text use the container's full horizontal length so the
              three paragraphs sit on the same 1152px column as the `DotBreakdown` figure
              directly beneath them — prose and figure reading as one band rather than a
              narrow lane floating above a full-width drawing. The lane is dropped, not
              widened, so nothing else inherits the exception. This is scoped and
              intentional: do not "restore" `.prose-lane` here. The band below (`The
              checks`) and every other route are untouched, and `DotBreakdown` itself is
              not involved — it already took the full width. */}
          {/* Two paragraphs, and it was three. The author asked whether this could be
              compacted; it could, and roughly half of it went.

              What came out, and why each one:

                "Which attribute does the joining, and what each block of the file is for, is
                the subject of the breakdown below."  A table of contents for a figure four
                inches down, which announces itself.

                "The compatibility linter reports the places a file would stop being runnable
                as warnings in their own `attractor/` namespace, so a reader can tell which of
                the two readers is complaining."  The namespace is visible in every code it
                emits, and the checks table on this page prints those codes.

              What stayed is the claim only this page makes — attribute values are flat
              strings, which is WHY the format splits in two — and the one name a reader can
              act on wrongly. `type=` is the paragraph a reader loses a morning to and it is
              untouched. */}
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              DOT attribute values are flat strings. That is why the
              format splits into two: the graph carries the wiring, and every
              piece of detail lives in a card beside it. DarkPrint reads a
              strict subset of the DOT that{" "}
              <SpecLink href="https://github.com/strongdm/attractor" external>
                Attractor
              </SpecLink>{" "}
              parses, and Attractor silently ignores every attribute
              name outside its own reserved list. That is what lets{" "}
              <Id>card</Id> and <Id>digest</Id> travel inside a file a runner
              still reads.
            </p>
            {/* ---------- the dialect, named where a reader meets it ----------
                The wave of 2026-09-06. The owner asked whether the ontology should exist at
                all or whether everything should unify under the Attractor specification,
                because the two read as rival standards, and accepted the finding that they
                describe different layers and that the friction is the ORDER: this page
                documents a DOT carrying two attribute names that are in no Attractor
                document, and the page saying whose they are stood three DarkPrint documents
                further on. It is stop 01 now, and this paragraph is the other half of the
                repair. A reader who arrives knowing Attractor should not reach the crosswalk
                before learning that the first two unfamiliar names they saw are ours.

                Every claim in it is read off `lib/core/attractor/emit.ts` rather than
                paraphrased. `DARKPRINT_EMITTED_ATTRIBUTES.node` is `["card", "dp_node"]`,
                which is what "written straight through" means; the four card fields named
                are four rows of that file's own mapping table; and its edge list is
                `["label", "condition", "weight"]`, which is why `in` and `out` compile to
                nothing. Attractor's own edge set is wider (`fidelity`, `thread_id`,
                `loop_restart` as well), so the sentence says what the exporter WRITES and
                does not claim a limit on what a runner reads. */}
            <p>
              Two of the names in that file are DarkPrint&rsquo;s own and are in no
              Attractor document: a node&rsquo;s <Id>card</Id>, which pins it to the card
              that describes it, and an edge&rsquo;s <Id>in</Id> and <Id>out</Id>, which
              name ports the two cards declare. <Id>card</Id> is written straight through
              into the compiled file, where the exporter has already spent it (the
              card&rsquo;s <Id>spec</Id> becomes the node&rsquo;s <Id>prompt</Id>, its{" "}
              <Id>type</Id> selects the <Id>shape</Id> a handler is chosen from) and the
              runner ignores what is left. <Id>in</Id> and <Id>out</Id> compile to nothing,
              because the exporter writes an edge with <Id>label</Id>, <Id>condition</Id>{" "}
              and <Id>weight</Id> on it and nothing else.{" "}
              <SpecLink href="/spec/attractor">The crosswalk</SpecLink> is the whole table.
            </p>
            {/* The paragraph this page went without until 2026-08-30, and the reason the
                metadata above changed with it. The old sentence said Attractor "runs it as
                it stands", which is true of the grammar and false of the file: a topology
                carries no prompt, no start node and no exit node, so Attractor parses it
                and its own lint rules refuse the pipeline. The compiled file is a different
                artefact and now has a command that writes it, so the page can say which is
                which instead of eliding them. */}
            <p>
              A topology on its own is not a pipeline. It carries no prompts and
              neither of the two boundary nodes Attractor requires, so a runner
              parses it and then refuses to run it. <Id>darkprint export &lt;dir&gt; --attractor</Id>{" "}
              is what compiles the graph and its cards into the file a runner
              takes, and that file opens with a list of everything a blueprint
              had no way to say.
            </p>
            <p>
              One name looks free, but it is not. A node <Id>type</Id> attribute means{" "}
              {/* A leading space at the head of a multi-line JSX text node is
                dropped by the compiler, and this paragraph shipped once reading
                "handler overrideto Attractor". Written as a string expression so
                the space is data rather than layout, and so a formatter rewrapping
                the file cannot lose it again. */}
              <em>handler override</em>
              {
                " to Attractor. A card's ontology type stays inside the YAML for that reason. A DOT that puts a term in "
              }
              <Id>type=</Id> is reported as{" "}
              <Id>attractor/reserved-attribute</Id>.
            </p>
            {/* The sentence this page owed and did not have. `shape` had been filed under
                Graphviz layout in `TOPOLOGY_ROWS` beside `rankdir`, which is the reading a
                reader arrives with and is the wrong way round for the artefact this page
                tells them to compile: Attractor spec §2.8 makes the shape the handler
                selector, which is what the `type` paragraph above is an override OF. The
                two belong next to each other or the paragraph above explains an override
                of nothing. */}
            <p>
              <Id>shape</Id> is what that overrides. Attractor picks the
              handler that runs a node from the node&rsquo;s shape, so a shape
              in a runnable file decides what the node does. A topology writes
              shapes for Graphviz and DarkPrint reads none of them: the export
              is where it is settled, and it emits every node with the shape
              its card&rsquo;s type maps to.
            </p>
          </div>

          {/* `downloadName`, which the blueprint pages do not pass: this route has no
              `Download` disclosure of its own, and the `SourcePanel` this replaces offered
              the file. Losing a working button to a redesign is a regression whatever else
              the redesign fixes. */}
          <DotBreakdown
            source={dot}
            title={`${STARTER}/topology.dot`}
            downloadName="topology.dot"
          />
        </div>
      </section>

      {/* ---------- what the engine holds the file to ----------
          The table had no heading of any kind, so on a page whose sections were
          separated by whitespace it was a run of rows that started mid-scroll. It gets
          the same two-line header as the band above it and its own ground. */}
      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="dot-checks-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The checks</span>
            <h2 id="dot-checks-heading" className={`${BAND_H2} scroll-mt-24`}>
              What the engine checks in the DOT layer
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <CheckLegend />
            <CheckTable
              rows={TOPOLOGY_ROWS}
              caption="What the engine checks in the DOT layer, and what it leaves to the author"
            />
          </div>
        </div>
      </section>

      {/* The rail closes the page on the opposite ground, and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule 64px above
          an inset rule is two lines saying one thing. The ground change is the seam. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
