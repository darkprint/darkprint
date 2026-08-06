/* ============================================================
   The landing's five beats, checked as the server writes them.

   Redesign spec §6 lists four properties of the built landing and
   every one of them is a property of the prerendered HTML:

     the five beats' copy is in the page as text
     there is no YAML block, no scorecard and no term table
     every figure's labels are in the DOM at SSR
     the finished state is what a reader without JS gets

   The build's own grep over `.next/server/app/index.html` is the
   final word on all four, and it is also a minute away and only
   runs when somebody remembers. Rendering the beats the way the
   server does and reading the string that comes out fails here
   instead, in the file that says why it may not.

   Every beat is a client component and this renders them anyway,
   which is the point: `"use client"` tells the bundler where the
   code is *sent*, and an SSG page still renders it to HTML at build
   time. Effects do not run under `renderToStaticMarkup`, so what
   comes back is exactly what a reader with no script gets, and
   exactly what a reader who asked for reduced motion keeps.
   ============================================================ */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Hero } from "@/components/hero/Hero";

import { LANDING_NARROW, LANDING_WIDE } from "./graph";
import { ROLE_ABSENCE, ROLE_BOXES } from "./roles";
import { SectionBlueprint } from "./SectionBlueprint";
import { SectionDoors } from "./SectionDoors";
import { SectionLifecycle } from "./SectionLifecycle";
import { SectionNodeIsCard } from "./SectionNodeIsCard";

function render(beat: () => ReactNode): string {
  return renderToStaticMarkup(createElement(beat as never));
}

const BEATS: [string, () => ReactNode][] = [
  ["1 the wordmark", Hero],
  ["2 the blueprint", SectionBlueprint],
  ["3 the card", SectionNodeIsCard],
  ["4 the lifecycle", SectionLifecycle],
  ["5 the doors", SectionDoors],
];

const HTML = new Map(BEATS.map(([name, beat]) => [name, render(beat)]));

function beat(name: string): string {
  const html = HTML.get(name);
  if (html === undefined) throw new Error(`no beat \`${name}\``);
  return html;
}

/** Tags out, entities resolved. Enough to ask whether a sentence is readable text. */
function readable(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("beat 1 is the wordmark, and the claim survives it", () => {
  const html = beat("1 the wordmark");

  it("puts the name and the claim in one level-one heading", () => {
    // Doc 2 §2.4. `text.splitText` runs on the client and cuts the name into spans; what
    // the server writes, and what a crawler reads, is the word.
    expect(html).toContain("<h1");
    expect(html).toContain("DarkPrint");
  });

  it("keeps the claim as one string", () => {
    // `app/layout.tsx` carries the same sentence in its own metadata, and the build's
    // greps read it out of the prerendered HTML as one text node. Markup between the two
    // halves would split it in both places.
    expect(html).toContain("Autonomy you can read as a graph.");
  });

  it("says the CLI setup is not live yet", () => {
    const words = readable(html).toLowerCase();
    expect(words).toContain("npx darkprint setup");
    expect(words).toContain("coming soon");
  });
});

describe("beat 2 draws the blueprint with its labels in the markup", () => {
  const html = beat("2 the blueprint");

  it("names every role as text", () => {
    for (const box of ROLE_BOXES) {
      expect(html, `${box.label} is not in the markup`).toContain(`>${box.label}<`);
    }
  });

  it("writes the absence, and the prohibition behind it", () => {
    // Doc 2 §5.2. The label a reader has to be able to read without hovering anything.
    expect(html).toContain(ROLE_ABSENCE.prohibition);
    expect(html).toContain('data-viz="absent-edge"');
  });

  it("renders both placements, so a phone gets the squarer one", () => {
    expect(html).toContain(`0 0 ${LANDING_WIDE.width} ${LANDING_WIDE.height}`);
    expect(html).toContain(`0 0 ${LANDING_NARROW.width} ${LANDING_NARROW.height}`);
  });
});

describe("the landing carries no page of the site it is introducing", () => {
  it.each(BEATS.map(([name]) => name))("%s writes no YAML, no table and no code block", (name) => {
    const html = beat(name);
    expect(html, "a table").not.toContain("<table");
    expect(html, "a code block").not.toContain("<pre");
    // The annotated card moved whole to `/spec/card`. A `key:` at the head of a line is
    // what a YAML listing looks like once the tags are gone.
    expect(readable(html)).not.toMatch(/\b(phase|cannot|accepts|emits|model):\s/);
  });

  it.each(BEATS.map(([name]) => name))("%s renders at full opacity with no script", (name) => {
    // `useReveal`'s `static` phase covers the server, a reader with JS off and a reader
    // who asked for reduced motion. A scene that shipped `opacity-0` in the HTML would be
    // invisible to all three.
    //
    // One deliberate exception, added 2026-07-29: beat 1's wordmark trace overlay
    // (`data-mark="trace"`, the wiring-draw entrance's letter-outline layer) is a
    // JS-only decorative effect whose own finished/resting state is invisible — the
    // trace has already faded out once the entrance settles, leaving only the solid
    // letters `data-mark="mark"` carries, which this same check still covers. Stripped
    // out before the check runs; every other element in every beat is still held to it.
    const html = beat(name).replace(/<svg[^>]*data-mark="trace"[\s\S]*?<\/svg>/, "");
    expect(html).not.toContain("opacity-0");
  });
});

/**
 * Every link the four beats emit, resolved against the routes and the archive.
 *
 * Added after the landing shipped `href="/nodes/builder"`, which typechecks, renders,
 * passes every other case in this file and 404s. A `RoleBox` carries two identifiers:
 * `id` is what the DOT calls the node inside one graph, and `card` is the pinned
 * reference the node resolves to. `/nodes/[...id]` is keyed on the second, and reading
 * the first produced a route named after a role nothing publishes.
 *
 * A dynamic segment is why this cannot be a walk of `app/`. The two the landing reaches
 * into are generated from `content/`, so the check follows them there: a card page exists
 * when some version of that id is on disk, and a blueprint page exists when the directory
 * holds a `blueprint.yaml`. Anything else has to be a static route with a `page.tsx`.
 */
describe("every link the landing draws goes somewhere", () => {
  const ROOT = fileURLToPath(new URL("../../", import.meta.url));

  const exists = (path: string) =>
    statSync(join(ROOT, path), { throwIfNoEntry: false }) !== undefined;

  /** Whether `href` names a page this build produces. */
  function resolves(href: string): boolean {
    const path = href.split(/[#?]/)[0].replace(/\/$/, "");
    if (path === "") return true;
    const card = /^\/nodes\/(.+)$/.exec(path);
    if (card !== null) {
      // `<id>@<version>.yaml`, one file per version and one page per id. Nothing in the
      // archive carries a namespace today, so the id is the whole filename stem.
      const id = decodeURIComponent(card[1]);
      return readdirSync(join(ROOT, "content/cards")).some((file) => file.startsWith(`${id}@`));
    }
    const blueprint = /^\/blueprints\/(.+)$/.exec(path);
    if (blueprint !== null) {
      return exists(join("content/blueprints", blueprint[1], "blueprint.yaml"));
    }
    return exists(join("app", path.slice(1), "page.tsx"));
  }

  it.each(BEATS.map(([name]) => name))("%s links only to pages that exist", (name) => {
    const hrefs = [...new Set([...beat(name).matchAll(/href="([^"]+)"/g)].map((m) => m[1]))]
      .filter((href) => href.startsWith("/"));
    expect(hrefs.filter((href) => !resolves(href))).toEqual([]);
  });

  it("draws internal links at all, so the case above is not vacuous", () => {
    /* This case used to require a `/blueprints/<slug>` and a `/nodes/<id>` among the
       beats, on the grounds that "the landing is required to open at least one blueprint
       and one card, which is beats 2 and 3 by definition". Both of those links are gone on
       the author's instruction: beat 2's "Open this blueprint" and beat 3's "read this
       card". The landing reaches the archive through beat 5's two doors now, at
       `/blueprints` and `/nodes`, and not into a single one of either.

       What the case was actually protecting survives and is what it checks now. The test
       above resolves every href the beats emit, and a regex matching nothing would pass it
       silently, so something has to assert the beats emit hrefs at all. */
    const all = BEATS.flatMap(([name]) =>
      [...beat(name).matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    ).filter((href) => href.startsWith("/"));
    expect(all.length).toBeGreaterThan(0);
  });

  it("still reaches the gallery from the doors", () => {
    /* What is left of the landing's own route into the archive, stated so the next change
       to `SectionDoors` cannot quietly close it.

       Worth recording precisely, because removing beat 3's card link cost more than it
       looks: the beats now emit no `/nodes` href at all, so the section arguing that every
       node is a card offers no way to open one, and the node library is reachable from
       this page only through the persistent header. That is a live consequence of the
       author's instruction, not an oversight, and it is written here rather than in a
       comment nobody greps. */
    const hrefs = [...beat("5 the doors").matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toContain("/blueprints");

    const fromBeats = BEATS.flatMap(([name]) =>
      [...beat(name).matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(fromBeats.filter((href) => href.startsWith("/nodes"))).toEqual([]);
  });
});

describe("every figure on the landing is reachable without a pointer", () => {
  // Beat 4 held to this contract while its three panels were `FlowScene` drawings. It
  // has none left (this file's own header, and `SectionLifecycle`'s in full): the author's
  // second verdict took the luminous-flow register itself off this beat, and what
  // replaced it is checked in its own describe block below rather than here.
  /* Beat 3 was in this list and is not a luminous figure any more: it draws `CardWalk`,
     a listing beside a list, both of them DOM text. The two cases below are about labels
     inside an `<svg>`, which is where a label can be hidden behind a hover attribute or
     be unreachable without a pointer. HTML text is neither. */
  it.each(["2 the blueprint"])(
    "%s shows its labels when nothing has written the hover attribute",
    (name) => {
      const html = beat(name);
      // `useLuminousFlow` is the only writer of `data-viz-labels="hover"`, and it has not
      // run here. Spec §1: "a figure whose meaning is only available to a mouse user is a
      // broken figure."
      //
      // The stylesheet comes out first: `FLOW_CSS` writes the same attribute into the
      // selectors that hide a label, so a search over the whole document finds it there
      // and the rule this checks would pass on a scene that was already hiding everything.
      const markup = html.replace(/<style[\s\S]*?<\/style>/g, "");
      expect(markup).toContain('data-viz-labels="always"');
      expect(markup).not.toContain('data-viz-labels="hover"');
    },
  );

  /* Beat 3 was in this list and is not a luminous figure any more: it draws `CardWalk`,
     a listing beside a list, both of them DOM text. The two cases below are about labels
     inside an `<svg>`, which is where a label can be hidden behind a hover attribute or
     be unreachable without a pointer. HTML text is neither. */
  it.each(["2 the blueprint"])(
    "%s gives every labelled glyph a focus stop and an accessible name",
    (name) => {
      const html = beat(name);
      expect(html).toContain('tabindex="0"');
      expect(html).toContain("aria-label=");
      // The scene names itself as a group rather than an image, so the focusable glyphs
      // inside it stay in the accessibility tree.
      expect(html).toContain('role="group"');
    },
  );
});

describe("beat 4's three marks carry no information a screen reader needs", () => {
  /**
   * The opposite property from the describe block above, and just as load-bearing. A
   * `FlowNode` earns a focus stop because it is the only place its meaning lives; these
   * three characters are not — `PanelHeading` already names "Download", "Compose" and
   * "Upload yours" in real text next to each one, so a glyph that also grabbed a tab stop
   * would announce nothing a screen reader has not already been told, once per panel, for
   * no reason. `aria-hidden="true"` is what keeps it out of that tree, and this is the
   * test that would fail if a future edit dropped it — the accessibility bug this file
   * has caught before ran in the direction of forgetting a name; a glyph that forgot to
   * hide itself would be the same bug from the other side.
   */
  it("marks all four ⇄ ↓ ⋈ ↑ as decorative", () => {
    /* Four now: `⇄` arrived with the MCP panel the author asked for. The marks also moved
       out of a 144px box each and onto the heading's own line, so the wrapper this walks
       back to is the heading row rather than the box, and the `aria-hidden` it finds is on
       the mark's own span. Same property, one element in. */
    const html = beat("4 the lifecycle");
    for (const mark of ["⇄", "↓", "⋈", "↑"]) {
      const at = html.indexOf(`>${mark}<`);
      expect(at, `${mark} is not in the markup`).toBeGreaterThan(0);
      const wrapper = html.lastIndexOf("<div", at);
      expect(
        html.slice(wrapper, at),
        `${mark}'s wrapper does not carry aria-hidden`,
      ).toContain('aria-hidden="true"');
    }
  });

  it("carries the panel titles as real, visible text instead", () => {
    const html = beat("4 the lifecycle");
    for (const title of ["Connect", "Download", "Compose", "Upload yours"])
      expect(html).toContain(title);
  });
});

/**
 * Beat 4's four panels, and the 342px column they have to survive.
 *
 * The bug this guards shipped, and it destroyed text rather than merely moving it. An
 * `<article>` is a grid item; a grid item's default `min-width: auto` resolves to its
 * min-content width; and the widest monospace row inside `Artefact` — `$ claude mcp add
 * darkprint -- npx -y darkprint mcp`, 331px on its own — therefore set a 407px floor under
 * a panel sitting in a 342px track on a 390px phone. No padding value on the site's own
 * spacing scale is small enough to close a 65px gap, so the floor is the string and the
 * only thing that lifts it is the class. Measured in the browser at 390×844:
 * `document.documentElement.scrollWidth` 431 against `clientWidth` 390, every article
 * 407.4px wide with its right edge at 431.4, and `window.scrollTo(300, 0)` leaving
 * `scrollX` at 0 — `app/globals.css` sets `body { overflow-x: hidden }`, which propagates
 * to the viewport, so the 41px was unreachable, not scrollable. What was inside those 41px
 * included the ends of both honesty disclosures doc 2 §0.4 requires to be readable in the
 * open. `min-w-0` on each article is the whole fix; with it the article is 342px, the
 * `min-w-0 truncate` span already inside `Artefact` finally gets to do the job it was
 * written for, and exactly the two rows that cannot fit ellipsis.
 *
 * This suite has no layout engine — `vitest.config.ts` runs the node environment, and a
 * DOM without layout reports `scrollWidth` 0 for everything, so a case asserting
 * `article.scrollWidth <= article.clientWidth` here would pass on the broken markup as
 * loudly as on the fixed markup. The class is what is asserted instead, because the class
 * is the entire mechanism: it is not a hint or a tuning value, it is the one declaration
 * that lets a grid item narrower than its contents exist at all. The measurements above
 * are the browser evidence, recorded here rather than re-run.
 */
describe("beat 4's panels can be narrower than the strings inside them", () => {
  const html = beat("4 the lifecycle");
  const ARTICLES = [...html.matchAll(/<article[^>]*>/g)].map((m) => m[0]);

  it("renders the four panels this checks", () => {
    expect(ARTICLES).toHaveLength(4);
  });

  it("clears the automatic grid-item min-width on every one of them", () => {
    for (const [i, tag] of ARTICLES.entries())
      expect(
        tag,
        `panel ${i + 1} has no min-w-0, so its min-content width is the floor of its grid track again`,
      ).toMatch(/\bmin-w-0\b/);
  });

  it("leaves the row too long for that column free to ellipsis", () => {
    // The single string that drove the whole overflow. It stays in the markup in full —
    // `title` carries it to a tooltip and a screen reader reads the text node, not the
    // painted box — and the span around it is the one allowed to cut it visually.
    const at = html.indexOf("claude mcp add darkprint -- npx -y darkprint mcp");
    expect(at, "the MCP command is not in the markup").toBeGreaterThan(0);
    const span = html.slice(html.lastIndexOf("<span", at), at);
    expect(span, "the long command's cell cannot shrink").toContain("min-w-0");
    expect(span, "the long command's cell has nothing to cut it with").toContain("truncate");
  });
});

/**
 * The order of beat 4, which is a composition decision and not a copy decision.
 *
 * The panels used to run Connect · Download · Compose · Upload yours, so the sequence
 * opened and closed on a capability that does not exist, and the two amber `Coming soon`
 * pills marking those two were the highest-chroma objects in a viewport that is otherwise
 * void and cyan — the eye reached "not built yet" before it reached "Download". What ships
 * leads now, what does not is grouped under one rule and labelled once, and every word of
 * both disclosures stayed exactly where it was. The last of those three is the one worth a
 * guard: a reorder is precisely the edit during which a sentence goes missing, which is the
 * failure `components/site/honesty.test.ts` exists for and has already caught twice.
 */
describe("beat 4 leads with what ships and states what does not", () => {
  const words = readable(beat("4 the lifecycle"));
  const at = (text: string) => {
    const i = words.indexOf(text);
    expect(i, `\`${text}\` is not in beat 4`).toBeGreaterThan(0);
    return i;
  };

  it("prints both working capabilities before either unbuilt one", () => {
    expect(at("Download")).toBeLessThan(at("Connect"));
    expect(at("Compose")).toBeLessThan(at("Connect"));
    expect(at("Connect")).toBeLessThan(at("Upload yours"));
  });

  it("labels the unbuilt pair once, between the two groups", () => {
    expect(at("Compose")).toBeLessThan(at("Next, and not built yet"));
    expect(at("Next, and not built yet")).toBeLessThan(at("Connect"));
  });

  it("keeps both disclosures verbatim, in the open, beside their panels", () => {
    // Character-for-character, and `/install` carries the first of these two — see the
    // ledger in `components/site/honesty.test.ts`, which holds it there.
    expect(words).toContain(
      "The server is not built yet, so this is what the setup will look like.",
    );
    expect(words).toContain(
      "Nothing leaves the tab, and publishing so other people can find it is not built yet.",
    );
  });
});

/**
 * The three counts, and the sentence that makes them worth printing.
 *
 * `PLATFORM_STATS` counts `content/` at build time, so the figures on beat 5 are the one
 * thing on the landing a reader can check. The line saying so — "Counted off the archive
 * on the last deploy, and nothing here is rounded up" — went out with four paragraphs of
 * prose the beat was right to lose, and it was not one of them: it existed nowhere else on
 * the site afterwards, which leaves three numbers beside a call to action with nothing
 * behind them.
 */
describe("beat 5 says where its numbers come from", () => {
  const words = readable(beat("5 the doors"));

  it("states that the counts are exact", () => {
    expect(words).toContain("nothing here is rounded up");
  });

  it("prints a count to stand behind", () => {
    expect(words).toMatch(/\d+ blueprints/);
    expect(words).toMatch(/\d+ node cards/);
    expect(words).toMatch(/\d+ ontology terms/);
  });

  /**
   * The build door's limit statement, verbatim and in the open.
   *
   * It was the one disclosure on the landing that nothing held. `honesty.test.ts`'s
   * ledger does not carry it — that table is keyed to `/blueprints/...` and `/spec/card`
   * surfaces — and this file checked beat 5's counts but not the sentence that qualifies
   * what the counted route actually ends at. A grep for the words finds them in exactly
   * one source file, `SectionDoors.tsx` itself, which is the state that file's own
   * header describes as how a limit statement leaves the site by accident. It has now
   * left twice.
   *
   * The sentence moved once — it was an orphan under the section, and it is now the second
   * caption inside the door it qualifies — which is precisely the edit during which a
   * sentence goes missing. Its subject moved a second time, when `/build`'s eight-step
   * guided path became one workspace: the noun changed and the limit did not, which is the
   * other way this kind of sentence disappears. Held verbatim, not by paraphrase, and read
   * out of `readable()` so it must be text a reader sees rather than a `title` or an
   * `sr-only`.
   */
  it("states, inside the build door, that /build stops at the download", () => {
    expect(words).toContain(
      "The workspace ends at the download. There is nowhere to publish yet.",
    );
  });
});
