/* ============================================================
   T270 AC1 — `validate` on the nine archive bundles produces
   byte-identical diagnostics to the server

   The criterion that justifies shipping the engine rather than
   reimplementing it, and the block says why it is falsifiable: a
   reimplementation passes a plausibility test and fails this one.
   So nothing here checks that a diagnostic is *reasonable*. Every
   cell is an EQUALITY against what the server answered for the
   same bytes.

   ── the server half is imported, never modelled ──
   `validateBundle` through `@/lib/server/engine` (D-270-01 C7:
   `Forbidden` means consume-never-edit, and the CLI calls this
   and never a bare `loadBundle` plus copied decisions). Written
   by T040, not by this suite — which is what makes it a second
   axis rather than a consistency check.

   ── why the comparison is over the whole result ──
   D-270-03 (2) publishes `validate(dir)` as returning "the
   engine's own result — the type `validateBundle` answers with".
   That is `LoadBundleResult { blueprint?, analysis?, diagnostics }`.
   AC1 names diagnostics, and the diagnostics are compared
   directly; `blueprint.digest` is compared too, in its own cell,
   because two runs agreeing on complaints while disagreeing on
   what they resolved is not "the same engine" in any sense AC1
   would accept.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import { validateBundle } from "@/lib/server/engine";

import { bindVerb, FLAT_VOCABULARY_NAME, NESTED_VOCABULARY_PATH } from "./contract";
import {
  ARCHIVE,
  cleanupFolders,
  EXTENSIONS,
  MANIFEST_SPELLINGS,
  OVERLAY_SLUG,
  ruledManifestStub,
  writeBundleFolder,
} from "./fixtures";

afterAll(cleanupFolders);

/** The server's answer for one archive bundle, wired the way the route wires it. */
function serverAnswer(slug: string) {
  const entry = ARCHIVE.find((bundle) => bundle.slug === slug);
  if (entry === undefined) throw new Error(`no archive bundle \`${slug}\``);
  return validateBundle({
    manifest: entry.bundle.manifest,
    dot: entry.bundle.dot,
    cardFiles: { ...entry.bundle.cardFiles },
    /* The overlay reaches the engine for every bundle, exactly as `lib/content/read.ts:146`
       layers it for the archive build. Passing it only for `frontline-triage` would make the
       other eight a different question from the one the build asks. */
    extensions: EXTENSIONS,
  });
}

describe("AC1 — byte-identical diagnostics to the server, over the nine", () => {
  it.each(ARCHIVE.map((bundle) => bundle.slug))(
    "%s — the CLI's diagnostics equal the server's for the same bytes",
    async (slug) => {
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;

      /* Build the world, plant the premise, ASSERT the premise, and only then bind. An early
         bind masks every line above it while being correct about its own subject, and the
         tell is a red in 0ms where file I/O was expected. */
      const dir = writeBundleFolder(entry.bundle, {
        manifest: "blueprint.yaml",
        ...(slug === OVERLAY_SLUG ? { vocabulary: vocabularyText() } : {}),
      });

      const server = serverAnswer(slug);
      expect(
        server.diagnostics,
        `the server half produced no diagnostics for ${slug}; an equality between two empty ` +
          `arrays holds against a CLI that returns nothing at all`,
      ).toBeInstanceOf(Array);

      const validate = await bindVerb("validate");
      const actual = (await validate(dir as never)) as { diagnostics: unknown };

      expect(actual.diagnostics).toEqual(server.diagnostics);
    },
  );

  it.each(ARCHIVE.map((bundle) => bundle.slug))(
    "%s — resolves the same blueprint, not merely the same complaints",
    async (slug) => {
      const entry = ARCHIVE.find((bundle) => bundle.slug === slug)!;
      const dir = writeBundleFolder(entry.bundle, {
        manifest: "blueprint.yaml",
        ...(slug === OVERLAY_SLUG ? { vocabulary: vocabularyText() } : {}),
      });

      const server = serverAnswer(slug);
      /* The premise this cell would be vacuous without: a bundle that failed to resolve has no
         `blueprint`, and `undefined === undefined` would pass against a CLI that resolves
         nothing. The archive is guaranteed error-free by `readContent`, so this must hold. */
      expect(server.blueprint, `${slug} did not resolve on the server half`).toBeDefined();

      const validate = await bindVerb("validate");
      const actual = (await validate(dir as never)) as {
        blueprint?: { digest?: string };
      };

      expect(actual.blueprint?.digest).toBe(server.blueprint?.digest);
    },
  );

  it("is not a comparison of two empty results", async () => {
    /* THE ANTI-TAUTOLOGY CELL. Every equality above holds trivially if both halves answer
       `{ diagnostics: [] }` for everything. The archive is error-free by construction, so
       `diagnostics` legitimately CAN be empty for a bundle — which means the equality cells
       cannot themselves prove the comparison has teeth.

       A deliberately broken folder is what gives them teeth: the DOT pins cards that are not
       there, so both halves must produce real diagnostics, and they must be the same ones. */
    const entry = ARCHIVE[0];
    const dir = writeBundleFolder(
      { ...entry.bundle, cardFiles: {} },
      { manifest: "blueprint.yaml" },
    );

    const server = validateBundle({
      manifest: entry.bundle.manifest,
      dot: entry.bundle.dot,
      cardFiles: {},
      extensions: EXTENSIONS,
    });
    expect(
      server.diagnostics.length,
      "the broken fixture produced no diagnostics; it is not broken",
    ).toBeGreaterThan(0);

    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });

  it("carries the card KEY FORM, which the nine archive bundles cannot exercise", async () => {
    /* MEASURED COVERAGE HOLE, confirmed independently before writing this.
       Over the nine archive bundles the server half produces 11 diagnostics and **ZERO of
       them carry a `location.file` at all** — not merely no card key. So every equality cell
       above is blind to how the CLI keys its card files: a reader keying them `<name>.yaml`
       instead of `cards/<name>.yaml` changes nothing any of them can see.

       The anti-tautology cell above does not close it either: an empty `cardFiles` produces
       only `topology.dot` and `null` locations.

       A deliberately BROKEN CARD is what reaches the key. Its `card/parse-error` diagnostics
       carry `location.file` = `cards/<ref>.yaml` — the key itself — so the comparison finally
       has the key form inside it. Measured on this exact fixture, not assumed. */
    const entry = ARCHIVE[0];
    const keys = Object.keys(entry.bundle.cardFiles);
    expect(keys.length, "the fixture bundle pins no cards").toBeGreaterThan(0);
    expect(keys[0]).toMatch(/^cards\//);

    const cardFiles = { ...entry.bundle.cardFiles, [keys[0]]: "id: [unclosed\n  not: valid: yaml:\n" };
    const dir = writeBundleFolder({ ...entry.bundle, cardFiles }, { manifest: "blueprint.yaml" });

    const server = validateBundle({
      manifest: entry.bundle.manifest,
      dot: entry.bundle.dot,
      cardFiles,
      extensions: EXTENSIONS,
    });

    /* The premise that makes this cell non-vacuous, and the one the archive fixtures fail:
       at least one diagnostic must name the card KEY. Without it this is another comparison
       that cannot see the thing it was written for. */
    const keyed = server.diagnostics.filter((diagnostic) =>
      (diagnostic.location?.file ?? "").startsWith("cards/"),
    );
    expect(keyed.length, "the broken-card fixture produced no card-keyed diagnostic").toBeGreaterThan(0);

    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });
});

describe("the `<dir>` contract — the wizard's accepted layout (D-270-01 C6)", () => {
  it.each(MANIFEST_SPELLINGS)("accepts a manifest spelled `%s`", async (spelling) => {
    /* All three, because `MANIFEST_NAME` at `components/upload/BundleDropzone.tsx:104` is
       `/^blueprint\.(ya?ml|json)$/i` and `/upload` therefore accepts three. C6 said one; the
       code says three, and the code wins. A cell driving only `blueprint.yaml` would be blind
       to the two spellings a user who came from the wizard is most likely to have. */
    const entry = ARCHIVE[0];
    const dir = writeBundleFolder(entry.bundle, { manifest: spelling });
    const server = serverAnswer(entry.slug);

    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });

  it("supplies D-270-02 D3's stub when the manifest is absent", async () => {
    /* The manifest is OPTIONAL, and what the CLI substitutes is behaviour-bearing rather than
       cosmetic: `resolveBundle` reads `manifest.ontologyVersion` at
       `lib/core/bundle/resolve.ts:714,726,730,732` and emits `bundle/ontology-mismatch` from
       it. A stub disagreeing with the server caller's default fails AC1 through the stub
       rather than through the engine, which is why the ruling names the field.

       Compared against the server run with the RULED STUB as its manifest — not against the
       archive's real manifest, which would be asking the CLI to invent a title it cannot
       know. */
    const entry = ARCHIVE[0];
    const dirName = "my-blueprint";
    const dir = writeBundleFolder(entry.bundle, { dirName });

    const stub = ruledManifestStub(dirName);
    const server = validateBundle({
      manifest: stub,
      dot: entry.bundle.dot,
      cardFiles: { ...entry.bundle.cardFiles },
      extensions: EXTENSIONS,
    });

    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });
});

describe("the local vocabulary is read at both ruled locations (D-270-04 (3))", () => {
  it("reads the wizard's flat `extensions.yaml`", async () => {
    const entry = ARCHIVE.find((bundle) => bundle.slug === OVERLAY_SLUG)!;
    /* The flat spelling is the wizard's, and it is what a user who assembled the folder by
       hand has. Asserted through the DIAGNOSTICS rather than through a file check: the
       question is whether the overlay reached the engine, and a folder whose local terms went
       unread scores against the curated core alone and complains about every one of them. */
    const dir = writeBundleFolder(entry.bundle, { manifest: "blueprint.yaml" });
    writeVocabulary(dir, "extensions.yaml");
    expect(FLAT_VOCABULARY_NAME.test("extensions.yaml")).toBe(true);

    const server = serverAnswer(OVERLAY_SLUG);
    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });

  it("reads `ontology/extensions.yaml`, which is what `clone` writes", async () => {
    /* C6's other promise: clone's output folder is validatable. `exportBundle` writes the
       overlay to `ontology/extensions.yaml`, so a `validate` that only knew the flat spelling
       would refuse to read a folder this same CLI had just produced. */
    const entry = ARCHIVE.find((bundle) => bundle.slug === OVERLAY_SLUG)!;
    const dir = writeBundleFolder(entry.bundle, {
      manifest: "blueprint.yaml",
      vocabulary: vocabularyText(),
    });
    expect(NESTED_VOCABULARY_PATH).toBe("ontology/extensions.yaml");

    const server = serverAnswer(OVERLAY_SLUG);
    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });

  it("names BOTH paths when they are present and different", async () => {
    /* D-270-04 (3), and the assertion is on the DIAGNOSTIC rather than on which file won.
       "Both present and DIFFERENT: a diagnostic naming both paths, never a silent precedence."
       A cell asserting only that one of them was used would pass against exactly the silent
       precedence the ruling forbids — so this excludes the bad output by requiring both paths
       to appear in what comes back. */
    const entry = ARCHIVE.find((bundle) => bundle.slug === OVERLAY_SLUG)!;
    const dir = writeBundleFolder(entry.bundle, {
      manifest: "blueprint.yaml",
      vocabulary: vocabularyText(),
    });
    writeVocabulary(dir, "extensions.yaml", `${vocabularyText()}\n# a byte the other lacks\n`);

    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as {
      diagnostics: readonly { message: string; hint?: string }[];
    };

    const rendered = actual.diagnostics
      .map((diagnostic) => `${diagnostic.message} ${diagnostic.hint ?? ""}`)
      .join("\n");
    expect(rendered, "the diagnostic must name the flat path").toContain("extensions.yaml");
    expect(rendered, "the diagnostic must name the nested path").toContain(NESTED_VOCABULARY_PATH);
  });

  it("says nothing when both are present and byte-identical", async () => {
    /* THE NEAR MISS for the cell above: same fixture, one byte different, and the answer must
       flip. "Both present and byte-identical: fine." Without this, a CLI that complained
       whenever two vocabulary files existed would pass the cell above and be wrong about every
       folder a careful user assembled. */
    const entry = ARCHIVE.find((bundle) => bundle.slug === OVERLAY_SLUG)!;
    const dir = writeBundleFolder(entry.bundle, {
      manifest: "blueprint.yaml",
      vocabulary: vocabularyText(),
    });
    writeVocabulary(dir, "extensions.yaml", vocabularyText());

    const server = serverAnswer(OVERLAY_SLUG);
    const validate = await bindVerb("validate");
    const actual = (await validate(dir as never)) as { diagnostics: unknown };

    expect(actual.diagnostics).toEqual(server.diagnostics);
  });
});

/* --------------------- helpers --------------------- */

/**
 * The archive's own overlay bytes.
 *
 * Read off `content/ontology/extensions.yaml` rather than authored here: the bytes the site
 * actually ships are the bytes AC1 compares against, and a hand-written overlay would resolve
 * to different terms — so the CLI and the server halves would disagree for a reason about this
 * fixture rather than about the CLI.
 */
const VOCABULARY_TEXT = readFileSync(
  fileURLToPath(new URL("../../../content/ontology/extensions.yaml", import.meta.url)),
  "utf8",
);

function vocabularyText(): string {
  return VOCABULARY_TEXT;
}

function writeVocabulary(dir: string, name: string, text?: string): void {
  writeFileSync(join(dir, name), text ?? VOCABULARY_TEXT, "utf8");
}
