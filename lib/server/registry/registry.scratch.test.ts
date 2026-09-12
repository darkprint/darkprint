/* ============================================================
   DarkPrint backend — T080 scratch harness
   The implementer's own runs against a real Postgres. Not the
   verification: the suite that decides this task is written blind
   in `tests/server/**` and this file never substitutes for it.
   What it is for is the two things reading cannot do — checking
   that thirteen readers and nine routes answer at all, and giving
   the falsification runs something to red when a guard is broken
   on purpose.

   Every assertion goes through the published surface: the barrel
   `@/lib/server/registry` and the route handlers as Next calls
   them. Nothing here imports a module's internals.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { createTestDb, type TestDb } from "@/tests/support";
import type { Actor } from "@/lib/server/policy";
import type { NodeCard } from "@/lib/server/types";
import {
  blueprint,
  blueprints,
  card,
  cards,
  cardsByPhase,
  categories,
  duplicates,
  latestCards,
  phases,
  scoresOf,
  tags,
  usersOf,
  versionsOf,
} from "@/lib/server/registry";

import { GET as getBlueprints } from "@/app/api/blueprints/route";
import { GET as getBlueprint } from "@/app/api/blueprints/[owner]/[slug]/route";
import { GET as getCards } from "@/app/api/cards/route";
import { GET as getCardPath } from "@/app/api/cards/[...ref]/route";
import { GET as getDuplicates } from "@/app/api/cards/duplicates/route";
import { GET as getPhases } from "@/app/api/ontology/phases/route";
import { GET as getPhaseCards } from "@/app/api/ontology/phases/[phase]/cards/route";
import { GET as getTags } from "@/app/api/ontology/tags/route";
import { GET as getCategories } from "@/app/api/ontology/categories/route";

const SHARED_CLIENT_KEY = Symbol.for("darkprint.db.sharedClient");

const ANON: Actor = { kind: "anonymous" };

let testDb: TestDb;
let db: Db;
let alice: Actor;
let atlasReleaseId = "";
let bobReleaseId = "";

/**
 * A card body that differs from its neighbours only where the test needs it to. `name` is
 * deliberately shared: `contentKey` strips only `id`, `version`, `author` and `provenance`,
 * so two cards are duplicates when everything else matches — and a per-id name is what made
 * the first version of this fixture produce no duplicate group at all.
 */
function body(id: string, version: string, phases: string[], action = "solve"): NodeCard {
  return {
    id,
    name: "worker",
    type: "agent",
    phases,
    action,
    spec: "do the thing",
    tools: [],
    mcp: [],
    params: {},
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version,
  };
}

function manifest(slug: string, tags: string[], category?: string) {
  return {
    slug,
    title: `The ${slug}`,
    summary: "a blueprint",
    tags,
    category,
  };
}

async function account(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.account)
    .values({ githubId: `gh-${handle}`, githubLogin: handle, handle })
    .returning({ id: schema.account.id });
  return row.id;
}

async function bundle(ownerId: string, slug: string, visibility: "public" | "private"): Promise<string> {
  const [row] = await db
    .insert(schema.bundle)
    .values({ ownerId, slug, visibility })
    .returning({ id: schema.bundle.id });
  return row.id;
}

async function release(
  bundleId: string,
  version: string,
  slug: string,
  tags: string[],
  category: string | undefined,
  cardRefs: string[],
): Promise<string> {
  const [row] = await db
    .insert(schema.release)
    .values({
      bundleId,
      version,
      digest: `sha256:${version}-${slug}`,
      dot: "digraph {}",
      manifest: manifest(slug, tags, category),
      cardRefs,
      cardDigests: cardRefs.map((ref) => `sha256:${ref}`),
    })
    .returning({ id: schema.release.id });
  return row.id;
}

async function cardVersion(
  ownerId: string,
  id: string,
  version: string,
  phases: string[],
  visibility: "public" | "private",
  action = "solve",
): Promise<void> {
  await db.insert(schema.cardVersion).values({
    cardId: id,
    version,
    digest: `sha256:${id}@${version}`,
    ownerId,
    visibility,
    body: body(id, version, phases, action),
    source: `id: ${id}\n`,
  });
}

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.client.db;
  (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY] = testDb.client;

  const aliceId = await account("alice");
  const bobId = await account("bob");
  alice = { kind: "account", accountId: aliceId, handle: "alice" };

  // `mirror` says exactly what `solver@1.1.0` says under another name — the dedup pair.
  // `intake` declares no phase, `solver@1.0.0` declares two: AC4's two exhibits.
  await cardVersion(aliceId, "solver", "1.0.0", ["planning", "testing"], "public");
  await cardVersion(aliceId, "solver", "1.1.0", ["planning"], "public");
  await cardVersion(aliceId, "mirror", "1.1.0", ["planning"], "public");
  await cardVersion(aliceId, "intake", "1.0.0", [], "public", "receive");
  await cardVersion(aliceId, "probe", "1.0.0", [], "public", "probe");
  // `solver@2.0.0` is a published row that **no release pins**, declaring a phase nothing
  // else declares. Added after the adversary charged D-80-06: this harness selected rows by
  // pinned *id* and could not see a version nobody pins, and neither could the blind suite
  // (its fixtures use ids that never enter the query) nor `build-parity` (every row in the
  // archive is pinned). A regression here is invisible to any test built from the archive.
  await cardVersion(aliceId, "solver", "2.0.0", ["debugging"], "public");
  await cardVersion(aliceId, "ghost", "1.0.0", ["deployment"], "private", "hide");
  await cardVersion(aliceId, "legacy", "1.0.0", ["planning"], "public", "retire");
  await cardVersion(aliceId, "hidden", "1.0.0", ["testing"], "public", "vault");

  // Two owners, one slug: what B-09 made legal and what the core record could not express.
  const atlas = await bundle(aliceId, "atlas", "public");
  const vault = await bundle(aliceId, "vault", "private");
  const bobAtlas = await bundle(bobId, "atlas", "public");

  // `legacy` is pinned only by the superseded release, so nothing may surface it (D-80-03).
  await release(atlas, "1.0.0", "atlas", ["ops"], "factory", ["legacy@1.0.0"]);
  atlasReleaseId = await release(atlas, "1.1.0", "atlas", ["ops", "research", ""], "factory", [
    "solver@1.0.0",
    "solver@1.1.0",
    "mirror@1.1.0",
    "intake@1.0.0",
    "probe@1.0.0",
    "ghost@1.0.0",
  ]);
  bobReleaseId = await release(bobAtlas, "2.0.0", "atlas", ["ops"], "", ["solver@1.0.0"]);
  // `vault`'s release is left wholly unscored, which is the "nothing stored" case.
  await release(vault, "1.0.0", "vault", ["secret"], "private-cat", ["hidden@1.0.0"]);

  // A half-written scorecard: one axis present, two null. Added because breaking the
  // all-or-nothing rule reddened nothing without it — every unscored fixture here had every
  // column null, so they were covered by the axis checks alone and the rule was load-bearing
  // nowhere the suite could see. What makes this one incomplete is the two missing axes.
  //
  // It used to also carry `scoredOntologyVersionId` and an `ontologyVersion` inside each
  // `autonomy`, and the comment here had to say the missing stamp was NOT what made it
  // incomplete. Migration 0009 dropped the column and `AutonomyResult` dropped the stamp, so
  // the ambiguity the old wording defended against is gone with the second signal.
  await db
    .update(schema.release)
    .set({ autonomy: { level: "assisted" } })
    .where(eq(schema.release.id, bobReleaseId));

  await db
    .update(schema.release)
    .set({
      autonomy: { level: "assisted" },
      security: { level: "guarded" },
      phaseCoverage: { present: ["planning"] },
    })
    .where(eq(schema.release.id, atlasReleaseId));
});

afterAll(async () => {
  delete (globalThis as Record<symbol, unknown>)[SHARED_CLIENT_KEY];
  await testDb.drop();
});

function refs(list: readonly { ref: string }[]): string[] {
  return list.map((c) => c.ref);
}

function keys(list: readonly { ownerHandle: string; slug: string }[]): string[] {
  return list.map((b) => `${b.ownerHandle}/${b.slug}`);
}

describe("the query surface, as an anonymous caller sees it", () => {
  it("lists blueprints by slug then owner handle, one per bundle", async () => {
    expect(keys(await blueprints(db, ANON))).toEqual(["alice/atlas", "bob/atlas"]);
  });

  it("projects the current release, never a superseded one", async () => {
    const atlas = await blueprint(db, ANON, "alice", "atlas");
    expect(atlas?.digest).toBe("sha256:1.1.0-atlas");
    expect(atlas?.cardRefs).not.toContain("legacy@1.0.0");
  });

  it("tells two owners of one slug apart", async () => {
    const mine = await blueprint(db, ANON, "alice", "atlas");
    const theirs = await blueprint(db, ANON, "bob", "atlas");
    expect(mine?.ownerHandle).toBe("alice");
    expect(theirs?.ownerHandle).toBe("bob");
    expect(mine?.digest).not.toBe(theirs?.digest);
  });

  it("answers undefined for an unknown key", async () => {
    expect(await blueprint(db, ANON, "alice", "nope")).toBeUndefined();
    expect(await blueprint(db, ANON, "nobody", "atlas")).toBeUndefined();
  });

  it("orders cards by id ascending then version descending", async () => {
    /* `solver@2.0.0` leads its id: no release pins it, so it is a standalone version and the
       order is still id ascending, version descending. */
    expect(refs(await cards(db, ANON))).toEqual([
      "intake@1.0.0",
      "mirror@1.1.0",
      "probe@1.0.0",
      "solver@2.0.0",
      "solver@1.1.0",
      "solver@1.0.0",
    ]);
  });

  it("indexes only cards a current release pins", async () => {
    expect(refs(await cards(db, ANON))).not.toContain("legacy@1.0.0");
  });

  it("returns the newest version of every id", async () => {
    expect(refs(await latestCards(db, ANON))).toEqual([
      "intake@1.0.0",
      "mirror@1.1.0",
      "probe@1.0.0",
      "solver@2.0.0",
    ]);
  });

  it("returns every version of one id, newest first", async () => {
    expect(refs(await versionsOf(db, ANON, "solver"))).toEqual([
      "solver@2.0.0",
      "solver@1.1.0",
      "solver@1.0.0",
    ]);
    expect(await versionsOf(db, ANON, "no-such-card")).toEqual([]);
  });

  it("looks a card up by ref, trimming, and refuses what is not a pinned reference", async () => {
    expect((await card(db, ANON, "solver@1.0.0"))?.version).toBe("1.0.0");
    expect((await card(db, ANON, "  solver@1.0.0  "))?.version).toBe("1.0.0");
    expect(await card(db, ANON, "solver")).toBeUndefined();
    expect(await card(db, ANON, "solver@latest")).toBeUndefined();
    expect(await card(db, ANON, "")).toBeUndefined();
  });

  it("AC2: usersOf returns both pinning blueprints, sorted and distinct", async () => {
    // alice/atlas pins two versions of `solver`; it is still one user.
    expect(keys(await usersOf(db, ANON, "solver"))).toEqual(["alice/atlas", "bob/atlas"]);
    expect(await usersOf(db, ANON, "no-such-card")).toEqual([]);
  });

  it("groups cards that say the same thing under different refs", async () => {
    expect((await duplicates(db, ANON)).map(refs)).toEqual([["mirror@1.1.0", "solver@1.1.0"]]);
  });

  it("reports phases in lifecycle order, not alphabetically", async () => {
    /* `debugging` is here because `solver@2.0.0` declares it and is indexed. Alphabetically it
       would lead; in doc 3 §2's lifecycle it comes after testing, which is the point. */
    expect(await phases(db, ANON)).toEqual(["planning", "testing", "debugging"]);
  });

  it("AC3: an undeclared phase is an empty list, and so is an arbitrary string", async () => {
    /* `debugging` is no longer the example: `solver@2.0.0` declares it and is indexed, so the
       bucket is real. What stays empty is a phase the index has never seen — including the
       empty string, which is a value and not an absence. */
    expect(await cardsByPhase(db, ANON, "deployment")).toEqual([]);
    expect(await cardsByPhase(db, ANON, "not-a-phase-at-all")).toEqual([]);
    expect(await cardsByPhase(db, ANON, "")).toEqual([]);
  });

  it("AC4: the buckets cover the cards without partitioning them", async () => {
    const all = await cards(db, ANON);
    const declared = await phases(db, ANON);
    const buckets = await Promise.all(declared.map((phase) => cardsByPhase(db, ANON, phase)));
    const summed = buckets.reduce((total, bucket) => total + bucket.length, 0);

    // The inequality is the assertion, not a tolerance: 6 cards, 5 bucket seats.
    expect(summed).not.toBe(all.length);

    // One card in two buckets...
    const inTwo = buckets.filter((bucket) => refs(bucket).includes("solver@1.0.0"));
    expect(inTwo).toHaveLength(2);
    // ...and one in none.
    expect(buckets.every((bucket) => !refs(bucket).includes("intake@1.0.0"))).toBe(true);
  });

  it("returns distinct sorted facets, skipping empty values", async () => {
    expect(await tags(db, ANON)).toEqual(["ops", "research"]);
    expect(await categories(db, ANON)).toEqual(["factory"]);
  });

  it("freezes what it hands back", async () => {
    const list = await blueprints(db, ANON);
    expect(Object.isFrozen(list)).toBe(true);
    expect(Object.isFrozen(list[0])).toBe(true);
  });
});

/**
 * `solver@2.0.0` is a version of a pinned id that NO release names, which D-80-06 excluded and
 * which is now a standalone card. What that ruling was built to stop is unchanged and is
 * asserted in AC6 below: a card reachable only through a bundle somebody cannot see stays
 * unreachable. The difference is between a row nothing has ever claimed and a row claimed by
 * something the caller may not read, and only the first is published here.
 */
describe("a version of a pinned id that nothing pins", () => {
  it("is present in every reader that lists or looks up a card", async () => {
    expect(refs(await cards(db, ANON))).toContain("solver@2.0.0");
    expect(refs(await versionsOf(db, ANON, "solver"))).toEqual([
      "solver@2.0.0",
      "solver@1.1.0",
      "solver@1.0.0",
    ]);
    expect(await card(db, ANON, "solver@2.0.0")).toBeDefined();
    /* `latestCards` takes the newest INDEXED version, and 2.0.0 is now one of them. */
    expect(refs(await latestCards(db, ANON))).toContain("solver@2.0.0");
    expect(refs(await latestCards(db, ANON))).not.toContain("solver@1.1.0");
  });

  it("reaches the derived indexes, and is reachable through them", async () => {
    expect(await phases(db, ANON)).toContain("debugging");
    /* The phase is listed AND its bucket holds the card: a filter offering an empty bucket is
       the defect this shape can still have. */
    expect(refs(await cardsByPhase(db, ANON, "debugging"))).toEqual(["solver@2.0.0"]);
    /* `usersOf` is unmoved. It answers which blueprints use an ID, and no blueprint gained
       one by this version becoming visible. */
    expect(keys(await usersOf(db, ANON, "solver"))).toEqual(["alice/atlas", "bob/atlas"]);
  });

  it("is the only indexed card with no user, and says so by name", async () => {
    /* The invariant was "every indexed card has a user", and the leak it caught was a row
       arriving without a pin. A standalone card arrives without a pin legitimately, so the
       cell names the ones entitled to it instead of forbidding the shape: any OTHER ref with
       an empty `usedIn` is the same leak, and still reds. Quantified over the whole index
       rather than over the one row this fixture plants. */
    const userless = (rows: readonly { ref: string; usedIn: readonly unknown[] }[]) =>
      rows.filter((rec) => rec.usedIn.length === 0).map((rec) => rec.ref).sort();
    expect(userless(await cards(db, ANON))).toEqual(["solver@2.0.0"]);
    expect(userless(await cards(db, alice))).toEqual(["solver@2.0.0"]);
  });
});

describe("AC6: nothing private appears in any response", () => {
  it("keeps a private bundle out of every list and lookup", async () => {
    expect(keys(await blueprints(db, ANON))).not.toContain("alice/vault");
    expect(await blueprint(db, ANON, "alice", "vault")).toBeUndefined();
    expect(await tags(db, ANON)).not.toContain("secret");
    expect(await categories(db, ANON)).not.toContain("private-cat");
  });

  it("keeps a card pinned only by a private bundle out of the index", async () => {
    expect(refs(await cards(db, ANON))).not.toContain("hidden@1.0.0");
    expect(await versionsOf(db, ANON, "hidden")).toEqual([]);
    expect(await card(db, ANON, "hidden@1.0.0")).toBeUndefined();
    expect(await usersOf(db, ANON, "hidden")).toEqual([]);
  });

  it("keeps a private card out of a public blueprint's pins and buckets", async () => {
    const atlas = await blueprint(db, ANON, "alice", "atlas");
    expect(atlas?.cardRefs).not.toContain("ghost@1.0.0");
    expect(refs(await cards(db, ANON))).not.toContain("ghost@1.0.0");
    expect(await cardsByPhase(db, ANON, "deployment")).toEqual([]);
    expect(await phases(db, ANON)).not.toContain("deployment");
    expect(await card(db, ANON, "ghost@1.0.0")).toBeUndefined();
  });

  it("shows the owner their own private content, through the same readers", async () => {
    expect(keys(await blueprints(db, alice))).toContain("alice/vault");
    expect((await blueprint(db, alice, "alice", "atlas"))?.cardRefs).toContain("ghost@1.0.0");
    expect(refs(await cards(db, alice))).toContain("ghost@1.0.0");
    expect(refs(await cards(db, alice))).toContain("hidden@1.0.0");
    expect(await phases(db, alice)).toContain("deployment");
    expect(await tags(db, alice)).toContain("secret");
  });
});

describe("AC7: the stored scorecard is read, never recomputed", () => {
  /* The cell was "returns the stored axes stamped with the ontology version they were
     computed under". The stamp is gone on both of its sources — migration 0009 dropped
     `release.scored_ontology_version_id`, and `AutonomyResult` no longer carries
     `ontologyVersion` — so what survives is the claim that never depended on it: the axes
     come back as stored, byte for byte, rather than recomputed. */
  it("returns the stored axes exactly as they were written", async () => {
    const scores = await scoresOf(db, ANON, "alice", "atlas");
    expect(scores?.autonomy).toEqual({ level: "assisted" });
  });

  it("returns the new values and no trace of the old after a re-score", async () => {
    await db
      .update(schema.release)
      .set({
        autonomy: { level: "supervised" },
        security: { level: "hardened" },
        phaseCoverage: { present: ["planning", "testing"] },
      })
      .where(eq(schema.release.id, atlasReleaseId));

    const scores = await scoresOf(db, ANON, "alice", "atlas");
    expect(scores).toEqual({
      autonomy: { level: "supervised" },
      security: { level: "hardened" },
      phaseCoverage: { present: ["planning", "testing"] },
    });
  });

  it("has no scorecard for a half-written one, an unscored release, an unknown key, or a bundle it may not see", async () => {
    // Stamped, one axis present, two null. A partial scorecard is not a scorecard.
    expect(await scoresOf(db, ANON, "bob", "atlas")).toBeUndefined();
    // Nothing stored at all, read by the owner so visibility is not what decides it.
    expect(await scoresOf(db, alice, "alice", "vault")).toBeUndefined();
    expect(await scoresOf(db, ANON, "alice", "nope")).toBeUndefined();
    expect(await scoresOf(db, ANON, "alice", "vault")).toBeUndefined();
  });
});

describe("the read API", () => {
  const url = (path: string) => new Request(`http://registry.test${path}`);

  it("serves the lists", async () => {
    const listed = await (await getBlueprints(url("/api/blueprints"))).json();
    expect(keys(listed.blueprints)).toEqual(["alice/atlas", "bob/atlas"]);

    const carded = await (await getCards(url("/api/cards"))).json();
    expect(refs(carded.cards)).toHaveLength(6);

    const grouped = await (await getDuplicates(url("/api/cards/duplicates"))).json();
    expect(grouped.groups).toHaveLength(1);

    expect((await (await getPhases(url("/api/ontology/phases"))).json()).phases).toEqual([
      "planning",
      "testing",
      "debugging",
    ]);
    expect((await (await getTags(url("/api/ontology/tags"))).json()).tags).toEqual(["ops", "research"]);
    expect(
      (await (await getCategories(url("/api/ontology/categories"))).json()).categories,
    ).toEqual(["factory"]);
  });

  it("serves one blueprint with its scorecard", async () => {
    const response = await getBlueprint(url("/api/blueprints/alice/atlas"), {
      params: Promise.resolve({ owner: "alice", slug: "atlas" }),
    });
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.blueprint.slug).toBe("atlas");
    /* Was `payload.scores.ontologyVersion === "0.2.0"`, which witnessed TWO things at once:
       that the route serves a scorecard, and that it serves the re-scored one written by the
       cell above rather than the original. The version is gone, so the witness is moved onto
       a value that still differs between the two writes — `autonomy.level` went
       "assisted" -> "supervised" — rather than dropped for a weaker existence check. */
    expect(payload.scores.autonomy).toEqual({ level: "supervised" });
  });

  it("AC5: an unknown key and a bundle the caller may not see answer identically", async () => {
    const unknown = await getBlueprint(url("/api/blueprints/nobody/nothing"), {
      params: Promise.resolve({ owner: "nobody", slug: "nothing" }),
    });
    const private_ = await getBlueprint(url("/api/blueprints/alice/vault"), {
      params: Promise.resolve({ owner: "alice", slug: "vault" }),
    });

    expect(unknown.status).toBe(404);
    expect(private_.status).toBe(404);
    expect(unknown.headers.get("content-type")).toContain("application/problem+json");

    const a = await unknown.json();
    const b = await private_.json();
    expect(a.detail).toBe("blueprint: no such bundle.");
    expect(b.detail).toBe("blueprint: no such bundle.");
    expect(a.status).toBe(404);
    // Only `instance` may differ, since RFC 9457 makes it the occurrence's own path.
    expect({ ...a, instance: null }).toEqual({ ...b, instance: null });
  });

  it("serves a card, its versions and its users off one catch-all", async () => {
    const one = await getCardPath(url("/api/cards/solver@1.0.0"), {
      params: Promise.resolve({ ref: ["solver@1.0.0"] }),
    });
    expect((await one.json()).card.version).toBe("1.0.0");

    const versions = await getCardPath(url("/api/cards/solver/versions"), {
      params: Promise.resolve({ ref: ["solver", "versions"] }),
    });
    /* The route lists every stored version the reader may see, pinned or not, which is how
       a card published on its own answers before a release pins it; the public, unpinned
       `solver@2.0.0` is therefore here while `versionsOf` above still leaves it out. */
    expect(refs((await versions.json()).versions)).toEqual(["solver@2.0.0", "solver@1.1.0", "solver@1.0.0"]);

    const users = await getCardPath(url("/api/cards/solver/users"), {
      params: Promise.resolve({ ref: ["solver", "users"] }),
    });
    expect(keys((await users.json()).users)).toEqual(["alice/atlas", "bob/atlas"]);
  });

  it("404s a card that does not exist and one the caller may not see, identically", async () => {
    const missing = await getCardPath(url("/api/cards/nope@1.0.0"), {
      params: Promise.resolve({ ref: ["nope@1.0.0"] }),
    });
    const private_ = await getCardPath(url("/api/cards/ghost@1.0.0"), {
      params: Promise.resolve({ ref: ["ghost@1.0.0"] }),
    });
    expect(missing.status).toBe(404);
    expect(private_.status).toBe(404);
    expect((await missing.json()).detail).toBe("card: no such card.");
    expect((await private_.json()).detail).toBe("card: no such card.");
  });

  it("404s a one-segment path that names no card rather than answering an empty list", async () => {
    const response = await getCardPath(url("/api/cards/versions"), {
      params: Promise.resolve({ ref: ["versions"] }),
    });
    expect(response.status).toBe(404);
  });

  it("AC3 through the route: an undeclared phase is a 200 and an empty list", async () => {
    const response = await getPhaseCards(url("/api/ontology/phases/not-a-phase/cards"), {
      params: Promise.resolve({ phase: "not-a-phase" }),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).cards).toEqual([]);
  });
});
