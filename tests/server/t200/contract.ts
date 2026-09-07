/* ============================================================
   T200 — the blind contract surface

   Not a test file. the vitest glob reaches `.test.ts` under `tests`
   and nothing else, so this module is imported by the suites beside
   it and is never collected as one itself.

   ── why every load is a dynamic import ──
   These tests were written in a worktree branched before the
   implementation existed. A static top-level import of a module
   that is not on disk fails the whole FILE at collection, which
   reports one red where the protocol asks for one per acceptance
   criterion and hides six criteria behind the first missing module.
   Loading inside the test that needs it turns "the module is not
   there yet" into exactly the per-criterion red the hand-off is
   supposed to produce. The specifier stays a literal so the `@`
   alias resolves.

   ── no candidate lists ──
   Every name is bound exactly and its absence quotes the clause
   that publishes it. T000 paid two rounds for the alternative: one
   candidate list resolved `encodeSession` instead of the cookie
   writer and produced five false reports of a broken round trip.
   Where the contract has a name, guessing is worse than binding.

   ── which record shape the item cells bind to ──
   D-200-08. The block as dispatched wrote `Results<BlueprintRecord>`
   and `Results<CardVersionRecord>`; both halves reported it as a
   defect from opposite sides of the blind boundary and both were
   corrected. `lib/core/archive/registry.ts` keys `BlueprintRecord`
   on `slug` alone, which D-80-01 already ruled cannot tell
   `alice/foo` from `bob/foo` under B-09, and its
   `CardVersionRecord.usedIn` is bare slugs. The published return
   types are now `Results<BlueprintSummary>` and
   `Results<CardSummary>` from `@/lib/server/registry`, which is
   also the only conversion any merged module offers. `ownerHandle`
   is therefore REQUIRED, and its absence is a failed acceptance
   criterion rather than a shape opinion.
   ============================================================ */

import { readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getRouteMatcher } from "next/dist/shared/lib/router/utils/route-matcher.js";
import { getRouteRegex } from "next/dist/shared/lib/router/utils/route-regex.js";
import { getSortedRoutes } from "next/dist/shared/lib/router/utils/sorted-routes.js";

export type Namespace = Record<string, unknown>;
export type UnknownFn = (...args: unknown[]) => unknown;

export const SEARCH = "@/lib/server/search";

/* --------------------- what the contract publishes --------------------- */

/**
 * The Published signatures block of T200's contract, quoted so a red says where the
 * name comes from and not merely that a test wanted it.
 */
export const PUBLISHED = {
  searchBlueprints:
    "searchBlueprints(db: Db, actor: Actor, params: Record<string, string>): " +
    "Promise<Results<BlueprintRecord>>",
  searchCards:
    "searchCards(db: Db, actor: Actor, params: Record<string, string>): " +
    "Promise<Results<CardVersionRecord>>",
  searchTerms:
    "searchTerms(db: Db, actor: Actor, params: Record<string, string>): " +
    "Promise<Results<OntologyTerm>>",
  reembedRelease: "reembedRelease(db: Db, bundleId: string, digest: string): Promise<void>",
} as const;

export type PublishedName = keyof typeof PUBLISHED;

/** Four, in the order the block publishes them. */
export const PUBLISHED_NAMES = Object.keys(PUBLISHED) as PublishedName[];

/**
 * D-200-32's two additions to the published block, approved and recorded there rather than
 * left as undeclared exports "because the published block is what the next task binds to".
 *
 * Bound here for exactly that reason and no more: T220, T260 and T261 list this task under
 * Depends on, and a name the block publishes is a name a consumer may reach for. Nothing in
 * this suite asserts what they DO — they are transport, their behaviour is exercised through
 * the routes, and a blind cell pinning the shape of a helper it has never seen would be
 * pinning its own guess.
 */
export const PUBLISHED_ADDITIONS = ["searchParams", "withSearchErrors"] as const;

/** The three readers. `reembedRelease` is the writer and takes no actor. */
export const READER_NAMES: readonly PublishedName[] = [
  "searchBlueprints",
  "searchCards",
  "searchTerms",
];

let searchModule: Promise<Namespace> | undefined;

/**
 * Memoised as the promise, rejection included: a module that is absent stays absent for
 * the whole file, and every test that awaits it gets its own copy of the same red rather
 * than one test's failure cascading into an unhandled rejection in the next.
 */
export function loadSearch(): Promise<Namespace> {
  searchModule ??= import("@/lib/server/search").then(
    (m) => m as unknown as Namespace,
    (cause: unknown) => {
      throw new Error(
        `${SEARCH} does not load.\n` +
          `  T200 owns \`lib/server/search/**\` and publishes four functions: ` +
          `${PUBLISHED_NAMES.join(", ")}.\n` +
          `  This is a failed acceptance criterion — the search surface is absent — and not ` +
          `a broken test. The specifier is a literal so the \`@\` alias resolves.`,
        { cause },
      );
    },
  );
  return searchModule;
}

export function describe_(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  return typeof value;
}

function requireFrom(mod: Namespace, name: string, clause: string): unknown {
  if (mod[name] !== undefined) return mod[name];
  const exported = Object.keys(mod).sort().join(", ") || "(nothing)";
  throw new Error(
    `${SEARCH} exports no \`${name}\`.\n` +
      `  the contract publishes: ${clause}\n` +
      `  found: ${exported}\n` +
      `  This is a failed acceptance criterion, not a naming difference. The Published ` +
      `signatures block names this export exactly. Do not add a synonym here; publish the ` +
      `name the contract states.`,
  );
}

/**
 * Bind one published name.
 *
 * Called LAST in a cell, after the premises and the planting. An import that reds at the
 * top of a cell masks every write below it while being perfectly correct about its own
 * subject — three cells found in an earlier wave had never executed, and the tell was a
 * red in 0ms where a scratch database was expected.
 */
export async function bind(name: PublishedName): Promise<UnknownFn> {
  const mod = await loadSearch();
  const value = requireFrom(mod, name, PUBLISHED[name]);
  if (typeof value !== "function") {
    throw new Error(
      `${SEARCH} exports \`${name}\` as ${describe_(value)}; the contract publishes it as ` +
        `a function: ${PUBLISHED[name]}`,
    );
  }
  return value as UnknownFn;
}

/* --------------------- the published response shape --------------------- */

export interface Hit {
  item: Record<string, unknown>;
  evidence: readonly string[];
  /** The published number the order was sorted on; `0` on an unranked listing. */
  score: number;
}

export interface Results {
  hits: readonly Hit[];
  facets: Record<string, readonly string[]>;
  ordered: boolean;
  /** Whether the process could encode the query. `absent` means the order is coverage alone. */
  encoder: "present" | "absent";
}

/**
 * `Results`, checked member by member. The shape is part of the published signature, so a
 * missing `ordered` is a failed criterion and not a formatting difference: the two
 * admissible states are *stated through* `ordered`, and a response without it cannot
 * declare itself unordered at all. `score` and `encoder` are checked the same way: they are
 * what lets a caller recompute the order rather than trust it.
 */
export function asResults(value: unknown, where: string): Results {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} answered ${describe_(value)}; the contract publishes ` +
        `\`interface Results<T> { hits: readonly Hit<T>[]; facets: Record<string, ` +
        `readonly string[]>; ordered: boolean }\`.`,
    );
  }
  const r = value as { hits?: unknown; facets?: unknown; ordered?: unknown; encoder?: unknown };

  if (!Array.isArray(r.hits)) {
    throw new Error(`${where} answered \`hits\` = ${describe_(r.hits)}; it is \`readonly Hit<T>[]\`.`);
  }
  if (typeof r.ordered !== "boolean") {
    throw new Error(
      `${where} answered \`ordered\` = ${describe_(r.ordered)}; it is \`boolean\`.\n` +
        `  AC5 has exactly two admissible states — "each hit carries the evidence for its ` +
        `rank, OR the response declares itself unordered" — and \`ordered\` is how the ` +
        `second one is said. A response that cannot say it has only the first state left, ` +
        `which makes evidence mandatory on every hit.`,
    );
  }
  if (r.facets === null || typeof r.facets !== "object" || Array.isArray(r.facets)) {
    throw new Error(
      `${where} answered \`facets\` = ${describe_(r.facets)}; it is ` +
        `\`Record<string, readonly string[]>\`.`,
    );
  }
  for (const [key, values] of Object.entries(r.facets as Record<string, unknown>)) {
    if (!Array.isArray(values)) {
      throw new Error(
        `${where} answered \`facets[${JSON.stringify(key)}]\` = ${describe_(values)}; every ` +
          `facet is \`readonly string[]\`.`,
      );
    }
    for (const [i, v] of values.entries()) {
      if (typeof v !== "string") {
        throw new Error(
          `${where} answered \`facets[${JSON.stringify(key)}][${i}]\` = ${describe_(v)}; ` +
            `every facet value is a string.`,
        );
      }
    }
  }

  if (r.encoder !== "present" && r.encoder !== "absent") {
    throw new Error(
      `${where} answered \`encoder\` = ${JSON.stringify(r.encoder)}; it is \`"present" | "absent"\`.\n` +
        `  A caller has to be able to tell a coverage-only order from one the vector channel ` +
        `took part in, and this field is how the response says which.`,
    );
  }

  const hits: Hit[] = [];
  for (const [i, hit] of (r.hits as unknown[]).entries()) {
    hits.push(asHit(hit, `${where}.hits[${i}]`));
  }
  return {
    hits,
    facets: r.facets as Record<string, readonly string[]>,
    ordered: r.ordered,
    encoder: r.encoder,
  };
}

export function asHit(value: unknown, where: string): Hit {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${where} is ${describe_(value)}; the contract publishes ` +
        `\`interface Hit<T> { item: T; evidence: readonly string[] }\`.`,
    );
  }
  const h = value as { item?: unknown; evidence?: unknown; score?: unknown };
  if (h.item === null || typeof h.item !== "object") {
    throw new Error(`${where}.item is ${describe_(h.item)}; it is the record the search found.`);
  }
  if (!Array.isArray(h.evidence)) {
    throw new Error(
      `${where}.evidence is ${describe_(h.evidence)}; it is \`readonly string[]\`. An empty ` +
        `array is legitimate — under \`ordered: false\` it is the shippable state AC5 names ` +
        `— but the member itself is published and is not optional.`,
    );
  }
  for (const [i, e] of (h.evidence as unknown[]).entries()) {
    if (typeof e !== "string") {
      throw new Error(`${where}.evidence[${i}] is ${describe_(e)}; every entry is a string.`);
    }
  }
  if (typeof h.score !== "number" || Number.isNaN(h.score)) {
    throw new Error(
      `${where}.score is ${describe_(h.score)}; it is the published number the order was ` +
        `sorted on, and a rank without it cannot be checked against its own evidence.`,
    );
  }
  return { item: h.item as Record<string, unknown>, evidence: h.evidence as readonly string[], score: h.score };
}

/* --------------------- the item shapes, at their intersection --------------------- */

/** `BlueprintSummary` (D-200-08), checked member by member. */
export function asBlueprintItem(value: unknown, where: string): {
  ownerHandle: string;
  slug: string;
  digest: string;
  manifest: Record<string, unknown>;
  cardRefs: readonly string[];
} {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} is ${describe_(value)}; a blueprint hit's \`item\` is a record.`);
  }
  const r = value as Record<string, unknown>;
  for (const key of ["ownerHandle", "slug", "digest"] as const) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(
        `${where}.${key} is ${JSON.stringify(r[key])}; D-200-08 publishes the item as ` +
          `\`BlueprintSummary { ownerHandle, slug, manifest, digest, cardRefs }\` from ` +
          `@/lib/server/registry.\n` +
          `  \`ownerHandle\` is the member the dispatched block was missing. D-80-01: a ` +
          `record keyed on one half of a two-part key cannot tell \`alice/foo\` from ` +
          `\`bob/foo\` under B-09, and T261 moves the public blueprint URL onto exactly ` +
          `that half.`,
      );
    }
  }
  if (r.manifest === null || typeof r.manifest !== "object") {
    throw new Error(`${where}.manifest is ${describe_(r.manifest)}; it is a BundleManifest.`);
  }
  if (!Array.isArray(r.cardRefs)) {
    throw new Error(`${where}.cardRefs is ${describe_(r.cardRefs)}; it is CardRef[].`);
  }
  return r as never;
}

/** `CardSummary` (D-200-08), checked member by member. */
export function asCardItem(value: unknown, where: string): {
  ref: string;
  id: string;
  version: string;
  digest: string;
  card: Record<string, unknown>;
  usedIn?: unknown;
} {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} is ${describe_(value)}; a card hit's \`item\` is a record.`);
  }
  const r = value as Record<string, unknown>;
  for (const key of ["ref", "id", "version", "digest"] as const) {
    if (typeof r[key] !== "string" || r[key] === "") {
      throw new Error(
        `${where}.${key} is ${JSON.stringify(r[key])}; D-200-08 publishes the item as ` +
          `\`CardSummary { ref, id, version, digest, card, usedIn }\` from ` +
          `@/lib/server/registry, whose \`usedIn\` is owner-qualified rather than ` +
          `\`CardVersionRecord\`'s bare slugs.`,
      );
    }
  }
  if (r.card === null || typeof r.card !== "object") {
    throw new Error(`${where}.card is ${describe_(r.card)}; it is a NodeCard.`);
  }
  return r as never;
}

/** `OntologyTerm` (lib/core/ontology/types.ts:29-56) — the one return type with no second reading. */
export function asTermItem(value: unknown, where: string): {
  id: string;
  kind: string;
  label: string;
  description: string;
} {
  if (value === null || typeof value !== "object") {
    throw new Error(`${where} is ${describe_(value)}; a term hit's \`item\` is an OntologyTerm.`);
  }
  const r = value as Record<string, unknown>;
  for (const key of ["id", "kind", "label", "description"] as const) {
    if (typeof r[key] !== "string") {
      throw new Error(
        `${where}.${key} is ${describe_(r[key])}; \`OntologyTerm\` publishes ` +
          `\`{ id, kind, label, description, since }\` as required members.`,
      );
    }
  }
  return r as never;
}

/* --------------------- AC5, the honesty clause --------------------- */

/**
 * D-200-09's law, as one predicate: `ordered === hits.every((h) => h.evidence.length > 0)`.
 *
 * A biconditional and not an implication, which is what makes it checkable from outside the
 * module. The forward half is the criterion as the section words it — an unexplained
 * ranking is inadmissible. The reverse half is the one a reviewer would leave out: a
 * response that declares itself UNORDERED while every hit carries evidence is claiming not
 * to have ranked and handing over the ranking anyway, and a caller has no way to tell which
 * of the two statements to believe.
 *
 * The empty-hit-set case is deliberately not excused. `[].every(...)` is `true`, so an
 * empty result must answer `ordered: true` under this law. That reads oddly and it is
 * correct: a response with nothing in it has no ordering it failed to explain, and the law
 * has to be one expression or it is two rules a module can satisfy separately.
 *
 * Returns the complaint, or `undefined`.
 */
export function violatesOrderedLaw(results: Results, where: string): string | undefined {
  const allExplained = results.hits.every((hit) => hit.evidence.length > 0);
  if (results.ordered === allExplained) return undefined;
  const silent = results.hits
    .map((hit, i) => ({ hit, i }))
    .filter(({ hit }) => hit.evidence.length === 0)
    .map(({ i }) => i);
  return (
    `${where} answered \`ordered: ${results.ordered}\` over ${results.hits.length} hits, of ` +
    `which ${silent.length} carry no evidence` +
    (silent.length === 0 ? "" : ` (ranks ${silent.join(", ")})`) +
    `.\n` +
    `  D-200-09 states the honesty clause as a law: \`ordered === hits.every((h) => ` +
    `h.evidence.length > 0)\`. AC5 admits exactly two states — each hit carries the ` +
    `evidence for its rank, OR the response declares itself unordered — and this is ` +
    `neither.\n` +
    (results.ordered
      ? `  Claiming an order and not saying what produced it is the state the criterion ` +
        `exists to refuse. Answering \`ordered: false\` with empty evidence is legitimate ` +
        `and shippable.`
      : `  Declaring itself unordered while handing every hit its evidence leaves a caller ` +
        `unable to tell which of the two statements to act on. If the rank is explained, ` +
        `say \`ordered: true\`.`)
  );
}

/**
 * Under `ordered: true`, hits carrying byte-identical evidence must occupy a contiguous
 * block of ranks. Returns the complaint, or `undefined`.
 *
 * This is the honesty clause with no wording pinned. If the evidence explains the rank,
 * then two hits the evidence says the same thing about have nothing left to separate them
 * but a tie-break, and a tie-break keeps them adjacent. A hit wedged between two hits whose
 * evidence is identical was ranked by something the response did not disclose — which is
 * precisely D-200-01's argument for why a lexical derivation makes `ordered: true`
 * reachable and a cosine distance does not.
 *
 * It measures nothing on a run where every evidence value is distinct, and says so.
 */
export function unexplainedOrdering(results: Results, where: string): string | undefined {
  if (!results.ordered) return undefined;
  const groups = new Map<string, number[]>();
  for (const [i, hit] of results.hits.entries()) {
    const key = JSON.stringify(hit.evidence);
    const held = groups.get(key);
    if (held === undefined) groups.set(key, [i]);
    else held.push(i);
  }
  for (const [key, ranks] of groups) {
    if (ranks.length < 2) continue;
    const span = ranks[ranks.length - 1] - ranks[0] + 1;
    if (span === ranks.length) continue;
    const wedged = [];
    for (let i = ranks[0]; i <= ranks[ranks.length - 1]; i += 1) {
      if (!ranks.includes(i)) wedged.push(i);
    }
    return (
      `${where} answered \`ordered: true\` and ranked hits ${ranks.join(", ")} apart while ` +
      `giving all of them the same evidence ${key}, with hits ${wedged.join(", ")} in ` +
      `between.\n` +
      `  Whatever put those hits on opposite sides of another one is not in the evidence, ` +
      `so the evidence does not explain the rank. AC5's other state is open: answer ` +
      `\`ordered: false\` and the ranking claim goes away with it.`
    );
  }
  return undefined;
}

/**
 * D-200-01, held to the shipped strings rather than to a docblock: "do not call it semantic
 * in any shipped string, docblock or `evidence` value — a deterministic bag-of-tokens
 * embedding is a LEXICAL one, and naming it semantic is the precise shape of dishonesty
 * this repository's disclaimers exist to prevent."
 *
 * Applied to everything reachable through the published surface: evidence values, facet
 * keys and facet values. No fixture in this suite contains the word, which is what makes a
 * hit a finding rather than an echo.
 */
export const FORBIDDEN_WORD = /semantic/i;

export function callsItselfSemantic(results: Results, where: string): string | undefined {
  const offenders: string[] = [];
  for (const [i, hit] of results.hits.entries()) {
    for (const e of hit.evidence) {
      if (FORBIDDEN_WORD.test(e)) offenders.push(`hits[${i}].evidence: ${JSON.stringify(e)}`);
    }
  }
  for (const [key, values] of Object.entries(results.facets)) {
    if (FORBIDDEN_WORD.test(key)) offenders.push(`a facet key: ${JSON.stringify(key)}`);
    for (const v of values) {
      if (FORBIDDEN_WORD.test(v)) offenders.push(`facets[${JSON.stringify(key)}]: ${JSON.stringify(v)}`);
    }
  }
  if (offenders.length === 0) return undefined;
  return (
    `${where} ships the word "semantic" to a caller:\n  ${offenders.join("\n  ")}\n` +
    `  D-200-01: there is no embedding provider, the derivation is local and deterministic, ` +
    `and a deterministic bag-of-tokens derivation is a LEXICAL one. No fixture in this ` +
    `suite contains the word, so this is the module's own string.`
  );
}

/* --------------------- leak scanning --------------------- */

/**
 * Every string reachable inside a value, keys included. A leak can arrive as a property
 * name as easily as a property value — `facets` is a `Record<string, readonly string[]>`,
 * and a facet key is a string nobody asserted on.
 *
 * A walk with a `seen` set rather than `JSON.stringify`: the input is whatever the module
 * returned, and a value that cycles or carries a `toJSON` would make stringification either
 * throw or quietly answer a different question.
 */
export function collectStrings(value: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof Date) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      out.push(key);
      walk(item);
    }
  };
  walk(value);
  return out;
}

/** Which of `tokens` appear anywhere inside `value`. Sorted, so a red reads the same twice. */
export function findTokens(value: unknown, tokens: readonly string[]): string[] {
  const strings = collectStrings(value);
  const hits = new Set<string>();
  for (const token of tokens) {
    for (const s of strings) {
      if (s.includes(token)) {
        hits.add(token);
        break;
      }
    }
  }
  return [...hits].sort();
}

/**
 * Checked before the tells are used rather than after one over-matches.
 *
 * A blacklist asserted with `includes` answers "do these characters appear", where the
 * claim is "did this leak". The two differ exactly when a tell is a substring of something
 * a response may legitimately carry. So every tell is checked against every string the
 * ADMISSIBLE fixtures contain, at fixture time, and a collision is a broken test rather
 * than a red.
 */
export function assertTellsCannotOverMatch(
  tells: readonly string[],
  admissible: readonly unknown[],
): void {
  const strings = admissible.flatMap((value) => collectStrings(value));
  const collisions: string[] = [];
  for (const tell of tells) {
    if (tell === "") {
      collisions.push("(empty string)");
      continue;
    }
    for (const s of strings) {
      if (s.includes(tell)) {
        collisions.push(`${JSON.stringify(tell)} is a substring of ${JSON.stringify(s)}`);
        break;
      }
    }
  }
  if (collisions.length > 0) {
    throw new Error(
      `A private-content tell is a substring of admissible fixture content, so the leak ` +
        `sweep would red an implementation that leaked nothing.\n  ` +
        collisions.join("\n  ") +
        `\n  This is a broken test. Re-mint the fixture identifier; do not delete the tell.`,
    );
  }
}

/* --------------------- comparing two answers --------------------- */

/**
 * A response reduced to something two calls can be compared on: the hits in the order they
 * came back, keyed by whatever identifies the item, plus the facet map and `ordered`.
 *
 * Order-preserving on purpose. AC1's unknown-key cells assert that adding a key nobody
 * knows changes NOTHING, and a comparison that sorted first would admit a module that
 * reordered the shelf on an unknown key — which is a shared link rendering differently,
 * the exact breakage the criterion protects against.
 */
export function fingerprint(results: Results): {
  keys: string[];
  facets: Record<string, readonly string[]>;
  ordered: boolean;
} {
  return {
    keys: results.hits.map((hit) => itemKey(hit.item)),
    facets: results.facets,
    ordered: results.ordered,
  };
}

/** Whatever names this item, across all three return types. Never sent anywhere. */
export function itemKey(item: Record<string, unknown>): string {
  if (typeof item.ref === "string") return `card:${item.ref}`;
  if (typeof item.slug === "string") {
    const owner = typeof item.ownerHandle === "string" ? item.ownerHandle : "(no ownerHandle)";
    return `blueprint:${owner}/${item.slug}`;
  }
  if (typeof item.id === "string") return `term:${item.id}`;
  return `unknown:${JSON.stringify(item)}`;
}

/* --------------------- the evidence grammar (D-200-09) --------------------- */

/**
 * `<field>:<token>` — `title:agent`, `tag:rag`. Pinned by D-200-09 rather than invented
 * here, and deliberately tolerant about what a token may contain: the ruling fixes the
 * shape and the separator, not the alphabet, and a fixture identifier carries digits and
 * hyphens.
 *
 * The field name is anchored and the separator is required. An evidence value that is a
 * bare sentence carries no field, which is the degeneration the grammar exists to stop —
 * `evidence` restating the query instead of naming what matched.
 */
export const EVIDENCE_GRAMMAR = /^[A-Za-z][A-Za-z0-9_.-]*:.+$/;

export function violatesEvidenceGrammar(results: Results, where: string): string | undefined {
  const offenders: string[] = [];
  for (const [i, hit] of results.hits.entries()) {
    for (const [j, e] of hit.evidence.entries()) {
      if (!EVIDENCE_GRAMMAR.test(e)) offenders.push(`hits[${i}].evidence[${j}] = ${JSON.stringify(e)}`);
    }
  }
  if (offenders.length === 0) return undefined;
  return (
    `${where} shipped evidence outside the published grammar:\n  ${offenders.join("\n  ")}\n` +
    `  D-200-09 publishes it as \`<field>:<token>\` — \`title:agent\`, \`tag:rag\` — so a ` +
    `caller can tell WHICH field matched from the value itself. A bare sentence names no ` +
    `field, which is \`evidence\` degenerating into a restatement of the query.`
  );
}

/**
 * Which `<field>` names appear in a response's evidence, deduplicated and sorted.
 *
 * Used by the cell that holds D-200-09's last clause — "rank-affecting matches only: a
 * filter does not appear, because it did not move the order". A filter narrows the hit set
 * and leaves every surviving hit in the same relative position, so a `tag:` entry appearing
 * under `{q, tag}` is evidence for a rank the tag did not produce.
 */
export function evidenceFields(results: Results): string[] {
  const fields = new Set<string>();
  for (const hit of results.hits) {
    for (const e of hit.evidence) {
      const at = e.indexOf(":");
      if (at > 0) fields.add(e.slice(0, at));
    }
  }
  return [...fields].sort();
}

/* --------------------- the parameter sets and the facet keys --------------------- */

/**
 * The three published parameter sets, verbatim from the contract's own sentence: "the
 * parameter sets are fixed by the live URLs and may not change or shared links break".
 */
export const PARAMS = {
  searchBlueprints: ["q", "tag", "cat", "phase", "autonomy", "df", "forks", "sort"],
  searchCards: ["q", "type", "phase", "human", "risk", "sort"],
  searchTerms: ["q", "kind", "origin"],
} as const satisfies Record<string, readonly string[]>;

/**
 * D-200-18: the facet map is keyed by the URL PARAMETER names, not the reader names,
 * "because the facet map's job is to tell a client which VALUES a given KEY will accept,
 * so the key it names must be the key the client puts back in the URL".
 */
export const FACET_KEYS = {
  searchBlueprints: ["cat", "phase", "tag"],
  searchCards: ["phase", "risk", "type"],
  searchTerms: ["kind", "origin"],
} as const satisfies Record<string, readonly string[]>;

/** D-200-10's value sets. An unrecognised value falls back to the default rather than erroring. */
export const SORT_VALUES = {
  searchBlueprints: ["slug"],
  searchCards: ["used", "name", "type", "phase"],
} as const satisfies Record<string, readonly string[]>;

/**
 * The orderings AC2 forbids, as `sort` values a caller could send.
 *
 * `used` is NOT here, and leaving it out is a measurement rather than an oversight:
 * `components/nodes/NodeBrowser.tsx` ships it as "Most used", it counts PINNING BLUEPRINTS,
 * and an archive-derived count is a fact about the index rather than a measure of
 * attention — which is the distinction D-31 and D-57 actually draw (D-200-15). A cell
 * reading "no popularity sort" literally would red a correct module on it.
 */
export const FORBIDDEN_SORTS = [
  "autonomy",
  "level",
  "darkfactory",
  "df",
  "downloads",
  "votes",
  "stars",
  "popular",
  "popularity",
  "forks",
] as const;

/** Sorted set equality, so a facet cell does not pin an order the contract never states. */
export function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const x = [...new Set(a)].sort();
  const y = [...new Set(b)].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/* --------------------- the three routes (D-200-16) --------------------- */

/**
 * D-200-16 publishes the route, which had never been published anywhere.
 *
 *     GET /api/search/blueprints?q&tag&cat&phase&autonomy&df&forks&sort -> Results<BlueprintSummary>
 *     GET /api/search/cards?q&type&phase&human&risk&sort                -> Results<CardSummary>
 *     GET /api/search/terms?q&kind&origin                               -> Results<OntologyTerm>
 *
 * GET and not the mock's `POST /api/search`, decided by the contract's own justification:
 * the parameter sets are fixed by the live URLs and may not change or shared links break,
 * and a POST body is not a link. The 200 body is the `Results` object itself, not an
 * envelope around it.
 */
export const ROUTES = {
  searchBlueprints: { url: "GET /api/search/blueprints", path: "/api/search/blueprints" },
  searchCards: { url: "GET /api/search/cards", path: "/api/search/cards" },
  searchTerms: { url: "GET /api/search/terms", path: "/api/search/terms" },
} as const satisfies Record<PublishedName | string, { url: string; path: string }>;

export type RouteName = keyof typeof ROUTES;
export const ROUTE_NAMES = Object.keys(ROUTES) as RouteName[];

interface DiscoveredRoute {
  /** App Router pattern, e.g. `/api/search/blueprints`. */
  pattern: string;
  /** Absolute path of the `route` file, imported at runtime and never at compile time. */
  file: string;
}

const ROUTE_FILE = /^route\.(ts|tsx|js|mjs)$/;
const SEARCH_API_ROOT = fileURLToPath(new URL("../../../app/api/search/", import.meta.url));

let table: DiscoveredRoute[] | undefined;

function walk(dir: string, segments: string[], out: DiscoveredRoute[]): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // a tree the implementation has not created yet
  }
  for (const entry of entries) {
    if (entry.isDirectory()) walk(join(dir, entry.name), [...segments, entry.name], out);
    else if (ROUTE_FILE.test(entry.name)) {
      out.push({ pattern: `/api/${segments.join("/")}`, file: join(dir, entry.name) });
    }
  }
}

/**
 * Every route the implementation actually publishes under `app/api/search/**`, discovered
 * rather than assumed: D-200-16 publishes URLs, and the file layout underneath them is the
 * implementation's to choose. So a red says the URL is unserved, never that a file is
 * missing from a path this file guessed.
 */
function routeTable(): DiscoveredRoute[] {
  if (table !== undefined) return table;
  const found: DiscoveredRoute[] = [];
  walk(SEARCH_API_ROOT, ["search"], found);
  if (found.length === 0) {
    throw new Error(
      `No route file exists under app/api/search/**.\n` +
        `  T200 owns that tree and D-200-16 publishes three GET routes in it: ` +
        `${ROUTE_NAMES.map((n) => ROUTES[n].url).join(", ")}.\n` +
        `  AC3's "an empty result returns the facet vocabularies, not a 404" is HTTP ` +
        `language, so a route is unambiguously in scope.\n` +
        `  This is a failed acceptance criterion — the search API is absent — and not a ` +
        `broken test.`,
    );
  }
  const byPattern = new Map(found.map((r) => [r.pattern, r]));
  let ordered: string[];
  try {
    ordered = getSortedRoutes([...byPattern.keys()]);
  } catch (cause) {
    throw new Error(
      `The published route tree does not sort: ${String(cause)}\n` +
        `  Patterns found: ${[...byPattern.keys()].sort().join(", ")}\n` +
        `  This is Next's own conflict check, not this suite's opinion about layout.`,
      { cause },
    );
  }
  table = ordered.map((pattern) => byPattern.get(pattern)!);
  return table;
}

function matchRoute(path: string): { route: DiscoveredRoute; params: Record<string, unknown> } {
  const routes = routeTable();
  for (const route of routes) {
    const params = getRouteMatcher(getRouteRegex(route.pattern))(path);
    if (params !== false) return { route, params };
  }
  throw new Error(
    `No published route matches \`${path}\`.\n` +
      `  Discovered patterns, in the App Router's precedence order: ` +
      `${routes.map((r) => r.pattern).join(", ")}\n` +
      `  D-200-16 publishes the URL and the file layout is the implementation's, so this ` +
      `says the URL is unserved rather than that a file is missing from a guessed path.`,
  );
}

/** Which published pattern serves a URL, asked without opening a database or a module. */
export function routePatternFor(path: string): string {
  return matchRoute(path).route.pattern;
}

/**
 * The query string for a parameter map, in the order the caller wrote it.
 *
 * Built with `URLSearchParams` rather than by hand so a value carrying a `&` or a `+`
 * survives — AC1 protects shared links, and a link is exactly where an encoded value
 * arrives.
 */
export function queryString(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.append(key, value);
  const text = search.toString();
  return text === "" ? "" : `?${text}`;
}

/**
 * Drive a published URL the way a caller does: matched through Next's own router,
 * dispatched to whichever file wins, and invoked with `params` as a promise —
 * `context.params` is a promise in this version of Next
 * (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`).
 *
 * `name` names the published route only so a red can quote the contract; it takes no part
 * in choosing the module.
 */
export async function callRoute(
  name: RouteName,
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): Promise<Response> {
  const spec = ROUTES[name];
  const path = spec.path;
  const { route, params: routeParams } = matchRoute(path);
  let mod: Namespace;
  try {
    mod = (await import(/* @vite-ignore */ pathToFileURL(route.file).href)) as Namespace;
  } catch (cause) {
    throw new Error(
      `\`${route.pattern}\` — the route serving \`${path}\` — does not load.\n` +
        `  Driving the published URL \`${spec.url}\`.`,
      { cause },
    );
  }
  const get = mod.GET;
  if (typeof get !== "function") {
    throw new Error(
      `\`${route.pattern}\` exports no \`GET\` (it has: ` +
        `${Object.keys(mod).sort().join(", ") || "(nothing)"}). D-200-16 publishes the ` +
        `method, and this route is the one serving \`${spec.url}\`.`,
    );
  }
  const request = new Request(`https://darkprint.test${path}${queryString(params)}`, { headers });
  const answered = await (get as UnknownFn)(request, { params: Promise.resolve(routeParams) });
  if (!(answered instanceof Response)) {
    throw new Error(
      `\`${spec.url}\` answered ${describe_(answered)}; a route handler returns a Response.`,
    );
  }
  return answered;
}

/* --------------------- RFC 9457 --------------------- */

export const RFC9457_MEMBERS = ["type", "title", "status", "detail", "instance"] as const;

/** `application/problem+json` may legitimately carry a charset, so the check is a prefix. */
export function isProblemContentType(header: string | null): boolean {
  return header !== null && header.split(";")[0].trim() === "application/problem+json";
}

/* --------------------- calling a searcher --------------------- */

/**
 * Bind, call, and check the response shape, in that order.
 *
 * The bind happens HERE rather than at the top of a cell, which is the point: a cell plants
 * its rows first and reaches for the module last. An import that reds at the top of a cell
 * masks every write below it while being perfectly correct about its own subject, and a red
 * in 0ms where a scratch database was expected is a cell that never started.
 */
export async function search(
  name: PublishedName,
  db: unknown,
  actor: unknown,
  params: Record<string, string>,
): Promise<Results> {
  const fn = await bind(name);
  const answered = await fn(db, actor, params);
  return asResults(answered, `${name}(db, actor, ${JSON.stringify(params)})`);
}
