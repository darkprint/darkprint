import type { Metadata } from "next";

import { getOntologyView, getRegistry } from "@/lib/content";
import { partitionTerms } from "@/lib/core";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ButtonLink } from "@/components/ui/Button";
import { markerWeight, termUsageIndex } from "@/components/ontology/TermTable";
import { OntologyCatalog } from "@/components/ontology/OntologyCatalog";
import {
  VocabularyBrowser,
  type VocabularyRow,
} from "@/components/ontology/VocabularyBrowser";

/* ============================================================
   /ontology — the vocabulary, browsable.

   ── This route did not exist ──
   `app/ontology/[...term]/` is a catch-all, and a catch-all does not match its own parent,
   so `/ontology` answered 404 while `README.md` described it as the browser and
   `next.config.ts` 308'd `/ontologies` onto it — a redirect that landed on a 404. Nothing
   noticed because nothing linked it: until the nav pass the chrome had no entry for the
   vocabulary at all, which is precisely the third problem that pass names.

   ── Why it is called Vocabulary in the chrome and Ontology on the spec page ──
   Two routes, two questions. This one lists the words a blueprint and a card are allowed
   to use; `/spec/ontology` is the specification of the format those words are written in.
   `components/site/nav.test.ts` forbids one label on two routes, and calling both of them
   "Ontology" is exactly what that forbids.

   Every figure on this page is counted off the archive at build time. The usage column is
   the one worth naming: it says how many cards in `content/` name each term, which is what
   makes "curated and small on purpose" checkable rather than asserted.
   ============================================================ */

export const metadata: Metadata = {
  title: "Vocabulary",
  description:
    "Every term a blueprint and a node card are allowed to use: node types, data types, tools, risk markers and the five phases, with what each one costs and how many cards name it.",
};

export default function Page() {
  const view = getOntologyView();
  const usage = termUsageIndex(getRegistry());
  const { terms, version } = view.ontology;
  const { local } = partitionTerms(terms);
  const localIds = new Set(local.map((term) => term.id));

  const rows: VocabularyRow[] = terms.map((term) => {
    const row: VocabularyRow = {
      id: term.id,
      kind: term.kind,
      label: term.label,
      description: term.description,
      local: localIds.has(term.id),
      usedBy: usage.get(term.id)?.cards.length ?? 0,
    };
    if (term.broader !== undefined) row.broader = term.broader;
    /* Through the engine's own lookup, not off the term. Doc 3 §4 moved the seven core
       weights into `DARKPRINT_CONFIG.security.weights`, so a core marker's own
       `defaultWeight` is always unset and reading it alone would print no weight for any
       of them. `markerWeight` is the order the engine uses: configuration first, then the
       term's own value, which survives for a locally namespaced marker. */
    const weight = markerWeight(term);
    if (weight !== undefined) row.weight = weight;
    if (term.deprecated !== undefined) {
      row.deprecated =
        term.deprecated.replacedBy === undefined
          ? { since: term.deprecated.since }
          : { since: term.deprecated.since, replacedBy: term.deprecated.replacedBy };
    }
    return row;
  });

  return (
    <div className="container-page flex flex-col gap-10 py-10 lg:py-12">
      <SectionHeading
        as="h1"
        eyebrow="Vocabulary"
        title="The words a blueprint is written in"
        lead="One curated set of identifiers, plus whatever a bundle declares in its own namespace. A card may only name a term that resolves here, which is what makes an edge checkable at all."
      />

      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/spec/ontology" variant="outline" size="sm">
          What a term is, and how the overlay works
        </ButtonLink>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
          ✓ counted
        </span>
        <span className="font-mono text-[11px] text-dim">
          read off content/ at build time, usage included
        </span>
      </div>

      {/* The catalog is the page's resting state and the filter bar sits over it, so the
          reader who came to read gets the five kinds with their trees and their notes, and
          the reader who came holding a word gets the flat matching rows. `OntologyCatalog`
          renders here on the server and travels through the client boundary as children,
          which is what lets it keep reading the ontology view and drawing the subsumption
          rails that no serialisable row shape could carry. */}
      <VocabularyBrowser terms={rows} version={version}>
        <OntologyCatalog />
      </VocabularyBrowser>
    </div>
  );
}
