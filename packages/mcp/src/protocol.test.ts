/* ============================================================
   The protocol core, driven with a scripted executor

   Both transports call `handleMethod`, so what is asserted here
   holds over stdio and over HTTP alike: the version negotiation,
   the tool list, and the line between a tool failure (a result the
   model reads) and a request fault (an RPC error it never sees).
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TOOL_NAMES } from "./definitions";
import {
  PROTOCOL_VERSION,
  SERVER_INFO,
  SUPPORTED_PROTOCOL_VERSIONS,
  handleMethod,
  negotiatedVersion,
} from "./protocol";
import { RPC_INVALID_PARAMS, RPC_METHOD_NOT_FOUND, RpcError } from "./rpc";

const echo = async (name: string, args: Record<string, unknown>) => `${name}:${JSON.stringify(args)}`;
const failing = async () => {
  throw new Error("the registry said no");
};

describe("initialize", () => {
  it("echoes a supported version and answers the newest for anything else", () => {
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      expect(negotiatedVersion({ protocolVersion: version })).toBe(version);
    }
    expect(negotiatedVersion({ protocolVersion: "1999-01-01" })).toBe(PROTOCOL_VERSION);
    expect(negotiatedVersion({})).toBe(PROTOCOL_VERSION);
    expect(negotiatedVersion(undefined)).toBe(PROTOCOL_VERSION);
  });

  it("advertises tools only, and names the server", async () => {
    const result = (await handleMethod("initialize", { protocolVersion: "2025-03-26" }, echo)) as Record<string, unknown>;
    expect(result.protocolVersion).toBe("2025-03-26");
    expect(result.capabilities).toEqual({ tools: {} });
    expect(result.serverInfo).toEqual(SERVER_INFO);
  });

  /**
   * The cell above compares the handshake to the constant it is built from, so it holds the
   * wiring and can say nothing about the value. `SERVER_INFO.version` is a copy of the
   * published package's, and it sat at 0.1.0 through 0.1.1 and 0.1.2: every client that
   * logged a server version logged the wrong one, and nothing red.
   *
   * Read off `package.json` rather than a literal, or this is the same tautology one level
   * further out.
   */
  it("names the version the package actually publishes", () => {
    const manifest = JSON.parse(
      readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
    ) as { version: string };
    expect(
      SERVER_INFO.version,
      "the handshake advertises a version the package does not publish, so a client that " +
        "records which server answered records a release that was never cut",
    ).toBe(manifest.version);
  });
});

describe("the small methods", () => {
  it("answers nothing to a notification and an empty object to ping", async () => {
    expect(await handleMethod("notifications/initialized", undefined, echo)).toBeUndefined();
    expect(await handleMethod("notifications/cancelled", { requestId: 3 }, echo)).toBeUndefined();
    expect(await handleMethod("ping", undefined, echo)).toEqual({});
  });

  it("refuses an unknown method as method-not-found", async () => {
    await expect(handleMethod("resources/list", undefined, echo)).rejects.toMatchObject({
      code: RPC_METHOD_NOT_FOUND,
    });
  });
});

describe("tools/list", () => {
  it("lists every definition with its schema", async () => {
    const result = (await handleMethod("tools/list", undefined, echo)) as {
      tools: { name: string; title: string; description: string; inputSchema: unknown }[];
    };
    expect(result.tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
    for (const tool of result.tools) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.description).not.toContain("—");
      expect((tool.inputSchema as { type: string }).type).toBe("object");
    }
  });
});

describe("tools/call", () => {
  it("hands the arguments to the executor and wraps its text", async () => {
    const result = await handleMethod(
      "tools/call",
      { name: "find_cards", arguments: { task: "x" } },
      echo,
    );
    expect(result).toEqual({ content: [{ type: "text", text: 'find_cards:{"task":"x"}' }] });
  });

  it("renders a thrown Error as a result with isError, never as an RPC error", async () => {
    const result = (await handleMethod("tools/call", { name: "read_card", arguments: {} }, failing)) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("the registry said no");
  });

  it("refuses an unknown tool and a missing name as invalid params", async () => {
    await expect(handleMethod("tools/call", { name: "frobnicate" }, echo)).rejects.toMatchObject({
      code: RPC_INVALID_PARAMS,
    });
    await expect(handleMethod("tools/call", {}, echo)).rejects.toBeInstanceOf(RpcError);
    await expect(handleMethod("tools/call", { name: 7 }, echo)).rejects.toMatchObject({
      code: RPC_INVALID_PARAMS,
    });
  });

  it("treats absent arguments as an empty object", async () => {
    const result = await handleMethod("tools/call", { name: "ping_me_not", arguments: null }, echo).catch(
      (err: RpcError) => err.code,
    );
    expect(result).toBe(RPC_INVALID_PARAMS);
    const ok = await handleMethod("tools/call", { name: "find_cards" }, echo);
    expect(ok).toEqual({ content: [{ type: "text", text: "find_cards:{}" }] });
  });
});
