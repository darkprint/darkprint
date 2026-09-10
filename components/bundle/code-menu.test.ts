/* ============================================================
   The "Get blueprint" control, read the way a reader with no JavaScript gets it.

   `CodeMenu` is a server component and a native `<details>`, and both halves of that are
   load-bearing rather than stylistic. Both items and every sentence under them are in the
   prerendered HTML whether the panel is open or shut, which is the property that makes the
   sentences below assertable at all: a panel gated on `open && (…)` renders none of itself
   into a static string, and no cell can be written over what is not there.

   So this renders with `renderToStaticMarkup` and reads the markup. Two readings, not one:
   `plainText` is everything, `openText` drops the body of a closed disclosure. A cell that
   used only the first could not tell a panel from a paragraph.
   ============================================================ */

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { openText, plainText } from "@/components/ui/visible-text";

import { CodeMenu } from "./CodeMenu";

/** The CLI's own grammar: `<owner>/<slug>`, the two-part key `packages/cli/src/clone.ts` parses. */
const CLONE = "npx -y darkprint clone darkprint/starter-software-factory";

/** The archive route pinned to the release's digest, and the name the browser saves it as. */
const DOWNLOAD = {
  href: "/api/bundles/darkprint/starter-software-factory/archive?digest=sha256%3Aabc",
  name: "starter-software-factory-1.2.0.tgz",
} as const;

function render(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CodeMenu, { download: DOWNLOAD, cloneCommand: CLONE, ...extra }),
  );
}

const HTML = render();
const CARD = render({ label: "Get card", tone: "amber" });

/** The item headings, in document order, read off the one class both of them wear. */
function headings(html: string): string[] {
  return [...html.matchAll(/class="label-lead text-fg">([^<]*)</g)].map((m) => m[1]!);
}

describe("the panel a reader gets before any script runs", () => {
  it("rendered something", () => {
    // A ledger held over an empty string passes every case under it.
    expect(HTML.length).toBeGreaterThan(900);
  });

  it("is a native disclosure, shut, and names what it gets", () => {
    expect(HTML).toContain("<details");
    expect(HTML).toContain("<summary");
    // `open` in the static markup would mean the panel ships expanded, which is a different
    // control from the one the owner asked for.
    expect(/<details[^>]*\bopen\b/.test(HTML)).toBe(false);
    // A neutral verb, the way GitHub's "Code" is: the menu clones as well as downloads, so a
    // trigger that said "Download" would name half of what pressing it offers.
    expect(openText(HTML)).toContain("Get blueprint");
    expect(openText(HTML), "the trigger still says `Code`").not.toContain("Code");
    expect(openText(HTML), "the trigger still names only the download").not.toContain("Download");
  });

  /**
   * The label and the register are the two things a card's page changes, and nothing else is
   * negotiable; see the `label` prop's own docblock for why the panel's prose is not.
   *
   * Both directions, because a tone that leaked across callers would be invisible to a cell
   * that only ever rendered the card: the blueprint is rendered too, and it must still be
   * cyan and carry no amber on its trigger.
   */
  it("takes a caller's label and the amber register", () => {
    expect(openText(CARD)).toContain("Get card");
    const trigger = (html: string) => html.slice(html.indexOf("<summary"), html.indexOf("</summary>"));
    expect(trigger(CARD), "the amber register is not drawn from `--color-amber`").toContain("amber");
    expect(CARD, "a card's menu is drawing the copper register the owner overruled").not.toContain(
      "copper",
    );
    expect(trigger(CARD), "the card's trigger took the blueprint's cyan").not.toContain("cyan");
    // And the default is still the blueprint's.
    expect(trigger(HTML)).toContain("border-cyan/40");
    expect(trigger(HTML), "the blueprint's trigger took the card register").not.toContain("amber");
    expect(HTML).not.toContain("copper-line");
  });

  /**
   * The card's trigger takes the register WITHOUT taking the shape an honesty claim wears.
   *
   * Amber is a place as well as a claim on a card page, and what separates them is form.
   * `ComingSoonBadge` is a small FILLED amber pill; the leaves-the-page box is a FILLED amber
   * rectangle with a heavy leading rule. So the register must stay line work, and this
   * trigger must never sit on an amber ground at rest. Hover is exempt: it is transient,
   * pointer-only, and never on screen beside a badge the reader is comparing it against.
   */
  it("does not wear an honesty claim's shape while wearing its colour", () => {
    const summary = CARD.slice(CARD.indexOf("<summary"), CARD.indexOf("</summary>"));
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

  it("carries both items inside the shut panel", () => {
    // `plainText` reads the whole document; `openText` reads what a reader sees without
    // opening anything. The pair is what says the body is really behind the summary AND
    // really in the HTML, which one reading alone cannot distinguish.
    expect(plainText(HTML)).toContain(DOWNLOAD.name);
    expect(openText(HTML)).not.toContain(DOWNLOAD.name);
    expect(plainText(HTML)).toContain(CLONE);
    expect(openText(HTML)).not.toContain(CLONE);
  });

  /**
   * Exactly two items, Download then Clone, which is the owner's instruction and GitHub's
   * shape. Counted off the headings rather than searched for, so a third item added later
   * reds here instead of arriving unnoticed.
   */
  it("has exactly two items, Download then Clone", () => {
    expect(headings(HTML)).toEqual(["Download", "Clone"]);
    const text = plainText(HTML);
    expect(text.indexOf(DOWNLOAD.name), "the archive link is missing").toBeGreaterThan(-1);
    expect(text.indexOf(DOWNLOAD.name)).toBeLessThan(text.indexOf(CLONE));
  });

  it("links the archive it was handed, and asks for a download", () => {
    expect(HTML).toContain(`href="${DOWNLOAD.href.replace(/&/g, "&amp;")}"`);
    // Without `download` a browser may open a `.tgz` inline rather than writing it to disk,
    // which is not what a Download item offers.
    expect(HTML).toContain(`download="${DOWNLOAD.name}"`);
  });

  it("offers the clone line to the clipboard", () => {
    expect(HTML).toContain('aria-label="Copy the clone command"');
  });

  /**
   * The badge sits under the clone line and not over the download. A reader who has just
   * been handed a working file reads the next code block as another working thing unless
   * the panel says otherwise beside it, and the only thing here that does not run on a
   * stranger's machine is the command.
   */
  it("fences the clone line, not the download, with the badge", () => {
    const text = plainText(HTML);
    const download = text.indexOf(DOWNLOAD.name);
    const clone = text.indexOf(CLONE);
    const badge = text.indexOf("Coming soon");
    expect(badge, "the badge is missing").toBeGreaterThan(-1);
    expect(badge, "the badge sits before the download").toBeGreaterThan(download);
    expect(badge, "the badge sits before the clone line it qualifies").toBeGreaterThan(clone);
  });
});

describe("claims this panel may not stop making", () => {
  /**
   * `darkprint clone` is implemented in `packages/cli/src/clone.ts`, and the package that
   * would put it on a machine that has never seen this repository is not published. A panel
   * printing a command with a copy button says "run this", and a reader who runs it gets a
   * 404 from npm unless this sentence is beside it.
   */
  it("says the package is not published to npm", () => {
    expect(plainText(HTML).toLowerCase()).toContain("not published to npm");
  });

  /**
   * What the two items are, and what neither is. There is no repository behind a release
   * and no history, so Download hands over the files as they stand and Clone fetches the
   * same files by name. `components/site/honesty.test.ts` pins the same sentence; this is
   * the surface it is read off.
   */
  it("says there is no repository behind a release", () => {
    expect(plainText(HTML).toLowerCase()).toContain(
      "there is no repository and no history behind a release",
    );
  });

  /**
   * There is no repository behind a bundle. `honesty.test.ts` holds the word off both menus
   * under any later wording pass: a reader who meets it expects a remote, a history and an
   * update path, none of which exist.
   */
  it("never says git", () => {
    expect(plainText(HTML).toLowerCase()).not.toContain("git");
  });
});

describe("the component's own shape", () => {
  /**
   * A server component, which is why the panel is in the prerendered HTML at all. The cells
   * above cannot see this: `renderToStaticMarkup` renders a `"use client"` module exactly the
   * same way, so the one thing that would move this whole file's subject out of the static
   * page is invisible to every assertion over its output. Read off the source for that
   * reason, and matched on the directive with its quotes so prose discussing client
   * components cannot satisfy or break it.
   */
  it("is not a client component", () => {
    const source = readFileSync(new URL("./CodeMenu.tsx", import.meta.url), "utf8");
    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("'use client'");
  });
});
