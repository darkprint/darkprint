/* ============================================================
   T090 — the download event (B-14)

   "Each served file emits one download event (B-14, counted by
   T150). Not derived from request logs, which is T240's absolute
   constraint." Published at this suite's delivery as

       recordDownload(db, { kind, refId }): Promise<void>

   called by `serveFile` and `serveCard` exactly once each and NOT
   by `exportRelease`.

   ── why nothing here names a table ──
   The signature is published and the *medium* is not. A test
   asserting against `target` would be binding to a schema detail
   the contract does not state, and would red an implementation
   that recorded somewhere else for a reason it was entitled to —
   `lib/db/schema.ts` is Forbidden to this task, so where the event
   lands is not T090's to declare.

   So the medium is derived instead: snapshot every row of every
   table, call `recordDownload` once, and diff. Whatever moved IS
   the medium, by construction. The same diff then measures what
   each of the three published functions does, and neither side of
   the comparison is hand-written. Same instrument this run
   reached for when a blind author had no published wording to pin
   — derive both sides rather than curate either.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Actor } from "@/lib/server/policy";

import { PUBLISHED, loadExport, outcomeOf, requiredFn } from "./contract";
import {
  bundleBySlug,
  deriveDownloadCounter,
  downloadsFor,
  rowsAdded,
  scratchDatabase,
  seedAccount,
  seedRelease,
  snapshotRows,
  totalRowsAdded,
  type DownloadCounter,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const ANONYMOUS: Actor = { kind: "anonymous" };
const SUBJECT = "guarded-merge-bot";

let scratch: Scratch;
let owner: SeededAccount;
let release: SeededRelease;
let cardRef: string;

beforeAll(async () => {
  scratch = await scratchDatabase("downloads");
  owner = await seedAccount(scratch, "downloads");
  const entry = bundleBySlug(SUBJECT);
  release = await seedRelease(scratch, owner, entry);
  cardRef = entry.blueprint.nodes[0]?.ref as string;
}, 300_000);

/**
 * The counter is located lazily, inside whichever test asks for it first, and never in
 * `beforeAll`.
 *
 * Deriving it needs `recordDownload`, which is loaded through a dynamic import — so doing it in
 * the hook makes an absent module a HOOK failure, and a hook that fails runs no test: the file
 * then reports seven **skipped** behind one red instead of seven reds, which is the shape the
 * protocol asks a blind suite not to have. Measured, not assumed: in the hook this file printed
 * `75 failed | 3 passed | 7 skipped`; lazily it prints the seven.
 */
let derived: Promise<DownloadCounter> | undefined;

function downloadCounter(): Promise<DownloadCounter> {
  derived ??= (async () => {
    const mod = await loadExport();
    const recordDownload = requiredFn(mod, "recordDownload");
    return deriveDownloadCounter(
      scratch,
      (target) => Promise.resolve(recordDownload(scratch.db, target)) as Promise<unknown>,
      `t090-counter-probe-${process.pid}`,
    );
  })();
  return derived;
}

afterAll(async () => {
  if (scratch !== undefined) await scratch.drop();
}, 120_000);

/** What one call to the published `recordDownload` does to the database, whatever that is. */
async function deltaOf(run: () => Promise<unknown>): Promise<Map<string, string[]>> {
  const before = await snapshotRows(scratch);
  await run();
  const after = await snapshotRows(scratch);
  return rowsAdded(before, after);
}

function shapeOf(added: Map<string, string[]>): string {
  return [...added.entries()]
    .map(([table, rows]) => `${table}:${rows.length}`)
    .sort()
    .join(", ");
}

describe("the download event, measured through whatever medium recordDownload writes to", () => {
  it("writes something observable, which is what makes every test below able to fail", async () => {
    /*
     * The premise, checked first. If `recordDownload` were a no-op every assertion below would
     * pass vacuously — "a guard that cannot fail is worth less than no guard, because it reports
     * safety it never tested". This is that check, and it is also what derives the medium the
     * rest of the file measures in.
     */
    const mod = await loadExport();
    const recordDownload = requiredFn(mod, "recordDownload");
    const added = await deltaOf(() =>
      Promise.resolve(recordDownload(scratch.db, { kind: "blueprint", refId: release.bundleId })),
    );
    expect(
      totalRowsAdded(added),
      `A call to \`recordDownload\` changed no row in any table of this database, so nothing in ` +
        `this file could distinguish an implementation that records from one that does not.\n` +
        `  T090's contract: ${PUBLISHED.recordDownload}\n` +
        `  B-14 makes the event explicit rather than derived from request logs, which is T240's ` +
        `absolute constraint — so it has to land somewhere.`,
    ).toBeGreaterThan(0);
  }, 120_000);

  it("advances the count by exactly ONE per file serveFile serves, not by two and not by zero", async () => {
    /*
     * "Each served file emits one download event." Once — and counting *rows* cannot check that.
     * The event is an upsert onto a per-target row, so recording twice changes one row twice and
     * adds exactly one row either way; a row-delta instrument reports the same shape for one
     * event and for two. The defect the criterion exists to forbid would have been invisible to
     * the instrument built to check it, which is why the counter is derived (see `fixtures.ts`)
     * and read directly.
     *
     * The doubled case is not hypothetical: an implementation that records in `serveFile` and
     * again in a helper it shares with `serveCard` double-counts every download, and a registry
     * printing a number nobody measured is the failure this codebase's whole design guards
     * against.
     */
    const counter = await downloadCounter();
    const mod = await loadExport();
    const serveFile = requiredFn(mod, "serveFile");

    // "AGENTS.md" until the owner instructed the file out of every published bundle
    // (2026-08-25); the third path is a pinned card now, which every release carries
    // exactly as reliably and remains servable.
    for (const [n, path] of ["README.md", "topology.dot", `cards/${cardRef}.yaml`].entries()) {
      const before = await downloadsFor(scratch, counter, release.bundleId);
      await serveFile(
        scratch.db,
        ANONYMOUS,
        { ownerHandle: owner.handle, slug: SUBJECT, digest: release.digest },
        path,
      );
      const after = await downloadsFor(scratch, counter, release.bundleId);
      expect(
        after - before,
        `Serving \`${path}\` (serve ${n + 1} of 3) moved the download count by ` +
          `${after - before}, not by 1. \`${counter.table}.${counter.field}\` is the field this ` +
          `suite derived by driving \`recordDownload\` three times, not one it was told.`,
      ).toBe(1);
    }
  }, 120_000);

  it("advances the count by exactly ONE per card serveCard serves", async () => {
    const counter = await downloadCounter();
    const mod = await loadExport();
    const serveCard = requiredFn(mod, "serveCard");
    const bareCardId = cardRef.slice(0, cardRef.lastIndexOf("@"));

    for (const n of [1, 2]) {
      const before = await downloadsFor(scratch, counter, bareCardId);
      await serveCard(scratch.db, ANONYMOUS, cardRef);
      const after = await downloadsFor(scratch, counter, bareCardId);
      expect(
        after - before,
        `Serving \`${cardRef}\` (serve ${n} of 2) moved \`${bareCardId}\`'s count by ` +
          `${after - before}, not by 1.`,
      ).toBe(1);
    }
  }, 120_000);

  it("is NOT emitted by exportRelease", async () => {
    /*
     * Stated in the ruling in as many words, and it is the half that would otherwise be silently
     * wrong: `exportRelease` builds the whole folder, so an implementation that recorded there
     * would count one download per *file* on a call nobody downloaded, and `serveFile` — which
     * calls the same builder — would then count the folder once per file plus its own event.
     * A counter is a number a reader is asked to trust; this is the test that it counts serves.
     */
    const counter = await downloadCounter();
    const mod = await loadExport();
    const exportRelease = requiredFn(mod, "exportRelease");
    const countBefore = await downloadsFor(scratch, counter, release.bundleId);
    const added = await deltaOf(() =>
      Promise.resolve(exportRelease(scratch.db, ANONYMOUS, release.bundleId, release.digest)),
    );
    expect(
      await downloadsFor(scratch, counter, release.bundleId),
      "`exportRelease` moved the download count. It builds the folder that `serveFile` serves " +
        "from, so recording there counts one download per file on a call nobody downloaded — " +
        "and `serveFile` would then count the whole folder plus its own event.",
    ).toBe(countBefore);
    expect(
      shapeOf(added),
      `\`exportRelease\` wrote ${shapeOf(added)}. The ruling says it is called "by \`serveFile\` ` +
        `and \`serveCard\` exactly once each and **not** by \`exportRelease\`" — nobody downloaded ` +
        `anything by asking for the file list.`,
    ).toBe("");
  }, 120_000);

  it("carries the bundle id for a release file and the BARE card id for a card", async () => {
    /*
     * `refId` is "`bundle.id` for a release file and the bare `cardId` for a card". The bare id
     * is the discriminating half — B-10 says "Card counters aggregate per card id, not per
     * version", so recording `spec-planner@1.0.0` instead of `spec-planner` splits one card's
     * downloads across every version it ever had and no total is ever right again.
     *
     * Asserted over the rows the call actually added rather than by reading a column this suite
     * is not entitled to name: the versioned ref must appear nowhere in what was written, and the
     * bare id must appear somewhere.
     */
    const mod = await loadExport();
    const serveFile = requiredFn(mod, "serveFile");
    const serveCard = requiredFn(mod, "serveCard");
    const bareCardId = cardRef.slice(0, cardRef.lastIndexOf("@"));
    expect(bareCardId.length, `Could not split a bare id out of \`${cardRef}\``).toBeGreaterThan(0);

    const fromFile = await deltaOf(() =>
      Promise.resolve(
        serveFile(
          scratch.db,
          ANONYMOUS,
          { ownerHandle: owner.handle, slug: SUBJECT, digest: release.digest },
          // "AGENTS.md" until the owner instructed the file out of every published bundle
          // (2026-08-25); "README.md" is just as ordinary a release file for this check,
          // which is about the refId carried, not about which path was asked for.
          "README.md",
        ),
      ),
    );
    const fileText = [...fromFile.values()].flat().join("\n");
    expect(
      fileText,
      `The download event for a release file does not carry \`bundle.id\` (${release.bundleId}). ` +
        `It wrote: ${fileText || "(nothing)"}`,
    ).toContain(release.bundleId);

    const fromCard = await deltaOf(() =>
      Promise.resolve(serveCard(scratch.db, ANONYMOUS, cardRef)),
    );
    const cardText = [...fromCard.values()].flat().join("\n");
    expect(
      cardText,
      `The download event for a card does not carry the bare card id \`${bareCardId}\`.`,
    ).toContain(bareCardId);
    expect(
      cardText,
      `The download event for a card carries the versioned ref \`${cardRef}\`. B-10: "Card ` +
        `counters aggregate per card id, not per version" — a versioned refId splits one card's ` +
        `downloads across every version it ever had.`,
    ).not.toContain(cardRef);
  }, 120_000);

  it("is not emitted when nothing was served", async () => {
    /*
     * Entailed by "each served *file* emits one download event" rather than stated separately: a
     * refused path served no file and an absent release served no file, so neither is a download.
     * Both of D-90-01's two answers are exercised, because an implementation that recorded before
     * the membership check would count every probe of a path that does not exist — which is the
     * cheapest way there is to inflate a public counter.
     */
    const counter = await downloadCounter();
    const mod = await loadExport();
    const serveFile = requiredFn(mod, "serveFile");
    const serveCard = requiredFn(mod, "serveCard");

    const beforeRefusal = await downloadsFor(scratch, counter, release.bundleId);
    const refused = await deltaOf(async () => {
      await outcomeOf(() =>
        serveFile(
          scratch.db,
          ANONYMOUS,
          { ownerHandle: owner.handle, slug: SUBJECT, digest: release.digest },
          "no-such-file.txt",
        ),
      );
    });
    expect(
      shapeOf(refused),
      `A path outside the release wrote ${shapeOf(refused)}. Nothing was served, so nothing was ` +
        `downloaded — and a counter that moves on a refused path is one anybody can inflate.`,
    ).toBe("");
    expect(
      await downloadsFor(scratch, counter, release.bundleId),
      "A refused path moved the download count, which is the cheapest way there is to inflate a " +
        "public counter: no bytes leave the server and the number goes up.",
    ).toBe(beforeRefusal);

    const absent = await deltaOf(async () => {
      await outcomeOf(() =>
        serveFile(
          scratch.db,
          ANONYMOUS,
          { ownerHandle: "t090-no-such-handle", slug: SUBJECT, digest: release.digest },
          "README.md",
        ),
      );
      await outcomeOf(() => serveCard(scratch.db, ANONYMOUS, "t090-no-such-card@9.9.9"));
    });
    expect(
      shapeOf(absent),
      `An absent release and an absent card together wrote ${shapeOf(absent)}.`,
    ).toBe("");
  }, 120_000);

  it("does not deny the serve when recording fails", async () => {
    /*
     * D-90-02, ruled when `"serveFile: recording the download failed."` was struck: "a counter
     * write that fails must not deny a legitimate download. The serve succeeds, the failure is
     * audited through T240, and the count is lost. A counter outage taking downloads offline is a
     * worse product than an undercount."
     *
     * The failure is injected into the medium *derived* above rather than into a table named by
     * hand: whatever `recordDownload` writes to is renamed out from under it, so the write raises
     * an undefined-table error at the driver, through the path a caller really takes. Renamed
     * rather than dropped so foreign keys elsewhere do not decide the outcome instead.
     */
    await downloadCounter();
    const mod = await loadExport();
    const recordDownload = requiredFn(mod, "recordDownload");
    const serveFile = requiredFn(mod, "serveFile");

    const oneEvent = await deltaOf(() =>
      Promise.resolve(recordDownload(scratch.db, { kind: "blueprint", refId: release.bundleId })),
    );
    const media = [...oneEvent.keys()];
    expect(
      media.length,
      "No table moved, so there is nothing to break and this test could not discriminate.",
    ).toBeGreaterThan(0);

    for (const table of media) {
      await scratch.pool.query(`alter table "${table}" rename to "${table}_t090_hidden"`);
    }
    try {
      const outcome = await outcomeOf(() =>
        serveFile(
          scratch.db,
          ANONYMOUS,
          { ownerHandle: owner.handle, slug: SUBJECT, digest: release.digest },
          "topology.dot",
        ),
      );
      expect(
        outcome.kind,
        outcome.kind === "throw"
          ? `\`serveFile\` threw ${JSON.stringify(outcome.message)} because the download could ` +
            `not be recorded. D-90-02 struck exactly that: the serve succeeds and the count is ` +
            `lost, because a counter outage taking downloads offline is the worse product.`
          : "`serveFile` answered `undefined` for a file that exists, because recording failed.",
      ).toBe("value");
    } finally {
      for (const table of media) {
        await scratch.pool.query(`alter table "${table}_t090_hidden" rename to "${table}"`);
      }
    }
  }, 120_000);
});
