// components/mcp/InstallTabs.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import McpPage from "@/app/mcp/page";
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

  /**
   * One case, split across two surfaces on 2026-08-11, because half of the claim moved.
   *
   * It asserted both halves over this component: that the block says "configuration", and
   * that it does not say "coming soon". The 3a pass took the panel chrome off — the
   * `{label} configuration` heading and the emerald `configuration` chip printed the word
   * twice over a box whose contents are self-evidently configuration, and the mock has
   * neither — so the positive half is no longer this component's to carry.
   *
   * It is not dropped, which is the rule this repository works to: a case comes out when
   * the claim it guards is gone, not when the claim moves. §1 of the page now opens "The
   * shape of the configuration, so the proposal can be read against a real host", so the
   * assertion follows it onto the page.
   *
   * The negative half stays here and is the stronger of the two. `honesty.test.ts` records
   * why the badge must not sit inside this block: the page refuses the server in three
   * registers and all three are sentences, and an amber pill beside a snippet reads as a
   * caveat about one client rather than about the route.
   */
  it("does not wear a coming-soon badge beside the snippet", () => {
    const html = renderToStaticMarkup(createElement(InstallTabs));
    expect(plainText(html).toLowerCase()).not.toContain("coming soon");
  });

  it("is presented as configuration by the section that mounts it", () => {
    const page = plainText(renderToStaticMarkup(createElement(McpPage as never)));
    expect(page.toLowerCase()).toContain("the shape of the configuration");
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
