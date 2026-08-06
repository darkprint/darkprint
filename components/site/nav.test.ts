/* ============================================================
   One route, one name, and no link in the chrome that goes nowhere.

   Two defects the first version was written for, both of them
   things a reader meets before they meet any page:

   1. the header called `/spec` "Spec" and the footer called it
      "The spec language", so one route had two names on one
      screen (that route is gone; the defect is not, and the
      first block below is what stops it recurring);
   2. `/build` and `/how-to-build-a-dark-factory` were labelled
      "Build one" and "How to build one", two items apart in the
      same group. `/build` is a seven-step path ending in a
      downloaded factory and the other is a prose account of an
      organisation crossing four phases with no artefact at the
      end, so the labels differed by two words and inverted the
      distinction the two pages exist to hold apart.

   The redesign added a third, and it is the one this file grew
   for. Spec §4 split `/spec` into four routes and `/how-to-build-
   a-dark-factory` into three under a new name, and it cut the
   landing from eight sections to five beats. The IA pass then
   deleted `/spec` again from the other end, merged `/spec/scoring`
   into `/reading-the-radar` and folded `/concepts` into
   `/what-a-blueprint-is`, which is three more of exactly the same
   move. Every one of those
   moves can break the chrome in a way that typechecks and builds:
   a header item pointing at a deleted directory, a footer anchor
   naming a fragment no page renders any more, a sub-route nothing
   links to, an old URL that 404s instead of redirecting. So the
   last three blocks below walk the filesystem and the redirect
   table rather than trusting the two link tables.

   Both files export their link tables for this, and
   `next.config.ts` exports its config the same way. No DOM: the
   tables are plain data and nothing here renders.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";
import { CLIMB_ROUTE } from "@/components/howto/route";
import { SPEC_SEQUENCE } from "@/components/spec/sequence";

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
 * union of the seven literals and a lookup with a path read off the filesystem would not
 * typecheck against it. The point of the last blocks is to ask about paths the table does
 * not have.
 */
const HEADER_LABELS = new Map<string, string>(
  NAV.map((item) => [item.href as string, item.label as string]),
);

/** `/spec/card#scoring` → `["/spec/card", "scoring"]`. Either half may be empty. */
function split(href: string): { path: string; fragment: string } {
  const at = href.indexOf("#");
  if (at === -1) return { path: href, fragment: "" };
  return { path: href.slice(0, at), fragment: href.slice(at + 1) };
}

/**
 * Every label the header attaches to a control pointing at `href`.
 *
 * `/upload` is the one destination the two tables cannot check against each other,
 * because it is an action rather than a `NAV` row: the header renders it as a button in
 * the wide row and again as the last link of the phone panel, and neither is in the table
 * `HEADER_LABELS` is built from. That exemption cost exactly what an exemption costs —
 * for two passes the wide row said "Validate", the phone panel said "Validate a bundle",
 * the footer agreed with the panel, and the page all three point at was titled "Share a
 * blueprint", a promise of publishing on a site with no backend to publish to. Four
 * names, one destination, and the loudest of them was on the page itself.
 *
 * Read out of the source rather than off a render, for the same reason the panel checks
 * further down are: the header calls `usePathname`.
 *
 * The opening tag is taken to end at the first `>` NOT preceded by `=`. The phone panel's
 * link carries `onClick={() => setOpen(false)}`, and an arrow is not a tag end.
 */
function headerLabelsFor(source: string, href: string): string[] {
  return source
    .split(`href="${href}"`)
    .slice(1)
    .map((rest) => {
      const body = rest.slice(rest.search(/(?<!=)>/) + 1);
      return body.slice(0, body.indexOf("<")).trim();
    })
    .filter((label) => label !== "");
}

/** Whether `app/<route>/page.tsx` exists. `/` is `app/page.tsx`. */
function routeExists(path: string): boolean {
  const dir = path === "/" ? "app" : join("app", path.slice(1));
  return statSync(join(ROOT, dir, "page.tsx"), { throwIfNoEntry: false }) !== undefined;
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** Every `.ts`/`.tsx` under `dir`, tests excluded: a test may quote a link to assert on it. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...sourcesUnder(child));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
    out.push(child);
  }
  return out;
}

/**
 * A barrel's own re-exports, resolved to the files they name.
 *
 * `components/home/index.ts` is `export { X } from "./Y"` and nothing else — no JSX, no
 * id, ever — so a barrel that resolves as a candidate below and stops there always reads
 * as "renders nothing", whether or not the file it re-exports does. Lifecycle-scoring
 * pass §5 found this the hard way: `app/page.tsx` imports `SectionLifecycle` through
 * `@/components/home`, the one-level walk opened the barrel and found no `id="lifecycle"`
 * in it, and `/#lifecycle` reported dangling on a page that renders the id fine. One more
 * hop through the barrel's own specifiers is what a re-export is *for*.
 */
function barrelReexports(barrelPath: string, text: string): string[] {
  const dir = barrelPath.slice(0, barrelPath.lastIndexOf("/"));
  const specifiers = [...text.matchAll(/export\s*\{[^}]*\}\s*from\s*"(\.[^"]+)"/g)].map(
    (m) => m[1],
  );
  const resolved: string[] = [];
  for (const specifier of specifiers) {
    const stem = join(dir, specifier);
    for (const ext of [".tsx", ".ts"]) {
      const candidate = `${stem}${ext}`;
      if (statSync(join(ROOT, candidate), { throwIfNoEntry: false }) !== undefined) {
        resolved.push(candidate);
        break;
      }
    }
  }
  return resolved;
}

/**
 * Of `hrefs`, the ones whose fragment no component on the destination route renders.
 *
 * One level of imports, plus one more through a barrel a candidate resolves to (see
 * `barrelReexports`): an anchor in the chrome is meant to reach a section the destination
 * page itself puts on the screen, by way of at most one re-export in between. A page that
 * only reaches the id three components deep, past its own direct import, is a page whose
 * anchor nobody can maintain.
 *
 * A route with a dynamic segment is skipped rather than guessed at. `[slug]` is a
 * directory name and the href carries a slug, so resolving one to the other means running
 * `generateStaticParams`, which is the build's job; the built HTML is where those are
 * checked. Skipping is recorded here so the next reader does not take a pass as coverage.
 */
function unrenderedFragments(hrefs: readonly string[]): string[] {
  const missing: string[] = [];
  for (const href of hrefs) {
    const { path, fragment } = split(href);
    if (fragment === "") continue;
    const page = path === "/" ? "app/page.tsx" : join("app", path.slice(1), "page.tsx");
    if (statSync(join(ROOT, page), { throwIfNoEntry: false }) === undefined) {
      const dynamic = statSync(join(ROOT, "app", path.split("/")[1] ?? ""), {
        throwIfNoEntry: false,
      });
      if (dynamic === undefined) missing.push(`${href}: ${path} is not a route`);
      continue;
    }
    const sources = [read(page)];
    for (const [, spec] of read(page).matchAll(/from "@\/(components\/[^"]+)"/g)) {
      for (const candidate of [`${spec}.tsx`, `${spec}.ts`, `${spec}/index.ts`]) {
        if (statSync(join(ROOT, candidate), { throwIfNoEntry: false })) {
          const text = read(candidate);
          sources.push(text);
          if (candidate.endsWith("/index.ts")) {
            for (const reexport of barrelReexports(candidate, text)) sources.push(read(reexport));
          }
          break;
        }
      }
    }
    if (!sources.some((source) => source.includes(`id="${fragment}"`))) {
      missing.push(`${href}: nothing on ${path} renders id="${fragment}"`);
    }
  }
  return missing;
}

describe("a route is called the same thing everywhere", () => {
  it("gives every footer link the header's label, where the header has one", () => {
    const disagreements = FOOTER.filter((link) => {
      const header = HEADER_LABELS.get(link.href);
      return header !== undefined && header !== link.label;
    }).map((link) => `${link.href}: header "${HEADER_LABELS.get(link.href)}", footer "${link.label}"`);
    expect(disagreements).toEqual([]);
  });

  /** The exemption closed. See `headerLabelsFor`. */
  it("gives every `/upload` control in the header the footer's label", () => {
    const footer = FOOTER.find((link) => link.href === "/upload")?.label;
    expect(footer, "the footer stopped carrying /upload").toBeDefined();
    const labels = headerLabelsFor(read("components/site/SiteHeader.tsx"), "/upload");
    // Two today: the button in the wide row and the last row of the phone panel. A floor
    // rather than a count — it is here to fail when the scan stops matching, not to pin
    // the header's shape.
    expect(labels.length, "the header names /upload nowhere").toBeGreaterThan(1);
    expect([...new Set(labels)]).toEqual([footer]);
  });

  /**
   * And the page answers to it. `/towards-a-dark-factory` is held to its nav label the
   * same way two blocks down, for the same reason: a reader who clicks a label wants to
   * see what they clicked at the top of what loads, with nothing to re-resolve on
   * arrival. Both halves — the `h1` and the browser tab.
   */
  it("titles the upload page with the label that sends a reader to it", () => {
    const label = FOOTER.find((link) => link.href === "/upload")?.label;
    const source = read("app/upload/page.tsx");
    expect(source).toContain(`title="${label}"`);
    expect(source).toContain(`title: "${label}",`);
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

  /**
   * Was: the label is the page's eyebrow ("The climb"). The eyebrow on the renamed route
   * is "The route", and the author named the nav label themselves, so this now holds the
   * label against the page's `h1` instead. That is the stronger claim of the two: an
   * eyebrow is a category and the `h1` is the page's name, and a reader who clicks a nav
   * item wants to see what they clicked at the top of what loads.
   */
  it("labels the route page with the heading a reader lands on", () => {
    const source = read("app/towards-a-dark-factory/page.tsx");
    expect(source).toContain('as="h1"');
    expect(source).toContain(`title="${HEADER_LABELS.get("/towards-a-dark-factory")}"`);
  });
});

describe("the nav is a complete map of the routes", () => {
  /**
   * Every top-level page under `app/`, minus the ones reached from somewhere other than
   * the nav: the landing is the wordmark, `/upload` has its own button in both the header
   * and the footer, and the dynamic segments are reached from their index.
   *
   * `upload` is exempt from the TABLE and no longer exempt from the LABELS — the first
   * block of this file now reads its controls out of the header source and holds them to
   * the footer's wording, which is the check every other route gets for free by being a
   * `NAV` row.
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
    const dangling = NAV.filter((item) => !routeExists(item.href)).map((item) => item.href);
    expect(dangling).toEqual([]);
  });

  /**
   * The footer is where the fragments live, and a fragment is the one kind of link that
   * cannot be checked by resolving a path. Redesign spec §3 moved eight of them off the
   * landing at once, so the file that carries them needs a guard that fails on the day a
   * destination stops rendering its id rather than on the day somebody clicks it.
   */
  it("points every footer link at a route that exists", () => {
    const dangling = FOOTER.map((link) => split(link.href).path)
      .filter((path) => !routeExists(path));
    expect([...new Set(dangling)]).toEqual([]);
  });

  it("points every footer fragment at an id its own route renders", () => {
    expect(unrenderedFragments(FOOTER.map((link) => link.href))).toEqual([]);
  });

  /**
   * The same check over every `href="/…#…"` written anywhere in `app/` or `components/`.
   *
   * The footer is where most of them live and it is not where all of them live.
   * `/blueprints/[slug]` linked `/#scoring` for the panel that explains its two computed
   * readings, spec §3 moved that panel off the landing, and the link survived the move
   * pointing at a landing that renders no such id. It typechecks, it builds, it renders
   * as an underline, and it scrolls nowhere.
   */
  it("links no page at a fragment its destination stopped rendering", () => {
    // Any `"/path#id"` literal, and not only the ones spelled `href="…"`. Half the site's
    // links are rows in a table (`{ href: "/spec#scoring", label: … }`) and the other half
    // are JSX attributes, so a regex anchored on the attribute form sees the JSX and
    // misses this file's own footer. Comments come out first: several of them quote the
    // dead link they are recording.
    const hrefs = new Set<string>();
    for (const file of [...sourcesUnder("app"), ...sourcesUnder("components")]) {
      const source = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      for (const [, href] of source.matchAll(/"(\/[\w\-/[\]]*#[\w-]+)"/g)) hrefs.add(href);
    }
    // Was 4. Removing `/what-it-isnt` took the footer's `/what-it-isnt#what-it-is` with
    // it, so the population is one smaller and the floor moves with it. The floor is here
    // to catch a regex that stopped matching, not to pin a count.
    expect(hrefs.size).toBeGreaterThan(3);
    expect(unrenderedFragments([...hrefs].sort())).toEqual([]);
  });

  /**
   * Spec §4 gave the spec sequence three child routes and `/towards-a-dark-factory` two,
   * and put one item per sequence in the header. That is the right header and it leaves
   * five routes whose only permanent entrance is the footer, so the footer has to carry
   * them: a sub-route reachable from one pager and nothing else disappears the moment
   * somebody edits that pager.
   *
   * Two segments or fewer is not required here, which is why stop 00 of the spec
   * sequence is not in this check after the IA pass moved it to `/what-a-blueprint-is`.
   * It is in the Learn column regardless, as a top-level route in its own right.
   */
  it("carries every sub-route of the two sequences in the footer", () => {
    const linked = new Set(FOOTER.map((link) => split(link.href).path));
    const children = [...SPEC_SEQUENCE, ...CLIMB_ROUTE]
      .map((stop) => stop.href)
      .filter((href) => href.split("/").length > 2);
    expect(children.filter((href) => !linked.has(href))).toEqual([]);
  });
});

/**
 * The collapsed panel, which is the only nav a phone gets.
 *
 * Held from the source rather than from a render: the header reads `usePathname`, so
 * rendering it here would mean standing up a router, and every failure below is a
 * property of the markup rather than of a particular route. The three are the ways this
 * panel has broken or could: a group heading with nothing under it, a panel taller than
 * the viewport under a sticky header with no way to scroll it, and a toggle a screen
 * reader cannot name or read the state of.
 */
describe("the collapsed menu stays usable", () => {
  const SOURCE = read("components/site/SiteHeader.tsx");

  /** Groups the panel renders without a heading, above the headed ones. */
  const UNGROUPED = ["home"];

  it("renders no group heading with nothing under it", () => {
    // The panel maps a fixed list of groups and filters `NAV` into each. A group left in
    // that list after its last item moved prints a heading over an empty div.
    const groups = [...SOURCE.matchAll(/\{ id: "(\w+)", title: "([^"]+)" \}/g)].map((m) => m[1]);
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) {
      expect(
        NAV.filter((item) => item.group === group).length,
        `group "${group}" has no items`,
      ).toBeGreaterThan(0);
    }
    /* A group missing from `GROUPS` is only a defect if nothing else renders its items.
       `home` is deliberately outside that list: a section headed "Home" holding one link
       called "Home" says the word twice, so the panel draws it above the groups with no
       heading. What still has to hold is that every item reaches the panel somehow, so
       the check is against the rendered hrefs rather than against the group list. */
    const rendered = new Set(
      [...SOURCE.matchAll(/href=\{item\.href\}/g)].length > 0
        ? NAV.filter((item) => groups.includes(item.group) || UNGROUPED.includes(item.group)).map(
            (item) => item.href,
          )
        : [],
    );
    const stray = NAV.filter((item) => !rendered.has(item.href)).map((item) => item.href);
    expect(stray, "an item the collapsed panel never renders").toEqual([]);
  });

  it("caps the panel below the header and lets it scroll", () => {
    // Seven items plus two headings plus the validate row is taller than a 640px phone in
    // landscape, and the last item was unreachable under `position: sticky`. `svh` and not
    // `vh`: on iOS `vh` measures the viewport without the chrome that is covering it.
    expect(SOURCE).toContain("max-h-[calc(100svh-4rem)]");
    expect(SOURCE).toContain("overflow-y-auto");
  });

  it("gives the toggle a name and a state", () => {
    expect(SOURCE).toContain('aria-label="Toggle menu"');
    expect(SOURCE).toContain("aria-expanded={open}");
  });
});

/**
 * Every route this site has retired, held to the promise §4.2 made for the first two:
 * "old URLs must not 404".
 *
 * All five were in the header and the footer of every page this site served while they
 * existed, so a build that drops one of these redirects breaks links that are already
 * written down elsewhere. The destinations are resolved against the filesystem for the
 * same reason the header's are: a redirect onto a route that no longer exists is a 404
 * with an extra hop.
 *
 * The last three are the IA pass of 2026-08-07, and they are content moves rather than
 * renames, so each lands on the page that now holds what the old one held rather than on
 * a parent index:
 *
 *   - `/spec` was the overview above three layer pages. `/what-a-blueprint-is` is their
 *     door now, and it carries the three old in-page ids so `/spec#card` still lands on
 *     the band about the card after the hop.
 *   - `/spec/scoring` merged into `/reading-the-radar`, which took its title with it.
 *     `#weights` survives because `ScoringModel` owns that id and moved whole.
 *   - `/concepts` is the `#the-words` section of `/what-a-blueprint-is`. The destination
 *     is the bare route: a redirect that appends a fragment overrides the one a reader
 *     arrived with.
 */
describe("the routes that were retired still answer", () => {
  const RENAMED: [string, string][] = [
    ["/how-to-build-a-dark-factory", "/towards-a-dark-factory/the-climb"],
    ["/which-tasks", "/towards-a-dark-factory/which-tasks"],
    ["/spec", "/what-a-blueprint-is"],
    ["/spec/scoring", "/reading-the-radar"],
    ["/concepts", "/what-a-blueprint-is"],
  ];

  it("redirects every old path, permanently, to a page that exists", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const [source, destination] of RENAMED) {
      const rule = redirects.find((entry) => entry.source === source);
      expect(rule, `no redirect for ${source}`).toBeDefined();
      expect(rule?.destination).toBe(destination);
      // 308 rather than 307. The rename is a decision and not an experiment.
      expect(rule?.permanent).toBe(true);
      expect(routeExists(destination), `${destination} does not exist`).toBe(true);
    }
  });

  it("has removed every old page, so the redirect is the only answer", () => {
    // Redirects are checked before the filesystem, so a directory left behind at either
    // path would be shadowed and silently unreachable rather than loudly wrong.
    for (const [source] of RENAMED) {
      expect(routeExists(source), `${source} still has a page.tsx`).toBe(false);
    }
  });

  it("names no old path anywhere in the chrome", () => {
    const stale = [...NAV.map((item) => item.href as string), ...FOOTER.map((link) => link.href)]
      .filter((href) => RENAMED.some(([source]) => split(href).path === source));
    expect(stale).toEqual([]);
  });
});

/**
 * WCAG 2.4.1, for the reader who navigates by keyboard without a screen reader.
 *
 * The landmarks in `app/layout.tsx` give an assistive-technology user a bypass already.
 * They give a sighted keyboard user nothing, and this header is ten links, after which the
 * luminous register makes every node of the first figure on the landing a focus stop: the
 * measured tab order reached the landing's own doors at position 23. The skip link is the
 * first thing in the document and the only thing that changes.
 */
describe("a keyboard reader can get past the header", () => {
  const LAYOUT = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");

  it("puts a skip link before the header", () => {
    expect(LAYOUT).toContain('href="#main"');
    expect(LAYOUT.indexOf('href="#main"')).toBeLessThan(LAYOUT.indexOf("<SiteHeader"));
  });

  it("gives it somewhere to land, and makes that somewhere take focus", () => {
    // A fragment moves the scroll position everywhere and moves focus only where the
    // target is focusable. Without `tabIndex` the next tab goes back into the nav.
    expect(LAYOUT).toMatch(/<main[^>]*id="main"/);
    expect(LAYOUT).toMatch(/<main[^>]*tabIndex=\{-1\}/);
  });

  it("hides it until it is focused rather than removing it from the order", () => {
    expect(LAYOUT).toContain("sr-only");
    expect(LAYOUT).toContain("focus:not-sr-only");
  });
});
