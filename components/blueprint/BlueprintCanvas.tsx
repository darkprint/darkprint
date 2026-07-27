"use client";

import { useMemo, useState } from "react";
import type {
  BlueprintAnalysisView,
  BlueprintGraph as BlueprintGraphData,
} from "@/lib/types";
import { BlueprintGraph } from "@/components/graph/BlueprintGraph";
import { Explainability } from "./Explainability";

/**
 * The schematic and the explanation of its scores, sharing one piece of state: which
 * node a finding is pointing at. That is the only reason this boundary exists — the
 * page stays a server component and hands down analysis that was computed at build
 * time; everything below the `"use client"` line is the click.
 */
export function BlueprintCanvas({
  graph,
  analysis,
}: {
  graph: BlueprintGraphData;
  analysis: BlueprintAnalysisView;
}) {
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);

  const nodeNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const node of graph.nodes) names[node.id] = node.label;
    return names;
  }, [graph]);

  const litName =
    highlighted === undefined ? undefined : (nodeNames[highlighted] ?? highlighted);

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Pipeline schematic
          </span>
          <span className="font-mono text-[11px] text-dim">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </span>
        </div>

        {/* Mounted whether or not anything is highlighted: a live region added to the
            page at the moment its content changes is a region screen readers miss. */}
        <p aria-live="polite" className="sr-only">
          {litName === undefined
            ? "No node is highlighted in the schematic."
            : `${litName}, node ${highlighted}, is highlighted in the schematic.`}
        </p>

        {litName !== undefined && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line bg-surface-2 px-4 py-2">
            <span className="font-mono text-[11px] text-cyan" aria-hidden>
              ◎
            </span>
            <span className="font-mono text-[11px] text-muted">
              Highlighted <span className="text-fg">{litName}</span>{" "}
              <span className="text-dim">{highlighted}</span>
            </span>
            <button
              type="button"
              onClick={() => setHighlighted(undefined)}
              aria-label="Clear the schematic highlight"
              className="ml-auto rounded border border-line px-2 py-0.5 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
            >
              clear
            </button>
          </div>
        )}

        <div className="p-3">
          <BlueprintGraph graph={graph} highlighted={highlighted} />
        </div>
      </section>

      <Explainability
        autonomy={analysis.autonomy}
        security={analysis.security}
        nodeNames={nodeNames}
        highlighted={highlighted}
        onHighlight={setHighlighted}
      />
    </>
  );
}
