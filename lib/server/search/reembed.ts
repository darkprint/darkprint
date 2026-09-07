/* ============================================================
   DarkPrint backend — reembedRelease and reembedAll
   Re-embedding is triggered by a release and is idempotent for
   unchanged content. It writes BOTH vectors: the release's own,
   over a document describing the blueprint's purpose and its
   graph, and one per pinned card version, over a document
   describing what the node does and what it is told.
   `card_version_embedding` has no other writer.

   ── Idempotency reads the stamp, not the row ──
   A `release` row is content-addressed but its manifest is not in
   the digest, and a migration once rewrote `card_version.body` in
   place under unchanged primary keys. So every vector row carries
   `embedded_input_sha256`, the identity of the exact input it was
   encoded from, and a call writes only when that stamp is absent or
   disagrees. Equal input costs one indexed lookup and no model
   load. The model's identity is inside the hash, so swapping the
   weights invalidates every row for free.

   ── The documents are versioned in their first line ──
   Both start with `v2`, so a change of template is visible in the
   stamped input without decoding it and `reembedAll --dry-run`
   counts every row stale the day the template moves.

   ── Visibility is not consulted, on purpose ──
   A vector skipped while a blueprint is private has nothing to
   trigger it on the day the blueprint goes public. The searchers
   narrow to the public universe before they read either table.
   ============================================================ */

import { asc, eq, inArray, sql } from "drizzle-orm";
import {
  cardRef,
  hasErrors,
  loadBundle,
  parseCardRef,
  requiresHuman,
  sha256Hex,
  type BlueprintAnalysis,
  type Bundle,
  type ResolvedBlueprint,
} from "@/lib/core";
import { cardFilePath } from "@/lib/content/bundle-export";
import { requiredAgents, requiredTools } from "@/lib/graph-seed";
import { schema, type Db } from "@/lib/db";
import {
  MalformedVocabularyError,
  getRelease,
  parseStoredVocabulary,
  type ReleaseRecord,
} from "@/lib/server/archive";
import { openView } from "@/lib/server/ontology";
import type { BundleManifest, NodeCard } from "@/lib/server/types";
import { MODEL_BLOB, embed, encoderState } from "./embed";
import { withSearchStore } from "./store";

/** The first line of both documents. Bump it when either template changes shape. */
export const DOCUMENT_VERSION = "v2";

/**
 * The most characters a blueprint document may run to. The encoder truncates at 512
 * wordpieces, about 1800 characters of English, and text past the window buys nothing while
 * diluting what is inside it.
 */
export const BLUEPRINT_DOCUMENT_BUDGET = 1800;

/**
 * The identity of everything a stored vector is a function of: the encoder that produced it
 * and the exact string it was handed.
 *
 * Prefixed `sha256:` to match `lib/core`'s digest convention. The model pin goes first and
 * is a fixed 64 hex characters, so no text can be confused for it however the newline lands.
 */
export function embeddedInput(text: string): string {
  return `sha256:${sha256Hex(`${MODEL_BLOB.sha256}\n${text}`)}`;
}

/**
 * Embed a release and every card version it pins, writing what is missing or out of date.
 *
 * An absent release is a no-op returning `void` rather than a throw: `getRelease` answers
 * `undefined` for a release that is not there and for a malformed digest alike, and both are
 * the same nothing-to-do here.
 */
export async function reembedRelease(db: Db, bundleId: string, digest: string): Promise<void> {
  return withSearchStore("reembedRelease", async () => {
    await syncRelease(db, bundleId, digest, { dryRun: false, seenCards: new Set() });
  });
}

/** What a sweep did, or in a dry run what it would do. Counts are over distinct vector rows. */
export interface ReembedSweep {
  /** Releases the sweep resolved. */
  releases: number;
  /** Vector rows written (or, dry, whose stamp disagrees with today's document). */
  written: number;
  /** Vector rows whose stamp already matched. */
  unchanged: number;
  encoder: "present" | "absent";
}

/**
 * Re-embed every release in the archive, oldest first.
 *
 * `reembedRelease` runs at publish and nowhere else, so a template change leaves every
 * existing row stale until something revisits it. This is that something. With `dryRun` the
 * would-be stamps are computed and compared and nothing is encoded or written.
 */
export async function reembedAll(
  db: Db,
  options: { dryRun?: boolean } = {},
): Promise<ReembedSweep> {
  return withSearchStore("reembedAll", async () => {
    const dryRun = options.dryRun ?? false;
    const rows = await db
      .select({ bundleId: schema.release.bundleId, digest: schema.release.digest })
      .from(schema.release)
      .orderBy(asc(schema.release.createdAt), asc(schema.release.id));

    /* Two versions of one bundle can share a digest, and `getRelease` resolves the pair to
       its first row either way, so the pair is visited once. Card rows are shared across
       releases and counted once too. */
    const visited = new Set<string>();
    const seenCards = new Set<string>();
    const sweep: ReembedSweep = { releases: 0, written: 0, unchanged: 0, encoder: "absent" };
    for (const row of rows) {
      const key = `${row.bundleId}#${row.digest}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const outcome = await syncRelease(db, row.bundleId, row.digest, { dryRun, seenCards });
      if (outcome === undefined) continue;
      sweep.releases += 1;
      sweep.written += outcome.written;
      sweep.unchanged += outcome.unchanged;
    }
    sweep.encoder = await encoderState();
    return sweep;
  });
}

/* --------------------- one release --------------------- */

interface SyncOptions {
  dryRun: boolean;
  /** `card_version.id`s already handled by this sweep, so a shared card is counted once. */
  seenCards: Set<string>;
}

interface SyncOutcome {
  written: number;
  unchanged: number;
}

interface CardRow {
  id: string;
  cardId: string;
  version: string;
  body: unknown;
  source: string;
  input: string | null;
}

async function syncRelease(
  db: Db,
  bundleId: string,
  digest: string,
  options: SyncOptions,
): Promise<SyncOutcome | undefined> {
  const release = await getRelease(db, bundleId, digest);
  if (release === undefined) return undefined;

  const pinned = await pinnedCards(db, release.cardRefs);
  const outcome: SyncOutcome = { written: 0, unchanged: 0 };

  const document = blueprintText(release.manifest, resolvedGraph(release, pinned));
  const releaseState = await syncReleaseVector(db, release.id, document, options.dryRun);
  /* No encoder, nothing written, no refusal: the machine keeps publishing and the searchers
     stay lexical. Answered once here because the property belongs to the process, and one
     absent encoder cannot embed the cards either. */
  if (releaseState === "absent") return outcome;
  count(outcome, releaseState);

  /* Card labels come from the bare core vocabulary rather than this release's overlay: a
     card version is one row pinned by any number of releases, and two overlays would give
     it two documents that rewrite each other on every pass. */
  const core = openView();
  const labelOf = (id: string): string => core.get(id)?.label ?? id;
  for (const row of pinned) {
    if (options.seenCards.has(row.id)) continue;
    options.seenCards.add(row.id);
    const state = await syncCardVector(db, row, cardText(cardBody(row.body), labelOf), options.dryRun);
    if (state === "absent") return outcome;
    count(outcome, state);
  }
  return outcome;
}

function count(outcome: SyncOutcome, state: "written" | "unchanged"): void {
  if (state === "written") outcome.written += 1;
  else outcome.unchanged += 1;
}

type VectorState = "written" | "unchanged" | "absent";

/**
 * The release half. The stamp is read BEFORE the encoder is consulted, which is what makes
 * the unchanged case cost one indexed lookup instead of a model load, and what makes the
 * idempotency claim checkable without weights at all.
 */
async function syncReleaseVector(
  db: Db,
  releaseId: string,
  text: string,
  dryRun: boolean,
): Promise<VectorState> {
  const input = embeddedInput(text);
  const [current] = await db
    .select({ input: schema.releaseEmbedding.embeddedInputSha256 })
    .from(schema.releaseEmbedding)
    .where(eq(schema.releaseEmbedding.releaseId, releaseId));
  if (current?.input === input) return "unchanged";
  if (dryRun) return "written";

  const vector = await embed(text);
  if (vector === undefined) return "absent";

  /* `createdAt` moves on a rewrite because the alternative is a column that dates a vector
     it does not describe. The unchanged case never reaches here, so a repeated call leaves
     both columns byte-identical. Two concurrent triggers both write the same 384 numbers,
     because the encoder is deterministic across processes. */
  await db
    .insert(schema.releaseEmbedding)
    .values({ releaseId, embedding: vector, embeddedInputSha256: input })
    .onConflictDoUpdate({
      target: schema.releaseEmbedding.releaseId,
      set: { embedding: vector, embeddedInputSha256: input, createdAt: sql`now()` },
    });
  return "written";
}

async function syncCardVector(db: Db, row: CardRow, text: string, dryRun: boolean): Promise<VectorState> {
  const input = embeddedInput(text);
  /* `input` is null both for a card with no vector and for one written before the stamp
     column existed: two different states and the same instruction, re-encode. */
  if (row.input === input) return "unchanged";
  if (dryRun) return "written";

  const vector = await embed(text);
  if (vector === undefined) return "absent";
  await db
    .insert(schema.cardVersionEmbedding)
    .values({ cardVersionId: row.id, embedding: vector, embeddedInputSha256: input })
    .onConflictDoUpdate({
      target: schema.cardVersionEmbedding.cardVersionId,
      set: { embedding: vector, embeddedInputSha256: input, createdAt: sql`now()` },
    });
  return "written";
}

/**
 * The pinned card versions with their stored bytes and their current stamp, in the order
 * the release stored the refs, deduplicated.
 *
 * One `IN` over card ids rather than one over every `id@version` pair, narrowed to the pin
 * set afterwards: selecting by id alone returns every version of a pinned id. A pin that
 * does not parse names no row and is dropped; the resolver reports it at publish and there
 * is nothing here to attach a vector to.
 */
async function pinnedCards(db: Db, cardRefs: readonly string[]): Promise<CardRow[]> {
  const wanted = new Map<string, { id: string; version: string }>();
  for (const pin of cardRefs) {
    const parsed = parseCardRef(pin);
    if (parsed === undefined) continue;
    const ref = cardRef(parsed.id, parsed.version);
    if (!wanted.has(ref)) wanted.set(ref, parsed);
  }
  if (wanted.size === 0) return [];

  const rows = await db
    .select({
      id: schema.cardVersion.id,
      cardId: schema.cardVersion.cardId,
      version: schema.cardVersion.version,
      body: schema.cardVersion.body,
      source: schema.cardVersion.source,
      input: schema.cardVersionEmbedding.embeddedInputSha256,
    })
    .from(schema.cardVersion)
    .leftJoin(schema.cardVersionEmbedding, eq(schema.cardVersionEmbedding.cardVersionId, schema.cardVersion.id))
    .where(inArray(schema.cardVersion.cardId, [...new Set([...wanted.values()].map((pin) => pin.id))]));

  const byRef = new Map(rows.map((row) => [cardRef(row.cardId, row.version), row]));
  const out: CardRow[] = [];
  for (const ref of wanted.keys()) {
    const row = byRef.get(ref);
    if (row !== undefined) out.push(row);
  }
  return out;
}

/* --------------------- the blueprint document --------------------- */

/** A release reassembled into the graph the site scores, with the scorecard that describes it. */
export interface ResolvedGraph {
  blueprint: ResolvedBlueprint;
  analysis: BlueprintAnalysis;
}

/**
 * The release reassembled the way an export reassembles it: the local vocabulary layered
 * over the core, every pinned card's verbatim YAML under its bundle path, and `loadBundle`
 * over the result. `undefined` when the release does not resolve cleanly, which is the same
 * bar the registry holds a release to before it draws its graph; the document then falls
 * back to the manifest alone, so a vector always exists.
 *
 * The stored scorecard wins over a fresh one where it exists, because it is the reading the
 * site publishes for this release.
 */
export function resolvedGraph(release: ReleaseRecord, pinned: readonly CardRow[]): ResolvedGraph | undefined {
  let overlay;
  try {
    overlay = parseStoredVocabulary(release.vocabulary, "reembedRelease");
  } catch (cause) {
    if (cause instanceof MalformedVocabularyError) return undefined;
    throw cause;
  }

  const cardFiles: Record<string, string> = {};
  for (const row of pinned) cardFiles[cardFilePath(cardRef(row.cardId, row.version))] = row.source;
  const bundle: Bundle = { manifest: release.manifest, dot: release.dot, cardFiles };

  let loaded;
  try {
    loaded = loadBundle(bundle, { ontology: openView(overlay?.terms) });
  } catch {
    return undefined;
  }
  if (loaded.blueprint === undefined || loaded.analysis === undefined || hasErrors(loaded.diagnostics)) {
    return undefined;
  }
  return { blueprint: loaded.blueprint, analysis: storedAnalysis(release) ?? loaded.analysis };
}

/** The stored scorecard, or `undefined` when any of its three parts is missing. */
function storedAnalysis(release: ReleaseRecord): BlueprintAnalysis | undefined {
  const stored = release.analysis;
  if (stored === undefined || stored === null) return undefined;
  if (typeof stored.autonomy !== "object" || typeof stored.security !== "object" || typeof stored.phaseCoverage !== "object") {
    return undefined;
  }
  return { autonomy: stored.autonomy, security: stored.security, phaseCoverage: stored.phaseCoverage, diagnostics: [] };
}

/**
 * The blueprint as one document: purpose first, then structure.
 *
 * Field order is fixed and load-bearing: a transformer reads the document as a sequence, so
 * two orderings of the same facts are two different vectors. Lists that have no natural
 * order are sorted; the graph's lists keep graph order, which is a fact about the blueprint.
 *
 * Over budget, the document gives up description sentences first, then the routing line,
 * then the actions on the step lines, in that order. The actions are the bulk of a large
 * graph, so once they go the description and the routing come back if they now fit: they
 * are short and say more about what the blueprint is for than a seventh action sentence.
 * The first four lines never go.
 */
export function blueprintText(manifest: BundleManifest, resolved: ResolvedGraph | undefined): string {
  const head = manifestLines(manifest);
  const structure = resolved === undefined ? undefined : structureLines(resolved);
  const render = (descriptionSentences: number, routing: boolean, actions: boolean): string =>
    [
      DOCUMENT_VERSION,
      ...head.fixed,
      ...head.description.slice(0, descriptionSentences),
      head.category,
      ...(structure === undefined ? [] : structure(routing, actions)),
    ].join("\n");

  const attempts: [number, boolean, boolean][] = [
    [2, true, true],
    [1, true, true],
    [0, true, true],
    [0, false, true],
    [2, true, false],
    [1, true, false],
    [0, true, false],
    [0, false, false],
  ];
  let text = render(...attempts[0]);
  for (const attempt of attempts.slice(1)) {
    if (text.length <= BLUEPRINT_DOCUMENT_BUDGET) break;
    text = render(...attempt);
  }
  return text;
}

function manifestLines(manifest: BundleManifest): {
  fixed: string[];
  description: string[];
  category: string;
} {
  const title = str(manifest.title);
  const summary = str(manifest.summary);
  const description = str(manifest.description);
  const category = str(manifest.category);
  const tags = strings(manifest.tags);
  return {
    fixed: [`Blueprint: ${title}`, `Purpose: ${summary}`],
    description: description === "" ? [] : [sentences(description, 2).join(" ")],
    category: `Category: ${category === "" ? "none" : category}. Tags: ${tags.length === 0 ? "none" : tags.join(", ")}.`,
  };
}

/** The first `count` sentences of a text, split on sentence-ending punctuation. */
function sentences(text: string, count: number): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s !== "")
    .slice(0, count);
}

function structureLines(resolved: ResolvedGraph): (routing: boolean, actions: boolean) => string[] {
  const { blueprint, analysis } = resolved;
  const view = blueprint.ontology;
  const label = (id: string): string => view.get(id)?.label ?? id;
  const nodes = blueprint.nodes;

  const nodeList = nodes.map((n) => `${n.nodeId} (${n.card.name}, ${label(n.card.type)})`).join("; ");
  const steps = (withActions: boolean): string[] =>
    nodes.map((n) => {
      const phases = strings(n.card.phases).map(label);
      const head = `- ${n.nodeId}, ${n.card.name} (${label(n.card.type)}; phases: ${phases.length === 0 ? "none" : phases.join(", ")})`;
      return withActions ? `${head}: ${n.card.action}` : head;
    });

  const routed = blueprint.edges.filter((e) => e.label !== undefined || e.condition !== undefined);
  const routing = routed.length === 0
    ? "Routing: linear, no branches."
    : `Routing: ${routed
        .map((e) => `${e.source} -> ${e.target}${e.label === undefined ? "" : ` "${e.label}"`}${e.condition === undefined ? "" : ` when ${e.condition}`}`)
        .join("; ")}`;

  const cycles = blueprint.graph.cycles();
  const loops = cycles.length === 0
    ? "Loops: none."
    : `Loops: ${cycles.map((cycle) => [...cycle, cycle[0]].join(" -> ")).join("; ")}.`;

  const gates = nodes.filter((n) => requiresHuman(view, n.card.type));
  const humanGates = gates.length === 0
    ? "Human gates: none; the graph runs unattended."
    : `Human gates: ${gates.map((n) => `${n.nodeId} (${n.card.name})`).join(", ")}.`;

  const tools = requiredTools(blueprint);
  const mcp = [...new Set(nodes.flatMap((n) => strings(n.card.mcp)))].sort();
  const models = requiredAgents(blueprint);
  const stack =
    `Tools: ${tools.length === 0 ? "none" : tools.join(", ")}. ` +
    `MCP servers: ${mcp.length === 0 ? "none" : mcp.join(", ")}. ` +
    `Models: ${models.length === 0 ? "not pinned" : models.join(", ")}.`;

  const autonomy = analysis.autonomy;
  const security = analysis.security;
  const markers = Array.isArray(security?.penalties)
    ? security.penalties.map((p) => label(String(p.marker))).join(", ")
    : "";
  const scorecard =
    `Autonomy: ${String(autonomy?.autonomyClass ?? "unscored")} ` +
    `(${String(autonomy?.autonomousNodes ?? 0)} of ${String(autonomy?.totalNodes ?? nodes.length)} nodes run unattended). ` +
    `Security level ${String(security?.level ?? "unscored")}${markers === "" ? "" : `: ${markers}`}.`;

  const covered = strings(blueprint.phaseCoverage.covered).map(label);
  const missing = strings(blueprint.phaseCoverage.missing).map(label);
  const phasesLine =
    `Phases covered: ${covered.length === 0 ? "none" : covered.join(", ")}. ` +
    `Not covered: ${missing.length === 0 ? "none" : missing.join(", ")}.`;

  return (withRouting: boolean, withActions: boolean): string[] => [
    `Nodes (${nodes.length}, in graph order): ${nodeList}`,
    "Steps:",
    ...steps(withActions),
    ...(withRouting ? [routing] : []),
    loops,
    humanGates,
    stack,
    scorecard,
    phasesLine,
  ];
}

/* --------------------- the card document --------------------- */

/** A stored body as the partial card it can be trusted to be: `jsonb`, never validated here. */
function cardBody(body: unknown): Partial<NodeCard> {
  return typeof body === "object" && body !== null ? (body as Partial<NodeCard>) : {};
}

/**
 * A card as one document: what the node is, what it does and is told, then its contract.
 *
 * Excluded on purpose: `id`, `version`, `author` and `provenance` (naming, not meaning),
 * `notes` (authoring commentary), `params`, `model` and `agent` (deployment defaults), and
 * `cannot` (data-type ids the resolver already enforces structurally). `spec` stays whole:
 * it is the longest text and the reason the card index exists.
 */
export function cardText(card: Partial<NodeCard>, labelOf: (id: string) => string): string {
  const name = str(card.name);
  const type = str(card.type);
  const lines: string[] = [
    DOCUMENT_VERSION,
    `Card: ${name}${type === "" ? "" : ` (${labelOf(type)})`}`,
    `Does: ${str(card.action)}`,
    `Instructions: ${str(card.spec)}`,
  ];

  const phases = strings(card.phases).map(labelOf);
  const tools = strings(card.tools).map(labelOf);
  const mcp = strings(card.mcp);
  const skill = str(card.skill);
  lines.push(
    `Phases: ${phases.length === 0 ? "none declared" : phases.join(", ")}. ` +
      `Tools: ${tools.length === 0 ? "none" : tools.join(", ")}. ` +
      `MCP servers: ${mcp.length === 0 ? "none" : mcp.join(", ")}.` +
      (skill === "" ? "" : ` Skill: ${skill}.`),
  );

  const ports = (raw: unknown): string => {
    if (!Array.isArray(raw)) return "none";
    const named = raw
      .filter((p): p is { name: string; type?: string } => typeof p === "object" && p !== null && typeof (p as { name?: unknown }).name === "string")
      .map((p) => (typeof p.type === "string" ? `${p.name} (${labelOf(p.type)})` : p.name));
    return named.length === 0 ? "none" : named.join(", ");
  };
  lines.push(`Inputs: ${ports(card.inputs)}. Outputs: ${ports(card.outputs)}.`);

  const willNot = strings(card.willNot);
  if (willNot.length > 0) lines.push(`Will not: ${willNot.join("; ")}.`);
  const risks = strings(card.riskMarkers).map(labelOf);
  if (risks.length > 0) lines.push(`Risk markers: ${risks.join(", ")}.`);
  const dependencies = strings(card.dependencies);
  if (dependencies.length > 0) lines.push(`Depends on: ${dependencies.join(", ")}.`);

  return lines.join("\n");
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
