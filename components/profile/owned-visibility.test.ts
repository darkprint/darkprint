/* ============================================================
   Who can see a blueprint, on the one list the owner is told to change it from.

   The owner, 2026-09-06: "remove the panel visibility from the blueprint card; such option
   should be visible only on the user account list of the blueprints". The removal shipped
   and the second half did not, so for one wave an owner with a published bundle had no
   visibility control on any page of the site. `components/bundle/Aside.tsx`'s own header
   records the same gap from the other side.

   ── Why the render, and not a source read ──
   The list draws a row in ONE of TWO shapes (`OwnedBundles.tsx`'s docblock argues the
   split), and the shape is chosen at the map, per row, from `releaseCount` and whether
   `content/` carries the slug. A cell that reads the file for a call site cannot tell which
   branch it landed in — and it is the second branch, the published-and-archived one, that
   lost the control. So both rows are rendered together and the markup is counted.

   `renderToStaticMarkup` is the idiom `components/bundle/bundle-header-actions.test.ts`
   already uses on a component of this shape, and nothing here needs a DOM: what is asserted
   is the control's presence, its accessible name and which segment the server's value
   pressed, all of which are in the first paint.

   ── One thing here is NOT guarded, and saying so is cheaper than implying it is ──
   `RowVisibility` also asks the router to re-read the shelf once the server accepts a
   change, which is what keeps the heading counts and the row's private markings from
   disagreeing with the segment that was just pressed. Nothing below can see that: it needs
   a click and a resolved `fetch`, and this suite runs with no DOM (`vitest.config.ts` sets
   `environment: "node"` and no DOM package is installed). Mutating that call away reddens
   none of the eight cells. It is one line under `tsc`, and a real cell for it is owed.

   ── The address is pinned separately ──
   `api` reaches `fetch` and never reaches the markup, so no render can see it. It is built
   in one place for the whole shelf (`visibilityApi`) and that place is pinned by its own
   cell below; the per-row argument is pinned by the accessible name, which is built from the
   same slug on the line beside it.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { allBlueprints } from "@/lib/content";
import type { OwnedBundleSummary } from "@/lib/server/registry";
import { OwnedBundles, visibilityApi, type OwnedRow } from "./OwnedBundles";

/* `DeleteBundleControl` reads `useRouter()` at render time and the app router context only
   exists inside a Next request, so an owner's row throws on the way in without this. The
   stub answers `refresh` and nothing else, which is the whole of what this tree calls. */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

/** A real archive entry, so the released row takes the branch that draws a `ContentRow`. */
const PUBLISHED = allBlueprints()[0];
const HANDLE = PUBLISHED.author.username;

function summaryOf(over: Partial<OwnedBundleSummary> & { slug: string }): OwnedBundleSummary {
  return {
    visibility: "public",
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    releaseCount: 1,
    ...over,
  };
}

/** Released, public, and present in `content/`: the row shape that lost its control. */
const ARCHIVED: OwnedRow = {
  summary: summaryOf({
    slug: PUBLISHED.slug,
    title: PUBLISHED.title,
    visibility: "public",
    currentVersion: "1.2.0",
    digest: "3f1c9a0b6d21",
    nodeCount: PUBLISHED.graph.nodes.length,
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
  }),
  blueprint: PUBLISHED,
};

/** Zero releases and private: the row shape that kept one. */
const DRAFT: OwnedRow = {
  summary: summaryOf({
    slug: "kiln-line",
    title: "Kiln line",
    summary: "A private draft with no release yet.",
    visibility: "private",
    releaseCount: 0,
  }),
};

function shelf(owner: boolean): string {
  return renderToStaticMarkup(
    createElement(OwnedBundles, { rows: [ARCHIVED, DRAFT], owner, ownerHandle: HANDLE }),
  );
}

const OWNED = shelf(true);

/** Every row that offers a control, in the order the shelf draws them. */
function labelled(html: string): string[] {
  return [...html.matchAll(/aria-label="Visibility of ([^"]+)"/g)].map((m) => m[1]);
}

/**
 * The slice of markup belonging to one row's control.
 *
 * Cut at the NEXT control rather than read as a fixed window: two rows put two identical
 * segment pairs in the document, and a window that overran would let one row's pressed
 * state answer for the other — the same collision `bundle-header-actions.test.ts` records
 * against a bare `Star`.
 */
function control(html: string, slug: string): string {
  const start = html.indexOf(`aria-label="Visibility of ${slug}"`);
  expect(start, `no visibility control on the row for ${slug}`).toBeGreaterThan(-1);
  const rest = html.slice(start + 1);
  const next = rest.indexOf('aria-label="Visibility of ');
  return next === -1 ? rest : rest.slice(0, next);
}

/** Which segment the markup says is chosen, read off the pressed state rather than a class. */
function pressed(segment: string): string[] {
  return [...segment.matchAll(/aria-pressed="true"[^>]*>([a-z]+)</g)].map((m) => m[1]);
}

describe("premise: the two rows really take the two different shapes", () => {
  it("draws the archived row through ContentRow", () => {
    // `GraphThumbnail`'s accessible name, which only the resolved branch can produce.
    expect(OWNED).toContain(`${PUBLISHED.title} pipeline preview`);
  });

  it("draws the draft row through SummaryRow", () => {
    expect(OWNED).toContain("no release yet");
  });
});

describe("the owner can change visibility from their own list", () => {
  it("offers a control on every row, named for the row it changes", () => {
    expect(labelled(OWNED)).toEqual([PUBLISHED.slug, "kiln-line"]);
  });

  it("offers one on the published, archived row", () => {
    /* The regression, on its own cell. A control on the draft row alone closes half of it
       and reads as finished, because the shelf visibly grows a switch. */
    expect(control(OWNED, PUBLISHED.slug)).toContain("aria-pressed");
  });

  it("presses the segment each row's own stored value names", () => {
    expect(pressed(control(OWNED, PUBLISHED.slug))).toEqual(["public"]);
    expect(pressed(control(OWNED, "kiln-line"))).toEqual(["private"]);
  });
});

describe("the address the control patches", () => {
  it("is SEAM-67's, built from the handle and the slug of the row", () => {
    /* The render cannot see this: `api` reaches `fetch` and nothing else. Pinned as a
       literal rather than against a second template, which would be the same expression
       twice and would agree with itself however wrong it was. */
    expect(visibilityApi("mara-veil", "kiln-line")).toBe(
      "/api/bundles/mara-veil/kiln-line/visibility",
    );
  });
});

describe("a visitor is offered nothing to press", () => {
  it("draws no control when the reader does not own the shelf", () => {
    /* Read beside the owner's render above, which is what keeps this from being an empty
       set matched against an empty set: the SAME two rows produce two controls one line
       up. On its own this cell passed against the tree that had no control anywhere. */
    expect(labelled(OWNED)).toHaveLength(2);
    expect(labelled(shelf(false))).toEqual([]);
  });
});

describe("the row states visibility once", () => {
  /*
   * The sentence that used to sit under the Publish link said the same thing the control
   * now says, and the two could disagree the moment somebody pressed a segment: the
   * control answers optimistically off the server's reply, the sentence answers off the
   * value the page was loaded with. The control is the survivor because it is the live one.
   */
  it("no longer restates the loaded value in words beside the control", () => {
    expect(OWNED).not.toContain("only you can see this");
  });
});
