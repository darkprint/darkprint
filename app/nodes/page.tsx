import type { Metadata } from "next";
import { GridBand } from "@/components/ui/GridBand";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { NodeBrowser, type NodeTypeTerm } from "@/components/nodes/NodeBrowser";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { allNodeCards, getOntologyView, getRegistry } from "@/lib/content";
import { getAuthor } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Nodes",
  description:
    "The DarkPrint node-card library, every reusable node in the registry, with its ontology type, the lifecycle phases it stands in, declared interface, tools and risk markers. Filter by type, by phase, by human involvement or by risk.",
};

export default function NodesPage() {
  const ontology = getOntologyView();
  const registry = getRegistry();

  const nodes: NodeSummary[] = allNodeCards().map((record) => ({
    id: record.id,
    version: record.version,
    ref: record.ref,
    name: record.card.name,
    action: record.card.action,
    type: record.card.type,
    typeLabel:
      ontology.resolve(record.card.type, "node-type")?.term.label ?? record.card.type,
    /* Zero, one or several — the card decides. Resolved here on the server, in the
       order the card wrote them, so the browser filters plain data and never has to
       ask the ontology anything. An id the vocabulary does not know is shown as
       written rather than guessed at. */
    phases: record.card.phases.map((id) => ({
      id,
      label: ontology.resolve(id, "phase")?.term.label ?? id,
    })),
    tools: [...record.card.tools],
    requiresHuman: record.card.requiresHuman,
    riskMarkers: record.card.riskMarkers.map(
      (marker) => ontology.resolve(marker, "risk-marker")?.term.label ?? marker,
    ),
    usedIn: registry.usersOf(record.id).length,
    /* Resolved here rather than in the tile, and left `undefined` when the table does
       not hold the name. The tile turns this into a link to `/u/<username>`, and that
       route is `dynamicParams = false`, so an unresolved author has to fall out before
       it reaches the markup. Same lookup the card's own page does. */
    author: record.card.author === undefined ? undefined : getAuthor(record.card.author),
  }));

  /* `blueprints` was here, for the count the deck printed until 2026-08-08. */

  /**
   * The node-type vocabulary, for the shelf's chrome.
   *
   * `NodeSummary` carries `type` and `typeLabel` and nothing else, which is everything the
   * filters and the tiles need and one field short of what a group header needs: the type's
   * one-line definition. Resolving it in the browser would mean shipping the ontology to the
   * client to answer eight questions that are settled at build time.
   *
   * All eight node types, not the five the card library happens to use, and that is load
   * bearing rather than generous. The group header prints its type's INDEX, and an index is
   * a position in a complete list — `Tool` is `07` because it is the seventh of the
   * vocabulary's eight types in label order, and it would be `04` counted against the five
   * types that currently have cards. A number that moves when somebody publishes the first
   * `human-input` card is not an index, it is a rank.
   *
   * `byKind` returns them sorted by id; the browser re-sorts by label, next to the rule that
   * says the grid is ordered that way, so the two orders cannot come apart.
   *
   * `description` is dropped rather than blanked when a term carries none — a local overlay
   * may define a node type with an empty one, and the header draws no line rather than an
   * empty one. `OntologyTerm.description` is a required string, so this only fires on the
   * empty case, and it is the reason the prop's field is optional.
   */
  const types: NodeTypeTerm[] = ontology.byKind("node-type").map((term) => {
    const description = term.description.trim();
    return {
      id: term.id,
      label: term.label,
      ...(description === "" ? {} : { description }),
    };
  });

  return (
    /* The hero's graph paper over the head of the shelf, on the author's instruction that
       both registry galleries carry it. The host is full-bleed so the band is: `container-page`
       is 1200px centred, and an `inset-x-0` layer inside it would stop at the gutters and
       show two vertical edges the mask never fades. See `GridBand` for why it is a band, why
       the `GridSpotlight` does not come with it, and why this host may not be
       `overflow-hidden` — the filter bar and the spine are both sticky inside it. */
    <div className="relative">
      <GridBand />
      <div className="container-page relative py-12 sm:py-16">
      {/* The lead was 45 words: three sentences defining the noun, then three
          properties of the archive. A shelf's job is to say what is on it. */}
      <SectionHeading
        as="h1"
        eyebrow="Registry"
        title="Node cards"
        /* No counts, on the author's instruction 2026-08-08. `architecture/ontology.md`'s
           rule is that a written count goes stale the moment content lands, which is why
           both of these were interpolated rather than typed; the author's point is the one
           the rule does not cover — a reader on the shelf is about to see how many there
           are, and two numbers in the deck are the page counting itself out loud. */
        lead="The cards the registry's blueprints are assembled from, grouped by what kind of step they are."
        className="mb-10"
      />
      {/* No `Suspense`, and no `useSearchParams` behind it — see `NodeBrowser`.
          ------------------------------------------------------------
          The filters were briefly read with `useSearchParams`, which the Next docs say
          must be wrapped in a `Suspense` boundary or the production build fails. Adding
          the boundary made the build pass and quietly cost the page everything it is
          for: measured against `next start`, `/nodes` came back **56KB containing zero
          `<article>` elements**, because the same doc says calling that hook makes the
          client tree up to the nearest boundary client-rendered. All 53 cards left the
          prerendered HTML.

          On an archive whose claim is that it can be read rather than trusted, a shelf
          that ships no shelf is the worse bug. The browser keeps its URL state using
          plain history APIs instead, and this page stays static with all 53 cards in
          the markup. */}
      <NodeBrowser nodes={nodes} types={types} />
      </div>
    </div>
  );
}
