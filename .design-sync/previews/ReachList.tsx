import { ReachList, ReachRow } from "darkprint";

/** The figure as ConceptFigures builds it: the fields one node card declares. */
export const CardFields = () => (
  <ReachList label="One card, six rows" still>
    <ReachRow field="model" value="claude-sonnet-5" note="Written the way the provider writes it, and overridable.">
      The model it thinks with. The ceiling on what this step can be trusted to attempt.
    </ReachRow>
    <ReachRow field="tools" value="[]" note="The card names the capability, not a vendor.">
      Capabilities it may reach for: a shell, a search index, a browser.
    </ReachRow>
    <ReachRow field="mcp" value="filesystem">
      The servers this node may talk to, and no others.
    </ReachRow>
    <ReachRow field="cannot" value="acceptance-criteria" barred>
      What the engine refuses to route into this node, whatever the graph says.
    </ReachRow>
  </ReachList>
);

/** Unframed, which is how it reads once it is already inside a panel. */
export const InsideAPanel = () => (
  <ReachList
    label="What a bundle carries"
    frame={false}
    still
    footnote="A folder that resolves to the numbers its own README prints."
  >
    <ReachRow field="topology.dot" value="1.2 KB">
      The graph itself, as a directed document.
    </ReachRow>
    <ReachRow field="cards/" value="3 files">
      One YAML document per node, pinned to an exact version.
    </ReachRow>
  </ReachList>
);
