import { FileTree } from "darkprint";

/* The published folder, listed. `lib/content/bundle-export.ts` says what a real bundle
   contains: README.md, topology.dot, and one cards/<ref>.yaml per pinned card — the
   starter blueprint's five, here. */

const orin = { username: "orin", displayName: "Orin Solace", avatarHue: 190, validator: true };

const files = [
  { path: "README.md", kind: "doc" as const, change: "Product copy, generated at export", state: "generated" as const, at: "2026-07-28" },
  { path: "topology.dot", kind: "dot" as const, change: "The graph, verbatim from the archive", state: "verbatim" as const, at: "2026-07-28" },
  { path: "cards/spec-planner@1.0.0.yaml", kind: "yaml" as const, change: "Pinned card, verbatim", state: "pinned" as const, at: "2026-07-28" },
  { path: "cards/code-builder@1.0.0.yaml", kind: "yaml" as const, change: "Pinned card, verbatim", state: "pinned" as const, at: "2026-07-28" },
  { path: "cards/acceptance-tester@1.0.0.yaml", kind: "yaml" as const, change: "Pinned card, verbatim", state: "pinned" as const, at: "2026-07-28" },
  { path: "cards/targeted-debugger@1.0.0.yaml", kind: "yaml" as const, change: "Pinned card, verbatim", state: "pinned" as const, at: "2026-07-28" },
  { path: "cards/release-gate@1.0.0.yaml", kind: "yaml" as const, change: "Added the digest check to the release step", state: "changed" as const, at: "2026-08-11" },
];

/** The full listing, with a README button and every row reachable. */
export const Canonical = () => (
  <FileTree
    files={files}
    lastChange={{ message: "Added the digest check to the release step", digest: "8f2a91c", at: "2026-08-11" }}
    author={orin}
    hrefFor={(f) => (f.path === "README.md" ? undefined : `/blueprints/orin/starter-software-factory/${f.path}`)}
    readmeHref="/blueprints/orin/starter-software-factory/readme"
    footnote="7 files · 5 cards"
  />
);

/** No README in the folder: the button drops out of the footer rather than dead-linking. */
export const NoReadme = () => (
  <FileTree
    files={files.slice(1)}
    lastChange={{ message: "Added the digest check to the release step", digest: "8f2a91c", at: "2026-08-11" }}
    author={orin}
    footnote="6 files · 5 cards"
  />
);
