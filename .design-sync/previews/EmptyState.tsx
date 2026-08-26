import { EmptyState } from "darkprint";

/** The shelf a reader reaches before its owner has published anything. */
export const NoCards = () => (
  <EmptyState title="No node cards" action={{ href: "/nodes", label: "Browse the card library" }}>
    Orin has not published a node card so far.
  </EmptyState>
);

/** Without an action the block is a statement, not an invitation. */
export const NothingToSay = () => (
  <EmptyState title="No diagnostics">
    The validator read every card in this bundle and had nothing to report.
  </EmptyState>
);
