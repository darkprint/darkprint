/* ============================================================
   Ids that travel as paths.

   `lib/href.ts` builds every in-site link, and two of its rules
   are about characters inside an id rather than about the routes
   themselves:

     `/` is a separator. Doc 3 §7 lets a term or a card be
     namespaced, both routes are catch-alls, and percent-encoding
     the whole id produced `/ontology/lupo%2Fpii-handling`, which
     Next decoded back into two segments before matching and which
     therefore matched nothing. `idPath` splits first and encodes
     each segment.

     Everything else is a character. The `orchestration` branch of
     the vocabulary added `parallel.fan-in`, whose dot is part of
     the name Attractor gives the handler it compiles to. A dot has
     to survive the trip and stay inside one segment, or the term
     page is a 404 for one of the twelve node types.

   This file holds the second rule, because nothing did. It is
   narrow on purpose: the route's own existence is
   `components/ontology/canonical-route.test.ts`'s subject and the
   vocabulary's spelling is `lib/core/ontology/core.test.ts`'s.
   What is here is the join between them.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, ontologyView } from "@/lib/core";

import { nodeHref, termHref } from "./href";

const VIEW = ontologyView(CORE_ONTOLOGY);

/** What `app/ontology/[...term]/page.tsx` receives, and what it does with it. */
function segmentsOf(href: string): string[] {
  const path = href.replace(/^\/ontology\//, "");
  // Next decodes each segment before handing the catch-all its array, so the round trip
  // has to decode too or this would pass on an href the page could never resolve.
  return path.split("/").map(decodeURIComponent);
}

describe("termHref", () => {
  it("keeps a namespaced id's separator a separator", () => {
    expect(termHref("lupo/pii-handling")).toBe("/ontology/lupo/pii-handling");
    expect(segmentsOf(termHref("lupo/pii-handling"))).toEqual(["lupo", "pii-handling"]);
  });

  it("carries a dotted id through as one segment", () => {
    // `parallel.fan-in` is the only shipped id with a dot in it, and the dot is a
    // character in an Attractor handler name rather than a separator of any kind.
    expect(termHref("parallel.fan-in")).toBe("/ontology/parallel.fan-in");
    expect(segmentsOf(termHref("parallel.fan-in"))).toEqual(["parallel.fan-in"]);
  });

  it("round-trips every shipped term back to the term the page would look up", () => {
    /* The join: `termHref` writes the path, the catch-all splits it, and the page rejoins
       the segments and asks the view. A term whose id does not survive that trip has a
       page nothing can reach, and the failure is a 404 rather than an exception, which is
       why it needs asserting rather than watching for. */
    for (const t of CORE_ONTOLOGY.terms) {
      const rejoined = segmentsOf(termHref(t.id)).join("/");
      expect(rejoined, t.id).toBe(t.id);
      expect(VIEW.get(rejoined)?.id, t.id).toBe(t.id);
    }
  });

  it("encodes a character that would end the path early", () => {
    // Ids are author-supplied through the §7 overlay, so a `?` or a `#` is possible and
    // would otherwise turn the rest of the id into a query or a fragment.
    expect(termHref("berti/what?")).toBe("/ontology/berti/what%3F");
    expect(segmentsOf(termHref("berti/what?"))).toEqual(["berti", "what?"]);
  });
});

describe("nodeHref", () => {
  it("uses the same rule, because `/nodes/[...id]` is the same shape of route", () => {
    expect(nodeHref("berti/solver-a")).toBe("/nodes/berti/solver-a");
    expect(nodeHref("solver-a")).toBe("/nodes/solver-a");
  });
});
