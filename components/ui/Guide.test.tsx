import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CodePanel } from "./Guide";

describe("guide command panels", () => {
  it("keeps the copy control above the complete source", () => {
    const command = 'npx -y darkprint export <dir> --attractor\n# retain the next line';
    const html = renderToStaticMarkup(createElement(CodePanel, {
      title: "Export", text: command, ariaLabel: "Copy export command",
    }));
    expect(html.indexOf('<button'), "copy controls must precede source so they cannot narrow the phone text column").toBeLessThan(html.indexOf('<pre'));
    expect(html).toContain('aria-label="Copy export command"');
    expect(html).toContain('npx -y darkprint export &lt;dir&gt; --attractor\n# retain the next line');
  });
});
