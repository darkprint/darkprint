/* ============================================================
   T090 — AC5, AC6 and AC7, through `serveFile` and `serveCard`

   One acceptance criterion named per test.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseCardRef } from "@/lib/core";
import type { Actor } from "@/lib/server/policy";
import { addCard } from "@/lib/server/cards";

import {
  ADMISSIBLE,
  EXPORT,
  PUBLISHED,
  describe as show,
  expectThrewExactly,
  loadExport,
  outcomeOf,
  requiredFn,
} from "./contract";
import {
  archive,
  bundleBySlug,
  scratchDatabase,
  seedAccount,
  seedOntology,
  seedRelease,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const ANONYMOUS: Actor = { kind: "anonymous" };

/** The bundle every test below serves from, chosen for pinning cards two other bundles also pin. */
const SUBJECT = "schema-forge-etl";

let scratch: Scratch;
let owner: SeededAccount;
let first: SeededRelease;
let second: SeededRelease;

/** A card no blueprint pins, minted for AC5 rather than borrowed from a bundle. */
const ORPHAN_REF = "t090-unpinned-card@3.1.4";

/** A private card owned by somebody else, for the half of AC5 that is about who may read it. */
const PRIVATE_REF = "t090-private-card@1.0.0";
let stranger: SeededAccount;

/** A second owner holding the same slug, for B-09. */
let rival: SeededAccount;
let rivals: SeededRelease;

beforeAll(async () => {
  scratch = await scratchDatabase("serve");
  await seedOntology(scratch.db);
  owner = await seedAccount(scratch, "serve");

  const entry = bundleBySlug(SUBJECT);
  first = await seedRelease(scratch, owner, entry);

  /* A newer release of the same bundle, differing only in a DOT comment. That one byte moves the
     bundle digest, which is printed in `README.md`, and it is also a byte difference in
     `topology.dot` itself — so two of the release's files differ between the two, which is what
     AC6 needs in order to be able to tell the old bytes from the new. */
  second = await seedRelease(scratch, owner, entry, {
    bundleId: first.bundleId,
    version: "2.0.0",
    dot: `${entry.bundle.dot}\n// a second release, byte-different from the first\n`,
  });

  /* A card the archive pins nowhere, so AC5's "naming no blueprint" is exhibited by a card that
     has no blueprint to be named by, as well as by one that has three. The body is a real card's
     with its identity rewritten, because `addCard` refuses a body whose `id`/`version` disagree
     with the top-level pair — a fixture built from an unrelated shape would fail at the store
     rather than reaching the criterion. */
  const orphan = parseCardRef(ORPHAN_REF);
  const donor = archive()[0]?.blueprint.nodes[0];
  if (orphan === undefined || donor === undefined) throw new Error("Could not mint the orphan card");
  await addCard(scratch.db, {
    cardId: orphan.id,
    version: orphan.version,
    ownerId: owner.accountId,
    visibility: "public",
    body: { ...donor.card, id: orphan.id, version: orphan.version },
    source: "# minted by tests/server/t090 for AC5; no blueprint pins it\n",
  });

  /* B-09: slugs are unique per owner, and `serveFile`'s address is `(ownerHandle, slug)`. A
     second owner holding the same slug is the only fixture on which an implementation that looks
     a bundle up by slug alone gives a different answer from one that carries the owner. Its DOT
     differs, so the two releases' bytes do. */
  rival = await seedAccount(scratch, "rival");
  rivals = await seedRelease(scratch, rival, entry, {
    dot: `${entry.bundle.dot}\n// the other owner's release of the same slug\n`,
  });

  /* A private card belonging to a second account. B-07 allows one, and a card address that
     resolves without consulting the actor hands its bytes to anybody who guesses the ref. */
  stranger = await seedAccount(scratch, "stranger");
  const secret = parseCardRef(PRIVATE_REF);
  if (secret === undefined) throw new Error("Could not mint the private card");
  await addCard(scratch.db, {
    cardId: secret.id,
    version: secret.version,
    ownerId: stranger.accountId,
    visibility: "private",
    body: { ...donor.card, id: secret.id, version: secret.version },
    source: "# minted by tests/server/t090; private, and only its owner may read it\n",
  });
}, 300_000);

/*
 * The explicit timeout is not decoration. `vitest.config.ts` raises `testTimeout` to 20s and
 * says why; it does not raise `hookTimeout`, which stays at vitest's 10s default — and dropping
 * a scratch database (close the pool, open an admin pool, `drop database … with (force)`) crosses
 * that under the parallel worktree load this repository runs at. When it does, the run reports
 * `Tests 75 passed (75)` with two FAILED FILES and exit 1, because a hook that fails runs no
 * test and adds nothing to the failed column. That is backend.md's "read the exit code and the
 * failed-file count, never the test total", arriving in this suite's own teardown; it was found
 * by the falsification harness refusing to measure against an unclean baseline.
 */
afterAll(async () => {
  if (scratch !== undefined) await scratch.drop();
}, 120_000);

interface Served {
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

async function callServeFile(
  ref: { ownerHandle: string; slug: string; version?: string; digest?: string },
  path: string,
): Promise<unknown> {
  const mod = await loadExport();
  return requiredFn(mod, "serveFile")(scratch.db, ANONYMOUS, ref, path);
}

async function callServeCard(cardRef: string, actor: Actor = ANONYMOUS): Promise<unknown> {
  const mod = await loadExport();
  return requiredFn(mod, "serveCard")(scratch.db, actor, cardRef);
}

/** Check the three published fields on a really-served file, and hand back a typed view. */
function asServedFile(value: unknown, what: string): Served {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${what} answered ${show(value)}.\n  backend.md §T090: ${PUBLISHED.ServedFile}`,
    );
  }
  const file = value as Record<string, unknown>;
  const keys = Object.keys(file).sort();
  if (typeof file.path !== "string") {
    throw new Error(`${what} carries no string \`path\`; it has [${keys.join(", ")}].`);
  }
  if (!(file.bytes instanceof Uint8Array)) {
    throw new Error(
      `${what} carries \`bytes\` as ${show(file.bytes)}.\n` +
        `  backend.md §T090 publishes \`bytes: Uint8Array\`. A string here would make the type ` +
        `wrong for the one thing a route does with it — write it to a response body as the ` +
        `file's own bytes, not as a JSON envelope (D-90-04).`,
    );
  }
  if (typeof file.contentType !== "string" || file.contentType === "") {
    throw new Error(`${what} carries \`contentType\` as ${show(file.contentType)}.`);
  }
  return { path: file.path, bytes: file.bytes, contentType: file.contentType };
}

const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

async function exportedTexts(release: SeededRelease): Promise<Map<string, string>> {
  const mod = await loadExport();
  const files = (await requiredFn(mod, "exportRelease")(
    scratch.db,
    ANONYMOUS,
    release.bundleId,
    release.digest,
  )) as readonly { path: string; text: string }[];
  return new Map(files.map((file) => [file.path, file.text]));
}

/* --------------------- the served file's shape --------------------- */

describe("ServedFile is the shape the contract publishes", () => {
  it("carries path, bytes and contentType, and the bytes are the export's own", async () => {
    /*
     * The cross-check between the two published functions, and the reason this is not a
     * tautology: `exportRelease` returns text and `serveFile` returns bytes, so an implementation
     * that generated the folder twice by two routes could disagree with itself here. It is the
     * one assertion that ties the two halves of the surface together.
     */
    const texts = await exportedTexts(first);
    // "factory.dot" and "AGENTS.md" until the owner instructed both out of every published
    // bundle (2026-08-25); the pinned card is just as real a file kind for this check, which
    // is about `serveFile` and `exportRelease` agreeing on bytes, not about which paths exist.
    const card = [...texts.keys()].find((p) => p.endsWith(".yaml"));
    expect(card, "the subject release pins no card, so there is nothing to widen this check with")
      .toBeDefined();
    for (const path of ["README.md", "topology.dot", card as string]) {
      const served = asServedFile(
        await callServeFile({ ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest }, path),
        `\`serveFile\` for \`${path}\``,
      );
      expect(served.path, "The served file reports a path other than the one asked for").toBe(path);
      expect(
        decode(served.bytes),
        `\`serveFile\` and \`exportRelease\` disagree about the bytes of \`${path}\` in one ` +
          `release. They are two views of one folder and there is nothing for them to differ over.`,
      ).toBe(texts.get(path));
    }
  }, 60_000);

  it("reports the same contentType for one path on two calls", async () => {
    const ref = { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest };
    const a = asServedFile(await callServeFile(ref, "README.md"), "`serveFile` first call");
    const b = asServedFile(await callServeFile(ref, "README.md"), "`serveFile` second call");
    expect(b.contentType).toBe(a.contentType);
  }, 60_000);

  it("gives the three file kinds three different content types", async () => {
    /*
     * Found by asking what a mutation *not* on this suite's list would do: an implementation
     * returning a constant `application/octet-stream` satisfies "a non-empty string" and
     * "the same on two calls", and D-90-04 says the body is "the file's bytes at its own content
     * type". A constant is not the file's own.
     *
     * Asserted as a property rather than as a table, because no content-type table is published
     * and inventing one would red every implementation that spelled `text/markdown` differently.
     * Three extensions, three answers — that much is entailed by "its own" and needs no wording.
     */
    const ref = { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest };
    const texts = await exportedTexts(first);
    const card = [...texts.keys()].find((p) => p.endsWith(".yaml"));
    expect(card, "The subject release pins no card, so the third extension has no witness")
      .toBeDefined();

    const types = new Map<string, string>();
    for (const path of ["README.md", "topology.dot", card as string]) {
      types.set(path, asServedFile(await callServeFile(ref, path), `\`serveFile\` for ${path}`).contentType);
    }
    expect(
      new Set(types.values()).size,
      `\`.md\`, \`.dot\` and \`.yaml\` came back under ${new Set(types.values()).size} content ` +
        `type(s): ${JSON.stringify([...types])}. A constant content type is not the file's own, ` +
        `and a reader curls all three to disk.`,
    ).toBe(3);
  }, 60_000);
});

/* --------------------- AC5 --------------------- */

describe("AC5 — a card URL resolves naming no blueprint", () => {
  /*
   * A shape assertion, and the shape is *independence*: the address a card resolves at must not
   * be a function of any blueprint, because `/nodes/[...id]` is about the card and printing some
   * blueprint that happens to pin it would name a thing the reader did not ask about and 404 the
   * day that blueprint leaves the archive (`bundle-export.ts`, `cardHref`).
   *
   * Two witnesses, because either alone is weak: a card three blueprints pin, whose address must
   * name none of them, and a card no blueprint pins at all, which must resolve regardless.
   */

  /** A ref pinned by more than one bundle, derived rather than named by hand. */
  function sharedRef(): string {
    const counts = new Map<string, Set<string>>();
    for (const entry of archive()) {
      for (const node of entry.blueprint.nodes) {
        const seen = counts.get(node.ref) ?? new Set<string>();
        seen.add(entry.slug);
        counts.set(node.ref, seen);
      }
    }
    const shared = [...counts.entries()]
      .filter(([, slugs]) => slugs.size > 1)
      .map(([ref]) => ref)
      .sort();
    const pinnedHere = new Set(bundleBySlug(SUBJECT).blueprint.nodes.map((n) => n.ref));
    const found = shared.find((ref) => pinnedHere.has(ref));
    if (found === undefined) {
      throw new Error(
        "No card pinned by this suite's seeded bundle is also pinned by another bundle, so the " +
          "'names none of the blueprints that pin it' half of AC5 has no witness.",
      );
    }
    return found;
  }

  it("resolves a card three blueprints pin, at an address naming none of them", async () => {
    const ref = sharedRef();
    /*
     * T-04's rule applied before the assertion rather than after: the tells are the nine slugs,
     * and a slug that happened to be a substring of the card's own address would red like a real
     * leak. Checked here, so the blacklist below is provably non-over-matching rather than
     * probably.
     */
    const slugs = archive().map((entry) => entry.slug);
    for (const slug of slugs) {
      expect(
        ref.includes(slug),
        `The card ref \`${ref}\` contains the slug \`${slug}\`, so the assertion below cannot ` +
          `distinguish an address that names a blueprint from one that does not.`,
      ).toBe(false);
    }

    const served = asServedFile(await callServeCard(ref), `\`serveCard\` for \`${ref}\``);
    for (const slug of slugs) {
      expect(
        served.path,
        `\`serveCard\` resolved \`${ref}\` at \`${served.path}\`, which names the blueprint ` +
          `\`${slug}\`. A card's address is the card's, not some pinning bundle's — the day that ` +
          `bundle leaves the archive the address would 404 for a card that is still published.`,
      ).not.toContain(slug);
    }
    expect(
      served.path,
      "The served path does not name the card version it resolved.",
    ).toContain(ref);
    expect(decode(served.bytes).length, "The card came back empty").toBeGreaterThan(0);
  }, 60_000);

  it("resolves a card no blueprint pins at all", async () => {
    /*
     * The witness that makes the criterion structural rather than incidental. A card address
     * derived from a bundle cannot answer here at all: there is no bundle to derive it from. An
     * implementation that resolves cards by walking releases fails this and nothing else.
     */
    const served = asServedFile(
      await callServeCard(ORPHAN_REF),
      `\`serveCard\` for the unpinned card \`${ORPHAN_REF}\``,
    );
    expect(served.path).toContain(ORPHAN_REF);
    expect(decode(served.bytes)).toContain("no blueprint pins it");
  }, 60_000);

  it("answers undefined for a private card the actor may not read, and serves it to its owner", async () => {
    /*
     * Also found by asking what a mutation not on this suite's list would do: `serveCard` that
     * ignores its `actor` passes every other test in this block, because every other card here is
     * public. B-07 allows a private card, and a card address is guessable — `id@version` is
     * printed on every blueprint page that pins it — so an unscoped read hands the bytes to
     * anyone who types the ref.
     *
     * The owner half is what keeps this from being satisfiable by refusing everything private,
     * and it is what makes the anonymous half a statement about the actor rather than about the
     * card.
     */
    const outcome = await outcomeOf(() => callServeCard(PRIVATE_REF));
    expect(
      outcome.kind,
      outcome.kind === "value"
        ? `\`serveCard\` served the private card \`${PRIVATE_REF}\` to an anonymous caller.`
        : `\`serveCard\` threw for a private card. B-03: a private resource the caller may not ` +
          `see is indistinguishable from one that does not exist, which is \`undefined\`.`,
    ).toBe("undefined");

    const asOwner: Actor = { kind: "account", accountId: stranger.accountId, handle: stranger.handle };
    const served = asServedFile(
      await callServeCard(PRIVATE_REF, asOwner),
      `\`serveCard\` for \`${PRIVATE_REF}\` as its owner`,
    );
    expect(decode(served.bytes)).toContain("only its owner may read it");
  }, 60_000);

  it("answers undefined for a card version that does not exist", async () => {
    /* D-90-01's `undefined` half: absent or invisible, deliberately indistinguishable, no
       message. B-03 — existence must not leak, including through a message. */
    const outcome = await outcomeOf(() => callServeCard("t090-no-such-card@9.9.9"));
    expect(
      outcome.kind,
      outcome.kind === "throw"
        ? `\`serveCard\` threw ${JSON.stringify(outcome.message)} for a card that does not ` +
          `exist. D-90-01 gives absence to \`undefined\`, without a message, because B-03 makes ` +
          `an absent resource and an invisible one indistinguishable.`
        : "`serveCard` returned a value for a card version nothing published.",
    ).toBe("undefined");
  }, 60_000);
});

/* --------------------- AC6 --------------------- */

describe("AC6 — fetching by digest returns the bytes of that release even after a newer one exists", () => {
  /*
   * The criterion that decays silently, and the reason the fixture above seeds two releases: a
   * test that fetches by digest with no newer release in the database asserts nothing about the
   * property. Every test here runs with `2.0.0` already published.
   */

  it("returns the first release's bytes for its digest after a second release exists", async () => {
    const before = asServedFile(
      await callServeFile(
        { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest },
        "README.md",
      ),
      "`serveFile` by the first release's digest",
    );
    const after = asServedFile(
      await callServeFile(
        { ownerHandle: owner.handle, slug: SUBJECT, digest: second.digest },
        "README.md",
      ),
      "`serveFile` by the second release's digest",
    );

    expect(
      first.digest,
      "The two seeded releases share a digest, so nothing below could tell them apart.",
    ).not.toBe(second.digest);
    expect(
      decode(before.bytes),
      "The two releases served identical `README.md` bytes, so this test cannot distinguish a " +
        "digest that addresses its own release from one that resolves to the latest.",
    ).not.toBe(decode(after.bytes));
    expect(
      decode(before.bytes),
      "Fetching by the first release's digest did not return the first release's bytes. AC6 is " +
        "the whole reason the digest path exists: a digest reference never moves.",
    ).toContain(first.digest);
  }, 60_000);

  it("resolves digest BEFORE version when a reference carries both", async () => {
    /*
     * backend.md §T090: "`serveFile` resolves `digest` **before** `version`, and a `version`
     * reference is a convenience that moves while a digest reference never does." A reference
     * carrying the first release's digest and the second's version is the only input on which
     * the two orderings give different answers, so it is the only one that tests the clause.
     */
    const served = asServedFile(
      await callServeFile(
        {
          ownerHandle: owner.handle,
          slug: SUBJECT,
          digest: first.digest,
          version: second.version,
        },
        "README.md",
      ),
      "`serveFile` with the first release's digest and the second release's version",
    );
    expect(
      decode(served.bytes),
      `A reference carrying digest ${first.digest} and version ${second.version} came back with ` +
        `the version's bytes. The digest is resolved first, and \`/mcp\` calls that distinction ` +
        `load-bearing.`,
    ).toContain(first.digest);
  }, 60_000);

  it("returns the same bytes for one digest after a B-08 RE-SCORE, not only after a newer release", async () => {
    /*
     * THE SHARPER OF AC6'S TWO CASES, and until the `TBD:` closed it was tested by nobody —
     * including by this suite, whose other AC6 tests all exercise the newer-release case.
     *
     * The newer-release case is the obvious reading of "even after a newer one exists" and it is
     * the weaker one, because a second release has a second digest: an implementation that
     * resolved a digest to its own row passes it without ever freezing anything. **A re-score
     * moves the bytes at an UNCHANGED digest**, which no amount of correct digest resolution
     * survives.
     *
     * The mechanism, measured by T090's adversary: `release.autonomy` and `release.security` are
     * columns on the row the digest names, B-08 re-scores them when an ontology version is
     * released, and `bundle-export.ts` quotes both verbatim into `README.md`. So one digest serves
     * different bytes over time, at the address `/mcp` calls load-bearing precisely because it
     * does not move.
     *
     * The re-score is performed here by writing the columns directly, because scoring is T040's
     * and B-08's and no verb for it is published to this task. That is the honest way to exhibit
     * the input: what AC6 constrains is the bytes a caller receives, not how the row came to be
     * re-scored.
     *
     * ── WHAT THIS CELL MEASURES NOW, and it is the freeze ──
     * **The fixture still persists nothing of its own.** It cannot: `persistArtefacts` is T100's
     * and no write verb is published to this suite. So the FIRST `serveFile` below is what
     * freezes these bytes — T091 made a miss generate from Postgres, hand the folder to
     * `persistArtefacts`, and serve what it froze — and the SECOND then reads that object and
     * never reaches the re-scored columns. The two calls straddling the re-score are the whole
     * instrument: what is asserted is that the second answers with the first's bytes.
     *
     * A red is therefore a defect in the serving path, and the failure message below says which
     * of the two links to look at first.
     *
     * ── HISTORY, kept because it is why the cell is worded this way ──
     * This cell was RED BY DESIGN for two rounds, on the T030-AC6-waiting-on-T025 precedent: a
     * named red with a stated dependency is worth more than a criterion nobody is measuring. It
     * was first said to clear at T100, and that was FALSE — persisting is necessary and not
     * sufficient, because `serveFile` called `buildExport` unconditionally and nothing in
     * `lib/server/export/**` consulted the artefact, so the frozen bytes were written and never
     * read. T091 built the READ half and the cell went green. Two sessions wrote comments here
     * to stop a later reader treating the missing persist call as an oversight and "fixing" the
     * test into vacuity; that warning still stands, and the assertion below is unchanged.
     */
    const before = asServedFile(
      await callServeFile(
        { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest },
        "README.md",
      ),
      "`serveFile` before the re-score",
    );

    /* Captured so the mutation below can be undone. See the restore after the assertion for
       why this cell may not leave the columns re-scored. */
    const original = await scratch.pool.query(
      `select autonomy, security from "release" where bundle_id = $1 and digest = $2`,
      [first.bundleId, first.digest],
    );
    expect(
      original.rowCount,
      "The release this cell re-scores was not found, so the restore below could not put it back.",
    ).toBe(1);

    /* A re-score that a reader would notice: the autonomy label and the security rationale are
       both quoted into README.md verbatim. Only the analysis columns move — the DOT, the card
       digests and therefore the release digest are all untouched. */
    const rescored = await scratch.pool.query(
      `update "release"
          set autonomy = $1::jsonb, security = $2::jsonb
        where bundle_id = $3 and digest = $4`,
      [
        JSON.stringify({
          label: "Human-gated",
          rationale: "re-scored under a later ontology (B-08)",
          contributions: [],
        }),
        JSON.stringify({
          level: 2,
          rationale: "re-scored under a later ontology (B-08)",
          findings: [],
        }),
        first.bundleId,
        first.digest,
      ],
    );
    expect(
      rescored.rowCount,
      "The re-score updated no row, so nothing below could distinguish a frozen artefact from a " +
        "regenerated one.",
    ).toBe(1);

    const after = asServedFile(
      await callServeFile(
        { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest },
        "README.md",
      ),
      "`serveFile` after the re-score",
    );

    expect(
      decode(after.bytes),
      `\`README.md\` at digest ${first.digest} changed after a B-08 re-score, with the digest ` +
        `unchanged. AC6 is "fetching by digest returns the bytes of THAT release": one digest ` +
        `must not serve two answers, and this is the case a newer release cannot exercise because ` +
        `a newer release has a newer digest.\n` +
        `  THIS IS NOW A DEFECT IN T091. It was the named dependency for as long as the READ ` +
        `half was unbuilt, and it has stopped being one: T091 made \`serveFile\` consult the ` +
        `frozen artefact, so a red here is this repository's code and not a task nobody had.\n` +
        `  Where to look, because the fixture above still freezes NOTHING of its own — it ` +
        `cannot, the write verb is another task's. The FIRST of the two calls is what freezes ` +
        `these bytes: on a miss \`serveFile\` generates from Postgres, hands what it generated ` +
        `to \`persistArtefacts\`, and serves it; the SECOND then has an object to read and ` +
        `never reaches the re-scored columns. So a red means one of those two links is broken ` +
        `— either the artefact is not read before \`buildExport\`, or a miss does not freeze ` +
        `what it generated — and one digest served two answers at the address \`/mcp\` calls ` +
        `load-bearing precisely because it does not move.`,
    ).toBe(decode(before.bytes));

    /*
     * PUT THE COLUMNS BACK, and it is not tidiness.
     *
     * This cell is the only one in the file that mutates a seeded release, and it used to leave
     * it mutated. Every later cell whose oracle is `exportRelease` then regenerated from
     * RE-SCORED columns while `serveFile` correctly served the FROZEN pre-re-score bytes, so the
     * two disagreed about `README.md` — the one file that quotes both scorecards. `:560` reddened
     * on exactly that, and the cause was here rather than there.
     *
     * The restore removes the mechanism instead of the symptom: moving one oracle earlier would
     * leave the leak armed for the next cell anybody adds, and reordering would make correctness
     * depend on declaration order.
     *
     * After the assertion rather than in a `finally`, so the assertion above is untouched. The
     * consequence is worth stating: if this cell fails, the columns stay re-scored and later
     * cells cascade. That is a red following a red, not a second defect.
     */
    await scratch.pool.query(
      `update "release" set autonomy = $1::jsonb, security = $2::jsonb
        where bundle_id = $3 and digest = $4`,
      [
        JSON.stringify(original.rows[0]?.autonomy),
        JSON.stringify(original.rows[0]?.security),
        first.bundleId,
        first.digest,
      ],
    );
  }, 120_000);

  it("serves every file of the older release, not only the ones that happen to differ", async () => {
    /*
     * The first test would pass against an implementation that special-cased `README.md`, and a
     * release is a folder rather than a file. Every path in the older export is fetched by the
     * older digest and compared to the older export's own bytes.
     */
    const texts = await exportedTexts(first);
    expect(texts.size, "The first release exported nothing").toBeGreaterThan(4);
    for (const [path, text] of texts) {
      const served = asServedFile(
        await callServeFile(
          { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest },
          path,
        ),
        `\`serveFile\` for \`${path}\` by the first release's digest`,
      );
      expect(
        decode(served.bytes),
        `\`${path}\` served under the first release's digest is not the first release's ` +
          `\`${path}\`, though a newer release exists.`,
      ).toBe(text);
    }
  }, 120_000);
});

/* --------------------- AC7 --------------------- */

describe("AC7 — a path outside the release is refused, not traversed", () => {
  const ref = () => ({ ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest });

  it("serves a path that IS in the release, so refusal is not the answer to everything", async () => {
    /* The control. Without it, "refuse every path" passes every other test in this block. */
    const served = asServedFile(await callServeFile(ref(), "README.md"), "`serveFile` for README.md");
    expect(served.path).toBe("README.md");
    expect(decode(served.bytes).length).toBeGreaterThan(0);
  }, 60_000);

  /*
   * The discriminating cases, and what makes them discriminating.
   *
   * backend.md §T090: "A test asserting `../../etc/passwd` is refused passes against a naive
   * `path.join` guard too; the discriminating test asserts the membership check by exhibiting a
   * path that normalises to a legal file and is still refused because it is not the string the
   * export produced."
   *
   * Every path below normalises — by `path.normalize`, by `path.join` onto a directory, or by a
   * case-insensitive filesystem — to a file the release really contains. A `path.join`-and-check
   * guard serves them all; a membership check against `bundleFilePaths` refuses all of them,
   * because none is the string `exportBundle` emitted.
   */
  const NORMALISES_TO_A_LEGAL_FILE: readonly [string, string][] = [
    ["./README.md", "a leading `./`, which normalises away"],
    [".//README.md", "a doubled separator, which collapses"],
    ["/README.md", "an absolute-looking path, which `join` reads as relative to the root"],
    ["cards/../README.md", "an up-segment that cancels a real directory of this release"],
    ["README.md/../README.md", "an up-segment through the target file itself"],
    ["ontology/../README.md", "an up-segment through a directory this release does not have"],
    ["README.MD", "a case variant, which a case-insensitive filesystem resolves"],
    [" README.md", "leading whitespace, which a `.trim()` before the lookup would eat"],
    ["README.md ", "trailing whitespace, the same"],
    ["README.md/", "a trailing separator, which `normalize` strips from a file path"],
  ];

  for (const [path, why] of NORMALISES_TO_A_LEGAL_FILE) {
    it(`refuses ${JSON.stringify(path)} — ${why} — though it normalises to README.md`, async () => {
      const outcome = await outcomeOf(() => callServeFile(ref(), path));
      expectThrewExactly(
        outcome,
        ADMISSIBLE.noSuchFile,
        `\`serveFile\` for ${JSON.stringify(path)}`,
      );
    }, 60_000);
  }

  it("refuses a card path that normalises into the release's own cards directory", async () => {
    /*
     * The same shape one level down, and the one that would still be reachable if the top-level
     * files were special-cased: `cards/` is a real directory of the release, so a path through it
     * is the case a directory-joining guard is most likely to get wrong.
     */
    const texts = await exportedTexts(first);
    const card = [...texts.keys()].find((p) => p.startsWith("cards/"));
    expect(card, "The subject release pins no cards, so this case has no witness").toBeDefined();
    const legal = card as string;
    const name = legal.slice("cards/".length);

    for (const path of [`cards/./${name}`, `cards/../cards/${name}`, `./cards/${name}`]) {
      const outcome = await outcomeOf(() => callServeFile(ref(), path));
      expectThrewExactly(
        outcome,
        ADMISSIBLE.noSuchFile,
        `\`serveFile\` for ${JSON.stringify(path)}, which normalises to ${JSON.stringify(legal)}`,
      );
    }
  }, 120_000);

  it("refuses ../../etc/passwd — the case that does NOT discriminate, kept and labelled", async () => {
    /*
     * Labelled rather than deleted, in the spirit of T-03: a weak test known to be weak is worth
     * having and the failure is the unlabelled one. This passes against a `path.join` guard, a
     * prefix check, a `..`-rejecting regex and a membership check alike, so it says nothing about
     * which of those is in place. It is here because a suite whose only traversal test is the
     * subtle one leaves the obvious attack unasserted.
     */
    for (const path of ["../../etc/passwd", "../../../etc/passwd", "..%2F..%2Fetc%2Fpasswd"]) {
      const outcome = await outcomeOf(() => callServeFile(ref(), path));
      expectThrewExactly(outcome, ADMISSIBLE.noSuchFile, `\`serveFile\` for ${JSON.stringify(path)}`);
    }
  }, 60_000);

  it("refuses a path that belongs to a DIFFERENT release of the same bundle", async () => {
    /*
     * Membership is in *this release's* file list, not in the bundle's. Both releases here happen
     * to carry the same names, so the witness is built rather than borrowed: a file the second
     * release would carry under a name the first does not. `bundleFilePaths` derives names from
     * the release's own pinned refs, so a guard scoped to the bundle serves this and a guard
     * scoped to the release refuses it.
     */
    const mine = await exportedTexts(first);
    const invented = "cards/t090-not-in-this-release@1.0.0.yaml";
    expect(mine.has(invented)).toBe(false);
    const outcome = await outcomeOf(() => callServeFile(ref(), invented));
    expectThrewExactly(outcome, ADMISSIBLE.noSuchFile, `\`serveFile\` for ${JSON.stringify(invented)}`);
  }, 60_000);

  it("carries the owner in the address, so two owners' releases of one slug never collide", async () => {
    /*
     * B-09: "Slugs are unique **per owner**", and `serveFile`'s published `ref` is
     * `{ ownerHandle, slug, … }` for exactly that reason. Two owners hold `schema-forge-etl`
     * here, with different DOT and therefore different bytes.
     *
     * The digest reference is the sharper of the two halves: a digest is content-addressed, so an
     * implementation that resolved a release by digest alone — without narrowing to this owner's
     * bundle first — would happily serve the other owner's release under this owner's handle. The
     * `undefined` case below is that assertion from the other side: this owner's handle with the
     * other owner's digest names nothing.
     */
    expect(rivals.digest, "The two owners' releases share a digest").not.toBe(first.digest);

    const mine = asServedFile(
      await callServeFile(
        { ownerHandle: owner.handle, slug: SUBJECT, digest: first.digest },
        "topology.dot",
      ),
      "`serveFile` under the first owner's handle",
    );
    const theirs = asServedFile(
      await callServeFile(
        { ownerHandle: rival.handle, slug: SUBJECT, digest: rivals.digest },
        "topology.dot",
      ),
      "`serveFile` under the second owner's handle",
    );
    expect(
      decode(theirs.bytes),
      `Two owners' releases of the slug \`${SUBJECT}\` served identical bytes. B-09 makes the ` +
        `slug unique per owner, and the owner is half the address.`,
    ).not.toBe(decode(mine.bytes));
    expect(decode(theirs.bytes)).toContain("the other owner's release of the same slug");

    const crossed = await outcomeOf(() =>
      callServeFile({ ownerHandle: owner.handle, slug: SUBJECT, digest: rivals.digest }, "README.md"),
    );
    expect(
      crossed.kind,
      crossed.kind === "value"
        ? `\`serveFile\` served the second owner's release under the first owner's handle. A ` +
          `digest is content-addressed and names a release across the whole table; the bundle ` +
          `has to be narrowed by \`(ownerHandle, slug)\` first.`
        : "",
    ).toBe("undefined");
  }, 60_000);

  it("answers undefined — not the file-list message — when the release itself is absent", async () => {
    /*
     * D-90-01's two answers, kept apart. Collapsing them loses the distinction the ruling exists
     * to draw: an absent or invisible release is `undefined` with no message (B-03), and a
     * resolved release with an unknown path is a throw. A suite that accepted either for both
     * would pass against an implementation that had merged them.
     */
    for (const bad of [
      { ownerHandle: "t090-no-such-handle", slug: SUBJECT, digest: first.digest },
      { ownerHandle: owner.handle, slug: "t090-no-such-slug", digest: first.digest },
      { ownerHandle: owner.handle, slug: SUBJECT, digest: `sha256:${"1".repeat(64)}` },
      { ownerHandle: owner.handle, slug: SUBJECT, version: "99.0.0" },
    ]) {
      const outcome = await outcomeOf(() => callServeFile(bad, "README.md"));
      expect(
        outcome.kind,
        outcome.kind === "throw"
          ? `\`serveFile\` threw ${JSON.stringify(outcome.message)} for ` +
            `${JSON.stringify(bad)}, where the release is what is missing. D-90-01: absence and ` +
            `invisibility answer \`undefined\` and carry no message, "deliberately ` +
            `indistinguishable"; ${JSON.stringify(ADMISSIBLE.noSuchFile)} belongs to the path.`
          : `\`serveFile\` served ${JSON.stringify(bad)}, which names no release.`,
      ).toBe("undefined");
    }
  }, 120_000);

  it("does not report what the release DOES contain", async () => {
    /*
     * The Admissible message forms clause: "The path the caller asked for is the caller's own
     * input and may be echoed; nothing about what the release *does* contain may be, since that
     * is a listing the caller has not been granted."
     *
     * Asserted as an exact match against the published literal rather than by scanning for
     * forbidden substrings, which is backend.md's own correction: "a whitelist asserted with a
     * blacklist test IS a blacklist". The published form is fixed and has no interpolation, so
     * pinning it exactly forbids every leak at once, including the ones nobody enumerated.
     */
    const outcome = await outcomeOf(() => callServeFile(ref(), "no-such-file.txt"));
    expectThrewExactly(outcome, ADMISSIBLE.noSuchFile, "`serveFile` for an unknown path");
    expect(
      outcome.message,
      "The refusal is longer than the published literal, so something was appended to it.",
    ).toHaveLength(ADMISSIBLE.noSuchFile.length);
  }, 60_000);
});

/* --------------------- the barrel, stated once --------------------- */

describe("the two serving functions come from the published barrel", () => {
  it("is reached at @/lib/server/export and nowhere deeper", async () => {
    const mod = await loadExport();
    expect(typeof requiredFn(mod, "serveFile")).toBe("function");
    expect(typeof requiredFn(mod, "serveCard")).toBe("function");
    expect(EXPORT).toBe("@/lib/server/export");
  });
});
