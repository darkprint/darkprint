// components/mcp/InstallTabs.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstallTabs } from "@/components/mcp/InstallTabs";
import { MCP_CLIENTS } from "@/components/mcp/clients";
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

  it("marks itself coming soon", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(plainText(html).toLowerCase()).toContain("coming soon");
  });

  /**
   * Roving tabindex, the same contract `components/build/WorkspaceStage.tsx`'s own tablist
   * holds: exactly one tab stop in the whole group, on the active tab. This is as much of
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
