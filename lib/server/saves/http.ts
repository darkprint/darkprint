/* ============================================================
   DarkPrint backend — saves: the transport boundary
   Four routes over ONE request shape (D-140-07), and the shape is
   `saveTarget`'s own `target` parameter. **So nothing here
   translates.** The frontend's compound key space is withdrawn rather
   than mapped — it cannot address a three-member enum, it carries
   a card version B-10 forbids in that column, and its bare slug
   cannot resolve to a bundle — and the browser-local mapping is
   T262's, which owns `STORAGE_KEY`.

   It lives in the module rather than beside the routes for T050's
   and T081's reason: four route handlers sharing a wrapper need
   somewhere shared, and the barrel is where a shared thing is
   published.

   ── Why `withSaveErrors` re-throws everything it does not know ──
   D-50-18, ruled for T090's reading. Throwing produces a 500 too,
   but Next's own generic one — outside the envelope every other
   failure on the route uses (B-03), and unobservable to anything
   driving the handler directly. So a RECOGNISED fault answers
   `problem+json`, and the re-throw arm is reserved for what this
   wrapper does not recognise, because a bug dressed up as a known
   condition is how one stops being noticed.

   **`NotAccountOwnerError` therefore goes out through the
   re-throw arm on purpose, and that is not an omission.** Every
   route passes `session.accountId`, so the check compares an id
   against itself and no request can produce one — giving it a
   status would publish a code the contract does not list for a
   case that cannot arise, and if it ever arises it is the session
   and the row disagreeing, which is a server fault.
   `lib/server/accounts/http.ts` rules and ships exactly this, so
   it is cited rather than re-derived.

   ── The 400 wording is this file's and is NOT published ──
   T140's block publishes 400 as a STATUS with no admissible
   message form, so a blind author cannot pin these strings without
   inventing contract. That is stated here rather than left to look
   deliberate. What they DO honour is D-140-06's whitelist: each
   names the operation's own field and this module's own literals,
   and never a value the caller sent — **a `refId` echoed back is
   an existence oracle, which is the thing AC1 exists to close.**

   The object-body wording is T050's, byte for byte, because it is
   the same refusal about the same thing; a second phrasing would
   give one condition two vocabularies across two tasks.
   ============================================================ */

import { PROBLEM_TYPE_BASE, badRequest, ok, problem } from "@/lib/server/http";
import type { Actor } from "@/lib/server/policy";
import type { Db } from "@/lib/db";
import { SaveStoreError } from "./errors";
import { countSaves, listSaves } from "./read";
import type { SaveRecord, SaveTarget, SaveTargetKind } from "./types";

/** What all four routes answer with at 200. */
export interface SavesView {
  saves: readonly SaveRecord[];
  count: number;
}

const KINDS: readonly SaveTargetKind[] = ["blueprint", "card", "term"];

/**
 * The `problem+json` 500 D-140-07 requires, carrying the rejection's own message.
 *
 * The message is the published form — the operation and nothing else — so passing it
 * through keeps the rendering with one author instead of giving the same fault two
 * wordings, one in the log and one on the wire. Byte-equality also fails an arm that
 * re-renders, one that substitutes a generic string, and one that interpolates a `refId`;
 * the last is a leak. It is NOT a hygiene assertion and does not replace one.
 */
function storeFailed(request: Request, err: SaveStoreError): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. The one task that retyped it published
       a host occurring nowhere else in the repository. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * Runs a saves route handler and turns a sealed store fault into B-03's envelope.
 *
 * Everything the handler does goes inside `handler` — the body read and
 * `getSharedDbClient()` included — rather than only the module call. Both can raise, and a
 * boundary drawn around the module call alone leaves a handler with a fault path for the
 * one line somebody was thinking about.
 */
export async function withSaveErrors(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof SaveStoreError) return storeFailed(request, err);
    /* Not a store fault, so this wrapper does not know what it is. Next answers its own
       generic 500 and the trace survives. */
    throw err;
  }
}

/**
 * The 200 body, for every one of the four routes including the three writes.
 *
 * **`count` is `countSaves`, never `saves.length`** (D-140-07). Deriving it would satisfy
 * AC3's *the count agrees with the listing* by making the agreement unobservable — the two
 * could not disagree because there would only be one of them. The extra query is what buys
 * AC3 a cell that goes through the transport, and it is paid deliberately.
 *
 * The three writes answer this rather than a 204, which `lib/server/http` does not publish
 * and this task may not add. It is the shipped `200 AccountRecord` convention, and it makes
 * AC2 drivable in two requests instead of three.
 *
 * `savedAt` crosses as an ISO string: `ok` is `Response.json`, which renders a `Date` that
 * way. No mapping here — a second shaping step would be a second place for the record to
 * drift from its published form.
 */
export async function savesViewFor(db: Db, actor: Actor, accountId: string): Promise<Response> {
  const saves = await listSaves(db, actor, accountId);
  const count = await countSaves(db, actor, accountId);
  const view: SavesView = { saves, count };
  return ok(view);
}

/**
 * The request body as one `{ kind, refId }` target, or a `Response` saying why not.
 *
 * A union rather than a throw: the module publishes exactly two rejections (D-140-02) and a
 * malformed body is neither, so inventing a third class here would be the contract
 * following the code.
 */
export function targetFrom(request: Request, body: unknown): SaveTarget | Response {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest(request, "Expected a JSON object body.");
  }
  const kind = (body as Record<string, unknown>)["kind"];
  const refId = (body as Record<string, unknown>)["refId"];
  if (typeof kind !== "string" || !KINDS.includes(kind as SaveTargetKind)) {
    return badRequest(request, "`kind` must be one of `blueprint`, `card` or `term`.");
  }
  if (typeof refId !== "string" || refId.length === 0) {
    return badRequest(request, "`refId` must be a non-empty string.");
  }
  return { kind: kind as SaveTargetKind, refId };
}

/**
 * The migrate body as a list of targets, or a `Response` saying why not.
 *
 * An empty array is ACCEPTED and is a no-op: a browser with no favourites signing in is the
 * ordinary case, and refusing it would make the common path the error path. Each member is
 * checked by the same predicate a single target is, so the two routes cannot disagree about
 * what a target is.
 */
export function targetsFrom(request: Request, body: unknown): readonly SaveTarget[] | Response {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest(request, "Expected a JSON object body.");
  }
  const targets = (body as Record<string, unknown>)["targets"];
  if (!Array.isArray(targets)) {
    return badRequest(request, "`targets` must be an array.");
  }
  const out: SaveTarget[] = [];
  for (const member of targets) {
    const one = targetFrom(request, member);
    if (one instanceof Response) return one;
    out.push(one);
  }
  return out;
}
