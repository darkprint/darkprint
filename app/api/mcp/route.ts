/* ============================================================
   POST /api/mcp: the remote MCP endpoint
   Streamable HTTP in its stateless form: one JSON-RPC message or a
   batch per POST, answered as JSON, no session id and no event
   stream. A client such as `claude mcp add --transport http` sends
   initialize, notifications/initialized, tools/list and tools/call
   here and needs nothing installed.

   Every tool runs in-process through the same protocol core the
   stdio server uses, so the two transports cannot disagree. The
   caller's read is spent once per tools/call, inside the executor,
   so a rate limit reaches the model as a tool result it can act on
   rather than as a transport error it never sees.

   No CORS preflight handler: every documented client (Claude Code,
   Codex, Cursor, VS Code, Gemini CLI, the Claude connectors) calls
   from outside a browser. GET and DELETE answer 405 with an Allow
   header, which Next only sets when the method is exported.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { withLimitsErrors } from "@/lib/server/limits";
import { mcpCaller, spendMcpRead, withMcpErrors } from "@/lib/server/mcp";
import { localExecutor } from "@/packages/mcp/src/local";
import { handleMethod } from "@/packages/mcp/src/protocol";
import { RPC_INVALID_REQUEST, answer, parseErrorResponse } from "@/packages/mcp/src/rpc";

const PROTOCOL_HEADER = "mcp-protocol-version";

/** The response headers: JSON, plus the protocol version echoed when the client named one. */
function headersFor(request: Request): Headers {
  const headers = new Headers({ "content-type": "application/json" });
  const version = request.headers.get(PROTOCOL_HEADER);
  if (version !== null && version !== "") headers.set(PROTOCOL_HEADER, version);
  return headers;
}

export async function POST(request: Request): Promise<Response> {
  return withLimitsErrors(request, () =>
    withMcpErrors(request, async () => {
      const headers = headersFor(request);

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify(parseErrorResponse()), { status: 400, headers });
      }

      /* An empty batch is JSON-RPC's own invalid request; a non-object is answered the same
         way, with a null id because there is none to echo. */
      const messages = Array.isArray(body) ? body : [body];
      if (messages.length === 0 || messages.some((m) => typeof m !== "object" || m === null)) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: { code: RPC_INVALID_REQUEST, message: "Invalid request." },
          }),
          { status: 400, headers },
        );
      }

      const { db } = getSharedDbClient();
      const { subject, actor } = await mcpCaller(db, request);
      const executor = localExecutor(db, actor, () => spendMcpRead(subject));

      const responses: Record<string, unknown>[] = [];
      for (const message of messages) {
        const response = await answer(message, (method, params) =>
          handleMethod(method, params, executor),
        );
        if (response !== undefined) responses.push(response);
      }

      /* Only notifications: accepted, nothing to say. */
      if (responses.length === 0) {
        headers.delete("content-type");
        return new Response(null, { status: 202, headers });
      }
      return new Response(JSON.stringify(Array.isArray(body) ? responses : responses[0]), {
        status: 200,
        headers,
      });
    }),
  );
}

/** 405 with the one method this address takes, as a problem document. */
function methodNotAllowed(request: Request): Response {
  const refused = problem(request, {
    type: `${PROBLEM_TYPE_BASE}/method-not-allowed`,
    title: "Method not allowed",
    status: 405,
    detail:
      "This address speaks MCP over HTTP and takes POST only: one JSON-RPC message or a " +
      "batch per request, answered as JSON. There is no event stream to open here.",
  });
  const headers = new Headers(refused.headers);
  headers.set("allow", "POST");
  return new Response(refused.body, { status: 405, headers });
}

export function GET(request: Request): Response {
  return methodNotAllowed(request);
}

export function DELETE(request: Request): Response {
  return methodNotAllowed(request);
}

/**
 * Exported explicitly because Next otherwise synthesises an OPTIONS whose Allow header lists
 * every exported method, and GET and DELETE are exported here only to refuse. This is not a
 * CORS preflight answer: it carries no Access-Control headers, on purpose.
 */
export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { allow: "POST" } });
}
