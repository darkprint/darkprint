import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

const render = () => renderToStaticMarkup(createElement(Wordmark));

/**
 * The setup chip for `href`, matched by its own mark rather than by its destination.
 *
 * It used to match the first `<a href="…">` on the page, and that stopped being unique on
 * 2026-08-10: the `/build` split pointed the hero's "Create a blueprint" button at `/skill`,
 * which is also where the skill chip goes, so the CTA matched first and the assertions below
 * were reading a six-word button for an install command.
 *
 * `data-mark="cli"` is what actually distinguishes the two, and `Wordmark` puts it on the
 * chips and on nothing else. Anchoring on it means a second link to the same route is no
 * longer a false match, and a chip that loses its mark fails by name here rather than
 * silently matching a button.
 */
const setupCard = (html: string, href: string) => {
  const match = html.match(
    new RegExp(`<a[^>]*data-mark="cli"[^>]*href="${href}"[\\s\\S]*?</a>`),
  );
  if (match === null) throw new Error(`the hero has no setup card for ${href}`);
  return match[0];
};

describe("Wordmark", () => {
  it("renders the blueprint-first claim and both primary actions without client JS", () => {
    const html = render();
    const text = plainText(html);
    expect(text).toContain("DarkPrint");
    expect(text).toContain("Reusable blueprints for agent workflows.");
    expect(text).toContain("Find a blueprint");
    expect(text).toContain("Create a blueprint");
    expect(html).toContain('href="/blueprints"');
    // `/skill`, not `/build`: creating a blueprint is the authoring skill, and the two were
    // split apart on 2026-08-10. `/build` is the worked sandbox and is a Learn stop.
    expect(html).toContain('href="/skill"');
  });

  it("keeps the decorative trace hidden in the static frame", () => {
    const html = render();
    expect(html).toContain('data-mark="trace"');
    expect(html).toMatch(/data-mark="trace"[^>]*class="[^"]*opacity-0/);
    expect(html).not.toContain("dp-char");
  });

  it("links both setup commands to their corresponding detail pages", () => {
    const html = render();
    const skill = plainText(setupCard(html, SKILL_ROUTE));
    const mcp = plainText(setupCard(html, MCP_ROUTE));
    expect(skill).toContain(SKILL_INSTALL_COMMAND);
    expect(skill.toLowerCase()).not.toContain("coming soon");
    expect(mcp).toContain(MCP_CONNECT_COMMAND);
    expect(mcp.toLowerCase()).toContain("coming soon");
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
    // The 64 rung, drawn at 88: three discs, and the perforation only the top rung carries.
    expect(mark).toMatch(/<svg[^>]*width="88"[^>]*height="88"/);
    expect([...mark!.matchAll(/<circle/g)].length).toBeGreaterThanOrEqual(3 + 4);
  });

  it("keeps archive counters out of the first viewport", () => {
    const text = plainText(render()).toLowerCase();
    expect(text).not.toMatch(/\d+\s+blueprints/);
  });
});
