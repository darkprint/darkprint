/* ============================================================
   T300 — the helpers the vector-channel criteria are asserted through

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests` and nothing else.

   Everything about the lexical half is imported from
   `../t200/contract` rather than restated: `violatesOrderedLaw`,
   `violatesEvidenceGrammar`, `callsItselfSemantic`, `fingerprint`,
   `itemKey` and `search` were written by another session and are
   merged. What is new here is only what the vector channel adds:
   the `similarity:` evidence entry, the published score formula
   that ties it to the order, and the two egress observers.
   ============================================================ */

import net from "node:net";
import tls from "node:tls";

import type { Results } from "../t200/contract";

/* --------------------- the published ranking --------------------- */

/**
 * The published constants, as literals rather than imports: a cell that read them off the
 * module under test would re-derive the implementer's own arithmetic with the implementer's
 * own numbers. Pinned here so a change to either is a deliberate edit in two places.
 *
 *     score = similarity + lexicalBoost * coverage
 *     hit   = similarity >= minSimilarity || coverage > 0
 *
 * `coverage` is the share of the query's content words found in the item's lexical fields,
 * so for a ONE-WORD query it is exactly 1 when the hit carries any `field:token` entry and 0
 * otherwise, which is what lets `violatesScoreFormula` recompute the score from the evidence.
 */
export const PUBLISHED_RANKING = { minSimilarity: 0.15, lexicalBoost: 0.15, maxHits: 20 } as const;

/** The vector channel's evidence entry: `similarity:` and a two-decimal reading. */
export const SIMILARITY_EVIDENCE = /^similarity:\d\.\d{2}$/;

export function carriesSimilarity(evidence: readonly string[]): boolean {
  return evidence.some((e) => SIMILARITY_EVIDENCE.test(e));
}

/** The similarity a hit discloses, or `undefined` when it carries none. */
export function similarityOf(evidence: readonly string[]): number | undefined {
  const entry = evidence.find((e) => SIMILARITY_EVIDENCE.test(e));
  return entry === undefined ? undefined : Number(entry.slice("similarity:".length));
}

/** The `field:token` entries, which is everything the lexical pass contributed. */
export function lexicalEntries(evidence: readonly string[]): string[] {
  return evidence.filter((e) => !e.startsWith("similarity:"));
}

/** Every `similarity:` entry that is not in the published two-decimal form. */
export function violatesSimilarityGrammar(results: Results, where: string): string | undefined {
  const offenders: string[] = [];
  for (const [i, hit] of results.hits.entries()) {
    for (const e of hit.evidence) {
      if (e.startsWith("similarity") && !SIMILARITY_EVIDENCE.test(e)) offenders.push(`hits[${i}].evidence: ${JSON.stringify(e)}`);
    }
  }
  if (offenders.length === 0) return undefined;
  return (
    `${where} shipped a similarity entry outside the published form \`similarity:0.43\`:\n  ` +
    `${offenders.join("\n  ")}\n  Two decimals, no unit, no other word: a caller reads it ` +
    `back into the score formula and a different spelling breaks that.`
  );
}

/**
 * Hits are sorted by `score`, descending. Stated over the published number rather than over
 * any private comparator, so a red says which two ranks disagree with their own scores.
 */
export function violatesScoreOrder(results: Results, where: string): string | undefined {
  const scores = results.hits.map((h) => scoreOf(h));
  for (let i = 1; i < scores.length; i += 1) {
    if (scores[i] > scores[i - 1]) {
      return (
        `${where} ranked a lower score above a higher one: rank ${i - 1} scores ` +
        `${scores[i - 1]} and rank ${i} scores ${scores[i]}.\n  scores by rank: ${scores.join(", ")}`
      );
    }
  }
  return undefined;
}

/**
 * For a ONE-WORD query, every hit's `score` is `similarity + lexicalBoost * coverage` where
 * coverage is 1 with any `field:token` entry and 0 without, and similarity is the disclosed
 * entry or 0. Rounded to four places, which is how the module publishes it.
 */
export function violatesScoreFormula(results: Results, where: string): string | undefined {
  const offenders: string[] = [];
  for (const [i, hit] of results.hits.entries()) {
    const similarity = similarityOf(hit.evidence) ?? 0;
    const coverage = lexicalEntries(hit.evidence).length > 0 ? 1 : 0;
    const expected = Math.round((similarity + PUBLISHED_RANKING.lexicalBoost * coverage) * 10_000) / 10_000;
    const actual = scoreOf(hit);
    /* The disclosed similarity is two decimals and the score is four, so the two can differ
       by up to half a hundredth before anything is wrong. */
    if (Math.abs(actual - expected) > 0.0051) {
      offenders.push(`hits[${i}] score ${actual}, evidence ${JSON.stringify(hit.evidence)} implies ${expected}`);
    }
  }
  if (offenders.length === 0) return undefined;
  return (
    `${where} published a score its own evidence does not reproduce:\n  ${offenders.join("\n  ")}\n` +
    `  score = similarity + ${PUBLISHED_RANKING.lexicalBoost} * coverage, and for a one-word ` +
    `query coverage is 1 exactly when a \`field:token\` entry is present.`
  );
}

function scoreOf(hit: Results["hits"][number]): number {
  return hit.score;
}

/** `Results.encoder`, already checked member by member by `asResults`. */
export function encoderOf(results: Results): "present" | "absent" {
  return results.encoder;
}

/**
 * Why a vector-channel red may not be a retrieval finding, and how to tell.
 *
 * Appended to the message of every cell that can red because the encoder is not present
 * rather than because a criterion failed. The weights are vendored under `models/`, but a
 * sparse checkout or a missing `node_modules` leaves the process with no encoder, and then
 * `reembedRelease` writes nothing, both tables stay empty, and every vector cell reds with
 * an empty answer for a reason that has nothing to do with retrieval.
 */
export const PROVISIONING_CAVEAT =
  "\n  BEFORE CHARGING THIS AS A DEFECT: check whether the `vector tables are populated` " +
  "premise in this same file passed. With no encoder in the process (models/ missing, or " +
  "@huggingface/transformers not installed) nothing is embedded, both tables stay empty, " +
  "and every vector cell here reds for a reason that has nothing to do with retrieval. A red " +
  "under an unpopulated table is a provisioning gap in the worktree that ran it.";

/* --------------------- the two egress observers --------------------- */

export interface Allowed {
  host: string;
  port: number;
}

export interface Egress {
  /** Every `fetch` the window saw, as `method url`. */
  readonly fetches: readonly string[];
  /** Every outbound socket the window saw, as `host:port`, allow-listed ones included. */
  readonly connections: readonly string[];
  /** The connections that were NOT to an allow-listed endpoint. The finding. */
  foreign(): string[];
  stop(): void;
}

interface SocketLike {
  connect: (...args: unknown[]) => unknown;
}

/**
 * Watch both layers a model download could leave through, for the length of one window.
 *
 * A `fetch` spy alone is blind in the one way that matters: a module that captured
 * `globalThis.fetch` into a local binding at import time never calls the replacement, and an
 * encoder that reaches for `node:https` directly never calls it either. So the transport is
 * watched as well, at `net.Socket.prototype.connect` and `tls.connect`, which every one of
 * those paths ends up in.
 *
 * The fetch arm throws: recording and calling through would let a 90MB download SUCCEED and
 * the cell would pass or time out rather than say what happened. The cells assert on the
 * RECORD and never on the throw.
 *
 * Postgres is a socket too. `allow` carries the endpoints this window is entitled to open,
 * built from the scratch database's own URL, and `foreign()` is everything else.
 */
export function watchEgress(allow: readonly Allowed[]): Egress {
  const fetches: string[] = [];
  const connections: string[] = [];
  const permitted = new Set(allow.map((a) => `${a.host}:${a.port}`));

  const realFetch = globalThis.fetch;
  const scope = globalThis as unknown as Record<string, unknown>;
  scope.fetch = (input: unknown, init?: unknown): never => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : `(a ${typeof input})`;
    const method =
      typeof init === "object" && init !== null && typeof (init as { method?: unknown }).method === "string"
        ? (init as { method: string }).method
        : input instanceof Request
          ? input.method
          : "GET";
    fetches.push(`${method} ${url}`);
    throw new Error(
      `No network egress at query or publish time. A \`fetch\` was attempted to ${url}.`,
    );
  };

  /* The DEFAULT export of each builtin, which is the CJS module object Node caches and
     hands to every other importer. `import * as net` would give a frozen namespace the
     patch could not be written to, and a patch nobody can see is a guard that reports
     clean because it never ran. */
  const sockets = net as unknown as { Socket: { prototype: SocketLike } };
  const secure = tls as unknown as Record<string, unknown>;

  const record = (args: readonly unknown[]): void => {
    const first = args[0];
    /* `net.connect(options, cb)` reaches `Socket.prototype.connect` as ONE array, because
       Node's `normalizeArgs` runs first and passes its result. So the options object is one
       level down, and reading `.host` off the array answers `undefined` for every socket;
       before this branch every connection recorded as `localhost:` and the database's own
       socket failed the allow list. */
    if (Array.isArray(first)) {
      record(first as readonly unknown[]);
      return;
    }
    if (typeof first === "object" && first !== null) {
      const o = first as { host?: unknown; port?: unknown; path?: unknown };
      if (typeof o.path === "string") connections.push(`unix:${o.path}`);
      else connections.push(`${String(o.host ?? "localhost")}:${String(o.port ?? "")}`);
      return;
    }
    if (typeof first === "number") {
      const host = typeof args[1] === "string" ? args[1] : "localhost";
      connections.push(`${host}:${first}`);
      return;
    }
    if (typeof first === "string") connections.push(`unix:${first}`);
  };

  const realConnect = sockets.Socket.prototype.connect;
  sockets.Socket.prototype.connect = function patched(this: unknown, ...args: unknown[]): unknown {
    record(args);
    return (realConnect as (...a: unknown[]) => unknown).apply(this, args);
  };

  const realTlsConnect = secure.connect as (...a: unknown[]) => unknown;
  secure.connect = (...args: unknown[]): unknown => {
    record(args);
    return realTlsConnect(...args);
  };

  return {
    fetches,
    connections,
    foreign() {
      return connections.filter((c) => !c.startsWith("unix:") && !permitted.has(c));
    },
    stop() {
      scope.fetch = realFetch;
      sockets.Socket.prototype.connect = realConnect;
      secure.connect = realTlsConnect;
    },
  };
}

/**
 * The endpoints a DB-backed window is entitled to open, read off a connection string.
 *
 * Both spellings of loopback are admitted because the driver and the URL do not have to
 * agree on one: a URL saying `localhost` reaches a socket reporting `127.0.0.1`.
 */
export function allowedFrom(connectionString: string): Allowed[] {
  const url = new URL(connectionString);
  const port = Number(url.port === "" ? "5432" : url.port);
  const hosts = new Set([url.hostname]);
  if (url.hostname === "localhost") {
    hosts.add("127.0.0.1");
    hosts.add("::1");
  }
  if (url.hostname === "127.0.0.1" || url.hostname === "::1") hosts.add("localhost");
  return [...hosts].map((host) => ({ host, port }));
}

/* --------------------- separating inputs --------------------- */

/**
 * The words of a string as the matcher splits them.
 *
 * The regex is `lib/server/search/text.ts`'s `normalise()`, copied rather than imported on
 * purpose: the premise cell in `recall.test.ts` imports the real `findWord` and asks IT
 * whether the query matches, which is the reading that decides the outcome. This is only
 * used to build the fixture and to say something legible in a message.
 */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w !== "");
}

/** The words two texts share. Empty is what "sharing NO literal token" means. */
export function sharedWords(a: string, b: string): string[] {
  const left = new Set(wordsOf(a));
  return [...new Set(wordsOf(b))].filter((w) => left.has(w)).sort();
}
