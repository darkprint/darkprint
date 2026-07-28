/* ============================================================
   The two drawings `/how-to-build-a-dark-factory` is built on.

   A barrel here and none in `components/explain/`, and the
   difference is real: `explain/` is shared between two routes and
   holds a build-time derivation as well as its components, so an
   index over half of it would read as the directory's inventory
   while being one. This directory has one consumer and two files.

   Both are server components. Neither animates, so neither has a
   reduced-motion state to fall back to.
   ============================================================ */

export { IsolationWall } from "./IsolationWall";
export { PhaseStrip } from "./PhaseStrip";
