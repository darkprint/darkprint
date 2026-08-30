/* ============================================================
   T220 — the scratch databases and the recorded worlds

   Not a test file. The vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── why the setup is RECORDED rather than left in a hook ──
   A throw in `beforeAll` produces SKIPS, not reds. The run stands
   down instead of failing and the number a reader quotes says
   `0 failed`. Measured in this repository at 127 merged cells going
   silent under one broken writer, while thirteen cells in a suite
   that recorded the setup failure and re-raised it PER CELL went red
   on the same defect. So every expensive thing here runs once, its
   outcome is captured, and each cell re-raises it: one import, N
   reds, and the count a reader quotes is the count of criteria that
   failed.

   ── why the rows go in through the PRODUCT's writers ──
   A fixture assembled field by field can satisfy a reader that no
   production write path satisfies, and this repository has shipped
   one: T200 stamped a column nothing in the product writes and got
   240 green cells about a state that cannot occur. So the public
   world here is `runImport(db, await planImport())` — the seed, the
   real one, nine bundles and a 57-document card library — and every
   extra row goes in through `publish` or `addCard`, which is the
   writer `publish` itself calls.

   ── why there are TWO worlds and two databases ──
   `publishCard` reads the existing row through `getCard(db, actor, …)`
   and calls `addCard` when it sees nothing. So a private card and a
   public card that share `(id, version)` are not two fixtures: the
   second publish cannot see the first, calls `addCard` anyway, and
   dies on the unique index. The private world therefore gets its own
   database with NO seed in it, and its public control is built from a
   different content folder whose card refs are disjoint — asserted,
   not assumed, in `disjointPair()` below.

   ── why the private world needs a control at all ──
   "A private card is unreachable" is satisfiable by a reader that
   cannot reach any unpinned card, private or not. The control is an
   identically-constructed PUBLIC card that `mcpReadCard` MUST return.
   Without it the privacy cell passes against a module that returns
   nothing to anybody.
   ============================================================ */

import { randomUUID } from "node:crypto";

import { CORE_ONTOLOGY, cardRef, type Bundle, type CardRef, type NodeCard } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { upsertFromGitHub, changeHandle } from "@/lib/server/accounts";
import { addCard } from "@/lib/server/cards";
import type { Actor } from "@/lib/server/policy";
import { publish } from "@/lib/server/publish";
import { planImport, runImport } from "@/lib/server/seed";
import { createTestDb, type TestDb } from "@/tests/support";

/* --------------------- the databases --------------------- */

const open: TestDb[] = [];

export interface Scratch {
  /** The published `Db` — the drizzle instance every T220 signature takes first. */
  db: unknown;
  /** This scratch database's own name, so a leak sweep can name it rather than count. */
  name: string;
  query: (sql: string, params?: readonly unknown[]) => Promise<Record<string, unknown>[]>;
}

function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

/**
 * A database of this file's own.
 *
 * `createTestDb()` creates `darkprint_test_<uuid>`, migrates it and drops it on `drop()`;
 * it never opens the shared development database `DATABASE_URL` names, which is why T000
 * built it (D-08). The name is carried out so a sweep can compare NAMES element-wise: a
 * `darkprint_test_*` count is ambiguous between this run and a neighbour's, and this
 * repository has nearly filed one session's leak against another.
 */
export async function scratchDatabase(): Promise<Scratch> {
  const test = await createTestDb();
  open.push(test);
  const client = test.client as unknown as Record<string, unknown>;
  const db = client.db;
  if (db === null || typeof db !== "object") {
    throw new Error(
      "createTestDb's client carries no `db`. `Db` is published from @/lib/db and is the " +
        "first parameter of all four T220 signatures.",
    );
  }
  const [row] = (await test.client.query("select current_database() as name")).rows as {
    name?: unknown;
  }[];
  const name = row?.name;
  if (typeof name !== "string" || name === "") {
    throw new Error(`\`select current_database()\` answered ${describe_(name)}.`);
  }

  return {
    db,
    name,
    query: async (sql, params) => {
      const result = await test.client.query(sql, params as unknown[]);
      return result.rows as Record<string, unknown>[];
    },
  };
}

export async function dropScratchDatabases(): Promise<number> {
  let dropped = 0;
  for (const test of open.splice(0)) {
    await test.drop();
    dropped += 1;
  }
  return dropped;
}

/* --------------------- actors --------------------- */

/** T060's published `Actor`, built here rather than imported so a fixture reads as a fixture. */
export const anonymous = { kind: "anonymous" } as const;
export const account = (accountId: string, handle: string | null = null) =>
  ({ kind: "account", accountId, handle }) as const;
export const operator = (accountId: string) => ({ kind: "operator", accountId }) as const;

export interface Who {
  handle: string;
  accountId: string;
  actor: Actor;
}

/**
 * One account, created the only way the product creates one.
 *
 * `upsertFromGitHub` is the single door (D-250-04's own words) and `changeHandle` is what
 * sets `account.handle` — `allocateHandle` writes `handle_reservation` and nothing
 * `resolveOwner` reads. A fixture that INSERTed the row directly would be a state no
 * signup produces.
 */
export async function makeAccount(db: unknown, githubId: string, handle: string): Promise<Who> {
  const created = await upsertFromGitHub(db as never, { githubId, githubLogin: handle });
  if (created.handle !== handle) {
    await changeHandle(
      db as never,
      { kind: "account", accountId: created.accountId, handle: created.handle },
      created.accountId,
      handle,
    );
  }
  return {
    handle,
    accountId: created.accountId,
    actor: { kind: "account", accountId: created.accountId, handle },
  };
}

/* --------------------- the recorded setup --------------------- */

/**
 * Runs `fn` once and hands every caller the same outcome, failure included.
 *
 * The rejection is re-raised with the stage named, because "the seed failed" and "the
 * second release failed" are different claims and a cell that cannot tell them apart
 * reports the wrong one.
 */
export function recorded<T>(stage: string, fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= fn().catch((cause: unknown) => {
      throw new Error(
        `${stage} did not complete, so this cell measured nothing.\n` +
          "  This is the recorded setup re-raised INSIDE the cell rather than thrown from a " +
          "hook: a hook that throws produces skips, and a skipped cell reports `0 failed`.",
        { cause },
      );
    });
    return pending;
  };
}

/* --------------------- content, as the loader reads it --------------------- */

/** The archive's local vocabulary in `publish`'s shape, exactly as `runImport` passes it. */
function archiveVocabulary(): { text: string; terms: readonly unknown[] } | undefined {
  const v = contentVocabulary();
  return v === undefined ? undefined : { text: v.text, terms: v.terms };
}

/** One loaded content bundle by slug, raising rather than answering `undefined`. */
export function content(slug: string): Bundle {
  const found = readContent().find((b) => b.slug === slug);
  if (found === undefined) {
    const slugs = readContent()
      .map((b) => b.slug)
      .join(", ");
    throw new Error(`content/blueprints/${slug} is not in the archive. Present: ${slugs}.`);
  }
  return found.bundle;
}

/** The card refs one content bundle pins, off the resolved blueprint rather than the filenames. */
export function refsOf(slug: string): readonly CardRef[] {
  const found = readContent().find((b) => b.slug === slug);
  if (found === undefined) throw new Error(`no such content bundle: ${slug}`);
  return [...new Set(found.blueprint.nodes.map((n) => n.ref))].sort();
}

/**
 * Two content slugs whose pinned card refs do not overlap.
 *
 * Computed rather than named, and the reason is `seed/plan.ts`: seven refs are pinned by two
 * bundles apiece. A hand-picked pair would be right today and wrong the first time somebody
 * repins a node, and the failure would be a unique-index violation three files away.
 */
export function disjointPair(): { a: string; b: string } {
  const slugs = readContent().map((b) => b.slug);
  for (const a of slugs) {
    const refsA = new Set(refsOf(a));
    for (const b of slugs) {
      if (b === a) continue;
      if (refsOf(b).every((r) => !refsA.has(r))) return { a, b };
    }
  }
  throw new Error(
    "No two content bundles pin disjoint card sets, so the private world cannot build a " +
      "public control without colliding on (card_id, version). Rebuild the control from a " +
      "synthesised card instead.",
  );
}

/* --------------------- the public world --------------------- */

export interface Seeded {
  scratch: Scratch;
  registry: Who;
  forker: Who;
  /** The slug carrying TWO releases, so AC2 has a "newer release exists" to survive. */
  twice: string;
  /** The slug whose bytes were published as `twice`'s second release. */
  other: string;
  /** `twice`'s first release: the digest AC2 pins and the file set it must keep answering. */
  first: { version: string; digest: string };
  /** `twice`'s second release, published after `first` was captured. */
  second: { version: string; digest: string };
  /** A public bundle carrying `lineage`, so `Provenance.forkedFrom` has a subject. */
  fork: { ownerHandle: string; slug: string };
}

const REGISTRY_HANDLE = "darkprint";
const SEED_VERSION = "1.0.0";
const SECOND_VERSION = "2.0.0";

/**
 * The seed, plus the two rows the criteria need that the seed does not create.
 *
 * `runImport` gives nine public bundles under `darkprint` and a 57-document card library
 * (53 distinct ids — four ids carry two versions, `seed/plan.ts:87-93`). What it does NOT
 * give is a bundle with two releases or a bundle with a lineage, and AC2 and the provenance
 * verb are exactly those two claims, so both are added here through `publish`.
 *
 * ── why the second release carries ANOTHER bundle's bytes ──
 * AC2 says the digest reference keeps answering the same bytes after a newer release
 * exists. A cell cannot tell "answered the first release" from "answered the second" unless
 * the two differ OBSERVABLY, and two releases of the same content differ in nothing at all —
 * `exportBundle` is pure and sorts by path. Repinning the whole node set makes the two file
 * SETS differ by name, which is the coarsest possible difference and the one AC4 already
 * gives the cells a vocabulary for.
 */
export function seededWorld(): () => Promise<Seeded> {
  return recorded("the seed import and the two extra publishes", async () => {
    const scratch = await scratchDatabase();
    const db = scratch.db;

    await runImport(db as never, await planImport());

    /* `upsertFromGitHub` is idempotent by `githubId`, so this resolves the account the
       import already created rather than making a second one (D-250-04's sentinel `"0"`,
       spelled as the string the column takes per D-250-20). */
    const registry = await makeAccount(db, "0", REGISTRY_HANDLE);

    const { a: twice, b: other } = disjointPair();
    const vocabulary = archiveVocabulary();
    const bytes = content(other);

    await publish(
      db as never,
      registry.actor,
      {
        ownerHandle: REGISTRY_HANDLE,
        slug: twice,
        version: SECOND_VERSION,
        manifest: { ...bytes.manifest, slug: twice },
        dot: bytes.dot,
        cardFiles: { ...bytes.cardFiles },
        ...(vocabulary === undefined ? {} : { vocabulary: vocabulary as never }),
        visibility: "public",
      } as never,
      undefined,
    );

    const releases = await scratch.query(
      `select r.version, r.digest, r.card_refs from "release" r
         join "bundle" b on b.id = r.bundle_id
        where b.slug = $1
        order by r.created_at`,
      [twice],
    );
    if (releases.length !== 2) {
      throw new Error(
        `\`${twice}\` carries ${releases.length} releases and AC2 needs exactly two — one to ` +
          `pin by digest and a newer one to survive. Rows: ${JSON.stringify(releases)}.`,
      );
    }
    const [firstRow, secondRow] = releases as { version: string; digest: string; card_refs: unknown }[];
    if (firstRow.digest === secondRow.digest) {
      throw new Error(
        "The two releases share a digest, so no cell below can tell which one was answered. " +
          "The second release must carry observably different bytes.",
      );
    }
    /* The premise AC2's cells actually rest on, asserted as a DATABASE fact rather than
       inferred from the digests: two releases can differ in digest and still export the same
       file NAMES, and a cell comparing name sets would then pass while measuring nothing.
       `card_refs` decides `cards/*.yaml`, so a difference here is a difference a name-set
       comparison can see. Read off `release` rather than off `bundleFilePaths`, which is the
       oracle AC4's own cells use — a fixture that shares an instrument with the assertion it
       sets up cannot fail independently of it. */
    const refsFirst = JSON.stringify(firstRow.card_refs);
    const refsSecond = JSON.stringify(secondRow.card_refs);
    if (refsFirst === refsSecond) {
      throw new Error(
        `Both releases of \`${twice}\` pin the same card refs, so their exported file names ` +
          `are identical and no AC2 or AC4 cell below can tell the two apart. Refs: ${refsFirst}.`,
      );
    }

    /* A public fork, so `Provenance.forkedFrom` has a subject. Public and not private: a
       private fork would be invisible to every MCP caller by D-220-03 and the cell would be
       measuring the privacy rule instead of the lineage one. */
    const forker = await makeAccount(db, `t220-${randomUUID()}`, `t220forker`);
    const forkSlug = "t220-forked-copy";
    const forkBytes = content(twice);
    await publish(
      db as never,
      forker.actor,
      {
        ownerHandle: forker.handle,
        slug: forkSlug,
        version: SEED_VERSION,
        manifest: { ...forkBytes.manifest, slug: forkSlug },
        dot: forkBytes.dot,
        cardFiles: { ...forkBytes.cardFiles },
        ...(vocabulary === undefined ? {} : { vocabulary: vocabulary as never }),
        visibility: "public",
        lineage: { ownerHandle: REGISTRY_HANDLE, slug: twice, version: SEED_VERSION },
      } as never,
      undefined,
    );

    return {
      scratch,
      registry,
      forker,
      twice,
      other,
      first: { version: firstRow.version, digest: firstRow.digest },
      second: { version: secondRow.version, digest: secondRow.digest },
      fork: { ownerHandle: forker.handle, slug: forkSlug },
    };
  });
}

/* --------------------- the private world --------------------- */

export interface Private {
  scratch: Scratch;
  /** Owns the private bundle and the private card. */
  alpha: Who;
  /** Owns nothing. The stranger arm of the three-actor agreement. */
  beta: Who;
  /** Private, owned by `alpha`. Unreachable through every MCP verb (AC3, D-220-03). */
  secret: { ownerHandle: string; slug: string; digest: string; refs: readonly CardRef[] };
  /** Public, owned by `alpha`. The control that proves the verbs can see anything at all. */
  shown: { ownerHandle: string; slug: string; digest: string; refs: readonly CardRef[] };
  /**
   * A PUBLIC bundle whose lineage points at the PRIVATE one.
   *
   * D-220-05: `forkedFrom` is OMITTED WHOLE when the upstream is unreadable, because a fork
   * of a non-public upstream that names it leaks by lineage — AC3 through a field nobody
   * thinks of as content. Published by `alpha`, the only actor that can see the upstream's
   * cards: `publishCard` resolves them through `getCard(db, actor, …)`, and a publisher who
   * cannot see an existing row calls `addCard` and dies on the unique index.
   */
  forkOfSecret: { ownerHandle: string; slug: string };
  /**
   * A private card pinned by no bundle, so `mcpReadCard` is asked about it directly.
   *
   * `nonce` is a string the CALLER never supplies — it sits inside the document body, not in
   * the ref. That distinction is the whole reliability of the leak scan: a refusal is
   * entitled to quote the ref it was given ("no such card: x@1.0.0" is B-03-correct), so a
   * needle taken from the caller's own input would charge a correct module with a leak.
   */
  privateCard: { ref: CardRef; source: string; nonce: string };
  /** The same construction, PUBLIC. Without it "private is unreachable" is satisfiable by
      a reader that cannot reach an unpinned card at all. */
  publicCard: { ref: CardRef; source: string; nonce: string };
}

/**
 * A database with no seed in it, two accounts, and four rows whose visibilities disagree.
 *
 * Its own database and not the seeded one, and the reason is a write path rather than
 * tidiness: `publishCard` looks the existing row up through `getCard(db, actor, …)`, which
 * applies `can`. A private row is invisible to the next publisher, which therefore calls
 * `addCard` and dies on the unique index over `(card_id, version)`. So the private and
 * public halves are built from content bundles with DISJOINT card sets, and the whole
 * fixture is kept away from the 57 documents the seed already owns.
 */
export function privateWorld(): () => Promise<Private> {
  return recorded("the private world", async () => {
    const scratch = await scratchDatabase();
    const db = scratch.db;

    /* No ontology version is published first. `publish` used to call
       `openView(db, manifest.ontologyVersion)` and refuse a version nobody had published, so
       without this every publish below refused for a reason that had nothing to do with
       visibility. `openView` merges over `CORE_ONTOLOGY` and takes no version. */

    const alpha = await makeAccount(db, `t220a-${randomUUID()}`, "t220alpha");
    const beta = await makeAccount(db, `t220b-${randomUUID()}`, "t220beta");

    const { a: secretSlug, b: shownSlug } = disjointPair();
    const vocabulary = archiveVocabulary();

    const put = async (slug: string, visibility: "public" | "private") => {
      const bytes = content(slug);
      const result = await publish(
        db as never,
        alpha.actor,
        {
          ownerHandle: alpha.handle,
          slug,
          version: SEED_VERSION,
          manifest: { ...bytes.manifest, slug },
          dot: bytes.dot,
          cardFiles: { ...bytes.cardFiles },
          ...(vocabulary === undefined ? {} : { vocabulary: vocabulary as never }),
          visibility,
        } as never,
        undefined,
      );
      return {
        ownerHandle: alpha.handle,
        slug,
        digest: (result as { digest: string }).digest,
        refs: refsOf(slug),
      };
    };

    const secret = await put(secretSlug, "private");
    const shown = await put(shownSlug, "public");

    /* The lineage leak's subject: public, and forked from the private one. */
    const forkOfSecretSlug = "t220-fork-of-secret";
    const secretBytes = content(secretSlug);
    await publish(
      db as never,
      alpha.actor,
      {
        ownerHandle: alpha.handle,
        slug: forkOfSecretSlug,
        version: SEED_VERSION,
        manifest: { ...secretBytes.manifest, slug: forkOfSecretSlug },
        dot: secretBytes.dot,
        cardFiles: { ...secretBytes.cardFiles },
        ...(vocabulary === undefined ? {} : { vocabulary: vocabulary as never }),
        visibility: "public",
        lineage: { ownerHandle: alpha.handle, slug: secretSlug, version: SEED_VERSION },
      } as never,
      undefined,
    );

    /* Two unpinned cards, one private and one public, written through `addCard` — which is
       the writer `publish` itself calls (`publish.ts:371`), not a hand-built INSERT. They
       are unpinned deliberately: `mcpReadCard` takes a ref and `resolveCardRef` reads
       `card_version` directly, so a bundle is not part of the question, and building one
       would drag the collision problem above into the fixture for nothing.

       The id is unique per run so the pair cannot collide with the archive's 53 ids nor
       with a neighbouring run in the same database — there is no neighbouring run, and the
       uniqueness is what makes that true rather than assumed. */
    const stamp = randomUUID().slice(0, 8);
    const card = (id: string, nonce: string): { body: NodeCard; source: string } => {
      const body: NodeCard = {
        id,
        name: "T220 fixture",
        type: CORE_ONTOLOGY.terms.filter((t) => t.kind === "node-type")[0]!.id,
        phases: [],
        action: "fixture",
        spec: `A card written by the T220 fixture layer through addCard, the writer publish itself calls. nonce ${nonce}`,
        tools: [],
        mcp: [],
        params: {},
        inputs: [],
        outputs: [],
        dependencies: [],
        cannot: [],
        willNot: [],
        riskMarkers: [],
        version: SEED_VERSION,
      };
      /* The stored bytes. `addCard` keeps `source` verbatim and `mcpReadCard` is published
         to answer "the YAML as published", so this string is what the criterion compares
         against — it is deliberately NOT re-serialised from `body` at assertion time, which
         would be the module and the oracle agreeing through one function. */
      const source = [
        `id: ${body.id}`,
        `name: ${body.name}`,
        `type: ${body.type}`,
        `action: ${body.action}`,
        `spec: ${body.spec}`,
        `version: ${body.version}`,
        "",
      ].join("\n");
      return { body, source };
    };

    const privNonce = `t220-secret-nonce-${randomUUID()}`;
    const pubNonce = `t220-shown-nonce-${randomUUID()}`;
    const priv = card(`t220-private-${stamp}`, privNonce);
    const pub = card(`t220-public-${stamp}`, pubNonce);
    await addCard(db as never, {
      cardId: priv.body.id,
      version: priv.body.version,
      ownerId: alpha.accountId,
      visibility: "private",
      body: priv.body,
      source: priv.source,
    });
    await addCard(db as never, {
      cardId: pub.body.id,
      version: pub.body.version,
      ownerId: alpha.accountId,
      visibility: "public",
      body: pub.body,
      source: pub.source,
    });

    return {
      scratch,
      alpha,
      beta,
      secret,
      shown,
      forkOfSecret: { ownerHandle: alpha.handle, slug: forkOfSecretSlug },
      privateCard: {
        ref: cardRef(priv.body.id, priv.body.version),
        source: priv.source,
        nonce: privNonce,
      },
      publicCard: {
        ref: cardRef(pub.body.id, pub.body.version),
        source: pub.source,
        nonce: pubNonce,
      },
    };
  });
}
