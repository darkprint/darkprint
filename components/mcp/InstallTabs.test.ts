// components/mcp/InstallTabs.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import McpPage from "@/app/mcp/page";
import { InstallTabs } from "@/components/mcp/InstallTabs";
import { MCP_CLIENTS, MCP_ENDPOINT_URL } from "@/components/mcp/clients";
import { plainText } from "@/components/ui/visible-text";

describe("InstallTabs", () => {
  it("names every client as a tab", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    const text = plainText(html);
    for (const client of MCP_CLIENTS) {
      expect(text).toContain(client.label);
    }
  });

  it("shows the first client's snippet by default", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(html).toContain(MCP_CLIENTS[0].snippet.split("\n")[0]);
  });

  /**
   * The server is live and remote, so an amber pill beside a snippet would say the opposite
   * of what the page says in words; the one limit that survives (the npm package) is a
   * sentence on the page, not a glyph in this block.
   */
  it("does not wear a coming-soon badge beside the snippet", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(plainText(html).toLowerCase()).not.toContain("coming soon");
  });

  it("is introduced by the section that mounts it as something to run or paste", () => {
    const page = plainText(renderToStaticMarkup(createElement(McpPage as never)));
    expect(page.toLowerCase()).toContain("run the command, or paste the json into its mcp settings");
  });

  it("points every client at the one remote address, and none at npm", () => {
    for (const client of MCP_CLIENTS) {
      expect(client.snippet, `${client.label} does not name the endpoint`).toContain(MCP_ENDPOINT_URL);
      expect(client.snippet, `${client.label} still runs the unpublished package`).not.toContain("npx");
    }
  });

  /**
   * Roving tabindex: exactly one tab stop in the whole group, on the active tab. The
   * contract was `components/build/WorkspaceStage.tsx`'s first; that file was deleted with
   * `/build` on 2026-09-06, and `components/capabilities/SurfaceTabs.tsx` is the other
   * tablist holding the same shape today. This is as much of
   * the keyboard behaviour as static markup can see — there is no jsdom/testing-library
   * in this repo to dispatch a real ArrowRight and observe focus move, so the
   * `onTabKeyDown` handler's logic is verified by reading, not by a rendered assertion.
   */
  it("gives exactly one tab a tab stop, on the active client", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    const zeroStops = html.match(/tabindex="0"/g) ?? [];
    const negativeStops = html.match(/tabindex="-1"/g) ?? [];
    expect(zeroStops.length).toBe(1);
    expect(negativeStops.length).toBe(MCP_CLIENTS.length - 1);
  });
});
