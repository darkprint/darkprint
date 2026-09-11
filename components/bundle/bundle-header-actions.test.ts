/* ============================================================
   The band's action row, as a reader with no JavaScript receives it.

   The owner, 2026-09-06, naming the order and the removal in one sentence: "remove the watch
   button in the blueprint card template ... remove the Code button and move on top right on
   the side right of the Star; the order should be: star, fork, download blueprint. In the
   node card, it should be star, fork, Download Card."

   An order is the one property of this row that no other guard can see.
   `app/blueprints/detail-page-shape.test.ts` reads the page's SOURCE and can say the band
   is handed a `download` slot; it cannot say where the slot lands relative to the two pills,
   because that is decided in this component and not at the call site. So this renders the
   band and reads the markup — `renderToStaticMarkup`, the same idiom
   `tests/server/t261/d261-06-author-text.test.ts` already uses on this component.

   ── Both callers, in one file, deliberately ──
   `BundleHeader` is shared: `/blueprints/[owner]/[slug]` mounts it for a bundle and a card's
   page mounts it for a card, in a different register and with a different third control. The
   two are asserted side by side because the risk is not that either shape fails on its own —
   it is that a change made for one silently reorders the other, and two cells in two files
   would each stay green while the two surfaces disagreed.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Author } from "@/lib/types";
import { BundleHeader } from "./BundleHeader";
import { CodeMenu } from "./CodeMenu";

const owner: Author = {
  username: "mara-veil",
  displayName: "Mara Veil",
  avatarHue: 190,
  validator: false,
};

/**
 * The three positions, in the markup, of the three controls the owner named.
 *
 * `>Star</span>` and not `Star`, and the difference is not fastidiousness: `ActionPill`
 * writes its label as the last child of a span, directly after the glyph's `</svg>`, so the
 * closing tag is what separates the control from every other occurrence of the word. A bare
 * `Star` matched the fixture's own title, `Starter software factory`, twenty lines earlier —
 * which put `star` before `fork` for a reason that had nothing to do with the row, and left
 * the ordering cell green against a band with the two pills swapped. Caught by mutating the
 * component; the card fixture reddened and the blueprint one did not.
 */
function positions(html: string): { star: number; fork: number; download: number } {
  return {
    star: html.indexOf(">Star</span>"),
    fork: html.indexOf(">Fork</span>"),
    download: html.indexOf("<details"),
  };
}

function band(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(BundleHeader, {
      owner,
      slug: "starter-software-factory",
      visibility: "public" as const,
      title: "Starter software factory",
      summary: "a bundle",
      forks: 3,
      saveId: "blueprint:starter-software-factory",
      ...extra,
    }),
  );
}

const DOWNLOAD = createElement(CodeMenu, {
  download: {
    href: "/api/bundles/mara-veil/starter-software-factory/archive?digest=sha256%3Aabc",
    name: "starter-software-factory-1.2.0.tgz",
  },
  cloneCommand: "npx -y darkprint clone mara-veil/starter-software-factory",
});

const BLUEPRINT = band({ download: DOWNLOAD });

describe("star, fork, download blueprint", () => {
  it("rendered something", () => {
    // Every ordering cell below is satisfied at once by an empty string: -1 < -1 is false,
    // but so is every other comparison, and `toBeLessThan` on two -1s fails for the wrong
    // reason. This is the cell that says the reason is right.
    expect(BLUEPRINT.length).toBeGreaterThan(900);
  });

  it("draws all three controls", () => {
    const at = positions(BLUEPRINT);
    expect(at.star, "the band draws no Star control").toBeGreaterThan(0);
    expect(at.fork, "the band draws no Fork control").toBeGreaterThan(0);
    expect(at.download, "the band drew nothing for the `download` slot it was handed")
      .toBeGreaterThan(0);
  });

  it("draws them left to right in the order the owner named", () => {
    const at = positions(BLUEPRINT);
    expect(
      at.star,
      "Fork is drawn before Star. The owner: `the order should be: star, fork, download " +
        "blueprint`.",
    ).toBeLessThan(at.fork);
    expect(
      at.fork,
      "the download is drawn before Fork. It is last for a reason beyond the instruction: " +
        "`CodeMenu`'s panel is anchored `right-0`, and only the final item in a wrapping row " +
        "is guaranteed to end where the group does.",
    ).toBeLessThan(at.download);
  });

  /*
   * The Watch pill, and the count beside it, both off.
   *
   * `Watching` as well as `Watch`: the live control's pressed label was a different string,
   * so a needle for only one of them is green against half a restoration. The eye glyph goes
   * with them — `ActionPill`'s `watch` arm was its only drawing, and a pill restored without
   * its glyph would still be a Watch pill.
   */
  it("draws no Watch control at all", () => {
    expect(BLUEPRINT, "the Watch pill is back on the band").not.toContain("Watch");
    expect(BLUEPRINT, "the watching state's label is back on the band").not.toContain("Watching");
  });

  /*
   * And the slot is absent rather than empty when nothing fills it.
   *
   * A bundle with no fetchable release passes no `download`, and a band that drew an empty
   * wrapper for it would leave a gap in a row of two — invisible to every cell above, which
   * only ever reads positions.
   */
  it("draws nothing for an absent download", () => {
    const withoutSlot = band();
    expect(withoutSlot, "an absent download still renders a disclosure").not.toContain("<details");
    expect(withoutSlot.length, "the band renders nothing without a download").toBeGreaterThan(900);
  });
});

describe("the same row for a card", () => {
  /*
   * A card's page asks for the same three controls in the same order, with two differences
   * the owner named: the label says card, and the register is amber rather than cyan.
   *
   * THE MISMATCH THIS BLOCK USED TO RECORD IS RESOLVED. It said the copper was the
   * integrator's call rather than the owner's literal word, because they had asked for amber
   * and been answered with copper on the strength of a reservation in `app/globals.css`. The
   * owner asked again on 2026-09-06 — "the amber should be the dominant color on the cards
   * sections. So that an user in a glance can know wheter they are on a blueprint or in a
   * card" — the reservation gained a third job, and the control is amber. The note stays in
   * one sentence rather than being deleted, because a reader who meets copper in an old
   * commit or an old comment needs to know it was ruled on and not forgotten.
   *
   * A card has no visibility of its own, so it passes none and the band draws no pill: a
   * card version is reachable exactly when the blueprint pinning it is.
   */
  const CARD = renderToStaticMarkup(
    createElement(BundleHeader, {
      owner,
      slug: "spec-planner",
      summary: "a card",
      title: "Spec planner",
      forks: 1,
      saveId: "node:spec-planner@1.0.0",
      download: createElement(CodeMenu, {
        download: {
          href: "/api/bundles/mara-veil/spec-planner/archive?digest=sha256%3Adef",
          name: "spec-planner-1.0.0.tgz",
        },
        cloneCommand: "npx -y darkprint clone spec-planner@1.0.0",
        label: "Get card",
        tone: "amber" as const,
      }),
    }),
  );

  it("keeps the order and takes the card's own label and register", () => {
    const at = positions(CARD);
    expect(at.star).toBeGreaterThan(0);
    expect(at.star, "a card's band draws Fork before Star").toBeLessThan(at.fork);
    expect(at.fork, "a card's band draws the download before Fork").toBeLessThan(at.download);
    expect(CARD, "a card's download is not labelled for a card").toContain("Get card");
    expect(CARD, "a card's download is not drawn in the amber register").toContain("amber");
    expect(
      CARD,
      "a card's download is still copper. The owner ruled the card register amber on " +
        "2026-09-06 and `app/globals.css` job 3 carries it.",
    ).not.toContain("copper");
    // The blueprint's band is the control. A repointed tone map or a changed default would
    // read as a pass here if only the card were ever rendered. Read up to the download's
    // trigger: the panel body behind it carries amber on both callers, in the badge that
    // fences the CLI line.
    const chrome = BLUEPRINT.slice(0, BLUEPRINT.indexOf("</summary>"));
    expect(chrome.length, "the band has no download trigger to read up to").toBeGreaterThan(900);
    expect(chrome, "the blueprint's band took the card register").not.toContain("amber");
  });

  it("draws no visibility pill for a subject that has none", () => {
    expect(CARD, "a card is being given a visibility it does not have").not.toContain("Public");
    expect(CARD).not.toContain("Private");
    // And the pill is still drawn for a bundle, which does have one. Without this the cell
    // above passes against a band that stopped drawing the pill for everybody.
    expect(BLUEPRINT, "the visibility pill left the band entirely").toContain("Public");
  });
});
