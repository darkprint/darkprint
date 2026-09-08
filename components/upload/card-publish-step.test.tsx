/* ============================================================
   The card's Publish step, rendered.

   The wizard is stateful and its fourth step is unreachable from a
   static render, so the step is mounted on its own with the state
   handed in, and checked over the words a reader sees: the id the
   card will be stored under, the visibility choice, the reason the
   button is disabled, and what each ending says.

   `text()` strips markup and flattens whitespace, and the
   `disabled` assertion reads the attribute, so the two halves are
   checked where each of them lives.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CardPublishStep, type SingleCheck } from "./CardPublishStep";
import type { CardPublishOutcome } from "./publish-client";
import type { UploadSession } from "./session";

function decode(markup: string): string {
  return markup
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function text(markup: string): string {
  return decode(markup.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

const READY: UploadSession = { state: "ready", accountId: "acct_1", handle: "berti" };

const RESOLVES: SingleCheck = {
  state: "done",
  ok: true,
  diagnostics: [],
  card: { id: "lupo/planner", version: "1.0.0", name: "Planner" },
};

const REJECTED: SingleCheck = {
  state: "done",
  ok: false,
  diagnostics: [
    { code: "card/bad-id", severity: "error", message: "Card id `Planner Bad` is not a legal identifier." },
    { code: "card/missing-field", severity: "error", message: "Field `spec` is required." },
  ],
};

function step(overrides: {
  check?: SingleCheck;
  session?: UploadSession;
  visibility?: "public" | "private";
  publishing?: boolean;
  outcome?: CardPublishOutcome;
  title?: string;
}): string {
  return renderToStaticMarkup(
    createElement(CardPublishStep, {
      title: overrides.title ?? "",
      check: overrides.check ?? RESOLVES,
      session: overrides.session ?? READY,
      visibility: overrides.visibility ?? "private",
      onVisibility: () => undefined,
      publishing: overrides.publishing ?? false,
      onPublish: () => undefined,
      outcome: overrides.outcome,
      onBack: () => undefined,
      onAnother: () => undefined,
      onReset: () => undefined,
    }),
  );
}

/** The publish button's `disabled` attribute, which prose cannot see. The label moves while a press is in flight. */
function publishIsDisabled(markup: string, label = "Publish node card"): boolean {
  const at = markup.indexOf(label);
  expect(at, "the publish button is not on the step at all").toBeGreaterThan(-1);
  const open = markup.lastIndexOf("<button", at);
  expect(open).toBeGreaterThan(-1);
  /* The attribute as React renders a boolean one, never the bare word: `Button` carries
     `disabled:` Tailwind variants on every render. */
  return markup.slice(open, at).includes('disabled=""');
}

describe("before the press", () => {
  it("names the id the card will be stored under, with the caller's handle over the card's own name", () => {
    const plain = text(step({}));
    expect(plain).toContain("berti/planner@1.0.0");
    expect(plain).toContain("this one is stored as berti/planner");
    expect(plain).toContain("The document's id is rewritten to match");
    /* The upstream namespace is replaced, never nested. */
    expect(plain).not.toContain("berti/lupo/planner");
  });

  it("offers the visibility choice, private first, and sends the chosen word into the note", () => {
    const markup = step({ visibility: "private" });
    expect(markup).toContain('aria-label="Private: Only you can read it"');
    expect(markup).toContain('aria-label="Public: Anyone can read it"');
    expect(text(markup)).toContain("stores berti/planner@1.0.0 , private");
    expect(text(step({ visibility: "public" }))).toContain("stores berti/planner@1.0.0 , public");
  });

  it("enables the button for a signed-in reader whose card resolves", () => {
    const markup = step({});
    expect(publishIsDisabled(markup)).toBe(false);
    expect(text(markup)).toContain("The registry runs the same check on its side");
  });

  it("refuses a signed-out reader with a door, and keeps the card", () => {
    const markup = step({ session: { state: "anonymous" } });
    expect(publishIsDisabled(markup)).toBe(true);
    const plain = text(markup);
    expect(plain).toContain("sign in to publish");
    expect(plain).toContain("The card stays where it is");
    expect(markup).toContain('href="/api/auth/github/login"');
  });

  it("refuses a session with no handle, without a sign-in door", () => {
    const markup = step({ session: { state: "no-handle", accountId: "acct_1" } });
    expect(publishIsDisabled(markup)).toBe(true);
    expect(text(markup)).toContain("no handle yet");
    expect(markup).not.toContain('href="/api/auth/github/login"');
  });

  it("blocks a card the validator rejected and says how many errors it reported", () => {
    const markup = step({ check: REJECTED });
    expect(publishIsDisabled(markup)).toBe(true);
    const plain = text(markup);
    expect(plain).toContain("The validator reported 2 errors.");
    expect(plain).toContain("blocked");
    /* No id to print: a rejected document has no card to read one off. */
    expect(plain).not.toContain("@");
  });

  it("blocks while nothing has been dropped, and while the check is in flight", () => {
    expect(publishIsDisabled(step({ check: { state: "idle" } }))).toBe(true);
    expect(text(step({ check: { state: "idle" } }))).toContain("there is no card to publish yet");
    expect(publishIsDisabled(step({ check: { state: "checking" } }))).toBe(true);
  });

  it("blocks while the session is still being read, and when it could not be", () => {
    expect(text(step({ session: { state: "loading" } }))).toContain("Checking whether you are signed in");
    const unreachable = step({ session: { state: "unreachable", detail: "the session endpoint answered 503." } });
    expect(publishIsDisabled(unreachable)).toBe(true);
    expect(text(unreachable)).toContain("the session endpoint answered 503.");
  });

  it("says the press is in flight", () => {
    const markup = step({ publishing: true });
    expect(publishIsDisabled(markup, "Publishing…")).toBe(true);
    expect(text(markup)).toContain("Sending the card to the registry");
  });
});

describe("the endings", () => {
  it("links to the card's page after a publish, and names what was stored", () => {
    const markup = step({
      outcome: {
        state: "published",
        card: { cardId: "berti/planner", version: "1.0.0", visibility: "public", path: "/nodes/berti/planner" },
      },
    });
    const plain = text(markup);
    expect(plain).toContain("Published. The registry holds it.");
    expect(plain).toContain("Stored as berti/planner@1.0.0 , public");
    expect(markup).toContain('href="/nodes/berti/planner"');
    expect(plain).toContain("Open the card's page");
    expect(plain).toContain("Publish another card");
  });

  it("prints the registry's refusal with its diagnostics, and a way back to the card", () => {
    const markup = step({
      outcome: {
        state: "refused",
        kind: "card-invalid",
        detail: "publishCard: the card was refused with 1 error.",
        diagnostics: [
          {
            code: "card/unknown-term",
            severity: "error",
            message: "Unknown term `lupo/pii-handling`.",
            hint: "Declare it in the bundle's ontology/extensions.yaml.",
          },
        ],
      },
    });
    const plain = text(markup);
    expect(plain).toContain("Not published. The registry declined it.");
    expect(plain).toContain("card-invalid : publishCard: the card was refused with 1 error.");
    expect(plain).toContain("card/unknown-term Unknown term `lupo/pii-handling`.");
    expect(plain).toContain("Declare it in the bundle's ontology/extensions.yaml.");
    expect(plain).toContain("Back to the card");
    expect(markup).not.toContain('href="/nodes/');
  });

  it("says when the registry could not be reached, and that the card is still here", () => {
    const plain = text(
      step({ outcome: { state: "unreachable", detail: "The registry could not be reached." } }),
    );
    expect(plain).toContain("Not published.");
    expect(plain).toContain("The registry could not be reached");
    expect(plain).toContain("Your card is still here.");
  });

  it("prints a rejection's own title and detail", () => {
    const plain = text(
      step({
        outcome: {
          state: "rejected",
          status: 401,
          title: "Unauthorized",
          detail: "Your session has expired. Sign in again and publish; nothing was stored.",
        },
      }),
    );
    expect(plain).toContain("Unauthorized: Your session has expired.");
  });
});
