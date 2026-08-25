/* ============================================================
   T261 — the honesty markers, in the one direction they move, and
   the command spellings that move the other way in the same commit.

   D-78 has two directions: a marker over a figure that became real
   comes OFF in the change that makes it real; a marker over a
   figure still seeded STAYS. This cutover has one of each on ONE
   surface, which is what makes it worth its own file.

     STAYS   the `ComingSoonBadge` and "Not built yet" copy on both
             clone menus. D-270-01 C10: the CLI's honesty
             disclosures stay TRUE because npm publishing remains
             out of scope — there is still nothing to install. The
             figure did not become real, so removing the marker is
             the FALSE-CLAIM direction.
     CHANGES the two blueprint CLI spellings, to
             `darkprint clone {ownerHandle}/{slug}` (D-261-07(6),
             D-270-07's surface arriving at its site). B-09 moved
             the identity; a command naming a bare slug now names
             something that does not resolve.
     STAYS   the node menu's `clone card <ref>` spelling AND its
             not-built sentence — permanently true, because
             D-270-01 C10 withdrew that verb rather than deferring
             it.

   ── the gap this file is actually for ──
   `components/site/honesty.test.ts` pins the SENTENCES and holds
   five rows over T261 surfaces. It does NOT hold the commands:
   its `CLONE_BLUEPRINT` fixture passes `command` and `cliCommand`
   as HARDCODED STRING PROPS (`honesty.test.ts:262-268`), so the
   producers can emit anything at all and that file stays green.
   Nothing in the repository holds what the page actually builds.
   That is what the spelling cells below are.

   ── and why the ledger's own membership is asserted here ──
   D-261-07(5) GRANTS a re-pin of `honesty.test.ts` and of
   `tests/server/t260/frozen-tests.test.ts`'s blob in the same
   commit. That path is sanctioned and it is also the one way a
   ledger row can leave without anything redding: re-pin the file,
   and the blob guard agrees with whatever the file now says. So
   the five T261 rows are named here, on the other branch, where a
   re-pin cannot reach them.
   ============================================================ */

import { existsSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CloneMenu } from "@/components/blueprint/CloneMenu";

import { sources } from "./contract";

/**
 * The two files that build a blueprint's `darkprint clone` line.
 *
 * The page is named at BOTH of its possible paths because this migration moves it: before
 * the cutover the producer is in `[slug]`, after it in `[owner]/[slug]`. Naming both and
 * requiring exactly one to exist is how a route move stays visible here instead of
 * silently shrinking the scan to `load.ts` alone.
 */
const BLUEPRINT_PAGE_CANDIDATES = [
  "app/blueprints/[owner]/[slug]/page.tsx",
  "app/blueprints/[slug]/page.tsx",
] as const;

const BUNDLE_LOAD = "components/bundle/load.ts";
const NODE_PAGE = "app/nodes/[...id]/page.tsx";

/** The blueprint detail page, wherever the migration has left it. */
function blueprintPage(): string {
  const present = BLUEPRINT_PAGE_CANDIDATES.filter((path) => existsSync(path));
  if (present.length === 0) {
    throw new Error(
      `neither ${BLUEPRINT_PAGE_CANDIDATES.join(" nor ")} exists. The blueprint detail page ` +
        `is gone, not moved.`,
    );
  }
  // Both existing is legitimate mid-migration: `[slug]` becomes the redirector (D-261-02).
  // The one that carries a clone menu is the detail page; prefer the canonical path.
  const [first] = sources([present[0]], 1);
  return first.raw;
}

const menu = (kind: "blueprint" | "node", cliCommand: string) =>
  renderToStaticMarkup(
    createElement(CloneMenu, {
      kind,
      command: 'curl -fsSL -O "https://darkprint.io/x"',
      cliCommand,
    }),
  );

describe("D-78 stays-direction: the CLI is still not installable", () => {
  /*
   * The premise. `CloneMenu` is a native `<details>`, so its panel is in the markup whether
   * open or shut — honesty.test.ts:249-253 records why that matters. If it ever became an
   * `open && (…)` toggle, every assertion below would be about a string that is simply not
   * in the render, and they would all pass or all fail for a reason that is not honesty.
   */
  it("renders its panel without being opened", () => {
    const html = menu("blueprint", "darkprint clone darkprint/starter-software-factory");
    expect(html.length, "CloneMenu rendered nothing").toBeGreaterThan(200);
    expect(
      html.toLowerCase(),
      "CloneMenu's panel is no longer in the static markup. It has stopped being a " +
        "`<details>`, so nothing below is measuring what a reader sees.",
    ).toContain("snapshot, not a clone");
  });

  it.each(["blueprint", "node"] as const)("%s menu keeps its not-built marker", (kind) => {
    const html = menu(kind, kind === "node" ? "darkprint clone card a@1.0.0" : "darkprint clone o/s");

    expect(
      html.toLowerCase(),
      `the ${kind} clone menu no longer says the CLI is not built.\n\n` +
        `D-270-01 C10: the CLI's honesty disclosures STAY TRUE — npm publishing is out of ` +
        `scope, so there is still nothing to install. T270 shipping a \`darkprint\` binary ` +
        `does NOT make this figure real for a reader of this page, and D-78's first ` +
        `direction does not fire. Removing this marker is the false-claim direction.`,
    ).toContain("not built yet");

    expect(
      html,
      `the ${kind} clone menu lost its ComingSoonBadge. The badge and the sentence are one ` +
        `marker; dropping either half leaves a code block that reads as runnable beside a ` +
        `curl line that genuinely is.`,
    ).toMatch(/amber/);
  });
});

describe("D-261-07(6): the blueprint CLI spelling moves with the URL", () => {
  /*
   * The claim honesty.test.ts cannot make.
   *
   * Its CLONE_BLUEPRINT fixture passes `cliCommand` as a hardcoded prop, so the ledger is
   * green whatever the producers emit. These two cells are the only thing holding the
   * command the page actually builds — and after B-09 a bare slug names nothing that
   * resolves.
   */
  it("the blueprint detail page emits an owner-qualified clone command", () => {
    const raw = blueprintPage();
    const commands = [...raw.matchAll(/darkprint clone ([^`"'\n]*)/g)].map(([, rest]) => rest.trim());

    expect(
      commands.length,
      "this file no longer builds a `darkprint clone` line at all. If the menu moved, move " +
        "this cell with it; if the command was dropped, that is a copy change needing the " +
        "ruling D-261-07(6) is.",
    ).toBeGreaterThan(0);

    for (const rest of commands) {
      // `card ...` is the node verb and is ruled unchanged; it does not appear on this
      // page today and is skipped rather than asserted about, so this cell stays about
      // blueprints even if one file ever carries both.
      if (rest.startsWith("card ")) continue;
      expect(
        rest,
        `\`darkprint clone ${rest}\` names a bare slug.\n\n` +
          `B-09 moved the identity to \`{ownerHandle}/{slug}\` and D-270-07 made \`--target\` ` +
          `take that same key — nothing in a bundle directory can supply the owner, so the ` +
          `caller must. A command naming a slug alone now resolves to nothing, and it is ` +
          `printed on the page as a preview a reader will one day paste.\n\n` +
          `D-261-07(6) rules this spelling becomes \`darkprint clone {ownerHandle}/{slug}\`.`,
      ).toMatch(/\$\{[^}]*(owner|handle)[^}]*\}\//i);
    }
  });

  /**
   * `components/bundle/load.ts` used to be the second arm of the cell above, and that was
   * WRONG IN BOTH DIRECTIONS — the finding is D-261-16's.
   *
   * It still spells the pre-B-09 `darkprint clone ${slug}` at `:200`, and it reaches no
   * reader: `publishedBundleSections` is called only by `bundleView`, `bundleView` has no
   * callers, `ownedBundleParams` has no callers. A closed cluster with no external entry
   * point, left behind when `/u/[username]/[slug]` became an unconditional redirector.
   * Measured repo-wide excluding `node_modules` and `.next`.
   *
   * So the old cell charged a reader-facing copy defect against code no reader can reach —
   * AND it would have gone GREEN if that dead code were simply deleted while the live page
   * stayed wrong. It bound a FILE instead of a rendered surface.
   *
   * The honest claim in its place is the one that is actually true and actually load-bearing:
   * the stale spelling is unreachable, and must stay unreachable until it is deleted
   * (D-261-16 assigns that deletion to the orchestrator's merge-adjacent commit). If anyone
   * wires this cluster back onto a page while it still carries the old command, this reds.
   */
  it("the stale clone spelling in components/bundle/load.ts reaches no reader", () => {
    const [load] = sources([BUNDLE_LOAD], 1);
    const stale = /darkprint clone \$\{slug\}/.test(load.raw);
    if (!stale) return; // deleted under D-261-16; nothing left to be unreachable.

    /* Named, not walked: these are every module that could put a clone line on screen. A
       walk that stopped matching would report "no callers" for the wrong reason. */
    const CALLERS = [
      "app/blueprints/[owner]/[slug]/page.tsx",
      "app/nodes/[...id]/page.tsx",
      "components/bundle/BundleHeader.tsx",
      "components/blueprint/CloneMenu.tsx",
      "components/blueprint/DownloadPanel.tsx",
    ];
    const wired = sources(CALLERS, CALLERS.length).filter((file) =>
      /\b(publishedBundleSections|bundleView|ownedBundleParams)\b/.test(file.raw),
    );

    expect(
      wired.map((f) => f.path),
      "a rendering surface now imports the dead bundle-view cluster, which still spells " +
        "`darkprint clone ${slug}` — the pre-B-09 command that resolves to nothing. Either " +
        "delete the cluster (D-261-16) or fix its spelling before wiring it to a page.",
    ).toEqual([]);
  });

  it(`${NODE_PAGE} keeps the withdrawn card verb unchanged`, () => {
    const [page] = sources([NODE_PAGE], 1);
    expect(
      page.raw,
      "the node page's `darkprint clone card` spelling changed. D-270-01 C10 WITHDREW that " +
        "verb rather than deferring it, and D-261-07(6) rules this one STAYS — its not-built " +
        "sentence is permanently true. Re-spelling a command that will never ship is churn " +
        "that makes the marker beside it look negotiable.",
    ).toContain("darkprint clone card ");
  });
});

describe("the five ledger rows over T261 surfaces are still in honesty.test.ts", () => {
  /*
   * D-261-07(5) grants a re-pin of this file AND of the blob guard that freezes it, in one
   * commit. That is the sanctioned path and it is also the only way a row leaves without
   * anything redding — the blob guard agrees with whatever the file now says. Named here,
   * on the other branch, where a re-pin cannot reach them.
   *
   * Sentences, not line numbers: a re-pin that legitimately rewords one of these should red
   * here and be re-stated deliberately, which is the same discipline the blob pin asks for.
   */
  const ROWS = [
    "seeing the evidence of a failure you caused is feedback, seeing the criteria is gaming",
    "not evidence of a leak, and it is not evidence of isolation either",
    "not built yet: a darkprint cli that clones a blueprint by name",
    "a snapshot, not a clone",
    "not built yet: a darkprint cli that clones a card by name",
  ];

  it.each(ROWS)("still pins: %s", (says) => {
    const [ledger] = sources(["components/site/honesty.test.ts"], 1);
    expect(
      ledger.raw.toLowerCase(),
      `\`honesty.test.ts\` no longer pins this sentence.\n\n` +
        `It is one of the five rows whose surfaces are T261's (\`BlueprintCanvas\` and ` +
        `\`CloneMenu\`, both in this task's Owns). D-261-07(5) grants a re-pin of that file ` +
        `and of \`tests/server/t260/frozen-tests.test.ts\`'s blob together — so a row can be ` +
        `removed with both guards agreeing and nothing redding but this cell.\n\n` +
        `If the sentence was legitimately reworded under D-78, restate it here deliberately. ` +
        `If it was deleted, the claim it made about a T261 surface is now unguarded.`,
    ).toContain(says.toLowerCase());
  });

  it("names five, so a dropped row cannot shrink the check", () => {
    expect(ROWS).toHaveLength(5);
    expect(new Set(ROWS).size).toBe(5);
  });
});
