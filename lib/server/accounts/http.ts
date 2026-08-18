/* ============================================================
   DarkPrint backend — accounts: the transport boundary
   The five routes this task owns sit in five directories, so
   anything all five must agree on has to live somewhere shared.
   It lives here rather than beside them because this task's `Owns`
   enumerates five exact route FILES rather than
   `app/api/account/**`, so a sixth file under that tree would be
   outside it. T080's `actorFrom` is the same shape in the same
   place, and that is the precedent followed. Reported in the Log
   rather than assumed.

   **Three mappings, and they are total or they are nothing.**
   D-50-08 rules that `HandleTakenError` becomes 409 and
   `InvalidNameError` becomes 400 with their messages **unaltered**
   — both are `@/lib/server/naming`'s, and re-rendering either
   would give one message two authors. `HandleRequiredError`
   becomes the 403 AC1 describes, which has to stay distinguishable
   from 401 (no session at all) and from 404 (a resource you may
   not see). `InvalidProfileError` becomes 400.

   **`AccountStoreError` becomes a 500 `problem+json` (D-50-18),
   and the reasoning it replaces was mine and was wrong.** This
   wrapper used to re-throw it, on the argument that *the store
   being unable to answer is a 500, not an answer*. Throwing does
   produce a 500 — **Next's own generic one, outside the envelope
   every other failure on the route uses**, and unobservable to
   anything driving the handler directly. B-03 makes a transport
   failure `problem+json`, and T090's merged `serve.ts` argues
   exactly this and answers a `Response`. The deciding detail is
   what a re-throw arm is *for*: what the wrapper does **not**
   recognise — a bug — and `AccountStoreError` is published,
   recognised and sanitized, so putting it there dressed a known
   condition up as an unknown one.

   **Everything else is still RE-THROWN, and that arm now means
   only what it should.** `NotAccountOwnerError` is unmapped
   because no route can produce one: every route passes
   `session.accountId` as the account it is acting on, so
   `can(actor, "write", { kind: "account", accountId })` compares an
   id against itself. Giving it a status would publish a code the
   contract does not list, for a case that cannot arise — and if it
   ever arises it is the session and the row disagreeing, which is a
   server fault and not something to tell a client.
   ============================================================ */

import type { SessionPayload } from "@/lib/server/auth";
import {
  PROBLEM_TYPE_BASE,
  badRequest,
  conflict,
  problem,
} from "@/lib/server/http";
import { HandleTakenError, InvalidNameError, NamingStoreError } from "@/lib/server/naming";
import type { Actor } from "@/lib/server/policy";
import { AccountStoreError, HandleRequiredError, InvalidProfileError } from "./errors";

/**
 * The session, as T060 wants it.
 *
 * Always `kind: "account"`, and that is the whole of D-50-13: `SessionPayload` is
 * `{ accountId, handle }` with no `kind`, so no route can mint an operator and
 * `can`'s operator grant is unreachable through HTTP rather than merely untested.
 */
export function actorFrom(session: SessionPayload): Actor {
  return { kind: "account", accountId: session.accountId, handle: session.handle };
}

/**
 * The `problem+json` 403 AC1 describes. Its `type` is what makes it distinguishable
 * from the other two refusals a caller can get, so it is built from T000's exported
 * base rather than from a literal — the second copy is the drift D-50-03 was.
 */
function handleRequired(request: Request, detail: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/handle-required`,
    title: "Handle required",
    status: 403,
    detail,
  });
}

/**
 * The `problem+json` 500 D-50-18 requires. Built from T000's exported base for the same
 * reason the 403 is, and carrying the rejection's own message, which is the published
 * form and therefore the operation and nothing else — no statement, no bound parameter,
 * no SQLSTATE.
 */
function storeFailed(request: Request, detail: string): Response {
  return problem(request, {
    type: `${PROBLEM_TYPE_BASE}/store-failed`,
    title: "Store failed",
    status: 500,
    detail,
  });
}

/**
 * Runs a route body and maps this task's five client-visible rejections.
 *
 * A wrapper rather than a `catch` in each route, for `withSession`'s reason one layer
 * down: a mapping applied at five call sites is a mapping with a call site that
 * forgot it. Anything unrecognised leaves untouched, so a new rejection class fails
 * closed as a 500 rather than defaulting into somebody else's status.
 *
 * Every `detail` is the rejection's own `message`, unaltered. That is safe by
 * construction rather than by review: all four message forms are published, and each
 * carries the operation, the caller's own field NAME, or the caller's own handle —
 * never a value the caller did not send, and never an `email` (AC2).
 */
export async function withAccountErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof HandleRequiredError) return handleRequired(request, err.message);
    if (err instanceof InvalidProfileError) return badRequest(request, err.message);
    if (err instanceof HandleTakenError) return conflict(request, err.message);
    if (err instanceof InvalidNameError) return badRequest(request, err.message);
    /* Store faults last. **Order is inert here and that is checked, not asserted** —
       the classes are pairwise disjoint, so no value can match two arms and no
       reordering can change an answer. `assertArmsDisjoint` below is what makes that a
       measured property rather than a preference; the adversary moved this arm first
       and got 0 red, 0 green, correctly classified as an equivalent mutant.

       Last is kept as the right default for the day someone makes one class a subtype
       of another — which is the day order silently starts mattering and this comment
       silently starts lying. The check reds on that day. The previous wording said
       "deliberately", which read as a property the code depended on while nothing did:
       release-last's shape, and this task's own lesson. */
    if (err instanceof AccountStoreError) return storeFailed(request, err.message);
    /* D-50-21. `NamingStoreError` is on `isDecision`'s list and is raised at two sites
       inside `changeHandle`'s transaction, so without this arm it left through the
       re-throw below — the arm this header reserves for what is NOT recognised. Same
       500 as `AccountStoreError` and **not re-wrapped**: its message already names
       `allocateHandle`, and re-wrapping would replace it with one naming
       `changeHandle`, moving the named operation away from the one that failed. The
       original travels on `cause`. Not enveloping and not re-wrapping were one decision
       in this file and are two. */
    if (err instanceof NamingStoreError) return storeFailed(request, err.message);
    throw err;
  }
}

/**
 * Every class this wrapper maps, in arm order. Data rather than a chain of `instanceof`
 * so the disjointness below can be measured over it instead of restated by hand.
 */
const MAPPED_CLASSES = [
  HandleRequiredError,
  InvalidProfileError,
  HandleTakenError,
  InvalidNameError,
  AccountStoreError,
  NamingStoreError,
] as const;

/**
 * The arms match pairwise-disjoint classes, so arm order cannot change an answer.
 *
 * Four lines, beside the wrapper rather than in a test file, because it is a claim
 * *this* code makes about *itself*: the comment on the last arm says order is inert,
 * and this is what stops that sentence from being a preference that reads as a
 * guarantee. It reds the day someone makes one class a subtype of another, which is
 * the day order starts mattering and the comment starts lying.
 *
 * Returns the offending pairs rather than throwing, so its own test can name them.
 */
export function armsNotDisjoint(): readonly string[] {
  const bad: string[] = [];
  for (const A of MAPPED_CLASSES) {
    for (const B of MAPPED_CLASSES) {
      if (A !== B && A.prototype instanceof B) bad.push(`${A.name} is a subtype of ${B.name}`);
    }
  }
  return bad;
}

/**
 * The request body as a plain object, or `undefined` when it is not one.
 *
 * `undefined` rather than a throw, because the two callers want different words in
 * the 400 and a shared message would name the wrong field. Malformed JSON, a JSON
 * array, `null` and a bare literal are all the same answer: this route was not sent
 * an object.
 */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | undefined> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    /* A body that is not JSON at all is a malformed request, not a server fault. The
       parse error itself is never rendered: it quotes the input. */
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;
  return parsed as Record<string, unknown>;
}
