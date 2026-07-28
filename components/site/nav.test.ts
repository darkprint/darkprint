/* ============================================================
   One route, one name, and two labels that do not collide.

   Two defects, both of them things a reader meets before they meet
   any page:

   1. the header called `/spec` "Spec" and the footer called it
      "The spec language", so one route had two names on one screen;
   2. `/build` and `/how-to-build-a-dark-factory` were labelled
      "Build one" and "How to build one", two items apart in the
      same group. `/build` is a seven-step path ending in a
      downloaded factory and the other is a prose account of an
      organisation crossing four phases with no artefact at the
      end, so the labels differed by two words and inverted the
      distinction the two pages exist to hold apart.

   Both files export their link tables for this. No DOM: the tables
   are plain data and nothing here renders.
   ============================================================ */

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NAV } from "./SiteHeader";
import { COLS } from "./SiteFooter";

/** Repo root: this file is `<root>/components/site/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Every footer link, flattened. */
const FOOTER = COLS.flatMap((col) => col.links);

/**
 * Header label per route.
 *
 * Widened to `string` keys on the way in: `NAV` is `as const`, so its `href` narrows to a
 * union of the eight literals and a lookup with a path read off the filesystem would not
 * typecheck against it. The point of the last block is to ask about paths the table does
 * not have.
 */
const HEADER_LABELS = new Map<string, string>(
  NAV.map((item) => [item.href as string, item.label as string]),
);

describe("a route is called the same thing everywhere", () => {
  it("gives every footer link the header's label, where the header has one", () => {
    const disagreements = FOOTER.filter((link) => {
      const header = HEADER_LABELS.get(link.href);
      return header !== undefined && header !== link.label;
    }).map((link) => `${link.href}: header "${HEADER_LABELS.get(link.href)}", footer "${link.label}"`);
    expect(disagreements).toEqual([]);
  });

  it("never puts one label on two routes", () => {
    for (const [where, links] of [
      ["header", NAV as readonly { href: string; label: string }[]],
      ["footer", FOOTER],
    ] as const) {
      const byLabel = new Map<string, string[]>();
      for (const link of links) {
        byLabel.set(link.label, [...(byLabel.get(link.label) ?? []), link.href]);
      }
      const shared = [...byLabel.entries()]
        .filter(([, hrefs]) => new Set(hrefs).size > 1)
        .map(([label, hrefs]) => `${where}: "${label}" → ${hrefs.join(", ")}`);
      expect(shared).toEqual([]);
    }
  });
});

describe("the two learn pages are told apart by their labels", () => {
  /**
   * A prefix test rather than a similarity score. "Build one" and "How to build one" are
   * the pair this was written for and the second contains the first whole, which is
   * exactly what makes a nav unreadable: the longer label looks like a longer way of
   * saying the shorter one, and the two pages have nothing in common.
   */
  it("has no label containing another label of the same group", () => {
    const learn = NAV.filter((item) => item.group === "learn").map((item) => item.label as string);
    const contained: string[] = [];
    for (const a of learn) {
      for (const b of learn) {
        if (a === b) continue;
        if (b.toLowerCase().includes(a.toLowerCase())) contained.push(`"${b}" contains "${a}"`);
      }
    }
    expect(contained).toEqual([]);
  });

  it("labels the ladder page with the word the page itself opens on", () => {
    // `/how-to-build-a-dark-factory` renders the eyebrow "The climb". A nav label a reader
    // does not meet again on arrival is a label they have to re-resolve.
    expect(HEADER_LABELS.get("/how-to-build-a-dark-factory")).toBe("The climb");
  });
});

describe("the nav is a complete map of the routes", () => {
  /**
   * Every top-level page under `app/`, minus the ones reached from somewhere other than
   * the nav: the landing is the wordmark, `/upload` has its own button in both the header
   * and the footer, and the dynamic segments are reached from their index.
   */
  const ELSEWHERE = new Set(["upload"]);

  it("lists every top-level route in the header", () => {
    const routes = readdirSync(join(ROOT, "app"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
      .filter((entry) => statSync(join(ROOT, "app", entry.name, "page.tsx"), { throwIfNoEntry: false }))
      .map((entry) => entry.name)
      .filter((name) => !ELSEWHERE.has(name));

    const missing = routes.filter((name) => !HEADER_LABELS.has(`/${name}`));
    expect(missing).toEqual([]);
  });

  it("points every header item at a route that exists", () => {
    const dangling = NAV.filter(
      (item) =>
        statSync(join(ROOT, "app", item.href.slice(1), "page.tsx"), { throwIfNoEntry: false }) ===
        undefined,
    ).map((item) => item.href);
    expect(dangling).toEqual([]);
  });
});
