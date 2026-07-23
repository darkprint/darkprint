import Link from "next/link";
import type { BlueprintGraph, OntologyNodeType } from "@/lib/types";
import { SEED_BLUEPRINTS, PARTS, ONTOLOGIES, PLATFORM_STATS } from "@/lib/data";
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
  nodeTypes?: OntologyNodeType[];
};

const blueprintGraph = SEED_BLUEPRINTS[0]?.graph;
const partGraph = PARTS.find((p) => p.slug === "weighted-vote")?.graph ?? PARTS[0]?.graph;
const ontologyNodeTypes = ONTOLOGIES[0]?.nodeTypes ?? [];

const PANELS: Panel[] = [
  {
    id: "blueprint",
    label: "Blueprint",
    glyph: "▧",
    color: "var(--color-cyan)",
    title: "The whole factory",
    body: "The complete graph of a dark factory — every agent, tool, human gate and edge, from the trigger to the ship node. Versioned, scored, and pulled as one piece.",
    href: "/gallery",
    cta: "Browse blueprints",
    count: PLATFORM_STATS.blueprints,
    graph: blueprintGraph,
  },
  {
    id: "part",
    label: "Part",
    glyph: "◫",
    color: "var(--color-amber)",
    title: "Reusable sub-graphs",
    body: "A retry loop, a validation gate, a negotiation node — packaged on its own with a typed interface. Like npm packages for orchestration logic: drop one into any blueprint.",
    href: kindHref("part"),
    cta: "Browse parts",
    count: PLATFORM_STATS.parts,
    graph: partGraph,
  },
  {
    id: "ontology",
    label: "Ontology",
    glyph: "⬡",
    color: "var(--color-violet)",
    title: "Typed vocabularies",
    body: "The node and edge kinds a factory is built from. Ontologies are the grammar that lets a pipeline be encoded as a graph — and then read, graded and compared as one.",
    href: kindHref("ontology"),
    cta: "Browse ontologies",
    count: PLATFORM_STATS.ontologies,
    nodeTypes: ontologyNodeTypes,
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
          {(panel.nodeTypes ?? []).slice(0, 6).map((nt) => (
            <span
              key={nt.name}
              className="rounded border border-blueprint-line/40 bg-blueprint/30 px-2 py-1 font-mono text-[11px] text-blueprint-ink"
            >
              {nt.name}
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
          title="Three things you can publish"
          lead="Everything on DarkPrint is a graph at some altitude — a whole factory, a piece of one, or the vocabulary they're written in. Each is a first-class, downloadable artifact."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PANELS.map((panel) => (
            <Link
              key={panel.id}
              href={panel.href}
              className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface-2 transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-cyan)]"
              style={{ borderTop: `2px solid ${panel.color}` }}
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
      </div>
    </section>
  );
}
