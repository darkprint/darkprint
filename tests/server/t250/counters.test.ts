/* ============================================================
   T250 — AC3 and AC5, and the reason they need a control

   "(3) no counted figure is written as a stored counter;
    (5) all imported counters read zero."

   D-250-10 is this suite's own finding, ratified: `getSignals`
   answers `{starCount: 0, downloadCount: 0, noteCount: 0,
   starredByCaller: false}` for a target WITH NO ROW AT ALL — it
   returns that literal before it reads anything. So "all imported
   counters read zero" passes against an empty database, against a
   module that imported nothing, and against no module at all.

   Every cell here therefore carries two things:
     (i)  a PREMISE that the import happened — the bundle is stored
          and its digest is the one the site prints;
     (ii) a CONTROL that drives `recordDownload` and `toggleStar`
          through T150's merged barrel and requires the reader to
          answer NON-ZERO, so the zero is a measurement rather than
          the reader's default.

   D-250-10 also ratified the reading of AC3: `target.star_count`,
   `download_count` and `note_count` exist, ruled and shipped by
   T150 and T170, so AC3 cannot mean "no counter column". It means
   the import must not write the SEEDED FIGURES into them. The
   figures are real and non-zero — `lib/data/community.ts` carries
   the 8,940 the contract names — and `oracle.test.ts` holds that
   axis, which is what stops a green here from being green because
   there was nothing to import in the first place.

   ── every reading below is CAPTURED during the setup ──
   The control mutates a counter. A cell that read the database
   after it ran would see the control's own write and report it as
   an imported figure. So the post-import readings are taken once,
   before any control fires, and the control cell does its own
   before/after inside itself.
   ============================================================ */

import { afterAll, describe, expect, it } from "vitest";

import { COMMUNITY } from "@/lib/data/community";

import {
  EXPECTED_BUNDLES,
  REGISTRY_HANDLE,
  bind,
  bundleSlugs,
  printedDigests,
  type Namespace,
  type Scratch,
} from "./contract";
import { closeDatabase, openDatabase, recorded, registryAccountId } from "./fixtures";

const SLOW = 180_000;

interface Reading {
  slug: string;
  bundleId: string;
  digest: string;
  signals: Record<string, unknown>;
}

/**
 * One import, then every reading this file needs, taken before any control fires.
 *
 * `getSignals` is bound from `@/lib/server/counters` — T150's merged barrel, a module neither
 * half of T250 wrote. Reading the counter through the module that owns it rather than through a
 * `select` is what makes AC5 a claim about what a caller sees.
 */
const measured = recorded("the seed import and its counter readings", async () => {
  const scratch: Scratch = await openDatabase();

  const planImport = await bind("planImport");
  const runImport = await bind("runImport");
  const plan = (await planImport()) as Namespace;
  const result = (await runImport(scratch.db, plan)) as Namespace;

  const { getSignals } = (await import("@/lib/server/counters")) as unknown as {
    getSignals: (db: unknown, actor: unknown, target: unknown) => Promise<Record<string, unknown>>;
  };

  const rows = await scratch.query('select id, slug from "bundle" order by slug');
  const readings: Reading[] = [];
  const printed = new Map(printedDigests().map((b) => [b.slug, b.digest]));
  for (const row of rows) {
    const bundleId = String(row.id);
    const slug = String(row.slug);
    readings.push({
      slug,
      bundleId,
      digest: printed.get(slug) ?? "",
      signals: await getSignals(scratch.db, { kind: "anonymous" }, {
        kind: "blueprint",
        refId: bundleId,
      }),
    });
  }

  /* The raw counter rows, captured for the same reason: the control below writes one. */
  const targetRows = await scratch.query(
    'select kind, ref_id, star_count, download_count, note_count from "target"',
  );

  return { scratch, result, readings, targetRows };
});

afterAll(async () => {
  await closeDatabase();
});

describe("the premise: the import actually happened", () => {
  it(
    "stored all nine bundles, each at the digest the site prints",
    async () => {
      const { scratch, readings } = await measured();
      expect(readings.map((r) => r.slug)).toEqual([...bundleSlugs()]);
      expect(readings).toHaveLength(EXPECTED_BUNDLES);

      /* Not just "nine rows exist": the digest ties each row to the archive, so a database
         seeded with nine empty bundles could not satisfy this. */
      const stored = await scratch.query(
        'select b.slug as slug, r.digest as digest from "release" r ' +
          'join "bundle" b on b.id = r.bundle_id',
      );
      const byslug = new Map(stored.map((r) => [String(r.slug), String(r.digest)]));
      const wrong = readings.filter((r) => byslug.get(r.slug) !== r.digest).map((r) => r.slug);
      expect(wrong).toEqual([]);
    },
    SLOW,
  );
});

describe("AC5: all imported counters read zero", () => {
  it.each(bundleSlugs())(
    "%s reads three zeros through T150's own reader",
    async (slug: string) => {
      const { readings } = await measured();
      const reading = readings.find((r) => r.slug === slug);
      expect(reading, `no reading was captured for "${slug}"`).toBeDefined();

      const signals = reading?.signals ?? {};
      /* `typeof === "number"`, not `toBe(0)` alone. The three columns are `numeric(12, 0)` and
         node-postgres has no default parser for `numeric`, so a column read straight through
         arrives as the STRING "0" — which `toBe(0)` catches and a truthiness check does not,
         while `toBeGreaterThanOrEqual(0)` admits it outright. */
      for (const key of ["starCount", "downloadCount", "noteCount"]) {
        expect(typeof signals[key], `${slug}.${key} is not a number`).toBe("number");
        expect(signals[key], `${slug}.${key}`).toBe(0);
      }
    },
    SLOW,
  );

  /**
   * THE CONTROL. Without it every cell above is satisfied by a database with nothing in it.
   *
   * One target, three readings: zero before, non-zero after a download, non-zero after a star.
   * A reader that returned its zero literal unconditionally reds here, and that is the only
   * thing that turns the nine greens above into measurements.
   */
  it(
    "and the reader can see a non-zero, so those zeros are measurements",
    async () => {
      const { scratch, readings } = await measured();
      const subject = readings[readings.length - 1];
      expect(subject, "no bundle was imported, so there is nothing to control against").toBeDefined();

      const counters = (await import("@/lib/server/counters")) as unknown as {
        getSignals: (db: unknown, a: unknown, t: unknown) => Promise<Record<string, unknown>>;
        recordDownload: (db: unknown, t: unknown) => Promise<void>;
        toggleStar: (db: unknown, a: unknown, t: unknown) => Promise<Record<string, unknown>>;
      };
      const target = { kind: "blueprint", refId: subject.bundleId };
      const anonymous = { kind: "anonymous" };

      const before = await counters.getSignals(scratch.db, anonymous, target);
      expect([before.starCount, before.downloadCount]).toEqual([0, 0]);

      await counters.recordDownload(scratch.db, target);
      const afterDownload = await counters.getSignals(scratch.db, anonymous, target);
      expect(afterDownload.downloadCount, "recordDownload moved nothing").toBe(1);

      const accountId = await registryAccountId(scratch);
      expect(accountId, `no account holds "${REGISTRY_HANDLE}"`).toBeDefined();
      await counters.toggleStar(scratch.db, { kind: "account", accountId, handle: REGISTRY_HANDLE }, target);
      const afterStar = await counters.getSignals(scratch.db, anonymous, target);
      expect(afterStar.starCount, "toggleStar moved nothing").toBe(1);

      /* And the download did not un-count itself when the star arrived: two independent columns,
         asserted together, because a single shared counter would satisfy each half alone. */
      expect([afterStar.starCount, afterStar.downloadCount]).toEqual([1, 1]);
    },
    SLOW,
  );
});

describe("AC3: no counted figure is written as a stored counter", () => {
  it(
    "leaves every stored counter column at zero, over every target row there is",
    async () => {
      const { targetRows } = await measured();
      /* Not "the table is empty". D-250-07 measured that the compose path writes no `target` row
         at all, but a zeroed row satisfies AC3 exactly as well, and forbidding it would red a
         correct implementation for a choice the criterion does not make. */
      const nonZero = targetRows
        .filter(
          (r) =>
            Number(r.star_count) !== 0 ||
            Number(r.download_count) !== 0 ||
            Number(r.note_count) !== 0,
        )
        .map((r) => `${String(r.kind)}:${String(r.ref_id)} = ` +
          `${String(r.star_count)}/${String(r.download_count)}/${String(r.note_count)}`);
      expect(nonZero).toEqual([]);
    },
    SLOW,
  );

  /**
   * The two numbers beside each other, which is the whole of AC3.
   *
   * The contract's reason, kept verbatim: "a registry printing 8,940 downloads nothing counted
   * is the failure the codebase's whole design guards against." So the cell states both halves —
   * the seeded figure exists and is large, and the stored counter for that same bundle is zero.
   * Either half alone is satisfied by an accident.
   */
  it.each(bundleSlugs().filter((slug) => COMMUNITY[slug] !== undefined))(
    "%s: the fixture seeds a non-zero download count and the registry counts nothing",
    async (slug: string) => {
      const seeded = COMMUNITY[slug];
      expect(typeof seeded.downloads).toBe("number");
      expect(seeded.downloads, `${slug} seeds no downloads, so this cell tests nothing`).toBeGreaterThan(0);

      const { readings } = await measured();
      const reading = readings.find((r) => r.slug === slug);
      expect(reading, `no reading was captured for "${slug}"`).toBeDefined();
      expect(reading?.signals.downloadCount).toBe(0);
      /* Excluding the bad output by name: the seeded figure must not be what the registry reports. */
      expect(reading?.signals.downloadCount).not.toBe(seeded.downloads);
    },
    SLOW,
  );
});
