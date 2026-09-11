import { GraphPane } from "darkprint";
import { CORE_ONTOLOGY, analyzeBlueprint, ontologyView, resolveBundle } from "@/lib/core";
import { graphForBlueprint } from "@/lib/graph-seed";
import { bundleSource } from "@/lib/content";
import { buildPaneModel, type PaneNodeInput } from "@/components/panes/build";
import { resolveFocus } from "@/components/panes/model";

/**
 * The same real starter-software-factory bundle the other blueprint-detail previews
 * resolve. `GraphPane` is pane 1 of the doc 2 §5.1 synchronised view, so `model`/`focus`
 * are built the same way `SynchronisedPanes` builds them: off the actually-parsed DOT,
 * through `buildPaneModel`/`resolveFocus`, not a hand-typed stand-in.
 */
const raw = bundleSource("starter-software-factory");
const resolved = resolveBundle(
  {
    manifest: {
      slug: "starter-software-factory",
      title: "Starter Software Factory",
      summary: "The canonical five-node factory, plan, build, test, debug, release.",
      category: "Software",
      tags: ["starter", "tutorial", "isolation", "software"],
      author: "orin",
      ontologyVersion: "0.1.0",
      createdAt: "2026-07-28",
      updatedAt: "2026-07-28",
    },
    dot: raw.dot,
    cardFiles: Object.fromEntries(raw.cards.map((c) => [c.file, c.text])),
  },
  ontologyView(CORE_ONTOLOGY),
);
const bp = resolved.blueprint;
if (bp === undefined) throw new Error("starter-software-factory fixture failed to resolve");

const graph = graphForBlueprint(bp);

const nodes: PaneNodeInput[] = bp.nodes.map((node) => ({
  nodeId: node.nodeId,
  label: node.card.name,
  ref: node.ref,
  card: node.card,
  yaml: raw.cards.find((c) => c.file.includes(node.card.id))?.text,
}));

const model = buildPaneModel({
  slug: "starter-software-factory",
  title: "Starter Software Factory",
  dot: raw.dot,
  dotFile: "topology.dot",
  nodes,
});

// `tester` has two sources (planner, builder) and one target (deployer via debugger's
// loop), which is the richer "hears from / sends to" row of the five.
const focus = resolveFocus(model, { nodeId: "tester" });
if (focus === undefined) throw new Error("no node named 'tester' in the resolved model");

function noop() {
  // The click handler is the caller's selection state, which a static preview has none of.
}

/** Pane 1 of the four-pane synchronised view: the schematic, click-to-select. */
export const TesterSelected = () => (
  <GraphPane
    paneNumber={1}
    graph={graph}
    model={model}
    focus={focus}
    graphId="preview-starter-software-factory"
    height={280}
    onSelectNode={noop}
  />
);
