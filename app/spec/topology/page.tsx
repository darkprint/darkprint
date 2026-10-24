import type { Metadata } from "next";

import { bundleSource } from "@/lib/content";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { TOPOLOGY_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DotBreakdown } from "@/components/panes/DotBreakdown";
import { guideStyles as guide } from "@/components/ui/Guide";
import { NPX_INVOCATION } from "@/packages/cli/src/index";

/* ============================================================
   /spec/topology: the DOT file, and what the validator checks in it.

   The page opens on its own subject, the file. The DOT breakdown
   prints the starter's five nodes and five edges with the comments
   the author wrote, and the prose above it keeps the one claim only
   this page makes: DOT attribute values are flat strings, which is
   why the format splits into a graph and a card per node.

   The prohibition the starter demonstrates is a card's `cannot` line
   and not a topology check, so `/spec/card` argues it and no row here
   restates it.

   A static segment: no `generateStaticParams`, no `dynamicParams`, a
   server component with no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "The topology file (DOT)",
  description:
    "The DOT file that wires a DarkPrint blueprint: one directed graph, one node per step, and a card attribute pinning each node to the YAML card that describes it. What the validator checks, what it leaves to you, and why the file is not yet a runnable pipeline.",
};

const HERE = "/spec/topology";

/** The blueprint this page reads, the same one every figure on the site opens with. */
const STARTER = "starter-software-factory";

/**
 * The canonical band `h2`, spelled the way `components/ui/SectionHeading.tsx` spells it.
 * The two bands are peers, so neither takes an eyebrow: the `h1` has spent the page's one.
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
            lead="A directed graph connects the steps. Each node pins the card that defines its work, using an exact id@version."
          />
        </div>
      </header>

      {/* No `border-t`: the header already draws one at full bleed, and a second hairline
          under it would print a 2px rule nothing asked for. */}
      <section className="bg-void py-16 sm:py-20" aria-labelledby="dot-file-heading">
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The file</span>
            <h2 id="dot-file-heading" className={`${BAND_H2} scroll-mt-24`}>
              The DOT file
            </h2>
          </div>
          {/* No `.prose-lane` here, on the owner's instruction for this section only: the
              paragraphs sit on the same full column as the figure directly beneath them, so
              prose and figure read as one band. Nothing else inherits the exception. */}
          <div className={`${guide.panel} flex flex-col gap-4 text-base leading-relaxed text-muted`}>
            <p>
              DarkPrint reads a subset of Graphviz DOT. Each node pins a YAML card with
              <Id>card</Id>; edge attributes <Id>in</Id> and <Id>out</Id> name ports on those cards.
            </p>
            <p>
              A topology carries no prompts or Attractor boundary nodes. Compile the graph
              and cards with <Id>{`${NPX_INVOCATION} export <dir> --attractor`}</Id>, from the
              darkprint package on npm. The output lists settings a blueprint cannot express.
            </p>
            <p>
              The exporter turns card instructions into Attractor prompts and card types into handlers.
              See the <SpecLink href="/spec/attractor">Attractor crosswalk</SpecLink> for the complete mapping.
            </p>
            <p>
              Keep <Id>type</Id> in the card. A DOT node’s <Id>type=</Id> overrides the runner’s
              handler and produces <Id>attractor/reserved-attribute</Id>. A topology’s
              <Id>shape</Id> is only a drawing hint; the exporter derives it from the card.
            </p>
          </div>

          {/* `downloadName` because this route has no download disclosure of its own, and
              `verbatim` because this page shows the file whole, comments included. */}
          <div className={guide.diagram}>
            <div className={guide.fileHeader}>topology.dot <span className="text-muted">{STARTER}</span></div>
            <DotBreakdown
              source={dot}
              title={`${STARTER}/topology.dot`}
              downloadName="topology.dot"
              verbatim
            />
          </div>
        </div>
      </section>

      <section
        className="border-t border-line bg-surface/40 py-16 sm:py-20"
        aria-labelledby="dot-checks-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The checks</span>
            <h2 id="dot-checks-heading" className={`${BAND_H2} scroll-mt-24`}>
              What the validator checks in the DOT layer
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <CheckLegend />
            <CheckTable
              rows={TOPOLOGY_ROWS}
              caption="What the validator checks in the DOT layer, and what it leaves to the author"
            />
          </div>
        </div>
      </section>

      {/* No `border-t` of its own: `SpecPager` draws one at container width. */}
      <section className="bg-void py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
