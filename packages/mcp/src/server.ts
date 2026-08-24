/* ============================================================
   darkprint mcp — the MCP protocol, over the RPC layer
   Five methods, which is the whole of what a tools-only server
   owes: `initialize`, `notifications/initialized`, `tools/list`,
   `tools/call`, `ping`. No resources, no prompts, no sampling —
   the contract's scope is "read access and nothing else", and a
   capability advertised and unimplemented is the kind of claim
   this site refuses everywhere else.
   ============================================================ */

import { RpcError, RPC_INVALID_PARAMS, RPC_METHOD_NOT_FOUND, serve } from "./rpc";
import type { RegistryOptions } from "./registry";
import { TOOLS } from "./tools";

/**
 * The revision this server speaks.
 *
 * Echoed back only when the client asks for it. A client naming a different revision gets
 * this one, which is the negotiation the spec prescribes: the client then decides whether it
 * can live with the answer, and a server that echoed whatever it was sent would be claiming
 * to speak a revision it has never seen.
 */
const PROTOCOL_VERSION = "2025-06-18";

const SERVER_INFO = { name: "darkprint", title: "DarkPrint registry", version: "0.1.0" };

/** Runs the server until stdin closes. */
export async function runServer(
  options: RegistryOptions,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  await serve(input, output, async (method, params) => {
    switch (method) {
      case "initialize":
        return {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        };

      /* Notifications. Answering one is a protocol violation, and `serve` is what enforces
         that — these arms exist so an unknown-method error is not raised for a message the
         spec says to ignore. */
      case "notifications/initialized":
      case "notifications/cancelled":
        return undefined;

      case "ping":
        return {};

      case "tools/list":
        return {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };

      case "tools/call":
        return await callTool(options, params);

      default:
        throw new RpcError(RPC_METHOD_NOT_FOUND, `Unknown method \`${method}\`.`);
    }
  });
}

/**
 * ── Why a failed tool call is a RESULT and not an RPC error ──
 *
 * This is the line AC6 turns on. A JSON-RPC error is a transport fault: the host surfaces it
 * to the user and the MODEL NEVER SEES IT. A tool result with `isError: true` goes into the
 * conversation, so the agent reads the sentence and can act on it.
 *
 * AC6 is *an unkeyed client is limited and told so in a form an agent can act on*. Rendering
 * the rate limit as an RPC error would satisfy every mechanical reading of that — the limit,
 * the reset and the key affordance are all in the string — while putting it in the one place
 * the audience the criterion names cannot read. That is what an opaque refusal is here.
 *
 * An unknown TOOL is an RPC error, and the split is deliberate: that is a fault in the
 * client, not information for the model, and no agent can act on it.
 */
async function callTool(options: RegistryOptions, params: unknown): Promise<unknown> {
  const call = typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
  const name = call.name;
  if (typeof name !== "string") {
    throw new RpcError(RPC_INVALID_PARAMS, "`tools/call` requires a string `name`.");
  }

  const tool = TOOLS.find((candidate) => candidate.name === name);
  if (tool === undefined) throw new RpcError(RPC_INVALID_PARAMS, `Unknown tool \`${name}\`.`);

  const args =
    typeof call.arguments === "object" && call.arguments !== null
      ? (call.arguments as Record<string, unknown>)
      : {};

  try {
    return { content: [{ type: "text", text: await tool.run(options, args) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    };
  }
}
