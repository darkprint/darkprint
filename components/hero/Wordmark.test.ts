import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SetupChips } from "@/components/hero/SetupChips";
import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";

const render = () => renderToStaticMarkup(createElement(Wordmark));
const renderChips = () => renderToStaticMarkup(createElement(SetupChips));

const setupAction = (html: string, action: "browse" | "connect") => {
  const match = html.match(
    new RegExp(`<a\\b(?=[^>]*data-setup="${action}")(?=[^>]*href="[^"]+")[^>]*>[\\s\\S]*?</a>`),
  );
  if (match === null) throw new Error(`the hero has no ${action} action`);
  return match[0];
};

describe("Wordmark", () => {
  it("explains MCP retrieval and local runs, with browse and connect as primary actions", () => {
    const html = render();
    const text = plainText(html);
    expect(html).toMatch(/Dark<[^>]+>Print</);
    expect(text).toContain(
      "Reusable blueprints for agent workflows.",
    );
    expect(text).toContain("Find a workflow for your coding agent to adapt and run locally.");

    const browse = setupAction(html, "browse");
    const connect = setupAction(html, "connect");
    expect(plainText(browse)).toContain("Browse blueprints");
    expect(browse).toContain('href="/blueprints"');
    expect(browse).toContain("bg-cyan");
    expect(plainText(connect)).toContain("Connect your agent");
    expect(connect).toContain(`href="${MCP_ROUTE}"`);
    expect(connect).toContain("border-line-bright");
    expect(text).not.toContain("Find a blueprint for your task");
    expect(text).not.toContain("Write your first blueprint");
    expect(html).not.toContain('href="/tutorial"');
    expect(html).toContain('href="#example"');

    /* The session-aware account line stays secondary. The prerendered frame says nothing about
       account state until the browser resolves it. */
    expect(html).toContain("animate-pulse");
    expect(text).not.toContain("Sign in with");
    expect(text.toLowerCase()).not.toContain("sign in");
    expect(text).not.toContain("Welcome,");
  });

  it("keeps both setup actions visible without commands or an initial hidden state", () => {
    const html = renderChips();
    const browse = setupAction(html, "browse");
    const connect = setupAction(html, "connect");
    expect(html).not.toContain("data-mark");
    expect(html).not.toContain("data-mark");
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("translate-y");
    expect(plainText(browse)).toContain("Browse blueprints");
    expect(browse).toContain('href="/blueprints"');
    expect(browse).toContain("bg-cyan");
    expect(plainText(connect)).toContain("Connect your agent");
    expect(connect).toContain(`href="${MCP_ROUTE}"`);
    expect(connect).toContain("border-line-bright");
    expect(html).not.toContain(SKILL_INSTALL_COMMAND);
    expect(html).not.toContain(MCP_CONNECT_COMMAND);
    expect(html).not.toContain("$ ");
    expect(html.toLowerCase()).not.toContain("coming soon");
  });

  it("keeps the decorative trace hidden in the static frame", () => {
    const html = render();
    expect(html).toContain('data-mark="trace"');
    expect(html).toMatch(/data-mark="trace"[^>]*class="[^"]*opacity-0/);
    expect(html).not.toContain("dp-char");
  });

  it("renders both visible setup links without a hidden initial state", () => {
    const html = renderChips();
    expect(html).not.toContain("data-mark");
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("translate-y");
    expect(setupAction(html, "browse")).toContain('href="/blueprints"');
    expect(setupAction(html, "connect")).toContain(`href="${MCP_ROUTE}"`);
  });

  it("keeps install commands out of the hero and distinguishes the two actions", () => {
    const html = renderChips();
    const browse = setupAction(html, "browse");
    const connect = setupAction(html, "connect");
    expect(plainText(browse)).toContain("Browse blueprints");
    expect(browse).toContain('href="/blueprints"');
    expect(browse).toContain("bg-cyan");
    expect(plainText(connect)).toContain("Connect your agent");
    expect(connect).toContain(`href="${MCP_ROUTE}"`);
    expect(connect).toContain("border-line-bright");
    expect(html).not.toContain(SKILL_INSTALL_COMMAND);
    expect(html).not.toContain(MCP_CONNECT_COMMAND);
    expect(html, "a hero action prints a shell prompt").not.toContain("$ ");
    expect(html.toLowerCase()).not.toContain("coming soon");
  });

  /**
   * The mark is in the static frame, and it is silent.
   *
   * Two claims, both of which fail silently if they break. **Visible with no JS**: the
   * entrance sets the hidden state in a layout effect, which never runs in `useReveal`'s
   * `static` phase, so a mark that arrived with `opacity-0` in the markup would simply be
   * missing for the server, for JS-off and for reduced-motion, and every one of those
   * renders would still look like a page. **Silent**: the `h1` two lines below says
   * "DarkPrint", so a mark carrying an accessible name announces the brand twice in a row
   * to a screen reader and to nobody else.
   */
  it("renders the brand mark visible and unnamed in the static frame", () => {
    const html = render();
    /* The wrapper and its subtree, not the rest of the document: the mark holds one `<svg>`
       and no nested `<div>`, so the first close is its own, and scoping the assertions here
       stops an unrelated `aria-label` further down the hero from deciding this case. */
    const mark = html.match(/<div[^>]*data-mark="logo"[^>]*>[\s\S]*?<\/div>/)?.[0];
    expect(mark, "the hero has no brand mark").toBeDefined();
    expect(mark).not.toContain("opacity-0");
    expect(mark).toContain("aria-hidden");
    expect(mark).not.toContain("aria-label");
    /* The 64 rung, drawn at 80: three discs, and the perforation only the top rung carries.
       88 under the 2a row, 72 when 2b brought the mark down under a bigger name, 80 when the
       author asked the whole lockup up a step. The RUNG has not moved through any of it:
       `rungFor` is `size >= rung`, so every one of those three draws 64, which is why the
       circle count below is unchanged and why this is one number and not two. */
    expect(mark).toMatch(/<svg[^>]*width="80"[^>]*height="80"/);
    expect([...mark!.matchAll(/<circle/g)].length).toBeGreaterThanOrEqual(3 + 4);
  });

  it("keeps archive counters out of the first viewport", () => {
    const text = plainText(render()).toLowerCase();
    expect(text).not.toMatch(/\d+\s+blueprints/);
  });
});
