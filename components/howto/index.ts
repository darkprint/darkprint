/* ============================================================
   What `/towards-a-dark-factory` is built from.

   A barrel here and none in `components/explain/`, and the
   difference is real: `explain/` is shared between two routes and
   holds a build-time derivation as well as its components, so an
   index over half of it would read as the directory's inventory
   while being one.

   The two drawings became client components with redesign spec §1:
   the luminous register animates, and `useLuminousFlow` is where
   the reduced-motion and no-JS gates live. Both scenes render as
   the finished drawing without it. `RoutePager` and `route.ts` stay
   server-side, and the route list is the single definition of the
   three-page sequence §4.2 asks the pages to read as.
   ============================================================ */

export { IsolationWall } from "./IsolationWall";
export { PhaseStrip } from "./PhaseStrip";
export { RoutePager } from "./RoutePager";
export { CLIMB_ROUTE, neighbours, type RouteStop } from "./route";
