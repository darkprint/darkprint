// components/install/InstallTabs.test.ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstallTabs } from "@/components/install/InstallTabs";
import { MCP_CLIENTS } from "@/components/install/clients";
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
});
