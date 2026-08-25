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
import { SPEC_SEQUENCE } from "@/components/spec/sequence";

import { ACCOUNT_MENU, LEARN, NAV } from "./SiteHeader";
import { COLS } from "./SiteFooter";

/** Repo root: this file is `<root>/components/site/`. */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Every footer link, flattened. */
const FOOTER = COLS.reduce<Array<{ href: string; label: string }>>(
  (links, col) => [...links, ...col.links],
  [],
);

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

  /**
   * The exemption closed. See `headerLabelsFor`.
   *
   * Rebased off the footer on 2026-08-07: the author asked `/upload` out of the Registry
   * column, so there is no footer row left to compare against. The defect this was written
   * for is untouched by that — four names for one destination, the loudest of them on the
   * page itself — so what it compares changed and what it forbids did not.
   *
   * The header is now the source of truth, and it can be: it names `/upload` twice, in the
   * wide row's button and the last row of the phone panel, which is exactly the pair that
   * disagreed for two passes ("Validate" against "Validate a bundle"). Two controls held
   * to each other catch that; one control held to a footer row that no longer exists
   * catches nothing.
   */
  const uploadLabels = () => NAV.filter((item) => item.href === "/upload").map((item) => item.label);

  it("gives every `/upload` control in the header the same label", () => {
    const labels = uploadLabels();
    // Two today. A floor rather than a count — it is here to fail when the scan stops
    // matching, not to pin the header's shape.
    expect(labels.length, "the header names /upload nowhere").toBeGreaterThan(0);
    expect([...new Set(labels)], "the header calls /upload two things").toHaveLength(1);
  });

  /**
   * And the page answers to it. `/towards-a-dark-factory` is held to its nav label the
   * same way two blocks down, for the same reason: a reader who clicks a label wants to
   * see what they clicked at the top of what loads, with nothing to re-resolve on
   * arrival. Both halves — the `h1` and the browser tab.
   */
  it("titles the upload page with the label that sends a reader to it", () => {
    const [label] = [...new Set(uploadLabels())];
    expect(label, "the header names /upload nowhere").toBeDefined();
    const source = read("app/upload/page.tsx");
    expect(source).toContain('title="Validate and publish"');
    expect(source).toContain('title: "Validate and publish",');
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

describe("the task groups use distinct, descriptive labels", () => {
  /**
   * A prefix test rather than a similarity score. "Build one" and "How to build one" are
   * the pair this was written for and the second contains the first whole, which is
   * exactly what makes a nav unreadable: the longer label looks like a longer way of
   * saying the shorter one, and the two pages have nothing in common.
   */
  it("has no label containing another label of the same group", () => {
    /* `docs`, not `guides`. `guides` held one row and lost it on 2026-08-11 when the dead
       `/towards-a-dark-factory` entry was deleted, which would have left this walking a
       list of one and passing for the reason a vacuous test passes. `docs` is where the
       labels this rule is about actually live: seven Learn destinations, named in full,
       and the footer prints the same seven under one another. */
    const learn = NAV.filter((item) => item.group === "docs").map(
      (item) => item.label as string,
    );
    expect(learn.length, "the docs group is empty; this would pass vacuously").toBeGreaterThan(1);
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
    /* Off `LEARN` rather than `HEADER_LABELS`. The route's `NAV` row was deleted on
       2026-08-11 for drawing nothing, and `HEADER_LABELS` is built from that table, so this
       was about to hold the page's title against `undefined` and pass on the string
       "undefined" appearing nowhere. The Learn dropdown is the header surface that names
       this route, so it is the one the page's own heading has to agree with. */
    const label = LEARN.find((item) => item.href === "/towards-a-dark-factory")?.label;
    expect(label, "the Learn dropdown no longer names /towards-a-dark-factory").toBeDefined();
    const source = read("app/towards-a-dark-factory/page.tsx");
    expect(source).toContain('as="h1"');
    expect(source).toContain(`title="${label}"`);
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
   *
   * `settings` was exempt for one pass and is not any more. It is reached from the account
   * menu hanging off the header's avatar, which is a header control rather than a `NAV`
   * row — so `ACCOUNT_MENU` joined `HEADER_ROUTES` below, exactly the way `LEARN` did when
   * `/build` left `NAV`, and the exemption came out in the same change. The fix was to the
   * definition of "in the header", not to what the assertion demands, which is the whole
   * argument the entry made while it stood.
   */
  /* `welcome` is exempt for a different reason than `upload`, and the difference is the
     point: `/upload` IS a destination and is merely reached by a button rather than a `NAV`
     row, so the exemption says "look elsewhere in this file". `/welcome` is not a
     destination at all. It is where `app/api/auth/github/callback/route.ts` sends an account
     whose sign-up is unfinished (T050 AC1's `handle: null`), and it bounces any finished
     account straight back to `/` — so a header row pointing at it would be a link that,
     for every reader who could click it, goes nowhere. A route nobody may navigate to is
     the one shape this assertion cannot demand.

     This file is byte-frozen by `tests/server/t262/frozen.test.ts`. This edit is D-262-29's
     ruled amendment, and the pin moved in the same commit — see that ruling for why the
     freeze fired correctly and was still the right thing to amend. */
  /* `new` joined at T280 for the same reason `upload` is here: it is reached from the
     "New blueprint" controls on the profile shelf and the hero, not from the global nav —
     a creation form is a destination a button hands you, not a place a reader browses. */
  const ELSEWHERE = new Set(["upload", "welcome", "new"]);

  /**
   * Decision 1 of the accounts pass, held from both ends, and rewritten twice.
   *
   * It first asserted that `/ontology` was NOT in the header at all, which was true and was
   * the defect: the ontology browser is one of the three things the registry holds and the
   * only route to it in the chrome was the Learn menu's row for the spec document ABOUT it.
   * The browser got its own row, and the collision that created was resolved by calling the
   * browser "Vocabulary" — which this case then pinned.
   *
   * The author overruled that on 2026-08-12 ("adopt the term Ontology also for /ontology
   * page … be consistent through all the website"), so the case is rewritten rather than
   * deleted: the claim it holds is unchanged and only the answer moved. Both routes are in
   * the header, they are called different things on purpose, and the browser is the one
   * that gets the bare word.
   *
   * The spec row takes its siblings' shape instead — `/spec/topology` is "Blueprint file
   * (DOT)" and `/spec/card` is "Node card (YAML)" — which is asserted here too, because a
   * future rename reaching for the short form would reopen exactly this.
   */
  it("gives the ontology browser the bare word, and the spec page its file form", () => {
    expect(HEADER_LABELS.get("/ontology")).toBe("Ontology");
    expect(HEADER_LABELS.get("/spec/ontology")).toBe("Ontology file (YAML)");
  });

  it("uses the shared 00–06 sequence for the Learn dropdown", () => {
    expect(LEARN.map(({ href, label, step }) => ({ href, label, step }))).toEqual(
      SPEC_SEQUENCE.map(({ href, nav, step }) => ({ href, label: nav, step })),
    );
  });

  /**
   * Everywhere the header can send a reader: the `NAV` table, and the Learn dropdown.
   *
   * This used to be `HEADER_LABELS` alone, with `skill` written into a `contextual`
   * exemption because `/skill` was reachable from the footer only. Both halves changed on
   * 2026-08-10, in opposite directions, and the net is a tighter check:
   *
   * - `/skill` took the header's "Create" row when `/build` split, so the exemption it
   *   needed is gone. It is now held to the same rule as every other route, which is what
   *   the exemption was always costing.
   * - `/build` left `NAV` and kept its place in the Learn dropdown as stop 04. The
   *   dropdown is rendered by `SiteHeader` from `LEARN`, so a route listed there really is
   *   listed in the header, and a check that could not see it would have forced a second
   *   exemption to describe a route that is not actually missing.
   *
   * So the fix is to the definition of "in the header", not to what the assertion demands.
   * Two routes are exempt: `/upload`, which has its own button and its own checks above,
   * and `/welcome`, which is a redirect target rather than a destination — see `ELSEWHERE`
   * for why a header row pointing at it would be a link that goes nowhere.
   */
  const HEADER_ROUTES = new Set<string>([
    ...HEADER_LABELS.keys(),
    ...LEARN.map((item) => item.href as string),
    ...ACCOUNT_MENU.map((item) => item.href as string),
  ]);

  it("lists every top-level route in the header", () => {
    const routes = readdirSync(join(ROOT, "app"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
      .filter((entry) => statSync(join(ROOT, "app", entry.name, "page.tsx"), { throwIfNoEntry: false }))
      .map((entry) => entry.name)
      .filter((name) => !ELSEWHERE.has(name));

    const missing = routes.filter((name) => !HEADER_ROUTES.has(`/${name}`));
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
    //
    // 2 since 2026-08-07: the author asked "What you can do with one" out of the Registry
    // column, which was the last fragment link the footer carried, and `WhichTasksRemedies`
    // was deleted with its `#autonomy` link the same day. Both survivors are JSX
    // attributes, so the table form of the regex is now covered by nothing.
    //
    // A floor that has slid from 4 to 3 to 2 is a floor that has stopped guarding anything,
    // so it stops being only a floor here: the walk has to come back with a link this
    // repository is known to contain. A regex that silently stops matching returns an empty
    // set and fails the named case, which is the failure the count was always standing in
    // for.
    expect(hrefs.size).toBeGreaterThan(1);
    expect([...hrefs]).toContain("/reading-the-radar#weights");
    expect(unrenderedFragments([...hrefs].sort())).toEqual([]);
  });

  /**
   * Spec §4 gave the spec sequence three child routes and `/towards-a-dark-factory` two,
   * and put one item per sequence in the header. The climb route has NO children now:
   * `/which-tasks` was merged into its parent on 2026-08-07 and `/the-climb` was deleted
   * later the same day, so this covers the three spec children and nothing else. The claim
   * is unchanged for them — a sub-route reachable from one pager and nothing else
   * disappears the moment somebody edits that pager, so the footer has to carry it — and
   * the climb route simply no longer has a sub-route to make it about.
   *
   * Two segments or fewer is not required here, which is why stop 00 of the spec
   * sequence is not in this check after the IA pass moved it to `/what-a-blueprint-is`.
   * It is in the Learn column regardless, as a top-level route in its own right.
   */
  it("carries every sub-route of the two sequences in the footer", () => {
    const linked = new Set(FOOTER.map((link) => split(link.href).path));
    const children = [...SPEC_SEQUENCE]
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
      /* Two groups are not filtered out of `NAV`: `learn` comes from `SPEC_SEQUENCE` and
         `you` from `ACCOUNT_MENU`, because neither is a row in the primary table. Every
         other group is. */
      const count =
        group === "learn"
          ? LEARN.length
          : group === "you"
            ? ACCOUNT_MENU.length
            : NAV.filter((item) => item.group === group).length;
      expect(
        count,
        `group "${group}" has no items`,
      ).toBeGreaterThan(0);
    }
    /* A group missing from `GROUPS` is only a defect if nothing else renders its items.
       `home` is deliberately outside that list: a section headed "Home" holding one link
       called "Home" says the word twice, so the panel draws it above the groups with no
       heading. What still has to hold is that every item reaches the panel somehow, so the
       check is against the rendered hrefs rather than against the group list.

       Two hrefs reach a reader by another route entirely, and both are asserted below
       rather than waved through:

       - `/upload` is the Publish button in the wide row and an explicit row at the foot of
         the panel's Build group. It is not a `NAV`-driven row in either place, so the scan
         below cannot see it and the check on the source can.
       - `/towards-a-dark-factory` is stop 06 of the Learn sequence, so the dropdown and the
         phone panel both carry it through `LEARN`. It needs no exemption; the entry is kept
         here because the route has been in and out of that list twice and the next reader
         should find the answer rather than the history. */
    const ELSEWHERE_THAN_THE_PANEL = new Set(["/upload"]);
    const learnHrefs = new Set([
      ...LEARN.map((item) => item.href as string),
      ...ACCOUNT_MENU.map((item) => item.href as string),
    ]);
    const rendered = new Set(
      [...SOURCE.matchAll(/href=\{item\.href\}/g)].length > 0
        ? NAV.filter(
            (item) =>
              groups.includes(item.group) ||
              UNGROUPED.includes(item.group) ||
              learnHrefs.has(item.href),
          ).map((item) => item.href as string)
        : [],
    );
    const stray = NAV.map((item) => item.href as string).filter(
      (href) => !rendered.has(href) && !ELSEWHERE_THAN_THE_PANEL.has(href),
    );
    expect(stray, "an item the collapsed panel never renders").toEqual([]);

    // The one exemption, held to the way in it claims.
    expect(SOURCE, "the phone panel dropped its Publish row").toContain('href="/upload"');
    // And the essay reaches a reader through the sequence and the footer both.
    expect(LEARN.map((item) => item.href)).toContain("/towards-a-dark-factory");
    expect(
      FOOTER.map((link) => link.href),
      "the footer stopped carrying the essay",
    ).toContain("/towards-a-dark-factory");
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
    expect(SOURCE).toContain("aria-expanded={mobileOpen}");
  });
});

/**
 * Every route this site has retired, held to the promise §4.2 made for the first two:
 * "old URLs must not 404".
 *
 * Every one of them was in the chrome of every page this site served while it existed —
 * `/towards-a-dark-factory/which-tasks` in the footer's own "The route" column rather than
 * in the header, and that column is gone with it — so a build that drops one of these
 * redirects breaks links that are already written down elsewhere. The destinations are
 * resolved against the filesystem for the same reason the header's are: a redirect onto a
 * route that no longer exists is a 404 with an extra hop.
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
    ["/how-to-build-a-dark-factory", "/towards-a-dark-factory"],
    /* Deleted 2026-08-07 on the author's instruction; the route is one page again. */
    ["/towards-a-dark-factory/the-climb", "/towards-a-dark-factory"],
    /* Both of these land on the parent, and the first one does NOT chain through the
       second. `/which-tasks` was 308'd to `/towards-a-dark-factory/which-tasks` by §4.2;
       that child was merged into its own parent on 2026-08-07, and pointing the older
       redirect at the newer redirect would cost every link written before §4.2 two hops
       for no gain. The child path keeps an entry of its own because it was live long
       enough to be linked. */
    ["/which-tasks", "/towards-a-dark-factory"],
    ["/towards-a-dark-factory/which-tasks", "/towards-a-dark-factory"],
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
