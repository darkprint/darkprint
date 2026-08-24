/* ============================================================
   T261 / D-261-17 — the route tree, held against BOTH validators,
   because buildable is not routable.

   ── this file's first version drew the wrong conclusion ──
   It measured that `validateAppPaths` accepts
   `app/blueprints/[slug]` beside `app/blueprints/[owner]/[slug]`,
   and concluded D-261-02's ruled shape was buildable — treating
   the `getSortedRoutes` throw it had also seen as coming from an
   instrument the App Router does not run. That was wrong, and the
   shipped tree is the proof: the redirector lives in the SHARED
   `[owner]` slot, not in a `[slug]` slot of its own.

   Next validates routes TWICE and both govern:

     validateAppPaths      build/validate-app-paths.js
                           called from build/index.js:715
                           groups by FULL normalized structure, so a
                           one-segment shape beside a two-segment one
                           does not conflict -> ACCEPTS the pair

     getSortedRoutes       shared/lib/router/utils/sorted-routes.js
                           called from server/route-matcher-managers/
                           default-route-matcher-manager.js at RUNTIME,
                           over the App Router's dynamic matchers, when
                           the server sorts routes for matching
                           -> THROWS "You cannot use different slug
                              names for the same dynamic path"

   So the refused shape BUILDS CLEAN AND FAILS WHEN THE SERVER
   MATCHES. Only real HTTP finds it, which is why the round needed a
   curl window to discover what a green build had hidden.

   ── what this file asserts now ──
   The SHIPPED shape passes both. The refused shape passes one and
   fails the other, and it is the SECOND one that decides. And the
   runtime call site is asserted to still exist, because the whole
   claim above rests on it and a silent move would leave these cells
   measuring a validator nobody runs.
   ============================================================ */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

type Validate = (paths: string[]) => unknown;

/** Bound per cell, never at file scope: an absent module must not red every claim here. */
async function buildValidator(): Promise<Validate> {
  const mod = await import("next/dist/build/validate-app-paths.js");
  const fn = (mod as { validateAppPaths?: Validate }).validateAppPaths;
  if (typeof fn !== "function") {
    throw new Error("`validateAppPaths` is gone; find what `build/index.js` calls instead.");
  }
  return fn;
}

async function matchSorter(): Promise<Validate> {
  const mod = await import("next/dist/shared/lib/router/utils/sorted-routes.js");
  const fn = (mod as { getSortedRoutes?: Validate }).getSortedRoutes;
  if (typeof fn !== "function") {
    throw new Error("`getSortedRoutes` is gone; find what the route matcher sorts with instead.");
  }
  return fn;
}

async function verdict(validate: Promise<Validate>, paths: string[]) {
  const fn = await validate;
  try {
    fn(paths);
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/* App-path spellings for the build validator, and bare pathnames for the matcher: the two
   take different shapes, which is itself part of why they are easy to confuse. */
const SHIPPED_APP = ["/blueprints/page", "/blueprints/[owner]/page", "/blueprints/[owner]/[slug]/page"];
const SHIPPED_PATHS = ["/blueprints", "/blueprints/[owner]", "/blueprints/[owner]/[slug]"];
const REFUSED_APP = ["/blueprints/page", "/blueprints/[slug]/page", "/blueprints/[owner]/[slug]/page"];
const REFUSED_PATHS = ["/blueprints", "/blueprints/[slug]", "/blueprints/[owner]/[slug]"];

describe("D-261-17: the shipped shape passes BOTH validators", () => {
  it("builds", async () => {
    const r = await verdict(buildValidator(), SHIPPED_APP);
    expect(r.ok, `the shipped app paths are rejected at build:\n${r.message}`).toBe(true);
  });

  it("routes", async () => {
    const r = await verdict(matchSorter(), SHIPPED_PATHS);
    expect(
      r.ok,
      `the shipped routes are rejected by the RUNTIME matcher:\n${r.message}\n\n` +
        `This is the check a green build does not make. One param name per slot is why the ` +
        `legacy redirector shares \`[owner]\` instead of owning a \`[slug]\` slot.`,
    ).toBe(true);
  });
});

describe("D-261-17: the refused shape is the one that separates them", () => {
  /*
   * The whole ruling in two cells. If BOTH of these ever agreed — either both accepting or
   * both rejecting — the distinction this file exists for would be gone, and so would the
   * reason the shipped tree is shaped the way it is.
   */
  it("BUILDS CLEAN, which is what made it look correct", async () => {
    const r = await verdict(buildValidator(), REFUSED_APP);
    expect(
      r.ok,
      "`validateAppPaths` now rejects `[slug]` beside `[owner]/[slug]`. That is a stricter " +
        "build than the one this round measured, and it would mean a green build no longer " +
        "hides the defect — good news, and this file's argument needs rewriting rather than " +
        "patching.",
    ).toBe(true);
  });

  it("and FAILS AT THE RUNTIME MATCHER, which is what actually decides", async () => {
    const r = await verdict(matchSorter(), REFUSED_PATHS);
    expect(
      r.ok,
      "`getSortedRoutes` now ACCEPTS two param names in one slot. If that is real, the " +
        "shared-slot redirector is no longer forced and D-261-02's original shape becomes " +
        "available again — but nothing should be moved on this cell alone: the throw is what " +
        "the shipped tree was built around.",
    ).toBe(false);
    expect(r.message).toMatch(/different slug names/i);
  });
});

describe("D-261-17: the runtime validator is really on the request path", () => {
  /*
   * Everything above rests on `getSortedRoutes` being reachable at request-matching time
   * rather than being a Pages-era leftover — which is exactly the thing this file got wrong
   * the first time. Asserted against the call site so the claim cannot rot silently: if the
   * matcher stops sorting with it, these cells are measuring a validator nobody runs, and
   * that is a different world from one where they simply pass.
   */
  it("the route matcher manager still sorts with getSortedRoutes", () => {
    const path = "node_modules/next/dist/server/route-matcher-managers/default-route-matcher-manager.js";
    const source = readFileSync(path, "utf8");
    expect(
      source,
      `${path} no longer calls \`getSortedRoutes\`. The runtime half of D-261-17 rests on ` +
        `this call: without it, "the router refuses two param names in one slot" may no ` +
        `longer be true, and the cells above would be asserting a property of a module that ` +
        `is no longer on the request path.`,
    ).toContain("getSortedRoutes");
  });
});
