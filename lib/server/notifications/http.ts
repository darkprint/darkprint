/* ============================================================
   DarkPrint backend — notifications: the transport boundary
   Three routes (D-190-05). It lives in the module rather than
   beside the routes for T050's and T081's reason: route handlers
   sharing a wrapper need somewhere shared, and the barrel is where
   a shared thing is published (D-01 keeps `app/api/**` to handlers
   and nothing else).

   ── why the wrapper RE-THROWS what it does not know ──
   D-50-18, ruled for T090's reading. Throwing produces a 500 too,
   but Next's own generic one — outside B-03's envelope, and
   unobservable to anything driving the handler directly. So a
   RECOGNISED fault answers `problem+json` and the re-throw arm is
   reserved for what this wrapper does not recognise, because a bug
   dressed up as a known condition is how one stops being noticed.

   ── `NotAccountOwnerError` goes out through the re-throw arm, and
      that is not an omission ──
   Both preference routes pass `session.accountId`, so `can`
   compares an id against itself and no request can produce that
   refusal. Giving it a status would publish a code for a case that
   cannot arise, and if it ever arises it is the session and the row
   disagreeing, which is a server fault.
   `lib/server/accounts/http.ts` rules and ships exactly this
   reasoning and `saves/http.ts` cites it; it is cited here rather
   than re-derived. **The refusal is therefore unreachable from
   HTTP and is driven from module cells instead — its absence here
   is not it going untested.**

   ── the 400 wording is this file's and is NOT published ──
   T190's block publishes 400 as a STATUS with no admissible message
   form, so a blind author cannot pin these strings without
   inventing contract. Said here rather than left to look
   deliberate. What they DO honour is the whitelist every other task
   follows: each names this module's own literals and never a value
   the caller sent.
   ============================================================ */

import { PROBLEM_TYPE_BASE, badRequest, ok, problem } from "@/lib/server/http";
import { NotificationStoreError, UnsubscribeInvalidError } from "./errors";
import { EVENT_KINDS, type Preferences } from "./types";

/** What both preference routes answer at 200. */
export interface PreferencesView {
  preferences: Preferences;
}

/** What the unsubscribe route answers at 200. */
export interface UnsubscribedView {
  kind: string;
}

/**
 * The `problem+json` 500, carrying the rejection's own message.
 *
 * The message is the published form — the operation and nothing else — so passing it through
 * keeps the rendering with one author instead of giving one fault two wordings, one in the log
 * and one on the wire. It is NOT a hygiene assertion and does not replace one.
 */
function storeFailed(request: Request, err: NotificationStoreError): Response {
  return problem(request, {
    /* D-50-03: the base is consumed, never retyped. The one task that retyped it published a
       host occurring nowhere else in the repository. */
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail: err.message,
  });
}

/**
 * A revoked or unknown unsubscribe link, as a 404.
 *
 * 404 and not 403: 403 would say "this link is real and you may not use it", which is an oracle
 * over a secret. The detail is the published sentence, which names no token and no account.
 */
function linkNoLongerValid(request: Request, err: UnsubscribeInvalidError): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/not-found`,
    title: "Not found",
    status: 404,
    detail: err.message,
  });
}

/**
 * Runs a notifications route handler and turns this module's recognised rejections into B-03's
 * envelope.
 *
 * Everything the handler does goes inside `handler` — the body read and `getSharedDbClient()`
 * included — rather than only the module call. Both can raise, and a boundary drawn around the
 * module call alone leaves a handler with a fault path for the one line somebody was thinking
 * about.
 */
export async function withNotificationErrors(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof UnsubscribeInvalidError) return linkNoLongerValid(request, err);
    if (err instanceof NotificationStoreError) return storeFailed(request, err);
    /* Not recognised, so this wrapper does not know what it is. Next answers its own generic
       500 and the trace survives. */
    throw err;
  }
}

/** The 200 body for both preference routes, shaped in one place so the two cannot disagree. */
export function preferencesView(preferences: Preferences): Response {
  const view: PreferencesView = { preferences };
  return ok(view);
}

/**
 * The PATCH body as a `Partial<Preferences>`, or a `Response` saying why not.
 *
 * A union rather than a throw: this module publishes two rejections and a malformed body is
 * neither, so inventing a third class here would be the contract following the code.
 *
 * **Unknown keys are ACCEPTED here and dropped by the writer** (D-190-05). Refusing them would
 * be a stricter contract than the ruling, and the ruling's guarantee is about what is
 * PERSISTED: `setPreferences` walks the four known kinds and writes only those, so the column
 * cannot accumulate a foreign key however this parser behaves. A non-boolean under a KNOWN key
 * is a 400, because that one is a caller saying something about a real setting incorrectly, and
 * silently ignoring it would report success for a change that did not happen.
 */
export function patchFrom(request: Request, body: unknown): Partial<Preferences> | Response {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest(request, "Expected a JSON object body.");
  }
  const source = body as Record<string, unknown>;
  const patch: Record<string, boolean> = {};
  for (const kind of EVENT_KINDS) {
    if (!Object.hasOwn(source, kind)) continue;
    const value = source[kind];
    if (typeof value !== "boolean") {
      return badRequest(request, `\`${kind}\` must be true or false.`);
    }
    patch[kind] = value;
  }
  return patch as Partial<Preferences>;
}

/**
 * The `token` query parameter, or a `Response` saying why not.
 *
 * A missing or empty token is a 400 rather than a 404: the request is malformed, and answering
 * 404 would make "you sent no token" indistinguishable from "your token is dead" — which
 * matters to whoever is debugging a mail template, and tells an attacker nothing either way.
 * The token itself is never echoed into the message.
 */
export function tokenFrom(request: Request, url: URL): string | Response {
  const token = url.searchParams.get("token");
  if (token === null || token === "") {
    return badRequest(request, "`token` is required.");
  }
  return token;
}
