import type { CSSProperties } from "react";
import Link from "next/link";
import type { BlueprintGraph } from "@/lib/types";
import { CORE_PHASE_IDS } from "@/lib/core";
import { SEED_BLUEPRINTS, PLATFORM_STATS } from "@/lib/data";
import { allNodeCards } from "@/lib/content";
import { kindHref } from "@/lib/href";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Panel = {
  id: string;
  label: string;
  glyph: string;
  color: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  count: number;
  graph?: BlueprintGraph;
  /** Mono chips shown when there is no schematic to draw. */
  chips?: string[];
};

const blueprintGraph = SEED_BLUEPRINTS[0]?.graph;
const nodeIds = allNodeCards().map((record) => record.id);
/* The five phases, in the lifecycle order the vocabulary itself publishes them in — not
   `byKind("phase")`, which sorts by id and would open the set with `debugging`. They are
   the vocabulary's most legible five terms and the one dimension that is closed, which
   makes them the honest preview: every card declares exactly one. */
const phaseIds = [...CORE_PHASE_IDS];

const PANELS: Panel[] = [
  {
    id: "blueprint",
    label: "Blueprint",
    glyph: "▧",
    color: "var(--color-cyan)",
    title: "The whole factory",
    body: "The complete graph of a dark factory — every agent, tool, human gate and edge, from the trigger to the ship node. Versioned, scored, and pulled as one piece.",
    href: "/blueprints",
    cta: "Browse blueprints",
    count: PLATFORM_STATS.blueprints,
    graph: blueprintGraph,
  },
  {
    id: "node",
    label: "Node",
    glyph: "◫",
    color: "var(--color-amber)",
    title: "One node, fully described",
    body: "The unit a factory is assembled from: a card that states what the node does, which model or tool does it, the typed ports it reads and writes, and whether a human has to sign off. Blueprints pin it by version, so a graph always names the exact card it ran.",
    href: kindHref("node"),
    cta: "Browse node cards",
    count: PLATFORM_STATS.nodes,
    chips: nodeIds,
  },
  {
    id: "ontology",
    label: "Ontology",
    glyph: "⬡",
    color: "var(--color-violet)",
    title: "The shared vocabulary",
    body: "The lifecycle phases, node types, data types, tools and risk markers a card is allowed to name. One curated core, versioned and hierarchical, with room for namespaced local terms — the grammar that lets a pipeline be read, graded and compared as one. The five phases are the exception: they are closed, because they are the definition of a dark factory rather than a taxonomy of it.",
    href: kindHref("ontology"),
    cta: "Read the ontology",
    count: PLATFORM_STATS.terms,
    chips: phaseIds,
  },
];

function Preview({ panel }: { panel: Panel }) {
  return (
    <div className="relative h-40 overflow-hidden border-b border-line bg-blueprint-deep/40 bp-grid">
      {panel.graph ? (
        <GraphThumbnail
          graph={panel.graph}
          className="h-full w-full p-2 opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
          ariaLabel={`${panel.label} preview`}
        />
      ) : (
        <div className="flex h-full flex-wrap content-center items-center justify-center gap-1.5 p-4">
          {(panel.chips ?? []).slice(0, 6).map((chip) => (
            <span
              key={chip}
              className="rounded border border-blueprint-line/40 bg-blueprint/30 px-2 py-1 font-mono text-[11px] text-blueprint-ink"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
    </div>
  );
}

export function SectionContent() {
  return (
    <section id="content" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="What lives in the registry"
          title="Three surfaces, one graph"
          lead="Everything on DarkPrint is a graph at some altitude — a whole factory, one node of it, or the vocabulary both are written in. Two of those are structural primitives with their own pages and their own versions; the third is what gives the other two their meaning."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PANELS.map((panel) => (
            <Link
              key={panel.id}
              href={panel.href}
              className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-2 transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--card-accent)]"
              style={
                {
                  borderTop: `2px solid ${panel.color}`,
                  "--card-accent": panel.color,
                } as CSSProperties
              }
            >
              <Preview panel={panel} />
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]"
                    style={{ color: panel.color }}
                  >
                    <span className="text-base leading-none">{panel.glyph}</span>
                    {panel.label}
                  </span>
                  <span className="font-mono text-[11px] text-dim tabular-nums">{panel.count}</span>
                </div>
                <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                  {panel.title}
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-muted">{panel.body}</p>
                <span
                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs transition-transform group-hover:translate-x-0.5"
                  style={{ color: panel.color }}
                >
                  {panel.cta}
                  <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
          There is deliberately no third structural level between the node and the graph.
          A reusable sub-graph is only a smaller blueprint, and the line between the two
          would have to be drawn somewhere arbitrary — so when the need becomes real it
          gets answered by letting one blueprint reference another as a composite node,
          not by adding a section. That composition is designed for and deferred: nothing
          on the site does it today, and this page is not going to imply otherwise.
        </p>
      </div>
    </section>
  );
}
