/* ============================================================
   T261 AC1 — the redirector's BEHAVIOUR, against a seeded registry.

   ── why this file exists and why it exists NOW ──
   `ac1-redirector.test.ts` pins the MECHANISM: that
   `permanentRedirect` is a 308, that Next adds no query of its
   own, and that the digest reader can tell a redirect from a
   render. None of that is the criterion. Deriving the mutation
   sweep's predicted reds is what made the gap visible:

       M3  the redirector 307s instead of 308ing  ->  0 of 113
       M4  it drops the searchParams re-append    ->  0 of 113

   AC1 is the criterion this task is named for, and until this file
   exists a redirector that silently dropped every query string
   reddened NOTHING. A zero from an assertion that was never
   written looks identical to a zero from an assertion that could
   not fire, so the cells are written before the sweep rather than
   after it.

   ── the fixture is NOT the AC4 family's, deliberately ──
   D-261-02 rules three outcomes on the count of owners holding a
   slug: exactly ONE -> 308; ZERO or SEVERAL -> 404, because the
   old URL never named an owner and guessing one is inventing data.
   The SEVERAL case needs two accounts holding the same slug, which
   no other fixture in this suite builds. Sharing a fixture here
   would have meant never testing the branch that makes the ruling
   more than a redirect.

   ── blind position ──
   These red until the cutover lands: `app/blueprints/[slug]/
   page.tsx` is still the detail page in this tree, not the
   redirector. They are bound LAST, dynamically, inside their own
   cells, so an absent or unchanged module reds here and does not
   delete the fixture's writes from the run.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, type CardRef } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { schema } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { addOntologyVersion } from "@/lib/server/ontology";

import { canonicalBlueprintPath, legacyBlueprintPath, outcomeOf, ROUTES } from "./contract";
import { createTestDb, type TestDb } from "../../support/db";

/** One owner holds this slug: the 308 case. */
const SOLE = "t261sole";
/** Two owners hold this slug: the several-owners 404 case. */
const RIVAL_A = "t261rivala";
const RIVAL_B = "t261rivalb";

const ONLY_SLUG = "sole-owner-blueprint";
const SHARED_SLUG = "two-owners-blueprint";
const ORPHAN_SLUG = "nobody-holds-this-slug";

let testDb: TestDb | undefined;
let previousUrl: string | undefined;

/** Invoke the redirector the way Next invokes it, and say what it did. */
async function visit(slug: string, query: Record<string, string> = {}) {
  const mod = (await import("@/app/blueprints/[slug]/page")) as {
    default?: (props: {
      params: Promise<{ slug: string }>;
      searchParams: Promise<Record<string, string>>;
    }) => unknown;
  };
  const page = mod.default;
  if (typeof page !== "function") {
    throw new Error(`${ROUTES.redirector} has no default export to invoke.`);
  }
  return await outcomeOf(() =>
    page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) }),
  );
}

async function seedFor(handle: string, githubId: string, slug: string): Promise<void> {
  const db = testDb!.client.db;
  const [account] = await db
    .insert(schema.account)
    .values({ githubId, githubLogin: githubId, handle })
    .returning();

  const entry = readContent()[0];
  const seen = new Set<string>();
  for (const file of entry.cardFiles) {
    const ref = file.file.replace(/^cards\//, "").replace(/\.yaml$/, "") as CardRef;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const body = entry.blueprint.cards.get(ref);
    if (body === undefined) continue;
    await addCard(db, {
      cardId: body.id,
      version: body.version,
      ownerId: account.id,
      body,
      source: file.text,
    });
  }

  const bundle = await createBundle(db, { ownerId: account.id, slug, visibility: "public" });
  const vocabulary = contentVocabulary();
  await addRelease(db, {
    bundleId: bundle.id,
    version: "1.0.0",
    dot: entry.bundle.dot,
    manifest: entry.bundle.manifest,
    cardRefs: entry.blueprint.nodes.map((n) => n.ref),
    cardDigests: entry.blueprint.nodes.map((n) => n.digest),
    ...(vocabulary === undefined
      ? {}
      : { vocabulary: { text: vocabulary.text, terms: vocabulary.terms } }),
    analysis: {
      autonomy: entry.analysis.autonomy,
      security: entry.analysis.security,
      phaseCoverage: entry.analysis.phaseCoverage,
    },
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
  previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

  const entry = readContent()[0];
  await addOntologyVersion(db(), {
    version: entry.bundle.manifest.ontologyVersion,
    terms: CORE_ONTOLOGY.terms,
  });

  await seedFor(SOLE, "t261-sole", ONLY_SLUG);
  await seedFor(RIVAL_A, "t261-rival-a", SHARED_SLUG);
  await seedFor(RIVAL_B, "t261-rival-b", SHARED_SLUG);
}, 240_000);

function db() {
  return testDb!.client.db;
}

afterAll(async () => {
  const key = Symbol.for("darkprint.db.sharedClient");
  const shared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
  await shared[key]?.close();
  delete shared[key];
  if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  await testDb?.drop();
});

describe("the fixture", () => {
  /* A cell, not a hook assertion: a throw in `beforeAll` produces SKIPS, and a skipped
     suite reads as green to anyone quoting a test total. */
  it("seeded one sole-owner slug and one slug two owners both hold", async () => {
    const { blueprint } = await import("@/lib/server/registry");
    const anon = { kind: "anonymous" } as const;
    expect(await blueprint(db(), anon, SOLE, ONLY_SLUG), "sole owner's bundle").toBeDefined();
    expect(await blueprint(db(), anon, RIVAL_A, SHARED_SLUG), "rival A's bundle").toBeDefined();
    expect(await blueprint(db(), anon, RIVAL_B, SHARED_SLUG), "rival B's bundle").toBeDefined();
  });
});

describe("AC1: exactly one owner holds the slug", () => {
  it("308s to the owner path", async () => {
    const outcome = await visit(ONLY_SLUG);
    expect(
      outcome.kind,
      `\`${legacyBlueprintPath(ONLY_SLUG)}\` did not redirect — it ${outcome.kind === "notFound" ? "404'd" : "rendered a page"}. ` +
        `D-261-02 rules this route a REDIRECTOR: the old single-segment URL resolves its slug ` +
        `among readable blueprints and, on exactly one owner, hands over the canonical path.`,
    ).toBe("redirect");
    if (outcome.kind !== "redirect") return;

    expect(outcome.destination, "redirected somewhere other than the canonical path").toBe(
      canonicalBlueprintPath(SOLE, ONLY_SLUG),
    );
    expect(
      outcome.status,
      "the move is a 308, not a 307. `next.config.ts:62-64` states the rule for every other " +
        "retired path on this site: the rename is a decision and not an experiment, and 308 " +
        "is the code that tells a client to stop asking.",
    ).toBe(308);
  });

  it("carries the caller's query string through the 308", async () => {
    const outcome = await visit(ONLY_SLUG, { tag: "agents", sort: "new" });
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") return;

    /* THE criterion. `permanentRedirect`'s destination is verbatim — measured in
       `ac1-redirector.test.ts` — so Next contributes nothing here: every character of this
       query has to have been put there by the page. A redirector that forgets breaks every
       shared filtered link, which is the property T200's `params` rule protects at the
       other end. */
    const carried = new URLSearchParams(outcome.query);
    expect(
      carried.get("tag"),
      `the 308 dropped the query string. \`permanentRedirect\` does NOT merge the incoming ` +
        `request's query — the config-redirect arm would have, which is exactly why D-261-02 ` +
        `refused it and why this criterion is failable at all. The page must re-append ` +
        `\`searchParams\` itself.`,
    ).toBe("agents");
    expect(carried.get("sort"), "the 308 carried some of the query and not all of it").toBe("new");
  });

  it("encodes what it carries rather than pasting it", async () => {
    // A value with a `&` in it: pasted raw, it becomes two parameters and the second half
    // is silently lost. Round-tripped through `URLSearchParams`, it survives whole.
    const outcome = await visit(ONLY_SLUG, { q: "a&b=c", tag: "x y" });
    expect(outcome.kind).toBe("redirect");
    if (outcome.kind !== "redirect") return;
    const carried = new URLSearchParams(outcome.query);
    expect(carried.get("q"), "a query value containing `&` was pasted rather than encoded").toBe("a&b=c");
    expect(carried.get("tag")).toBe("x y");
  });
});

describe("D-261-02: zero or several owners is a 404, never a guess", () => {
  it("404s when no owner holds the slug", async () => {
    const outcome = await visit(ORPHAN_SLUG);
    expect(
      outcome.kind,
      `a slug nobody holds ${outcome.kind === "redirect" ? "redirected somewhere" : "rendered a page"}. ` +
        `It must 404: the old URL never named an owner, and there is nobody to hand it to.`,
    ).toBe("notFound");
  });

  it("404s when several owners hold the slug, rather than picking one", async () => {
    const outcome = await visit(SHARED_SLUG);
    expect(
      outcome.kind,
      `two owners hold \`${SHARED_SLUG}\` and the redirector ` +
        `${outcome.kind === "redirect" ? "chose one of them" : "rendered a page"}.\n\n` +
        `D-261-02: ZERO OR SEVERAL -> 404, because the old URL never named an owner and ` +
        `GUESSING ONE IS INVENTING DATA. Under B-09 slugs are unique per owner, not ` +
        `globally, so this case is reachable the moment two accounts pick the same name — ` +
        `and a redirector that picks the first row sends readers to a stranger's blueprint ` +
        `at a URL that used to be someone else's.`,
    ).toBe("notFound");
  });

  it("and the several-owners case is really several, not a broken fixture", async () => {
    /* The control. If the seed only ever produced one bundle at `SHARED_SLUG`, the cell
       above would pass as the zero-owners case and prove nothing about the branch it names. */
    const { blueprint } = await import("@/lib/server/registry");
    const anon = { kind: "anonymous" } as const;
    const holders = [RIVAL_A, RIVAL_B].filter(Boolean);
    const resolved = [];
    for (const handle of holders) {
      if ((await blueprint(db(), anon, handle, SHARED_SLUG)) !== undefined) resolved.push(handle);
    }
    expect(
      resolved.length,
      "fewer than two owners actually hold the shared slug, so the several-owners cell above " +
        "is testing the zero-owners branch under another name",
    ).toBe(2);
  });
});
