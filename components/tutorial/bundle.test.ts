/* ============================================================
   The folder /tutorial hands over resolves, and it is checked here
   ------------------------------------------------------------
   The page's whole promise is that a reader who fills in the blanks
   downloads a blueprint the engine accepts. Nothing on the page can
   keep that promise: the fields are validated against the vocabulary
   and against each other, and neither of those is the resolver.

   So this file runs the example values through `bundleFiles` and then
   through the SAME `loadBundle` `/upload` runs in the tab, and
   asserts what comes back. It is a fixture test in the sense that it
   pins the tutorial's own content, and that is the point: every
   example value in `blanks.ts` is a value somebody will download.

   ── why the assertions name codes and not counts ──
   A count is satisfied by the wrong diagnostic. Every cell below says
   which finding it expects and which it forbids, because the four
   defects this content had before it was measured were all of them
   error-severity findings that a `length === 0` cell would have
   caught and then said nothing useful about.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY, hasErrors, loadBundle, ontologyView } from "@/lib/core";
import { CLI_VERBS } from "@/packages/cli/src/index";

import { BLANKS, RUBRIC_BLANK_IDS, exampleValues, type BlankValues } from "./blanks";
import { archiveEntries, bundleFiles, cardFilesOf, rubricStarted } from "./bundle";
import { identifierFaults } from "./state";
import { storedZip } from "./zip";

const ONTOLOGY = ontologyView(CORE_ONTOLOGY);

/** The example values with every rubric blank cleared: what step 06 offers. */
function withoutRubric(): BlankValues {
  const values: Record<string, string> = { ...exampleValues() };
  for (const id of RUBRIC_BLANK_IDS) values[id] = "";
  return values;
}

/** The bundle through the engine, composed the way the page composes it. */
function resolve(values: BlankValues) {
  const files = bundleFiles(values);
  const dot = files.find((file) => file.path === "topology.dot");
  if (dot === undefined) throw new Error("no topology.dot in the folder");
  return {
    files,
    result: loadBundle(
      {
        /* `stubManifestFor` names a bundle after its DIRECTORY, and the reader unzips
           `<blueprint_name>.zip`, so this is the manifest the CLI will build for the same
           bytes. Nothing on the diagnostics path reads it. */
        manifest: {
          slug: values.blueprint_name ?? "",
          title: values.blueprint_name ?? "",
          summary: "",
          tags: [],
        },
        dot: dot.text,
        cardFiles: cardFilesOf(files),
      },
      { ontology: ONTOLOGY },
    ),
  };
}

const codes = (result: ReturnType<typeof resolve>["result"]): string[] =>
  result.diagnostics.map((d) => `${d.severity}:${d.code}`);

describe("the example bundle resolves", () => {
  it.each([
    ["with the rubric", exampleValues()],
    ["without the rubric", withoutRubric()],
  ])("%s, with no error-severity diagnostic", (_name, values) => {
    const { result } = resolve(values);
    /* The message and not the count, because a bare `false` here tells whoever broke it
       nothing about which of forty codes fired. */
    expect(
      result.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`),
    ).toEqual([]);
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.blueprint, "the bundle did not resolve at all").toBeDefined();
  });

  /**
   * The two warnings the tutorial's graph earns, named rather than tolerated.
   *
   * Both are properties of the shape it teaches, and the page says so in step 05 and step
   * 07. Pinning them here is what makes those two paragraphs checkable: if the analyser
   * stops producing either, the page is explaining a finding nobody gets.
   */
  it("earns `criteria-relayed-through-judge` once the rubric is wired, and nothing else", () => {
    const { result } = resolve(exampleValues());
    expect(codes(result)).toEqual(["warning:analysis/criteria-relayed-through-judge"]);
  });

  it("earns `criteria-leak-unanchored` without a rubric, and nothing else", () => {
    const { result } = resolve(withoutRubric());
    expect(codes(result)).toEqual(["warning:analysis/criteria-leak-unanchored"]);
  });

  /**
   * The cap is load-bearing, and this is the cell that says so.
   *
   * Step 04 asks for a number and step 05 explains what it buys. Clear it and
   * `unbounded-loop` is inferred on both members of the cycle, which is the finding the
   * page describes. A cell that only asserted the clean case would pass just as well
   * against a card that never wrote `params` at all.
   */
  it("charges `unbounded-loop` when the checker declares no cap, and not when it does", () => {
    const capped = resolve(exampleValues()).result;
    expect(capped.analysis?.security.findings.map((f) => f.marker)).not.toContain(
      "unbounded-loop",
    );

    const uncapped = resolve({ ...exampleValues(), c3_max_iterations: "" }).result;
    const markers = uncapped.analysis?.security.findings ?? [];
    expect(markers.filter((f) => f.marker === "unbounded-loop").map((f) => f.nodeId).sort()).toEqual(
      ["extract", "verify"],
    );
  });

  /**
   * `cannot: [acceptance-criteria]` refuses an edge; it does not silence a marker.
   *
   * The design handoff said the opposite ("without this line the analyser charges
   * `criteria-leak`"), and the page now says what this asserts. Removing the guard moves
   * nothing on this graph, because the criteria walk absorbs at the validation node and
   * never reaches the extractor. What the guard does is make the wiring refusable, which
   * the second half drives.
   */
  it("makes a criteria edge into the extractor refusable, rather than silencing a marker", () => {
    const values = exampleValues();
    const guarded = resolve(values);
    const cards = cardFilesOf(guarded.files);
    const extractorPath = `cards/${values.c2_id}@1.0.0.yaml`;

    expect(cards[extractorPath], "the extractor declares no prohibition").toContain(
      "cannot:\n  - acceptance-criteria",
    );

    /* The same bundle with the criteria wired straight into the extractor. Written here
       rather than offered on the page: this is the mistake step 07 is about, and a reader
       should meet it as a sentence, not as a control that breaks their folder. */
    const dot = guarded.files
      .find((file) => file.path === "topology.dot")!
      .text.replace(
        `  rubric -> ${values.n3} [out="criteria", in="criteria"];\n`,
        `  rubric -> ${values.n3} [out="criteria", in="criteria"];\n` +
          `  rubric -> ${values.n2} [out="criteria", in="criteria"];\n`,
      );
    const wired = loadBundle(
      {
        manifest: { slug: "x", title: "x", summary: "", tags: [] },
        dot,
        cardFiles: {
          ...cards,
          [extractorPath]: cards[extractorPath].replace(
            "inputs:\n",
            'inputs:\n  - name: criteria\n    description: "the rubric"\n    type: acceptance-criteria\n',
          ),
        },
      },
      { ontology: ONTOLOGY },
    );
    expect(wired.diagnostics.map((d) => d.code)).toContain("bundle/prohibition-violated");
    expect(hasErrors(wired.diagnostics)).toBe(true);
  });
});

describe("the folder is the shape a published bundle has", () => {
  it("writes six files without a rubric and eight with one", () => {
    expect(bundleFiles(withoutRubric()).map((f) => f.path)).toEqual([
      "topology.dot",
      "README.md",
      "cards/seed-crawler@1.0.0.yaml",
      "cards/fact-extractor@1.0.0.yaml",
      "cards/citation-checker@1.0.0.yaml",
      "cards/knowledge-writer@1.0.0.yaml",
    ]);
    expect(bundleFiles(exampleValues()).map((f) => f.path)).toEqual([
      "topology.dot",
      "README.md",
      "cards/seed-crawler@1.0.0.yaml",
      "cards/fact-extractor@1.0.0.yaml",
      "cards/citation-checker@1.0.0.yaml",
      "cards/knowledge-writer@1.0.0.yaml",
      "cards/rubric-author@1.0.0.yaml",
      "evals/scenario.yaml",
    ]);
  });

  /**
   * No `blueprint.yaml`, and no manifest fields on the `digraph` line either.
   *
   * The handoff wrote `summary`, `category` and `tags` as root graph attributes. They
   * parse and they are read by nothing: the only consumer of `graphAttrs` in this tree
   * reads `label` and `goal`. A tutorial whose first step teaches a no-op is the drift the
   * repository's own rules exist to stop, so the summary went to `README.md`, which is
   * where a published bundle carries it.
   */
  it("keeps the graph file to the root attributes a real bundle uses", () => {
    const dot = bundleFiles(exampleValues()).find((f) => f.path === "topology.dot")!.text;
    expect(dot).toContain("  rankdir=LR;\n");
    for (const attr of ["summary", "category", "tags"]) {
      expect(dot, `\`${attr}\` on the digraph line is read by nothing`).not.toContain(`${attr}`);
    }
    expect(bundleFiles(exampleValues()).map((f) => f.path)).not.toContain("blueprint.yaml");
  });

  /**
   * The scenario never reaches the card reader.
   *
   * `loadBundle` treats every entry of `cardFiles` as a node card whatever its path, so
   * handing it the whole folder turns a clean bundle into eight `card/missing-field`
   * errors. The CLI is immune because `readCards` only opens `cards/`; `cardFilesOf` is
   * that same filter for a caller holding the files in memory, and this is the cell that
   * stops somebody deleting it.
   */
  it("hands the engine the cards and nothing else", () => {
    const files = bundleFiles(exampleValues());
    expect(Object.keys(cardFilesOf(files)).sort()).toEqual([
      "cards/citation-checker@1.0.0.yaml",
      "cards/fact-extractor@1.0.0.yaml",
      "cards/knowledge-writer@1.0.0.yaml",
      "cards/rubric-author@1.0.0.yaml",
      "cards/seed-crawler@1.0.0.yaml",
    ]);

    const dot = files.find((f) => f.path === "topology.dot")!.text;
    const everything: Record<string, string> = {};
    for (const file of files) if (file.path !== "topology.dot") everything[file.path] = file.text;
    const wrong = loadBundle(
      { manifest: { slug: "x", title: "x", summary: "", tags: [] }, dot, cardFiles: everything },
      { ontology: ONTOLOGY },
    );
    expect(
      hasErrors(wrong.diagnostics),
      "passing the whole folder as cards used to look harmless",
    ).toBe(true);
  });
});

/**
 * The archive's own directory, read the way an extractor reads it.
 *
 * Not the array `bundleFiles` returned: that is the input. What a reader ends up with is
 * whatever the central directory says is in the file, and the two are the same only if the
 * writer put them there. Walking backwards from the end-of-central-directory record is how
 * `unzip` finds the list, so it is how this finds it too.
 */
async function entryNames(blob: Blob): Promise<string[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  expect(end, "no end-of-central-directory record").toBeGreaterThanOrEqual(0);

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names: string[] = [];
  for (let i = 0; i < count; i += 1) {
    expect(view.getUint32(at, true), "not a central directory record").toBe(0x02014b50);
    const nameLength = view.getUint16(at + 28, true);
    names.push(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return names;
}

describe("the zip unpacks to the folder", () => {
  it.each([
    ["with the rubric", exampleValues(), 8],
    ["without the rubric", withoutRubric(), 6],
  ])("%s, every file and no others, under the blueprint's own folder", async (_n, values, expected) => {
    const files = bundleFiles(values);
    expect(files.length).toBe(expected);
    const slug = values.blueprint_name ?? "";
    const names = await entryNames(storedZip(archiveEntries(files, slug)));
    expect(names).toEqual(files.map((file) => `${slug}/${file.path}`));
  });

  /**
   * The two commands the page prints beside the button work on what the button produced.
   *
   * They read `darkprint validate ./<blueprint_name>`, and the archive used to put its
   * eight files at the root: unzipping scattered them into the reader's current directory
   * and both commands found nothing. This is the cell that keeps the printed command and
   * the download in agreement.
   */
  it("unpacks to the directory the printed commands name", async () => {
    const values = exampleValues();
    const names = await entryNames(storedZip(archiveEntries(bundleFiles(values), values.blueprint_name!)));
    expect(new Set(names.map((name) => name.split("/")[0]))).toEqual(
      new Set([values.blueprint_name]),
    );
    expect(names).toContain(`${values.blueprint_name}/topology.dot`);
  });

  it("falls back to a name rather than writing entries at the root", async () => {
    const names = await entryNames(storedZip(archiveEntries(bundleFiles(exampleValues()), "")));
    expect(names.every((name) => name.startsWith("blueprint/"))).toBe(true);
  });

  /**
   * The archive carries no directory entries, and the paths still nest.
   *
   * `cards/` and `evals/` exist only as a prefix, which `storedZip`'s header states as a
   * deliberate limit. This is the cell that keeps that limit true rather than a note: a
   * writer that started emitting zero-length directory records would add two names an
   * extractor turns into two empty folders beside the real ones.
   */
  it("names every directory only as a path prefix", async () => {
    const values = exampleValues();
    const root = values.blueprint_name!;
    const names = await entryNames(storedZip(archiveEntries(bundleFiles(values), root)));
    expect(names.filter((name) => name.endsWith("/"))).toEqual([]);
    expect(names.filter((name) => name.startsWith(`${root}/cards/`)).length).toBe(5);
    expect(names.filter((name) => name.startsWith(`${root}/evals/`)).length).toBe(1);
  });
});

/**
 * The card carries the value the reader typed, in the field they typed it into.
 *
 * Everything above asks whether the folder RESOLVES, and resolving is a weaker claim than
 * being right. Mutation found the gap: swapping `action` and `spec` on every card reddened
 * nothing, because both are required non-empty strings and the engine has no opinion about
 * which prose belongs in which. Dropping `will_not` entirely reddened nothing either, for
 * the plainer reason that the engine never reads it.
 *
 * So these read the emitted YAML back and check the pairing. A tutorial whose step 02 asks
 * for a `spec` and files it under `action` teaches the wrong field with a green suite.
 */
describe("each card says what the reader wrote where they wrote it", () => {
  const cardText = (values: BlankValues, id: string): string => {
    const file = bundleFiles(values).find((f) => f.path === `cards/${id}@1.0.0.yaml`);
    expect(file, `no card for \`${id}\``).toBeDefined();
    return file!.text;
  };

  it.each([
    ["c1_id", "c1_name", "c1_action", "c1_spec", "c1_will_not"],
    ["c2_id", "c2_name", "c2_action", undefined, "c2_will_not"],
    ["c3_id", "c3_name", "c3_action", undefined, "c3_will_not"],
  ] as const)("%s", (idKey, nameKey, actionKey, specKey, willNotKey) => {
    const values = exampleValues();
    const text = cardText(values, values[idKey]!);
    /* Anchored to the key, so a value that appears somewhere else in the document does not
       satisfy the cell. The block scalar puts its content on the next line, indented. */
    expect(text).toContain(`name: ${values[nameKey]}`);
    expect(text).toContain(`action: >-\n  ${values[actionKey]}`);
    if (specKey !== undefined) expect(text).toContain(`spec: >-\n  ${values[specKey]}`);
    expect(text).toContain(`will_not:\n  - ${values[willNotKey]}`);
    /* And the two prose fields are not each other's. */
    expect(text).not.toContain(`action: >-\n  ${values[specKey ?? "c1_spec"]}`);
  });

  it("writes the cap the reader typed under `params`, where the analyser reads it", () => {
    const values = exampleValues();
    expect(cardText(values, values.c3_id!)).toContain(
      `params:\n  max_iterations: ${values.c3_max_iterations}`,
    );
  });

  /**
   * The README's two commands are verbs the CLI has.
   *
   * It is prose the engine never reads, so nothing else here would notice it shipping
   * `darkprint lint .`. A reader who unzips the folder runs what its README tells them to,
   * and `/capabilities` publishes the list of verbs that exist.
   */
  it("puts only real verbs in the README", () => {
    const readme = bundleFiles(exampleValues()).find((f) => f.path === "README.md")!.text;
    const invoked = [...readme.matchAll(/darkprint ([a-z-]+)/g)].map((match) => match[1]);
    expect(invoked.length, "the README stopped naming any command").toBeGreaterThan(1);
    for (const verb of invoked) {
      expect(CLI_VERBS.map((entry) => entry.name), `README runs \`darkprint ${verb}\``).toContain(
        verb,
      );
    }
  });

  it("puts the reader's summary in the README, which is where a bundle carries one", () => {
    const values = exampleValues();
    const readme = bundleFiles(values).find((f) => f.path === "README.md")!.text;
    expect(readme).toContain(`# ${values.blueprint_name}\n\n${values.summary}`);
  });

  it("puts the reader's scenario name and golden fact in the scenario file", () => {
    const values = exampleValues();
    const scenario = bundleFiles(values).find((f) => f.path === "evals/scenario.yaml")!.text;
    expect(scenario).toContain(`scenario: ${values.s_name}`);
    expect(scenario).toContain(values.s_fact!);
    expect(scenario).toContain(`entries_min: ${values.s_min}`);
  });
});

describe("every vocabulary blank names a term the ontology holds", () => {
  it.each(BLANKS.filter((blank) => blank.vocab !== undefined).map((b) => [b.id, b] as const))(
    "%s",
    (_id, blank) => {
      const term = ONTOLOGY.get(blank.example);
      expect(term, `\`${blank.example}\` is not in the vocabulary`).toBeDefined();
      expect(term?.kind).toBe(blank.vocab);
    },
  );

  /**
   * A blank that is not held to a vocabulary must not be silently holding one.
   *
   * The three prose blanks were `cannot` entries in the handoff, where the resolver DOES
   * hold them to the data-type vocabulary and refused all three. They are `will_not` now,
   * and this asserts the rename stuck: if one of them were ever a term, that is the sign
   * it has drifted back into the enforced field.
   */
  it.each(["c1_will_not", "c2_will_not", "c3_will_not"])(
    "%s is prose, not a term",
    (id) => {
      const blank = BLANKS.find((b) => b.id === id);
      expect(blank?.vocab).toBeUndefined();
      expect(ONTOLOGY.get(blank?.example ?? "")).toBeUndefined();
    },
  );
});

/**
 * The promise is about what a READER types, not about the example.
 *
 * Every cell above drives `exampleValues()`, which is a fixture chosen to work. `blanks.ts`
 * claims the page "can promise the folder it hands over resolves", and that claim is about
 * the values somebody sits down and writes. Each row below is a value a reader can type
 * into a field with no vocabulary behind it, and each of them produced a
 * `card/parse-error` or a `dot/parse-error` before `scalar`, `block` and
 * `identifierFaults` existed.
 *
 * The two halves are different repairs and the split is the point. Free text is ESCAPED, so
 * the folder carries what was typed. An identifier is REFUSED on the page, because a card
 * id is a filename and a node name is a DOT node id, and quoting either would hand back a
 * folder whose own file names a reader cannot recognise.
 */
describe("what a reader can type still resolves", () => {
  const HOSTILE: readonly (readonly [string, string, string])[] = [
    ["c1_name", "Seed: Crawler", "a colon starts a mapping"],
    ["c1_name", "{not a map}", "a leading brace starts a flow mapping"],
    ["c1_name", '"quoted"', "quotes inside a plain scalar"],
    ["c1_name", "back\\slash", "a backslash"],
    ["c1_action", "first line\nsecond line", "a newline inside a block scalar"],
    ["c1_spec", "one\ntwo\nthree", "several newlines"],
    ["shape_page", '{url, "fetched_at", text}', "a quote inside the shape"],
    ["shape_entry", "{claim: url}", "a colon inside the shape"],
    ["c1_will_not", "leave the hosts: ever", "a colon in a prose prohibition"],
    ["c3_will_not", "#1 rewrite anything", "a leading hash, which is a comment"],
    ["summary", "Reads sites: turns them into entries", "a colon in the summary"],
    ["s_fact", "PEP 703: the GIL is optional", "a colon in the golden fact"],
    ["s_name", "python: release notes", "a colon in the scenario name"],
  ];

  it.each(HOSTILE)("%s = %j (%s)", (id, value) => {
    const values = { ...exampleValues(), [id]: value };
    expect(identifierFaults(values), "free text should never be refused").toEqual([]);
    const { result } = resolve(values);
    expect(
      result.diagnostics.filter((d) => d.severity === "error").map((d) => `${d.code}: ${d.message}`),
      `\`${value}\` in \`${id}\` broke the folder`,
    ).toEqual([]);
  });

  it.each([
    ["n1", "crawl pages", "a space is not a DOT node id"],
    ["n1", "1crawl", "a node id may not start with a digit"],
    ["n2", "graph", "a DOT keyword"],
    ["c1_id", "Seed Crawler", "a card id is lowercase and hyphenated"],
    ["c1_id", "café-crawler", "a card id is ASCII, which is also what the zip assumes"],
    ["blueprint_name", 'desk"1', "a quote would end the digraph name"],
  ])("refuses %s = %j on the page (%s)", (id, value) => {
    const faults = identifierFaults({ ...exampleValues(), [id]: value });
    expect(faults.map((fault) => fault.id)).toEqual([id]);
    /* Named in the message, so the reader is told which field and what shape it wants. */
    expect(faults[0].text).toContain(value);
  });

  it("refuses nothing the example values contain", () => {
    expect(identifierFaults(exampleValues())).toEqual([]);
    expect(identifierFaults(withoutRubric())).toEqual([]);
  });
});

describe("the derived rubric mode", () => {
  it("turns on with the rubric card's id and off without it", () => {
    expect(rubricStarted(exampleValues())).toBe(true);
    expect(rubricStarted(withoutRubric())).toBe(false);
    expect(rubricStarted({ ...exampleValues(), c5_id: "   " })).toBe(false);
  });
});
