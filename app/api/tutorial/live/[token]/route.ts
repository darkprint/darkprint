/* ============================================================
   GET and PUT /api/tutorial/live/[token]: one live tutorial page
   GET answers the `LiveRecord` the page polls, with the revision
   as its ETag so an unchanged draft costs a 304 and no body. PUT
   takes the `LiveDraft` the blueprint-writing skill posts after
   each phase and answers the new revision and expiry.

   Both are anonymous: the token is the whole authority, and it is
   checked against the shared pattern before the store is asked.
   The body is never trusted for its shape here; `parseLiveDraft`
   in `lib/core/tutorial/live.ts` is the one reader, shared with
   the page, and its one-sentence detail is what a 400 carries.

   Unknown, expired and malformed tokens are three facts the
   status codes keep apart only as far as they need to: a token
   that cannot be one answers 400 naming the constraint, and a
   token that could be but is not answers 404 in the same words
   whether it never existed or expired an hour ago.
   ============================================================ */

import { Buffer } from "node:buffer";
import { getSharedDbClient } from "@/lib/db";
import { LIVE_DRAFT_MAX_BYTES, isLiveToken, parseLiveDraft } from "@/lib/core/tutorial/live";
import { PROBLEM_TYPE_BASE, badRequest, notFound, ok, problem } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import {
  getLive,
  putLive,
  spendLivePoll,
  spendLiveRead,
  spendLiveWrite,
  withTutorialErrors,
} from "@/lib/server/tutorial";
import { readObjectBody } from "../../../validate/body";

/** The house form, `<resource>: no such <thing>.`, and one sentence for unknown and expired. */
const NO_SUCH_PAGE = "tutorial: no such live page.";

/** Names the constraint and never echoes the value: the caller sent it and knows it. */
const MALFORMED_TOKEN = "`token` must be 32 URL-safe characters.";

interface Context {
  params: Promise<{ token: string }>;
}

function etagFor(revision: number): string {
  return `"${revision}"`;
}

/**
 * `If-None-Match` is a comma-separated list and a validator may arrive weak (`W/"3"`);
 * for a 304 the weak comparison is the one the standard asks for.
 */
function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (header === null) return false;
  return header
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === etag || candidate === `W/${etag}`);
}

export async function GET(request: Request, context: Context): Promise<Response> {
  return withLimitsErrors(request, () =>
    withTutorialErrors(request, async () => {
      /* The poll bucket first, before the token is even looked at: it bounds the requests a
         page makes at all, so neither a token holder nor a guesser can drive the store
         faster than one tab polls. */
      await spendLivePoll(request);
      const { token } = await context.params;
      if (!isLiveToken(token)) return badRequest(request, MALFORMED_TOKEN);
      const { db } = getSharedDbClient();
      const record = await getLive(db, token);
      if (record !== undefined) {
        /* `no-store` because the page polls this and a cached record would be the one thing
           that makes a live page look stuck; the ETag is what keeps the poll cheap instead. */
        const headers = { etag: etagFor(record.revision), "cache-control": "no-store" };
        /* A 304 spends nothing. The page polls every two seconds and almost every answer is
           unchanged, so charging the read bucket per poll would spend an hour's anonymous
           reads in twenty minutes and turn a quiet page into a 429. A body still costs one. */
        if (matchesIfNoneMatch(request.headers.get("if-none-match"), headers.etag)) {
          return new Response(null, { status: 304, headers });
        }
        await spendLiveRead(request);
        return ok(record, { headers });
      }
      /* A miss costs a read too, so a token guesser is bounded like any other reader. */
      await spendLiveRead(request);
      return notFound(request, NO_SUCH_PAGE);
    }),
  );
}

export async function PUT(request: Request, context: Context): Promise<Response> {
  return withLimitsErrors(request, () =>
    withTutorialErrors(request, async () => {
      await spendLiveWrite(request);
      const { token } = await context.params;
      if (!isLiveToken(token)) return badRequest(request, MALFORMED_TOKEN);

      /* Bounded on the wire, twice: a declared length over the cap is refused before a byte
         is read, and the stream is read chunk by chunk and cut off the moment it passes the
         cap, so a body that lies about its length still cannot be buffered whole. The text is
         then handed to the shared reader so the JSON refusals keep one wording. */
      const declared = Number(request.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > LIVE_DRAFT_MAX_BYTES) {
        return tooLarge(request, declared);
      }
      const body = await readBounded(request, LIVE_DRAFT_MAX_BYTES);
      if (body.over) return tooLarge(request, body.bytes);
      const text = body.text;
      const parsed = await readObjectBody(
        new Request(request.url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: text,
        }),
      );
      if ("refusal" in parsed) return parsed.refusal;
      const read = parseLiveDraft(parsed.body);
      if ("detail" in read) return badRequest(request, read.detail);

      const { db } = getSharedDbClient();
      const written = await putLive(db, token, read.draft);
      if (written === undefined) return notFound(request, NO_SUCH_PAGE);
      return ok(written);
    }),
  );
}

/**
 * The body as text, or the fact that it passed `max` bytes. Reading stops at the first
 * chunk that crosses the cap and the stream is cancelled, so the most this ever holds is
 * one chunk over the limit.
 */
async function readBounded(
  request: Request,
  max: number,
): Promise<{ over: false; text: string } | { over: true; bytes: number }> {
  if (request.body === null) return { over: false, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > max) {
      await reader.cancel();
      return { over: true, bytes };
    }
    chunks.push(value);
  }
  return { over: false, text: new TextDecoder().decode(Buffer.concat(chunks)) };
}

/** 413, under the same problem type the validate routes use for an over-limit submission. */
function tooLarge(request: Request, bytes: number): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/limit-exceeded`,
    title: "Payload too large",
    status: 413,
    detail: `A draft may be at most ${LIVE_DRAFT_MAX_BYTES} bytes of JSON; this one is ${bytes}.`,
  });
}
