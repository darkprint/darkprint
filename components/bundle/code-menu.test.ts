/* ============================================================
   The "Code" control, read the way a reader with no JavaScript gets it.

   `CodeMenu` is a server component and a native `<details>`, and both halves of that are
   load-bearing rather than stylistic. The command, its limit and every file link are in
   the prerendered HTML whether the panel is open or shut, which is the property that makes
   the sentences below assertable at all: `ForkAction`'s `open && (…)` toggle renders none
   of its panel into a static string, and no cell can be written over what is not there.

   So this renders with `renderToStaticMarkup` — the same idiom as
   `components/blueprint/attractor-compatibility.test.ts` — and reads the markup. Two
   readings, not one: `plainText` is everything, `openText` drops the body of a closed
   disclosure. A cell that used only the first could not tell a panel from a paragraph.
   ============================================================ */

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openText, plainText } from "@/components/ui/visible-text";

import { CodeMenu } from "./CodeMenu";

/**
 * A real release's shape: `<owner>/<slug>` and a version, which is the two-part key
 * `packages/cli/src/clone.ts` parses and refuses anything else for.
 */
const COMMAND = "darkprint clone darkprint/starter-software-factory --version 1.2.0";

/** The line that runs today: every file of the release at its digest address, in one `curl`. */
const CURL =
  'curl --fail-early -fsSL --create-dirs -o "starter-software-factory/#1" "https://darkprint.io/api/files/blueprints/darkprint/starter-software-factory/d/sha256:abc/{README.md,topology.dot}"';

/** `releaseFiles` order and spelling: bundle-relative, forward slashes. */
const FILES = [
  { path: "README.md", href: "/api/blueprints/darkprint/starter/files/README.md" },
  { path: "topology.dot", href: "/api/blueprints/darkprint/starter/files/topology.dot" },
  {
    path: "cards/spec-planner@1.0.0.yaml",
    href: "/api/blueprints/darkprint/starter/files/cards/spec-planner@1.0.0.yaml",
  },
] as const;

function render(files: readonly { path: string; href: string }[] = FILES): string {
  return renderToStaticMarkup(createElement(CodeMenu, { command: CURL, cliCommand: COMMAND, files }));
}

const HTML = render();

describe("the panel a reader gets before any script runs", () => {
  it("rendered something", () => {
    // A ledger held over an empty string passes every case under it.
    expect(HTML.length).toBeGreaterThan(900);
  });

  it("is a native disclosure, shut, and says what it downloads", () => {
    expect(HTML).toContain("<details");
    expect(HTML).toContain("<summary");
    // `open` in the static markup would mean the panel ships expanded, which is a different
    // control from the one the owner asked for.
    expect(/<details[^>]*\bopen\b/.test(HTML)).toBe(false);
    // The label the owner named on 2026-09-06, moving this control into the header band:
    // "the order should be: star, fork, download blueprint". It said `Code` on the file
    // list, where the folder it downloaded was the thing it sat on; in a row of actions the
    // label has to say what pressing it does.
    expect(openText(HTML)).toContain("Download blueprint");
    expect(openText(HTML), "the trigger still says `Code`").not.toContain("Code");
  });

  /**
   * The label and the register are the two things a card's page changes, and nothing else is
   * negotiable — see the `label` prop's own docblock for why the panel's prose is not.
   *
   * AMBER, on the owner's ruling of 2026-09-06: "the amber should be the dominant color on
   * the cards sections. So that an user in a glance can know wheter they are on a blueprint
   * or in a card." This cell asserted the exact opposite until that ruling, on the strength
   * of a reservation in `app/globals.css` that gave amber two claims and no third. The
   * reservation has a third job now and it is this one, so the cell is inverted rather than
   * softened: it still names tokens rather than looks, and it still holds BOTH directions.
   *
   * Both directions is the whole point. A tone that leaked across callers — one map entry
   * repointed, or a default changed — would be invisible to a cell that only ever rendered
   * the card, and the blueprint going amber is the failure this pass could most easily
   * cause. So the blueprint is rendered too, and it must still be cyan and must carry no
   * amber at all.
   */
  it("takes a caller's label and the amber register", () => {
    const card = renderToStaticMarkup(
      createElement(CodeMenu, {
        command: CURL,
        cliCommand: COMMAND,
        files: FILES,
        label: "Download card",
        tone: "amber" as const,
      }),
    );
    expect(openText(card)).toContain("Download card");
    /* The register lives on the trigger. The panel body carries amber on both callers, in
       the badge that fences the CLI line, so the register is read off the `<summary>`. */
    const trigger = (html: string) => html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(trigger(card), "the amber register is not drawn from `--color-amber`").toContain("amber");
    expect(
      card,
      "a card's download is still drawing the copper register the owner overruled",
    ).not.toContain("copper");
    expect(trigger(card), "the card's trigger took the blueprint's cyan").not.toContain("cyan");
    // And the default is still the blueprint's.
    expect(trigger(HTML)).toContain("border-cyan/40");
    expect(trigger(HTML), "the blueprint's download took the card register").not.toContain("amber");
    expect(HTML).not.toContain("copper-line");
  });

  /**
   * The card's trigger takes the register WITHOUT taking the shape an honesty claim wears.
   *
   * `app/globals.css` job 3 buys a reader one glance and pays for it in local ambiguity:
   * amber is now a place as well as two claims, and on a card page all three are on screen
   * together. What separates them is form. `ComingSoonBadge` is a small FILLED amber pill;
   * the leaves-the-page box is a FILLED amber rectangle with a heavy leading rule. So the
   * register must stay line work, and this trigger must never sit on an amber ground at
   * rest — a filled amber pill in a header band is `ComingSoonBadge`'s shape and colour
   * both, and a reader would have no way left to tell the download from a status marker.
   *
   * Hover is exempt and deliberately so: it is transient, pointer-only, and never on screen
   * beside a badge the reader is comparing it against.
   */
  it("does not wear an honesty claim's shape while wearing its colour", () => {
    const card = renderToStaticMarkup(
      createElement(CodeMenu, {
        command: CURL,
        cliCommand: COMMAND,
        files: FILES,
        label: "Download card",
        tone: "amber" as const,
      }),
    );
    const summary = card.slice(card.indexOf("<summary"), card.indexOf("</summary>"));
    expect(summary.length, "no <summary> in the rendered menu").toBeGreaterThan(100);
    expect(summary, "the trigger has no amber at all, so the register did not land").toContain(
      "amber",
    );
    const rest = summary.replace(/hoverable:hover:[^\s"]+/g, "");
    expect(
      rest,
      "the card's trigger sits on an amber ground at rest, which is the filled shape " +
        "`ComingSoonBadge` and the leaves-the-page box use to make a claim. Line work only.",
    ).not.toMatch(/\bbg-amber/);
  });

  it("carries the command and every file inside the shut panel", () => {
    // `plainText` reads the whole document; `openText` reads what a reader sees without
    // opening anything. The pair is what says the body is really behind the summary AND
    // really in the HTML, which one reading alone cannot distinguish.
    expect(plainText(HTML)).toContain(CURL);
    expect(openText(HTML)).not.toContain(CURL);
    expect(plainText(HTML)).toContain(COMMAND);
    expect(openText(HTML)).not.toContain(COMMAND);
    for (const file of FILES) {
      expect(plainText(HTML)).toContain(file.path);
      expect(openText(HTML)).not.toContain(file.path);
    }
  });

  it("links each file at the href it was handed, and asks for a download", () => {
    for (const file of FILES) {
      expect(HTML).toContain(`href="${file.href}"`);
      // Without `download` a browser renders `README.md` and `topology.dot` inline as text
      // rather than writing them to disk, which is not what a file list offers.
      expect(HTML).toContain(`download="${file.path}"`);
    }
  });

  it("counts the files it lists", () => {
    expect(plainText(HTML)).toContain(`${FILES.length} files`);
    expect(plainText(render([FILES[0]]))).toContain("1 file");
    // Not "1 files". The singular is a rendering the plural cell cannot see.
    expect(plainText(render([FILES[0]]))).not.toContain("1 files");
  });

  it("draws no list at all for a bundle with no published release", () => {
    const empty = render([]);
    expect(empty).not.toContain("<ul");
    expect(plainText(empty)).not.toContain("Files");
    // The command survives the empty case: a bundle with nothing to list is still a
    // bundle somebody may clone once it has a release.
    expect(plainText(empty)).toContain(CURL);
  });

  /**
   * The order is the panel's argument: the command that runs comes first, and the CLI line
   * that does not run on a stranger's machine sits last, under the badge that says so. A
   * reader who has just been handed a working command reads the next code block as another
   * one unless the panel says otherwise before they reach it.
   */
  it("puts the working command first and the CLI line under the badge", () => {
    const text = plainText(HTML);
    const curl = text.indexOf(CURL);
    const badge = text.indexOf("Coming soon");
    const cli = text.indexOf(COMMAND);
    expect(curl, "the curl line is missing").toBeGreaterThan(-1);
    expect(badge, "the badge is missing").toBeGreaterThan(curl);
    expect(cli, "the CLI line is not under the badge").toBeGreaterThan(badge);
  });
});

describe("claims this panel may not stop making", () => {
  /**
   * `darkprint clone` is implemented — `packages/cli/src/clone.ts` — and the package that
   * would put it on a machine that has never seen this repository is not published.
   * `app/capabilities/page.tsx` states the same gap at length. A panel printing a command
   * in a code block says "run this", and a reader who runs it gets a 404 from npm unless
   * this sentence is beside it.
   */
  it("says the package is not published to npm", () => {
    expect(plainText(HTML).toLowerCase()).toContain("not published to npm");
  });

  /**
   * The honest difference from what the word "clone" promises. Copying a release's files
   * is a snapshot: no repository, no history, nothing to pull. The same sentence is pinned
   * on the older menus by `components/site/honesty.test.ts`; this control is the surface
   * that replaces them on the blueprint page, so it inherits the claim rather than
   * dropping it.
   */
  it("says it is a snapshot", () => {
    expect(plainText(HTML).toLowerCase()).toContain("a snapshot, not a clone");
  });

  /**
   * There is no repository behind a bundle. `honesty.test.ts` holds the word off both
   * older menus under any later wording pass, and the reason applies here unchanged: a
   * reader who meets it expects a remote, a history and an update path, none of which
   * exist.
   */
  it("never says git", () => {
    expect(plainText(HTML).toLowerCase()).not.toContain("git");
  });
});

describe("the component's own shape", () => {
  /**
   * A server component, which is why the panel is in the prerendered HTML at all. The
   * cells above cannot see this: `renderToStaticMarkup` renders a `"use client"` module
   * exactly the same way, so the one thing that would move this whole file's subject out
   * of the static page is invisible to every assertion over its output.
   *
   * Read off the source for that reason, and matched on the directive with its quotes so
   * the prose in this file and in the component's own header — both of which discuss
   * client components — cannot satisfy or break it.
   */
  it("is not a client component", () => {
    const source = readFileSync(new URL("./CodeMenu.tsx", import.meta.url), "utf8");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("'use client'");
  });
});
