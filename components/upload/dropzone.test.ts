/* ============================================================
   /upload, given the folder /blueprints hands out
   ------------------------------------------------------------
   The round trip the site has to survive: every file the download
   contains, dropped straight back into the wizard, resolving to the
   same two numbers the README printed.

   It did not. The exporter wrote four kinds of file and the
   vocabulary of doc 3 §7 was not one of them, so the two frontline
   triage cards declaring `lupo/pii-handling` came back as
   `card/unknown-term`, were dropped with their nodes, and both
   computed levels moved. The classifier had no role for the file
   either, so bringing it along by hand would not have helped.

   The bundle here is built by `exportBundle` over the real archive,
   which is the same call `scripts/generate-bundles.ts` makes, so
   this is the folder rather than a fixture that resembles it.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, loadBundle, ontologyView } from "@/lib/core";
import { exportBundle, type BundleExportInput } from "@/lib/content/bundle-export";
import { contentVocabulary, readContent } from "@/lib/content/read";

import { assembleBundle, classifyBundle, type UploadFile } from "./BundleDropzone";

const VOCABULARY = contentVocabulary();

/** One archive bundle as the files a reader downloads, named as a browser would name them. */
function downloadOf(slug: string): { files: UploadFile[]; autonomy: number; security: number } {
  const entry = readContent().find((b) => b.slug === slug);
  expect(entry, `${slug} is not in the archive`).toBeDefined();
  if (entry === undefined) throw new Error("unreachable");

  const input: BundleExportInput = {
    blueprint: entry.blueprint,
    analysis: entry.analysis,
    cards: entry.cardFiles.map((card) => ({
      ref: card.file.replace(/^cards\//, "").replace(/\.yaml$/, ""),
      text: card.text,
    })),
    ...(VOCABULARY === undefined
      ? {}
      : { vocabulary: { text: VOCABULARY.text, terms: VOCABULARY.terms } }),
  };

  return {
    // The whole folder, prose files included. Filtering them out here modelled a reader
    // who tidied the download before dropping it, which is not the ordinary case and hid
    // the fact that the wizard had nothing useful to say about either of them.
    files: exportBundle(input).map((file) => ({ name: file.path, text: file.text })),
    autonomy: entry.analysis.autonomy.level,
    security: entry.analysis.security.level,
  };
}

const EMPTY = { title: "", summary: "", description: "", category: "", tags: [] };

describe("the wizard, given a downloaded bundle", () => {
  it("gives every file a role, and the vocabulary its own", () => {
    const { files } = downloadOf("frontline-triage");
    const parts = classifyBundle(files);

    expect(parts.dot?.name).toBe("blueprint.dot");
    expect(parts.cards).toHaveLength(7);
    expect(parts.vocabulary?.name).toBe("ontology/extensions.yaml");
    expect(parts.vocabularyProblem).toBeUndefined();
    expect(parts.terms.map((term) => term.id)).toEqual(["lupo/pii-handling"]);
    // Three files in the folder are deliberately not read, and each says why rather than
    // reading as a rejection: `factory.dot` is the same graph prepared for a runner, and
    // the two prose documents address a person and an agent respectively.
    const ignored = parts.roles.filter((entry) => entry.role === "ignored");
    expect(ignored.map((entry) => entry.file.name).sort()).toEqual([
      "AGENTS.md",
      "README.md",
      "factory.dot",
    ]);
    const noteFor = (name: string) =>
      ignored.find((entry) => entry.file.name === name)?.note ?? "";
    expect(noteFor("factory.dot")).toContain("blueprint.dot");
    expect(noteFor("README.md")).toContain("written for a person");
    expect(noteFor("AGENTS.md")).toContain("agent adapting it");
    // The old catch-all said what these files are not, which told a reader nothing about
    // why their own download contains them.
    for (const name of ["README.md", "AGENTS.md"]) {
      expect(noteFor(name), name).not.toContain("not a .dot");
    }
  });

  it("reproduces the two levels the blueprint page shows", () => {
    for (const slug of readContent().map((entry) => entry.slug)) {
      const { files, autonomy, security } = downloadOf(slug);
      const parts = classifyBundle(files);
      const bundle = assembleBundle(parts, EMPTY);
      expect(bundle, slug).toBeDefined();
      if (bundle === undefined) continue;

      // Exactly what `UploadFlow` builds: the curated core plus whatever the dropped
      // vocabulary declares.
      const result = loadBundle(bundle, {
        ontology: ontologyView(CORE_ONTOLOGY, parts.terms),
      });
      expect([slug, result.diagnostics.filter((d) => d.severity === "error")]).toEqual([
        slug,
        [],
      ]);
      expect([slug, result.analysis?.autonomy.level]).toEqual([slug, autonomy]);
      expect([slug, result.analysis?.security.level]).toEqual([slug, security]);
    }
  });

  it("says so when the vocabulary cannot be read, rather than scoring without it", () => {
    const { files } = downloadOf("frontline-triage");
    const broken = files.map((file) =>
      file.name === "ontology/extensions.yaml"
        ? { ...file, text: 'version: "0.1.0"\nterms:\n  - id: acme/x\n    kind: nonsense\n' }
        : file,
    );
    const parts = classifyBundle(broken);
    expect(parts.terms).toEqual([]);
    expect(parts.vocabularyProblem).toContain("kind `nonsense`");
  });

  it("keeps the first vocabulary when two arrive, the way it keeps the first topology", () => {
    const { files } = downloadOf("frontline-triage");
    const parts = classifyBundle([
      ...files,
      { name: "other/extensions.yaml", text: 'version: "9.9.9"\nterms: []\n' },
    ]);
    expect(parts.vocabulary?.name).toBe("ontology/extensions.yaml");
    expect(parts.terms.map((term) => term.id)).toEqual(["lupo/pii-handling"]);
    expect(
      parts.roles.find((entry) => entry.file.name === "other/extensions.yaml")?.role,
    ).toBe("ignored");
  });
});
