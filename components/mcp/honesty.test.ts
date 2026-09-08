/* ============================================================
   The sentences /mcp and /capabilities are not allowed to stop saying

   Each is a limit statement about the MCP server, and limit
   statements are what length passes lose. Every row is checked
   against the real render and, where it matters to a shared link,
   against the `<head>` description. A row leaves this file only
   when the claim it guards has nothing left to guard, in the same
   commit, with the reason in the message.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CapabilitiesPage, { metadata as capabilitiesMetadata } from "@/app/capabilities/page";
import McpPage, { metadata as mcpMetadata } from "@/app/mcp/page";
import { MCP_CLIENTS, MCP_ENDPOINT_URL } from "@/components/mcp/clients";
import { plainText } from "@/components/ui/visible-text";
import { MCP_CONNECT_COMMAND } from "@/lib/mcp";
import { DEFAULT_BASE_URL } from "@/packages/mcp/src/registry";

const MCP_PAGE = plainText(renderToStaticMarkup(createElement(McpPage as never))).toLowerCase();
const CAPABILITIES_PAGE = plainText(
  renderToStaticMarkup(createElement(CapabilitiesPage as never)),
).toLowerCase();
const MCP_DESCRIPTION = (mcpMetadata.description ?? "").toLowerCase();
const CAPABILITIES_DESCRIPTION = (capabilitiesMetadata.description ?? "").toLowerCase();

interface Claim {
  surface: string;
  /** What the sentence is for, in the failure message. */
  why: string;
  /** Verbatim, lowercased at compare time. A paraphrase is a different sentence. */
  says: string;
  text: string;
}

const CLAIMS: readonly Claim[] = [
  {
    surface: "/mcp",
    why: "a reader deciding whether to connect has to know what the server sees by default: public blueprints and cards, whoever is asking, until a key is sent",
    says: "without a key every call reads as anonymous",
    text: MCP_PAGE,
  },
  {
    surface: "/mcp",
    why: "the page hands an agent tools, and the one thing every reader then asks is whether any of them executes a blueprint; nothing here does",
    says: "nothing here runs a blueprint",
    text: MCP_PAGE,
  },
  {
    surface: "/mcp",
    why: "the stdio form is printed beside the remote one, and it fails today because the package is not on npm; the sentence has to say so next to the command",
    says: "not published to npm",
    text: MCP_PAGE,
  },
  {
    surface: "/mcp",
    why: "a ranked list reads as a verdict; the page has to say the number is a similarity between the task and a document and nothing about how good the blueprint is",
    says: "says nothing about quality",
    text: MCP_PAGE,
  },
  {
    surface: "/mcp · metadata.description",
    why: "the same promise where a reader who never opens the page reads it: a search result, a shared link's preview card",
    says: "nothing to install",
    text: MCP_DESCRIPTION,
  },
  {
    surface: "/capabilities · the MCP tab",
    why: "the reference page repeats the default the server reads under, so a reader who lands on the tab meets it without visiting /mcp",
    says: "without a key every call reads as anonymous",
    text: CAPABILITIES_PAGE,
  },
  {
    surface: "/capabilities",
    why: "the intent table names a row for running one, and the answer is that this site does not",
    says: "nothing here runs a blueprint",
    text: CAPABILITIES_PAGE,
  },
  {
    surface: "/capabilities · the CLI tab",
    why: "the tab prints commands a reader runs through npx, and unlike the remote MCP address beside them that downloads a package onto the machine; the tab has to say what comes down and where from, next to the commands",
    says: "npx fetch the darkprint package from npm",
    text: CAPABILITIES_PAGE,
  },
  {
    surface: "/capabilities · the MCP tab",
    why: "the same limit on the score, on the page that prints the tool descriptions",
    says: "says nothing about quality",
    text: CAPABILITIES_PAGE,
  },
  {
    surface: "/capabilities · metadata.description",
    why: "the one fact about the CLI a shared link has to carry: where it comes from, so a reader knows a package download is part of the first command",
    says: "install from npm",
    text: CAPABILITIES_DESCRIPTION,
  },
];

describe("the surfaces the ledger is read off", () => {
  it("rendered whole pages, so no row below passes over an empty string", () => {
    expect(MCP_PAGE.length).toBeGreaterThan(2000);
    expect(CAPABILITIES_PAGE.length).toBeGreaterThan(3000);
    expect(MCP_DESCRIPTION.length).toBeGreaterThan(80);
    expect(CAPABILITIES_DESCRIPTION.length).toBeGreaterThan(80);
  });
});

describe("claims /mcp and /capabilities may not stop making", () => {
  it.each(CLAIMS.map((c) => [`${c.surface}: "${c.says}"`, c] as const))("%s", (_name, claim) => {
    expect(claim.text, `${claim.why}. Surface: ${claim.surface}`).toContain(claim.says);
  });
});

describe("the connection command", () => {
  it("is Claude Code's HTTP line, derived from the first client entry", () => {
    expect(MCP_CLIENTS[0].id).toBe("claude-code");
    expect(MCP_CONNECT_COMMAND).toBe(MCP_CLIENTS[0].snippet);
    expect(MCP_CONNECT_COMMAND.startsWith("claude mcp add --transport http darkprint ")).toBe(true);
    expect(MCP_CONNECT_COMMAND.endsWith(MCP_ENDPOINT_URL)).toBe(true);
  });

  it("names the host the stdio client defaults to, so the two spellings cannot drift", () => {
    expect(MCP_ENDPOINT_URL).toBe(`${DEFAULT_BASE_URL}/api/mcp`);
  });

  it("puts the HTTP transport first and the stdio form after it, marked as unpublished", () => {
    const remote = MCP_PAGE.indexOf(MCP_ENDPOINT_URL.toLowerCase());
    const stdio = MCP_PAGE.indexOf("npx -y darkprint mcp");
    expect(remote).toBeGreaterThan(-1);
    expect(stdio).toBeGreaterThan(remote);
  });
});
