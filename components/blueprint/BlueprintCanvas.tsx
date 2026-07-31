"use client";

import { useMemo, useState, type ReactNode } from "react";
import type {
  BlueprintAnalysisView,
  BlueprintGraph as BlueprintGraphData,
} from "@/lib/types";
import { Explainability } from "./Explainability";

/**
 * A shared-state wrapper around Explainability, not a schematic anymore.
 *
 * This component used to also draw its own "Pipeline schematic" panel here, above
 * Explainability, with a shared `highlighted` node id linking a click on a schematic
 * node to the matching contribution/finding row lighting up below (and back). The
 * blueprint detail page's own schematic now lives in the merged, interactive graph
 * panel at the top of the page (`SynchronisedPanes`/`GraphPane`) instead — a
 * different client component with its own `selection` state, driving a card
 * skeleton rather than this highlight. Rendering the old schematic here too drew the
 * same graph a second time in a row with different click behavior, so it was
 * removed; `BlueprintGraph`/`highlighted` styling on the schematic drawing itself
 * went with it.
 *
 * `highlighted` stays, because it is not only a schematic's feature: the same node
 * id recurs across Explainability's own sub-lists (a contribution row in Autonomy, a
 * finding row in Security), and clicking one still lights up every other row naming
 * the same node — a piece of Explainability's own cross-referencing, independent of
 * any drawing. `nodeNames` stays for the same reason (`Explainability` still needs
 * node ids resolved to labels for that cross-referencing).
 *
 * `children`, when given, renders before Explainability — this is how the blueprint
 * detail page hands in its Score panel to read Score → Explainability. Left out, as
 * `ValidationReport.tsx` and this file's own tests still do, `children` is simply
 * absent and Explainability renders on its own.
 */
export function BlueprintCanvas({
  graph,
  analysis,
  children,
}: {
  graph: BlueprintGraphData;
  analysis: BlueprintAnalysisView;
  children?: ReactNode;
}) {
  const [highlighted, setHighlighted] = useState<string | undefined>(undefined);

  const nodeNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const node of graph.nodes) names[node.id] = node.label;
    return names;
  }, [graph]);

  return (
    <>
      {children}

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
