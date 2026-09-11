/* ============================================================
   The hand-written half of the skill, held to the engine.

   `ontology.md` and `card-schema.md` are rendered from the engine and
   `generate-skill-refs.test.ts` holds them. Everything else under
   `skills/darkprint` is written by hand and served to strangers from
   `/skill/`, so the claims a person can get wrong are held here: the
   templates load through the same engine an author's bundle will
   meet, every diagnostic code the prose names is one the engine can
   emit, and the copy rules the rest of the site is held to apply.
   ============================================================ */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CORE_ONTOLOGY,
  ITERATION_CAP_KEYS,
  hasErrors,
  lintAttractor,
  loadCard,
  ontologyView,
  parseDot,
  readIterationCap,
} from "@/lib/core";
import { LIVE_PHASES, LIVE_PHASE_LABELS } from "@/lib/core/tutorial/live";
import { SKILL_ARCHIVE_ROOT } from "@/lib/skill";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SKILL_DIR = join(ROOT, SKILL_ARCHIVE_ROOT);
const read = (relative: string) => readFileSync(join(SKILL_DIR, relative), "utf8");

/** The files a person wrote. The two generated references are held by their own suite. */
const HAND_WRITTEN = [
  "SKILL.md",
  "references/dot-and-attractor.md",
  "references/preflight.md",
  "references/writing-cards.md",
  "references/live-preview.md",
  "templates/topology.dot",
  "templates/card.yaml",
  "templates/shell-tool-card.yaml",
];

const VIEW = ontologyView(CORE_ONTOLOGY);

describe("templates/topology.dot", () => {
  const source = read("templates/topology.dot");
  const parsed = parseDot(source, "topology.dot");

  it("parses with no error and passes the Attractor lint with no finding at all", () => {
    expect(parsed.graph, parsed.diagnostics.map((d) => d.message).join("\n")).toBeDefined();
    expect(hasErrors(parsed.diagnostics)).toBe(false);
    const lint = lintAttractor(parsed.graph!, source, "topology.dot");
    expect(lint.map((d) => `${d.code}: ${d.message}`)).toEqual([]);
  });

  /**
   * The template's loop used to carry two bare edges out of the check node, and under
   * Attractor's edge-selection order that is a fork decided by the spelling of the target
   * ids: the fix arm sorted first, so the compiled pipeline repaired until the cap was spent
   * and never shipped. Every fork the skeleton draws now guards each arm.
   */
  it("guards every arm of every fork with a condition", () => {
    const outgoing = new Map<string, string[]>();
    for (const edge of parsed.graph!.edges) {
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.attrs.condition ?? ""]);
    }
    const forks = [...outgoing].filter(([, arms]) => arms.length > 1);
    expect(forks.length, "the skeleton no longer draws a fork").toBeGreaterThan(0);
    for (const [node, arms] of forks) {
      for (const condition of arms) expect(condition, `an arm out of ${node} is unguarded`).not.toBe("");
    }
  });

  it("pins every node to a card", () => {
    for (const node of parsed.graph!.nodes) {
      expect(node.attrs.card, node.id).toMatch(/^[a-z0-9-]+@\d+\.\d+\.\d+$/);
    }
  });
});

describe.each(["templates/card.yaml", "templates/shell-tool-card.yaml"])("%s", (file) => {
  const result = loadCard(read(file), { ontology: VIEW, file });

  it("loads with no error and no retired key", () => {
    expect(result.card, result.diagnostics.map((d) => d.message).join("\n")).toBeDefined();
    expect(hasErrors(result.diagnostics)).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).not.toContain("card/retired-field");
  });
});

describe("templates/card.yaml", () => {
  const result = loadCard(read("templates/card.yaml"), { ontology: VIEW, file: "card.yaml" });

  /**
   * The cap is taught as the number Attractor counts, attempts after the first, under the key
   * Attractor uses. The engine accepts three spellings and the skeleton has to show the one
   * that survives a round trip through the exporter unchanged.
   */
  it("spells the iteration cap as max_retries and sets it to two", () => {
    expect(ITERATION_CAP_KEYS).toContain("max_retries");
    expect(Object.keys(result.card!.params)).toEqual(["max_retries"]);
    expect(readIterationCap(result.card!.params)).toBe(2);
  });
});

describe("templates/shell-tool-card.yaml", () => {
  const result = loadCard(read("templates/shell-tool-card.yaml"), {
    ontology: VIEW,
    file: "shell-tool-card.yaml",
  });

  it("is a shell-tool that carries its command, so the validator asks for nothing", () => {
    expect(result.card!.type).toBe("shell-tool");
    expect(result.card!.params.tool_command).toBe("npm test");
    expect(result.diagnostics.map((d) => d.code)).not.toContain("card/missing-field");
    expect(result.diagnostics.map((d) => d.code)).not.toContain("card/bad-type");
  });
});

describe("the hand-written references and SKILL.md", () => {
  /**
   * Every code the prose names is one the engine can emit. The union is a type, so it is
   * read off the source that declares it; a code renamed in the engine then fails here
   * rather than teaching an author to look for a diagnostic that never prints.
   */
  const declared = new Set(
    [...readFileSync(join(ROOT, "lib/core/diagnostics.ts"), "utf8").matchAll(/"([a-z]+\/[a-z0-9-]+)"/g)].map(
      (m) => m[1],
    ),
  );

  it("read the code union off the engine's own source", () => {
    expect(declared.has("bundle/prohibition-violated")).toBe(true);
    expect(declared.has("attractor/condition-syntax")).toBe(true);
  });

  /**
   * Markdown names a code in backticks; a template names it bare inside a comment. The bare
   * form is matched on a word boundary and `ontology/` is left out of it, because that
   * namespace is also the first segment of the vocabulary file's path.
   */
  it.each(HAND_WRITTEN)("%s names only diagnostic codes the engine emits", (file) => {
    const pattern = file.endsWith(".md")
      ? /`((?:dot|bundle|card|analysis|attractor|ontology)\/[a-z0-9-]+)`/g
      : /\b((?:dot|bundle|card|analysis|attractor)\/[a-z0-9-]+)\b/g;
    const named = [...read(file).matchAll(pattern)].map((m) => m[1]);
    expect(named.length, `${file} names no diagnostic at all`).toBeGreaterThan(0);
    for (const code of named) expect(declared.has(code), `${file} names ${code}`).toBe(true);
  });

  it.each(HAND_WRITTEN)("%s points at no local server", (file) => {
    expect(read(file)).not.toMatch(/localhost:\d+/);
  });

  /**
   * The copy rule the site is held to, applied to the files the site now serves. The em
   * dash used as a pause is the pattern a developer audience recognises, and the generated
   * references are excluded only because one quotes `schema.ts` verbatim.
   */
  it.each(HAND_WRITTEN)("%s uses no em dash as a pause", (file) => {
    expect(read(file)).not.toContain("—");
  });

  /**
   * The questions were renumbered when the phases were, and a cross-reference to a number
   * that now names a different question misdirects the interview at exactly the point it
   * is trying to send the agent back to. Every mention has to be a heading.
   */
  it("cross-references only questions SKILL.md asks", () => {
    const skill = read("SKILL.md");
    const asked = new Set([...skill.matchAll(/\*\*(Q\d+\.\d+)/g)].map((m) => m[1]));
    expect(asked.size).toBeGreaterThan(20);
    const mentioned = [...skill.matchAll(/\bQ\d+\.\d+\b/g)].map((m) => m[0]);
    for (const q of mentioned) expect(asked.has(q), `SKILL.md mentions ${q}, which it never asks`).toBe(true);
  });

  it("names every node type the vocabulary has, in SKILL.md", () => {
    const skill = read("SKILL.md");
    const concrete = CORE_ONTOLOGY.terms.filter(
      (t) => t.kind === "node-type" && !["human-in-the-loop", "evaluative", "orchestration"].includes(t.id),
    );
    expect(concrete.length).toBe(10);
    for (const term of concrete) expect(skill, term.id).toContain(`\`${term.id}\``);
  });

  /**
   * The live reference transcribes `lib/core/tutorial/live.ts` by hand, because the skill
   * reads markdown and not TypeScript. Every phase the PUT accepts has to be a row in it,
   * in the contract's order, and every label the page prints has to be quoted, or the
   * skill sends a phase the route refuses or promises the author a heading nobody shows.
   */
  it("transcribes every live phase and every page label, in the contract's order", () => {
    const reference = read("references/live-preview.md");
    const skill = read("SKILL.md");
    expect(LIVE_PHASES.length).toBe(9);
    const rows = LIVE_PHASES.map((phase) => reference.indexOf(`| \`${phase}\` |`));
    for (const [i, at] of rows.entries()) expect(at, `no row for ${LIVE_PHASES[i]}`).toBeGreaterThan(-1);
    expect(rows).toEqual([...rows].sort((a, b) => a - b));
    for (const phase of LIVE_PHASES) expect(skill, phase).toContain(`\`${phase}\``);
    for (const label of Object.values(LIVE_PHASE_LABELS)) expect(reference).toContain(`"${label}"`);
  });

  /**
   * Posture rule 6 forbids writing a file before the author confirms, and a live PUT that
   * reads `--data @draft.json` is a file written mid-interview. Only the curls aimed at the
   * live endpoint are held to stdin: the publish curl reads a file after the yes, legitimately.
   */
  it.each(["SKILL.md", "references/live-preview.md"])("%s sends the draft from stdin, never from a file", (file) => {
    /* A curl is its first line plus every line before it that ends in a backslash. */
    const liveCurls = [...read(file).matchAll(/curl (?:[^\n]*\\\n)*[^\n]*/g)]
      .map((m) => m[0])
      .filter((curl) => curl.includes("api/tutorial/live"));
    expect(liveCurls.length, "no curl aimed at the live endpoint").toBeGreaterThan(1);
    for (const curl of liveCurls) expect(curl).not.toMatch(/--data(?:-binary)? @[A-Za-z]/);
    expect(liveCurls.some((curl) => curl.includes("--data-binary @-"))).toBe(true);
  });

  it("ships exactly the files the packager expects, and nothing generated is hand-listed", () => {
    const onDisk = [
      ...readdirSync(SKILL_DIR).filter((f) => f.endsWith(".md")),
      ...readdirSync(join(SKILL_DIR, "references")).map((f) => `references/${f}`),
      ...readdirSync(join(SKILL_DIR, "templates")).map((f) => `templates/${f}`),
    ].sort();
    expect(onDisk).toEqual(
      [...HAND_WRITTEN, "references/ontology.md", "references/card-schema.md"].sort(),
    );
  });
});
