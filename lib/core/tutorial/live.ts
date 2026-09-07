/* ============================================================
   The live tutorial channel: what the blueprint-writing skill posts
   while it interviews an author, and what the page at
   `/tutorial/live/[token]` draws from it.

   One contract, shared by three parties that never import each
   other: the skill (which POSTs JSON from the author's machine), the
   API routes under `app/api/tutorial/live` (which store the last
   draft per token) and the page (which polls and renders). This
   module is isomorphic on purpose: the page runs it in the browser
   and the routes run it on the server, and a shape validated in two
   places is a shape that drifts.

   A draft is a bundle in progress plus where the interview is. The
   bundle may not resolve yet: a DOT with nodes and no cards, or cards
   with ports the edges do not match. The page renders whatever the
   engine can resolve and lists the rest as still to settle, so the
   skill never has to lie about the state to get a picture drawn.
   ============================================================ */

import type { BundleManifest } from "../bundle/types";

/**
 * Where the interview is. The first six follow the skill's own phases; the last three are
 * the steps the tutorial adds after the folder exists.
 */
export const LIVE_PHASES = [
  "need",
  "reuse",
  "nodes",
  "ports",
  "guards",
  "risk",
  "written",
  "enriched",
  "published",
] as const;

export type LivePhase = (typeof LIVE_PHASES)[number];

/** What the page prints for each phase, in the reader's words. */
export const LIVE_PHASE_LABELS: Readonly<Record<LivePhase, string>> = {
  need: "The need",
  reuse: "Reuse before drawing",
  nodes: "The nodes",
  ports: "Ports and edges",
  guards: "Isolation and guards",
  risk: "Risk and identity",
  written: "Folder written",
  enriched: "Enriched from the registry",
  published: "Published to an account",
};

/** A registry hit the skill considered, shown so the reader sees the search happen. */
export interface LiveHit {
  kind: "blueprint" | "card";
  /** `owner/slug` for a blueprint, `id@version` for a card. */
  ref: string;
  title: string;
  /** The search module's own score for the hit. */
  score: number;
}

/** The three lists the skill prints at every phase boundary. */
export interface LiveLedger {
  settled: readonly string[];
  open: readonly string[];
  blocked: readonly string[];
}

export interface LiveDraft {
  phase: LivePhase;
  /** The author's one-sentence answer to the first question. */
  task?: string;
  /** The bundle so far. Files the skill has not decided yet are simply absent. */
  bundle: {
    manifest: BundleManifest;
    dot: string;
    cardFiles: Readonly<Record<string, string>>;
  };
  ledger?: LiveLedger;
  hits?: readonly LiveHit[];
  /** `owner/slug` once the author has published, so the page can link to it. */
  publishedRef?: string;
}

/** What `GET /api/tutorial/live/[token]` answers. */
export interface LiveRecord {
  token: string;
  /** Increments on every accepted PUT; the page uses it as its ETag. */
  revision: number;
  updatedAt: string;
  expiresAt: string;
  draft: LiveDraft;
}

/** What `POST /api/tutorial/live` answers. */
export interface LiveOpened {
  token: string;
  /** Absolute URL of the page the author opens. */
  url: string;
  expiresAt: string;
}

/** Upper bound on one draft's JSON, in bytes. Comfortably above any real interview. */
export const LIVE_DRAFT_MAX_BYTES = 512 * 1024;

/** Tokens are 32 URL-safe characters; anything else is refused before the store is asked. */
export const LIVE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function isLiveToken(value: unknown): value is string {
  return typeof value === "string" && LIVE_TOKEN_PATTERN.test(value);
}

export function isLivePhase(value: unknown): value is LivePhase {
  return typeof value === "string" && (LIVE_PHASES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Read a draft off untrusted JSON. Answers the draft, or one sentence saying which field
 * is wrong, so the route can hand it back as a 400 and the skill can fix its payload.
 */
export function parseLiveDraft(value: unknown): { draft: LiveDraft } | { detail: string } {
  if (!isRecord(value)) return { detail: "The body must be a JSON object." };
  if (!isLivePhase(value.phase)) {
    return { detail: `\`phase\` must be one of ${LIVE_PHASES.join(", ")}.` };
  }
  if (!isRecord(value.bundle)) return { detail: "`bundle` must be an object." };
  const { bundle } = value;
  if (!isRecord(bundle.manifest)) return { detail: "`bundle.manifest` must be an object." };
  const manifest = bundle.manifest;
  for (const key of ["slug", "title", "summary"] as const) {
    if (typeof manifest[key] !== "string") {
      return { detail: `\`bundle.manifest.${key}\` must be a string.` };
    }
  }
  if (!isStringArray(manifest.tags)) {
    return { detail: "`bundle.manifest.tags` must be an array of strings." };
  }
  if (typeof bundle.dot !== "string") return { detail: "`bundle.dot` must be a string." };
  if (!isRecord(bundle.cardFiles)) return { detail: "`bundle.cardFiles` must be an object." };
  for (const [path, text] of Object.entries(bundle.cardFiles)) {
    if (typeof text !== "string") {
      return { detail: `\`bundle.cardFiles["${path}"]\` must be a string.` };
    }
  }
  if (value.task !== undefined && typeof value.task !== "string") {
    return { detail: "`task` must be a string when present." };
  }
  if (value.publishedRef !== undefined && typeof value.publishedRef !== "string") {
    return { detail: "`publishedRef` must be a string when present." };
  }
  let ledger: LiveLedger | undefined;
  if (value.ledger !== undefined) {
    if (
      !isRecord(value.ledger) ||
      !isStringArray(value.ledger.settled) ||
      !isStringArray(value.ledger.open) ||
      !isStringArray(value.ledger.blocked)
    ) {
      return { detail: "`ledger` must carry `settled`, `open` and `blocked` as string arrays." };
    }
    ledger = {
      settled: value.ledger.settled,
      open: value.ledger.open,
      blocked: value.ledger.blocked,
    };
  }
  let hits: LiveHit[] | undefined;
  if (value.hits !== undefined) {
    if (!Array.isArray(value.hits)) return { detail: "`hits` must be an array when present." };
    hits = [];
    for (const hit of value.hits) {
      if (
        !isRecord(hit) ||
        (hit.kind !== "blueprint" && hit.kind !== "card") ||
        typeof hit.ref !== "string" ||
        typeof hit.title !== "string" ||
        typeof hit.score !== "number" ||
        !Number.isFinite(hit.score)
      ) {
        return { detail: "Each hit needs `kind` (blueprint or card), `ref`, `title` and a numeric `score`." };
      }
      hits.push({ kind: hit.kind, ref: hit.ref, title: hit.title, score: hit.score });
    }
  }
  const draft: LiveDraft = {
    phase: value.phase,
    bundle: {
      manifest: manifest as unknown as BundleManifest,
      dot: bundle.dot,
      cardFiles: bundle.cardFiles as Record<string, string>,
    },
  };
  if (typeof value.task === "string") draft.task = value.task;
  if (ledger !== undefined) draft.ledger = ledger;
  if (hits !== undefined) draft.hits = hits;
  if (typeof value.publishedRef === "string") draft.publishedRef = value.publishedRef;
  return { draft };
}
