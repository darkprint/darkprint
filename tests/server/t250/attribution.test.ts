/* ============================================================
   T250 — AC4, re-attribution

   "(4) every imported bundle is owned by the registry handle and no
   fictional account exists."

   D-250-11 bound the strong reading: the import creates NO `account`
   row for any of `hachi`, `k0bra`, `lupo`, `mara-veil`, `orin`,
   `sol-antczak`. Re-attribution moves ownership to the registry
   account and invents nobody, and a handle naming no account is the
   honest end state rather than a gap to be filled.

   D-250-04 fixed the account: handle `darkprint`, created by
   `upsertFromGitHub(db, { githubId: 0, githubLogin: "darkprint" })`,
   where `0` is a sentinel that cannot collide because GitHub ids
   start at 1.

   ── the control that keeps this from being satisfied by nothing ──
   "Every bundle owned by one account" is trivially true of a
   database with one bundle, and "no account for the six" is
   trivially true of a database with no accounts at all. Both are
   asserted against a premise that DISAGREES with them: the archive
   names six distinct authors across its nine bundles, so collapsing
   to one owner is a real change, and the import demonstrably ran.

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
  inventedAuthors,
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

describe("the control: the archive does not already look like the answer", () => {
  /**
   * Six distinct authors across nine bundles, read off the archive. Without this the ownership
   * cells below are satisfied by an input that was already single-authored, which is the
   * two-valued-criterion-asserted-against-one-actor shape: assert each value against a subject
   * whose default DISAGREES with it.
   */
  it("names six different authors across the nine bundles", () => {
    const authors = bundleSlugs().map((slug) => {
      const text = readFileSync(`${REPO_ROOT}content/blueprints/${slug}/blueprint.yaml`, "utf8");
      return /^author:\s*(\S+)\s*$/m.exec(text)?.[1] ?? "";
    });
    expect(authors).toHaveLength(EXPECTED_BUNDLES);
    expect(new Set(authors).size).toBeGreaterThan(1);
    expect(inventedAuthors()).toHaveLength(EXPECTED_AUTHORS);
    /* And none of them is the registry handle, so "owned by darkprint" cannot be true of the
       input before the import touches it. */
    expect(inventedAuthors()).not.toContain(REGISTRY_HANDLE);
  });
});

describe("AC4: one registry account, and nobody invented", () => {
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
   * D-250-11's strong reading, one cell per invented author so a red names which one appeared.
   *
   * Exact equality on the handle, never `like` and never a substring: D-250-13 recorded that a
   * substring match is how two distinct subjects collapse into one, and `lupo` sits inside the
   * overlay term id `lupo/pii-handling` that D-250-06 leaves in place.
   */
  it.each(inventedAuthors())(
    "creates no account for %s",
    async (author: string) => {
      const { scratch } = await imported();
      const rows = await scratch.query(
        'select id, handle from "account" where handle = $1 or github_login = $1',
        [author],
      );
      expect(
        rows,
        `an account exists for the invented author "${author}". D-250-11: re-attribution moves ` +
          "ownership to the registry account and invents nobody.",
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

describe("D-250-18: re-attribution moves OWNERSHIP, not AUTHORSHIP", () => {
  /**
   * The manifest keeps the handle the archive wrote, and it is a different claim from AC4.
   *
   * AC4 is about `bundle.owner_id` and says nothing about the manifest, which sits outside
   * `bundleDigest` and is therefore digest-neutral either way. D-250-18 rules the bytes are
   * kept: the registry did not write these blueprints, and a manifest saying it did would be a
   * false claim on the one surface that records who authored a thing.
   *
   * The control is the same one AC4 uses in reverse. The nine bundles name six DIFFERENT
   * authors, none of them the registry handle, so "the manifest kept its author" and "the
   * manifest was rewritten to darkprint" produce different answers on every row -- and both
   * halves are asserted, because "author is a non-empty string" would admit either.
   */
  it(
    "keeps each manifest's original author, and it is never the registry handle",
    async () => {
      const expected = new Map(
        bundleSlugs().map((slug) => [
          slug,
          /^author:\s*(\S+)\s*$/m.exec(
            readFileSync(`${REPO_ROOT}content/blueprints/${slug}/blueprint.yaml`, "utf8"),
          )?.[1],
        ]),
      );
      expect(new Set(expected.values()).size).toBe(EXPECTED_AUTHORS);
      expect([...expected.values()]).not.toContain(REGISTRY_HANDLE);

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

      /* And the bad output named explicitly: not one manifest may say the registry wrote it. */
      const claimed = rows
        .filter((r) => (r.manifest as { author?: unknown })?.author === REGISTRY_HANDLE)
        .map((r) => String(r.slug));
      expect(claimed).toEqual([]);
    },
    SLOW,
  );

  /**
   * D-250-22's third ground, which its implementer reached and the ruling did not have:
   * rewriting a stored `source` is the exact harm D-90-03 exists to prevent, and it would put
   * the store and `content/` permanently out of agreement.
   *
   * So the stored card bytes are compared to the file on disk BYTE FOR BYTE. A card's `author:`
   * line is inside those bytes, which is what makes this the same ruling one field over.
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

      /* The discriminating half: those bytes really do carry an invented author, so a store
         that agreed with `content/` only because both had been rewritten is excluded. */
      const authors = new Set(
        rows.map((r) => /^author:\s*(\S+)\s*$/m.exec(String(r.source))?.[1]).filter(Boolean),
      );
      expect(authors.size).toBe(EXPECTED_AUTHORS);
      expect([...authors]).not.toContain(REGISTRY_HANDLE);
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
