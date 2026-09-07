/* ============================================================
   DarkPrint backend: the MCP surface's transport boundary
   Here rather than beside the routes because `app/api/**` holds
   route handlers and nothing else, and a mapping applied at each
   route is a mapping with a route that forgot it.

   Two arms. `McpRefusedError` is a fact about the registry and
   answers 404, so existence does not leak; `McpStoreError` is a
   fact about the infrastructure and answers 500 as problem+json
   rather than letting Next render its own page. Anything else is
   re-thrown, because a bug dressed up as a known condition is how
   one stops being noticed.
   ============================================================ */

import type { Db } from "@/lib/db";
import { publicAuthorsByIds } from "@/lib/server/accounts";
import { PROBLEM_TYPE_BASE, notFound, problem } from "@/lib/server/http";
import { enforceLimit, resolveKey, type LimitSubject } from "@/lib/server/limits";
import type { Actor } from "@/lib/server/policy";
import { McpRefusedError, McpStoreError } from "./errors";

/**
 * Runs a route body and maps this module's two rejections.
 *
 * `err.message` reaches `detail` on the 404 and is safe there by construction: a refusal's
 * message is a fixed literal naming only the operation, never a handle, slug, digest or ref.
 */
export async function withMcpErrors(
  request: Request,
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (err) {
    if (err instanceof McpRefusedError) return notFound(request, err.message);
    if (err instanceof McpStoreError) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/store-failed`,
        title: "Store failed",
        status: 500,
        detail: err.message,
      });
    }
    throw err;
  }
}

/** The bucket every MCP route spends from: every tool is a read. */
const MCP_BUCKET = "read";

/** Who is calling: how the request is counted, and the actor its reads are made as. */
export interface McpCaller {
  subject: LimitSubject;
  actor: Actor;
}

/**
 * The caller behind a request, resolved once.
 *
 * `Authorization: Bearer <key>` is the one credential this surface reads. A key that
 * resolves counts against the key tier and reads as its account, so the owner's own private
 * blueprints answer; read scope is enough, because every tool is a read. A secret that does
 * not resolve is simply unkeyed and reads as anonymous, and it is refused nowhere here: a
 * caller able to tell "no such key" from "no key" has an identity oracle.
 *
 * The handle is read off the account rather than left null, because it is the field the
 * actor's account arm carries and other modules read it to name the caller.
 */
export async function mcpCaller(db: Db, request: Request): Promise<McpCaller> {
  const ip = addressOf(request);
  const presented = request.headers.get("authorization");
  const secret = presented?.startsWith("Bearer ") === true ? presented.slice("Bearer ".length).trim() : undefined;

  if (secret !== undefined && secret !== "") {
    const key = await resolveKey(db, secret);
    if (key !== undefined) {
      const handle = (await publicAuthorsByIds(db, [key.accountId])).get(key.accountId)?.handle ?? null;
      return {
        subject: { tier: "key", key, ip },
        actor: { kind: "account", accountId: key.accountId, handle },
      };
    }
  }
  return { subject: { tier: "anonymous", ip }, actor: { kind: "anonymous" } };
}

/** How this request is counted: a resolved key if one was presented, otherwise its address. */
export async function mcpSubject(db: Db, request: Request): Promise<LimitSubject> {
  return (await mcpCaller(db, request)).subject;
}

/**
 * The caller's address as the edge reports it, or `""` when no header carries one. It is
 * spoofable by any client that sets the header, which is a property of every reverse-proxied
 * deployment; the mitigation is at the edge and a second opinion here would not be one.
 */
function addressOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded !== null && forwarded !== "") return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "";
}

/**
 * Spend one unit of the `read` bucket for a caller already resolved, or throw the limits
 * module's `RateLimitedError`. Not caught here: `withLimitsErrors` renders it as the
 * published 429 document, and the in-process executor renders it as a tool result.
 */
export async function spendMcpRead(subject: LimitSubject): Promise<void> {
  await enforceLimit(subject, MCP_BUCKET);
}

/** Spend one unit of the `read` bucket for this request. */
export async function enforceMcpLimit(db: Db, request: Request): Promise<void> {
  await spendMcpRead(await mcpSubject(db, request));
}

/** Resolve the caller, spend one read, and answer the actor the route reads as. */
export async function admitMcp(db: Db, request: Request): Promise<Actor> {
  const caller = await mcpCaller(db, request);
  await spendMcpRead(caller.subject);
  return caller.actor;
}
