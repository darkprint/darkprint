/* ============================================================
   The first-sign-in form, over what is drivable in process.

   ── what this file can and cannot reach, stated rather than
      discovered later ──
   `/welcome`'s three-way branch (no session -> sign-in panel,
   handle already set -> 307 to `/`, handle null -> the form) reads
   `cookies()` through `readSession`, and D-261-18 ruled that class
   UNDRIVABLE in process: `next/headers` throws outside a request
   scope whatever the segment config says, and a page takes no
   `Request` a test could hand a cookie to. Real HTTP is the only
   instrument that reaches it, and the branch was verified that way
   against the running dev server when it landed:

     no cookie                   -> 200, renders the sign-in panel
     cookie with handle set      -> 307 location: /
     cookie with handle null     -> 200, renders "Choose your handle"

   So this file takes the half that IS drivable — the form's own
   rendered contract — and does not pretend to cover the branch.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainText } from "@/components/ui/visible-text";
import { submitBlocked, WelcomeForm } from "./WelcomeForm";

function render(): string {
  return renderToStaticMarkup(createElement(WelcomeForm, { suggestedHandle: "" }));
}

describe("WelcomeForm", () => {
  it("asks for exactly the two fields sign-up is missing", () => {
    const markup = render();
    expect(markup).toContain('id="handle"');
    expect(markup).toContain('id="display-name"');
    const text = plainText(markup);
    expect(text).toContain("Handle");
    expect(text).toContain("Display name");
  });

  it("says the handle is permanent, which is the fact a reader cannot undo", () => {
    /* T070 reserves a handle to the account for good — a released one can never be claimed
       by anybody else. A form that takes a permanent decision without saying so is the
       honesty failure this repository charges hardest, and the sentence is the whole reason
       this field is not just another settings input. */
    const text = plainText(render());
    expect(text).toMatch(/reserved to you permanently|reserved to you for good/);
  });

  it("marks the display name optional, and says so where a reader acts on it", () => {
    const text = plainText(render());
    expect(text).toContain("Optional");
    expect(text).toContain("The handle is the one thing publishing needs");
    /* Disabled on first render because the handle is empty — the state a reader arrives in. */
    expect(render()).toContain("disabled");
  });

  it("blocks on the handle alone: the display name can never gate the submit", () => {
    /* The claim the rendered markup CANNOT carry (measured: requiring the display name
       reddened 0 of 4 cells before this predicate was extracted). A handle with no display
       name must submit; that is the whole distinction between a field that is offered and a
       field that is required. */
    const free = { state: "free" } as const;
    expect(submitBlocked({ handle: "ada", saving: false, check: free })).toBe(false);
    expect(submitBlocked({ handle: "  ada  ", saving: false, check: free })).toBe(false);

    /* And the three things that DO block, each on its own. */
    expect(submitBlocked({ handle: "", saving: false, check: { state: "idle" } })).toBe(true);
    expect(submitBlocked({ handle: "   ", saving: false, check: free })).toBe(true);
    expect(submitBlocked({ handle: "ada", saving: true, check: free })).toBe(true);
    expect(
      submitBlocked({ handle: "ada", saving: false, check: { state: "taken", reason: "taken" } }),
    ).toBe(true);
    /* Still checking is NOT a block: a reader who typed a free name should not wait on a
       debounce to press the button, and the server decides at submit either way. */
    expect(submitBlocked({ handle: "ada", saving: false, check: { state: "checking" } })).toBe(false);
  });

  it("does not invent a verdict about a name it has not asked the server about", () => {
    /* The availability line is empty on first render: nothing has been checked yet. A form
       that rendered "Available." before its own request landed would be telling a reader
       something it does not know — the same defect the upload session's `loading` state
       exists to avoid, and the reason the check is DERIVED from the string it was computed
       for rather than stored as a bare flag. */
    const text = plainText(render());
    expect(text).not.toContain("Available.");
    expect(text).not.toContain("taken");
    expect(text).not.toContain("Checking");
  });
});
