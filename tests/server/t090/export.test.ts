/* ============================================================
   T090 — AC1, AC2 and AC3, through `exportRelease`

   One acceptance criterion named per test.
   ============================================================ */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Actor } from "@/lib/server/policy";

import {
  ADMISSIBLE,
  RELEASE_FACT_FORMS,
  EXPORT,
  PUBLISHED,
  describe as show,
  expectThrewExactly,
  loadExport,
  outcomeOf,
  requiredFn,
} from "./contract";
import {
  VOCABULARY_MARKER,
  VOCABULARY_PATH,
  archive,
  bundleBySlug,
  diskFilePaths,
  perturbedVocabularyText,
  scratchDatabase,
  seedAccount,
  seedRelease,
  shippedSlugs,
  storedVocabulary,
  withLocalTerm,
  withoutLocalTerm,
  type Scratch,
  type SeededAccount,
  type SeededRelease,
} from "./fixtures";

const ANONYMOUS: Actor = { kind: "anonymous" };

let scratch: Scratch;
let owner: SeededAccount;
const seeded = new Map<string, SeededRelease>();

beforeAll(async () => {
  scratch = await scratchDatabase("export");
  owner = await seedAccount(scratch, "export");
  for (const entry of archive()) {
    seeded.set(entry.slug, await seedRelease(scratch, owner, entry));
  }
}, 300_000);

/*
 * The explicit timeout is not decoration. `vitest.config.ts` raises `testTimeout` to 20s and
 * says why; it does not raise `hookTimeout`, which stays at vitest's 10s default — and dropping
 * a scratch database (close the pool, open an admin pool, `drop database … with (force)`) crosses
 * that under the parallel worktree load this repository runs at. When it does, the run reports
 * `Tests 75 passed (75)` with two FAILED FILES and exit 1, because a hook that fails runs no
 * test and adds nothing to the failed column. That is the rule "read the exit code and the
 * failed-file count, never the test total", arriving in this suite's own teardown; it was found
 * by the falsification harness refusing to measure against an unclean baseline.
 */
afterAll(async () => {
  if (scratch !== undefined) await scratch.drop();
}, 120_000);

interface Exported {
  path: string;
  text: string;
}

async function exportFrom(
  db: unknown,
  bundleId: string,
  digest: string,
): Promise<readonly Exported[]> {
  const mod = await loadExport();
  const exportRelease = requiredFn(mod, "exportRelease");
  const files = await exportRelease(db, ANONYMOUS, bundleId, digest);
  if (!Array.isArray(files)) {
    throw new Error(
      `${EXPORT}'s \`exportRelease\` returned ${show(files)}.\n` +
        `  T090's contract: ${PUBLISHED.exportRelease}\n` +
        `  \`ExportedFile\` is \`lib/content/bundle-export.ts\`'s own — ` +
        `\`{ path: string; text: string }\` — and the contract says that module's decision is ` +
        `"consumed, never restated".`,
    );
  }
  return files as readonly Exported[];
}

function exportOf(release: SeededRelease): Promise<readonly Exported[]> {
  return exportFrom(scratch.db, release.bundleId, release.digest);
}

function textOf(files: readonly Exported[], path: string): string {
  const found = files.find((file) => file.path === path);
  if (found === undefined) {
    throw new Error(
      `The export carries no \`${path}\`. It carries: ${files.map((f) => f.path).join(", ")}.`,
    );
  }
  return found.text;
}

/* --------------------- AC1 --------------------- */

describe("AC1 — the file list equals what public/bundles/<slug>/ holds today, name for name", () => {
  /*
   * The oracle is the directory on disk, walked in `fixtures.ts`, and deliberately not
   * `bundleFilePaths`: the criterion names `public/bundles/<slug>/`, and deriving the expectation
   * from the module the implementation consumes would ask whether that module agrees with itself.
   *
   * `content/` and `public/bundles/` are the two halves of one shipped artefact —
   * `scripts/generate-bundles.ts` writes the second from the first — so seeding a release out of
   * `readContent()` and comparing against the folder is a comparison between what T090 does with
   * the archive and what the build already did with it.
   */
  for (const slug of shippedSlugs()) {
    it(`lists exactly the files public/bundles/${slug}/ holds`, async () => {
      const release = seeded.get(slug);
      expect(release, `No release seeded for \`${slug}\``).toBeDefined();
      const files = await exportOf(release as SeededRelease);
      expect(
        files.map((file) => file.path).sort(),
        `The export of \`${slug}\` and \`public/bundles/${slug}/\` disagree about which files a ` +
          `release contains. AC1 is "the file list for each of the nine bundles equals what ` +
          `\`public/bundles/<slug>/\` holds today, name for name".`,
      ).toEqual([...diskFilePaths(slug)]);
    }, 60_000);
  }

  it("covers all ten bundles the archive ships", () => {
    /* A guard on the loop above rather than on the implementation. If `public/bundles/` ever held
       three directories the ten `it`s would silently become three and AC1 would report green
       over a third of its domain — "the reachable set is the coverage claim". */
    expect(shippedSlugs().length).toBe(10);
    expect(archive().map((entry) => entry.slug).sort()).toEqual([...shippedSlugs()]);
  });
});

/* --------------------- AC2 --------------------- */

describe("AC2 — two exports of one release are byte-identical", () => {
  /*
   * T090's contract states in as many words why the naive form of this criterion cannot fail:
   * "Generation is pure and sorted upstream. So the criterion tests two calls through
   * `exportRelease`, and the way to fail it is to add anything time-, order- or
   * environment-dependent at this layer — a timestamp in `README.md`, a `Map` iterated by
   * insertion, a `Date` in a header."
   *
   * So each test below is aimed at one of those three, and says which.
   */

  it("is unchanged across a wall-clock second, which is what a timestamp would move", async () => {
    const release = seeded.get("starter-software-factory") as SeededRelease;
    const first = await exportOf(release);
    /* Long enough that a second-resolution stamp — an ISO string cut to seconds, a unix
       timestamp, a date on a run that straddles midnight — differs between the two calls.
       Without the wait, a timestamp at this layer produces identical bytes twice and the test
       reports a purity it never tested. */
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const second = await exportOf(release);

    expect(
      second.map((file) => file.path),
      "The two exports disagree about which files the release contains.",
    ).toEqual(first.map((file) => file.path));
    for (const [index, file] of first.entries()) {
      expect(
        second[index]?.text,
        `\`${file.path}\` differs between two exports of the same release taken 1.1s apart. AC2 ` +
          `is "two exports of one release are byte-identical", and the thing that breaks it at ` +
          `this layer is a clock.`,
      ).toBe(file.text);
    }
  }, 60_000);

  it("returns the files in the same ORDER, which is what an insertion-ordered map would move", async () => {
    /*
     * Order, not set equality. `exportBundle` sorts by path and returns an array; a layer that
     * collects those files into a `Map` keyed by path and hands back `[...map.values()]` returns
     * them in insertion order, and insertion order here is whatever order the cards came back
     * from Postgres in — a `select … where id = any($1)` with no `order by` is free to vary.
     *
     * An export of a different bundle is taken in between, so the two calls under comparison are
     * not back-to-back against a warm plan cache.
     */
    const subject = seeded.get("adversarial-consensus-line") as SeededRelease;
    const other = seeded.get("grounded-research-desk") as SeededRelease;

    const first = await exportOf(subject);
    await exportOf(other);
    const second = await exportOf(subject);

    expect(
      second.map((file) => `${file.path}\u0000${file.text}`),
      "Two exports of one release returned the same files in a different order. AC2 is about " +
        "the bytes a caller receives, and an array is ordered.",
    ).toEqual(first.map((file) => `${file.path}\u0000${file.text}`));
  }, 60_000);

  it("returns the files sorted by path, so this layer does not reorder what it received", async () => {
    /*
     * `bundle-export.ts` sorts, and the contract says its decision is consumed rather than
     * restated — so a served order that is not sorted is this layer having re-ordered it, which
     * is the only way this assertion can fail and therefore the only thing it tests.
     */
    const files = await exportOf(seeded.get("schema-forge-etl") as SeededRelease);
    const paths = files.map((file) => file.path);
    expect(
      paths,
      "The exported files are not in path order. `exportBundle` sorts them; anything else is " +
        "this layer re-ordering the list it was handed.",
    ).toEqual([...paths].sort());
  }, 60_000);

  it("is unchanged when read through a second database, which is what an environment read would move", async () => {
    /*
     * The third of the three. A second scratch database, seeded from the same archive by the same
     * code, holds a release with a different bundle id, a different owner id and different row
     * ctids, and the same content. Everything about the *environment* differs and nothing about
     * the *release* does, so any difference in the bytes came from outside the release.
     *
     * The equal digest is the check that the two really are one release: `addRelease` computes it
     * over the DOT and the card digests and nothing else.
     */
    const here = seeded.get("guarded-merge-bot") as SeededRelease;
    const elsewhere = await scratchDatabase("export_second");
    try {
      const otherOwner = await seedAccount(elsewhere, "export2");
      const there = await seedRelease(elsewhere, otherOwner, bundleBySlug("guarded-merge-bot"));
      expect(there.digest, "The same content stored twice produced two digests").toBe(here.digest);

      const mine = await exportOf(here);
      const theirs = await exportFrom(elsewhere.db, there.bundleId, there.digest);

      expect(
        theirs.map((file) => [file.path, file.text]),
        "One release exported from two databases produced different bytes. Nothing about the " +
          "release differs between them — the digests are equal — so the difference came from " +
          "the environment, which AC2 forbids at this layer.",
      ).toEqual(mine.map((file) => [file.path, file.text]));
    } finally {
      await elsewhere.drop();
    }
  }, 300_000);
});

/* --------------------- AC3 --------------------- */

describe("AC3 — extensions.yaml is served when and only when the bundle's cards declare a local term", () => {
  it("serves a bundle whose cards declare a local term WITH ontology/extensions.yaml", async () => {
    const entry = withLocalTerm();
    const files = await exportOf(seeded.get(entry.slug) as SeededRelease);
    expect(
      files.map((file) => file.path),
      `\`${entry.slug}\` declares a local term — \`public/bundles/${entry.slug}/` +
        `${VOCABULARY_PATH}\` exists on disk — and its export does not carry ` +
        `\`${VOCABULARY_PATH}\`. Without it the folder resolves against a vocabulary missing the ` +
        `term, the cards carrying it are rejected with it, and both scores the README quotes move.`,
    ).toContain(VOCABULARY_PATH);
  }, 60_000);

  it("serves a bundle whose cards declare no local term WITHOUT ontology/extensions.yaml", async () => {
    const entry = withoutLocalTerm();
    const files = await exportOf(seeded.get(entry.slug) as SeededRelease);
    expect(
      files.map((file) => file.path),
      `\`${entry.slug}\` declares no local term and its export carries \`${VOCABULARY_PATH}\` ` +
        `anyway. The pair matters more than either half: an implementation that always writes ` +
        `the file passes the first of these two tests and fails this one, which is why AC3 needs ` +
        `both fixtures.`,
    ).not.toContain(VOCABULARY_PATH);
  }, 60_000);

  it("splits the archive between the two cases rather than testing one twice", () => {
    /* The pair above discriminates only while the two fixtures really differ. If the archive ever
       carried a vocabulary for every bundle or for none, `withLocalTerm` and `withoutLocalTerm`
       would return the same entry and both tests above would pass against an implementation that
       always writes the file, or never does. */
    expect(withLocalTerm().slug).not.toBe(withoutLocalTerm().slug);
    expect(diskFilePaths(withLocalTerm().slug)).toContain(VOCABULARY_PATH);
    expect(diskFilePaths(withoutLocalTerm().slug)).not.toContain(VOCABULARY_PATH);
  });

  it("serves the stored vocabulary's bytes verbatim rather than re-emitting them from the terms", async () => {
    /*
     * D-90-03's half that was impossible to write before the ruling. `local_vocabulary` now
     * stores `{ text, terms }`, so the author's bytes exist to be served — and "verbatim" is only
     * checkable against a text that a re-emitter would not reproduce.
     *
     * The fixture is the shipped vocabulary with a marker comment at the top and its two
     * top-level keys in the other order. Neither is data: a YAML mapping is unordered and a
     * comment parses to nothing, so this is the same vocabulary spelled differently, and the two
     * readings — served from `text`, or re-serialised from `terms` — give different answers for
     * the first time.
     */
    const entry = withLocalTerm();
    const perturbed = perturbedVocabularyText();
    expect(
      perturbed,
      "The perturbation is a no-op against the shipped text, so this test could not discriminate.",
    ).not.toBe(storedVocabulary()?.text);

    const own = await scratchDatabase("export_verbatim");
    try {
      const account = await seedAccount(own, "verbatim");
      const release = await seedRelease(own, account, entry, { vocabularyText: perturbed });
      const files = await exportFrom(own.db, release.bundleId, release.digest);

      expect(
        textOf(files, VOCABULARY_PATH),
        `\`${VOCABULARY_PATH}\` came back with different bytes from the ones stored on the ` +
          `release. \`ExportedVocabulary.text\` is documented "the file, byte for byte, written ` +
          `into the bundle unaltered, like the cards", and D-90-03 put those bytes in ` +
          `\`local_vocabulary\` precisely so this layer would not have to re-emit them.`,
      ).toBe(perturbed);
      expect(
        textOf(files, VOCABULARY_PATH),
        "The marker comment did not survive, which is what a re-emission from the parsed terms " +
          "loses first.",
      ).toContain(VOCABULARY_MARKER);
    } finally {
      await own.drop();
    }
  }, 300_000);
});

/* --------------------- the refusals, pinned by exact match --------------------- */

describe("exportRelease refuses, with the message form the contract published", () => {
  /*
   * All seven forms are fixed literals with no interpolation, published before any implementation
   * existed — which is the one condition under which a message pin is a check rather than the
   * contract following the code. Every expected string below is written out in this file and none
   * is imported from the module under test.
   */

  it("throws `exportRelease: no such release.` for a digest that names no release", async () => {
    const release = seeded.get("incident-commander") as SeededRelease;
    const absent = `sha256:${"0".repeat(64)}`;
    const outcome = await outcomeOf(() =>
      exportFrom(scratch.db, release.bundleId, absent).then((files) => files),
    );
    expectThrewExactly(
      outcome,
      ADMISSIBLE.noSuchRelease,
      "`exportRelease` on a well-formed digest no release carries",
    );
  }, 60_000);

  it("exports a release into a database that has published no vocabulary at all", async () => {
    /*
     * The INVERSE of the cell that used to stand here, and it is the same fixture.
     *
     * That cell asserted `…the ontology version this release names is not published.`: a
     * release named an ontology version in its manifest, `openView` needed that version to be
     * a row, and a database holding the release but not the version — what a restore, a
     * partial import or a seed run in the wrong order produces — refused the export. There is
     * no version registry and no manifest declaration, so the same database now exports
     * normally, and asserting that is what stops the removal being invisible.
     */
    const own = await scratchDatabase("export_noontology");
    try {
      const account = await seedAccount(own, "noont");
      const release = await seedRelease(own, account, bundleBySlug("starter-software-factory"));
      const files = await exportFrom(own.db, release.bundleId, release.digest);
      expect(
        files.map((f) => f.path),
        "an unseeded vocabulary registry is no longer a fact about the release",
      ).toContain("README.md");
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("throws `…this release's stored vocabulary is not a term list.` for a vocabulary of the wrong shape", async () => {
    /*
     * D-90-03's fifth form. `local_vocabulary` is `jsonb` and T010 types it `unknown`, so nothing
     * between the writer and here constrains its shape — and the pre-ruling spelling, terms alone
     * with no `text`, is exactly the value a T100 written against the old contract would store.
     * That is the value used here rather than an invented one.
     */
    const own = await scratchDatabase("export_badvocab");
    try {
      const account = await seedAccount(own, "badvocab");
      const release = await seedRelease(own, account, withLocalTerm(), {
        rawVocabulary: storedVocabulary()?.terms,
      });
      const outcome = await outcomeOf(() => exportFrom(own.db, release.bundleId, release.digest));
      expectThrewExactly(
        outcome,
        ADMISSIBLE.vocabularyNotTerms,
        "`exportRelease` on a release whose `local_vocabulary` is terms without their text",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("throws `…a card this release pins is unavailable.` rather than serving a folder with a hole", async () => {
    /*
     * D-90-05. B-07 allows a private card and a public bundle may pin one, and `exportBundle`
     * throws when a pinned card is absent from its input — so the naive composition turns an
     * actor-scoped card read into a 500. The ruling is that the export is refused: serving the
     * private card's bytes inside a folder is still a response, and reading pinned cards on the
     * bundle's authority would leak one through any public bundle that pins it.
     *
     * The cards belong to a second account, so "the actor may not read them" is a property of the
     * actor rather than an artefact of the fixture owning everything.
     */
    const own = await scratchDatabase("export_privatecard");
    try {
      const account = await seedAccount(own, "pubowner");
      const cardOwner = await seedAccount(own, "cardowner");
      const release = await seedRelease(own, account, bundleBySlug("nightly-data-janitor"), {
        visibility: "public",
        cardVisibility: "private",
        cardOwner,
      });
      const outcome = await outcomeOf(() => exportFrom(own.db, release.bundleId, release.digest));
      expectThrewExactly(
        outcome,
        ADMISSIBLE.cardUnavailable,
        "`exportRelease` as an anonymous actor on a public bundle pinning private cards",
      );
    } finally {
      await own.drop();
    }
  }, 300_000);

  it("does not let a malformed bundleId reach Postgres as a raw driver error", async () => {
    /*
     * D-90-07 struck the inherited digest note and named the guard that is actually reachable
     * here: `bundleId` is caller input going into a `uuid` column, and without a shape check a
     * malformed one raises 22P02 as a `DrizzleQueryError` whose message opens with the whole
     * statement and every bound parameter.
     *
     * So this asserts the two things that separate a guarded edge from an unguarded one: the
     * refusal is one of the published forms, and nothing the caller sent comes back in it. The
     * tells are checked against the admissible forms before use, so this cannot be the over-match
     * T-04 records, where a blacklist string sat inside a fixture's own legal identifier.
     */
    const mod = await loadExport();
    const exportRelease = requiredFn(mod, "exportRelease");
    const release = seeded.get("incident-commander") as SeededRelease;
    const admissible: readonly string[] = Object.values(ADMISSIBLE);

    const malformed = [
      "not-a-uuid",
      "' or 1=1 --",
      `${release.bundleId}x`,
      "../../etc/passwd",
      "",
    ];

    for (const bundleId of malformed) {
      if (bundleId !== "") {
        expect(
          admissible.some((form) => form.includes(bundleId)),
          `The tell ${JSON.stringify(bundleId)} appears inside an admissible message form, so ` +
            `the assertion below would red a correct implementation.`,
        ).toBe(false);
      }
      const outcome = await outcomeOf(() =>
        exportRelease(scratch.db, ANONYMOUS, bundleId, release.digest),
      );
      if (outcome.kind === "value") {
        throw new Error(
          `\`exportRelease\` answered ${show(outcome.value)} for bundleId ` +
            `${JSON.stringify(bundleId)}, which is not a uuid and names no bundle.`,
        );
      }
      if (outcome.kind === "throw") {
        expect(
          admissible,
          `A malformed bundleId produced ${JSON.stringify(outcome.message)}, which is none of ` +
            `the seven published forms. D-90-07: without a uuid shape check "a malformed id ` +
            `raises 22P02 as a raw \`DrizzleQueryError\` quoting the statement".`,
        ).toContain(outcome.message);
        if (bundleId !== "") {
          expect(
            outcome.message,
            `The refusal quotes the caller's own \`bundleId\` back. Nothing derived from the ` +
              `driver error may reach an enumerable output, and the published forms are fixed ` +
              `literals with no interpolation.`,
          ).not.toContain(bundleId);
        }
      }
    }
  }, 120_000);

  it("keeps `serveFile: recording the download failed.` struck", () => {
    /*
     * D-90-02 struck it: "a counter write that fails must not deny a legitimate download. The
     * serve succeeds, the failure is audited through T240, and the count is lost." A ruling that
     * leaves no trace in a suite is a ruling nothing checks, so the struck form is named here and
     * asserted absent from the seven that stand.
     */
    const admissible: readonly string[] = Object.values(ADMISSIBLE);
    expect(admissible).not.toContain("serveFile: recording the download failed.");
    /* Six CALLER-OBSERVABLE forms, not six literals. The last — the driver-failure sibling —
       is rethrown by the route and never reaches a caller, so counting it here would assert a
       number about this file rather than about the surface.

       It was seven and eight. `ontologyUnpublished` is gone: a release's manifest named an
       ontology version, `openView` refused one nobody had published, and this form said so.
       There is no version registry and a manifest names no version, so the refusal has no
       condition left to report. */
    expect(RELEASE_FACT_FORMS).toHaveLength(6);
    expect(admissible).toHaveLength(7);
  });
});
