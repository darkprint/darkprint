import { SpecPager } from "darkprint";

/**
 * The foot of every spec/Learn page: a mobile breadcrumb row plus a previous/next
 * signpost pair, computed from `href` against the real `SPEC_SEQUENCE`
 * (`components/spec/sequence.ts`) rather than passed in — so a real route is what makes
 * this render its actual neighbours.
 */

/** Mid-sequence: both a PREVIOUS and a NEXT box draw, `/spec/card`'s real position. */
export const MidSequence = () => <SpecPager href="/spec/card" />;

/** The last stop in the specification run: PREVIOUS only, no NEXT box to draw. */
export const LastInRun = () => <SpecPager href="/towards-a-dark-factory" />;
