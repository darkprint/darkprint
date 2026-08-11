import { statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/* ============================================================
   The vocabulary has two routes, and they are different questions.

   This file asserted the opposite for two passes: that `/ontology`
   had no page and 308'd onto `/spec/ontology`. That was right while
   the vocabulary had nowhere of its own — the §1 rename left one
   core ontology and its catalog was a band on the spec page, so an
   index route would have been a second door onto one room.

   The accounts pass changes the premise rather than the rule. The
   registry holds three things and the chrome now names all three, so
   Vocabulary needs somewhere to point; pointing it at
   `/spec/ontology` would put two names on one route on one screen,
   which is the defect `nav.test.ts` exists for. So the index is a
   page again and the two routes split by question:

     /ontology        the terms. Search, filter by kind and origin,
                      and what each one costs. The third registry
                      browser, on the shared `RegistryFilterBar`.
     /spec/ontology   the format. What a term is, how the local
                      overlay works, what the validator refuses.

   Both are asserted below, so neither can quietly absorb the other
   again without this file saying which one won.
   ============================================================ */
describe("the canonical ontology route", () => {
  it("gives the browser its own page and keeps the term detail routes", async () => {
    expect(statSync(`${ROOT}/app/ontology/page.tsx`, { throwIfNoEntry: false })).toBeDefined();
    expect(statSync(`${ROOT}/app/ontology/[...term]/page.tsx`, { throwIfNoEntry: false })).toBeDefined();

    // And nothing redirects it away any more, which would shadow the page entirely:
    // redirects are checked before the filesystem.
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects.filter((rule) => rule.source === "/ontology")).toEqual([]);
    // The old gallery path lands on the browser, which is what it was a gallery of.
    expect(redirects).toContainEqual({
      source: "/ontologies",
      destination: "/ontology",
      permanent: true,
    });
  });

  /**
   * One enumeration of the vocabulary, not two.
   *
   * The spec page carried `OntologyCatalog` — the five kinds and every term in each of
   * them — because `/ontology` had been redirected away and the listing had nowhere else
   * to live. With the browser back, keeping both would leave two exhaustive term listings
   * on one site, which is the duplication this codebase deletes rather than accumulates.
   *
   * So the split is by question and this is what holds it: the browser enumerates, the spec
   * page specifies and links across. Either half absorbing the other fails here.
   *
   * The catalog moved WITH the enumeration rather than being deleted by it: `/ontology`
   * mounts it as the browser's unfiltered view, so the one exhaustive listing on the site
   * is on the one route that is allowed one. Both halves are named below, because "the
   * spec page does not enumerate" is only half the rule and the other half went missing
   * once already.
   */
  it("keeps the two routes answering different questions", () => {
    const browser = readFileSync(`${ROOT}/app/ontology/page.tsx`, "utf8");
    const spec = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");

    // The browser is the filtered list, on the bar the other two registry browsers use,
    // over the catalog it falls back to when nothing is filtered.
    expect(browser).toContain("VocabularyBrowser");
    expect(browser).toContain("<OntologyCatalog");
    // The spec page enumerates nothing and points at the page that does.
    expect(spec).not.toContain("<OntologyCatalog");
    expect(spec).toContain('href="/ontology"');
  });

  /**
   * What the spec page keeps: the extension model and the engine's checks.
   *
   * It used to assert the catalog mount as well, and that half moved to the case above with
   * the listing itself. The two claims below are the ones that make this page a
   * specification rather than an index, and neither depends on it enumerating anything.
   */
  it("keeps the extension model and the engine checks", () => {
    const page = readFileSync(`${ROOT}/app/spec/ontology/page.tsx`, "utf8");
    expect(page).toContain("The overlay");
    expect(page).toContain("ONTOLOGY_ROWS");
  });

  /**
   * The catalog is the browser's unfiltered view, and it still says what it always said.
   *
   * It stood unmounted for one pass, kept as "the shape a future browse-by-kind view starts
   * from". That view is this one. Deleting it at any point would have thrown away the only
   * drawing of the vocabulary that groups by kind, hangs the subtypes off their parents and
   * puts the paragraph about how to read a kind under the terms of that kind, none of which
   * a flat list can carry, and the author asked for exactly that reading back.
   *
   * Two claims: the sections are intact, and the component supplies no page container of
   * its own. It used to, because it mounted as a full-bleed band; it is nested inside the
   * route's container now, and a second `container-page` inside the first pads the whole
   * catalog twice and narrows it against the heading above it.
   */
  it("keeps the catalog intact and lets its route own the page container", () => {
    const catalog = readFileSync(`${ROOT}/components/ontology/OntologyCatalog.tsx`, "utf8");
    expect(catalog).toContain("The five kinds of term");
    expect(catalog).toContain("One curated core, room for local terms");
    expect(catalog).not.toContain('className="container-page');
  });
});
