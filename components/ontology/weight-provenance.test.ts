/* ============================================================
   Where a marker's weight comes from, said correctly on the page
   that prints the number.

   `/ontology/<id>`'s "What it costs" block ended on one sentence
   asserted for every term: *"The number lives in the engine's
   configuration and not in this vocabulary."* True of the seven
   curated markers, and false of the one this archive actually
   ships a local weight for. `/ontology/lupo/pii-handling` printed
   `4 − 0.50 points` and the chip `declared on the card` three
   paragraphs above a claim that no such number exists here, and
   `/blueprints/frontline-triage` charges that 0.50 in its ledger.

   The rule below is written over the vocabulary rather than over
   one term id: every risk marker with a weight is rendered and the
   sentence it prints is checked against which of `weightOf`'s
   three steps produced the number. A term added to
   `content/ontology/extensions.yaml` tomorrow is covered on the
   day it lands.

   ── Rendering a route from a test ──
   The page is an async server component, so it is awaited and the
   element it returns is handed to `renderToStaticMarkup`, which is
   what `components/site/honesty.test.ts` does for `/spec/card` in
   its synchronous form. No DOM: the assertions are over the
   markup, read through `visible-text.ts` so a claim folded into a
   disclosure still counts as the page saying it.
   ============================================================ */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermPage from "@/app/ontology/[...term]/page";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { getOntologyView } from "@/lib/content";
import { plainText } from "@/components/ui/visible-text";

/** The sentence that is only true when the configuration is where the number is. */
const FROM_CONFIG = "The number lives in the engine's configuration and not in this vocabulary";

/** Its opposite, for the markers the configuration is silent about. */
const FROM_VOCABULARY = "the number is the";

const VIEW = getOntologyView();
const CONFIGURED = new Set(Object.keys(DARKPRINT_CONFIG.security.weights));

/** Every risk marker that carries a weight from either source, as the engine resolves it. */
const WEIGHTED = VIEW.byKind("risk-marker").filter(
  (term) => CONFIGURED.has(term.id) || term.defaultWeight !== undefined,
);

async function render(id: string): Promise<string> {
  const page = TermPage as unknown as (props: {
    params: Promise<{ term: string[] }>;
  }) => Promise<ReactElement>;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ term: id.split("/") }) }));
}

describe("the vocabulary behind these cases", () => {
  it("has markers priced from both sources", () => {
    // Two empty halves would leave every case below asserting nothing.
    expect(WEIGHTED.filter((term) => CONFIGURED.has(term.id)).length).toBeGreaterThan(4);
    expect(
      WEIGHTED.filter((term) => !CONFIGURED.has(term.id)).length,
      "no locally priced marker in content/, so the middle rung is untested",
    ).toBeGreaterThan(0);
  });
});

describe("each term page says where its own weight comes from", () => {
  it.each(WEIGHTED.map((term) => [term.id, term] as const))(
    "/ontology/%s",
    async (id, term) => {
      const text = plainText(await render(id));
      // The page is printing a number at all, which is what the sentence qualifies.
      expect(text).toContain("What it costs");

      if (CONFIGURED.has(id)) {
        expect(text, `${id} is priced in config.ts and does not say so`).toContain(
          FROM_CONFIG,
        );
        return;
      }
      expect(
        text,
        `${id} takes its weight from the vocabulary and the page claims otherwise`,
      ).not.toContain(FROM_CONFIG);
      expect(text, `${id} does not say where its number comes from`).toContain(
        FROM_VOCABULARY,
      );
      // And the amount on the page is the term's own, not the fallback.
      expect(text).toContain((term.defaultWeight ?? 0).toFixed(2));
    },
  );
});
