/* ============================================================
   DarkPrint content — the downloadable bundle
   Doc 2 §11 item 10: the starter "deve girare da riga di comando
   su una macchina utente". This module is the half of that which
   decides *what a bundle is once it leaves the site* — a resolved
   blueprint in, a set of files out — and nothing else. It writes
   no file, reads no file and never asks the clock, so the whole
   artefact is testable against the real archive rather than
   against a directory listing.

   `scripts/generate-bundles.ts` is the other half: it calls this
   once per blueprint at build time and puts the result under
   `public/bundles/<slug>/`.

   The files, and why each one exists:

     factory.dot    what Attractor runs. `emitAttractorDot`, so every
                    node carries its card's `spec` as the `prompt`
                    the agent receives (doc 1 §0.1.2).
     blueprint.dot  the DarkPrint topology, verbatim. The card pin on
                    every node is intact, which is what makes the
                    bundle digest recomputable off these bytes (§4).
     cards/*.yaml   the pinned cards, verbatim from the archive. Same
                    reason: a card rewritten on the way out would
                    hash to something else and the digest printed in
                    the README would be unverifiable.
     ontology/      the local vocabulary (doc 3 §7), verbatim, and
       extensions   only when a card in this bundle declares a term
       .yaml        from it. A `risk_markers` entry the folder does
                    not define reads as `card/unknown-term` against
                    the core alone, the card is rejected with it, and
                    the two scores the README quotes cannot be
                    recomputed from the files that are supposed to
                    have produced them.
     README.md      product copy. Identity, digest, where execution
                    happens, the command, and what DarkPrint does
                    not do (doc 1 §0.1.3, doc 2 §2.5).

   PURE and deterministic: the same bundle always produces the same
   bytes in the same order.
   ============================================================ */

import {
  emitAttractorDot,
  type BlueprintAnalysis,
  type CardRef,
  type OntologyTerm,
  type ResolvedBlueprint,
} from "@/lib/core";
import { autonomyStatement } from "@/lib/format";
import { ONTOLOGY_EXTENSIONS_FILE } from "./ontology-file";

/* --------------------- the layout --------------------- */

/** The Attractor-runnable pipeline. */
export const FACTORY_DOT = "factory.dot";

/** The DarkPrint topology, as the registry stores it. */
export const TOPOLOGY_DOT = "blueprint.dot";

export const BUNDLE_README = "README.md";

/** Directory the pinned cards go in, bundle-relative. */
export const BUNDLE_CARDS_DIR = "cards";

/**
 * The local vocabulary, bundle-relative. The archive's own name for the same document,
 * so a reader who opens both sees one file rather than two spellings of one.
 */
export const BUNDLE_VOCABULARY = ONTOLOGY_EXTENSIONS_FILE;

/** Bundle-relative name of one pinned card: `cards/spec-planner@1.0.0.yaml`. */
export function cardFilePath(ref: CardRef): string {
  return `${BUNDLE_CARDS_DIR}/${ref}.yaml`;
}

/**
 * Where a bundle's files live under `public/`, relative to it.
 *
 * A directory of static files rather than a route: the site is generated ahead of time
 * and has no server to build an archive on request, so the artefacts are laid down at
 * build time and served as files.
 */
export function bundleDir(slug: string): string {
  return `bundles/${slug}`;
}

/**
 * The URL one exported file is served at.
 *
 * Every segment is percent-encoded. A card filename carries the `@` of its pinned
 * version and semver permits `+`, and neither is worth reasoning about twice: encoded
 * segments resolve back to the same bytes on disk whatever the host does with the raw
 * characters.
 */
export function bundleHref(slug: string, file: string): string {
  const segments = `${bundleDir(slug)}/${file}`.split("/").map(encodeURIComponent);
  return `/${segments.join("/")}`;
}

/* --------------------- what goes in and what comes out --------------------- */

/** One pinned card document, verbatim. */
export interface ExportedCard {
  ref: CardRef;
  /** The archived YAML, byte for byte. */
  text: string;
}

/** One file to write, named relative to the bundle directory. */
export interface ExportedFile {
  /** e.g. "cards/spec-planner@1.0.0.yaml". Always forward slashes. */
  path: string;
  text: string;
}

/** The archive's local vocabulary (doc 3 §7), as the document that carries it. */
export interface ExportedVocabulary {
  /** The file, byte for byte. Written into the bundle unaltered, like the cards. */
  text: string;
  /** What it declares, parsed, so the exporter can tell which of them this bundle uses. */
  terms: readonly OntologyTerm[];
}

export interface BundleExportInput {
  blueprint: ResolvedBlueprint;
  /** The two computed scores, quoted verbatim in the README (doc 1 §8.3). */
  analysis: BlueprintAnalysis;
  /**
   * Every card the archive holds for this bundle. Order is irrelevant and duplicates
   * are collapsed, so the caller may hand over its own read order untouched.
   */
  cards: readonly ExportedCard[];
  /**
   * The vocabulary the blueprint was resolved against, beyond the curated core.
   *
   * Optional: an archive that adds nothing to the core hands over nothing, and a bundle
   * whose cards touch none of the local terms exports nothing either. When a card *does*
   * declare one, the file ships with the bundle, because without it the folder resolves
   * against a vocabulary that is missing the term and both scores move.
   */
  vocabulary?: ExportedVocabulary;
}

/* --------------------- the export --------------------- */

/**
 * A resolved blueprint as the set of files a user downloads.
 *
 * Sorted by path, so the write order is a property of the bundle and not of the order
 * the loader happened to read the archive in.
 *
 * Throws when a node pins a card the input does not carry. The loader cannot produce
 * such a bundle — `resolveBundle` raises `bundle/missing-card` first and the archive
 * reader refuses to publish it — so reaching here with one means the caller assembled
 * the input wrongly, and shipping a folder whose `factory.dot` references a card that
 * is not in it would be worse than failing the build.
 */
export function exportBundle(input: BundleExportInput): readonly ExportedFile[] {
  const cards = pinnedCards(input);
  const local = localTermsUsed(input);

  const files: ExportedFile[] = [
    { path: BUNDLE_README, text: bundleReadme(input) },
    // Verbatim, both of them. The digest is taken over this DOT source and these card
    // digests, so any normalisation here would break the one claim the README makes
    // that a reader can check on their own machine.
    { path: TOPOLOGY_DOT, text: input.blueprint.dot },
    { path: FACTORY_DOT, text: emitAttractorDot(input.blueprint) },
    ...cards.map((card) => ({ path: cardFilePath(card.ref), text: card.text })),
  ];

  // Verbatim too, and for the same reason as the cards: the vocabulary is content with an
  // author and a version of its own, and a rewritten copy would define the reader's terms
  // slightly differently from the ones the site scored.
  if (local.length > 0 && input.vocabulary !== undefined) {
    files.push({ path: BUNDLE_VOCABULARY, text: input.vocabulary.text });
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return files;
}

/**
 * The local terms this bundle's cards actually declare, sorted by id.
 *
 * Driven by the cards rather than by the vocabulary: an archive-wide extensions file may
 * define terms no node here touches, and a bundle that touches none of them needs no
 * vocabulary file at all. Every structural field a card can put a term in is scanned —
 * `type`, `phase`, `tools`, `risk_markers` and the `type` of every port — which is the
 * same set `validateCard` resolves against the ontology. `phase` cannot legally be local
 * (doc 3 §7 keeps that dimension closed) and is scanned anyway: over-including a term
 * ships a definition nobody reads, and under-including one ships a folder that does not
 * resolve.
 *
 * Closed over `broader`, because a local term may be rooted in another local term and a
 * chain that leaves the folder half-defined is the same failure one link further along.
 */
export function localTermsUsed(input: BundleExportInput): OntologyTerm[] {
  const vocabulary = input.vocabulary;
  if (vocabulary === undefined || vocabulary.terms.length === 0) return [];

  const byId = new Map(vocabulary.terms.map((term) => [term.id, term]));
  const found = new Map<string, OntologyTerm>();

  const take = (id: string): void => {
    let current: string | undefined = id;
    // Bounded by the vocabulary's size: a `broader` cycle is a defect `validate()` reports,
    // and the `has` guard means one cannot spin here.
    while (current !== undefined && !found.has(current)) {
      const term = byId.get(current);
      if (term === undefined) return;
      found.set(term.id, term);
      current = term.broader;
    }
  };

  const seenCards = new Set<CardRef>();
  for (const node of input.blueprint.nodes) {
    if (seenCards.has(node.ref)) continue;
    seenCards.add(node.ref);
    const card = node.card;
    take(card.type);
    for (const phase of card.phases) take(phase);
    for (const tool of card.tools) take(tool);
    for (const marker of card.riskMarkers) take(marker);
    for (const port of [...card.inputs, ...card.outputs]) take(port.type);
  }

  return [...found.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One node and the skill document its card names. */
export interface SkillPointer {
  nodeId: string;
  ref: CardRef;
  skill: string;
}

/**
 * Every `skill` a node of this blueprint points at, in graph order.
 *
 * The field is a pointer and the engine reads nothing at the other end of it
 * (`lib/core/card/schema.ts`), so no skill document is part of a bundle and none is
 * written here. That is the whole reason this function exists: 51 of the archive's cards
 * name a path like `skills/planner.md`, the folder DarkPrint hands out carries no such
 * file, and a README that lists the four files in the folder and says nothing about the
 * fifth kind leaves the reader to discover a dangling path on their own. The README turns
 * the list below into the set of documents they have to supply.
 *
 * Not deduplicated by ref: the interesting unit is the node, because that is what the
 * reader has to write a document for, and two nodes pinning the same card are one file
 * pointed at twice — which the list shows by repeating the path.
 */
export function skillPointers(input: BundleExportInput): SkillPointer[] {
  const out: SkillPointer[] = [];
  for (const node of input.blueprint.nodes) {
    const skill = node.card.skill;
    if (skill === undefined) continue;
    out.push({ nodeId: node.nodeId, ref: node.ref, skill });
  }
  return out;
}

/**
 * The cards this blueprint pins, deduplicated and sorted by ref.
 *
 * Driven by the graph rather than by the input list: a card the archive happens to
 * carry but no node instantiates is not part of the download, and one pinned twice is
 * one file.
 */
function pinnedCards(input: BundleExportInput): ExportedCard[] {
  const text = new Map<CardRef, string>();
  for (const card of input.cards) text.set(card.ref, card.text);

  const out = new Map<CardRef, ExportedCard>();
  for (const node of input.blueprint.nodes) {
    if (out.has(node.ref)) continue;
    const source = text.get(node.ref);
    if (source === undefined) {
      throw new Error(
        `${input.blueprint.manifest.slug}: node \`${node.nodeId}\` pins \`${node.ref}\`, which is not among the cards handed to exportBundle.`,
      );
    }
    out.set(node.ref, { ref: node.ref, text: source });
  }

  return [...out.values()].sort((a, b) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0));
}

/* --------------------- the README --------------------- */

/**
 * The README, as product copy.
 *
 * Four things it has to say, from the item-10 contract: which blueprint this is and
 * what its content digest is; that execution happens on the reader's own machine (doc
 * 1 §0.1.3); the command that runs it; and that DarkPrint neither executes it nor
 * collects anything. Everything numeric in it comes from the engine, and the two
 * scores are quoted rather than paraphrased (doc 1 §8.3).
 *
 * Doc 2 §1.1 governs the score section. The autonomy class is a description of what
 * this factory automates and where a person stands in it, and it is a name rather than
 * an ordinal: "level" belongs to the security scale and to the 1-to-5 organisational
 * ladder, which are different scales about different subjects. The human nodes are named
 * because §8.3 requires the working to be visible, and named in the engine's own
 * neutral sentence.
 */
export function bundleReadme(input: BundleExportInput): string {
  const { blueprint, analysis } = input;
  const { manifest } = blueprint;
  const cards = pinnedCards(input);
  const local = input.vocabulary === undefined ? [] : localTermsUsed(input);

  const out: string[] = [];
  const push = (...lines: string[]): void => {
    out.push(...lines);
  };

  push(`# ${manifest.title}`, "");
  push(manifest.summary.trim(), "");

  push("```");
  push(`blueprint      ${manifest.slug}`);
  push(`bundle digest  ${blueprint.digest}`);
  push(`ontology       v${manifest.ontologyVersion}`);
  push(`nodes          ${blueprint.nodes.length}`);
  push(`cards pinned   ${cards.length}`);
  if (local.length > 0) {
    push(`local terms    ${local.map((term) => term.id).join(", ")}`);
  }
  push("```", "");
  push(
    "The digest is taken over `blueprint.dot` and the digest of every card version pinned in it.",
    "Recompute it to confirm these files are the ones DarkPrint read. One changed byte gives a",
    "different digest.",
    "",
  );

  /* ---- run it: doc 1 §0.1.3, and the command ---- */
  push("## Run it", "");
  push(
    "This runs on your machine. DarkPrint hands out the files and analyses them statically. It",
    "executes nothing and holds none of your provider keys.",
    "",
  );
  push("```", `attractor run ${FACTORY_DOT}`, "```", "");
  push("Check it first, without spending tokens:", "");
  push(
    "```",
    `attractor validate ${FACTORY_DOT}`,
    `attractor run ${FACTORY_DOT} --simulate`,
    "```",
    "",
  );
  push(
    `\`${FACTORY_DOT}\` is self-contained. Every node carries its card's \`spec\` as the \`prompt\` its`,
    "agent receives, so the runner needs no other file from this folder. Flags vary between",
    "Attractor runners; `attractor run --help` is authoritative on yours.",
    "",
  );

  /* ---- the folder ---- */
  push("## What is in the folder", "");
  // Laid out from the list rather than by hand-counted spaces, so a row whose name is
  // longer than the others moves the column instead of falling out of it.
  const folder: readonly (readonly [string, string])[] = [
    [FACTORY_DOT, "the pipeline Attractor runs, each card's spec inlined as a prompt"],
    [
      TOPOLOGY_DOT,
      "the DarkPrint topology: node ids, edges, the card version pinned on each node",
    ],
    [`${BUNDLE_CARDS_DIR}/`, "the pinned cards, byte for byte as the registry stores them"],
    ...(local.length === 0
      ? []
      : [
          [
            BUNDLE_VOCABULARY,
            "the local terms these cards declare, and the weights that price them",
          ] as const,
        ]),
    [BUNDLE_README, "this file"],
  ];
  const column = Math.max(...folder.map(([name]) => name.length)) + 3;
  push("```");
  for (const [name, note] of folder) push(`${name.padEnd(column)}${note}`);
  push("```", "");
  push(
    "Two DOT files, because they answer different questions. `blueprint.dot` is what the registry",
    "stores and scores. `factory.dot` is that same graph prepared for a runner: a synthesised",
    "`__start` and `__exit` node, and the prompts inlined. Delete those two nodes and their edges",
    "and you are back to the topology.",
    "",
  );

  /* ---- the pointers this folder does not resolve ---- */
  const skills = skillPointers(input);
  if (skills.length > 0) {
    push(
      ...wrap(
        [
          skills.length === 1
            ? "One card in this bundle names a skill document."
            : `${skills.length} of the nodes in this bundle name a skill document.`,
          "There is no `skills/` directory above and there is not meant to be: DarkPrint stores the",
          "pointer and reads nothing at the other end of it, so a skill document is never part of a",
          "bundle. The paths are relative to the repository you run this factory from, and writing the",
          "documents is yours to do.",
        ].join(" "),
      ),
      "",
    );
    const skillColumn = Math.max(...skills.map((s) => s.nodeId.length)) + 3;
    push("```");
    for (const pointer of skills) push(`${pointer.nodeId.padEnd(skillColumn)}${pointer.skill}`);
    push("```", "");
    push(
      ...wrap(
        [
          "Nothing here needs them to run. Every node in `factory.dot` carries its card's `spec` inline",
          "as the prompt its agent receives, so a runner given this folder and nothing else has the",
          "whole instruction for every node. A skill document adds a capability to one agent; what the",
          "blueprint decides is who is wired to whom.",
        ].join(" "),
      ),
      "",
    );
  }

  /* ---- the node table ---- */
  push("## The nodes", "");
  push("| node | card | phase |", "| --- | --- | --- |");
  for (const node of blueprint.nodes) {
    const phase = node.card.phases.length === 0 ? "none declared" : node.card.phases.join(", ");
    push(`| \`${cell(node.nodeId)}\` | \`${cell(node.ref)}\` | ${cell(phase)} |`);
  }
  push("");

  /* ---- the two computed scores, quoted ---- */
  push("## What DarkPrint computed", "");
  /* The class, and the engine's sentence without the band ordinal it ends on. The README
     travels further than any page on the site — it is the file that stays behind in
     somebody's repository — so doc 2 §1.1's rule about the ordinal holds here more than
     anywhere, not less. The arithmetic survives, so the quote can still be checked
     against a local re-run. */
  push(`Autonomy: ${analysis.autonomy.label}.`, "");
  push(`> ${autonomyStatement(analysis.autonomy.rationale)}`, "");

  const humans = analysis.autonomy.contributions.filter((c) => c.requiresHuman);
  if (humans.length > 0) {
    push("Where a person acts:", "");
    for (const contribution of humans) {
      push(`- \`${contribution.nodeId}\` (${contribution.name}): ${contribution.explanation}`);
    }
    push("");
  }

  push(`Security level ${analysis.security.level}.`, "");
  push(`> ${analysis.security.rationale}`, "");

  if (analysis.security.findings.length > 0) {
    push("What was charged:", "");
    for (const finding of analysis.security.findings) {
      push(`- ${finding.explanation}`);
    }
    push("");
  }

  if (local.length > 0) {
    // The one thing that can make the claim below false: a marker whose weight lives in a
    // file the folder does not carry. It carries it, and this says where to look.
    push(
      ...wrap(
        [
          `Both were read against ontology v${manifest.ontologyVersion} and the local terms these`,
          `cards declare: ${local.map((term) => `\`${term.id}\``).join(", ")}.`,
          `Their definitions and the weights that price them are in \`${BUNDLE_VOCABULARY}\`, in this`,
          "folder. Score the folder without that file and those ids resolve against nothing, the",
          "cards carrying them are rejected with them, and both numbers move.",
        ].join(" "),
      ),
      "",
    );
  }
  push(
    "Both readings come from the topology and the cards, with nothing executed. These are the files",
    "that produced them, so the same arithmetic on your side gives the same class and the same",
    "security level.",
    "",
  );
  // Doc 2 §1.1, stated where the reading is, in its own paragraph rather than as a
  // qualifier tacked onto the arithmetic. "Level" is not written of autonomy anywhere in
  // this file: the class is a name, and the one ordinal a reader meets on DarkPrint is
  // the 1-to-5 organisational ladder, which describes an organisation and not a graph.
  push(
    "The autonomy class says what this factory automates and where a person stands in it.",
    "Nothing here is a grade.",
    "",
  );

  /* ---- what DarkPrint collects ---- */
  push("## What gets reported back", "");
  push(
    "Nothing. No file in this folder calls home, and DarkPrint watches no run.",
    "",
  );
  push(
    "Cost and runtime on the blueprint page are labelled *reported* for that reason: whoever runs a",
    "blueprint on their own hardware is the only party that can measure them. Sending a report",
    "would be something you opt into. It is designed and not built, so there is no account, no",
    "endpoint and no client for it in this bundle or on the site.",
    "",
  );

  push("---", "");
  push(`Exported from https://darkprint.io/blueprints/${manifest.slug}`);

  return `${out.join("\n")}\n`;
}

/** One markdown table cell: the only character that can break a row is the separator. */
function cell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

/**
 * Greedy wrap at the column the rest of the file is hand-wrapped to.
 *
 * Used for the one paragraph whose length depends on what it names: a vocabulary with
 * three term ids in it would leave hand-written line breaks in the middle of a column.
 */
function wrap(text: string, width = 94): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    if (current === "") {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
      continue;
    }
    current = `${current} ${word}`;
  }
  if (current !== "") lines.push(current);
  return lines;
}
