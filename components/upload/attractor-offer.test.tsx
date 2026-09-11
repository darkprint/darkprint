/* ============================================================
   The offer panel, rendered

   The module beside this one is checked over its return values.
   This file is checked over the words a reader actually sees,
   because the three things this lane promises are all sentences:

     1. what an import cannot carry across, named before the press
     2. that a reader with no handle is REFUSED rather than routed
        around, and told why
     3. that the empty `spec` and the empty ports are announced at
        the moment they happen, and not left to the validator

   A prose assertion is only worth its bytes if it can see the
   sentence in every shape the renderer can produce it in — split
   over a line break, cut in half by a `<span>`, or moved into an
   attribute. `text()` strips markup and flattens whitespace, and
   the `disabled` assertion reads the attribute, so the two halves
   are checked where each of them lives.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AttractorImported, AttractorOffer } from "./AttractorOffer";
import { detectAttractorPipeline, importSelection } from "./attractor";
import type { UploadSession } from "./session";

const PIPELINE = `digraph release_train {
  goal="Ship the release without breaking the build.";
  label="Release train";

  start [label="start", shape=Mdiamond];
  plan  [label="Plan", shape=box, prompt="Read the changelog and write the release plan.", timeout="900s", owner="ops"];
  build [label="Build", shape=parallelogram, tool_command="make release", goal_gate=true];
  sign  [label="Sign off", shape=hexagon, type="wait.human"];
  exit  [label="exit", shape=Msquare];

  start -> plan;
  plan  -> build;
  build -> sign;
  sign  -> exit;
}
`;

const CANDIDATE = detectAttractorPipeline({ name: "release.dot", text: PIPELINE });

/** Every entity `renderToStaticMarkup` writes, back to the character it stands for. */
function decode(markup: string): string {
  return markup
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    /* The typographic apostrophes and quotes the copy is written with (`&rsquo;` in the
       source, U+2019 in the markup). Folded to ASCII so an assertion can be typed on a
       keyboard: the alternative is a test file carrying invisible characters that a later
       editor silently replaces. */
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

/**
 * The rendered panel as one line of plain text.
 *
 * Tags out and whitespace flattened, in that order. A sentence in this panel is broken by
 * a `<span className="font-mono">` on nearly every technical word, and both halves of that
 * break also land on separate source lines, so an assertion over the raw markup would miss
 * the sentence it was written to hold.
 */
function text(markup: string): string {
  return decode(markup.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function offer(session: UploadSession): string {
  expect(CANDIDATE, "the fixture stopped reading as an Attractor pipeline").toBeDefined();
  if (CANDIDATE === undefined) throw new Error("unreachable");
  return renderToStaticMarkup(
    createElement(AttractorOffer, {
      candidate: CANDIDATE,
      session,
      onImport: () => undefined,
    }),
  );
}

const READY: UploadSession = { state: "ready", accountId: "acct_1", handle: "berti" };

describe("the offer, before anything is converted", () => {
  it("does not pass vacuously: the fixture is a pipeline with something to lose", () => {
    expect(CANDIDATE?.nodes).toBe(3);
    expect(CANDIDATE?.unprompted).toBe(2);
    expect(CANDIDATE?.losses.length).toBeGreaterThan(0);
  });

  it("names the file, and what it is being offered", () => {
    const plain = text(offer(READY));
    expect(plain).toContain("release.dot reads as an Attractor pipeline");
    expect(plain).toContain("Read it into a draft bundle");
  });

  it("says what will be written into the cards, at the version the importer uses", () => {
    const plain = text(offer(READY));
    // The exact sentence `draftAttributionLine` builds from `import.ts`'s own two
    // constants, so this reds if either the version or the provenance marker moves.
    expect(plain).toContain(
      "Each card carries version 0.1.0, author berti, and provenance derived:attractor release.dot.",
    );
    expect(plain).toContain("A draft, and never a release.");
  });

  it("names every attribute of this file that will not be carried across", () => {
    const plain = text(offer(READY));
    for (const attribute of ["timeout", "goal_gate", "owner", "type"]) {
      expect(plain, `${attribute} is dropped and the panel did not name it`).toContain(attribute);
    }
    expect(plain).toContain("Attractor reads these and no card field holds them");
    expect(plain).toContain("the handler override, which the shape decides here instead");
    expect(plain).toContain("your own attributes, which Attractor never read either");
    // The one sentence that tells a reader what to do about all of it.
    expect(plain).toContain("Keep the file you dropped");
  });

  it("announces the empty specs, with the count and the reason the format allows them", () => {
    const plain = text(offer(READY));
    expect(plain).toContain("2 of the 3 nodes carry no prompt");
    // §2.6 gives `prompt` the default "", and §4.10 / §4.6 are why a node may not need one.
    expect(plain).toContain("§2.6");
    expect(plain).toContain("§4.10");
    expect(plain).toContain("§4.6");
    expect(plain).toContain("cards arrive with an empty spec");
  });

  it("announces the empty ports, which no pipeline can answer either", () => {
    const plain = text(offer(READY));
    expect(plain).toContain("bundle/port-mismatch");
    expect(plain).toContain("empty inputs and outputs");
  });
});

describe("attribution, on the surface where it is refused", () => {
  /** The rendered button's `disabled` attribute, which prose cannot see. */
  function buttonIsDisabled(markup: string): boolean {
    const at = markup.indexOf("Read it into a draft bundle");
    expect(at, "the import button is not on the panel at all").toBeGreaterThan(-1);
    const open = markup.lastIndexOf("<button", at);
    expect(open).toBeGreaterThan(-1);
    /* The ATTRIBUTE, spelled as React renders a boolean one, and never the bare word:
       `Button`'s class list carries `disabled:` Tailwind variants on every render, so
       `includes("disabled")` is true of an enabled button and this cell would have been
       green in both directions. */
    return markup.slice(open, at).includes('disabled=""');
  }

  it("offers the button to a session with a handle", () => {
    const markup = offer(READY);
    expect(buttonIsDisabled(markup)).toBe(false);
    expect(text(markup)).toContain("The file you dropped is not modified and not sent anywhere");
  });

  it("refuses a signed-out reader, and says the field has no default", () => {
    const markup = offer({ state: "anonymous" });
    expect(buttonIsDisabled(markup)).toBe(true);
    const plain = text(markup);
    expect(plain).toContain("sign in to import");
    expect(plain).toContain("there is no default for that field");
    // A door, since this is the one refusal the reader can act on from here.
    expect(markup).toContain('href="/api/auth/github/login"');
    // And no invented name anywhere on the panel.
    expect(plain).not.toContain("anonymous");
    expect(plain).not.toContain("attributed to ");
  });

  it("refuses a session that has not chosen a handle yet", () => {
    const markup = offer({ state: "no-handle", accountId: "acct_1" });
    expect(buttonIsDisabled(markup)).toBe(true);
    expect(text(markup)).toContain("no handle yet");
    // T050 AC1's middle state: signed in, sign-up unfinished. Nothing here can fix it, and
    // saying "sign in" at somebody who already has would be the wrong sentence with a
    // working link under it.
    expect(markup).not.toContain('href="/api/auth/github/login"');
  });

  it("refuses when the session could not be read, rather than guessing", () => {
    const markup = offer({ state: "unreachable", detail: "the session endpoint answered 503." });
    expect(buttonIsDisabled(markup)).toBe(true);
    const plain = text(markup);
    expect(plain).toContain("cannot tell");
    expect(plain).toContain("the session endpoint answered 503.");
    expect(plain).toContain("would put it on somebody else's writing");
  });

  it("refuses while the session is still being read", () => {
    const markup = offer({ state: "loading" });
    expect(buttonIsDisabled(markup)).toBe(true);
    expect(text(markup)).toContain("Checking whether you are signed in");
  });
});

describe("the receipt, after the press", () => {
  const markup = () => {
    if (CANDIDATE === undefined) throw new Error("unreachable");
    const record = importSelection(CANDIDATE, "berti", []);
    return renderToStaticMarkup(
      createElement(AttractorImported, { record, onUndo: () => undefined }),
    );
  };

  it("keeps naming what was lost, which is the half a vanishing panel would hide", () => {
    const plain = text(markup());
    for (const attribute of ["timeout", "goal_gate", "owner", "type"]) {
      expect(plain, `${attribute} was lost and the receipt did not name it`).toContain(attribute);
    }
  });

  it("states the count, the handle and the provenance of what was written", () => {
    const plain = text(markup());
    expect(plain).toContain("release.dot was read into 3 cards");
    expect(plain).toContain(
      "Each card carries version 0.1.0, author berti, and provenance derived:attractor release.dot.",
    );
    expect(plain).toContain("2 of those cards have an empty spec");
    expect(plain).toContain("the node carried no prompt");
  });

  it("offers a way back, since the press replaced the whole selection", () => {
    expect(text(markup())).toContain("undo, put the pipeline back");
  });
});
