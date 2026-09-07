/* ============================================================
   darkprint mcp: JSON-RPC 2.0, with no dependencies
   The envelope rules live here once. `serve` frames them over
   stdio (one message per line, `\n` terminated) and the remote
   endpoint calls `answer` directly for each message in a POST body,
   so both transports decide requests, notifications and malformed
   input the same way. The package stays dependency-free because it
   is meant for `npx`, and the official SDK is present in this tree
   only as a transitive of a dev dependency.

   stdout is the wire when serving stdio: nothing may write to it
   but this file. Diagnostics go to stderr.
   ============================================================ */

/** A request carries an `id`; a notification is the same shape without one. */
export interface RpcMessage {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: unknown;
}

/** JSON-RPC 2.0's own codes. `-32000` and below are ours to use; we do not need one. */
export const RPC_PARSE_ERROR = -32700;
export const RPC_INVALID_REQUEST = -32600;
export const RPC_METHOD_NOT_FOUND = -32601;
export const RPC_INVALID_PARAMS = -32602;
export const RPC_INTERNAL_ERROR = -32603;

export class RpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Handles one method. Returning `undefined` means *this was a notification and there is
 * nothing to answer*, which is JSON-RPC's rule rather than a convenience: a response to a
 * notification is a protocol violation, and clients do disconnect over it.
 */
export type RpcHandler = (method: string, params: unknown) => Promise<unknown>;

/** The response to a malformed body: JSON-RPC's own prescribed answer, with a null id. */
export function parseErrorResponse(): Record<string, unknown> {
  return { jsonrpc: "2.0", id: null, error: { code: RPC_PARSE_ERROR, message: "Parse error." } };
}

/**
 * The response one already-parsed message earns, or `undefined` when it earns none.
 *
 * A notification gets no response, even a successful one and even a failed one. A request
 * whose `method` is not a string is an invalid request; anything the handler throws that is
 * not an `RpcError` is reported as an internal error with the message and nothing else.
 */
export async function answer(
  message: unknown,
  handle: RpcHandler,
): Promise<Record<string, unknown> | undefined> {
  const parsed: RpcMessage =
    typeof message === "object" && message !== null && !Array.isArray(message)
      ? (message as RpcMessage)
      : {};
  const id = parsed.id;
  const isRequest = id !== undefined && id !== null;

  if (typeof parsed.method !== "string") {
    if (!isRequest) return undefined;
    return {
      jsonrpc: "2.0",
      id,
      error: { code: RPC_INVALID_REQUEST, message: "A request must carry a string `method`." },
    };
  }

  try {
    const result = await handle(parsed.method, parsed.params);
    return isRequest ? { jsonrpc: "2.0", id, result: result ?? {} } : undefined;
  } catch (err) {
    if (!isRequest) return undefined;
    const code = err instanceof RpcError ? err.code : RPC_INTERNAL_ERROR;
    const text = err instanceof Error ? err.message : "Internal error.";
    return { jsonrpc: "2.0", id, error: { code, message: text } };
  }
}

/**
 * Reads newline-delimited JSON-RPC from `input` and writes answers to `output`.
 *
 * Resolves when the input ends, which is how an MCP host shuts a server down: it closes the
 * pipe. A line that is not JSON gets a `-32700` with a null id and the loop continues,
 * because a server that exits on one bad line takes the agent's whole session with it.
 */
export async function serve(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
  handle: RpcHandler,
): Promise<void> {
  let buffer = "";
  input.setEncoding("utf8");

  for await (const chunk of input) {
    buffer += chunk as string;

    /* Everything up to the last newline is complete messages; the tail is a partial line and
       stays in the buffer, because a chunk boundary can land anywhere. */
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line !== "") await dispatch(line, output, handle);
      newline = buffer.indexOf("\n");
    }
  }

  /* A final message with no trailing newline. Some hosts do this on close. */
  const tail = buffer.trim();
  if (tail !== "") await dispatch(tail, output, handle);
}

async function dispatch(
  line: string,
  output: NodeJS.WritableStream,
  handle: RpcHandler,
): Promise<void> {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    write(output, parseErrorResponse());
    return;
  }
  const response = await answer(message, handle);
  if (response !== undefined) write(output, response);
}

/** One message, one line. `JSON.stringify` escapes raw newlines, so the framing holds for any payload. */
function write(output: NodeJS.WritableStream, message: unknown): void {
  output.write(`${JSON.stringify(message)}\n`);
}
