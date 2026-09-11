/* ============================================================
   DarkPrint backend — forkCard against Postgres
   The subject is rows: what `card_version` holds after a fork,
   who owns it, what its body says about where it came from, and
   which callers are refused. None of that is measurable against
   a spy `Db`, so this suite is scratch and needs `DATABASE_URL`.

   ── the skipped count is part of the result ──
   `describe.skipIf(!hasDb)` is the shipped convention and it is
   also the trap `lineage.db.scratch.test.ts` names: an unsourced
   shell turns every cell below into silence at exit 0. A run that
   reports these skipped has measured nothing.

   ── the first cell is the falsification cell ──
   "Forking a card you cannot read is refused" was written and run
   BEFORE `forkCard` consulted `can`: the first implementation read
   the upstream row straight off the table, and this cell failed
   with a `CardRecord` in hand instead of a refusal. It is first in
   the file because it is the one cell whose red was observed
   against a permissive implementation rather than predicted.
   ============================================================ */

import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cardDigest, parseDocument, type NodeCard } from "@/lib/core";
import { schema, type Db } from "@/lib/db";
import { addCard } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { createTestDb, resetTestDb, type TestDb } from "@/tests/support/db";
import { CARD_FORK_PROVENANCE_PREFIX, ForkRefusedError, forkCard } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };

/** A complete `NodeCard`: `storedCard` requires every non-optional field, and a fork reads one. */
function cardFixture(id: string, version: string, over: Partial<NodeCard> = {}): NodeCard {
  return {
    id,
    name: "Spec planner",
    type: "agent",
    phases: ["planning"],
    action: "plan",
    spec: "Write the plan.",
    tools: [],
    mcp: [],
    params: {},
    inputs: [{ name: "brief", type: "text" }],
    outputs: [{ name: "plan", type: "text" }],
    dependencies: [],
    cannot: [],
    willNot: ["never opens a shell"],
    riskMarkers: [],
    version,
    author: "upstream-author",
    ...over,
  };
}

/** The YAML a hand-written card of this shape carries, including a comment and a blank line. */
function sourceFor(card: NodeCard): string {
  return [
    "# the upstream author's own file",
    `id: ${card.id}`,
    `name: ${JSON.stringify(card.name)}`,
    `type: ${card.type}`,
    "phase:",
    ...card.phases.map((phase) => `  - ${phase}`),
    "",
    `action: ${card.action}`,
    `spec: ${JSON.stringify(card.spec)}`,
    "tools: []",
    "mcp: []",
    "params: {}",
    "inputs:",
    ...card.inputs.flatMap((port) => [`  - name: ${port.name}`, `    type: ${port.type}`]),
    "outputs:",
    ...card.outputs.flatMap((port) => [`  - name: ${port.name}`, `    type: ${port.type}`]),
    "dependencies: []",
    "cannot: []",
    "will_not:",
    ...card.willNot.map((line) => `  - ${JSON.stringify(line)}`),
    "risk_markers: []",
    "",
    `version: ${card.version}`,
    ...(card.author === undefined ? [] : [`author: ${card.author}`]),
    "",
  ].join("\n");
}

describe.skipIf(!hasDb)("lib/server/lineage forkCard against Postgres", () => {
  let testDb: TestDb;
  let db: Db;

  /** The upstream author, the forker, somebody uninvolved, and an account with no handle. */
  let author: string;
  let forker: string;
  let stranger: string;
  let handleless: string;

  const AUTHOR_HANDLE = "upstream-author";
  const FORKER_HANDLE = "forker";
  const STRANGER_HANDLE = "stranger";

  const actorFor = (accountId: string): Actor => ({ kind: "account", accountId, handle: "unused" });

  async function makeAccount(
    login: string,
    handle: string | null,
    defaultVisibility: "public" | "private" = "public",
  ): Promise<string> {
    const [row] = await db
      .insert(schema.account)
      .values({ githubId: login, githubLogin: login, handle, defaultVisibility })
      .returning({ id: schema.account.id });
    return row!.id;
  }

  /** One stored card version, written through `addCard` so the digest is the real one. */
  async function makeCard(
    ownerId: string,
    id: string,
    version: string,
    visibility: "public" | "private",
    over: Partial<NodeCard> = {},
  ): Promise<NodeCard> {
    const body = cardFixture(id, version, over);
    await addCard(db, { cardId: id, version, ownerId, visibility, body, source: sourceFor(body) });
    return body;
  }

  async function rowsFor(cardId: string) {
    return await db.select().from(schema.cardVersion).where(eq(schema.cardVersion.cardId, cardId));
  }

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.client.db;
  }, 120_000);

  afterAll(async () => {
    await testDb.drop();
  });

  afterEach(async () => {
    await resetTestDb(testDb.client);
  });

  /** Every cell needs the four accounts, and `afterEach` truncates them. */
  async function seed(): Promise<void> {
    author = await makeAccount(AUTHOR_HANDLE, AUTHOR_HANDLE);
    forker = await makeAccount(FORKER_HANDLE, FORKER_HANDLE);
    stranger = await makeAccount(STRANGER_HANDLE, STRANGER_HANDLE);
    handleless = await makeAccount("no-handle-yet", null);
  }

  /* --------------------- the read grant --------------------- */

  it("refuses to fork a private card the caller cannot read, and writes nothing", async () => {
    await seed();
    await makeCard(author, "secret-planner", "1.0.0", "private");

    await expect(
      forkCard(db, actorFor(stranger), { cardId: "secret-planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "no-such-card" });

    /* The refusal is only half the property: a fork that refused and still wrote is a fork.
       Nothing new may exist under the stranger's namespace or anywhere else. */
    expect(await rowsFor(`${STRANGER_HANDLE}/secret-planner`)).toEqual([]);
    const all = await db.select().from(schema.cardVersion);
    expect(all).toHaveLength(1);
  });

  it("refuses an anonymous caller the same private card", async () => {
    await seed();
    await makeCard(author, "secret-planner", "1.0.0", "private");

    await expect(
      forkCard(db, ANONYMOUS, { cardId: "secret-planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "not-signed-in" });
  });

  it("gives a card that does not exist and one that is private to somebody else the same refusal", async () => {
    await seed();
    await makeCard(author, "secret-planner", "1.0.0", "private");

    const absent = await forkCard(db, actorFor(stranger), { cardId: "no-card-here", version: "1.0.0" }, {}).catch(
      (err: unknown) => err,
    );
    const unreadable = await forkCard(
      db,
      actorFor(stranger),
      { cardId: "secret-planner", version: "1.0.0" },
      {},
    ).catch((err: unknown) => err);

    expect(absent).toBeInstanceOf(ForkRefusedError);
    expect(unreadable).toBeInstanceOf(ForkRefusedError);
    expect((absent as ForkRefusedError).kind).toBe((unreadable as ForkRefusedError).kind);
    expect((absent as ForkRefusedError).message).toBe((unreadable as ForkRefusedError).message);
  });

  it("lets the owner fork their own private card", async () => {
    await seed();
    await makeCard(author, "secret-planner", "1.0.0", "private");

    const fork = await forkCard(db, actorFor(author), { cardId: "secret-planner", version: "1.0.0" }, {});
    expect(fork.cardId).toBe(`${AUTHOR_HANDLE}/secret-planner`);
  });

  /* --------------------- the version taken --------------------- */

  it("refuses a version the upstream never published, after granting the read", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "9.9.9" }, {}),
    ).rejects.toMatchObject({ kind: "no-such-card-version" });
  });

  it("takes the version named and not the latest one", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");
    await makeCard(author, "planner", "2.0.0", "public", { spec: "Write the plan, twice." });

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {});
    expect(fork.version).toBe("1.0.0");
    expect(fork.body?.spec).toBe("Write the plan.");
  });

  /* --------------------- the id --------------------- */

  it("lands the fork in the forker's own namespace, replacing an upstream namespace", async () => {
    await seed();
    await makeCard(author, `${AUTHOR_HANDLE}/planner`, "1.2.0", "public");

    const fork = await forkCard(
      db,
      actorFor(forker),
      { cardId: `${AUTHOR_HANDLE}/planner`, version: "1.2.0" },
      {},
    );
    /* Not `forker/upstream-author/planner`: `CARD_ID` admits exactly one namespace segment,
       so a fork of a namespaced card replaces the namespace rather than nesting under it. */
    expect(fork.cardId).toBe(`${FORKER_HANDLE}/planner`);
    expect(fork.ownerId).toBe(forker);
  });

  it("takes an explicit name, still inside the forker's namespace", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {
      name: "my-planner",
    });
    expect(fork.cardId).toBe(`${FORKER_HANDLE}/my-planner`);
  });

  it("refuses a name that is not a legal identifier", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, { name: "My Planner" }),
    ).rejects.toMatchObject({ kind: "card-id-invalid" });
  });

  it("refuses a name carrying its own namespace, which would nest two", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, { name: "someone/planner" }),
    ).rejects.toMatchObject({ kind: "card-id-invalid" });
  });

  it("refuses an account with no handle, because it has no namespace to fork into", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    await expect(
      forkCard(db, actorFor(handleless), { cardId: "planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "no-handle" });
  });

  it("refuses when the forker already holds that id, and leaves the existing rows alone", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");
    await makeCard(forker, `${FORKER_HANDLE}/planner`, "0.1.0", "public");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "card-id-taken" });

    const rows = await rowsFor(`${FORKER_HANDLE}/planner`);
    expect(rows.map((row) => row.version)).toEqual(["0.1.0"]);
  });

  it("refuses when somebody else already holds that id", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");
    /* A squatter on the forker's namespace. The fork must not append a version to a chain
       somebody else owns — `addCard` alone would have allowed it. */
    await makeCard(stranger, `${FORKER_HANDLE}/planner`, "0.1.0", "public");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "card-id-taken" });
  });

  it("refuses when the squatter's rows are PRIVATE and at another version", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");
    /* The case a visibility-filtered check cannot see, and the unique index cannot catch
       either: a private row at the same id and a DIFFERENT version. `(card_id, version)` is
       what the index constrains, so `forker/planner@1.0.0` would have inserted cleanly into a
       stranger's chain — the forker's fork silently becoming a version of somebody else's
       card, and a card whose versions have two owners. The occupancy check is therefore asked
       WITHOUT an actor, and this cell is what holds it that way. */
    await makeCard(stranger, `${FORKER_HANDLE}/planner`, "0.1.0", "private");

    await expect(
      forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "card-id-taken" });

    const rows = await rowsFor(`${FORKER_HANDLE}/planner`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.ownerId).toBe(stranger);
  });

  /* --------------------- attribution --------------------- */

  it("carries the forker as author and records the upstream in provenance", async () => {
    await seed();
    await makeCard(author, "planner", "1.2.0", "public");

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.2.0" }, {});

    expect(fork.body?.author).toBe(FORKER_HANDLE);
    expect(fork.body?.provenance).toBe(
      `${CARD_FORK_PROVENANCE_PREFIX} planner@1.2.0 by ${AUTHOR_HANDLE}`,
    );
    /* The upstream author's own name is not erased by the rewrite: it is in the provenance
       sentence, which is what stops a fork reading as something the forker wrote. */
    expect(fork.body?.provenance).toContain(AUTHOR_HANDLE);
  });

  it("stamps the same three fields into the stored YAML, and changes nothing else", async () => {
    await seed();
    const upstream = await makeCard(author, "planner", "1.2.0", "public");

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.2.0" }, {});

    const before = parseDocument(sourceFor(upstream), "yaml").value as Record<string, unknown>;
    const after = parseDocument(fork.source, "yaml").value as Record<string, unknown>;
    expect(after.id).toBe(`${FORKER_HANDLE}/planner`);
    expect(after.author).toBe(FORKER_HANDLE);
    expect(after.provenance).toBe(`${CARD_FORK_PROVENANCE_PREFIX} planner@1.2.0 by ${AUTHOR_HANDLE}`);
    expect({ ...after, id: undefined, author: undefined, provenance: undefined }).toEqual({
      ...before,
      id: undefined,
      author: undefined,
      provenance: undefined,
    });
  });

  it("stores a source that re-parses to the body it stored", async () => {
    await seed();
    await makeCard(author, "planner", "1.2.0", "public");

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.2.0" }, {});
    const reparsed = parseDocument(fork.source, "yaml").value as Record<string, unknown>;

    /* The stored `source` is what `/api/files/cards/**` serves and what `darkprint validate`
       reads. A source still declaring the upstream's id under the fork's row would hand a
       downloader a folder whose card does not match the row it came from. */
    expect(reparsed.id).toBe(fork.cardId);
    expect(reparsed.version).toBe(fork.version);
    expect(reparsed.author).toBe(fork.body?.author);
  });

  /* --------------------- the digest --------------------- */

  it("gives the fork a different digest from its upstream, because the id is inside the hash", async () => {
    await seed();
    const upstream = await makeCard(author, "planner", "1.2.0", "public");

    const fork = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.2.0" }, {});

    expect(fork.digest).not.toBe(cardDigest(upstream));
    expect(fork.digest).toBe(cardDigest({ ...upstream, id: fork.cardId }));
    /* `author` and `provenance` are outside `cardDigest` (VOLATILE_FIELDS), so the id is the
       whole of the difference — which is what makes a blueprint repinned onto a fork a
       different `bundleDigest` and never a silent substitution. */
  });

  /* --------------------- visibility --------------------- */

  it("takes the forker's own account default when none is asked for", async () => {
    await seed();
    const shy = await makeAccount("shy-forker", "shy-forker", "private");
    await makeCard(author, "planner", "1.0.0", "public");

    const fork = await forkCard(db, actorFor(shy), { cardId: "planner", version: "1.0.0" }, {});
    expect(fork.visibility).toBe("private");
  });

  it("takes an explicit visibility over the account default", async () => {
    await seed();
    const shy = await makeAccount("shy-forker", "shy-forker", "private");
    await makeCard(author, "planner", "1.0.0", "public");

    const fork = await forkCard(db, actorFor(shy), { cardId: "planner", version: "1.0.0" }, {
      visibility: "public",
    });
    expect(fork.visibility).toBe("public");
  });

  it("does not copy the upstream's visibility", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "private");

    const fork = await forkCard(db, actorFor(author), { cardId: "planner", version: "1.0.0" }, {});
    /* The author's own default is public, and the upstream row is private: a fork that
       inherited the upstream's visibility would answer "private" here. */
    expect(fork.visibility).toBe("public");
  });

  /* --------------------- what a fork does NOT touch --------------------- */

  it("writes exactly one row and leaves the upstream untouched", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");
    const [upstreamBefore] = await rowsFor("planner");

    await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {});

    const [upstreamAfter] = await rowsFor("planner");
    expect(upstreamAfter).toEqual(upstreamBefore);
    const all = await db.select().from(schema.cardVersion);
    expect(all).toHaveLength(2);
  });

  it("refuses a card whose stored body predates the current schema", async () => {
    await seed();
    /* Written straight to the table, which is how the rows this describes got there: a body
       missing `willNot` is what every registry-backed page hit on 2026-08-31. */
    await db.insert(schema.cardVersion).values({
      cardId: "old-planner",
      version: "1.0.0",
      digest: "sha256:old",
      ownerId: author,
      visibility: "public",
      body: { id: "old-planner", version: "1.0.0", name: "Old" },
      source: "id: old-planner\nversion: 1.0.0\n",
    });

    await expect(
      forkCard(db, actorFor(forker), { cardId: "old-planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "unreadable-card" });
  });

  it("refuses a card whose stored document cannot take the stamp", async () => {
    await seed();
    const body = cardFixture("listy-planner", "1.0.0");
    /* A body that reads perfectly and a `source` that is a SEQUENCE. The two are stored in
       separate columns and nothing before this made them agree, so the row is legal and
       unforkable: stamping an id into a document with no keys is not something this can do. */
    await db.insert(schema.cardVersion).values({
      cardId: "listy-planner",
      version: "1.0.0",
      digest: "sha256:listy",
      ownerId: author,
      visibility: "public",
      body,
      source: "- planner\n- planner\n",
    });

    await expect(
      forkCard(db, actorFor(forker), { cardId: "listy-planner", version: "1.0.0" }, {}),
    ).rejects.toMatchObject({ kind: "unreadable-card" });
  });

  it("can fork a fork, and the second provenance names the first", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    const first = await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {});
    const second = await forkCard(
      db,
      actorFor(stranger),
      { cardId: first.cardId, version: first.version },
      {},
    );

    expect(second.cardId).toBe(`${STRANGER_HANDLE}/planner`);
    expect(second.body?.provenance).toBe(
      `${CARD_FORK_PROVENANCE_PREFIX} ${FORKER_HANDLE}/planner@1.0.0 by ${FORKER_HANDLE}`,
    );
  });

  it("stores the fork under the forker, not the upstream owner", async () => {
    await seed();
    await makeCard(author, "planner", "1.0.0", "public");

    await forkCard(db, actorFor(forker), { cardId: "planner", version: "1.0.0" }, {});

    const [row] = await db
      .select()
      .from(schema.cardVersion)
      .where(
        and(
          eq(schema.cardVersion.cardId, `${FORKER_HANDLE}/planner`),
          eq(schema.cardVersion.version, "1.0.0"),
        ),
      );
    expect(row!.ownerId).toBe(forker);
  });
});
