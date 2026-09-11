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
            lead="The wiring, in one file. A topology is a Graphviz DOT graph: one node per step, one edge per hand-off. DarkPrint adds a few attribute names of its own, and the one every node carries, card, pins the node to the YAML card that describes the step."
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
              One file, and the names DarkPrint adds
            </h2>
          </div>
          {/* No `.prose-lane` here, on the owner's instruction for this section only: the
              paragraphs sit on the same full column as the figure directly beneath them, so
              prose and figure read as one band. Nothing else inherits the exception. */}
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-muted">
            <p>
              DOT attribute values are flat strings. That is why the format splits in two:
              the graph carries the wiring, and every piece of detail lives in a card beside
              it. DarkPrint reads a subset of Graphviz DOT.{" "}
              <SpecLink href="https://github.com/strongdm/attractor" external>
                Attractor
              </SpecLink>
              , StrongDM&rsquo;s graph runner and the program the compiled file is written
              for, reads a narrower grammar still and ignores any attribute name it does not
              reserve. That is what lets DarkPrint&rsquo;s own <Id>card</Id> attribute sit in
              a file Attractor also parses.
            </p>
            {/* Every claim here is read off `lib/core/attractor/emit.ts`: the node attributes
                it writes are `card` and `dp_node`, and its edge list is `label`, `condition`
                and `weight`, which is why `in` and `out` compile to nothing. The sentence
                says what the exporter writes and claims no limit on what a runner reads. */}
            <p>
              Two of the names in that file are DarkPrint&rsquo;s own and are in no Attractor
              document: a node&rsquo;s <Id>card</Id>, which pins it to the card that describes
              it, and an edge&rsquo;s <Id>in</Id> and <Id>out</Id>, which name ports the two
              cards declare. When the folder is compiled for Attractor, <Id>card</Id> is
              copied through unchanged. By then the exporter has used it: the card&rsquo;s{" "}
              <Id>spec</Id> becomes the node&rsquo;s <Id>prompt</Id>, and its <Id>type</Id>{" "}
              picks the node&rsquo;s <Id>shape</Id>, which is how Attractor chooses a handler,
              the program that runs the node. The runner then ignores the attribute.{" "}
              <Id>in</Id> and <Id>out</Id> are not copied at all; a compiled edge carries
              only <Id>label</Id>, <Id>condition</Id> and <Id>weight</Id>.{" "}
              <SpecLink href="/spec/attractor">The Attractor crosswalk</SpecLink> lists every
              attribute the compiled file gets and where each one comes from.
            </p>
            <p>
              A topology on its own is not a pipeline. It carries no prompts and neither of
              the two boundary nodes Attractor requires, so a runner parses it and then
              refuses to run it. <Id>darkprint export &lt;dir&gt; --attractor</Id> compiles
              the graph and its cards into the file a runner takes, and that file opens with
              a list of everything a blueprint has no way to say. The command ships in the
              darkprint package, which is not on npm yet;{" "}
              <SpecLink href="/mcp">the MCP page</SpecLink> says what works today.
            </p>
            <p>
              Do not write <Id>type=</Id> on a node. To Attractor, a node&rsquo;s{" "}
              <Id>type</Id> attribute overrides the handler its shape would select, so a
              DarkPrint type such as <Id>agent</Id> would be read as a handler name. A
              card&rsquo;s type therefore stays inside the YAML, and a DOT that writes{" "}
              <Id>type=</Id> is reported as <Id>attractor/reserved-attribute</Id>.
            </p>
            <p>
              <Id>shape</Id> is the attribute that override would replace. Attractor picks the
              handler that runs a node from the node&rsquo;s shape, so in a compiled file the
              shape decides what the node does. In a topology, <Id>shape</Id> is only a
              drawing hint: DarkPrint ignores it, and the exporter writes each node&rsquo;s
              shape from its card&rsquo;s type.
            </p>
          </div>

          {/* `downloadName` because this route has no download disclosure of its own, and
              `verbatim` because this page shows the file whole, comments included. */}
          <DotBreakdown
            source={dot}
            title={`${STARTER}/topology.dot`}
            downloadName="topology.dot"
            verbatim
          />
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
