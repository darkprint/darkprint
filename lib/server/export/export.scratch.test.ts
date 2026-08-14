/**
 * Scratch coverage against a real database, run by the implementer only —
 * does not count as verification (docs/ORCHESTRATION.md, Agent A). One or
 * more cases per acceptance criterion in backend.md's T090 section, plus the
 * rulings D-90-01 through D-90-07 settled.
 *
 * The fixture is the **real archive**: `readContent()`'s nine bundles, their
 * cards and their vocabulary, written into a scratch database through T010's
 * and T020's own published writers and then read back out through this
 * module. That is what makes AC1 an assertion about the export rather than
 * about a fixture somebody wrote to match it — the expected file lists are
 * the directories `npm run prebuild` put under `public/bundles/`.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as YAML from "yaml";
import { CORE_ONTOLOGY, cardRef, lintAttractor, parseDot, type CardRef, type NodeCard } from "@/lib/core";
import { contentVocabulary, readContent } from "@/lib/content/read";
import { BUNDLE_VOCABULARY, FACTORY_DOT, cardFilePath } from "@/lib/content/bundle-export";
import { schema, type Db, type DbClient } from "@/lib/db";
import { addRelease, createBundle } from "@/lib/server/archive";
import { addCard } from "@/lib/server/cards";
import { addOntologyVersion } from "@/lib/server/ontology";
import type { Actor } from "@/lib/server/policy";
import { and, eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "../../../tests/support/db";
import { exportRelease, serveCard, serveFile } from "./index";

const hasDb = Boolean(process.env.DATABASE_URL);

const ANONYMOUS: Actor = { kind: "anonymous" };

/** Every file under one of `public/bundles/<slug>/`, bundle-relative, forward slashes. */
function filesOnDisk(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else out.push(relative(dir, path).split(/[\\/]/).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

describe.skipIf(!hasDb)("lib/server/export", () => {
  /* `| undefined` is the honest type: `beforeAll` can fail before assigning it. */
  let testDb: TestDb | undefined;
  let client: DbClient;
  let db: Db;
  let ownerId: string;
  let owner: Actor;
  /** Slug -> the ids the tests address a release by. */
  const seeded = new Map<string, { bundleId: string; digest: string; version: string }>();

  beforeAll(async () => {
    testDb = await createTestDb();
    client = testDb.client;
    db = client.db;

    const [account] = await db
      .insert(schema.account)
      .values({ githubId: "t090-fixture", githubLogin: "t090-fixture", handle: "exporter" })
      .returning();
    ownerId = account.id;
    owner = { kind: "account", accountId: ownerId, handle: "exporter" };

    const loaded = readContent();
    const vocabulary = contentVocabulary();

    /* Every ontology version any manifest names. The archive resolves against the core, so
       in practice this is one row — derived rather than assumed, so a manifest that names
       another version seeds it instead of failing on a lookup nobody would attribute. */
    for (const version of new Set(loaded.map((entry) => entry.bundle.manifest.ontologyVersion))) {
      await addOntologyVersion(db, { version, terms: CORE_ONTOLOGY.terms });
    }

    /* Cards first, globally, sorted by (id, version): one card version can be pinned by two
       blueprints and is one published document either way, and `addCard` checks a declared
       bump against the previous version of the same id, so they have to go in ascending
       order rather than in whatever order the bundles happen to pin them. */
    const cards = new Map<CardRef, { body: NodeCard; source: string }>();
    for (const entry of loaded) {
      for (const file of entry.cardFiles) {
        const ref = file.file.replace(/^cards\//, "").replace(/\.yaml$/, "") as CardRef;
        const body = entry.blueprint.cards.get(ref);
        if (body === undefined) continue;
        cards.set(ref, { body, source: file.text });
      }
    }
    for (const [ref, card] of [...cards].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      void ref;
      await addCard(db, {
        cardId: card.body.id,
        version: card.body.version,
        ownerId,
        body: card.body,
        source: card.source,
      });
    }

    for (const entry of loaded) {
      const bundle = await createBundle(db, { ownerId, slug: entry.slug, visibility: "public" });
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
      seeded.set(entry.slug, {
        bundleId: bundle.id,
        digest: release.digest,
        version: release.version,
      });
    }
  }, 120_000);

  afterAll(async () => {
    /* Optional-call, not `testDb.drop()`: when `beforeAll` fails, `testDb` was never
       assigned and an unguarded deref throws out of the teardown, burying the real cause. */
    await testDb?.drop();
  });

  function ref(slug: string) {
    return { ownerHandle: "exporter", slug };
  }

  /* --------------------- AC1 --------------------- */

  it("AC1: each bundle's file list equals what public/bundles/<slug>/ holds, name for name", async () => {
    expect(seeded.size).toBe(9);
    for (const [slug, ids] of seeded) {
      const files = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
      expect(files.map((file) => file.path).sort(), slug).toEqual(
        filesOnDisk(join(process.cwd(), "public", "bundles", slug)),
      );
    }
  });

  /* --------------------- AC2 --------------------- */

  it("AC2: two exports of one release are byte-identical", async () => {
    for (const [slug, ids] of seeded) {
      const first = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
      const second = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
      /* Compared as the whole ordered list of (path, text), not as a set of paths: the
         criterion is about the bytes, and a re-ordering is exactly the failure a path-set
         comparison cannot see. */
      expect(JSON.stringify(second), slug).toBe(JSON.stringify(first));
    }
  });

  /* --------------------- AC3 --------------------- */

  it("AC3: a bundle with no local term is served without extensions.yaml, one with a local term with it", async () => {
    const withTerm = seeded.get("frontline-triage");
    const withoutTerm = seeded.get("starter-software-factory");
    expect(withTerm).toBeDefined();
    expect(withoutTerm).toBeDefined();

    const withFiles = await exportRelease(db, ANONYMOUS, withTerm!.bundleId, withTerm!.digest);
    const withoutFiles = await exportRelease(db, ANONYMOUS, withoutTerm!.bundleId, withoutTerm!.digest);

    expect(withFiles.map((f) => f.path)).toContain(BUNDLE_VOCABULARY);
    expect(withoutFiles.map((f) => f.path)).not.toContain(BUNDLE_VOCABULARY);
  });

  it("AC3: the served extensions.yaml is the stored bytes verbatim, not a re-emission (D-90-03)", async () => {
    const ids = seeded.get("frontline-triage")!;
    const files = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
    const vocabulary = files.find((file) => file.path === BUNDLE_VOCABULARY);
    expect(vocabulary?.text).toBe(contentVocabulary()?.text);
  });

  it("AC3: a release whose stored vocabulary is the pre-amendment bare term array is refused", async () => {
    const ids = seeded.get("frontline-triage")!;
    /* The shape T100 wrote before D-90-03: terms, no bytes. Written straight to the column,
       because `addRelease` types it `unknown` and the point is what a stored row can hold. */
    await db
      .update(schema.release)
      .set({ localVocabulary: contentVocabulary()!.terms })
      .where(and(eq(schema.release.bundleId, ids.bundleId), eq(schema.release.digest, ids.digest)));

    await expect(exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest)).rejects.toThrow(
      "exportRelease: this release's stored vocabulary is not a term list.",
    );

    await db
      .update(schema.release)
      .set({ localVocabulary: { text: contentVocabulary()!.text, terms: contentVocabulary()!.terms } })
      .where(and(eq(schema.release.bundleId, ids.bundleId), eq(schema.release.digest, ids.digest)));
  });

  /* --------------------- AC4 --------------------- */

  it("AC4: every served factory.dot parses and lints as Attractor input", async () => {
    for (const slug of seeded.keys()) {
      const served = await serveFile(db, ANONYMOUS, ref(slug), FACTORY_DOT);
      expect(served, slug).toBeDefined();
      const text = new TextDecoder().decode(served!.bytes);
      const parsed = parseDot(text, FACTORY_DOT);
      expect(parsed.graph, slug).toBeDefined();
      expect(lintAttractor(parsed.graph!, text, FACTORY_DOT), slug).toEqual([]);
    }
  });

  /**
   * AC4's discriminating case: a release that **resolves cleanly** and whose emitted
   * `factory.dot` **does not parse**. Anything that breaks the source DOT is caught by
   * `resolveBundle` first and never reaches this check, so a test built on one asserts
   * `releaseDoesNotResolve` under AC4's name — which is what the first version of this
   * test did, and it passed.
   *
   * The wedge is `emitAttractorDot`'s `max_retries`, the one attribute value it writes
   * **unquoted**: `String(readIterationCap(card.params))`. `readIterationCap` admits any
   * non-negative integer, and `Number.isInteger(1e21)` is `true` while `String(1e21)` is
   * `"1e+21"` — not a DOT numeral. The card validates, the blueprint resolves, the graph
   * is fine, and the emitted file dies on `Expected \`=\` after the attribute \`e\`,
   * found \`+\``.
   *
   * That is a defect in `lib/core/attractor/emit.ts`, which is Forbidden to this task —
   * reported, not fixed. It is exactly what AC4 says this check exists for: something
   * upstream lets through, arriving at the serving edge.
   */
  it("AC4: a release that resolves but emits unparseable Attractor input is refused, not served", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "starter-software-factory")!;
    const ids = seeded.get(entry.slug)!;
    const pinned = entry.blueprint.nodes[0].ref;
    const [cardId, version] = pinned.split("@");
    const [card] = await db
      .select()
      .from(schema.cardVersion)
      .where(and(eq(schema.cardVersion.cardId, cardId), eq(schema.cardVersion.version, version)));
    const originalSource = card.source;

    /* `source`, not `body`: `buildExport` hands the archived YAML to `loadBundle`, which
       parses it — so a card mutated in the `jsonb` column would change nothing here, and a
       test that mutated it would report "served" for a reason that is not the module's.
       Written out in full digits because YAML 1.2 resolves `1e23` as a string; twenty-four
       digits resolve as the number, `Number.isInteger` accepts it, and `String` renders it
       `1e+23`. */
    const doc = YAML.parse(originalSource) as Record<string, unknown>;
    doc.params = { ...((doc.params as object | undefined) ?? {}), max_iterations: 1e23 };
    await db
      .update(schema.cardVersion)
      .set({ source: YAML.stringify(doc) })
      .where(eq(schema.cardVersion.id, card.id));

    /* Pinned to the exact refusal rather than to "it threw something": a mutation that
       makes the release stop resolving would satisfy `not.toBe("served")` while never
       reaching AC4's check at all, which is a tolerance admitting the wrong answer. */
    const outcome = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest).then(
      () => "served",
      (err: Error) => err.message,
    );
    expect(outcome).toBe("exportRelease: the emitted factory.dot is not valid Attractor input.");

    await db
      .update(schema.cardVersion)
      .set({ source: originalSource })
      .where(eq(schema.cardVersion.id, card.id));
  });

  /**
   * The half of AC4 the contract named at the blind suite's delivery, and my suite had
   * nothing for it. A release whose `cardRefs` omit a card its DOT pins **stores fine** —
   * T010's parity check compares `cardRefs` against `cardDigests` and both lose an entry
   * together — resolution then degrades by dropping that node, and `exportBundle` does not
   * throw. Without a refusal the caller gets a complete-looking folder, one card short,
   * whose `factory.dot` is missing a node.
   *
   * The refusal is `hasErrors(loaded.diagnostics)`, not a check on the arrays: the arrays
   * are consistent, and what is wrong is that the graph pins something the release does
   * not carry, which is a fact only resolution knows.
   */
  it("AC4: a release whose cardRefs omit a pinned card is refused, not served one card short", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "nightly-data-janitor")!;
    const ids = seeded.get(entry.slug)!;
    const [row] = await db
      .select()
      .from(schema.release)
      .where(and(eq(schema.release.bundleId, ids.bundleId), eq(schema.release.digest, ids.digest)));
    const originalRefs = row.cardRefs;
    const originalDigests = row.cardDigests;

    /* Both arrays lose the same entry, so the pair stays aligned and nothing upstream has
       a reason to complain. */
    const dropped = originalRefs[0];
    const keptRefs = originalRefs.filter((candidate) => candidate !== dropped);
    const keptDigests = originalDigests.filter((_, i) => originalRefs[i] !== dropped);
    expect(keptRefs.length).toBeLessThan(originalRefs.length);
    expect(keptRefs.length).toBe(keptDigests.length);

    await db
      .update(schema.release)
      .set({ cardRefs: keptRefs, cardDigests: keptDigests })
      .where(eq(schema.release.id, row.id));

    const outcome = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest).then(
      (files) => `served ${files.length} files`,
      (err: Error) => err.message,
    );
    expect(outcome).toBe("exportRelease: this release does not resolve.");

    await db
      .update(schema.release)
      .set({ cardRefs: originalRefs, cardDigests: originalDigests })
      .where(eq(schema.release.id, row.id));
  });

  /* --------------------- AC5 --------------------- */

  it("AC5: a card resolves at an address naming no blueprint", async () => {
    const entry = readContent()[0];
    const pinned = entry.blueprint.nodes[0].ref;
    const served = await serveCard(db, ANONYMOUS, pinned);

    expect(served).toBeDefined();
    expect(served!.path).toBe(cardFilePath(pinned));
    for (const slug of seeded.keys()) expect(served!.path).not.toContain(slug);
    expect(served!.contentType).toBe("application/yaml; charset=utf-8");

    /* The same bytes the folder carries, not a second document. */
    const ids = seeded.get(entry.slug)!;
    const files = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
    const inFolder = files.find((file) => file.path === cardFilePath(pinned));
    expect(new TextDecoder().decode(served!.bytes)).toBe(inFolder?.text);
  });

  it("AC5: an unparseable ref and an unknown card both answer undefined", async () => {
    expect(await serveCard(db, ANONYMOUS, "no-version" as CardRef)).toBeUndefined();
    expect(await serveCard(db, ANONYMOUS, "nothing-here@9.9.9" as CardRef)).toBeUndefined();
  });

  /**
   * Found by mutation, not by design: building `path` from the caller's spelling instead
   * of from the stored row reddened nothing, while `serve-card.ts` carried a comment
   * claiming it mattered. `parseCardRef` trims, so a padded ref resolves to the same row
   * and would otherwise put its padding into a filename — and that filename is what the
   * route puts in `content-disposition` and what `curl -O` writes to disk.
   */
  it("AC5: the served path is the archive's canonical ref, not the caller's spelling", async () => {
    const entry = readContent()[0];
    const pinned = entry.blueprint.nodes[0].ref;
    const padded = await serveCard(db, ANONYMOUS, `  ${pinned}  ` as CardRef);

    expect(padded).toBeDefined();
    expect(padded!.path).toBe(cardFilePath(pinned));
    expect(padded!.path).not.toContain(" ");
  });

  /* --------------------- AC6 --------------------- */

  it("AC6: fetching by digest returns that release's bytes after a newer one exists", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "guarded-merge-bot")!;
    const ids = seeded.get(entry.slug)!;
    const before = await serveFile(db, ANONYMOUS, { ...ref(entry.slug), digest: ids.digest }, "blueprint.dot");
    expect(before).toBeDefined();
    const originalDot = new TextDecoder().decode(before!.bytes);

    /* A second release of the same bundle, with a different DOT and therefore a different
       digest. `// changed` is a DOT comment, so the graph is identical and only the bytes
       and the identity move — which is the whole point: the two releases differ by exactly
       what a digest addresses. */
    const newer = await addRelease(db, {
      bundleId: ids.bundleId,
      version: "2.0.0",
      dot: `${entry.bundle.dot}\n// changed\n`,
      manifest: entry.bundle.manifest,
      cardRefs: entry.blueprint.nodes.map((node) => node.ref),
      cardDigests: entry.blueprint.nodes.map((node) => node.digest),
      analysis: {
        autonomy: entry.analysis.autonomy,
        security: entry.analysis.security,
        phaseCoverage: entry.analysis.phaseCoverage,
      },
    });
    expect(newer.digest).not.toBe(ids.digest);

    const byOldDigest = await serveFile(db, ANONYMOUS, { ...ref(entry.slug), digest: ids.digest }, "blueprint.dot");
    expect(new TextDecoder().decode(byOldDigest!.bytes)).toBe(originalDot);

    const byNewDigest = await serveFile(db, ANONYMOUS, { ...ref(entry.slug), digest: newer.digest }, "blueprint.dot");
    expect(new TextDecoder().decode(byNewDigest!.bytes)).toBe(`${entry.bundle.dot}\n// changed\n`);

    /* And the version reference moved while the digest reference did not, which is the
       distinction the criterion is about rather than a second way of asking the same thing. */
    const byNoRef = await serveFile(db, ANONYMOUS, ref(entry.slug), "blueprint.dot");
    expect(new TextDecoder().decode(byNoRef!.bytes)).toBe(`${entry.bundle.dot}\n// changed\n`);
    const byOldVersion = await serveFile(db, ANONYMOUS, { ...ref(entry.slug), version: "1.0.0" }, "blueprint.dot");
    expect(new TextDecoder().decode(byOldVersion!.bytes)).toBe(originalDot);
  });

  /**
   * Also found by mutation. The test above creates `2.0.0` after `1.0.0`, so "last row
   * written" and "highest semver" agree and a `createdAt`-ordered implementation passes
   * it — the same gap T080 charged as D-80-03 against `listReleases`. The discriminating
   * case is a **lower** semver written last, which is what a backported fix on an older
   * line looks like, and it must not become "current" by being newest.
   */
  it("AC6: no version and no digest means the highest semver, not the last row written", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "checkpoint-resume-runner")!;
    const ids = seeded.get(entry.slug)!;

    /* `1.0.0` is already stored. Add `2.0.0`, then `1.0.1` — so the newest row is the
       lowest of the three and the two orderings disagree. */
    const high = await addRelease(db, {
      bundleId: ids.bundleId,
      version: "2.0.0",
      dot: `${entry.bundle.dot}\n// high\n`,
      manifest: entry.bundle.manifest,
      cardRefs: entry.blueprint.nodes.map((node) => node.ref),
      cardDigests: entry.blueprint.nodes.map((node) => node.digest),
    });
    await addRelease(db, {
      bundleId: ids.bundleId,
      version: "1.0.1",
      dot: `${entry.bundle.dot}\n// backport\n`,
      manifest: entry.bundle.manifest,
      cardRefs: entry.blueprint.nodes.map((node) => node.ref),
      cardDigests: entry.blueprint.nodes.map((node) => node.digest),
    });

    const current = await serveFile(db, ANONYMOUS, ref(entry.slug), "blueprint.dot");
    expect(new TextDecoder().decode(current!.bytes)).toBe(`${entry.bundle.dot}\n// high\n`);
    /* Stated the other way round too, so the assertion cannot pass by both being equal. */
    expect(new TextDecoder().decode(current!.bytes)).not.toContain("// backport");
    expect(high.version).toBe("2.0.0");
  });

  /**
   * B-09: slugs are unique per owner, so two owners may hold the same one. The handle half
   * of the lookup was only observed incidentally — by a `nobody` handle answering
   * `undefined` — which a query ignoring the handle also satisfies whenever exactly one
   * bundle carries the slug. Two owners, one slug, is the case that separates them.
   */
  it("B-09: two owners may hold one slug and each is served their own bytes", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "grounded-research-desk")!;
    const [other] = await db
      .insert(schema.account)
      .values({ githubId: "t090-other", githubLogin: "t090-other", handle: "otherexporter" })
      .returning();

    const bundle = await createBundle(db, { ownerId: other.id, slug: entry.slug, visibility: "public" });
    await addRelease(db, {
      bundleId: bundle.id,
      version: "1.0.0",
      dot: `${entry.bundle.dot}\n// the other owner's copy\n`,
      manifest: entry.bundle.manifest,
      cardRefs: entry.blueprint.nodes.map((node) => node.ref),
      cardDigests: entry.blueprint.nodes.map((node) => node.digest),
    });

    const mine = await serveFile(db, ANONYMOUS, ref(entry.slug), "blueprint.dot");
    const theirs = await serveFile(
      db,
      ANONYMOUS,
      { ownerHandle: "otherexporter", slug: entry.slug },
      "blueprint.dot",
    );
    expect(new TextDecoder().decode(mine!.bytes)).toBe(entry.bundle.dot);
    expect(new TextDecoder().decode(theirs!.bytes)).toBe(`${entry.bundle.dot}\n// the other owner's copy\n`);
  });

  it("AC6: digest is resolved before version, so a contradicting pair answers by digest", async () => {
    const ids = seeded.get("guarded-merge-bot")!;
    const served = await serveFile(
      db,
      ANONYMOUS,
      { ...ref("guarded-merge-bot"), version: "2.0.0", digest: ids.digest },
      "blueprint.dot",
    );
    const entry = readContent().find((candidate) => candidate.slug === "guarded-merge-bot")!;
    expect(new TextDecoder().decode(served!.bytes)).toBe(entry.bundle.dot);
  });

  /* --------------------- AC7 --------------------- */

  it("AC7: a path that normalises to a legal file is still refused", async () => {
    const legal = "README.md";
    expect(await serveFile(db, ANONYMOUS, ref("frontline-triage"), legal)).toBeDefined();

    /* The discriminating cases. Each normalises to `README.md` and each is refused,
       because the check is string membership in the export's own list and not a
       filesystem path with a prefix guard on it. A `path.join`-and-check-the-prefix
       implementation serves all three. */
    for (const path of ["./README.md", "cards/../README.md", "ontology/../README.md", "/README.md"]) {
      await expect(serveFile(db, ANONYMOUS, ref("frontline-triage"), path), path).rejects.toThrow(
        "serveFile: no such file in this release.",
      );
    }
  });

  it("AC7: a traversal outside the release is refused too, and it is the weaker case", async () => {
    for (const path of ["../../etc/passwd", "../../../lib/db/schema.ts", "cards/../../etc/passwd"]) {
      await expect(serveFile(db, ANONYMOUS, ref("frontline-triage"), path), path).rejects.toThrow(
        "serveFile: no such file in this release.",
      );
    }
  });

  it("AC7: the refusal names no file the release does contain", async () => {
    const message = await serveFile(db, ANONYMOUS, ref("frontline-triage"), "nope").then(
      () => "served",
      (err: Error) => err.message,
    );
    expect(message).toBe("serveFile: no such file in this release.");
    expect(message).not.toContain("README");
    expect(message).not.toContain("nope");
  });

  /* --------------------- the two answers serveFile has (D-90-01) --------------------- */

  it("D-90-01: undefined for an absent release, a throw for an absent path", async () => {
    expect(await serveFile(db, ANONYMOUS, ref("no-such-slug"), "README.md")).toBeUndefined();
    expect(await serveFile(db, ANONYMOUS, { ownerHandle: "nobody", slug: "frontline-triage" }, "README.md")).toBeUndefined();
    expect(
      await serveFile(db, ANONYMOUS, { ...ref("frontline-triage"), version: "9.9.9" }, "README.md"),
    ).toBeUndefined();
    expect(
      await serveFile(db, ANONYMOUS, { ...ref("frontline-triage"), digest: "sha256:" + "0".repeat(64) }, "README.md"),
    ).toBeUndefined();
    /* A malformed digest is `undefined` too, not a throw out of the S3 key validator. */
    expect(
      await serveFile(db, ANONYMOUS, { ...ref("frontline-triage"), digest: "../../etc/passwd" }, "README.md"),
    ).toBeUndefined();
  });

  /* --------------------- visibility (B-03, B-07, D-90-05) --------------------- */

  it("a private bundle is invisible to a stranger and readable by its owner, with one message either way", async () => {
    const ids = seeded.get("nightly-data-janitor")!;
    await db.update(schema.bundle).set({ visibility: "private" }).where(eq(schema.bundle.id, ids.bundleId));

    expect(await serveFile(db, ANONYMOUS, ref("nightly-data-janitor"), "README.md")).toBeUndefined();
    await expect(exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest)).rejects.toThrow(
      "exportRelease: no such release.",
    );
    expect(await serveFile(db, owner, ref("nightly-data-janitor"), "README.md")).toBeDefined();

    await db.update(schema.bundle).set({ visibility: "public" }).where(eq(schema.bundle.id, ids.bundleId));
  });

  it("D-90-05: a public bundle pinning a card the caller may not read is refused, not served with a hole", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "incident-commander")!;
    const ids = seeded.get(entry.slug)!;
    const pinned = entry.blueprint.nodes[0].ref;
    const parsed = pinned.split("@");

    await db
      .update(schema.cardVersion)
      .set({ visibility: "private" })
      .where(and(eq(schema.cardVersion.cardId, parsed[0]), eq(schema.cardVersion.version, parsed[1])));

    await expect(exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest)).rejects.toThrow(
      "exportRelease: a card this release pins is unavailable.",
    );
    /* The owner, who may read both, still gets the folder — so the refusal is about the
       actor and not about the release being broken. */
    await expect(exportRelease(db, owner, ids.bundleId, ids.digest)).resolves.toBeDefined();

    await db
      .update(schema.cardVersion)
      .set({ visibility: "public" })
      .where(and(eq(schema.cardVersion.cardId, parsed[0]), eq(schema.cardVersion.version, parsed[1])));
  });

  it("D-90-05: the refusal names no card", async () => {
    const entry = readContent().find((candidate) => candidate.slug === "incident-commander")!;
    const ids = seeded.get(entry.slug)!;
    const pinned = entry.blueprint.nodes[0].ref;
    const parsed = pinned.split("@");
    await db
      .update(schema.cardVersion)
      .set({ visibility: "private" })
      .where(and(eq(schema.cardVersion.cardId, parsed[0]), eq(schema.cardVersion.version, parsed[1])));

    const message = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest).then(
      () => "served",
      (err: Error) => err.message,
    );
    expect(message).toBe("exportRelease: a card this release pins is unavailable.");
    expect(message).not.toContain(parsed[0]);

    await db
      .update(schema.cardVersion)
      .set({ visibility: "public" })
      .where(and(eq(schema.cardVersion.cardId, parsed[0]), eq(schema.cardVersion.version, parsed[1])));
  });

  /* --------------------- the edge guard (D-90-07) --------------------- */

  it("D-90-07: a bundleId that is not a uuid answers `no such release`, never the statement", async () => {
    const ids = seeded.get("frontline-triage")!;
    for (const bad of ["not-a-uuid", "", "'; drop table release; --", "../../etc/passwd"]) {
      const message = await exportRelease(db, ANONYMOUS, bad, ids.digest).then(
        () => "served",
        (err: Error) => err.message,
      );
      expect(message, bad).toBe("exportRelease: no such release.");
    }
  });

  it("D-90-07: no refusal from this module carries an enumerable property or a driver value", async () => {
    const ids = seeded.get("frontline-triage")!;
    /* Typed as the error rather than as the union `catch` widens it to: a `readonly
       ExportedFile[]` reaching these assertions would mean the call resolved, and the
       `instanceof` below is what says so out loud instead of `as`-ing it away. */
    const thrown: unknown = await exportRelease(db, ANONYMOUS, "not-a-uuid", ids.digest).then(
      (files) => files,
      (e: unknown) => e,
    );
    expect(thrown).toBeInstanceOf(Error);
    const err = thrown as Error;
    expect(Object.keys(err)).toEqual([]);
    expect(JSON.stringify(err)).toBe("{}");
    expect(typeof err.stack).toBe("string");
    /* `cause` is present on a sealed error only when one was supplied; what must hold on
       every path is that nothing it carries is enumerable. */
    expect(Object.prototype.propertyIsEnumerable.call(err, "cause")).toBe(false);
  });

  /* --------------------- B-14 --------------------- */

  it("B-14: one download event per served file, on the bundle and on the card", async () => {
    const countFor = async (kind: "blueprint" | "card", refId: string): Promise<number> => {
      const [row] = await db
        .select()
        .from(schema.target)
        .where(and(eq(schema.target.kind, kind), eq(schema.target.refId, refId)));
      return row === undefined ? 0 : Number(row.downloadCount);
    };

    const ids = seeded.get("schema-forge-etl")!;
    const before = await countFor("blueprint", ids.bundleId);
    await serveFile(db, ANONYMOUS, ref("schema-forge-etl"), "README.md");
    await serveFile(db, ANONYMOUS, ref("schema-forge-etl"), "AGENTS.md");
    expect(await countFor("blueprint", ids.bundleId)).toBe(before + 2);

    /* A refused path is not a download. */
    await serveFile(db, ANONYMOUS, ref("schema-forge-etl"), "nope").catch(() => undefined);
    expect(await countFor("blueprint", ids.bundleId)).toBe(before + 2);

    /* And `exportRelease` counts nothing: the folder is fetched file by file. */
    await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
    expect(await countFor("blueprint", ids.bundleId)).toBe(before + 2);

    const entry = readContent().find((candidate) => candidate.slug === "schema-forge-etl")!;
    const pinned = entry.blueprint.nodes[0].ref;
    const cardId = pinned.split("@")[0];
    const cardBefore = await countFor("card", cardId);
    await serveCard(db, ANONYMOUS, pinned);
    expect(await countFor("card", cardId)).toBe(cardBefore + 1);
    /* Per bare id, never `id@version`. */
    expect(await countFor("card", pinned)).toBe(0);
  });

  /* --------------------- content types --------------------- */

  it("every served file states a type, and the bytes are the UTF-8 length", async () => {
    const expected = new Map([
      ["README.md", "text/markdown; charset=utf-8"],
      ["AGENTS.md", "text/markdown; charset=utf-8"],
      ["blueprint.dot", "text/vnd.graphviz; charset=utf-8"],
      [FACTORY_DOT, "text/vnd.graphviz; charset=utf-8"],
      [BUNDLE_VOCABULARY, "application/yaml; charset=utf-8"],
    ]);
    for (const [path, type] of expected) {
      const served = await serveFile(db, ANONYMOUS, ref("frontline-triage"), path);
      expect(served?.contentType, path).toBe(type);
      expect(served?.bytes.byteLength, path).toBe(
        new TextEncoder().encode(new TextDecoder().decode(served!.bytes)).byteLength,
      );
    }
  });

  it("the stored scorecard is what the README quotes, not a fresh computation", async () => {
    const ids = seeded.get("frontline-triage")!;
    const [row] = await db
      .select()
      .from(schema.release)
      .where(eq(schema.release.id, (await db.select().from(schema.release).where(
        and(eq(schema.release.bundleId, ids.bundleId), eq(schema.release.digest, ids.digest)),
      ))[0].id));

    /* Rewrite the stored autonomy label to something no computation would produce. If the
       README still quotes the computed one, B-08's stamp is being ignored. */
    const autonomy = { ...(row.autonomy as Record<string, unknown>), label: "L9-fixture" };
    await db.update(schema.release).set({ autonomy }).where(eq(schema.release.id, row.id));

    const files = await exportRelease(db, ANONYMOUS, ids.bundleId, ids.digest);
    const readme = files.find((file) => file.path === "README.md");
    expect(readme?.text).toContain("L9-fixture");

    await db.update(schema.release).set({ autonomy: row.autonomy }).where(eq(schema.release.id, row.id));
  });

  it("the card ref helper and the export agree on where a card lives", () => {
    expect(cardFilePath(cardRef("planner", "1.0.0"))).toBe("cards/planner@1.0.0.yaml");
  });
});
