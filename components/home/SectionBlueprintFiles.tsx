import Link from "next/link";

import { GraphFigure, GraphKey } from "@/components/learn/PartFigures";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getBlueprintBySlug, getNodeCard } from "@/lib/content";
import type { NodeCard } from "@/lib/core";

import { BlueprintFilesMotion } from "./BlueprintFilesMotion";
import styles from "./SectionBlueprintFiles.module.css";

function CardPort({ direction, port }: { direction: "in" | "out"; port: NodeCard["inputs"][number] }) {
  return (
    <dl className={`${styles.port} min-w-0`}>
      <dt className="font-mono text-[11px] uppercase tracking-widest text-muted">{direction}</dt>
      <dd className="mt-2 break-words font-mono text-base text-copper-ink">{port.name}</dd>
      <dd className="mt-1 break-words font-mono text-xs text-muted">{port.type}</dd>
    </dl>
  );
}

function PinnedCard({ card }: { card: NodeCard }) {
  return (
    <div className={styles.card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold tracking-tight text-copper-ink">{card.name}</p>
          <p className="mt-1 break-words font-mono text-xs text-copper-line">{card.id}</p>
        </div>
        <span className="shrink-0 rounded-md border border-copper-line/25 px-2 py-1 font-mono text-xs text-copper-ink">v{card.version}</span>
      </div>
      <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-b border-copper-line/15 pb-5 font-mono text-xs">
        <div className="flex gap-2"><dt className="text-muted">type</dt><dd className="text-copper-ink">{card.type}</dd></div>
        <div className="flex gap-2"><dt className="text-muted">phase</dt><dd className="text-copper-ink">{card.phases.join(", ")}</dd></div>
      </dl>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 py-5">
        <CardPort direction="in" port={card.inputs[0]} />
        <span aria-hidden className={`${styles.portArrow} text-xl text-copper-line`}>→</span>
        <CardPort direction="out" port={card.outputs[0]} />
      </div>
      <dl className="flex flex-wrap gap-x-4 gap-y-1 border-t border-copper-line/15 pt-4 font-mono text-xs">
        <dt className="text-muted">model</dt><dd className="break-words text-copper-ink">{card.model ?? "inherits"}</dd>
      </dl>
      <dl className={styles.prohibition}>
        <dt className="flex items-center gap-2 text-xs text-muted"><span aria-hidden className="text-base text-signal">◌</span> cannot receive</dt>
        <dd className="mt-1 break-words font-mono text-xs text-signal">{card.cannot.join(", ")}</dd>
      </dl>
    </div>
  );
}

export function SectionBlueprintFiles() {
  const blueprint = getBlueprintBySlug("starter-software-factory");
  const ref = blueprint?.cardRefs.find((cardRef) => cardRef.startsWith("code-builder@"));
  const [id, version] = ref?.split("@") ?? [];
  const card = id === undefined ? undefined : getNodeCard(id, version)?.card;
  if (blueprint === undefined || card === undefined) return null;

  return (
    <section id="blueprint" className="scroll-mt-24 border-t border-line bg-surface/40 py-14 sm:py-20">
      <div className="container-page">
        <SectionHeading
          title="A graph. A card for each step."
          lead="The graph connects the work. Each card defines one node’s job and limits."
        />
        <BlueprintFilesMotion className={`${styles.workbench} mt-8 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`}>
          <figure className={`${styles.graphPanel} flex min-w-0 flex-col p-0`}>
            <figcaption className={styles.caption}>
              <span className={styles.fileIcon} aria-hidden />
              <div className="min-w-0">
                <span className="font-mono text-xs text-blueprint-line">topology.dot</span>
                <span className="mt-1 block text-sm text-muted">{blueprint.title}</span>
              </div>
              <span className="ml-auto shrink-0 font-mono text-xs text-muted">{blueprint.graph.nodes.length} nodes</span>
            </figcaption>
            <div className={`${styles.graphField} flex flex-1 items-center`}>
              <GraphFigure graph={blueprint.graph} title={blueprint.title} compact nodeMark="schematic" highlightedNode="builder" highlightedNodeLabel={card.name} />
            </div>
            <div className="mx-4 mb-5 mt-2 border-t border-blueprint-line/15 pt-4 font-mono text-xs leading-relaxed text-muted sm:mx-6">
              <GraphKey graph={blueprint.graph} />
            </div>
          </figure>
          <figure id="node" className={`${styles.cardPanel} min-w-0 scroll-mt-24`}>
            <figcaption className={styles.caption}>
              <span className={styles.fileIcon} aria-hidden />
              <span className="min-w-0 break-words font-mono text-xs text-copper-line">cards/{ref}.yaml</span>
            </figcaption>
            <div className="px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
              <div className="mb-4 flex items-center gap-3 font-mono text-xs">
                <span className={styles.nodePin}>{card.name}</span>
                <span aria-hidden className={styles.cardLink} />
                <span className="text-muted">card for this node</span>
              </div>
              <PinnedCard card={card} />
              <p className="mt-5 text-sm leading-relaxed text-muted">
                Reuse an exact card version in another graph. Your own runner executes the files.
              </p>
            </div>
          </figure>
        </BlueprintFilesMotion>
        <Link href="/what-a-blueprint-is" className="mt-6 inline-flex text-sm text-cyan underline underline-offset-4">
          What a blueprint is <span aria-hidden className="ml-2">→</span>
        </Link>
      </div>
    </section>
  );
}
