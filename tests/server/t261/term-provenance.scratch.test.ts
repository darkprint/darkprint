/* ============================================================
   T261 / D-261-13 — where a marker's weight comes from, said
   correctly on the page that prints the number, RELOCATED onto the
   registry.

   `components/ontology/weight-provenance.test.ts` retires with this
   file. Its claim does not: every risk marker carrying a weight
   renders a sentence matching WHICH SOURCE produced the number, and
   the archive ships exactly one marker priced locally rather than
   in the engine's configuration.

   ── why it has to move ──
   The old file rendered the term page while that page read
   `content/` synchronously. After the cutover the page reads the
   registry, so the file acquired an UNDECLARED INFRASTRUCTURE
   DEPENDENCY rather than breaking: measured, 9/9 green with
   `DATABASE_URL` set and 8/9 RED without one. A test that passes
   only when a database happens to be reachable is worse than one
   that fails, because it is green on the machine of whoever checks.

   ── the fixture is built through a real writer, deliberately ──
   `runImport` is T250's production import path. A hand-assembled
   ontology version could satisfy a reader no writer in the system
   produces (D-260-24), and here that risk is not hypothetical: the
   whole claim rests on a LOCAL vocabulary weight surviving into the
   registry, which is precisely the thing a hand-built fixture would
   assert into existence. Seeding through `runImport` means the
   locally-priced rung is real or the fixture cell says so.

   ── the subject, named ──
   `lupo/pii-handling` is the one marker the archive prices in its
   own vocabulary (`0.50`, charged by
   `/blueprints/frontline-triage`'s ledger). A registry seeded with
   the core ontology ALONE would render the seven curated markers,
   pass every assertion about them, and be blind to the single case
   this file exists for — green, relocated, and covering nothing.
   The middle-rung cell below is what refuses that.
   ============================================================ */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import TermPage from "@/app/ontology/[...term]/page";
import { DARKPRINT_CONFIG } from "@/lib/core";
import { plainText } from "@/components/ui/visible-text";
import { getLatestOntologyVersion, openView } from "@/lib/server/ontology";
import { searchTerms } from "@/lib/server/search";
import type { Actor } from "@/lib/server/policy";
import { planImport, runImport } from "@/lib/server/seed";
import { createObjectStorage } from "@/lib/db/storage";

import { createTestDb, type TestDb } from "../../support/db";

/** The sentence that is only true when the configuration is where the number is. */
/* Compared case-INSENSITIVELY since the plain-English copy pass (owner-instructed,
   2026-08-26): splitting a long sentence moves a fragment to a sentence start and
   capitalises it, which changes no claim. The fragments themselves are unchanged. */
const FROM_CONFIG = "The number lives in the engine's configuration and not in this vocabulary";
/** Its opposite, for the markers the configuration is silent about. */
const FROM_VOCABULARY = "the number is the";

const CONFIGURED = new Set(Object.keys(DARKPRINT_CONFIG.security.weights));

let testDb: TestDb | undefined;
let previousUrl: string | undefined;
/** Weighted risk markers as the REGISTRY holds them, not as `content/` holds them. */
let weighted: Array<{ id: string; defaultWeight: number | undefined }> = [];

beforeAll(async () => {
  testDb = await createTestDb();
  previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

  const db = testDb.client.db;
  await runImport(db, await planImport(), createObjectStorage());

  /* The page's OWN composition, not a re-derivation of it: `openView` takes the version
     STRING (not the row id), and the LOCAL vocabulary arrives as EXTENSIONS from
     `searchTerms(origin: "local")` rather than from the published version's own terms.
     Getting either wrong loses exactly the locally priced marker this file is about —
     measured: passing the row id throws `UnknownOntologyVersionError`, and omitting the
     extensions would have left a core-only view that passes the configured half and is
     blind to the middle rung. `app/ontology/[...term]/page.tsx`'s `vocabularyView` is the
     sequence being followed. */
  const published = await getLatestOntologyVersion(db);
  if (published === undefined) throw new Error("the import published no ontology version");
  const anonymous: Actor = { kind: "anonymous" };
  const local = await searchTerms(db, anonymous, { origin: "local" });
  const view = await openView(db, published.version, local.hits.map((hit) => hit.item));
  weighted = view
    .byKind("risk-marker")
    .filter((term) => CONFIGURED.has(term.id) || term.defaultWeight !== undefined)
    .map((term) => ({ id: term.id, defaultWeight: term.defaultWeight }));
}, 300_000);

afterAll(async () => {
  const key = Symbol.for("darkprint.db.sharedClient");
  const shared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
  await shared[key]?.close();
  delete shared[key];
  if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  await testDb?.drop();
});

async function render(id: string): Promise<string> {
  const page = TermPage as unknown as (props: {
    params: Promise<{ term: string[] }>;
  }) => Promise<ReactElement>;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ term: id.split("/") }) }));
}

describe("the vocabulary behind these cases, as the REGISTRY holds it", () => {
  /*
   * The premise, and it is the one D-261-13's retirement is approved against.
   *
   * Two empty halves would leave every case below asserting nothing — and the locally
   * priced half is the one a core-only seed silently loses. This cell is the difference
   * between "relocated" and "relocated and still covering its own subject".
   */
  it("carries markers priced from BOTH sources after a real import", () => {
    expect(
      weighted.filter((t) => CONFIGURED.has(t.id)).length,
      "the registry holds no configuration-priced markers; the import did not publish the core ontology",
    ).toBeGreaterThan(4);

    const local = weighted.filter((t) => !CONFIGURED.has(t.id));
    expect(
      local.map((t) => t.id),
      "NO LOCALLY PRICED MARKER SURVIVED THE IMPORT. The middle rung is untested, which is " +
        "exactly the way this relocation could be green and cover nothing — the case the old " +
        "file was written for is the one that would be missing. D-261-13's retirement is " +
        "approved against this cell passing.",
    ).toContain("lupo/pii-handling");

    const pii = local.find((t) => t.id === "lupo/pii-handling");
    expect(pii?.defaultWeight, "`lupo/pii-handling` reached the registry with no weight").toBe(0.5);
  });
});

describe("each term page says where its own weight comes from", () => {
  it("every weighted marker, over the registry", async () => {
    expect(weighted.length, "no weighted markers at all").toBeGreaterThan(0);

    const wrong: string[] = [];
    for (const term of weighted) {
      const text = plainText(await render(term.id));

      // The page is printing a number at all, which is what the sentence qualifies.
      if (!text.includes("What it costs")) {
        wrong.push(`${term.id}: no "What it costs" block`);
        continue;
      }

      if (CONFIGURED.has(term.id)) {
        if (!text.toLowerCase().includes(FROM_CONFIG.toLowerCase())) wrong.push(`${term.id}: priced in config and does not say so`);
        continue;
      }

      if (text.includes(FROM_CONFIG)) {
        wrong.push(`${term.id}: takes its weight from the vocabulary and the page claims otherwise`);
      }
      if (!text.toLowerCase().includes(FROM_VOCABULARY.toLowerCase())) {
        wrong.push(`${term.id}: does not say where its number comes from`);
      }
      // And the amount on the page is the term's own, not the fallback.
      if (!text.includes((term.defaultWeight ?? 0).toFixed(2))) {
        wrong.push(`${term.id}: prints a weight that is not its own`);
      }
    }

    expect(wrong, wrong.join("\n")).toEqual([]);
  });
});
