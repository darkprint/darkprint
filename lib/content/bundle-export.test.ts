import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  CORE_ONTOLOGY,
  hasErrors,
  lintAttractor,
  loadBundle,
  ontologyView,
  parseDot,
} from "@/lib/core";

import {
  BUNDLE_AGENTS,
  BUNDLE_README,
  BUNDLE_VOCABULARY,
  FACTORY_DOT,
  TOPOLOGY_DOT,
  bundleDir,
  bundleHref,
  bundleAgents,
  bundleReadme,
  cardFilePath,
  exportBundle,
  localTermsUsed,
  skillPointers,
  type BundleExportInput,
  type ExportedFile,
} from "./bundle-export";
import { parseOntologyTerms } from "./ontology-file";
import { contentVocabulary, readContent, type LoadedBundle } from "./read";
import { autonomyStatement } from "@/lib/format";

/* --------------------- the real archive --------------------- */

const loaded = readContent();

/** Doc 3 §7's local terms, as the loader read them. `undefined` if the archive has none. */
const VOCABULARY = contentVocabulary();

/** `LoadedBundle` as the exporter wants it: the card refs joined to their raw YAML. */
function toInput(entry: LoadedBundle): BundleExportInput {
  return {
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
}

function fileMap(files: readonly ExportedFile[]): Map<string, string> {
  return new Map(files.map((f) => [f.path, f.text]));
}

const EXPORTS = loaded.map((entry) => ({
  slug: entry.slug,
  entry,
  input: toInput(entry),
  files: exportBundle(toInput(entry)),
}));

describe("exportBundle over content/", () => {
  it("covers all nine blueprints", () => {
    expect(EXPORTS.map((e) => e.slug)).toEqual([
      "adversarial-consensus-line",
      "checkpoint-resume-runner",
      "frontline-triage",
      "grounded-research-desk",
      "guarded-merge-bot",
      "incident-commander",
      "nightly-data-janitor",
      "schema-forge-etl",
      "starter-software-factory",
    ]);
  });

  // The layout named in the item-10 contract, checked as a set rather than by spot check:
  // a file that appears without being one of these kinds is a file nobody documented.
  // The vocabulary is expected exactly where the cards use it, so neither an archive-wide
  // file shipped into a bundle that ignores it nor a missing one passes.
  it("writes exactly the documented kinds of file, sorted by path", () => {
    for (const { slug, entry, input, files } of EXPORTS) {
      const refs = [...new Set(entry.blueprint.nodes.map((n) => n.ref))].sort();
      const expected = [
        BUNDLE_README,
        BUNDLE_AGENTS,
        TOPOLOGY_DOT,
        FACTORY_DOT,
        ...refs.map(cardFilePath),
        ...(localTermsUsed(input).length > 0 ? [BUNDLE_VOCABULARY] : []),
      ].sort();
      expect([slug, files.map((f) => f.path)]).toEqual([slug, expected]);
    }
  });

  // Doc 3 §7's terms are content with a version of their own, so the folder gets the
  // document rather than a restatement of it, exactly like the cards.
  it("carries the local vocabulary for the bundles whose cards declare one", () => {
    const carrying = EXPORTS.filter((e) => fileMap(e.files).has(BUNDLE_VOCABULARY));
    // The archive's one local term (`lupo/pii-handling`) is declared by two frontline
    // triage cards and by nothing else. If that ever changes, this list changes with it
    // and the assertion below says which way.
    expect(carrying.map((e) => e.slug)).toEqual(["frontline-triage"]);
    for (const { slug, input, files } of carrying) {
      expect([slug, fileMap(files).get(BUNDLE_VOCABULARY)]).toEqual([
        slug,
        VOCABULARY?.text,
      ]);
      expect(localTermsUsed(input).map((t) => t.id)).toEqual(["lupo/pii-handling"]);
    }
  });

  it("writes the topology and every card verbatim", () => {
    for (const { slug, entry, files } of EXPORTS) {
      const map = fileMap(files);
      expect([slug, map.get(TOPOLOGY_DOT)]).toEqual([slug, entry.bundle.dot]);
      for (const card of entry.cardFiles) {
        const ref = card.file.replace(/^cards\//, "").replace(/\.yaml$/, "");
        expect([slug, card.file, map.get(cardFilePath(ref))]).toEqual([
          slug,
          card.file,
          card.text,
        ]);
      }
    }
  });

  it("ends every file with a newline", () => {
    for (const { slug, files } of EXPORTS) {
      for (const file of files) {
        expect([slug, file.path, file.text.endsWith("\n")]).toEqual([slug, file.path, true]);
      }
    }
  });
});

/* --------------------- the folder, scored on its own --------------------- */

/**
 * The claim the README makes that a reader can check: "These are the files that produced
 * them, so the same arithmetic on your side gives the same two numbers."
 *
 * So the folder is put back through the engine here with nothing but what is in it. The
 * bundle whose cards declare `lupo/pii-handling` used to fail this: the term is defined in
 * `content/ontology/extensions.yaml`, that file was not exported, and against the curated
 * core alone both cards were rejected with `card/unknown-term`, two nodes lost their cards
 * and both computed levels moved. It also meant DarkPrint's own `/upload` refused the
 * folder DarkPrint had just handed out.
 */
describe("a downloaded folder, resolved against nothing but itself", () => {
  it("re-resolves clean and reproduces both numbers its README quotes", () => {
    for (const { slug, entry, files } of EXPORTS) {
      const map = fileMap(files);

      // Everything a reader has, and nothing else: the topology, the cards, and the
      // vocabulary file if the folder carries one.
      const cardFiles: Record<string, string> = {};
      for (const [path, text] of map) {
        if (path.startsWith("cards/")) cardFiles[path] = text;
      }
      const vocabulary = map.get(BUNDLE_VOCABULARY);
      const terms =
        vocabulary === undefined
          ? []
          : parseOntologyTerms(parseYaml(vocabulary) as unknown, BUNDLE_VOCABULARY);

      const result = loadBundle(
        {
          manifest: entry.blueprint.manifest,
          dot: map.get(TOPOLOGY_DOT) ?? "",
          cardFiles,
        },
        { ontology: ontologyView(CORE_ONTOLOGY, terms) },
      );

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect([slug, errors.map((d) => `${d.code}: ${d.message}`)]).toEqual([slug, []]);
      expect([slug, result.analysis?.autonomy.level]).toEqual([
        slug,
        entry.analysis.autonomy.level,
      ]);
      expect([slug, result.analysis?.security.level]).toEqual([
        slug,
        entry.analysis.security.level,
      ]);
      // The digest too, which is the other thing the README invites a reader to recompute.
      expect([slug, result.blueprint?.digest]).toEqual([slug, entry.blueprint.digest]);
    }
  });

  it("fails the way it used to, once the vocabulary is taken back out", () => {
    // The control. Without it the test above could pass because nothing in the archive
    // uses a local term any more, and the export would have quietly stopped mattering.
    const carrying = EXPORTS.find((e) => fileMap(e.files).has(BUNDLE_VOCABULARY));
    expect(carrying, "no bundle exports a vocabulary any more").toBeDefined();
    if (carrying === undefined) return;

    const map = fileMap(carrying.files);
    const cardFiles: Record<string, string> = {};
    for (const [path, text] of map) {
      if (path.startsWith("cards/")) cardFiles[path] = text;
    }
    const result = loadBundle(
      {
        manifest: carrying.entry.blueprint.manifest,
        dot: map.get(TOPOLOGY_DOT) ?? "",
        cardFiles,
      },
      { ontology: ontologyView(CORE_ONTOLOGY) },
    );
    expect(result.diagnostics.map((d) => d.code)).toContain("card/unknown-term");
    expect(result.analysis?.security.level).not.toBe(carrying.entry.analysis.security.level);
  });
});

/* --------------------- the runnable half --------------------- */

/**
 * Doc 2 §11 item 10's actual requirement: the artefact has to run from a command line.
 * The nearest thing to proof available without an LLM behind it is the check Attractor
 * itself performs before a run — parse, then lint at error severity — applied to the exact
 * bytes the download contains rather than to a fixture.
 */
describe("factory.dot, as Attractor will read it", () => {
  it("parses and lints clean for every blueprint", () => {
    for (const { slug, files } of EXPORTS) {
      const factory = fileMap(files).get(FACTORY_DOT) ?? "";
      const parsed = parseDot(factory, FACTORY_DOT);
      expect([slug, hasErrors(parsed.diagnostics)]).toEqual([slug, false]);
      expect(parsed.graph).toBeDefined();
      if (parsed.graph === undefined) continue;
      expect([slug, lintAttractor(parsed.graph, factory, FACTORY_DOT)]).toEqual([slug, []]);
    }
  });

  // Doc 1 §0.1.2: the card's `spec` is the payload that instructs the agent, so a factory
  // whose nodes carry no prompt is a drawing rather than a pipeline. Every node in the
  // archive resolves to a card, so every one of them has to arrive with its spec inlined.
  it("carries one prompt per node, inlined from that node's card", () => {
    for (const { slug, entry, files } of EXPORTS) {
      const factory = fileMap(files).get(FACTORY_DOT) ?? "";
      const prompts = factory.match(/\bprompt=/g) ?? [];
      expect([slug, prompts.length]).toEqual([slug, entry.blueprint.nodes.length]);
      for (const node of entry.blueprint.nodes) {
        // The first line of the spec, escaped the way the emitter escapes it, has to be
        // findable in the file. Comparing whole specs would only re-test `emit.ts`.
        const head = node.card.spec.split("\n")[0].replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        expect([slug, node.nodeId, factory.includes(head)]).toEqual([slug, node.nodeId, true]);
      }
    }
  });

  // The pin is the compatibility claim of doc 1 §0.1.1 in one attribute: Attractor ignores
  // an attribute it does not reserve, so `card="id@version"` survives the round trip and
  // the file a user runs still says which card version it was built from.
  it("keeps the card pin on every node", () => {
    for (const { slug, entry, files } of EXPORTS) {
      const factory = fileMap(files).get(FACTORY_DOT) ?? "";
      for (const node of entry.blueprint.nodes) {
        expect([slug, node.ref, factory.includes(`card="${node.ref}"`)]).toEqual([
          slug,
          node.ref,
          true,
        ]);
      }
    }
  });

  // The claim the `model` field exists to make good on: a card that names a model produces
  // a factory that runs on it. Engine spec §2.6 reserves `llm_model` for exactly this, so
  // the attribute survives into the folder a reader downloads. Asserted here as well as in
  // `emit.test.ts` because this is the archive, where the models are real ids rather than
  // fixtures, and a card whose model never reached the DOT would be a broken promise on
  // every node page that shows it.
  it("carries the model onto every node whose card names one, and onto no other", () => {
    let named = 0;
    for (const { slug, entry, files } of EXPORTS) {
      const factory = fileMap(files).get(FACTORY_DOT) ?? "";
      const lines = factory.split("\n");
      for (const node of entry.blueprint.nodes) {
        // The node statement, which is the only line the node's id starts.
        const line = lines.find((l) => l.trimStart().startsWith(`${node.nodeId} [`)) ?? "";
        expect([slug, node.nodeId, line === ""]).toEqual([slug, node.nodeId, false]);
        const model = node.card.model;
        if (model === undefined) {
          expect([slug, node.nodeId, line.includes("llm_model=")]).toEqual([
            slug,
            node.nodeId,
            false,
          ]);
          continue;
        }
        named += 1;
        expect([slug, node.nodeId, line.includes(`llm_model="${model}"`)]).toEqual([
          slug,
          node.nodeId,
          true,
        ]);
      }
    }
    // A scan that matched nothing would pass every assertion above.
    expect(named).toBeGreaterThan(0);
  });
});

/* --------------------- determinism --------------------- */

describe("determinism", () => {
  it("produces identical bytes on a second call", () => {
    for (const { slug, input, files } of EXPORTS) {
      expect([slug, exportBundle(input)]).toEqual([slug, files]);
    }
  });

  it("ignores the order the cards were handed over in", () => {
    for (const { slug, input, files } of EXPORTS) {
      const reversed = { ...input, cards: [...input.cards].reverse() };
      expect([slug, exportBundle(reversed)]).toEqual([slug, files]);
    }
  });

  it("collapses a card pinned by two nodes onto one file", () => {
    for (const { slug, input, files } of EXPORTS) {
      const duplicated = { ...input, cards: [...input.cards, ...input.cards] };
      expect([slug, exportBundle(duplicated)]).toEqual([slug, files]);
    }
  });

  // A card the archive carries but no node instantiates is not part of the download: the
  // graph decides what ships, not whatever the reader handed over.
  it("exports only the cards the graph pins", () => {
    const first = EXPORTS[0];
    const extra = {
      ...first.input,
      cards: [...first.input.cards, { ref: "not-pinned@9.9.9", text: "id: not-pinned\n" }],
    };
    expect(exportBundle(extra)).toEqual(first.files);
  });
});

describe("a bundle that cannot be exported", () => {
  it("refuses to write a folder whose factory.dot references a card it does not contain", () => {
    const { input } = EXPORTS[0];
    const missing = input.blueprint.nodes[0].ref;
    const short = { ...input, cards: input.cards.filter((c) => c.ref !== missing) };
    expect(() => exportBundle(short)).toThrow(missing);
  });
});

/* --------------------- where the files are served --------------------- */

describe("paths", () => {
  it("puts one directory under public/bundles per blueprint", () => {
    expect(bundleDir("starter-software-factory")).toBe("bundles/starter-software-factory");
  });

  it("names a card file after its pinned ref", () => {
    expect(cardFilePath("spec-planner@1.0.0")).toBe("cards/spec-planner@1.0.0.yaml");
  });

  it("percent-encodes every segment of a href and keeps the separators", () => {
    expect(bundleHref("starter-software-factory", FACTORY_DOT)).toBe(
      "/bundles/starter-software-factory/factory.dot",
    );
    expect(bundleHref("starter-software-factory", cardFilePath("spec-planner@1.0.0"))).toBe(
      "/bundles/starter-software-factory/cards/spec-planner%401.0.0.yaml",
    );
  });
});

/* --------------------- the README --------------------- */

describe("the README", () => {
  const readmes = EXPORTS.map((e) => ({
    slug: e.slug,
    entry: e.entry,
    text: fileMap(e.files).get(BUNDLE_README) ?? "",
  }));

  it("states the blueprint's identity and its full content digest", () => {
    for (const { slug, entry, text } of readmes) {
      expect([slug, text.startsWith(`# ${entry.blueprint.manifest.title}\n`)]).toEqual([
        slug,
        true,
      ]);
      expect([slug, text.includes(entry.blueprint.digest)]).toEqual([slug, true]);
      expect([slug, text.includes(`blueprint      ${slug}`)]).toEqual([slug, true]);
      expect([slug, text.includes(`v${entry.blueprint.manifest.ontologyVersion}`)]).toEqual([
        slug,
        true,
      ]);
    }
  });

  // Doc 1 §0.1.3 and the item-10 contract: where execution happens, the command, and the
  // fact that DarkPrint runs nothing and collects nothing.
  it("says where execution happens, how to start it, and what is collected", () => {
    for (const { slug, text } of readmes) {
      expect([slug, text.includes("This runs on your machine.")]).toEqual([slug, true]);
      expect([slug, text.includes(`attractor run ${FACTORY_DOT}`)]).toEqual([slug, true]);
      expect([slug, text.includes(`attractor validate ${FACTORY_DOT}`)]).toEqual([slug, true]);
      expect([slug, text.includes("executes nothing and holds none of your provider keys")]).toEqual(
        [slug, true],
      );
      expect([slug, text.includes("No file in this folder calls home")]).toEqual([slug, true]);
    }
  });

  // The listing has to name every file in the folder: a reader who is told to recompute
  // the digest and the scores needs to know which files are the inputs.
  it("lists every file the folder actually contains", () => {
    for (const { slug, files, text } of EXPORTS.map((e) => ({
      ...e,
      text: fileMap(e.files).get(BUNDLE_README) ?? "",
    }))) {
      const listing = text.split("## What is in the folder")[1]?.split("```")[1] ?? "";
      expect([slug, listing.includes(FACTORY_DOT)]).toEqual([slug, true]);
      expect([slug, listing.includes(TOPOLOGY_DOT)]).toEqual([slug, true]);
      const carries = fileMap(files).has(BUNDLE_VOCABULARY);
      expect([slug, listing.includes(BUNDLE_VOCABULARY)]).toEqual([slug, carries]);
      // And a bundle with no local term says nothing about a vocabulary it does not have.
      expect([slug, text.includes("local terms")]).toEqual([slug, carries]);
    }
  });

  it("names the local terms it was scored with, where there are any", () => {
    for (const { slug, input, files } of EXPORTS) {
      const local = localTermsUsed(input);
      if (local.length === 0) continue;
      const text = fileMap(files).get(BUNDLE_README) ?? "";
      for (const term of local) {
        expect([slug, term.id, text.includes(term.id)]).toEqual([slug, term.id, true]);
      }
      expect([slug, text.includes(BUNDLE_VOCABULARY)]).toEqual([slug, true]);
    }
  });

  // Telemetry, accounts and publishing are Fase 4. The README may describe the design and
  // has to say it does not exist, so nobody downloads this expecting a dashboard.
  it("says the opt-in reporting channel is designed and not built", () => {
    for (const { slug, text } of readmes) {
      expect([slug, text.includes("It is designed and not built")]).toEqual([slug, true]);
    }
  });

  // Doc 1 §8.3: the numbers show their working. Quoted rather than restated — a
  // paraphrase would be a second implementation of the analyzer inside a README.
  //
  // Autonomy is quoted through `autonomyStatement`, which is the whole engine sentence
  // less the band ordinal it ends on (doc 2 §1.1). Still the engine's own wording and
  // still its own arithmetic — the transform only drops the number, and the test below
  // holds it to that.
  it("quotes both analyzers verbatim", () => {
    for (const { slug, entry, text } of readmes) {
      expect([
        slug,
        text.includes(`> ${autonomyStatement(entry.analysis.autonomy.rationale)}`),
      ]).toEqual([slug, true]);
      expect([slug, text.includes(`> ${entry.analysis.security.rationale}`)]).toEqual([slug, true]);
      expect([slug, text.includes(`Autonomy: ${entry.analysis.autonomy.label}.`)]).toEqual([
        slug,
        true,
      ]);
      expect([slug, text.includes(`Security level ${entry.analysis.security.level}.`)]).toEqual([
        slug,
        true,
      ]);
    }
  });

  /**
   * Doc 2 §1.1, on the surface that outlives every other one.
   *
   * The README is the file that stays behind in somebody's repository long after they
   * have left the site, so the rule that keeps the autonomy band off a page holds here
   * too: the only number a reader is taught to read as a rung is the organisational
   * maturity ladder, and a second small integer beside the word "autonomy" reads as the
   * same scale. The class carries the reading instead, and it loses nothing — it is what
   * the band is called.
   *
   * The security level is a different metric on a real 0-to-4 penalty scale, and it is
   * deliberately untouched.
   */
  it("states the autonomy class and never the band behind it", () => {
    for (const { slug, entry, text } of readmes) {
      expect([slug, text.includes(`Autonomy: ${entry.analysis.autonomy.label}.`)]).toEqual([
        slug,
        true,
      ]);
      // No "autonomy level 4", no "→ level 4 (Closed-loop)", however it is spelled.
      const ordinal = /autonomy[^.\n]{0,24}level\s*\d|→\s*level\s*\d/i;
      expect([slug, ordinal.test(text)]).toEqual([slug, false]);
    }
  });

  /**
   * The ordinal's vocabulary, not only its digits.
   *
   * The regex above wants a number touching the word, so the closing paragraph — "The
   * autonomy level says what this factory automates" — walked past it in all nine
   * READMEs, as did "the same arithmetic on your side gives the same two numbers" beside a
   * reading that is no longer a number. `level` belongs to the security scale and to the
   * 1-to-5 organisational ladder; the README is the file that stays behind in somebody's
   * repository, so it is the last place the two should be spelled alike.
   *
   * "Security level" stays, and this checks it stays: the fix is a distinction, not a
   * search-and-replace, and a README that stopped naming the security scale would have
   * lost a real reading.
   */
  it("keeps the ordinal vocabulary for the scale that has one", () => {
    for (const { slug, entry, text } of readmes) {
      const lower = text.toLowerCase();
      for (const banned of ["autonomy level", "the same two numbers", "both numbers come"]) {
        expect([slug, banned, lower.includes(banned)]).toEqual([slug, banned, false]);
      }
      expect([slug, text.includes("The autonomy class says what this blueprint automates")]).toEqual(
        [slug, true],
      );
      expect([slug, text.includes(`Security level ${entry.analysis.security.level}.`)]).toEqual([
        slug,
        true,
      ]);
    }
  });

  /**
   * Doc 2 §1.1. Three of the nine bundles put a person in the graph, and the README of
   * those three has to name the node without any of the vocabulary of a shortfall. The
   * check is deliberately two-sided: the human node is named (doc 1 §8.3 wants the
   * working shown) and no scale, comparison or verdict is printed around the number.
   */
  it("names the human nodes and grades nobody", () => {
    const withHumans = readmes.filter(
      ({ entry }) => entry.analysis.autonomy.contributions.some((c) => c.requiresHuman),
    );
    expect(withHumans.map((r) => r.slug)).toEqual([
      "frontline-triage",
      "guarded-merge-bot",
      "incident-commander",
    ]);

    for (const { slug, entry, text } of withHumans) {
      expect([slug, text.includes("Where a person acts:")]).toEqual([slug, true]);
      for (const contribution of entry.analysis.autonomy.contributions) {
        if (!contribution.requiresHuman) continue;
        expect([
          slug,
          contribution.nodeId,
          text.includes(`- \`${contribution.nodeId}\` (${contribution.name}): ${contribution.explanation}`),
        ]).toEqual([slug, contribution.nodeId, true]);
      }
    }

    for (const { slug, text } of readmes) {
      expect([slug, text.includes("Nothing here is a grade.")]).toEqual([slug, true]);
      for (const banned of [
        "out of 4",
        "fully autonomous",
        "not autonomous",
        "room for improvement",
        "should automate",
      ]) {
        expect([slug, banned, text.includes(banned)]).toEqual([slug, banned, false]);
      }
    }
  });

  it("lists every security finding, in the analyzer's words", () => {
    for (const { slug, entry, text } of readmes) {
      if (entry.analysis.security.findings.length === 0) {
        expect([slug, text.includes("What was charged:")]).toEqual([slug, false]);
        continue;
      }
      expect([slug, text.includes("What was charged:")]).toEqual([slug, true]);
      for (const finding of entry.analysis.security.findings) {
        expect([slug, finding.marker, text.includes(finding.explanation)]).toEqual([
          slug,
          finding.marker,
          true,
        ]);
      }
    }
  });

  it("tabulates every node with the card version it pins", () => {
    for (const { slug, entry, text } of readmes) {
      for (const node of entry.blueprint.nodes) {
        const phase =
          node.card.phases.length === 0 ? "none declared" : node.card.phases.join(", ");
        expect([slug, node.nodeId, text.includes(`| \`${node.nodeId}\` | \`${node.ref}\` | ${phase} |`)]).toEqual(
          [slug, node.nodeId, true],
        );
      }
    }
  });

  /**
   * The one kind of path in a bundle that resolves to nothing.
   *
   * 51 of the archive's 53 cards declare `skill: skills/<name>.md`, no `skills/` directory
   * exists anywhere in the repo, and none is meant to: `skill` is a pointer and the engine
   * reads nothing at the other end of it. What was wrong was the silence. The folder
   * listing named four kinds of file, the reader opened `cards/intent-router@1.0.0.yaml`,
   * found a path, went looking for it and found nothing, with no sentence anywhere saying
   * the document was theirs to write.
   *
   * So the README names every one of them, and this checks it against the graph rather
   * than against a count: every node whose card declares a skill is listed, with its path,
   * in a bundle that has any.
   */
  it("names the skill documents the folder does not carry", () => {
    const withSkills = readmes.filter(({ entry }) =>
      entry.blueprint.nodes.some((node) => node.card.skill !== undefined),
    );
    // The point of the block is that most bundles hit it. If the archive ever stops
    // declaring skills this test should be deleted with the block, not quietly pass.
    expect(withSkills.length).toBeGreaterThan(0);

    for (const { slug, entry, text } of withSkills) {
      const pointers = skillPointers(toInput(entry));
      expect([slug, pointers.length > 0]).toEqual([slug, true]);
      expect([slug, text.includes("There is no `skills/` directory above")]).toEqual([
        slug,
        true,
      ]);
      for (const pointer of pointers) {
        expect([slug, pointer.nodeId, text.includes(pointer.skill)]).toEqual([
          slug,
          pointer.nodeId,
          true,
        ]);
        expect([slug, pointer.nodeId, text.includes(pointer.nodeId)]).toEqual([
          slug,
          pointer.nodeId,
          true,
        ]);
      }
    }

    // Nothing is invented on the way out: no exported file is a skill document, and no
    // card is rewritten to drop the pointer.
    for (const { slug, files } of EXPORTS) {
      for (const file of files) {
        expect([slug, file.path, file.path.startsWith("skills/")]).toEqual([
          slug,
          file.path,
          false,
        ]);
      }
    }
  });

  it("reads every skill pointer off the graph, in node order", () => {
    for (const { slug, entry, input } of EXPORTS) {
      const pointers = skillPointers(input);
      const expected = entry.blueprint.nodes
        .filter((node) => node.card.skill !== undefined)
        .map((node) => ({ nodeId: node.nodeId, ref: node.ref, skill: node.card.skill }));
      expect([slug, pointers]).toEqual([slug, expected]);
    }
  });

  it("is the same text whether it is asked for directly or through exportBundle", () => {
    for (const { input, files } of EXPORTS) {
      expect(fileMap(files).get(BUNDLE_README)).toBe(bundleReadme(input));
    }
  });
});

/* --------------------- AGENTS.md --------------------- */

/**
 * The agent-facing file, over the real archive.
 *
 * `README.md` addresses a person deciding whether to run the folder; this addresses the
 * agent being asked to fit the pattern into a codebase. The cases below are the ones
 * where a generator can be wrong in a way nobody notices: a prohibition printed as
 * checkable when nothing checks it, a claim about the codebase this file has never seen,
 * or a node whose declared input no edge feeds going unmentioned so an agent draws the
 * edge the pattern exists to leave out.
 */
describe("bundleAgents", () => {
  it("ships one with every bundle, and lists it in the README's own folder table", () => {
    for (const { slug, files } of EXPORTS) {
      const map = fileMap(files);
      expect(map.has(BUNDLE_AGENTS), slug).toBe(true);
      expect(map.get(BUNDLE_README), slug).toContain(BUNDLE_AGENTS);
    }
  });

  it("is deterministic, like every other exported file", () => {
    for (const { input, files } of EXPORTS) {
      expect(fileMap(files).get(BUNDLE_AGENTS)).toBe(bundleAgents(input));
    }
  });

  it("keeps enforced prohibitions apart from free text", () => {
    const starter = EXPORTS.find((e) => e.slug === "starter-software-factory");
    const text = fileMap(starter!.files).get(BUNDLE_AGENTS) ?? "";

    // `acceptance-criteria` is a data-type, so the resolver holds the graph to it.
    expect(text).toContain("`builder` must never receive `acceptance-criteria`.");
    expect(flat(text)).toContain("These are enforced.");

    // "read the checks the work will be run against" names no term. Nothing checks it,
    // and a file that implied otherwise would be telling an agent it has a guardrail it
    // does not have.
    expect(flat(text)).toContain("Stated by the author and checked by nothing.");
    expect(text).toContain("read the checks the work will be run against");
  });

  it("never prints a free-text prohibition under the enforced heading", () => {
    for (const { slug, input, files } of EXPORTS) {
      const text = fileMap(files).get(BUNDLE_AGENTS) ?? "";
      const enforcedBlock = text.slice(
        text.indexOf("These are enforced."),
        text.indexOf("Stated by the author"),
      );
      if (enforcedBlock === "") continue;
      const view = input.blueprint.ontology;
      for (const node of input.blueprint.nodes) {
        for (const entry of node.card.cannot) {
          const term = view.resolve(entry)?.term;
          if (term?.kind === "data-type") continue;
          expect(enforcedBlock, `${slug}: ${entry}`).not.toContain(entry);
        }
      }
    }
  });

  /** `wrap()` lays the prose out at 94 columns, so a sentence assertion has to run over
      the flattened text. Matching the file as written would pass or fail on where a line
      happened to break. */
  const flat = (text: string) => text.replace(/\s+/g, " ");

  it("names the nodes whose declared inputs no edge feeds", () => {
    // The starter's `builder` is the case: its brief arrives with the run, and the edge
    // that is not there is the whole pattern. An agent told only "Takes: brief" is one
    // step from drawing it.
    const starter = EXPORTS.find((e) => e.slug === "starter-software-factory");
    const text = fileMap(starter!.files).get(BUNDLE_AGENTS) ?? "";
    expect(flat(text)).toContain("`builder`");
    expect(flat(text)).toContain("no edge in this graph feeds");
    expect(flat(text)).toContain("That is not a gap to fill.");
  });

  it("says it has not seen the codebase, on every bundle", () => {
    // The one claim this file must never make. It knows the pattern and nothing else.
    for (const { slug, files } of EXPORTS) {
      const text = fileMap(files).get(BUNDLE_AGENTS) ?? "";
      expect(flat(text), slug).toContain("it has not seen the codebase you are about to change");
      expect(text, slug).toContain("## What this file does not tell you");
    }
  });

  it("leaves no empty heading for the notes an uploader has not written", () => {
    // A heading with nothing under it reads as a section somebody forgot to fill in,
    // which is a promise the folder does not keep. The file states what it does not know
    // in prose instead.
    for (const { slug, files } of EXPORTS) {
      const text = fileMap(files).get(BUNDLE_AGENTS) ?? "";
      // Top-level sections only. `## The nodes` is a container whose body is its `###`
      // subsections, so a rule that demanded prose directly under every heading would be
      // asserting a layout rather than the thing that matters.
      const headings = [...text.matchAll(/^## .+$/gm)].map((m) => ({
        title: m[0],
        at: m.index ?? 0,
      }));
      for (const [i, heading] of headings.entries()) {
        const end = headings[i + 1]?.at ?? text.length;
        const body = text.slice(heading.at, end).split("\n").slice(1).join("\n").trim();
        expect(body, `${slug}: ${heading.title} is empty`).not.toBe("");
      }
    }
  });
});
