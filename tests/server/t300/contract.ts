/* ============================================================
   T300 — the helpers the six criteria are asserted through

   Not a test file. The vitest glob reaches `.test.ts` under
   `tests` and nothing else.

   Almost everything about the LEXICAL half is imported from
   `../t200/contract` rather than restated: `violatesOrderedLaw`,
   `unexplainedOrdering`, `violatesEvidenceGrammar`,
   `callsItselfSemantic`, `fingerprint`, `itemKey` and `search`
   were written by another session, ratified by a 35-run mutation
   sweep (D-200-38) and are merged. Restating them here would make
   this file the author of the readings it is meant to check
   against, and an oracle written by the author of the assertions
   is a consistency check rather than a second axis.

   What is new here is only what T300 adds: the vector channel's
   marker, the partition of a mixed result set into the two
   channels, and the two observers AC5 needs.
   ============================================================ */

import net from "node:net";
import tls from "node:tls";

import type { Results } from "../t200/contract";

/* --------------------- what the rulings pinned --------------------- */

/**
 * The four questions this suite reported before writing a cell, and the answers.
 *
 * They are kept here, named and dated, rather than folded silently into the cells, because
 * three of them had a defensible other reading and one of MINE WAS WRONG — D6. A reader who
 * finds a cell surprising should be able to see the ruling that put it there without
 * re-deriving the argument.
 *
 * Reported 2026-08-24, ruled the same day in D-300-04 and D-300-06.
 */
export const RULED = {
  /**
   * D1, ruled: keep the marker, strike clause (b). D-300-01 said both "semantic-only hits
   * carry a `similar:` marker" and "an all-semantic response is `ordered: false` exactly as
   * the law computes it"; the unamended law is `hits.every((h) => h.evidence.length > 0)`,
   * which computes TRUE over hits that all carry a marker.
   *
   * `ordered: true` for an all-semantic response is HONEST rather than tolerated: with the
   * channel named by the marker and tau and k published with their calibration, "near your
   * query through the published channel" is an explanation the archive supports.
   */
  allSemanticResponseIsOrdered: true,

  /**
   * D6, ruled the OTHER WAY FROM MY READING: the shipped field lists STAND. D-300-01 named
   * the purpose CORE, not a replacement, so `manifestText` keeps slug, category and tags and
   * `cardText` keeps the card's structural fields.
   *
   * Recorded as a correction rather than quietly flipped: the cell in `reembed.test.ts` now
   * points WIDE — two releases differing only in `category` embed DIFFERENTLY — and it would
   * have reddened a correct module in the direction I first wrote it.
   */
  purposeIsTheWideShippedFieldList: true,

  /**
   * D3's premise, ruled: AC2 holds BY CONSTRUCTION because the channel reads the vector
   * TABLES and T200's worlds never call `reembedRelease`, so there is nothing for it to read.
   *
   * The ruling asks for this to be VERIFIED WITH A CELL RATHER THAN AN ARGUMENT, which is
   * what `unmoved.test.ts` does: it asserts the two tables are empty over a T200 world and
   * then asserts the queries answer what they answered.
   */
  t200WorldsHaveNoEmbeddings: true,
} as const;

/**
 * The published cut (D-300-04 D3), as constants because that is what makes it not the number
 * SEAM-88 refuses: it is disclosed, derived and bounded rather than unpublished.
 *
 * ── `0.20` and not `0.35`, and the adjustment is the interesting part ──
 * The ruling shipped `0.35` with an explicit adjust-at-calibration clause and the implementer
 * exercised it: at `0.35` only 2 of 9 true targets survived, and one of the discarded ones
 * was the rank-1 correct answer to AC1's own worked case, at cosine `0.157`. Query-to-document
 * cosines sit a band below the sentence-to-sentence figures the original constant assumed and
 * the correct and distractor distributions overlap with no clean gap, so the cut is priced by
 * the asymmetry rather than by a separation that does not exist: A FALSE NEGATIVE FAILS AC1
 * OUTRIGHT, A FALSE POSITIVE IS A DISCLOSED, MARKED, BOUNDED TAIL ROW.
 *
 * ── this suite does not consume the numbers, and that is deliberate ──
 * They are here to be NAMED in a failure message, never to be compared against. A cell that
 * asserted "the cosine was above 0.20" would be re-deriving the implementer's own arithmetic
 * with the implementer's own constant, which is a consistency check rather than a measurement.
 * What this suite measures is the OUTCOME over a corpus written without seeing the
 * implementer's calibration queries: did the paraphrase retrieve, and did the far pair stay
 * out. If those disagree with the committed table, the disagreement is the finding.
 */
export const PUBLISHED_CUT = { similarMin: 0.2, topK: 10 } as const;

/**
 * AC1's `retrieves` means APPEARS IN THE SET (D-300-04 D3), not rank-1.
 *
 * Not a weakening. Under AC3 a semantic-only hit may never outrank a lexical one, so wherever
 * a lexical hit exists rank-1 is not available to the channel at all — the rank-1 reading is
 * unsatisfiable by construction, and a cell built on it would red every correct module.
 */
export const RETRIEVES_MEANS_IN_SET = true;

/**
 * A limit recorded by the implementer BEFORE it could arrive as one of my reds: one strict
 * card query lands rank 26 of 57 at any tau.
 *
 * An encoder limit over the card corpus and outside AC1's blueprint scope. Named here so that
 * if a card cell in this suite reds, a reader checks this first rather than filing it twice.
 */
export const STATED_LIMIT_CARD_RANK = "one strict card query lands rank 26 of 57 at any tau";

/* --------------------- the vector channel's marker --------------------- */

/**
 * The evidence prefix a semantic-only hit carries (D-300-01).
 *
 * `similar:` and NOT `semantic:`, and that is not a stylistic preference: merged
 * `callsItselfSemantic()` runs `/semantic/i` over the whole `Results` payload including
 * every evidence value, so a `semantic:` marker reds merged T200 cells. D-200-34's rule
 * survives D-300-01 — the word is true of the vector channel now and is still not free
 * floating, and an `evidence` value handed to a caller is the definition of free floating.
 */
export const SIMILAR = "similar:";

/** The published grammar's left half for this channel, for a message that has to name it. */
export const SIMILAR_FIELD = "similar";

/**
 * The marker in full, and it is a CONSTANT rather than a shape (D-300-04 D5).
 *
 * `similar:purpose`, byte for byte, for two reasons that pull the same way. A per-hit right
 * half — a cosine score is the obvious one — makes every byte-identical evidence group in the
 * tail a group of ONE, so `unexplainedOrdering` runs over the tail and compares nothing: the
 * instrument goes quiet rather than the module being right, which is the shape T200
 * pre-registered as M12. And it would ship the unpublished number D-200-01 and SEAM-88 refuse,
 * inside `evidence`, where a caller reads it as an explanation.
 *
 * `purpose` on the right because that is what was embedded (D-300-01), so the marker names
 * the channel AND its subject in one value a caller can read.
 */
export const SIMILAR_MARKER = "similar:purpose";

export function isSimilarEvidence(value: string): boolean {
  return value.startsWith(SIMILAR);
}

/**
 * Which channel produced a hit, decided from the only thing a caller can see.
 *
 * `"lexical"` — carries at least one `<field>:<token>` that is not the marker.
 * `"semantic"` — carries at least one marker and nothing else.
 * `"mixed"` — carries both, which no ruling admits and which `violatesChannelPurity`
 * reports; it is a distinct answer rather than folded into one of the other two, because a
 * mixed hit is a DIFFERENT defect from a mis-ordered one and reporting it as "semantic"
 * would send a reader to the wrong half of the module.
 * `"silent"` — no evidence at all, which is the unranked state and belongs to neither.
 */
export type Channel = "lexical" | "semantic" | "mixed" | "silent";

export function channelOf(evidence: readonly string[]): Channel {
  if (evidence.length === 0) return "silent";
  const marked = evidence.filter(isSimilarEvidence).length;
  if (marked === 0) return "lexical";
  if (marked === evidence.length) return "semantic";
  return "mixed";
}

export function channels(results: Results): Channel[] {
  return results.hits.map((hit) => channelOf(hit.evidence));
}

/**
 * AC3's first half: a hit the vector channel found must SAY SO.
 *
 * Only checkable against a hit the caller already knows is semantic-only, so it is not a
 * standalone predicate over an arbitrary response — a lexical hit legitimately carries no
 * marker. It is used by `recall.test.ts`, which plants a query that cannot match lexically
 * and therefore knows which hit it is asking about.
 */
export function missingSimilarMarker(
  evidence: readonly string[],
  where: string,
): string | undefined {
  const channel = channelOf(evidence);
  if (channel === "semantic") return undefined;
  return (
    `${where} carries ${JSON.stringify(evidence)}, which is ${channel} rather than the ` +
    `vector channel's own.\n` +
    `  D-300-01: "semantic-only hits join the tail carrying a \`${SIMILAR}\` evidence marker ` +
    `and DO NOT claim a lexically-explainable rank". The marker is how a caller tells a row ` +
    `the archive can point at from a row it can only say is near — and the honesty ` +
    `constraint that survives the reversal is exactly that distinction.` +
    (channel === "silent"
      ? `\n  Empty evidence is a different claim: it makes the whole response \`ordered: ` +
        `false\` under D-200-09's law, which is legitimate for a LISTING and is not what a ` +
        `query that retrieved something should answer.`
      : "")
  );
}

/**
 * AC3's second half: a semantic-only hit may never outrank a lexical one.
 *
 * Stated as "no semantic rank precedes any lexical rank", which is the whole criterion and
 * needs no threshold, no score and no wording pinned.
 *
 * ── why this is not hypothetical ──
 * Merged `rank.ts:ranked()` sorts on `(evidence.length desc, evidenceKey asc, identity
 * asc)`, and the blueprint field keys are `card, category, description, owner, slug,
 * summary, tag, title`. `"${SIMILAR}"` sorts between `"owner:"` and `"slug:"`. So a
 * one-item semantic hit fed through that comparator OUTRANKS every one-item lexical hit
 * that matched in `slug`, `summary`, `tag` or `title` — which is most of them. The tail has
 * to be appended after the ranking rather than ranked with it, and this cell is what says
 * so if it was not.
 */
export function violatesSemanticTail(results: Results, where: string): string | undefined {
  const seen = channels(results);
  const lastSemantic = seen.lastIndexOf("semantic");
  const firstLexical = seen.indexOf("lexical");
  if (lastSemantic === -1 || firstLexical === -1) return undefined;
  if (lastSemantic < firstLexical) return undefined;
  const offenders: string[] = [];
  for (const [i, channel] of seen.entries()) {
    if (channel !== "semantic") continue;
    for (let j = i + 1; j < seen.length; j += 1) {
      if (seen[j] === "lexical") offenders.push(`rank ${i} (semantic) precedes rank ${j} (lexical)`);
    }
  }
  return (
    `${where} put a semantic-only hit above a lexical one:\n  ${offenders.join("\n  ")}\n` +
    `  channels by rank: ${seen.join(", ")}\n` +
    `  evidence by rank: ${results.hits.map((h) => JSON.stringify(h.evidence)).join(" ")}\n` +
    `  AC3: "semantic-only hits carry \`${SIMILAR}\` evidence and never outrank a lexical ` +
    `hit"; D-300-01: "lexical hits keep their rank and their \`field:token\` evidence; ` +
    `semantic-only hits join the TAIL".\n` +
    `  If the tail was handed to \`ranked()\` this is arithmetic rather than bad luck: that ` +
    `comparator's second key is the evidence string, and "${SIMILAR}" sorts before "slug:", ` +
    `"summary:", "tag:" and "title:". The tail is appended after the rank, not ranked with it.`
  );
}

/**
 * No hit may carry BOTH a lexical evidence item and the marker.
 *
 * Derived from AC2 rather than asserted for tidiness, and the derivation is the reason it is
 * checkable at all: AC2 says every lexical guarantee T200's suite holds is unmoved, "same
 * ranks, same evidence". A lexical hit that gained a `${SIMILAR}` item has different
 * `evidence`, and since `rank.ts` scores on `evidence.length` it also has a different RANK.
 * So the marker on a lexical hit moves both of the things AC2 pins, and one cell catches it
 * without needing to know which query T200 asked.
 */
export function violatesChannelPurity(results: Results, where: string): string | undefined {
  const offenders = results.hits
    .map((hit, i) => ({ hit, i }))
    .filter(({ hit }) => channelOf(hit.evidence) === "mixed")
    .map(({ hit, i }) => `hits[${i}].evidence = ${JSON.stringify(hit.evidence)}`);
  if (offenders.length === 0) return undefined;
  return (
    `${where} handed one hit both channels' evidence:\n  ${offenders.join("\n  ")}\n` +
    `  D-300-01 keeps them apart: a LEXICAL hit "keeps its rank and its \`field:token\` ` +
    `evidence", a SEMANTIC-ONLY hit joins the tail with the marker. Adding the marker to a ` +
    `hit that matched lexically changes its \`evidence\` AND — because \`rank.ts\` scores on ` +
    `\`evidence.length\` — its RANK, which are the two things AC2 says are unmoved.`
  );
}

/**
 * Every marker in the response must be the published constant, byte for byte.
 *
 * This is stated as EQUALITY rather than as "the values do not vary", and the difference is
 * the assertion-must-exclude-the-bad-output rule applied to my own first draft. A cell
 * asking only "do all the semantic hits agree" is satisfied by a module that ships
 * `similar:0.4` on every hit because every hit happened to score the same, and it is
 * satisfied vacuously whenever the tail holds one row. Equality against `SIMILAR_MARKER`
 * excludes the score outright and needs no second hit to be meaningful.
 */
export function violatesMarkerConstant(results: Results, where: string): string | undefined {
  const offenders: string[] = [];
  for (const [i, hit] of results.hits.entries()) {
    for (const value of hit.evidence) {
      if (!isSimilarEvidence(value)) continue;
      if (value === SIMILAR_MARKER) continue;
      offenders.push(`hits[${i}].evidence: ${JSON.stringify(value)}`);
    }
  }
  if (offenders.length === 0) return undefined;
  return (
    `${where} shipped a marker that is not the published constant ${JSON.stringify(SIMILAR_MARKER)}:\n` +
    `  ${offenders.join("\n  ")}\n` +
    `  D-300-04 D5 pins it as a constant, for two reasons that pull the same way. A per-hit ` +
    `right half makes every byte-identical evidence group in the tail a group of ONE, so ` +
    `D-200-20's contiguity check runs over the tail and compares nothing — the instrument ` +
    `going quiet rather than the module being right, which is the shape T200 pre-registered ` +
    `as M12. And a score inside \`evidence\` is the number D-200-01 and SEAM-88 refuse, ` +
    `handed to a caller in the field they read as the explanation.`
  );
}

/* --------------------- AC5: the two egress observers --------------------- */

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
 * ── why two layers and not one ──
 * A `fetch` spy alone is blind in the one way that matters: a module that captured
 * `globalThis.fetch` into a local binding at import time never calls the replacement, and an
 * encoder that reaches for `node:https` directly never calls it either. So the transport is
 * watched as well, at `net.Socket.prototype.connect` and `tls.connect`, which every one of
 * those paths ends up in — undici, `http.request` and `https.request` all open a socket.
 *
 * ── why the fetch arm throws ──
 * Recording and calling through would let a 90MB download SUCCEED and the cell would pass or
 * time out rather than say what happened. Recording and throwing makes the failure immediate
 * and legible. The cells assert on the RECORD and never on the throw: a writer that fetched
 * and then swallowed the error satisfies any `rejects.toThrow()` a reviewer would write, and
 * what is being checked is what it DID, not how it reacted to being stopped.
 *
 * ── the allow list ──
 * Postgres is a socket too. `allow` carries the endpoints this window is entitled to open —
 * built from the scratch database's own URL, asked of the connection rather than assumed —
 * and `foreign()` is everything else. An empty allow list would make every DB-backed cell
 * report a false egress, which is the shape of a guard that fires on a condition its subject
 * cannot avoid.
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
      `AC5: no network egress at query or publish time. A \`fetch\` was attempted to ${url}.`,
    );
  };

  /* The DEFAULT export of each builtin, which is the CJS module object Node caches and
     hands to every other importer — `import * as net` would give a frozen namespace the
     patch could not be written to, and a patch nobody can see is a guard that reports
     clean because it never ran. */
  const sockets = net as unknown as { Socket: { prototype: SocketLike } };
  const secure = tls as unknown as Record<string, unknown>;

  const record = (args: readonly unknown[]): void => {
    const first = args[0];
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
 * agree on one: a URL saying `localhost` reaches a socket reporting `127.0.0.1`, and a cell
 * that admitted only the URL's spelling would report the database itself as foreign egress.
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
 * The words of a string as the merged matcher splits them.
 *
 * The regex is `lib/server/search/text.ts:normalise()`'s, and it is copied rather than
 * imported ON PURPOSE for this one use: the premise cell in `recall.test.ts` imports the
 * real `findWord` and asks IT whether the query matches, which is the reading that decides
 * the outcome. This is only used to build the fixture and to say something legible in a
 * message, so a divergence here costs a worse error string and never a wrong verdict.
 */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter((w) => w !== "");
}

/** The words two texts share. Empty is what AC1 means by "sharing NO literal token". */
export function sharedWords(a: string, b: string): string[] {
  const left = new Set(wordsOf(a));
  return [...new Set(wordsOf(b))].filter((w) => left.has(w)).sort();
}
