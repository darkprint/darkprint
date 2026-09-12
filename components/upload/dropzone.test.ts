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

    expect(parts.dot?.name).toBe("topology.dot");
    expect(parts.cards).toHaveLength(7);
    expect(parts.vocabulary?.name).toBe("ontology/extensions.yaml");
    expect(parts.vocabularyProblem).toBeUndefined();
    expect(parts.terms.map((term) => term.id)).toEqual([
      // The whole overlay, not the subset this bundle uses: `exportBundle` writes
      // `vocabulary.text` verbatim so a reader's terms are the ones the site scored.
      "lupo/pii-handling",
      "autogen/untrusted-text",
      "autogen/prompt-injection",
      "autogen/budget-overrun",
      "autogen/unverified-delegation",
    ]);
    // One file in the folder is deliberately not read, and it says why rather than
    // reading as a rejection: `README.md` addresses a person, not the engine. Owner
    // instruction, 2026-08-25: a fresh download no longer carries `factory.dot` or
    // `AGENTS.md` at all, so neither shows up here any more either — see the
    // `factory.dot` and `AGENTS.md` describe block below for the classifier's continuing
    // recognition of both, which exists for a reader's older downloads.
    const ignored = parts.roles.filter((entry) => entry.role === "ignored");
    expect(ignored.map((entry) => entry.file.name).sort()).toEqual(["README.md"]);
    const noteFor = (name: string) =>
      ignored.find((entry) => entry.file.name === name)?.note ?? "";
    expect(noteFor("README.md")).toContain("written for a person");
    // The old catch-all said what this file is not, which told a reader nothing about
    // why their own download contains it.
    expect(noteFor("README.md")).not.toContain("not a .dot");
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
    expect(parts.terms.map((term) => term.id)).toEqual([
      // The whole overlay, not the subset this bundle uses: `exportBundle` writes
      // `vocabulary.text` verbatim so a reader's terms are the ones the site scored.
      "lupo/pii-handling",
      "autogen/untrusted-text",
      "autogen/prompt-injection",
      "autogen/budget-overrun",
      "autogen/unverified-delegation",
    ]);
    expect(
      parts.roles.find((entry) => entry.file.name === "other/extensions.yaml")?.role,
    ).toBe("ignored");
  });
});

describe("the wizard, given blueprint.dot — the topology's name before the format rename", () => {
  const file = (name: string): UploadFile => ({ name, text: "digraph g {}\n" });

  it("reads a folder carrying only blueprint.dot, same as it validated before the rename", () => {
    const parts = classifyBundle([file("blueprint.dot")]);
    expect(parts.dot?.name).toBe("blueprint.dot");
    // Nothing was ignored, so there is nothing to warn about — the compatibility
    // diagnostic exists for the two-file case below, not for this one.
    expect(parts.diagnostics).toEqual([]);
  });

  it("prefers topology.dot when a drop carries both, and warns that blueprint.dot was ignored", () => {
    const parts = classifyBundle([file("blueprint.dot"), file("topology.dot")]);
    expect(parts.dot?.name).toBe("topology.dot");

    const ignored = parts.roles.filter((entry) => entry.role === "ignored");
    expect(ignored.map((entry) => entry.file.name)).toEqual(["blueprint.dot"]);
    expect(ignored[0].note).toContain("topology.dot");

    expect(parts.diagnostics).toHaveLength(1);
    expect(parts.diagnostics[0]).toMatchObject({
      code: "bundle/legacy-topology-file",
      severity: "warning",
      location: { file: "blueprint.dot" },
    });
  });

  it("prefers topology.dot regardless of which file was dropped first", () => {
    // Same pair as above, reversed — `topology.dot` winning must not be an accident of
    // `blueprint.dot` losing a "first .dot wins" race it happened to run second in.
    const parts = classifyBundle([file("topology.dot"), file("blueprint.dot")]);
    expect(parts.dot?.name).toBe("topology.dot");
    expect(parts.diagnostics).toHaveLength(1);
    expect(parts.diagnostics[0].code).toBe("bundle/legacy-topology-file");
  });
});

/**
 * `factory.dot` and `AGENTS.md`, neither of which a fresh download carries any more
 * (owner instruction, 2026-08-25). `classifyBundle` still recognises both by name — a
 * reader may drop an older download, or a folder they wrote by hand — so this holds that
 * recognition directly, the way the suite above holds `blueprint.dot` after ITS rename.
 */
describe("the wizard, given factory.dot or AGENTS.md — no longer part of a fresh download", () => {
  const file = (name: string): UploadFile => ({ name, text: "content\n" });

  it("recognises factory.dot beside topology.dot, and says why it was not read", () => {
    const parts = classifyBundle([
      { name: "topology.dot", text: "digraph g {}\n" },
      file("factory.dot"),
    ]);
    expect(parts.dot?.name).toBe("topology.dot");
    const ignored = parts.roles.filter((entry) => entry.role === "ignored");
    expect(ignored.map((entry) => entry.file.name)).toEqual(["factory.dot"]);
    expect(ignored[0].note).toContain("topology.dot");
  });

  it("recognises AGENTS.md as the bundle's agent-facing notes, not an unreadable stray", () => {
    const parts = classifyBundle([file("AGENTS.md")]);
    const ignored = parts.roles.filter((entry) => entry.role === "ignored");
    expect(ignored.map((entry) => entry.file.name)).toEqual(["AGENTS.md"]);
    expect(ignored[0].note).toContain("agent adapting it");
    expect(ignored[0].note).not.toContain("not a .dot");
  });
});
