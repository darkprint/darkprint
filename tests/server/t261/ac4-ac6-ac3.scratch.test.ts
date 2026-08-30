/* ============================================================
   T261 AC4, AC6 and AC3 — driven against a seeded scratch
   registry in the granted DB window.

   Each cell drives the MERGED readers the cutover consumes, so
   these measure the surfaces the page will render through rather
   than the page. The route-rendering members of this family
   (`/nodes/<id>`'s author branch, `/ontology/[...term]`'s weight
   provenance, the registry-caller half of the metrics band) need
   the cutover's own routes and are not in this file.

   ── two things this file is careful about ──
   1. `blueprintFileHref` is D-261-04(2)'s addition to `lib/href.ts`
      and does not exist in a blind worktree. It is imported
      DYNAMICALLY, INSIDE its own cell, at the END — never at file
      scope. A static import of an absent member throws while the
      module graph is built, which vitest reports as
      `Test Files 1 failed` beside `Tests 0`: every cell below
      simply absent, loud in the exit code and silent in the number
      a reader quotes. The fixture writes must not be masked by it.
   2. The counter pair is asserted in BOTH directions from ONE
      fixture. `releaseFiles` must not move the download counter
      (a listing is not a download — its own docblock refuses
      `recordDownload`), and `serveFile` must (`serve-file.ts:109`).
      A one-directional cell would be satisfied by a counter that
      never moves at all, which is the more likely regression and
      the one that looks like success.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type CardRef } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { schema } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { getSignals } from "@/lib/server/counters";
import { releaseFiles, serveFile } from "@/lib/server/export";
import { blueprint } from "@/lib/server/registry";
import type { Actor } from "@/lib/server/policy/types";

import { createTestDb, type TestDb } from "../../support/db";

const OWNER = "t261owner";
const STRANGER = "t261stranger";

let testDb: TestDb | undefined;
let previousUrl: string | undefined;

/** Set in `beforeAll`; every cell re-checks the premise it needs rather than trusting these. */
let ownerId = "";
let strangerId = "";
let publicSlug = "";
let privateSlug = "";
let publicBundleId = "";
let digest = "";

const asOwner = (): Actor => ({ kind: "account", accountId: ownerId, handle: OWNER });
const asStranger = (): Actor => ({ kind: "account", accountId: strangerId, handle: STRANGER });
const anonymous: Actor = { kind: "anonymous" };

/** Seed one bundle from the archive's own first entry, at a caller-chosen slug and visibility. */
async function seedBundle(
  db: TestDb["client"]["db"],
  slug: string,
  visibility: "public" | "private",
): Promise<{ bundleId: string; digest: string }> {
  const entry = readContent()[0];
  const bundle = await createBundle(db, { ownerId, slug, visibility });
  const vocabulary = contentVocabulary();
  const release = await addRelease(db, {
    bundleId: bundle.id,
    version: "1.0.0",
    dot: entry.bundle.dot,
    manifest: entry.bundle.manifest,
    cardRefs: entry.blueprint.nodes.map((node) => node.ref),
    cardDigests: entry.blueprint.nodes.map((node) => node.digest),
    ...(vocabulary === undefined
      ? {}
      : { vocabulary: { text: vocabulary.text, terms: vocabulary.terms } }),
    analysis: {
      autonomy: entry.analysis.autonomy,
      security: entry.analysis.security,
      phaseCoverage: entry.analysis.phaseCoverage,
    },
  });
  return { bundleId: bundle.id, digest: release.digest };
}

beforeAll(async () => {
  testDb = await createTestDb();
  previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = testDb.client.pool.options.connectionString ?? previousUrl;

  const db = testDb.client.db;
  const [owner] = await db
    .insert(schema.account)
    .values({ githubId: "t261-owner", githubLogin: "t261-owner", handle: OWNER })
    .returning();
  const [stranger] = await db
    .insert(schema.account)
    .values({ githubId: "t261-stranger", githubLogin: "t261-stranger", handle: STRANGER })
    .returning();
  ownerId = owner.id;
  strangerId = stranger.id;

  const entry = readContent()[0];

  const seen = new Set<string>();
  for (const file of entry.cardFiles) {
    const ref = file.file.replace(/^cards\//, "").replace(/\.yaml$/, "") as CardRef;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const body = entry.blueprint.cards.get(ref);
    if (body === undefined) continue;
    await addCard(db, { cardId: body.id, version: body.version, ownerId, body, source: file.text });
  }

  publicSlug = `${entry.slug}-public`;
  privateSlug = `${entry.slug}-private`;
  const seededPublic = await seedBundle(db, publicSlug, "public");
  publicBundleId = seededPublic.bundleId;
  digest = seededPublic.digest;
  await seedBundle(db, privateSlug, "private");
}, 180_000);

afterAll(async () => {
  /* The readers open the shared client against the scratch database and cache it on
     `globalThis`, so it is closed and evicted before the drop — otherwise DROP fails with
     "is being accessed by other users" and the database is LEFT BEHIND, which is residue
     in the medium this run keeps forgetting. */
  const key = Symbol.for("darkprint.db.sharedClient");
  const withShared = globalThis as unknown as Record<symbol, { close(): Promise<void> } | undefined>;
  await withShared[key]?.close();
  delete withShared[key];
  if (previousUrl !== undefined) process.env.DATABASE_URL = previousUrl;
  await testDb?.drop();
});

/* The fixture's own premise, as a CELL rather than in the hook.
   A throw in `beforeAll` produces SKIPS, not reds — the run stands down instead of
   failing, and a skipped suite reads as green to anyone quoting a test total. So the
   fixture states what it built, here, where a failure is a red with a message. */
describe("the fixture", () => {
  it("seeded a public and a private bundle for one owner", async () => {
    const db = testDb!.client.db;
    expect(ownerId, "no owner account").not.toBe("");
    expect(strangerId, "no stranger account").not.toBe("");
    expect(digest, "the public release has no digest").toMatch(/^sha256:/);

    const mine = await blueprint(db, asOwner(), OWNER, publicSlug);
    expect(mine, "the public bundle does not resolve for its own owner").toBeDefined();
  });
});

describe("AC4: the download command's URLs fetch the files the page lists", () => {
  it("lists files for the release, at the digest the page addresses", async () => {
    const db = testDb!.client.db;
    const listing = await releaseFiles(db, anonymous, { ownerHandle: OWNER, slug: publicSlug });

    expect(listing, "`releaseFiles` answered undefined for a public bundle").toBeDefined();
    expect(listing?.digest, "the listing's digest is not the release's").toBe(digest);
    expect(
      listing?.files.length,
      "the listing is empty, so every 'the URLs fetch what is listed' cell below is vacuous",
    ).toBeGreaterThan(0);
  });

  it("every listed file really is served at that digest address", async () => {
    const db = testDb!.client.db;
    const listing = await releaseFiles(db, anonymous, { ownerHandle: OWNER, slug: publicSlug });
    expect(listing).toBeDefined();

    const missing: string[] = [];
    for (const path of listing!.files) {
      const served = await serveFile(
        db,
        anonymous,
        { ownerHandle: OWNER, slug: publicSlug, digest: listing!.digest },
        path,
      );
      // Assert what the reader LEFT BEHIND, not merely that it did not throw: a served
      // file with zero bytes satisfies "resolved" and 404s a reader just as thoroughly.
      if (served === undefined || served.bytes.byteLength === 0) missing.push(path);
    }

    expect(
      missing,
      `the page lists these files and the digest address does not serve them: ${missing.join(", ")}.\n\n` +
        `AC4 is exactly this correspondence. D-261-04(2) binds the download command to the ` +
        `DIGEST address (\`/api/files/blueprints/{owner}/{slug}/d/{digest}/...\`) rather than ` +
        `the version address, because the digest is the immutable promise.`,
    ).toEqual([]);
  });
});

describe("AC4: a listing is not a download, and a fetch is", () => {
  /*
   * Both directions from one fixture. Asserted as a PAIR because either alone is
   * satisfiable by a counter that never moves — which is the likelier regression and the
   * one that looks like success on a dashboard.
   */
  it("releaseFiles does not move the counter and serveFile does", async () => {
    const db = testDb!.client.db;
    const target = { kind: "blueprint", refId: publicBundleId } as const;

    const before = await getSignals(db, anonymous, target);

    await releaseFiles(db, anonymous, { ownerHandle: OWNER, slug: publicSlug });
    const afterListing = await getSignals(db, anonymous, target);
    expect(
      afterListing.downloadCount,
      "rendering the file panel moved the download counter. `releaseFiles` refuses " +
        "`recordDownload` deliberately (its docblock says so): a listing is not a download, " +
        "and counting the panel's render counts every page view as a file transfer.",
    ).toBe(before.downloadCount);

    const listing = await releaseFiles(db, anonymous, { ownerHandle: OWNER, slug: publicSlug });
    await serveFile(
      db,
      anonymous,
      { ownerHandle: OWNER, slug: publicSlug, digest: listing!.digest },
      listing!.files[0]!,
    );
    const afterFetch = await getSignals(db, anonymous, target);
    expect(
      afterFetch.downloadCount,
      "fetching an actual file did NOT move the download counter. `serve-file.ts:109` records " +
        "it, so either that call is gone or the counter is not reaching this target. Note this " +
        "cell fails the same way if the counter never moves at all, which is why it is paired " +
        "with the assertion above rather than standing alone.",
    ).toBeGreaterThan(afterListing.downloadCount);
  });
});

describe("AC6: a private bundle is not there for anyone but its owner", () => {
  it("resolves for the owner and is absent for a stranger and for anonymous", async () => {
    const db = testDb!.client.db;

    const forOwner = await blueprint(db, asOwner(), OWNER, privateSlug);
    expect(
      forOwner,
      "the owner cannot see their own private bundle, so the cells below would pass for the " +
        "wrong reason — everything absent to everyone",
    ).toBeDefined();

    for (const [who, actor] of [["a stranger", asStranger()], ["anonymous", anonymous]] as const) {
      expect(
        await blueprint(db, actor, OWNER, privateSlug),
        `a private bundle resolved for ${who}. B-03's existence oracle: absent, not refused — ` +
          `the route renders the 404 PAGE, never a 403 and never an empty state, because a ` +
          `refusal confirms the bundle exists.`,
      ).toBeUndefined();
    }
  });

  it("and its files are absent too, not merely its record", async () => {
    // The oracle has to close at the file edge as well, or a private bundle's contents are
    // readable by anyone who knows the digest while its detail page 404s.
    const db = testDb!.client.db;
    expect(
      await releaseFiles(db, asStranger(), { ownerHandle: OWNER, slug: privateSlug }),
      "a stranger listed a private bundle's files",
    ).toBeUndefined();
    expect(
      await releaseFiles(db, asOwner(), { ownerHandle: OWNER, slug: privateSlug }),
      "the owner cannot list their own private bundle's files, so the cell above passes for " +
        "the wrong reason",
    ).toBeDefined();
  });
});

describe("AC3: a blueprint published after the last read is reachable at its URL", () => {
  it("a second read sees a bundle the first read could not", async () => {
    const db = testDb!.client.db;
    const slug = `${readContent()[0].slug}-after-deploy`;

    // The negative FIRST, so the cell cannot pass by the bundle having existed all along.
    expect(
      await blueprint(db, anonymous, OWNER, slug),
      "the fixture slug already exists; this cell would prove nothing",
    ).toBeUndefined();

    await seedBundle(db, slug, "public");

    expect(
      await blueprint(db, anonymous, OWNER, slug),
      "a blueprint published after the first read is not reachable. Under D-261-03 the read " +
        "is live and per-request, so AC3 holds trivially and for the right reason — if this " +
        "reds, something is caching a registry read that must not be cached.",
    ).toBeDefined();
  });
});

describe("D-261-04(2): lib/href.ts's new addresses", () => {
  /*
   * BOUND LAST, and dynamically, inside the cell.
   *
   * These members do not exist in a blind worktree. A static import of an absent export
   * throws while the module graph is built — `Test Files 1 failed` beside `Tests 0`, with
   * every fixture write above simply never executed. Binding here keeps the absence to one
   * red that says what is missing.
   */
  it("publishes blueprintHref and blueprintFileHref", async () => {
    const href = (await import("@/lib/href")) as Record<string, unknown>;

    for (const name of ["blueprintHref", "blueprintFileHref"]) {
      expect(
        typeof href[name],
        `\`lib/href.ts\` does not export \`${name}\`. D-261-04(2) adds both: ` +
          `\`blueprintHref(ownerHandle, slug)\` and ` +
          `\`blueprintFileHref(ownerHandle, slug, { digest }, path)\`. Until the cutover lands ` +
          `this is the blind position and this is the only cell that should say so.`,
      ).toBe("function");
    }
  });

  it("binds the digest address, not the version address", async () => {
    const href = (await import("@/lib/href")) as {
      blueprintFileHref?: (o: string, s: string, r: { digest: string }, p: string) => string;
    };
    if (typeof href.blueprintFileHref !== "function") {
      throw new Error("`blueprintFileHref` is absent; see the cell above for the repair.");
    }

    const url = href.blueprintFileHref(OWNER, publicSlug, { digest }, "README.md");
    expect(
      url,
      "the file address does not use the `/d/{digest}/` route. D-261-04(2): the download " +
        "command binds the DIGEST address — the immutable promise `/mcp` already calls " +
        "load-bearing — never the version address, which exists for hand-written URLs.",
    ).toContain("/d/");
    expect(url).toContain(encodeURIComponent(digest).replace(/%3A/i, ":").split(":").pop()!);
  });
});
