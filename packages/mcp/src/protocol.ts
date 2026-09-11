/* ============================================================
   darkprint mcp: the protocol core, shared by both transports
   Five methods, which is all a tools-only server owes:
   `initialize`, `notifications/initialized` (and `cancelled`),
   `ping`, `tools/list`, `tools/call`. The stdio server and the
   remote endpoint both call `handleMethod` and differ only in how
   a tool is executed, so the wire behaviour cannot drift between
   them.
   ============================================================ */

import { TOOL_DEFINITIONS, toolDefinition } from "./definitions";
import { RpcError, RPC_INVALID_PARAMS, RPC_METHOD_NOT_FOUND } from "./rpc";

/** The newest revision this server speaks, and what a client naming an unknown one gets. */
export const PROTOCOL_VERSION = "2025-06-18";

/**
 * The revisions this server can honour. A tools-only server behaves identically across
 * them, so a client naming one of these is answered with the same version it asked for,
 * which is the negotiation the specification prescribes; any other value gets the newest.
 */
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];

export const SERVER_INFO = { name: "darkprint", title: "DarkPrint registry", version: "0.1.0" };

/** Runs one named tool with its arguments and answers the text the model reads. */
export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

/** The version an `initialize` answer carries for the version the client sent. */
export function negotiatedVersion(params: unknown): string {
  const asked =
    typeof params === "object" && params !== null
      ? (params as { protocolVersion?: unknown }).protocolVersion
      : undefined;
  return typeof asked === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(asked)
    ? asked
    : PROTOCOL_VERSION;
}

/**
 * Handles one method. `undefined` means the message was a notification and there is nothing
 * to answer; a `RpcError` is a fault in the client's request, never in a tool.
 */
export async function handleMethod(
  method: string,
  params: unknown,
  executor: ToolExecutor,
): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: negotiatedVersion(params),
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      };

    /* Answering a notification is a protocol violation, so these arms exist only so an
       unknown-method error is not raised for a message the specification says to ignore. */
    case "notifications/initialized":
    case "notifications/cancelled":
      return undefined;

    case "ping":
      return {};

    case "tools/list":
      return {
        tools: TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };

    case "tools/call":
      return await callTool(params, executor);

    default:
      throw new RpcError(RPC_METHOD_NOT_FOUND, `Unknown method \`${method}\`.`);
  }
}

/**
 * A failed tool call is a RESULT with `isError: true`, never an RPC error. A JSON-RPC error
 * is a transport fault the host shows the user and the model never sees; a result goes into
 * the conversation, so the agent reads the sentence (a rate limit, a refusal) and can act on
 * it. An unknown tool is the one exception: that is a fault in the client's request.
 */
export async function callTool(params: unknown, executor: ToolExecutor): Promise<unknown> {
  const call =
    typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {};
  const name = call.name;
  if (typeof name !== "string") {
    throw new RpcError(RPC_INVALID_PARAMS, "`tools/call` requires a string `name`.");
  }
  if (toolDefinition(name) === undefined) {
    throw new RpcError(RPC_INVALID_PARAMS, `Unknown tool \`${name}\`.`);
  }

  const args =
    typeof call.arguments === "object" && call.arguments !== null
      ? (call.arguments as Record<string, unknown>)
      : {};

  try {
    return { content: [{ type: "text", text: await executor(name, args) }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    };
  }
}
