import { DownloadPanel } from "darkprint";

/** Every card ref the starter blueprint's graph pins, deduplicated and sorted — real refs. */
const STARTER_CARDS = [
  { ref: "acceptance-tester@1.0.0", href: "/orin/starter-software-factory/d/9c4a2f/cards/acceptance-tester%401.0.0.yaml" },
  { ref: "code-builder@1.0.0", href: "/orin/starter-software-factory/d/9c4a2f/cards/code-builder%401.0.0.yaml" },
  { ref: "release-gate@1.0.0", href: "/orin/starter-software-factory/d/9c4a2f/cards/release-gate%401.0.0.yaml" },
  { ref: "spec-planner@1.0.0", href: "/orin/starter-software-factory/d/9c4a2f/cards/spec-planner%401.0.0.yaml" },
  { ref: "targeted-debugger@1.0.0", href: "/orin/starter-software-factory/d/9c4a2f/cards/targeted-debugger%401.0.0.yaml" },
];

/** `/blueprints/orin/starter-software-factory`: the exact release, folder plus clone command. */
export const WithClone = () => (
  <DownloadPanel
    topologyHref="/orin/starter-software-factory/d/9c4a2f/topology.dot"
    readmeHref="/orin/starter-software-factory/d/9c4a2f/README.md"
    cards={STARTER_CARDS}
    clone={{
      command:
        'curl --fail-early -fsSL --create-dirs -o "starter-software-factory/#1" "https://darkprint.io/orin/starter-software-factory/d/9c4a2f/{topology.dot,README.md}"',
      cliCommand: "darkprint clone orin/starter-software-factory",
    }}
  />
);

/** `/build`'s step 7: a bundle assembled in the reader's browser, so there is no clone command
    and the vocabulary file is present because a chosen card declared a local term. */
export const NoClone = () => (
  <DownloadPanel
    headingLevel="h3"
    topologyHref="/build/session/topology.dot"
    readmeHref="/build/session/README.md"
    vocabulary={{
      href: "/build/session/ontology/extensions.yaml",
      termIds: ["berti/schema-drift-guard"],
    }}
    cards={[
      { ref: "code-builder@1.0.0", href: "/build/session/cards/code-builder%401.0.0.yaml" },
      { ref: "spec-planner@1.0.0", href: "/build/session/cards/spec-planner%401.0.0.yaml" },
    ]}
  />
);
