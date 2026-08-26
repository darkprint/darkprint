import { YamlListing } from "darkprint";
import { cardSource } from "@/lib/content";
// `tokenizeYaml`/`resolveAnnotations` are the exact pure functions `CardWalk` and
// `CardBreakdown` call — real tokens and real annotation spans over the archive's own
// `code-builder@1.0.0` document, not a hand-typed listing.
import { resolveAnnotations } from "@/components/home/nodecard/annotations";
import { tokenizeYaml } from "@/components/home/nodecard/yaml";

const source = cardSource("code-builder@1.0.0");
if (source === undefined) throw new Error("code-builder@1.0.0 fixture is missing from the content shim");

const lines = tokenizeYaml(source);
const notes = resolveAnnotations(source);

/**
 * A listing is never drawn bare: it is always the reel inside a scrollable card face,
 * which is the one thing that keeps a 780px-wide `spec` line from reading as a bug
 * rather than an edge (see `CardWalk`'s own note on the mask).
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface-2/40 py-2 [mask-image:linear-gradient(to_right,black_calc(100%_-_3rem),transparent)]">
      {children}
    </div>
  );
}

/** `CardWalk`'s grounding: every one of the nine annotated runs banded at once. */
export const EveryRunMarked = () => (
  <Frame>
    <YamlListing lines={lines} annotations={notes} shown={notes.length} active={-1} live={false} grounded="every" />
  </Frame>
);

/** `CardBreakdown`'s grounding: a click picks one run and only that one carries the ground. */
export const OneRunPicked = () => (
  <Frame>
    <YamlListing
      lines={lines}
      annotations={notes}
      shown={notes.length}
      active={-1}
      live={false}
      picked={2}
      grounded="picked"
    />
  </Frame>
);
