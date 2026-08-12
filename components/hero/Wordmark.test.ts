import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SetupChips } from "@/components/hero/SetupChips";
import { Wordmark } from "@/components/hero/Wordmark";
import { plainText } from "@/components/ui/visible-text";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

const render = () => renderToStaticMarkup(createElement(Wordmark));
const renderChips = () => renderToStaticMarkup(createElement(SetupChips));

/**
 * The setup chip for `href`, matched by its own attribute rather than by its destination.
 *
 * It used to match the first `<a href="…">` on the page, and that stopped being unique on
 * 2026-08-10: the `/build` split pointed the hero's "Create a blueprint" button at `/skill`,
 * which is also where the skill chip goes, so the CTA matched first and the assertions below
 * were reading a six-word button for an install command.
 *
 * The anchor was `data-mark="cli"` until the chips left `Wordmark` on 2026-08-11. `data-mark`
 * means "the timeline touches this" in that file, and these no longer animate, so carrying
 * one purely to be found by a test would have been the attribute lying about itself.
 * `data-setup` is theirs, and it says what it is.
 */
const setupCard = (html: string, href: string) => {
  const match = html.match(
    new RegExp(`<a[^>]*data-setup="[^"]*"[^>]*href="${href}"[\\s\\S]*?</a>`),
  );
  if (match === null) throw new Error(`the hero has no setup card for ${href}`);
  return match[0];
};

describe("Wordmark", () => {
  it("renders the blueprint-first claim and both primary actions without client JS", () => {
    const html = render();
    const text = plainText(html);
    /* Two tones, and it has to stay ONE WORD.
       ------------------------------------------------------------
       This was `expect(text).toContain("DarkPrint")` until the name went two-tone: "Print"
       is `--color-cyan` and "Dark" is `--color-fg`, so the heading now holds a nested span
       and `plainText` replaces every tag with a space — by design, so that adjacent blocks
       do not run together for `honesty.test.ts`. It reads "Dark Print" here and the page
       does not: an inline span adds no whitespace to `textContent` or to the accessible
       name, which is exactly the property worth pinning now that there is markup between
       the halves.

       So the claim moves to the markup and gets stronger for it. `Dark`, then a tag, then
       `Print`, with nothing in between — a stray space, a `<br>`, or a `block` on that span
       would all fail here, and every one of them would put a gap in the brand name. */
    expect(html).toMatch(/Dark<[^>]+>Print</);
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

  /**
   * The chips are outside the entrance, which is the whole reason they are their own file.
   *
   * `Wordmark`'s timeline hides every element it owns in a layout effect and brings it back
   * over 1.4 seconds. Anything rendered inside that component acquires a beat by proximity,
   * and these carry the one line a returning reader arrives to copy. Rendered from their own
   * component there is no timeline to join, and nothing here can put them back on one
   * without this case saying so: no `data-mark`, and no opacity or transform to start from.
   */
  it("paints the setup commands immediately, outside the entrance", () => {
    const html = renderChips();
    expect(html).not.toContain("data-mark");
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("translate-y");
    // And `Wordmark` no longer draws them, so there is exactly one copy on the page.
    expect(render()).not.toContain("data-setup");
  });

  /**
   * The two commands reach their own pages, and neither cell claims anything else.
   *
   * This case asserted `expect(mcp.toLowerCase()).toContain("coming soon")` — the band drew
   * a `ComingSoonBadge` on the MCP cell and this held it there. The author asked the badge
   * off on 2026-08-12 ("we will implement before sharing the service with people"), so the
   * assertion is inverted rather than deleted: what used to be required is now forbidden, on
   * BOTH cells, which is the strongest form of the same case and catches the badge being
   * reinstated by an edit that does not read this file.
   *
   * **The claim it was protecting has not moved and is not weakened.** MCP is still unbuilt
   * and the site still says so on `/mcp` — the lead, the `metadata.description` and the
   * status column of the contract table — and `components/site/honesty.test.ts` pins all
   * three verbatim. This band was repeating that disclosure, not holding it up alone. The
   * link asserted below is what puts a reader in front of it.
   */
  it("links both setup commands to their detail pages, and neither cell hedges", () => {
    const html = renderChips();
    const skill = plainText(setupCard(html, SKILL_ROUTE));
    const mcp = plainText(setupCard(html, MCP_ROUTE));
    expect(skill).toContain(SKILL_INSTALL_COMMAND);
    expect(mcp).toContain(MCP_CONNECT_COMMAND);
    expect(skill.toLowerCase()).not.toContain("coming soon");
    expect(mcp.toLowerCase()).not.toContain("coming soon");
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
    /* The 64 rung, drawn at 72: three discs, and the perforation only the top rung carries.
       88 until the 2b layout — the mark comes down while the name goes up. The RUNG does
       not change with it: `rungFor` is `size >= rung`, so 72 and 88 both draw 64, which is
       why the circle count below is unchanged and why this is one number and not two. */
    expect(mark).toMatch(/<svg[^>]*width="72"[^>]*height="72"/);
    expect([...mark!.matchAll(/<circle/g)].length).toBeGreaterThanOrEqual(3 + 4);
  });

  it("keeps archive counters out of the first viewport", () => {
    const text = plainText(render()).toLowerCase();
    expect(text).not.toMatch(/\d+\s+blueprints/);
  });
});
