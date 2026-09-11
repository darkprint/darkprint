/* ============================================================
   DarkPrint backend — T210 scratch harness
   The implementer's own runs against a real Postgres. NOT the
   verification: the suite that decides this task is written blind
   in `tests/server/t210/**`, this file never substitutes for it,
   and it has not been opened.

   What it is for is the two things reading cannot do — checking
   that three readers and two routes answer at all, and giving the
   falsification runs something to red when a rule is broken on
   purpose. Every assertion goes through the published surface:
   the barrel `@/lib/server/terms` and the route handlers as Next
   calls them. Nothing here imports a module's internals.

   ── the numbers that make these cells discriminate ──
   `acme/widget` is named by three cards over **five blueprint
   keys spelled with only FOUR distinct slugs** — `alice/b1`,
   `alice/b2`, `alice/b3`, `alice/b4` and `bob/b1`. Counting bare
   slugs the way the shipped component does (`TermTable.tsx:209`)
   answers 4 and fails `distinctBlueprints: 5`; counting the
   two-part key (D-210-08) answers 5 and meets it. The collision
   is the fixture, not a coincidence in it.

   AC2 has TWO discriminating shapes and they are different code
   (C-210-11, corrected into D-210-10). ACROSS arrays: `c1` names
   the `data-type` `acme/widget` at BOTH port sites, input and
   output. WITHIN one array: `c2` names the tool `acme/gizmo`
   twice in `tools`. Either shape read as a reference count answers
   4 cards where AC2 says 3.

   **The fixture the contract originally named — one term at `type`
   AND at a port's `type` — is ILLEGAL and is not built here.** The
   five sites take five DISJOINT term kinds, so the engine refuses
   that card with `card/wrong-term-kind` at error severity and
   `publish` refuses the bundle. Every `acme/*` term below is used
   at exactly ONE kind of site for that reason: `acme/widget` is a
   data-type at ports, `acme/gizmo` a tool, `acme/gadget` and
   `acme/secret` risk markers. `kindsAgree` below asserts that
   about the fixture rather than leaving it to a reading — these
   rows are inserted directly, so nothing else in this file would
   notice a state no writer in the product can produce.

   `acme/gizmo` is the near-miss that makes both booleans do work:
   three authors over three blueprints, so `meetsAuthors` is true
   and `meetsBlueprints` is false in one row. A list filtered to
   the conjunction could not contain it (D-210-02).
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Db } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";
import type { Actor } from "@/lib/server/policy";
import type { NodeCard } from "@/lib/server/types";

import {
  candidates,
  TermStoreError,
  usage,
  usageOf,
  withTermErrors,
  withTermStore,
} from "@/lib/server/terms";
import { GET as getUsage } from "@/app/api/ontology-usage/route";
import { GET as getCandidates } from "@/app/api/ontology-usage/candidates/route";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

const ANON: Actor = { kind: "anonymous" };

let testDb: TestDb;
let db: Db;
let alice: Actor;
let aliceId = "";

interface CardPlan {
  id: string;
  author: string;
  /** The `node-type` site. */
  type: string;
  phases?: string[];
  riskMarkers?: string[];
  tools?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
  visibility?: "public" | "private";
}

function body(plan: CardPlan): NodeCard {
  return {
    id: plan.id,
    name: plan.id,
    type: plan.type,
    phases: plan.phases ?? [],
    action: "solve",
    spec: "do the thing",
    tools: plan.tools ?? [],
    mcp: [],
    params: {},
    inputs: (plan.inputTypes ?? []).map((type, i) => ({ name: `in${i}`, type })),
    outputs: (plan.outputTypes ?? []).map((type, i) => ({ name: `out${i}`, type })),
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: plan.riskMarkers ?? [],
    version: "1.0.0",
    author: plan.author,
  };
}

async function account(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.account)
    .values({ githubId: `gh-${handle}`, githubLogin: handle, handle })
    .returning({ id: schema.account.id });
  return row.id;
}

async function card(ownerId: string, plan: CardPlan): Promise<void> {
  await db.insert(schema.cardVersion).values({
    cardId: plan.id,
    version: "1.0.0",
    digest: `sha256:${plan.id}`,
    ownerId,
    visibility: plan.visibility ?? "public",
    body: body(plan),
    source: `id: ${plan.id}\n`,
  });
}

/** A bundle plus its single release, which is what makes its pins reachable. */
async function publishBundle(
  ownerId: string,
  slug: string,
  cardIds: readonly string[],
  visibility: "public" | "private" = "public",
): Promise<void> {
  const [row] = await db
    .insert(schema.bundle)
    .values({ ownerId, slug, visibility })
    .returning({ id: schema.bundle.id });
  const cardRefs = cardIds.map((id) => `${id}@1.0.0`);
  await db.insert(schema.release).values({
    bundleId: row.id,
    version: "1.0.0",
    digest: `sha256:${slug}`,
    dot: "digraph {}",
    manifest: { slug, title: slug, summary: "a blueprint", tags: [], ontologyVersion: "0.1.0" },
    cardRefs,
    cardDigests: cardRefs.map((ref) => `sha256:${ref}`),
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY] = testDb.client;

  aliceId = await account("alice");
  const bobId = await account("bob");
  alice = { kind: "account", accountId: aliceId, handle: "alice" };

  /* An `ontology_version` row was written here, so a term lookup had a published version to
     resolve against. `0009_drop_ontology_versioning` dropped the table: the one living
     vocabulary is `CORE_ONTOLOGY` in the process, merged per bundle with
     `release.local_vocabulary`, and neither needs a row. */

  /* c1: AC2 ACROSS arrays — the same data-type at the input and the output port. */
  await card(aliceId, {
    id: "c1",
    author: "ann",
    type: "agent",
    inputTypes: ["acme/widget"],
    outputTypes: ["acme/widget"],
    riskMarkers: ["acme/gadget"],
    phases: ["planning"],
  });
  /* c2: AC2 WITHIN one array — the same tool twice in `tools`. */
  await card(aliceId, {
    id: "c2",
    author: "bea",
    type: "agent",
    inputTypes: ["acme/widget"],
    tools: ["acme/gizmo", "acme/gizmo"],
  });
  await card(aliceId, {
    id: "c3",
    author: "cyd",
    type: "agent",
    inputTypes: ["acme/widget"],
    tools: ["acme/gizmo"],
  });
  await card(aliceId, { id: "c4", author: "dee", type: "agent", tools: ["acme/gizmo"] });

  /* AC3's two halves: a private BUNDLE naming a term, and a private CARD naming it. */
  await card(aliceId, { id: "c5", author: "eve", type: "agent", riskMarkers: ["acme/secret"] });
  await card(aliceId, {
    id: "c6",
    author: "fay",
    type: "agent",
    riskMarkers: ["acme/secret"],
    visibility: "private",
  });

  await publishBundle(aliceId, "b1", ["c1"]);
  await publishBundle(aliceId, "b2", ["c2", "c4"]);
  await publishBundle(aliceId, "b3", ["c2"]);
  await publishBundle(aliceId, "b4", ["c3"]);
  await publishBundle(bobId, "b1", ["c1"]);
  await publishBundle(aliceId, "hidden", ["c5"], "private");
  await publishBundle(aliceId, "b5", ["c6"]);
});

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
  await testDb.drop();
});

describe("usageOf", () => {
  it("AC1/AC2: three cards, five blueprint keys over four slugs, three authors", async () => {
    expect(await usageOf(db, ANON, "acme/widget")).toEqual({
      termId: "acme/widget",
      cards: 3,
      blueprints: 5,
      authors: 3,
    });
  });

  it("AC2 ACROSS arrays: one card naming a term at both port sites counts once", async () => {
    /* Stated as an exclusion rather than as a match: the comment names the bad output, so
       the assertion has to refuse it. `c1` reaches `acme/widget` through its input port
       AND its output port, so a reference count answers 4 where AC2 says 3. */
    const { cards: counted } = await usageOf(db, ANON, "acme/widget");
    expect(counted).not.toBe(4);
    expect(counted).toBe(3);
  });

  it("AC2 WITHIN one array: one card naming a term twice in `tools` counts once", async () => {
    /* A separate cell because it is separate code: `c2` carries `["acme/gizmo",
       "acme/gizmo"]`, which across-array dedupe never sees. A reference count answers 4. */
    const { cards: counted } = await usageOf(db, ANON, "acme/gizmo");
    expect(counted).not.toBe(4);
    expect(counted).toBe(3);
  });

  it("the fixture is legal: no term is used at two different kinds of site", async () => {
    /* These rows are inserted directly rather than through `publish`, so nothing else here
       would notice a card the engine refuses. The five sites take five DISJOINT term kinds
       (`card/wrong-term-kind`, error severity), and the contract's original AC2 fixture —
       one term at `type` and at a port's `type` — violates exactly this. Asserted rather
       than read, because a fixture more complete than any writer is green about a state
       that cannot occur. */
    const kindOf = new Map<string, string>();
    const rows = await db.select().from(schema.cardVersion);
    for (const row of rows) {
      const card = row.body as NodeCard;
      const sites: [string, readonly string[]][] = [
        ["phase", card.phases],
        ["node-type", [card.type]],
        ["risk-marker", card.riskMarkers],
        ["tool", card.tools],
        ["data-type", [...card.inputs, ...card.outputs].map((port) => port.type)],
      ];
      for (const [kind, ids] of sites) {
        for (const id of ids) {
          expect(kindOf.get(id) ?? kind).toBe(kind);
          kindOf.set(id, kind);
        }
      }
    }
    expect(kindOf.get("acme/widget")).toBe("data-type");
    expect(kindOf.get("acme/gizmo")).toBe("tool");
  });

  it("AC4: a term nothing names is zeros, not absent and not a throw", async () => {
    expect(await usageOf(db, ANON, "acme/nobody")).toEqual({
      termId: "acme/nobody",
      cards: 0,
      blueprints: 0,
      authors: 0,
    });
  });

  it("AC4: a core term nothing names is zeros too", async () => {
    expect(await usageOf(db, ANON, "risk-marker")).toEqual({
      termId: "risk-marker",
      cards: 0,
      blueprints: 0,
      authors: 0,
    });
  });

  it("AC3: a private bundle and a private card move no number", async () => {
    /* `acme/secret` is named only by `c5` — pinned by the PRIVATE bundle `alice/hidden` —
       and by `c6`, a PRIVATE card pinned by the public `alice/b5`. Both halves must be
       invisible, so zeros here excludes each independently. */
    expect(await usageOf(db, ANON, "acme/secret")).toEqual({
      termId: "acme/secret",
      cards: 0,
      blueprints: 0,
      authors: 0,
    });
  });

  it("AC3/D-210-03: the owner of the private content gets IDENTICAL numbers", async () => {
    /* Not "anonymous sees no private contribution", which a per-actor fold also passes.
       Alice owns both the private bundle and the private card. */
    expect(await usageOf(db, alice, "acme/secret")).toEqual(await usageOf(db, ANON, "acme/secret"));
    expect(await usageOf(db, alice, "acme/widget")).toEqual(await usageOf(db, ANON, "acme/widget"));
  });
});

describe("usage", () => {
  it("lists every counted term, termId ascending, and nothing uncounted", async () => {
    const rows = await usage(db, ANON);
    const ids = rows.map((row) => row.termId);
    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain("acme/widget");
    expect(ids).toContain("agent");
    expect(ids).toContain("planning");
    expect(ids).not.toContain("acme/secret");
    expect(ids).not.toContain("acme/nobody");
  });

  it("agrees with usageOf on every row it carries", async () => {
    for (const row of await usage(db, ANON)) {
      expect(await usageOf(db, ANON, row.termId)).toEqual(row);
    }
  });
});

describe("candidates", () => {
  it("D-210-05: local terms only — no core term appears", async () => {
    const ids = (await candidates(db, ANON)).map((row) => row.termId);
    expect(ids).not.toContain("agent");
    expect(ids).not.toContain("planning");
    expect(ids.every((id) => id.includes("/"))).toBe(true);
  });

  it("D-210-02: the list is NOT the conjunction — a near-miss is present", async () => {
    const gizmo = (await candidates(db, ANON)).find((row) => row.termId === "acme/gizmo");
    expect(gizmo).toEqual({
      termId: "acme/gizmo",
      cards: 3,
      blueprints: 3,
      authors: 3,
      meetsAuthors: true,
      meetsBlueprints: false,
    });
  });

  it("AC5: the ELIGIBLE subset is exactly the terms meeting both thresholds", async () => {
    const rows = await candidates(db, ANON);
    const eligible = rows.filter((row) => row.meetsAuthors && row.meetsBlueprints);
    expect(eligible.map((row) => row.termId)).toEqual(["acme/widget"]);
  });

  it("D-210-08: five blueprint KEYS over four slugs clears distinctBlueprints", async () => {
    /* Slug counting answers 4 here and flips `meetsBlueprints` to false, so this cell
       fails against the shipped component's rule rather than merely differing from it. */
    const widget = (await candidates(db, ANON)).find((row) => row.termId === "acme/widget");
    expect(widget?.blueprints).toBe(5);
    expect(widget?.meetsBlueprints).toBe(true);
  });

  it("AC3: a private-only local term is not a candidate", async () => {
    const ids = (await candidates(db, ANON)).map((row) => row.termId);
    expect(ids).not.toContain("acme/secret");
  });
});

describe("AC6, rewritten by D-210-01: no refresh verb exists and the index still moves", () => {
  it("publishing a bundle moves usageOf with no refresh call", async () => {
    const before = await usageOf(db, ANON, "acme/gadget");
    expect(before.blueprints).toBe(2);

    await publishBundle(aliceId, "b6", ["c1"]);

    const after = await usageOf(db, ANON, "acme/gadget");
    expect(after.blueprints).toBe(3);
  });

  it("the barrel publishes no refreshUsage (D-210-09)", async () => {
    const barrel: Record<string, unknown> = await import("@/lib/server/terms");
    expect(Object.hasOwn(barrel, "refreshUsage")).toBe(false);
  });
});

describe("the fault path", () => {
  /* The repository's `error-hygiene` guard resolves its domain from `git ls-tree -d backend
     lib/server/`, so `lib/server/terms` is outside it until this branch merges and
     `TermStoreError` is unobserved by it today. These cells stand in until then; they are
     not a substitute for it, and the equality there is derived at the merge, never carried. */
  it("D-13: a sealed fault renders as `{}` and keeps its cause and stack", () => {
    for (const args of [["usageOf"], ["usageOf", new Error("select * from card_version")]] as const) {
      const err = new TermStoreError(...(args as [string, unknown]));
      expect(Object.keys(err)).toEqual([]);
      expect(JSON.stringify(err)).toBe("{}");
      expect(err.name).toBe("TermStoreError");
      expect(typeof err.stack).toBe("string");
      expect(Object.propertyIsEnumerable.call(err, "cause")).toBe(false);
      /* The exact rendering, hardcoded rather than imported: a test taking its expected
         message from the module under test asserts the module agrees with itself. */
      expect(err.message).toBe("usageOf: the term store failed.");
    }
  });

  it("withTermStore seals a driver fault and does NOT relabel an already-sealed one", async () => {
    const inner = withTermStore("usageOf", async () => {
      throw new Error('select "card_id" from "card_version" where id = $1');
    });
    await expect(inner).rejects.toThrow("usageOf: the term store failed.");

    let seen: unknown;
    try {
      await withTermStore("candidates", () =>
        withTermStore("usageOf", async () => {
          throw new Error("boom");
        }),
      );
    } catch (err) {
      seen = err;
    }
    expect((seen as Error).message).toBe("usageOf: the term store failed.");
  });

  it("withTermErrors answers problem+json at 500 and rethrows what it does not know", async () => {
    const request = new Request("http://localhost/api/ontology-usage");
    const response = await withTermErrors(request, async () => {
      throw new TermStoreError("usage", new Error("select * from bundle"));
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { detail: string; title: string };
    expect(body.detail).toBe("usage: the term store failed.");
    expect(body.detail).not.toContain("select");
    expect(body.title).toBe("Store failed");

    await expect(
      withTermErrors(request, async () => {
        throw new TypeError("a bug outside a reader");
      }),
    ).rejects.toThrow("a bug outside a reader");
  });
});

describe("routes", () => {
  it("GET /api/ontology-usage answers { usage } at 200", async () => {
    const response = await getUsage(new Request("http://localhost/api/ontology-usage"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { usage: { termId: string }[] };
    expect(Array.isArray(payload.usage)).toBe(true);
    expect(payload.usage.map((row) => row.termId)).toContain("acme/widget");
  });

  it("GET /api/ontology-usage/candidates answers { candidates } at 200", async () => {
    const response = await getCandidates(
      new Request("http://localhost/api/ontology-usage/candidates"),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { candidates: { termId: string }[] };
    expect(payload.candidates.map((row) => row.termId)).toContain("acme/widget");
    expect(payload.candidates.map((row) => row.termId)).not.toContain("agent");
  });
});
