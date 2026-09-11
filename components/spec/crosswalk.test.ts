/* ============================================================
   `/spec/attractor`, held to the constants it claims to render.

   The owner's §11.0 Q20 (b) ruling turned on one property: a page
   rendered from the exporter's own constants cannot go stale, where
   an Attractor clause appended to each field row on `/spec/card`
   would have been a dozen sentences going stale independently. The
   property is worth exactly what a guard makes it worth. A table
   typed into `page.tsx` renders identically to a derived one,
   typechecks, lints, and is wrong the first time somebody teaches
   `emit.ts` a new attribute.

   So this file renders the real page and holds its OUTPUT to the
   constants:

     - every name in `ATTRACTOR_EMITTED_ATTRIBUTES` and
       `DARKPRINT_EMITTED_ATTRIBUTES` appears in the crosswalk;
     - every key of `ATTRACTOR_TYPE_SHAPES`, every shape and every
       handler appears in the type table, and the two synthesised
       boundary kinds with them;
     - every unexpressed name appears, in the right one of the two
       groups;
     - the spec pin is printed;
     - the classes are computed by `attractorClassesFor` and not by
       a hand-written example.

   A render, not a source scan. A scan for `ATTRACTOR_TYPE_SHAPES`
   would pass on a page that imports the constant and prints a
   literal beside it, which is precisely the failure the ruling
   names. Rendering is also what catches `crosswalk()`'s throw: a
   name the emitter writes and this file has no row for stops the
   page rather than shrinking a table nobody is counting.

   The page is a server component, and a synchronous one: every read
   it makes is the memoized archive read the other spec pages
   already do at build. `renderToStaticMarkup` is therefore enough,
   the same way `spec-routes.test.ts` renders `SpecPager`.

   `environment: "node"`, no DOM.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allNodeCards, getOntologyView } from "@/lib/content";
import {
  ATTRACTOR_EMITTED_ATTRIBUTES,
  ATTRACTOR_ENTRY_KIND,
  ATTRACTOR_EXIT_KIND,
  ATTRACTOR_RESERVED,
  ATTRACTOR_TYPE_SHAPES,
  ATTRACTOR_UNEXPRESSED_ATTRIBUTES,
  DARKPRINT_EMITTED_ATTRIBUTES,
  attractorClassesFor,
  attractorKindFor,
  isReserved,
} from "@/lib/core";
import {
  ATTRACTOR_DEFAULTING_ATTRIBUTES,
  ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES,
  ATTRACTOR_REQUIRED_ATTRIBUTES,
} from "@/lib/core/attractor/emit";
import { ATTRACTOR_SPEC_PIN } from "@/lib/core/attractor/reserved";

import SpecAttractorPage from "@/app/spec/attractor/page";
import { CROSSWALK_SCOPES, crosswalk, emittedIn } from "./crosswalk";
import { SPEC_CROSSWALK } from "./sequence";

/**
 * The page, rendered once and lazily.
 *
 * Lazily is the load-bearing half. `crosswalk()` throws on an emitted attribute it has no
 * row for, which is the mechanism this whole file is about, and a render at module scope
 * turns that throw into a COLLECTION failure: vitest then reports the file as failed with
 * every case in it absent, and the run's own "Tests N passed (N)" line drops by eighteen
 * without a single red assertion to say why. Called from inside each case, the same throw
 * reds the cases and the count stays honest.
 *
 * Memoized because the page reads the archive and eighteen renders of it is eighteen walks
 * over every card for nothing.
 */
let rendered: string | undefined;
function html(): string {
  if (rendered === undefined) rendered = renderToStaticMarkup(createElement(SpecAttractorPage));
  return rendered;
}

/**
 * The rendered text with tags removed and entities un-escaped, for the assertions that
 * are about a sentence rather than about markup.
 *
 * A rendered sentence hides three ways: a line wrap, a tag in the middle of it, and an
 * attribute that carries the same words. So a check on the raw HTML for a phrase this page
 * splits across two `<code>` elements would report absent for text that is plainly on the
 * screen. Tags out first, then the entities React writes for `&`, `<`, `>` and the two
 * quote characters, then whitespace collapsed.
 */
function text(): string {
  return html()
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");
}

describe("the crosswalk is the emitter's own list", () => {
  /**
   * The completeness property, from the emitter's end.
   *
   * `crosswalk()` walks the two emitted lists and throws on a name it has no row for, so
   * this case is green by construction TODAY and is the case that fails the day somebody
   * teaches `emit.ts` a new attribute without touching this page. Asserted anyway rather
   * than left to the throw, because the throw only fires when something renders the page,
   * and a table that stopped being rendered is exactly the regression in question.
   */
  it("carries a row for every attribute the exporter can write, and no others", () => {
    for (const scope of CROSSWALK_SCOPES) {
      expect(crosswalk(scope).map((entry) => entry.attribute)).toEqual(emittedIn(scope));
    }
  });

  it("orders each table the way the exporter writes the file", () => {
    // Attractor's own names first, then the two DarkPrint parks beside them, which is
    // both the order `emit.ts` pushes attributes in and the order a reader meets them.
    expect(crosswalk("node").map((entry) => entry.attribute)).toEqual([
      ...ATTRACTOR_EMITTED_ATTRIBUTES.node,
      ...DARKPRINT_EMITTED_ATTRIBUTES.node,
    ]);
  });

  /**
   * The reserved column is asked of `isReserved`, not stored.
   *
   * Both directions, because the interesting answer is the negative one: `card` and
   * `dp_node` are the whole compatibility claim, and a page that hard-coded "not reserved"
   * would keep saying it on the day Attractor reserves one of them.
   */
  it("asks the reserved sets rather than carrying a copy of the answer", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const entry of crosswalk(scope)) {
        expect(entry.reserved, `${scope}:${entry.attribute}`).toBe(
          isReserved(scope, entry.attribute),
        );
      }
    }
    for (const name of ATTRACTOR_EMITTED_ATTRIBUTES.node) {
      expect(isReserved("node", name), `${name} is emitted with Attractor's meaning`).toBe(true);
    }
    for (const name of DARKPRINT_EMITTED_ATTRIBUTES.node) {
      expect(isReserved("node", name), `${name} would configure a run`).toBe(false);
    }
  });

  /** Every claim on the page names the sections it rests on. A row with none is a claim
      nobody can check, which on this page is the one thing that must never ship. */
  it("cites a spec section on every row", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const entry of crosswalk(scope)) {
        expect(entry.sections.length, `${scope}:${entry.attribute} cites nothing`).toBeGreaterThan(
          0,
        );
        expect(entry.reads.trim(), `${scope}:${entry.attribute} says nothing`).not.toBe("");
      }
    }
  });

  /**
   * A `§` in a row's prose has to be one of the sections that row cites.
   *
   * The failure this catches is a sentence that grew a second citation while the column
   * beside it kept the first: a reader checking the page against their own copy of the
   * spec follows the column, and a section named only in the prose is one they never
   * open. Appendix references are exempted by shape, since they carry no number.
   */
  it("cites, in the column, every section its own prose names", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const entry of crosswalk(scope)) {
        const cited = new Set(entry.sections);
        const spoken = [...`${entry.reads} ${entry.origin} ${entry.absent ?? ""}`.matchAll(
          /§(\d+(?:\.\d+)*)/g,
        )].map((match) => match[1]);
        for (const section of spoken) {
          expect(cited.has(section), `${scope}:${entry.attribute} names §${section} in prose only`)
            .toBe(true);
        }
      }
    }
  });

  /* The house rule about shipped copy, applied to the strings this file ships. An em dash
     used as a pause is the tell the owner has named four times, and every string below is
     rendered to a reader rather than read by a developer. */
  it("writes no em dash into the copy it renders", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const entry of crosswalk(scope)) {
        const copy = `${entry.reads} ${entry.origin} ${entry.absent ?? ""}`;
        expect(copy, `${scope}:${entry.attribute}`).not.toContain("—");
      }
    }
  });
});

describe("the page renders those constants and not a transcription", () => {
  it("prints every attribute the exporter can write", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const name of emittedIn(scope)) {
        expect(text(), `${scope}:${name} is missing from the page`).toContain(name);
      }
    }
  });

  /**
   * The type table, from all three columns.
   *
   * Every key, every shape and every handler. The shapes are the half a reader checks
   * against §2.8 and the handlers are the half they check against §4, so a page that
   * printed two of the three columns would be a table nobody could verify.
   */
  it("prints every type, shape and handler in the mapping table", () => {
    for (const [type, kind] of Object.entries(ATTRACTOR_TYPE_SHAPES)) {
      expect(text(), `type ${type}`).toContain(type);
      expect(text(), `shape ${kind.shape}`).toContain(kind.shape);
      expect(text(), `handler ${kind.handler}`).toContain(kind.handler);
    }
    // The two synthesised nodes, which come from no card and are what makes the compiled
    // file satisfy §7.2's `start_node` and `terminal_node`.
    for (const kind of [ATTRACTOR_ENTRY_KIND, ATTRACTOR_EXIT_KIND]) {
      expect(text()).toContain(kind.shape);
      expect(text()).toContain(kind.handler);
    }
  });

  /**
   * The rows the brief singles out, because each one was wrong on this site before.
   *
   * `tool` maps to `box`/`codergen` and `shell-tool` is what maps to `parallelogram`. A
   * page still carrying the old row would print `tool` beside `parallelogram`, and the
   * assertion below is what that would trip: the two are checked as a pair rather than as
   * two independent memberships, so swapping them back fails.
   */
  it("maps tool to the codergen handler and shell-tool to the tool handler", () => {
    expect(ATTRACTOR_TYPE_SHAPES.tool).toEqual({ shape: "box", handler: "codergen" });
    expect(ATTRACTOR_TYPE_SHAPES["shell-tool"]).toEqual({
      shape: "parallelogram",
      handler: "tool",
    });
    /* And the page says so in prose as well as in the table, since a reader who knows the
       spec arrives expecting the other answer and a table alone reads as a typo.

       Pinned as two sentences rather than as a proximity regex. `/tool[\s\S]{0,400}
       parallelogram/` was the first attempt and it is satisfied by the table alone, which
       prints both words fourteen lines apart: a window wide enough to span the prose is
       wide enough to span the thing the prose exists to explain. */
    expect(text()).toContain("maps to box and");
    expect(text()).toContain("The type that maps to parallelogram is shell-tool");
  });

  /**
   * The two groups, read out of the two lists that draw them and not off the whole page.
   *
   * This case asserted `toContain` over the rendered text and reddened nothing when the
   * entire "read bare" column was emptied: both names in it are also printed by the
   * `ATTRACTOR_REQUIRED_ATTRIBUTES` sentence a few lines below, so the strings were still
   * on the page with the disclosure gone. Found by mutation, and it is the failure a
   * membership check always has — a name appearing SOMEWHERE is not a name appearing in
   * the right one of two lists, and the right one is the entire point of the split.
   *
   * So each group is sliced out of its own `<dl>` by id, and both directions are held: a
   * name in the group must be in that list, and a name from the other group must not.
   */
  it("prints every unexpressed name, in the group the constants put it in", () => {
    const groups = [
      { id: "unexpressed-defaulting", names: ATTRACTOR_DEFAULTING_ATTRIBUTES },
      { id: "unexpressed-handler-needed", names: ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES },
    ] as const;

    for (const group of groups) {
      const opens = html().indexOf(`id="${group.id}"`);
      expect(opens, `the page draws no list with id ${group.id}`).toBeGreaterThan(-1);
      // No `<dl>` nests inside another here, so the first closing tag after the id ends it.
      const closes = html().indexOf("</dl>", opens);
      expect(closes, `${group.id} is never closed`).toBeGreaterThan(opens);
      const list = html().slice(opens, closes);

      const other = group.id === "unexpressed-defaulting" ? groups[1] : groups[0];
      for (const scope of CROSSWALK_SCOPES) {
        for (const name of group.names[scope]) {
          expect(list, `${scope}:${name} is missing from ${group.id}`).toContain(name);
        }
        for (const name of other.names[scope]) {
          /* A name may legitimately be a substring of another (`retry_target` inside
             `fallback_retry_target`), so the wrong-list direction is asked of the list's
             own comma-joined text rather than of a bare `toContain`. */
          const printed = list.split(/[,<>\s]+/);
          expect(printed, `${scope}:${name} is in the wrong group`).not.toContain(name);
        }
      }
    }

    // And the two groups are a partition of the third list, which is what `emit.ts`
    // derives them to be. A name in both, or in neither, would print a page that is
    // internally consistent and wrong about what a blueprint cannot say.
    for (const scope of CROSSWALK_SCOPES) {
      const defaulting = new Set(ATTRACTOR_DEFAULTING_ATTRIBUTES[scope]);
      const needed = new Set(ATTRACTOR_HANDLER_NEEDED_ATTRIBUTES[scope]);
      for (const name of needed) expect(defaulting.has(name), name).toBe(false);
      expect([...defaulting, ...needed].sort()).toEqual(
        [...ATTRACTOR_UNEXPRESSED_ATTRIBUTES[scope]].sort(),
      );
    }
  });

  /** The three names §4.10, §6.5 and §4.11 read bare, named on the page with their scope. */
  it("names the three attributes a handler reads with no default", () => {
    for (const scope of CROSSWALK_SCOPES) {
      for (const name of ATTRACTOR_REQUIRED_ATTRIBUTES[scope]) {
        expect(text(), `${name} is read bare and unnamed on the page`).toContain(name);
      }
    }
    // `tool_command` is the one that left this group when the exporter learned to write
    // it, and the page tells that story. It is emitted, so it is NOT unexpressed.
    expect(ATTRACTOR_UNEXPRESSED_ATTRIBUTES.node).not.toContain("tool_command");
    expect(ATTRACTOR_EMITTED_ATTRIBUTES.node).toContain("tool_command");
  });

  /**
   * The pin, printed rather than described.
   *
   * An undated compatibility claim has no shelf life and no other surface on this site
   * names the document. The digest is the value a reader can check by hand against
   * `git hash-object` or the GitHub contents API, so it is the one that has to be on the
   * page rather than only the date beside it.
   */
  it("prints the revision of the specification these tables were checked against", () => {
    expect(text()).toContain(ATTRACTOR_SPEC_PIN.sha256);
    expect(text()).toContain(ATTRACTOR_SPEC_PIN.upstreamCommit);
    expect(text()).toContain(ATTRACTOR_SPEC_PIN.verifiedOn);
    expect(text()).toContain(ATTRACTOR_SPEC_PIN.bytes);
    expect(html()).toContain(ATTRACTOR_SPEC_PIN.rawUrl);
  });

  /**
   * The worked cards, computed by the exporter's own two functions.
   *
   * Recomputed here from the archive rather than compared against a remembered string, so
   * the case says "the page shows what `attractorClassesFor` returns" and not "the page
   * shows dp-agent". A page that printed a hand-written class list would pass a membership
   * check on `dp-` and fail this one the moment a card's phases moved.
   */
  it("computes each example card's classes with attractorClassesFor", () => {
    const view = getOntologyView();
    const shown = new Set<string>();
    for (const record of allNodeCards()) {
      const shape = attractorKindFor(record.card.type, view).shape;
      if (shown.has(shape)) continue;
      shown.add(shape);
      const classes = attractorClassesFor(record.card, view);
      expect(text(), `${record.ref} is the archive's first ${shape} card`).toContain(record.ref);
      expect(text(), `${record.ref} classes`).toContain(classes.join(","));
      for (const name of classes) expect(name.startsWith("dp-"), name).toBe(true);
    }
    // The figure is one row per shape the type table can produce, not one per card.
    const shapes = new Set(Object.values(ATTRACTOR_TYPE_SHAPES).map((kind) => kind.shape));
    expect(shown.size).toBeGreaterThan(0);
    expect(shown.size).toBeLessThanOrEqual(shapes.size);
  });

  /**
   * §2.10's collision, which is the whole reason the prefix exists, stated on the page.
   *
   * Named as a case of its own because it is the claim a reader is most likely to arrive
   * disagreeing with: they know `class` and they know subgraphs, and nothing in the spec
   * tells them the two derivations can collide.
   */
  it("says why the prefix is there rather than only that it is", () => {
    expect(text()).toContain("2.10");
    expect(text()).toContain("subgraph");
    expect(text()).toContain("model_stylesheet");
    // §8's stylesheet is what targets the classes, and a page that explained the prefix
    // without naming what reads it would have explained a cost with no benefit beside it.
    expect(text()).toMatch(/8\.2|8\.3/);
  });

  /**
   * The sentence `/spec/topology` already carries, in the same words.
   *
   * Two pages saying nearly the same thing about the same artefact is how a reader ends up
   * unsure which one is right, so the claim is asserted verbatim against the other page's
   * copy rather than paraphrased here.
   */
  it("says a topology is not a pipeline, the way /spec/topology says it", () => {
    expect(text()).toContain("A topology on its own is not a pipeline.");
    expect(text()).toContain("darkprint export <dir> --attractor");
    // And the refusal is attributed to the rules that produce it rather than asserted.
    expect(text()).toContain("start_node");
    expect(text()).toContain("terminal_node");
    expect(text()).toContain("7.2");
  });

  /** Every reserved name the page counts is a name the reserved sets carry. */
  it("counts the reserved names off the reserved sets", () => {
    const total = CROSSWALK_SCOPES.reduce(
      (sum, scope) => sum + ATTRACTOR_RESERVED[scope].length,
      0,
    );
    expect(text()).toContain(String(total));
  });
});

describe("the stop the page is reached through", () => {
  it("is in the specification run, with sections the page really declares", () => {
    expect(SPEC_CROSSWALK.href).toBe("/spec/attractor");
    expect(SPEC_CROSSWALK.run).toBe("specification");
    for (const section of SPEC_CROSSWALK.sections) {
      /* Both halves. A rail row pointing at an id nothing declares scrolls nowhere, and an
         id declared without `scroll-mt-24` lands under the sticky header — which reads to
         a user as the same defect. `components/site/anchors.test.ts` cannot see either of
         these: it walks the tree for a declaring `id="…"` and finds one on whichever route
         declares it, and these ids are built by the rail as `${href}#${id}` rather than
         written as a link literal. */
      expect(html(), `#${section.id} is in the rail and not on the page`).toContain(
        `id="${section.id}"`,
      );
      expect(html()).toMatch(new RegExp(`id="${section.id}"[^>]*scroll-mt-24`));
    }
  });

  it("does not claim to be a fourth layer", () => {
    // `SPEC_LAYERS` feeds the three doors on `/what-a-blueprint-is` and the "Layer 0n of
    // 03" eyebrows. A blueprint is three files; this stop describes what happens to them.
    expect(SPEC_CROSSWALK.eyebrow).not.toMatch(/Layer/);
    expect("format" in SPEC_CROSSWALK).toBe(false);
  });
});
