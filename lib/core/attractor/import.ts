/* ============================================================
   DarkPrint core — reading an Attractor pipeline back
   The inverse of `emit.ts`, and it is written beside it on
   purpose: a mapping stated once in each direction is two
   mappings, and the day somebody adds a row to one of them the
   other keeps quietly answering the old question. Both directions
   read `ATTRACTOR_TYPE_SHAPES`, and the reverse table below is
   DERIVED from it rather than transcribed, so a tenth row reaches
   the importer without anybody remembering to bring it.

   ── what an import produces, and what it does not ──
   A DRAFT. A `topology.dot`, one card per node, and a stub
   manifest — the same three things `/upload` takes and
   `darkprint validate` reads, so the folder can be opened,
   corrected and published by a person who looked at it. It is
   never a release: the version every synthesised card takes is
   `0.1.0` and the version the pipeline's own nodes pinned is kept
   only when the file carries a `card="id@version"`, which is to
   say only when the file came out of DarkPrint in the first place.

   ── attribution, which is the whole reason `author` is required ──
   A `prompt=` is somebody's writing. Compiling it into a card and
   handing the result to an archive with no name on it launders it,
   and the laundering is invisible afterwards: a card in the archive
   looks exactly like a card somebody wrote. So every synthesised
   card carries two different facts, in two different fields, and
   neither stands in for the other.

     `author`      the handle that ran the import. Who is
                   answerable for this draft being here.
     `provenance`  `derived:attractor <origin>`. Where the prose in
                   `spec` came from, marked DERIVED so a reader —
                   and a grep — can tell a compiled card from a
                   written one.

   `author` has no default. A default would be a name nobody chose,
   and the one thing worse than an unattributed card is a card
   attributed to the wrong person.

   ── what a pipeline cannot say, and what DarkPrint requires ──
   The two formats are not the same size in either direction, and
   the asymmetries are recorded here rather than discovered:

     Attractor has, DarkPrint drops — every reserved attribute in
     `ATTRACTOR_UNEXPRESSED_ATTRIBUTES` (goal gates, timeouts, the
     retry policy above `max_retries`, fidelity, thread ids, the
     parallel join policy, the manager-loop controls, the graph
     defaults, hooks and the model stylesheet), the node `type`
     handler override, and every unreserved attribute somebody
     parked on a node for their own tooling.

     DarkPrint requires, Attractor does not have — a `spec`. Every
     card must carry one and an Attractor node need not carry a
     `prompt`: a `tool` node runs a `tool_command`, and a
     `wait.human` node may simply wait. Such a node is imported
     with an EMPTY `spec` and a warning naming it, so the draft
     says out loud that a person has to write the missing half. It
     does not resolve until they do, which is the correct state for
     a folder that is missing the payload its own schema says a
     node is for.

   ── the escaping asymmetry, and why it is handled here ──
   Attractor's `String` rule interprets `\n`, `\t`, `\\` and `\"`.
   DarkPrint's DOT lexer implements GRAPHVIZ's rule, where `\n` is a
   label directive and only `\"` is an escape, so it hands back a
   two-character `\` `n` where Attractor would hand back a newline.
   `emit.ts` writes to Attractor's rule. The two therefore disagree
   about every prompt containing a line break, and the disagreement
   compounds on each pass — an export re-read by DarkPrint yields a
   spec with a literal backslash in it, and re-exporting doubles the
   backslash.

   `unquoteAttractorString` is the missing half, applied HERE and
   nowhere else, because this is the only module that knows the file
   in front of it is an Attractor file. The lexer keeps reading
   `topology.dot` the way Graphviz does, which is what a DarkPrint
   topology is written in, and the round-trip gate over the corpus
   is what holds the pair to being exact inverses.
   ============================================================ */

import { warning } from "../diagnostics";
import type { Diagnostic, DiagnosticLocation } from "../diagnostics";
import { cardRef, parseCardRef, type CardRef, type JsonValue, type NodeCard } from "../card/schema";
import type { BundleManifest } from "../bundle/types";
import type { DotAttrs, DotEdgeStmt, DotGraph } from "../dot/parser";
import { parseDot } from "../dot/parser";
import { CORE_ONTOLOGY } from "../ontology/core";
import { ontologyView, type OntologyView } from "../ontology/resolve";
import {
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_TYPE_SHAPES,
  attractorClassName,
} from "./emit";
import { ATTRACTOR_BOUNDARY_IDS, isAttractorIdentifier } from "./reserved";

/**
 * The reverse mapping table: one DOT shape, every DarkPrint type that emits it, in the
 * order `ATTRACTOR_TYPE_SHAPES` declares them.
 *
 * **Derived, never transcribed.** The forward table is the contract and this is a reading
 * of it, so a row added to `emit.ts` arrives here in the same edit and a row deleted from
 * it disappears from here in the same edit. A hand-written reverse table is the classic
 * place a mapping rots: the two disagree, nothing compares them, and a node changes type
 * on the way home.
 *
 * Two shapes carry more than one type, because six DarkPrint types share three shapes:
 * `box` is `agent` and `validation`, `hexagon` is `human-gate` and `human-input`. Attractor
 * cannot tell them apart — both pairs select the same handler — so the shape alone is not
 * an answer and `attractorTypeFor` consults the node's `class` before falling back to the
 * first row. See its docblock for what that costs on a foreign file.
 */
export const ATTRACTOR_SHAPE_TYPES: Readonly<Record<string, readonly string[]>> = Object.freeze(
  buildShapeTypes(),
);

function buildShapeTypes(): Record<string, readonly string[]> {
  const byShape = new Map<string, string[]>();
  for (const [type, kind] of Object.entries(ATTRACTOR_TYPE_SHAPES)) {
    const row = byShape.get(kind.shape);
    if (row === undefined) byShape.set(kind.shape, [type]);
    else row.push(type);
  }
  const out: Record<string, readonly string[]> = {};
  for (const [shape, types] of byShape) out[shape] = Object.freeze(types);
  return out;
}

/**
 * The version a synthesised card takes when the source pins none.
 *
 * `0.1.0` and not `1.0.0`: §4 makes a published version immutable, and the first thing
 * this draft needs is for somebody to edit it. A card arriving at `1.0.0` invites being
 * published as it stands, which is exactly what an import must not produce.
 */
export const DRAFT_CARD_VERSION = "0.1.0";

/**
 * The marker every synthesised card's `provenance` opens with.
 *
 * A fixed prefix rather than a sentence, so that "which cards in this archive were
 * compiled rather than written" is one grep and not a judgement call. The origin follows
 * it verbatim, whatever the caller was holding: a path, a URL, a release address.
 */
export const DERIVED_PROVENANCE_PREFIX = "derived:attractor";

/** What the caller has to say before a foreign file becomes cards. */
export interface AttractorImportOptions {
  /**
   * Where the pipeline came from, written into every card's `provenance` after the marker.
   * A path, a URL, a name — whatever the caller can point a reader at.
   */
  origin: string;
  /**
   * The handle answerable for this draft. **No default**: see the file header. An empty or
   * blank value is refused the same way an absent one would be, since a blank `author` in
   * the file is indistinguishable from no author at all.
   */
  author: string;
  /** File the diagnostics point at. Defaults to the origin. */
  file?: string;
  /**
   * The vocabulary the types and phases are read against. Defaults to the shipped core.
   * A caller holding a local overlay passes its view so a `dp-berti-simulation` class is
   * recognised as the phase or type it is rather than dropped.
   */
  ontology?: OntologyView;
}

/** One node of the source pipeline, as the card and the topology entry it became. */
export interface ImportedCard {
  /** The node id written into the synthesised `topology.dot`. */
  nodeId: string;
  ref: CardRef;
  /** Bundle-relative path, `cards/<id>@<version>.yaml`. */
  file: string;
  card: NodeCard;
  /** The YAML document, which is what actually goes in the folder. */
  source: string;
}

/** A draft bundle, in the shape `loadBundle` and `validateBundle` take. */
export interface AttractorImport {
  manifest: BundleManifest;
  /** The synthesised `topology.dot`. */
  dot: string;
  /** Keyed by bundle-relative path, ready for `validateBundle`. */
  cardFiles: Record<string, string>;
  cards: readonly ImportedCard[];
  /**
   * Everything the import has to say. Sorted by the caller if it wants them sorted; the
   * order here is the order the file was read in, which is the order a person reads it in.
   */
  diagnostics: Diagnostic[];
}

/* --------------------- the escaping asymmetry --------------------- */

/**
 * Apply the half of Attractor's `String` rule that DarkPrint's DOT lexer does not.
 *
 * The lexer has already turned `\"` into `"` and dropped a backslash-newline continuation,
 * which is Graphviz's reading. Attractor's rule
 * (`'"' ( '\"' | '\n' | '\t' | '\\' | [^"\] )* '"'`) has three more escapes, and this is
 * them: `\n` → a line feed, `\t` → a tab, `\\` → one backslash.
 *
 * One left-to-right pass, never a chain of `replace` calls, because the passes would feed
 * each other: `\\n` is an escaped backslash followed by the letter n, and a `\n` → newline
 * replacement run first turns it into a newline preceded by a backslash. Scanning once and
 * consuming both characters together is the only reading that cannot do that.
 *
 * A backslash before anything else is left exactly as it stands. Attractor's rule cannot
 * express such a sequence at all, so there is no correct interpretation to apply and
 * inventing one would edit somebody's condition expression on the way past.
 */
export function unquoteAttractorString(value: string): string {
  if (!value.includes("\\")) return value;
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value.charAt(i);
    if (ch !== "\\" || i === value.length - 1) {
      out += ch;
      continue;
    }
    const next = value.charAt(i + 1);
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "\\") out += "\\";
    else {
      out += ch;
      continue;
    }
    i += 1;
  }
  return out;
}

/**
 * `value` as a DOT string DarkPrint's own lexer reads back unchanged, or `undefined` when
 * no such spelling exists.
 *
 * The topology this module writes is a DarkPrint `topology.dot`, so it has to survive
 * DarkPrint's lexer and not Attractor's: only `\"` is an escape there, and every other
 * backslash is literal. That makes the encoding almost trivial and leaves exactly one hole,
 * which is why this returns `undefined` rather than a best effort. A backslash immediately
 * before a quote is unencodable — writing `\` `\` `"` gives the lexer an escaped backslash
 * and then an unterminated string — and so is a trailing backslash, and so is a backslash
 * before a line break, which the lexer eats as a continuation.
 *
 * The caller drops the attribute and says so. Silently writing a value that reads back as
 * something else is the failure this whole module is a witness against.
 */
function quoteDotString(value: string): string | undefined {
  if (/\\(?:["\r\n]|$)/.test(value)) return undefined;
  return `"${value.replace(/"/g, '\\"')}"`;
}

/* --------------------- the mapping, backwards --------------------- */

/**
 * The DarkPrint type for one node, from its shape and its classes.
 *
 * The shape decides which family; the classes decide which member, and only where the
 * shape carries more than one. `emit.ts` writes `class="dp-validation dp-evaluative …"`, so
 * a file that came out of DarkPrint disambiguates itself and comes home unchanged.
 *
 * **A foreign file usually cannot.** An Attractor pipeline has no reason to carry a
 * DarkPrint class, so a `box` arrives as `agent` and a `hexagon` as `human-gate` — the
 * first row of each, which is stable rather than correct. That is a real loss and it is
 * one the format imposes: Attractor selects the `codergen` handler for both `agent` and
 * `validation` and stores nothing that separates them, so the information is not in the
 * file to be recovered. `tests/attractor-round-trip.test.ts` names it as an exception
 * rather than hiding it behind a looser comparison.
 *
 * `undefined` for a shape no row emits. The caller reports it and falls back, because a
 * pipeline drawn with `ellipse` nodes is a pipeline somebody still wants imported.
 */
export function attractorTypeFor(shape: string, classes: readonly string[]): string | undefined {
  const candidates = Object.prototype.hasOwnProperty.call(ATTRACTOR_SHAPE_TYPES, shape)
    ? ATTRACTOR_SHAPE_TYPES[shape]
    : undefined;
  if (candidates === undefined || candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const declared = new Set(classes);
  for (const type of candidates) {
    if (declared.has(attractorClassName(type))) return type;
  }
  return candidates[0];
}

/* --------------------- the import --------------------- */

/**
 * Read an Attractor pipeline and synthesise a draft bundle from it.
 *
 * Pure and deterministic, like the emitter it inverses: no clock, no randomness, no I/O.
 * The same pipeline always produces the same folder, which is what lets the round-trip
 * gate compare an export against the export of its own import.
 *
 * Reports rather than throws, for everything about the file's CONTENT — a shape nobody has
 * a type for, a node with no prompt, a `max_retries` that is not a number, an attribute
 * that cannot be written back. The only throwing case is a caller that gave no `author`,
 * which is a programming error rather than a fact about the pipeline.
 *
 * A source that does not parse comes back as an empty draft carrying the parser's own
 * diagnostics. There is nothing else honest to return: an empty bundle says "no nodes were
 * read", and a partial one would say a graph was read that was not.
 */
export function importAttractorDot(src: string, options: AttractorImportOptions): AttractorImport {
  const author = options.author.trim();
  if (author === "") {
    throw new Error(
      "importAttractorDot needs an `author`: a compiled card with no name on it is an " +
        "unattributed copy of somebody's writing.",
    );
  }
  const file = options.file ?? options.origin;
  const ontology = options.ontology ?? ontologyView(CORE_ONTOLOGY);
  const ds: Diagnostic[] = [];

  const parsed = parseDot(src, file);
  if (parsed.graph === undefined) {
    return {
      manifest: draftManifest("", "", ""),
      dot: "",
      cardFiles: {},
      cards: [],
      diagnostics: parsed.diagnostics,
    };
  }
  ds.push(...parsed.diagnostics);
  const graph = parsed.graph;

  /* The boundary is synthesised on the way out and dropped on the way back, which is the
     other half of `emit.ts`'s "synthesise, do not re-shape" decision. Attractor resolves a
     boundary node by shape OR by id (§3.2, §4.4), so both readings are applied here: a
     node called `end` IS the pipeline's exit as far as a runner is concerned, whatever it
     is called in DarkPrint. */
  const boundary = new Set<string>();
  for (const node of graph.nodes) {
    if (isBoundaryNode(node.id, node.attrs)) boundary.add(node.id);
  }

  const used = new Set<string>();
  const cardIds = new Set<string>();
  const byRef = new Map<CardRef, ImportedCard>();
  const cards: ImportedCard[] = [];
  const nodeIdFor = new Map<string, string>();

  for (const node of graph.nodes) {
    if (boundary.has(node.id)) {
      // Its `prompt` is the one thing a boundary node should not have carried, so a
      // pipeline that put one there is losing prose and has to be told which node.
      if (attr(node.attrs, "prompt") !== undefined) {
        ds.push(
          warning(
            "dot/unsupported",
            `Node \`${node.id}\` is the pipeline's start or exit, and its \`prompt\` is dropped.`,
            {
              hint: "A boundary node is synthesised on export, so nothing would run this text. Move it to the first node that does the work.",
              location: { file, nodeId: node.id, line: node.line, column: node.column },
            },
          ),
        );
      }
      continue;
    }

    const location: DiagnosticLocation = {
      file,
      nodeId: node.id,
      line: node.line,
      column: node.column,
    };
    const nodeId = unique(node.id, used);
    nodeIdFor.set(node.id, nodeId);

    const pinned = parseCardRef(attr(node.attrs, "card") ?? "");
    const id =
      pinned?.id ??
      unique(cardIdFrom(unquoted(node.attrs, "dp_node") ?? node.id), cardIds, "-");
    cardIds.add(id);
    const version = pinned?.version ?? DRAFT_CARD_VERSION;
    const ref = cardRef(id, version);

    const held = byRef.get(ref);
    if (held !== undefined) {
      /* Two nodes instantiating one card is ordinary in DarkPrint (`resolveBundle` counts
         each node separately and the digest counts the card twice). One card FILE, two
         node statements pinning it — writing the document twice under one name would be
         two answers to `bundle/digest-mismatch`'s question. */
      continue;
    }

    const card = cardFor(node.id, node.attrs, { id, version, author, ontology, location }, ds, {
      origin: options.origin,
    });
    const imported: ImportedCard = {
      nodeId,
      ref,
      file: `cards/${ref}.yaml`,
      card,
      source: cardDocument(card),
    };
    byRef.set(ref, imported);
    cards.push(imported);
  }

  const name = (graph.name ?? "").trim();
  const manifest = draftManifest(
    name,
    unquoteAttractorString(attr(graph.graphAttrs, "label") ?? ""),
    unquoteAttractorString(attr(graph.graphAttrs, "goal") ?? ""),
  );

  const cardFiles: Record<string, string> = {};
  for (const card of cards) cardFiles[card.file] = card.source;

  return {
    manifest,
    dot: topologyDocument(graph, manifest.slug, cards, nodeIdFor, boundary, file, ds),
    cardFiles,
    cards,
    diagnostics: ds,
  };
}

/* --------------------- the pieces --------------------- */

/** Attractor resolves the boundary by shape (§3.2, §4.4) or by id, so both are asked. */
function isBoundaryNode(id: string, attrs: DotAttrs): boolean {
  const shape = attr(attrs, "shape");
  return (
    shape === ATTRACTOR_ENTRY_KIND.shape ||
    shape === ATTRACTOR_EXIT_KIND.shape ||
    ATTRACTOR_BOUNDARY_IDS.includes(id)
  );
}

/** An attribute, or `undefined` — `DotAttrs` is an index signature and claims every key. */
function attr(attrs: DotAttrs, key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(attrs, key) ? attrs[key] : undefined;
}

/** An attribute with Attractor's escapes applied. */
function unquoted(attrs: DotAttrs, key: string): string | undefined {
  const raw = attr(attrs, key);
  return raw === undefined ? undefined : unquoteAttractorString(raw);
}

/** A name not already taken, suffixed in order so the same pipeline always renames alike. */
function unique(base: string, taken: Set<string>, separator = "_"): string {
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}${separator}${n}`;
    n += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * A card id off a node id, onto `card/schema.ts`'s `CARD_ID` grammar.
 *
 * The two grammars are incompatible for every multi-word name — Attractor's Identifier
 * rule wants `spec_planner` and a card id wants `spec-planner` — so this is the same
 * translation `emit.ts` does in the other direction, and a DarkPrint file carries a
 * `card=` pin that makes it unnecessary. It only runs for a foreign pipeline.
 */
function cardIdFrom(nodeId: string): string {
  const slug = nodeId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // `CARD_ID` refuses an empty segment, and a node id of nothing but punctuation gives one.
  return slug === "" ? "node" : slug;
}

/** The stub manifest a draft carries. */
function draftManifest(graphName: string, title: string, summary: string): BundleManifest {
  const slug = cardIdFrom(graphName);
  return {
    // `cardIdFrom` answers `node` for an empty name, which would be a lie about a
    // blueprint; the fallback belongs to whoever is asking.
    slug: graphName.trim() === "" ? "imported-pipeline" : slug,
    /* The graph's own name when it declared no `label`. A draft with an empty title is a
       draft nothing can list, and the name is the only thing the file offered. It is also
       why an import followed by an export ADDS a graph `label` to a foreign pipeline —
       named as an exception by the round-trip gate rather than left to be noticed. */
    title: title.trim() === "" ? graphName : title,
    summary,
    tags: [],
  };
}

interface CardIdentity {
  id: string;
  version: string;
  author: string;
  ontology: OntologyView;
  location: DiagnosticLocation;
}

/** One node's attributes, as the card they describe. */
function cardFor(
  sourceId: string,
  attrs: DotAttrs,
  identity: CardIdentity,
  ds: Diagnostic[],
  source: { origin: string },
): NodeCard {
  const { id, version, author, ontology, location } = identity;
  const classes = (unquoted(attrs, "class") ?? "").split(/\s+/).filter((c) => c !== "");
  const shape = attr(attrs, "shape") ?? "";
  const type = attractorTypeFor(shape, classes);

  if (type === undefined) {
    /* Reported, then typed as an agent — the handler that reads a `prompt`, so the node
       still runs its own text instead of being dropped from the graph. `emit.ts` makes
       exactly this trade in the other direction for a type the vocabulary does not know. */
    ds.push(
      warning(
        "dot/unsupported",
        shape === ""
          ? `Node \`${sourceId}\` declares no \`shape\`, so its type is a guess.`
          : `Node \`${sourceId}\` has \`shape=${shape}\`, which no DarkPrint node type emits.`,
        {
          hint: `Imported as \`agent\`. The shapes that map to a type are: ${Object.keys(ATTRACTOR_SHAPE_TYPES).join(", ")}.`,
          location,
        },
      ),
    );
  }

  const spec = unquoted(attrs, "prompt") ?? "";
  if (spec === "") {
    ds.push(
      warning(
        "card/missing-field",
        `Node \`${sourceId}\` carries no \`prompt\`, so the card written for it has an empty \`spec\`.`,
        {
          hint: "An Attractor node may run without one; a DarkPrint card may not. Write what this node is for, and the bundle resolves.",
          location,
        },
      ),
    );
  }

  const card: NodeCard = {
    id,
    name: unquoted(attrs, "label") ?? sourceId,
    type: type ?? "agent",
    phases: phasesFrom(classes, ontology),
    /* Read off the shape, which is where the source file states what the node DOES: the
       handler the runner will select for it. Not the label — a label is a name, and
       copying a name into the field beside it says nothing new. Not invented either, which
       leaves the handler as the only answer the pipeline actually contains. */
    action: handlerFor(type),
    spec,
    tools: [],
    mcp: [],
    params: paramsFrom(sourceId, attrs, ds, location),
    /* Ports, dependencies, prohibitions and risk markers are the DarkPrint half of a card
       and no Attractor file has ever carried them — `emit.ts` says so in the header it
       writes into every export. Empty is the honest answer, and a `cannot` invented from a
       graph's shape would be a rule the author never declared being enforced against them. */
    inputs: [],
    outputs: [],
    dependencies: [],
    cannot: [],
    willNot: [],
    riskMarkers: [],
    version,
    author,
    provenance: `${DERIVED_PROVENANCE_PREFIX} ${source.origin}`,
  };

  const model = unquoted(attrs, "llm_model")?.trim();
  if (model !== undefined && model !== "") card.model = model;
  return card;
}

/** The Attractor handler a type selects, which is what the node does. */
function handlerFor(type: string | undefined): string {
  const row =
    type !== undefined && Object.prototype.hasOwnProperty.call(ATTRACTOR_TYPE_SHAPES, type)
      ? ATTRACTOR_TYPE_SHAPES[type]
      : ATTRACTOR_TYPE_SHAPES.agent;
  return row.handler;
}

/**
 * The phases named by a class list.
 *
 * Asked of the vocabulary rather than of a list of five: `ontology.get(id)?.kind` is what
 * decides, so a phase added to the core arrives here for free and a class that happens to
 * collide with a type name is not read as a phase. The `dp-` collapse is not injective, so
 * only a class whose stripped name IS a phase term id is taken — which is every phase the
 * emitter writes, since the five are already lowercase and hyphen-free.
 */
function phasesFrom(classes: readonly string[], ontology: OntologyView): string[] {
  const phases: string[] = [];
  for (const name of classes) {
    if (!name.startsWith("dp-")) continue;
    const id = name.slice(3);
    if (ontology.get(id)?.kind === "phase" && !phases.includes(id)) phases.push(id);
  }
  return phases;
}

/**
 * `max_retries` back onto `params.max_iterations`.
 *
 * The first of `ITERATION_CAP_KEYS`, so `readIterationCap` finds it and `emit.ts` writes
 * the same number back out. A value that is not a non-negative integer is reported and
 * dropped rather than carried: `readIterationCap` would refuse it anyway, and a params key
 * holding a number nothing reads is a cap an author thinks they have.
 */
function paramsFrom(
  sourceId: string,
  attrs: DotAttrs,
  ds: Diagnostic[],
  location: DiagnosticLocation,
): Record<string, JsonValue> {
  const raw = attr(attrs, "max_retries");
  if (raw === undefined) return {};
  const trimmed = unquoteAttractorString(raw).trim();
  if (!/^[0-9]+$/.test(trimmed)) {
    ds.push(
      warning("dot/unsupported", `Node \`${sourceId}\` has \`max_retries=${raw}\`, which is not a whole number.`, {
        hint: "Dropped. Write the cap as `params.max_iterations` on the card once you know what it should be.",
        location,
      }),
    );
    return {};
  }
  return { max_iterations: Number(trimmed) };
}

/* --------------------- the two documents --------------------- */

/**
 * The synthesised `topology.dot`.
 *
 * Only what DarkPrint's own resolver reads: the node ids, the `card=` pins, and the three
 * edge attributes `resolveBundle` models (`label`, `condition`, `weight`). Everything else
 * the source carried is on the Attractor side of the line and belongs in a compiled file,
 * not in a topology — writing `shape` or `prompt` into `topology.dot` would put a second
 * copy of the card in the folder, drifting from the first.
 *
 * The boundary nodes and every edge touching one are dropped, which is the inverse of the
 * synthesis. `entryTargets` and `exitSources` put them back on the next export, from the
 * topology's own in-degree and out-degree, so the wiring is derived on both ends rather
 * than carried.
 */
function topologyDocument(
  graph: DotGraph,
  slug: string,
  cards: readonly ImportedCard[],
  nodeIdFor: ReadonlyMap<string, string>,
  boundary: ReadonlySet<string>,
  file: string,
  ds: Diagnostic[],
): string {
  const refFor = new Map<string, CardRef>();
  for (const card of cards) refFor.set(card.nodeId, card.ref);

  const lines: string[] = [];
  lines.push(`digraph ${dotName(graph.name ?? slug)} {`);

  for (const node of graph.nodes) {
    if (boundary.has(node.id)) continue;
    const nodeId = nodeIdFor.get(node.id);
    if (nodeId === undefined) continue;
    const ref = refFor.get(nodeId) ?? refByPin(node.attrs);
    lines.push(
      ref === undefined
        ? `  ${dotId(nodeId)};`
        : `  ${dotId(nodeId)} [card="${ref}"];`,
    );
  }
  lines.push("");

  for (const edge of graph.edges) {
    if (boundary.has(edge.source) || boundary.has(edge.target)) continue;
    const source = nodeIdFor.get(edge.source);
    const target = nodeIdFor.get(edge.target);
    if (source === undefined || target === undefined) continue;
    const attrs = edgeAttributes(edge, file, ds);
    lines.push(`  ${dotId(source)} -> ${dotId(target)}${attrs};`);
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/** A node that was skipped as a duplicate still needs the pin its twin carries. */
function refByPin(attrs: DotAttrs): CardRef | undefined {
  const pinned = parseCardRef(attr(attrs, "card") ?? "");
  return pinned === undefined ? undefined : cardRef(pinned.id, pinned.version);
}

/**
 * The three edge attributes a DarkPrint topology models, re-encoded for DarkPrint's lexer.
 *
 * An attribute whose value has no spelling this lexer reads back unchanged is DROPPED with
 * a warning naming it. That is the one case `quoteDotString` refuses, and carrying a value
 * that reads back as something else would break the guarantee the round-trip gate exists to
 * hold: a condition somebody else's runner evaluates is not a string DarkPrint may edit.
 */
function edgeAttributes(edge: DotEdgeStmt, file: string, ds: Diagnostic[]): string {
  const out: string[] = [];
  for (const key of ["label", "condition", "weight"]) {
    const raw = attr(edge.attrs, key);
    if (raw === undefined) continue;
    const value = unquoteAttractorString(raw);
    const quoted = quoteDotString(value);
    if (quoted === undefined) {
      ds.push(
        warning(
          "dot/unsupported",
          `Edge \`${edge.source} -> ${edge.target}\` has a \`${key}\` this format cannot carry, so it is dropped.`,
          {
            hint: "A backslash directly before a quote, a line break or the end of the value has no spelling a DOT string reads back unchanged.",
            location: {
              file,
              line: edge.line,
              column: edge.column,
              edge: { source: edge.source, target: edge.target },
            },
          },
        ),
      );
      continue;
    }
    out.push(`${key}=${quoted}`);
  }
  return out.length === 0 ? "" : ` [${out.join(", ")}]`;
}

/** A graph name onto the Identifier rule, since a DOT graph name is one. */
function dotName(raw: string): string {
  const name = raw.replace(/[^A-Za-z0-9_]/g, "_");
  return name === "" || /^[0-9]/.test(name) ? `n_${name}` : name;
}

/** A node id bare where the lexer reads it bare, quoted where it does not. */
function dotId(id: string): string {
  return isAttractorIdentifier(id) ? id : `"${id.replace(/"/g, '\\"')}"`;
}

/* --------------------- the card document --------------------- */

/**
 * One card as YAML, with every scalar written as a JSON string.
 *
 * YAML 1.2 is a superset of JSON, so `JSON.stringify` produces a double-quoted scalar the
 * parser reads back byte for byte, escapes and all. That matters more here than it does in
 * the hand-written archive: this text is compiled from somebody else's prompt and may hold
 * anything — a colon, a leading `-`, a line break, a `#` — and a plain scalar or a folded
 * block would need a wrapping rule and a re-reading rule that agree. There is no author to
 * please with the formatting, and the one thing this document has to do is come back
 * unchanged.
 */
function cardDocument(card: NodeCard): string {
  const lines: string[] = [];
  const scalar = (key: string, value: string): void => {
    lines.push(`${key}: ${JSON.stringify(value)}`);
  };
  const list = (key: string, values: readonly string[]): void => {
    if (values.length === 0) {
      lines.push(`${key}: []`);
      return;
    }
    lines.push(`${key}:`);
    for (const value of values) lines.push(`  - ${JSON.stringify(value)}`);
  };

  scalar("id", card.id);
  scalar("name", card.name);
  scalar("type", card.type);
  list("phase", card.phases);
  lines.push("");

  scalar("action", card.action);
  scalar("spec", card.spec);
  if (card.model !== undefined) scalar("model", card.model);
  list("tools", card.tools);
  list("mcp", card.mcp);
  if (Object.keys(card.params).length > 0) {
    lines.push("params:");
    for (const key of Object.keys(card.params)) {
      lines.push(`  ${key}: ${JSON.stringify(card.params[key])}`);
    }
  } else {
    lines.push("params: {}");
  }
  lines.push("");

  lines.push("inputs: []");
  lines.push("outputs: []");
  list("dependencies", card.dependencies);
  list("cannot", card.cannot);
  list("will_not", card.willNot);
  list("risk_markers", card.riskMarkers);
  lines.push("");

  scalar("version", card.version);
  if (card.author !== undefined) scalar("author", card.author);
  if (card.provenance !== undefined) scalar("provenance", card.provenance);

  return `${lines.join("\n")}\n`;
}
