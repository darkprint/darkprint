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
import { MCP_CONNECT_COMMAND } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";

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

  /**
   * This case used to read "says the CLI setup is not live yet", and asserted the chip
   * printed `npx darkprint setup` AND "coming soon". Both halves were inverted when the
   * chip's string changed: the landing's only command used to be a command that does not
   * exist, wearing the badge doc 2 §0.4 requires of an invented one, and it became the one
   * that installs the blueprint-writing skill, which runs today.
   *
   * The beat prints TWO commands as of 2026-08-07 — one per half of setup, after the
   * author split `/install` — and exactly one of them runs. So "prints one command" is no
   * longer the invariant, and the hero-wide `not.toContain("coming soon")` that guarded it
   * is now false by design.
   *
   * What replaces it is deliberately NOT a weaker version of the same check. Per-chip
   * placement is held at the element, in `components/hero/Wordmark.test.ts`, which slices
   * each anchor out of the markup and holds each to its own rule. This file keeps the two
   * things that are genuinely properties of the whole landing: both commands are readable
   * text here, and the invented binary never comes back. Duplicating the placement check
   * over flat landing text would only assert that a badge exists SOMEWHERE, which is the
   * assertion that would pass on the day the badge lands on the wrong chip.
   */
  it("prints both setup commands as readable text", () => {
    const words = readable(html).toLowerCase();
    expect(words).toContain(SKILL_INSTALL_COMMAND.toLowerCase());
    expect(words).toContain(MCP_CONNECT_COMMAND.toLowerCase());
  });

  it("never re-invents the binary that does not exist", () => {
    expect(readable(html).toLowerCase()).not.toContain("npx darkprint setup");
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

  /**
   * Beat 2 shows the real DOT, and shows it without its comments.
   *
   * The rule above forbids a code block on every beat and still does — the listing beat 2
   * grew on 2026-08-08 is `DotBreakdown`, the panel `/spec/topology` uses, and it draws its
   * lines as rows rather than as a `<pre>`. So nothing was exempted; what needed adding was
   * the other direction, because two claims about that listing are now load-bearing and
   * neither is obvious from reading the component.
   *
   * The author asked for the file itself ("to give to the user the intuition how it is
   * defined") and then for its comments out ("I want to just give the user the intuition of
   * what's behind the graphics"). The archive's file argues doc 2 §5.2, §5.4 and §5.5 in six
   * comment lines — why the planner does not reach the builder, what `criteria-leak` would
   * cost, why the loop never returns to the builder. Those lines stay in the file and stay
   * on `/spec/topology`, where a reader is studying the notation. A listing here that
   * quietly grew them back would be the argument arriving before the shape.
   */
  it("shows the archive's own DOT on beat 2, with its comments taken out", async () => {
    const words = readable(beat("2 the blueprint"));
    const { bundleSource } = await import("@/lib/content");
    const dot = bundleSource("starter-software-factory").dot;

    /* Compared with every space removed, and `&gt;` resolved, because `DotBreakdown`
       tokenizes a line into one span per token: `rankdir=LR;` reaches `readable()` as
       `rankdir = LR ;`. Whitespace is exactly what the renderer is entitled to change and
       the characters are exactly what it is not, so the comparison drops the first and
       keeps the second. */
    const squeeze = (text: string) => text.replace(/&gt;/g, ">").replace(/\s+/g, "");
    const shown = squeeze(words);

    const line = (l: string) => l.trim();
    const statements = dot.split("\n").map(line).filter((l) => l.length > 0 && !l.startsWith("//"));
    expect(statements.length, "the starter DOT has no statements").toBeGreaterThan(5);
    for (const statement of statements) {
      expect(shown, `the listing is missing \`${statement}\``).toContain(squeeze(statement));
    }

    const comments = dot.split("\n").map(line).filter((l) => l.startsWith("//"));
    expect(comments.length, "the starter DOT carries no comments to strip").toBeGreaterThan(0);
    for (const comment of comments) {
      const prose = comment.replace(/^\/\/\s*/, "");
      expect(shown, `a comment came back: \`${prose}\``).not.toContain(squeeze(prose));
    }
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

describe("beat 4's marks carry no information a screen reader needs", () => {
  /**
   * The opposite property from the describe block above, and just as load-bearing. A
   * `FlowNode` earns a focus stop because it is the only place its meaning lives; these
   * characters are not — `PanelHeading` already names "Download", "Connect" and "Upload
   * yours" in real text next to each one, so a glyph that also grabbed a tab stop would
   * announce nothing a screen reader has not already been told, once per panel, for no
   * reason. `aria-hidden="true"` is what keeps it out of that tree, and this is the
   * test that would fail if a future edit dropped it — the accessibility bug this file
   * has caught before ran in the direction of forgetting a name; a glyph that forgot to
   * hide itself would be the same bug from the other side.
   */
  it("marks all three ⇄ ↓ ↑ as decorative", () => {
    /* Three: `⋈` left with the Compose panel, which is a hint under Download now rather
       than a numbered step of its own (`SectionLifecycle`'s header). The marks also moved
       out of a 144px box each and onto the heading's own line, so what this reads is the
       mark's own opening tag rather than a wrapper — `lastIndexOf("<", at)` lands on the
       `<span>` the character sits directly inside, which is where `Mark` puts the
       attribute, and it keeps passing regardless of what element ends up around it. */
    const html = beat("4 the lifecycle");
    for (const mark of ["⇄", "↓", "↑"]) {
      const at = html.indexOf(`>${mark}<`);
      expect(at, `${mark} is not in the markup`).toBeGreaterThan(0);
      const tag = html.slice(html.lastIndexOf("<", at), at);
      expect(tag, `${mark}'s own element does not carry aria-hidden`).toContain(
        'aria-hidden="true"',
      );
    }
  });

  it("carries the panel titles as real, visible text instead", () => {
    const html = beat("4 the lifecycle");
    for (const title of ["Connect", "Download", "Upload yours"])
      expect(html).toContain(title);
  });
});

/**
 * Beat 4's panels, and the 342px column they have to survive.
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
    /* Three since Compose became a hint inside Download rather than a peer beside it, and
       four since 2026-08-07, when the author asked for a Teaching panel about the DarkPrint
       skill. The count is asserted at all so the two cases under it cannot pass by walking
       an empty list, and it is asserted exactly so a panel quietly reappearing — the shape
       this section has changed three times now — has to come past this file. */
    expect(ARTICLES).toHaveLength(4);
  });

  it("clears the automatic grid-item min-width on every one of them", () => {
    for (const [i, tag] of ARTICLES.entries())
      expect(
        tag,
        `panel ${i + 1} has no min-w-0, so its min-content width is the floor of its grid track again`,
      ).toMatch(/\bmin-w-0\b/);
  });

  /* A third case stood here: "leaves the row too long for that column free to ellipsis".
     It held the one string that drove the whole overflow — `claude mcp add darkprint --
     npx -y darkprint mcp`, 331px of monospace in a 342px track — to a `min-w-0 truncate`
     span that could cut it.

     The author asked the Connect panel's monospace box out on 2026-08-08 and the string
     went with it. Nothing in beat 4 is an unbreakable run of text now: what replaced the
     three boxes is a folder, two drawings and prose, and prose wraps.

     The case above it is the one that mattered anyway and it is untouched — every panel
     still has to clear its automatic grid-item minimum, because that is a property of the
     LAYOUT rather than of any one string, and it is what stops the next long thing from
     setting a floor. If a monospace row returns to these panels, this case returns with
     it. */
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

  it("prints what ships before either unbuilt one", () => {
    // Compose is a hint inside the Download panel now rather than a peer beside it, so it
    // is still one of the two things a reader can do today and still ahead of both — the
    // demotion changed its rank, not its side of the rule.
    expect(at("Download")).toBeLessThan(at("Connect"));
    expect(at("Compose")).toBeLessThan(at("Connect"));
    expect(at("Connect")).toBeLessThan(at("Upload yours"));
  });

  it("labels the unbuilt pair once, between the two groups", () => {
    expect(at("Compose")).toBeLessThan(at("Next, and not built yet"));
    expect(at("Next, and not built yet")).toBeLessThan(at("Connect"));
  });

  it("keeps both disclosures verbatim, in the open, beside their panels", () => {
    // Character-for-character, and `/mcp` carries the first of these two as its lead — see the
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
 * The Download panel lists the folder that actually downloads.
 *
 * The panel opened on `factory.dot`, and the author's verdict was that the name is
 * meaningless to a reader who has not already met Attractor: "a generic folder should be
 * composed by a blueprint.dot and a list of yaml node cards and the README.md and
 * AGENTS.md". What makes this worth a test rather than a careful edit is that the listing
 * is a claim about bytes on disk — a folder drawn on the landing that does not match the
 * folder `public/bundles/<slug>/` hands over is the same class of error as a missing
 * disclaimer, and it fails silently in both directions: a file could leave the bundle
 * generator, or a name could be retyped here.
 *
 * So the four names the author asked for are read out of the rendered panel. Whether those
 * names are the real ones was checked against `public/bundles/` when the listing was
 * written — all nine bundles hold `blueprint.dot`, `factory.dot`, `cards/`, `README.md` and
 * `AGENTS.md`, and in all nine the card count equals the number of nodes carrying a `card=`
 * pin — and `SectionLifecycle`'s header records that check. What this file adds is the part
 * that keeps running: the names stay, and the panel does not drift back to leading with the
 * compiled artefact.
 */
describe("beat 4 lists the folder a reader actually downloads", () => {
  const words = readable(beat("4 the lifecycle"));

  it("names the graph, the cards, and the two documents", () => {
    for (const file of ["blueprint.dot", "cards/", "README.md", "AGENTS.md"])
      expect(words, `${file} is not in the download panel`).toContain(file);
  });

  it("does not name the compiled file at all", () => {
    // This assertion is the inverse of the one it replaces, and the reversal is the
    // author's: "in home avoid the use of factory.dot use instead blueprint.dot".
    //
    // The previous pass had kept `factory.dot` named once in the prose on the reasoning
    // that it is genuinely in the folder and is the file that runs. Both facts still hold
    // — they are just no longer this page's job to carry. `/blueprints/[slug]`'s download
    // panel names it, which is where a reader is actually taking the folder away.
    //
    // What the landing shows instead is what the registry STORES: `blueprint.dot`, the
    // graph with its card pins, which is what the digest is taken over.
    expect(words).not.toContain("factory.dot");
    expect(words).toContain("blueprint.dot");
  });
});

/**
 * Compose survived being demoted from a panel to a hint.
 *
 * The author asked for it as "a hint not a per se box", and a demotion is exactly the edit
 * during which a claim turns into a mood: the sentence gets shortened to fit a smaller
 * slot, or slides down the page and ends up under the "not built yet" rule, where a reader
 * files it with the two capabilities that do not exist. It is neither. Composing is a
 * property of the DOT format and it is true today with a text editor and nothing else.
 *
 * Both halves are asserted — the words, and the position — because either one alone passes
 * on the failure the other describes.
 */
describe("beat 4 keeps the compose claim, as a hint inside Download", () => {
  const words = readable(beat("4 the lifecycle"));

  it("still says what composing is and that it is a property of the format", () => {
    // Read around the two typographic apostrophes rather than through them: the source
    // writes `&rsquo;`, React emits the character itself, and `readable()` only undoes the
    // five entities React escapes. A test that spelled them ASCII would fail on correct
    // markup, which is the worst kind of guard to leave behind.
    expect(words).toContain("A DOT file is text.");
    expect(words).toContain("Wire one graph");
    expect(words).toContain("exit into another");
    expect(words).toContain("drop a card into a pipeline");
  });

  it("keeps it above the unbuilt rule, where what ships is", () => {
    const compose = words.indexOf("A DOT file is text.");
    const rule = words.indexOf("Next, and not built yet");
    expect(compose, "the compose hint is not in beat 4").toBeGreaterThan(0);
    expect(rule, "the unbuilt rule is not in beat 4").toBeGreaterThan(0);
    expect(compose).toBeLessThan(rule);
  });

  it("is no longer a panel of its own", () => {
    // The whole point of the demotion, and it cannot be checked by searching for the word:
    // the hint is tagged `Compose`, so the string is still in the markup and should be.
    // What a panel has and a hint does not is a `PanelHeading` — an `<h3>` in the document
    // outline — and the `⋈` mark that ranked it as a step.
    const html = beat("4 the lifecycle");
    expect(html).not.toMatch(/<h3[^>]*>Compose</);
    expect(html).not.toContain("⋈");
  });
});

/**
 * What uploading is FOR, and the fact that none of it works yet.
 *
 * The author: "the Upload box should stress that if uploaded, you can get feedback for the
 * blueprint you proposed by other users." That is the motive the panel was missing, and it
 * is also the single largest honesty risk this section has ever carried — it describes a
 * readership, on a site with no backend, no publishing and no users to review anything. It
 * ships wearing `ComingSoonBadge`, which is what `components/site/honesty.test.ts` holds
 * the sentence of; this checks the marker is on the surface beside it, because the ledger
 * reads text and a sentence can lose its badge without losing a word.
 */
describe("beat 4 frames the feedback as what upload is for, not as a feature", () => {
  const html = beat("4 the lifecycle");
  const words = readable(html);

  it("says the feedback is what publishing would be for", () => {
    expect(words).toContain("other people can open the blueprint you proposed");
    expect(words).toContain("tell you where it does not hold");
  });

  it("opens that sentence on the limit rather than closing on it", () => {
    // A reader who stops after the first three words has still been told. "Not built yet:"
    // plus a noun phrase is the form `AgentHandoff` and `DownloadStep` use for the same
    // job, and the clause after it stays conditional — "Once a bundle can be published" —
    // so no part of the sentence can be read in the present tense.
    expect(words).toContain("Not built yet: the second reader.");
    expect(words).toContain("Once a bundle can be published");
  });

  it("wears the badge, on the one claim in this section that needs it", () => {
    expect(words).toContain("Coming soon");
  });
});

/* A whole describe stood here — "beat 5 says where its numbers come from" — with three
   cases: that the counts are exact, that a count is printed to stand behind, and that the
   build door states `/build` stops at the download. The author asked all three lines off
   beat 5 on 2026-08-07 and the cases come out with them.

   The third is the one worth recording. Its own docblock said the sentence had left this
   site by accident TWICE — once as an orphan under the section, once when `/build`'s
   eight-step path became a workspace and the noun changed while the limit did not — which
   is exactly why deleting it now needs a reason rather than a diff.

   The reason: the claim it qualified went out in the same edit. The build door printed
   "Three choices, and a blueprint that downloads to your machine"; it prints a title and a
   control now and promises nothing, so there is nothing left to refuse. The refusal itself
   is unchanged where a reader can act on it — `DownloadPanel` on `/build` ends on "there is
   nowhere to save this yet", and that route's `metadata.description` carries it for anyone
   who never opens the page.

   The counts went the same way: `PLATFORM_STATS` still counts `content/` at build time and
   nothing on the landing reads it, so "nothing here is rounded up" was vouching for figures
   that are no longer printed. If either returns to beat 5, its case returns with it. */
