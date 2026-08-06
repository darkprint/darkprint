import type { Metadata } from "next";

import { bundleSource } from "@/lib/content";
import { SectionRoles } from "@/components/home/SectionRoles";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { TOPOLOGY_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SourcePanel } from "@/components/ui/SourcePanel";

/* ============================================================
   /spec/topology — layer 1 of the spec language.

   Redesign spec §4.1 split the single `/spec` page into an
   overview and one page per layer, on the author's reading of it:
   "the spec language is ok, but you should reorganize the content
   otherwise it is a very long single page that makes the user
   leave." This is the first of the three, and §4.1 asks that each
   one open with its figure.

   ── The figure is imported, and it is held to the file ──
   §3 moves the five roles here from the landing, where they were
   one of eight sections nobody reached the bottom of. It is the
   right page for them: the roles drawing *is* the topology layer,
   and `components/home/roles.test.ts` reparses
   `content/blueprints/starter-software-factory/blueprint.dot` and
   the five cards it names, so the wires, the labels and the
   iteration cap in that drawing cannot drift away from the bundle
   this page then prints in full underneath.

   `components/home/SectionRoles.tsx` is owned elsewhere this pass,
   so it is imported by path rather than through the
   `components/home` barrel: moving it off the landing's index must
   not be able to break this route.

   ── What was cut (spec §5) ──
   The paragraph that used to introduce the DOT listing ended on
   "its lesson is an edge that is not written: nothing runs from
   planner to builder". The section above now makes that argument
   with a drawing, two panels and the card that declares the
   prohibition. One copy survives, and it is the longer one.

   ── No route config ──
   A static segment, so there is no `generateStaticParams` and no
   `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "The topology, in DOT",
  description:
    "Layer 1 of a DarkPrint blueprint: one directed graph per bundle, written in a subset of DOT that Attractor runs as it stands, with one added attribute pinning each node to the card that describes it.",
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
 * `h1` and whose figure each spend a cyan `.eyebrow` had three more sections a reader
 * could not tell apart by scanning. `.label-lead` is the answer rather than a third
 * eyebrow: the eyebrow names a page or a full-bleed band, and this page has spent both.
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
            lead="The wiring, in one file. DarkPrint reads a subset of DOT and adds one attribute to it, and that attribute is what joins a node in the graph to the card describing it."
          />
        </div>
      </header>

      {/* The figure this page opens with. Five roles, five edges, one absence. */}
      <SectionRoles />

      {/* ---------- the file, and what one attribute joins ----------
          A band, not a row in a flex stack. The three sections of this page used to sit
          inside one `container-page flex flex-col gap-14 py-14`, so the only thing
          separating the prose above from the check table below was 56px of nothing —
          while the two pages in the same nav group next door mark every seam with a
          full-bleed edge and a ground change. Same device here: `border-t` and an
          alternating ground, no new token and no new colour. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="dot-file-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The file</span>
            <h2 id="dot-file-heading" className={BAND_H2}>
              One file, and the attribute DarkPrint adds
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
            {/* `.prose-lane`, which is a no-op at `lg` — the grid column is already 564px
                — and the whole point between `sm` and `lg`, where this column is the full
                1152px container and these three paragraphs ran past 140 characters. */}
            <div className="prose-lane flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
              <p>
                DOT attribute values are flat strings, which is the reason the
                format splits in two: the graph carries the wiring and every
                piece of detail lives in a card beside it. One attribute does
                the joining. A node writes <Id>card=&quot;id@version&quot;</Id>,
                and the version is exact, so the same file read twice describes
                the same five nodes.
              </p>
              <p>
                DarkPrint reads a strict subset of DOT that{" "}
                <SpecLink href="https://github.com/strongdm/attractor" external>
                  Attractor
                </SpecLink>{" "}
                runs as it stands. Attractor reserves a list of attribute names
                and silently ignores every name outside it, which is what lets{" "}
                <Id>card</Id> and <Id>digest</Id> ride along in a file a runner
                still executes. The compatibility linter reports the places a
                file would stop being runnable as warnings in their own{" "}
                <Id>attractor/</Id> namespace, so a reader can tell which of the
                two readers is complaining.
              </p>
              <p>
                One name is worth knowing about because it looks free and is
                not. A node <Id>type</Id> attribute means{" "}
                {/* A leading space at the head of a multi-line JSX text node is
                  dropped by the compiler, and this paragraph shipped once reading
                  "handler overrideto Attractor". Written as a string expression so
                  the space is data rather than layout, and so a formatter rewrapping
                  the file cannot lose it again. */}
                <em>handler override</em>
                {
                  " to Attractor. A card's ontology type stays inside the YAML for that reason, and a DOT that puts a term in "
                }
                <Id>type=</Id> is reported as{" "}
                <Id>attractor/reserved-attribute</Id>.
              </p>
            </div>
            {/* A code pane is not prose: it keeps its half of the grid. */}
            <SourcePanel
              source={dot}
              language="DOT"
              title={`${STARTER}/blueprint.dot`}
              downloadName="blueprint.dot"
            />
          </div>
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
            <h2 id="dot-checks-heading" className={BAND_H2}>
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
