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

    /* The fold's action is `HeroAction` now, not the two route buttons: the owner replaced
       them with the sign-in choice (signed out) or the reader's own name (signed in), so
       "Find a blueprint" / "Create a blueprint" and their hrefs are no longer this
       component's to render. `components/home/beats.test.ts` holds the other half — that
       both routes are still reachable from the landing, through `SectionLifecycle`, which
       is what makes the change a move rather than a removal.

       What is pinned here is the STATIC frame, which is the only frame this renderer sees:
       `HeroAction` reads the session in the browser (the landing must stay prerendered,
       and `tests/server/t261/ac3-prerender-verdicts.test.ts` asserts `/` does), so the
       server-rendered output is its claimless loading placeholder. A hero that shipped
       "Sign in" or a name in this frame would be stating something about a reader nobody
       has identified yet. */
    expect(html).toContain("animate-pulse");
    expect(text).not.toContain("Sign in with");
    expect(text).not.toContain("Welcome,");
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
  it("paints the setup links immediately, outside the entrance", () => {
    const html = renderChips();
    expect(html).not.toContain("data-mark");
    expect(html).not.toContain("opacity-0");
    expect(html).not.toContain("translate-y");
    // And `Wordmark` no longer draws them, so there is exactly one copy on the page.
    expect(render()).not.toContain("data-setup");
  });

  /**
   * Two doors, each a link to its own page, and neither cell prints a command or hedges.
   *
   * The band used to print the install command and the connect command inside the cells.
   * The owner asked them off ("they are only clickable, just keep the texts"), so the cells
   * are the two labels alone and the command with its copy control lives on the page each
   * one opens. Both commands are asserted ABSENT here so an edit that puts one back is
   * caught, and both are still imported so a renamed constant breaks this file loudly rather
   * than letting the needle go stale.
   *
   * The "coming soon" half is inverted from what this case once required: the band drew a
   * `ComingSoonBadge` on the MCP cell and the author asked it off. The disclosure it was
   * repeating lives on `/mcp`, where `components/mcp/honesty.test.ts` pins it; the link
   * asserted here is what puts a reader in front of it.
   */
  it("links both doors to their pages as labels alone, and neither cell hedges", () => {
    const html = renderChips();
    const skill = plainText(setupCard(html, SKILL_ROUTE));
    const mcp = plainText(setupCard(html, MCP_ROUTE));
    expect(skill).toContain("Design your blueprint via the DarkPrint skill");
    expect(mcp).toContain("Connect via MCP");
    expect(skill, "the install command is back in the band").not.toContain(SKILL_INSTALL_COMMAND);
    expect(mcp, "the connect command is back in the band").not.toContain(MCP_CONNECT_COMMAND);
    expect(html, "a cell prints a shell prompt, so a command came back").not.toContain("$ ");
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
