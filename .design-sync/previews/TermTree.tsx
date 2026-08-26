import { TermTree } from "darkprint";
import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";

/** The real shipped vocabulary (doc 3), not an invented forest. */
const view = ontologyView(CORE_ONTOLOGY);

/** Node types: two roots with no parent, and the two-deep `human-in-the-loop` forest. */
export const NodeTypes = () => <TermTree kind="node-type" ontology={view} />;

/** Risk markers, heaviest first — the primary axis this component sweeps is `showWeight`. */
export const RiskMarkersWithWeight = () => <TermTree kind="risk-marker" ontology={view} showWeight />;
