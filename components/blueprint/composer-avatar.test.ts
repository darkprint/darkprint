import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Comments, type LiveNotes, type NoteView } from "@/components/blueprint/Comments";

/**
 * The identity beside the compose box.
 *
 * `environment: "node"` (vitest.config.ts) has no DOM, so what a static render can see is
 * the first paint: who the form says the viewer is before a single click. That is the whole
 * question this suite exists for. The composer draws a mark next to an empty textarea, and
 * the viewer is not the author of any note in the thread above it — so the failure to guard
 * against is a face that belongs to somebody else appearing next to a stranger's draft.
 *
 * The signed-out cells count `linear-gradient` occurrences rather than asserting a class,
 * because `avatarGradient` is the only thing on this page that paints a person: one note by
 * one commenter must produce exactly one, and a composer that borrowed that commenter's
 * avatar, or minted a stand-in person of its own, produces two.
 */

const SOURCE = readFileSync(
  new URL("./Comments.tsx", import.meta.url),
  "utf8",
);

function note(handle: string): NoteView {
  return {
    id: `n-${handle}`,
    author: { handle, displayName: handle, avatarHue: 200 },
    body: "A note somebody else wrote.",
    createdAt: "2026-01-01T00:00:00.000Z",
    votes: 0,
    deleted: false,
    mine: false,
  };
}

function render(viewer: LiveNotes["viewer"], notes: NoteView[]): string {
  return renderToStaticMarkup(
    createElement(Comments, {
      comments: [],
      live: {
        target: { kind: "blueprint", refId: "r1" },
        apiBase: "/api/blueprints/o/s/notes",
        initial: { notes, cursor: null },
        viewer,
      },
    }),
  );
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("the compose box's avatar", () => {
  it("draws the viewer's own mark, ahead of the textarea", () => {
    const html = render({ signedIn: true, handle: "ada", displayName: "Ada L" }, []);
    const mark = html.indexOf("linear-gradient");
    const textarea = html.indexOf("<textarea");
    expect(mark, "no avatar rendered beside the compose box").toBeGreaterThan(-1);
    expect(textarea).toBeGreaterThan(-1);
    expect(mark, "the mark must lead the textarea, the way the posted notes lead their body")
      .toBeLessThan(textarea);
    // The initials are the viewer's own, not a placeholder's.
    expect(html).toContain(">AL<");
  });

  it("prefers the viewer's stored hue over the one derived from their handle", () => {
    const derived = render({ signedIn: true, handle: "ada" }, []);
    const stored = render({ signedIn: true, handle: "ada", avatarHue: 7 }, []);
    expect(stored).toContain("hsl(7 70% 72%)");
    expect(
      derived,
      "an account with no stored hue still needs one colour, and the same one its notes get",
    ).toContain("linear-gradient");
    expect(stored, "a stored hue that renders as the handle-derived one is not being read")
      .not.toBe(derived);
  });

  it("gives a signed-out viewer a ring and nobody's face", () => {
    const html = render({ signedIn: false }, [note("someone-else")]);
    expect(html).toContain("Sign in to post a note.");
    expect(html).toContain("border-dashed");
    expect(
      occurrences(html, "linear-gradient"),
      "one commenter is one avatar; a second means the signed-out slot borrowed a face",
    ).toBe(1);
  });

  it("gives a signed-in viewer with no handle a ring rather than an invented person", () => {
    /* `viewer.signedIn` is true and `handle` optional on the same object, so the page can
       hand this component an actor it cannot name. There is no honest face for that. */
    const html = render({ signedIn: true }, [note("someone-else")]);
    expect(html).toContain("<textarea");
    expect(html).toContain("border-dashed");
    expect(occurrences(html, "linear-gradient")).toBe(1);
  });

  it("does not link the viewer's own mark away from their draft", () => {
    const html = render({ signedIn: true, handle: "ada" }, []);
    expect(
      html,
      "a link one tab stop before an unposted draft offers to navigate away from it",
    ).not.toContain("<a ");
  });

  it("caps the width of nothing", () => {
    // The standing rule: text and panels run full width. `container-page` is the only cap.
    expect(SOURCE).not.toContain("max-w-");
  });
});
