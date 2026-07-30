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

  it("reaches the archive from the landing at all", () => {
    // A regex that matched nothing would pass every case above. The landing is required
    // to open at least one blueprint and one card, which is beats 2 and 3 by definition.
    const all = BEATS.flatMap(([name]) =>
      [...beat(name).matchAll(/href="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(all.some((href) => href.startsWith("/blueprints/"))).toBe(true);
    expect(all.some((href) => href.startsWith("/nodes/"))).toBe(true);
  });
});

describe("every figure on the landing is reachable without a pointer", () => {
  // Beat 4 held to this contract while its three panels were `FlowScene` drawings. It
  // has none left (this file's own header, and `SectionLifecycle`'s in full): the author's
  // second verdict took the luminous-flow register itself off this beat, and what
  // replaced it is checked in its own describe block below rather than here.
  it.each(["2 the blueprint", "3 the card"])(
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

  it.each(["2 the blueprint", "3 the card"])(
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
  it("marks all three ↓ ⋈ ↑ as decorative", () => {
    const html = beat("4 the lifecycle");
    for (const mark of ["↓", "⋈", "↑"]) {
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
    for (const title of ["Download", "Compose", "Upload yours"]) expect(html).toContain(title);
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
});
