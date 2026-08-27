import { UpstreamMovedPanel } from "darkprint";

/**
 * The amber `.route-box` a bundle's aside draws when the upstream it was forked from has
 * repinned a card since this copy was taken — the drift the security reading can no longer
 * be compared against. Card ids are the archive's own (`content/blueprints/starter-software-factory`).
 */
export const Canonical = () => (
  <UpstreamMovedPanel
    moved={{ card: "spec-planner", from: "1.0.0", to: "1.1.0", at: "2026-08-12" }}
    upstream={{ owner: "orin", slug: "starter-software-factory" }}
  />
);

/** A longer card id and a further-out repin, to check the box holds its shape past the short case above. */
export const LongerCardId = () => (
  <UpstreamMovedPanel
    moved={{ card: "targeted-debugger", from: "1.0.0", to: "2.0.0", at: "2026-07-02" }}
    upstream={{ owner: "orin", slug: "starter-software-factory" }}
  />
);
