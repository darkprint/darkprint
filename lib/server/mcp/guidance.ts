/* ============================================================
   DarkPrint backend: the instantiation notes get_blueprint returns
   Pure text over facts the caller already holds. Every step names
   only things that exist: the files in the answer, the README's
   runner section when the README carries it, the export_pipeline
   tool, the CLI verbs, and the human-gate nodes the scorecard lists.
   The harness shapes the wording and filters nothing, because the
   registry has no harness field to filter by.
   ============================================================ */

import {
  BUNDLE_CARDS_DIR,
  BUNDLE_README,
  README_RUNNER_SECTION,
  TOPOLOGY_DOT,
} from "@/lib/content/bundle-export";
import type { McpHarness } from "./types";

export interface GuidanceInput {
  harness: McpHarness;
  owner: string;
  slug: string;
  digest: string;
  files: readonly { path: string; text: string }[];
  /** Node ids where a person acts, when the release carries a scorecard. */
  humanGates?: readonly string[];
}

/** The steps, numbered by position. */
export function instantiationSteps(input: GuidanceInput): string[] {
  const { harness, owner, slug, digest, files } = input;
  const folder = `./${slug}/`;
  const paths = files.map((file) => file.path);
  const cardCount = paths.filter((path) => path.startsWith(`${BUNDLE_CARDS_DIR}/`)).length;
  const readme = files.find((file) => file.path === BUNDLE_README);

  const steps: string[] = [];

  steps.push(
    `Write the ${paths.length} files of this answer under ${folder}, keeping each path as given: ` +
      `${paths.join(", ")}.`,
  );

  if (readme !== undefined) {
    steps.push(
      readme.text.includes(README_RUNNER_SECTION)
        ? `Read ${folder}${BUNDLE_README} first, including its section "${README_RUNNER_SECTION.replace(/^#+ /, "")}": ` +
            "it lists what a runner reads that these files cannot say."
        : `Read ${folder}${BUNDLE_README} first; it is written for whoever opens the folder.`,
    );
  }

  steps.push(
    `${folder}${TOPOLOGY_DOT} gives the order and the edges between nodes. Each of the ` +
      `${cardCount} ${BUNDLE_CARDS_DIR}/*.yaml files is one node, and its spec field is the whole ` +
      "prompt for that node. Nothing in these files enforces a card's cannot, will_not, inputs or " +
      "outputs, so read them before running and hold each node to them yourself.",
  );

  if (harness !== "generic") {
    steps.push(
      "Run one node at a time: start a subagent per node, hand it the card's spec verbatim, " +
        "and allow it only the tools and mcp servers the card lists.",
    );
    steps.push(gateStep(input.humanGates));
  }

  steps.push(
    `For a pipeline Attractor can run, call export_pipeline with owner "${owner}", slug "${slug}" ` +
      `and digest "${digest}", or run darkprint validate ${folder} and darkprint export ${folder} ` +
      "--attractor from a checkout of the darkprint repository. Read the header the file opens with.",
  );

  steps.push(
    `Keep the digest ${digest}. Asking by slug returns whatever release is current; asking by ` +
      "this digest returns these bytes, even after a newer release is cut.",
  );

  steps.push(
    harness === "generic"
      ? "These notes are the generic ones. The files are identical whichever harness you name."
      : `These notes are shaped for ${harness}. The files are identical whichever harness you name.`,
  );

  return steps;
}

function gateStep(humanGates: readonly string[] | undefined): string {
  if (humanGates === undefined) {
    return "Stop and ask a person at every node whose card type is a human gate before continuing.";
  }
  if (humanGates.length === 0) {
    return "No node in this graph waits for a person, so nothing here stops for one; stop yourself wherever the work is irreversible.";
  }
  return `Stop and ask a person at every human-gate node before continuing: ${humanGates.join(", ")}.`;
}
