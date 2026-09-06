/* ============================================================
   What `/blueprints/[owner]/[slug]` draws, and in what order.

   Two instructions, five months apart in the file's history and one day apart in the repo's.

   2026-09-04: "remove the fork panel from blueprint, and the Exact release panel, remove the
   Read more on top of the page and the Attractor what a runner reads panel and the
   topology.dot panel at the bottom. Adopt the github solution where the README is used to
   visualize in markdown the information about the repository (adopt the same graphical
   approach). the description below the blueprint name should be extended in full horizontal
   space." Asked where the download should go, the owner chose the file list's header row.

   2026-09-06: "remove the watch button in the blueprint card template, remove the
   description in the blueprint template above the panel that lists the files ... move on
   that part the The graph panel (extend full horizontal length as the other elements) and
   remove the panel visibility from the blueprint card; such option should be visible only on
   the user account list of the blueprints, move the tool scopes right below the section
   attached, remove the Code button and move on top right on the side right of the Star; the
   order should be: star, fork, download blueprint."

   The second pass moved the download a second time, so the cells that held it on the file
   list now hold it in the band. That is a repoint of an assertion and it is recorded as one:
   the claim was never "the download is on the file list", it was "the download the removed
   panel carried still has somewhere to be", and it is checked at the position the owner most
   recently named.

   ── Why this reads source text, which is the weaker instrument ──
   The page is a server component that opens with `getSharedDbClient()` and four awaited
   registry reads, so invoking it in a cell renders nothing without a database and a seeded
   archive (D-261-11 records the same limit for the `dynamic` export). Every guard this repo
   has over that page's SHAPE is therefore a source read — `components/panes/archive-labels.test.ts`
   for the graph's canvas, `components/ui/community-support.test.ts` for the header's star,
   `components/site/anchors.test.ts` for the join between a rail row and the id it names.
   This one is that same instrument pointed at the restructure, and its limit is stated
   rather than left to be discovered: it proves what the page MOUNTS and in what ORDER, never
   what a browser paints. The rendered halves are covered where the components live —
   `components/bundle/code-menu.test.ts`, `readme-panel.test.ts`, `file-tree-actions.test.ts`.

   ── Comments are stripped first, and that is load-bearing ──
   A removal is recorded in place on this page rather than deleted silently, so the file
   NAMES every panel that came off it, at length. A bare `not.toContain("DownloadPanel")`
   would fail against the correct file and the only way to green it would be to delete the
   explanation. So the strip runs first, every assertion below reads the stripped text, and
   the premise reads it too — a premise on the raw source beside an assertion on the
   stripped source is green whatever either says.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PAGE_FILE = "app/blueprints/[owner]/[slug]/page.tsx";
const RAW = readFileSync(`${ROOT}${PAGE_FILE}`, "utf8");

/**
 * The page with its prose taken out: both block forms, braced for JSX and bare for the
 * module scope, plus `//` to end of line.
 *
 * The forms are not spelled out here on purpose. A block comment quoting its own closing
 * delimiter ends at the quote, and the rest of the paragraph parses as code — which is a
 * syntax error this repo has already paid for once, in `components/ui/markdown-parse.ts`,
 * where a `public/bundles/` glob in a header banner closed the banner eight lines in.
 *
 * Both block forms in one pattern, because a JSX comment is a block comment inside braces
 * and matching the braces separately would leave a stray `{`/`}` pair in the text every
 * `indexOf` below then counts. Non-greedy, so two comments never collapse into one span
 * that eats the code between them — which `code is still here` is what catches.
 */
const SOURCE = RAW.replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every `className="…"` literal, which is where a width cap would be if there were one. */
const CLASS_LISTS = [...SOURCE.matchAll(/className="([^"]*)"/g)].map((match) => match[1]);

describe("the instrument", () => {
  /*
   * The one cell that fails when the strip is wrong rather than when the page is.
   *
   * A regex that ate too much would delete the mounts and green every `not.toContain`
   * below at once, which is the failure mode that reads exactly like a clean page. So: the
   * strip removed a lot (this file is more comment than code and always has been), the code
   * it was supposed to keep is still there, and a sentence that exists only inside a comment
   * is gone.
   */
  it("strips the prose and keeps the code", () => {
    expect(SOURCE.length, "the strip removed nothing; every cell below reads raw prose").toBeLessThan(
      RAW.length - 20000,
    );
    expect(SOURCE, "the strip ate the page itself").toContain("export default async function Page");
    expect(SOURCE).toContain("<SynchronisedPanes");
    expect(SOURCE).toContain("<FileTree");
    expect(
      SOURCE,
      "a comment survived the strip, so every absence cell below can be satisfied by prose",
    ).not.toContain("the owner asked");
    expect(CLASS_LISTS.length, "no className literals were found at all").toBeGreaterThan(10);
  });
});

describe("the panels the owner asked off the page", () => {
  /*
   * Mount-shaped needles, not names. `<Forks` is a thing only JSX writes; `Forks` is a word
   * this page's own removal notes use six times. The needle has to be one the correct file
   * cannot contain for an innocent reason, which is the same narrowing
   * `components/ui/markdown.test.ts` had to make for `dangerouslySetInnerHTML`.
   *
   * None of these components is deleted, and two are still live elsewhere: `DotBreakdown`
   * on `/spec/topology` and in `BlueprintWalk`, `VisibilitySwitch` in
   * `components/bundle/DraftLanding.tsx` and, once the profile lane lands it, on the
   * account's own blueprint list. What is asserted is that THIS page stopped mounting them.
   *
   * `<DownloadPanel` is the one needle whose component may not exist at all any more: the
   * owner deleted `/build` and `components/build/**` on the same day, and `DownloadStep`
   * was its last mount. A `not.toContain` is the right shape either way — a component that
   * does not exist cannot come back to this page by accident, and one that does must not.
   */
  it.each([
    ["<Forks", "the fork panel is back in the aside"],
    ["<AttractorCompatibility", "the attractor verdict panel is back in the left column"],
    ["<DotBreakdown", "the topology.dot breakdown is back at the foot of the page"],
    ["<DownloadPanel", "the download panel is back; the owner moved it into the header band"],
    ["<BundlePanel", "the Bundle panel is back in the aside"],
    ["<Releases", "the Releases panel is back in the aside"],
    [
      "<VisibilitySwitch",
      "the visibility switch is back on the blueprint page. The owner ruled it belongs on " +
        "the account's own blueprint list and nowhere else: `such option should be visible " +
        "only on the user account list of the blueprints`.",
    ],
  ])("does not mount %s", (mount, why) => {
    expect(SOURCE, why).not.toContain(mount);
  });

  /*
   * The `Exact release` section carried the download and the `Read more` disclosure carried
   * the description, so both are asserted by the thing that made them a section rather than
   * by their copy: an anchor the rail pointed at, and a `<details>`.
   */
  it("declares neither anchor the two removed sections owned", () => {
    expect(SOURCE, "#use-this-blueprint is back").not.toContain('id="use-this-blueprint"');
    expect(SOURCE, "#blueprint-source is back").not.toContain('id="blueprint-source"');
  });

  /*
   * `<details` is `CodeMenu`'s own tag and `CodeMenu` is mounted here, so the needle has to
   * be the page's own markup rather than any disclosure on the rendered page. The page
   * writes no `<details>` of its own: the two it had were the `Read more` fold over the
   * description and the `Exact release` section, and both were asked off.
   */
  it("wraps nothing on the page in a disclosure of its own", () => {
    expect(
      SOURCE,
      "a <details> is back on this page. The `Read more` disclosure over the description and " +
        "the `Exact release` section were the only two, and both were asked off.",
    ).not.toContain("<details");
    expect(SOURCE, "the `Read more` summary is back").not.toContain("Read more");
    expect(SOURCE, "the description is folded again").not.toContain("<More");
  });

  /*
   * The long description block, gone on 2026-09-06: "remove the description in the blueprint
   * template above the panel that lists the files".
   *
   * Both halves, because either alone can be satisfied by the other's absence. The split
   * that built the paragraphs is gone AND nothing maps them, so a `paragraphs` computed and
   * dropped, or a `bp.description` rendered from some other variable, both fail here.
   *
   * The SHORT summary is not this. It is the last line of the identity band, it is what the
   * owner's screenshot marked as staying, and `still hands the band its summary` below holds
   * it — a cell that only forbade `description` would be green against a page that had
   * dropped the summary too.
   */
  it("draws no paragraph of the long description", () => {
    expect(
      SOURCE,
      "the long description is back above the file list. Only the short summary stays, in " +
        "the band.",
    ).not.toContain("bp.description");
    expect(SOURCE, "the paragraph split for the removed description is back").not.toContain(
      "paragraphs",
    );
  });
});

describe("the action row: star, fork, download blueprint", () => {
  const header = /<BundleHeader\b([\s\S]*?)>\s*<div/.exec(SOURCE);

  it("mounts the band and gives it a live star and a live fork", () => {
    expect(header, "the page no longer mounts <BundleHeader ...>").not.toBeNull();
    expect(header?.[1], "BundleHeader is not given the live `star` prop").toContain("star={{");
    expect(header?.[1], "BundleHeader is not given the live `fork` prop").toContain("fork={{");
  });

  /*
   * The Watch pill, off on the owner's instruction. Three needles, because the pill, the
   * figure and the read that produced it are three separate things and removing only the
   * first leaves a round trip per request for a number nothing draws.
   *
   * `getProfile` is not deleted — `/u/<owner>` is the page whose subject that count actually
   * is, and it still reads it. What is asserted is that this page stopped.
   */
  it("hands the band no watch control, no watcher figure and no read for one", () => {
    expect(SOURCE, "the Watch pill's live prop is back on the band").not.toContain("watch={{");
    expect(SOURCE, "the watcher count is back on the band").not.toContain("watchers=");
    expect(
      SOURCE,
      "the page is reading `getProfile` again. Its only consumer here was the watcher count " +
        "the Watch pill printed, and the pill is gone.",
    ).not.toContain("getProfile");
  });

  /**
   * The download, in the band and not on the file list.
   *
   * Read out of `BundleHeader`'s own mount rather than by finding `<CodeMenu` anywhere in
   * the file: a Code menu left behind on the file list would satisfy a bare `toContain`
   * while leaving the band without one, and the position is the whole of what the owner
   * changed on 2026-09-06.
   */
  it("puts the download in the band, as BundleHeader's third control", () => {
    expect(header?.[1], "BundleHeader is not given the `download` slot").toContain("download={");
    expect(
      header?.[1],
      "the band's download slot no longer holds <CodeMenu>, so the download has nowhere " +
        "left to be",
    ).toContain("<CodeMenu");
  });

  /*
   * And the file list no longer carries one. The owner named the control by its old label —
   * "remove the Code button" — and a page with a download in both places is the arrangement
   * that makes a reader wonder which one is the real one.
   */
  it("leaves the file list without a control of its own", () => {
    const fileTree = /<FileTree\b([\s\S]*?)\/>/.exec(SOURCE);
    expect(fileTree, "the page no longer mounts <FileTree ... />").not.toBeNull();
    expect(
      fileTree?.[1],
      "the `Code` control is back on the file list's header row. The owner moved it into " +
        "the band, and two downloads on one page is what the move was against.",
    ).not.toContain("actions={");
  });

  /*
   * The command names the release, not just the bundle.
   *
   * `folder.version` and not `current?.version`: `releaseFiles` resolved the folder whose
   * files the menu lists, so a command built from any other version would hand a reader a
   * different release from the one they are looking at. The owner-qualified key is
   * D-261-07(6)'s ruling and `tests/server/t261/honesty-direction.test.ts` holds every
   * `darkprint clone` line on this page to it; what is local here is the `--version` pin.
   */
  it("pins the clone command to the release the listing is of", () => {
    expect(header?.[1]).toMatch(
      /darkprint clone \$\{owner\}\/\$\{slug\} --version \$\{folder\.version\}/,
    );
  });

  /*
   * One array, three renderings. The listing, the hrefs and the menu all come off `paths`,
   * which is `releaseFiles`' answer for this release — `components/bundle/load.ts` states
   * the rule this preserves: a command naming a file the folder does not have aborts
   * partway through and leaves half a folder behind.
   */
  /*
   * ONE ARRAY, three readers, since the folder became navigable on 2026-09-06.
   *
   * The claim has not moved: the download menu, the root listing and the `cards/` listing
   * must all describe the same folder, so all three are built from `paths`. What moved is
   * the spelling — the listing is a ternary now, because `?path=cards` swaps which of the
   * two readers fills it — and the old needle pinned `files: filesFromPaths(paths,` as one
   * string, which is the shape rather than the claim.
   *
   * Both readers are asserted to take `paths` rather than asserting the ternary's text.
   * A cell that pinned the whole expression would red on any later rearrangement of it while
   * still passing the day somebody fed one of the two a different array, which is the only
   * thing here worth catching.
   */
  it("builds the menu's file list from the same array both listings are built from", () => {
    expect(SOURCE).toContain("const codeFiles = paths.map(");
    expect(SOURCE, "the root listing stopped reading `paths`").toContain(
      "filesFromPaths(paths,",
    );
    expect(SOURCE, "the cards listing stopped reading `paths`").toContain(
      "cardFilesFromPaths(paths,",
    );
    expect(header?.[1]).toContain("files={codeFiles}");
  });

  /*
   * The band keeps the short summary. The owner removed the LONG description and quoted it
   * specifically; the screenshot they marked shows the summary inside the band they asked
   * kept. Without this cell, `draws no paragraph of the long description` is green against a
   * page that dropped both.
   */
  it("still hands the band its summary", () => {
    expect(header?.[1], "the band lost the short summary along with the long description")
      .toContain("summary={bp.summary}");
  });
});

describe("the page reads: band, tool scopes, graph, files, readme, history, comments", () => {
  /**
   * Every section's position in one place, so the order is one fact asked once.
   *
   * `indexOf` over the stripped source: the mounts appear in DOM order in a server component
   * that returns one tree, and the order the owner listed is the order a reader meets them.
   * A pair of `toBeGreaterThan`s per neighbour would be six cells that each pass while the
   * page is in the wrong order overall, which is the failure mode a sort catches and they do
   * not.
   */
  const AT = {
    band: SOURCE.indexOf("<BundleHeader"),
    toolScopes: SOURCE.indexOf("<ToolScopes"),
    graph: SOURCE.indexOf("<SynchronisedPanes"),
    files: SOURCE.indexOf("<FileTree"),
    readme: SOURCE.indexOf("<ReadmePanel"),
    history: SOURCE.indexOf("<History"),
    comments: SOURCE.indexOf("<Comments"),
  };

  it("mounts all seven", () => {
    for (const [name, at] of Object.entries(AT)) {
      expect(at, `the page no longer mounts the ${name} section`).toBeGreaterThan(0);
    }
  });

  it("mounts them in the order the owner listed", () => {
    const order = Object.entries(AT)
      .sort(([, a], [, b]) => a - b)
      .map(([name]) => name);
    expect(
      order,
      "the page's sections are in a different order from the one the owner asked for: " +
        "`move the tool scopes right below the section attached` (the identity band), and " +
        "`move on that part the The graph panel`, that part being where the description was, " +
        "above the file list.",
    ).toEqual(["band", "toolScopes", "graph", "files", "readme", "history", "comments"]);
  });

  /*
   * The graph runs the full width, which is the other half of the same instruction.
   *
   * The two-thirds column was a `lg:col-span-2` inside a `lg:grid-cols-3` body grid, and the
   * grid held one other child: a sticky `<aside>` whose last panel was the visibility switch.
   * The switch left the page, so the aside had nothing in it and the grid had nothing to
   * hold. All three needles, because any one of them surviving is the layout coming back:
   * a grid with an empty track is still a graph in two thirds of the page.
   *
   * `components/panes/archive-labels.test.ts` COMPUTED every canvas it measured from
   * `columnCanvasWidthAt`, which divided the body by exactly these classes, so it failed on
   * this move by construction. That was the point of it, and the re-measure has since
   * happened: `columnCanvasWidthAt` is deleted and that file frames from `canvasWidthAt`
   * now. The numbers are still its and not this file's.
   */
  it("gives the graph the body's whole width", () => {
    expect(
      CLASS_LISTS.filter((list) => /(?:^| )lg:grid-cols-3(?: |$)/.test(list)),
      "the three-column body grid is back. The graph is meant to run the full width of the " +
        "container, `as the other elements`.",
    ).toEqual([]);
    expect(
      CLASS_LISTS.filter((list) => /(?:^| )lg:col-span-2(?: |$)/.test(list)),
      "a two-thirds column is back around the graph",
    ).toEqual([]);
    expect(SOURCE, "the sticky aside is back beside the graph").not.toContain("<aside");
  });

  /*
   * The anchor the rail points at is on the graph's own wrapper, and it carries the scroll
   * offset. `components/site/anchors.test.ts` holds that join for every fragment on the site;
   * what is local here is that the id did not travel to some other element when the section
   * moved up the page.
   */
  it("keeps the graph's anchor on the graph", () => {
    const wrapper = /<div id="blueprint-workspace" className="([^"]*)">\s*<SynchronisedPanes/.exec(
      SOURCE,
    );
    expect(
      wrapper,
      "#blueprint-workspace is no longer the wrapper directly around <SynchronisedPanes>, " +
        "so the rail's `Graph and cards` row lands somewhere else on the page",
    ).not.toBeNull();
    expect(wrapper?.[1], "the graph's anchor lost its scroll offset").toContain("scroll-mt-24");
  });
});

describe("everything the page draws runs the full horizontal space", () => {
  /*
   * The standing rule of this repo. `.prose-lane` caps prose at `--measure` and `max-w-*`
   * caps it at a Tailwind step; neither may appear in any class list on this page.
   *
   * Read off `className` literals rather than the whole file, because the page's own history
   * note quotes the `mx-auto max-w-4xl` body it used to have — a substring test over the raw
   * source is red against the correct file for quoting the thing it forbids.
   */
  it("puts no width cap on anything the page draws", () => {
    const capped = CLASS_LISTS.filter((list) => /(?:^| )(?:max-w-|prose-lane)/.test(list));
    expect(
      capped,
      "a width cap is back on this page. The graph, the file list and the README all run " +
        "the width of the body; the header band above them dropped its own `max-w-2xl` for " +
        "the same reason.",
    ).toEqual([]);
  });
});

describe("the README, rendered under the folder", () => {
  /*
   * GitHub's arrangement is an order, not a component, and `the page reads:` above holds the
   * whole of it. What is local here is the source and the absent case.
   *
   * `BUNDLE_README` rather than the literal, so this page and `bundleReadme`'s writer cannot
   * drift into naming two different files — `components/bundle/load.ts` makes the same call
   * for the same reason.
   */
  it("renders the release's own README and names it", () => {
    const mount = /<ReadmePanel\b([\s\S]*?)\/>/.exec(SOURCE);
    expect(mount, "the page no longer mounts <ReadmePanel ... />").not.toBeNull();
    expect(mount?.[1]).toContain("source={readme}");
    expect(mount?.[1]).toContain("file={BUNDLE_README}");
    expect(
      SOURCE,
      "`readme` is no longer read off the release. A README this page composed would reach a " +
        "reader as the bundle author's own words.",
    ).toContain("const readme = folder?.readme;");
  });

  /*
   * An absent README draws nothing.
   *
   * `ReleaseFiles.readme` is `string | undefined` and its own docblock refuses to invent a
   * fallback, which only holds if the caller refuses too: a `?? ""` here would render an
   * empty bordered box claiming the bundle ships a README with nothing in it.
   */
  it("draws no panel when the release ships no README", () => {
    expect(SOURCE).toContain("{readme !== undefined && (");
    expect(SOURCE, "an empty README is being papered over with a fallback string").not.toMatch(
      /readme\s*\?\?/,
    );
  });
});

describe("the rail, after the sections moved", () => {
  const rows = [...SOURCE.matchAll(/\{ href: "(#[\w-]+)", label: "([^"]+)" \}/g)].map(
    ([, href, label]) => ({ href, label }),
  );

  it("names the sections the page actually draws", () => {
    expect(rows.length, "the rail's rows are no longer readable as literals").toBeGreaterThan(3);
    const hrefs = rows.map((row) => row.href);
    expect(hrefs, "the rail still points at the removed `Exact release` section").not.toContain(
      "#use-this-blueprint",
    );
    expect(hrefs, "the rail still points at the removed source panel").not.toContain(
      "#blueprint-source",
    );
    expect(hrefs, "the rail lost its row for the README").toContain("#blueprint-readme");
  });

  /*
   * The rail is the page top to bottom, or it is a list of links in an order nobody reading
   * the page experiences. The graph moved above the file list and this is the half of that
   * move a reader four screens down actually sees.
   *
   * Tool scopes has no row and that is deliberate — see `blueprintSections`' own note. It is
   * not in this table for the same reason it is not in the rail.
   */
  it("lists its rows in the page's own order", () => {
    expect(rows.map((row) => row.href)).toEqual([
      "#blueprint-workspace",
      "#files",
      "#blueprint-readme",
      "#history",
      "#community-notes",
    ]);
  });

  /*
   * The steps are stamped from the index, and a hand-typed one is the defect this replaced.
   *
   * The rail's own docblock records the count going wrong within one edit when it was typed;
   * a row that appears only for a bundle WITH a README makes typed steps strictly worse,
   * because two bundles would then need two tables. `components/site/anchors.test.ts` already
   * joins every one of these hrefs to the element declaring it, so nothing here re-asserts
   * that the anchors resolve.
   */
  it("numbers its rows from their position", () => {
    expect(SOURCE, "a step number is typed beside a row again").not.toMatch(/step: "/);
    expect(SOURCE).toContain('String(index + 1).padStart(2, "0")');
  });

  /*
   * One fact, asked once. The row and the panel are both conditional on the README existing,
   * and if they ever read two different values the rail names an anchor the page did not
   * draw — which is a link into nothing, and the reason `anchors.test.ts` exists.
   */
  it("shows the README row exactly when the README is drawn", () => {
    expect(SOURCE).toContain("blueprintSections(readme !== undefined)");
    expect(SOURCE).toContain('row.href !== "#blueprint-readme"');
  });
});

describe("what the restructure had to leave standing", () => {
  /*
   * A removal pass that took one more thing with it is the failure this is here for, and it
   * is cheap to hold because each of these is one mount. `the page reads:` above already
   * requires all seven sections; what this adds is the two that are not sections.
   */
  it("still counts the forks it no longer lists", () => {
    expect(SOURCE).toContain("forks={forkRows.length}");
    expect(
      SOURCE,
      "the fork panel's author batch is back. Nothing renders a forker's handle any more.",
    ).not.toContain("publicAuthorsByIds");
  });

  /*
   * The version line under the actions. It carries the digest, the release count and the
   * publication date, and the date has been drawn nowhere else since `At a glance` left.
   */
  it("still draws the version line under the actions", () => {
    expect(SOURCE).toContain("shortDigest(bp.digest)");
    expect(SOURCE).toContain("prettyDate(bp.createdAt)");
  });
});
