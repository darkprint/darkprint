/* ============================================================
   The polling loop as a state machine, with no fetch in it.
   ------------------------------------------------------------
   The hook beside this file owns the timer and the network; this
   module owns every decision: what a status code means, what the
   board shows after it, and how long to wait before asking again.
   Split this way so each branch is one test cell over a plain
   object, and so a change to the schedule cannot hide inside an
   effect nobody can render.
   ============================================================ */

import { parseLiveDraft, type LiveRecord } from "@/lib/core/tutorial/live";

/** How often the page asks while the interview is running. */
export const POLL_MS = 2000;
/** How long it waits after a failed request before trying again. */
export const RETRY_MS = 10000;

export type PollOutcome =
  | { kind: "updated"; record: LiveRecord; etag: string | null }
  | { kind: "unchanged" }
  | { kind: "expired" }
  | { kind: "failed" };

export type BoardState =
  | { status: "waiting"; reconnecting: boolean }
  | { status: "live"; record: LiveRecord; etag: string | null; reconnecting: boolean }
  | { status: "expired" };

export const INITIAL: BoardState = { status: "waiting", reconnecting: false };

/** The validator the record's draft is read back through; never the shape of a trusted wire. */
function readRecord(body: unknown): LiveRecord | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const value = body as Record<string, unknown>;
  if (
    typeof value.token !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.updatedAt !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    return undefined;
  }
  const parsed = parseLiveDraft(value.draft);
  if (!("draft" in parsed)) return undefined;
  return {
    token: value.token,
    revision: value.revision,
    updatedAt: value.updatedAt,
    expiresAt: value.expiresAt,
    draft: parsed.draft,
  };
}

/** The least a response has to look like for `readOutcome` to read it. */
export interface PollResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

/**
 * One response, read into the outcome the state machine takes.
 *
 * 304 is the route honouring `If-None-Match`; 404 is a page that expired or never existed,
 * which the route answers the same way on purpose. Anything else, a malformed body
 * included, is a failure the board waits out rather than a state it shows.
 */
export async function readOutcome(response: PollResponse): Promise<PollOutcome> {
  if (response.status === 304) return { kind: "unchanged" };
  if (response.status === 404) return { kind: "expired" };
  if (response.status !== 200) return { kind: "failed" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: "failed" };
  }
  const record = readRecord(body);
  if (record === undefined) return { kind: "failed" };
  return { kind: "updated", record, etag: response.headers.get("etag") };
}

/** The conditional header for the next request: the ETag the route last answered with. */
export function conditionalHeaders(state: BoardState): Record<string, string> {
  return state.status === "live" && state.etag !== null ? { "If-None-Match": state.etag } : {};
}

function published(state: BoardState): boolean {
  return state.status === "live" && state.record.draft.phase === "published";
}

/**
 * The next board state, and how long to wait before polling again. No delay means the
 * loop stops: the page expired, or the draft reached the phase nothing follows.
 */
export function advance(
  state: BoardState,
  outcome: PollOutcome,
): { next: BoardState; delayMs?: number } {
  if (state.status === "expired") return { next: state };
  switch (outcome.kind) {
    case "expired":
      return { next: { status: "expired" } };
    case "failed":
      return { next: { ...state, reconnecting: true }, delayMs: RETRY_MS };
    case "updated": {
      const next: BoardState = {
        status: "live",
        record: outcome.record,
        etag: outcome.etag,
        reconnecting: false,
      };
      return published(next) ? { next } : { next, delayMs: POLL_MS };
    }
    case "unchanged": {
      const next: BoardState = { ...state, reconnecting: false };
      return published(next) ? { next } : { next, delayMs: POLL_MS };
    }
  }
}
