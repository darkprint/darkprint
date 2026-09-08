/* ============================================================
   T250 — AC4, attribution

   "(4) every imported bundle is owned by the registry handle and no
   fictional account exists."

   The archive is generated, and every `author:` line in it names the
   registry handle, so the account that owns the rows is the one the
   documents credit. The import creates that one account and nobody
   else: the sentinel `upsertFromGitHub(db, { githubId: 0, githubLogin:
   "autogen" })`, where `0` cannot collide because GitHub ids start
   at 1.

   ── the control that keeps this from being satisfied by nothing ──
   "Every bundle owned by one account" is trivially true of a
   database with one bundle, and "no other account" is trivially true
   of a database with no accounts at all. Both are asserted beside
   the premise that the import demonstrably ran: ten bundles and 61
   card versions stored, all under the one account.

   ── ownership is read from the DATABASE, never from the result ──
   AC4 is a claim about what is stored. A value `runImport` handed
   back is the module agreeing with itself.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import {
  EXPECTED_AUTHORS,
  EXPECTED_BUNDLES,
  EXPECTED_CARD_FILES,
  REGISTRY_GITHUB_ID,
  REGISTRY_HANDLE,
  SEED_VERSION,
  bundleSlugs,
  manifestAuthors,
  printedDigests,
  REPO_ROOT,
} from "./contract";
import { closeDatabase, importedOnce, registryAccountId } from "./fixtures";

import { readFileSync } from "node:fs";

const imported = importedOnce();

afterAll(async () => {
  await closeDatabase();
});

const SLOW = 180_000;

describe("the control: what the archive credits", () => {
  /**
   * One handle across the ten manifests, read off the archive, and it is the registry handle.
   * The ownership cells below are about `owner_id`; this one is about the bytes, so a manifest
   * that quietly credited somebody else would red here by name rather than passing as one
   * more row under the right owner.
   */
  it("credits every manifest to the registry handle", () => {
    const authors = bundleSlugs().map((slug) => {
      const text = readFileSync(`${REPO_ROOT}content/blueprints/${slug}/blueprint.yaml`, "utf8");
      return /^author:\s*(\S+)\s*$/m.exec(text)?.[1] ?? "";
    });
    expect(authors).toHaveLength(EXPECTED_BUNDLES);
    expect(new Set(authors)).toEqual(new Set([REGISTRY_HANDLE]));
    expect(manifestAuthors()).toHaveLength(EXPECTED_AUTHORS);
    expect(manifestAuthors()).toEqual([REGISTRY_HANDLE]);
  });
});

describe("AC4: one registry account, and nobody else", () => {
  it(
    "creates exactly one account, holding the handle D-250-04 publishes",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query('select handle, github_id, github_login from "account"');
      expect(rows).toHaveLength(1);
      expect(rows[0]?.handle).toBe(REGISTRY_HANDLE);
    },
    SLOW,
  );

  it(
    "uses the github id 0 sentinel, which no real signup can reach",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query('select github_id, github_login from "account"');
      /* `account.github_id` is `text`, so the stored value is the STRING "0". Compared as a
         string rather than with `==`: `0 == "0"` is true and so is `0 == ""`, and the second is
         a column nobody set. */
      expect(rows.map((r) => String(r.github_id))).toEqual([String(REGISTRY_GITHUB_ID)]);
      expect(rows.map((r) => r.github_login)).toEqual([REGISTRY_HANDLE]);
    },
    SLOW,
  );

  /**
   * The strong reading: no account row other than the registry's. Exact equality on the
   * handle, never `like` and never a substring: D-250-13 recorded that a substring match is
   * how two distinct subjects collapse into one.
   */
  it(
    "creates no account other than the registry's",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query(
        'select id, handle, github_login from "account" where handle is distinct from $1',
        [REGISTRY_HANDLE],
      );
      expect(
        rows,
        "an account exists beside the registry's. The import publishes under one handle and " +
          "invents nobody.",
      ).toEqual([]);
    },
    SLOW,
  );

  /**
   * Derived rather than enumerated: with exactly one account row, every `owner_id` anywhere in
   * the database has to be that account or the foreign key is pointing at something that is not
   * there. Asserting it over the tables that HAVE an owner covers the cards as well as the
   * bundles, which the criterion's wording does not reach but its intent does.
   */
  it(
    "owns every bundle and every card version under that one account",
    async () => {
      const { scratch } = await imported();
      const registry = await registryAccountId(scratch);
      expect(registry, `no account holds the handle "${REGISTRY_HANDLE}"`).toBeDefined();

      const bundles = await scratch.query('select slug, owner_id from "bundle"');
      expect(bundles).toHaveLength(EXPECTED_BUNDLES);
      expect(bundles.filter((b) => b.owner_id !== registry).map((b) => b.slug)).toEqual([]);

      const cards = await scratch.query('select card_id, version, owner_id from "card_version"');
      expect(cards).toHaveLength(EXPECTED_CARD_FILES);
      expect(
        cards.filter((c) => c.owner_id !== registry).map((c) => `${c.card_id}@${c.version}`),
      ).toEqual([]);
    },
    SLOW,
  );

  /**
   * The plan says every archive card is public; this says the STORE agrees.
   *
   * Measured as a gap rather than reasoned about: a mutation that flipped the plan's card
   * visibility to `private` reddened exactly one cell, in `plan.test.ts`, and nothing at the
   * database layer noticed. A plan that says public and a write that stores private is a
   * divergence with no witness, and AC6's withdrawal (D-250-02) removed the only other cell
   * that would have looked at this column.
   */
  it(
    "stores all 57 card versions public, and every bundle public",
    async () => {
      const { scratch } = await imported();
      const cards = await scratch.query('select card_id, version, visibility from "card_version"');
      expect(cards).toHaveLength(EXPECTED_CARD_FILES);
      expect(
        cards.filter((c) => c.visibility !== "public").map((c) => `${c.card_id}@${c.version}`),
      ).toEqual([]);

      const bundles = await scratch.query('select slug, visibility from "bundle"');
      expect(bundles.filter((b) => b.visibility !== "public").map((b) => b.slug)).toEqual([]);
    },
    SLOW,
  );

  it(
    "stores the nine bundles under the slugs the archive carries, by name",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query('select slug from "bundle" order by slug');
      expect(rows.map((r) => r.slug)).toEqual([...bundleSlugs()]);
    },
    SLOW,
  );
});

describe("ownership and authorship name the same handle", () => {
  /**
   * The manifest keeps the handle the archive wrote, and the archive writes the registry
   * handle. AC4 is about `bundle.owner_id`; this is about `release.manifest.author`, which sits
   * outside `bundleDigest` and is therefore digest-neutral either way. Both halves are
   * asserted, because "author is a non-empty string" would admit a rewritten manifest.
   */
  it(
    "stores each manifest with the author the archive wrote, which is the registry handle",
    async () => {
      const expected = new Map(
        bundleSlugs().map((slug) => [
          slug,
          /^author:\s*(\S+)\s*$/m.exec(
            readFileSync(`${REPO_ROOT}content/blueprints/${slug}/blueprint.yaml`, "utf8"),
          )?.[1],
        ]),
      );
      expect(new Set(expected.values())).toEqual(new Set([REGISTRY_HANDLE]));

      const { scratch } = await imported();
      const rows = await scratch.query(
        'select b.slug as slug, r.manifest as manifest from "release" r ' +
          'join "bundle" b on b.id = r.bundle_id',
      );
      expect(rows).toHaveLength(EXPECTED_BUNDLES);

      const wrong = rows
        .map((r) => ({
          slug: String(r.slug),
          author: (r.manifest as { author?: unknown })?.author,
        }))
        .filter((r) => r.author !== expected.get(r.slug))
        .map((r) => `${r.slug}: stored ${String(r.author)}, archive ${expected.get(r.slug)}`);
      expect(wrong).toEqual([]);
    },
    SLOW,
  );

  /**
   * Rewriting a stored `source` is the harm D-90-03 exists to prevent, and it would put the
   * store and `content/` permanently out of agreement. So the stored card bytes are compared to
   * the file on disk BYTE FOR BYTE, and the `author:` line inside those bytes is read back to
   * show it names the registry handle rather than being absent.
   */
  it(
    "stores every card's bytes exactly as content/ holds them, author line included",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query('select card_id, version, source from "card_version"');
      expect(rows).toHaveLength(EXPECTED_CARD_FILES);

      const wrong: string[] = [];
      for (const row of rows) {
        const ref = `${String(row.card_id)}@${String(row.version)}`;
        const onDisk = readFileSync(`${REPO_ROOT}content/cards/${ref}.yaml`, "utf8");
        if (String(row.source) !== onDisk) wrong.push(ref);
      }
      expect(wrong).toEqual([]);

      const authors = new Set(
        rows.map((r) => /^author:\s*(\S+)\s*$/m.exec(String(r.source))?.[1]).filter(Boolean),
      );
      expect(authors.size).toBe(EXPECTED_AUTHORS);
      expect([...authors]).toEqual([REGISTRY_HANDLE]);
    },
    SLOW,
  );
});

describe("AC1 after the write: re-attribution did not move a digest", () => {
  /**
   * The plan-level AC1 cells say the PLAN carries the printed digests. This one reads the digest
   * back out of `release` after the import has re-attributed everything, which is AC1's own
   * sentence — "AFTER IMPORT each of the nine bundles hashes to the digest the site prints
   * today" — rather than the weaker claim that a pure function computed it correctly.
   *
   * It is the cell where AC1 and AC4 meet: if ownership were inside a bundle's identity, one of
   * these two criteria could not hold.
   */
  it(
    "stores the printed digest for every one of the nine",
    async () => {
      const printed = new Map(printedDigests().map((b) => [b.slug, b.digest]));
      expect(printed.size).toBe(EXPECTED_BUNDLES);

      const { scratch } = await imported();
      const rows = await scratch.query(
        'select b.slug as slug, r.digest as digest, r.version as version ' +
          'from "release" r join "bundle" b on b.id = r.bundle_id order by b.slug',
      );
      expect(rows).toHaveLength(EXPECTED_BUNDLES);

      const wrong = rows
        .filter((r) => r.digest !== printed.get(String(r.slug)))
        .map((r) => `${String(r.slug)}: stored ${String(r.digest)}, printed ${printed.get(String(r.slug))}`);
      expect(wrong).toEqual([]);
    },
    SLOW,
  );

  it(
    "stores every release at the version D-250-03 fixed",
    async () => {
      const { scratch } = await imported();
      const rows = await scratch.query('select version from "release"');
      expect(rows.map((r) => r.version)).toEqual(Array(EXPECTED_BUNDLES).fill(SEED_VERSION));
      /* And not the spelling the fixtures use, which `parseSemver` refuses by name. */
      expect(rows.map((r) => String(r.version)).filter((v) => v.startsWith("v"))).toEqual([]);
    },
    SLOW,
  );
});
