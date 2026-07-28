/* ============================================================
   What a bundle deliberately does not have.
   ------------------------------------------------------------
   Doc 2 §5.1 makes the four-pane view the place where the absent
   edge becomes demonstrable on three representations at once:
   missing from the drawing, missing from the DOT, absent from the
   card's `spec`. An absence cannot be derived — every pair of
   nodes with no edge between them is an absence, and almost none
   of them mean anything — so the ones worth drawing are declared,
   and this is where.

   One rule holds the file honest. The **fact** comes from
   somewhere that already owns it and the **numbers** come from the
   engine: `ABSENT_EDGE` is `components/explain/starter-isolation`'s
   declaration, reused rather than restated, and the two security
   levels in the sentence are read off `loadBundle` over the real
   bundle and over the same bundle with the line added. Nothing
   below is a figure typed into a string.

   SERVER ONLY, BUILD TIME ONLY: it reaches `lib/content` through
   the isolation demo, like every other module that quotes the
   archive.
   ============================================================ */

import {
  ABSENT_EDGE,
  STARTER_SLUG,
  isolationDemo,
} from "@/components/explain/starter-isolation";
import type { PaneAbsenceInput } from "./build";

/**
 * The gaps worth drawing in one blueprint, or none.
 *
 * `nodeIds` is checked rather than trusted. An absence naming a node this graph does not
 * have would render as a gap in a bundle it says nothing about, which is worse than
 * saying nothing: the reader would be shown a lesson about someone else's file.
 */
export function absencesFor(
  slug: string,
  nodeIds: readonly string[],
): PaneAbsenceInput[] {
  if (slug !== STARTER_SLUG) return [];
  const present = new Set(nodeIds);
  if (!present.has(ABSENT_EDGE.source) || !present.has(ABSENT_EDGE.target)) return [];

  const demo = isolationDemo();
  // Both numbers are the analyzer's, on this bundle and on the same bundle with the one
  // line written in. When the variant cannot be assembled the clause is dropped and the
  // rest of the sentence still stands on its own.
  const cost =
    demo === undefined
      ? ""
      : ` Write it and the same analyzer reads security level ${demo.leaked.security.level} where it reads ${demo.published.analysis.security.level} now.`;

  return [
    {
      id: "criteria-to-builder",
      label: `${ABSENT_EDGE.source} ⇢ ${ABSENT_EDGE.target}`,
      detail: `The acceptance criteria leave the planner for the tester and go nowhere else. No edge carries them to the node that writes the code.${cost}`,
      edge: { source: ABSENT_EDGE.source, target: ABSENT_EDGE.target },
    },
    {
      id: "criteria-in-spec",
      label: "the criteria, in the prose",
      detail:
        "Doc 1 §3.2: an absent edge is isolation only if the content is absent too. This spec names no criterion and quotes no threshold, so the check has nothing to find on the card either.",
      field: { nodeId: ABSENT_EDGE.target, key: "spec" },
    },
  ];
}
