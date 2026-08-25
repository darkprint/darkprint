/* ============================================================
   T220 AC2 and AC4 — fetch a release

   AC2: by digest, the bytes are identical to the stored release,
        INCLUDING after a newer release exists.
   AC4: the returned file names match what the exporter writes.

   ── the oracle, and why it is not a function call ──
   `public/bundles/<slug>/` is the folder `scripts/generate-bundles.ts`
   wrote at build time and committed. It is bytes on disk, produced
   by a different module at a different time from the read under
   test, which is what makes it a second axis rather than a
   consistency check — a reference written by the author of the
   assertions shows only that the cells are satisfiable.

   Verified before it was bound: `exportRelease` on the first release
   of `adversarial-consensus-line` answered TWELVE files, byte-for-byte
   equal to the twelve on disk (4303B AGENTS.md, 4735B README.md,
   705B topology.dot, eight cards, 6441B factory.dot). So a
   difference below is the module's, not the oracle's.

   ── what that measurement says about the advertised contract ──
   `/mcp` promises `topology.dot, cards/*.yaml, README.md, AGENTS.md`
   under a comment claiming those are what the exporter writes into
   every folder. The exporter writes `factory.dot` too — in 9 of 9
   folders — and `ontology/extensions.yaml` in one. AC4 binds the
   EXPORTER, so these cells do; the page's omission is charge 4 in
   the T220 log and is the orchestrator's to fix, since the page is
   Forbidden to both halves.

   ── why the second release carries another bundle's bytes ──
   AC2's claim is that the OLD digest keeps answering the OLD bytes.
   A cell cannot tell "answered the first release" from "answered the
   second" unless the two differ observably, and two releases of the
   same content differ in nothing: `exportBundle` is pure and sorts
   by path. So the fixture repins the whole node set, and the two
   file sets differ by name — measured: release 1 has eight cards and
   no vocabulary, release 2 has seven different cards plus
   `ontology/extensions.yaml`.
   ============================================================ */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { BUNDLE_AGENTS, BUNDLE_README, FACTORY_DOT, TOPOLOGY_DOT } from "@/lib/content/bundle-export";

import { verb } from "./contract";
import { anonymous, dropScratchDatabases, seededWorld } from "./fixtures";

const world = seededWorld();

/** The committed folder for one slug, as `{path, text}` sorted by path. */
function committedFolder(slug: string): { path: string; text: string }[] {
  const root = fileURLToPath(new URL(`../../../public/bundles/${slug}`, import.meta.url));
  const walk = (dir: string, prefix: string): { path: string; text: string }[] => {
    const out: { path: string; text: string }[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = prefix === "" ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) out.push(...walk(full, rel));
      else out.push({ path: rel, text: readFileSync(full, "utf8") });
    }
    return out;
  };
  return walk(root, "").sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

type Files = readonly { path: string; text: string }[];
const paths = (files: Files): string[] => files.map((f) => f.path).sort();

afterAll(async () => {
  await dropScratchDatabases();
});

describe("T220 AC4 — the returned names are the exporter's", () => {
  it("answers exactly the file set the committed folder holds", async () => {
    const w = await world();
    const expected = committedFolder(w.twice);
    /* The premise, before the bind: the oracle is a real folder with real files in it, so
       an equality below is two populated sets agreeing rather than two empty ones. */
    expect(expected.length).toBeGreaterThan(4);

    const fetchRelease = await verb("mcpFetchRelease");
    const files = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as Files;

    expect(paths(files)).toEqual(paths(expected));
  });

  it("includes `factory.dot`, which /mcp's four-name list omits", async () => {
    const w = await world();
    const expected = committedFolder(w.twice);
    /* Asserted about the ORACLE first, so a red below is about the module rather than about
       an archive that stopped shipping the file. Measured: 9 of 9 folders carry it. */
    expect(paths(expected)).toContain(FACTORY_DOT);

    const fetchRelease = await verb("mcpFetchRelease");
    const files = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as Files;

    expect(
      paths(files),
      "AC4 binds the EXPORTER, and the exporter writes `factory.dot` into every bundle. " +
        "`/mcp` names four files and omits it; charge 4 in the T220 log. A module that " +
        "shipped the page's four would be describing a different registry, which is the " +
        "page's own words for the mistake.",
    ).toContain(FACTORY_DOT);
    for (const name of [TOPOLOGY_DOT, BUNDLE_README, BUNDLE_AGENTS]) {
      expect(paths(files)).toContain(name);
    }
  });

  it("returns `ExportedFile` and not the serving verbs' `ServedFile`", async () => {
    const w = await world();
    /* The premise, before the bind: this release really does have files, so an empty array
       cannot satisfy the shape check by having nothing to check. */
    expect(committedFolder(w.twice).length).toBeGreaterThan(0);

    const fetchRelease = await verb("mcpFetchRelease");
    const files = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as readonly Record<string, unknown>[];

    expect(files.length).toBeGreaterThan(0);
    const wrong = files.filter(
      (f) => typeof f.path !== "string" || typeof f.text !== "string" || f.bytes !== undefined,
    );
    /* The published return type is `readonly ExportedFile[]` — `{path, text}`. `ServedFile`
       is `{path, bytes, contentType}` and is what `serveFile` and `serveCard` answer, and
       BOTH of those call `recordDownload`, which writes. So a `bytes` member here is AC1's
       violation showing up in AC4's shape. */
    expect(wrong.map((f) => Object.keys(f).sort().join(","))).toEqual([]);
  });
});

describe("T220 AC2 — a digest reference never moves", () => {
  it("answers the FIRST release's bytes although a newer release exists", async () => {
    const w = await world();
    const expected = committedFolder(w.twice);
    /* Both premises before the bind. The second release exists and is a different release —
       otherwise "although a newer release exists" is a claim about a fixture that has none. */
    expect(w.second.digest).not.toBe(w.first.digest);
    expect(w.second.version).not.toBe(w.first.version);

    const fetchRelease = await verb("mcpFetchRelease");
    const files = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as Files;

    const got = new Map(files.map((f) => [f.path, f.text]));
    const differing = expected
      .filter((f) => got.get(f.path) !== f.text)
      .map((f) => `${f.path} (${got.has(f.path) ? "differs" : "absent"})`);
    /* Byte equality, file by file, and the failure names the paths. `toEqual` on the whole
       array would print two multi-kilobyte folders and say nothing a reader can act on. */
    expect(differing).toEqual([]);
    expect(paths(files)).toEqual(paths(expected));
  });

  it("answers the SECOND release's different bytes for the second digest", async () => {
    const w = await world();
    const firstExpected = committedFolder(w.twice);
    const secondExpected = committedFolder(w.other);
    /* The control that makes the cell above discriminating rather than satisfiable by a
       module that always answers the first release. The two sets must differ, or "returned
       the old one" and "returned the new one" are the same observation. */
    expect(paths(secondExpected)).not.toEqual(paths(firstExpected));

    const fetchRelease = await verb("mcpFetchRelease");
    const files = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.second.digest,
    )) as Files;

    /* The second release carries `other`'s bytes under `twice`'s slug, so the CARD names and
       the vocabulary file are `other`'s. `README.md`, `AGENTS.md` and the two `.dot` files
       are regenerated and are not compared here: they legitimately quote the slug and the
       manifest, which the fixture changed. The card set is the discriminating part. */
    const cards = paths(files).filter((p) => p.startsWith("cards/"));
    const expectedCards = paths(secondExpected).filter((p) => p.startsWith("cards/"));
    expect(cards).toEqual(expectedCards);
    expect(cards).not.toEqual(paths(firstExpected).filter((p) => p.startsWith("cards/")));
  });

  it("answers byte-identically when asked twice", async () => {
    const w = await world();
    /* Before the bind, and load-bearing: two EMPTY answers are also equal to each other, so
       without this the cell is satisfiable by a verb that returns nothing twice. */
    expect(committedFolder(w.twice).length).toBeGreaterThan(0);

    const fetchRelease = await verb("mcpFetchRelease");
    const once = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as Files;
    const twice = (await fetchRelease(
      w.scratch.db,
      anonymous,
      w.registry.handle,
      w.twice,
      w.first.digest,
    )) as Files;
    /* `buildExport`'s own header claims this and names what would break it: a clock, a
       random source, an environment variable, or a `Map` iterated for insertion order.
       Asserted here because AC2 is a promise this layer can only break. */
    expect(once.map((f) => `${f.path}:${f.text.length}`)).toEqual(
      twice.map((f) => `${f.path}:${f.text.length}`),
    );
    expect(once).toEqual(twice);
  });
});
