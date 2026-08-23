/* ============================================================
   T262 AC1's mechanism — D-262-11's deletion

   AC1 is "a signed-out visitor sees the visitor view and a signed-in
   owner sees the owner view AT THE SAME URL", and the section names
   the assumption it breaks: the owner view is currently a *page*,
   not a state, and both variants ship in the build
   (`components/profile/load.ts:34-41`).

   `vitest.config.ts:49` is `environment: "node"` with no jsdom and
   no testing-library in the tree, so the rendered form of AC1 is not
   available and D-262-05 ruled the criterion source-level rather
   than adding a DOM environment for one test's convenience. What IS
   decidable from source is the mechanism D-262-11 ruled: a
   prerendered page cannot render a different view per reader, so
   `dynamicParams = false` and `generateStaticParams` come off.

   ── this file asserts a DELETION, so it states what it is not ──
   Removing the two tokens is NECESSARY for AC1 and nowhere near
   sufficient: a route can be per-request and still render one
   variant to everybody. The cells below are named for the
   mechanism, not for the criterion, so nobody downstream reads a
   green here as "AC1 holds". The behavioural half is owed at the
   hand-off, against the merged routes.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { type Source, importSpecifiers, sources } from "./contract";
import { PROFILE_ROUTES, SETTINGS_ROUTE } from "./partition";

const TOKENS = ["dynamicParams", "generateStaticParams"] as const;

const routes: Source[] = sources([...PROFILE_ROUTES, SETTINGS_ROUTE], 6);
const byPath = new Map(routes.map((s) => [s.path, s]));

describe("premise: the five profile routes are still routes", () => {
  /*
   * A deleted route satisfies "the token is absent" perfectly. So before any absence is read as
   * evidence, each file has to still be a page: it parses, it imports something, and it has a
   * default export, which is what makes a file under `app/` a route at all.
   */
  it.each(PROFILE_ROUTES)("%s parses, imports, and default-exports", (path) => {
    const source = byPath.get(path)!;
    expect(importSpecifiers(source).length, `${path} yielded no imports`).toBeGreaterThan(0);
    expect(
      /export\s+default\s/.test(source.code),
      `${path} has no default export, so it is no longer a route and the absence of ` +
        `\`generateStaticParams\` below says nothing about how it renders.`,
    ).toBe(true);
  });
});

describe("D-262-11: the five profile routes go per-request", () => {
  /*
   * Scoped per route AND per token — the 2x2 rather than one cell over the union. Both tokens
   * are removed together in the obvious implementation, so a cell asserting "neither appears
   * anywhere in the five" stays green when one route keeps `dynamicParams` and the check finds
   * the other four clean. That is the masking shape, and it costs nothing to avoid.
   */
  it.each(PROFILE_ROUTES.flatMap((p) => TOKENS.map((t) => [p, t] as const)))(
    "%s carries no `%s`",
    (path, token) => {
      const source = byPath.get(path)!;
      const lines = source.code
        .split("\n")
        .map((text, i) => ({ text, line: i + 1 }))
        .filter((l) => l.text.includes(token));
      expect(
        lines.map((l) => `line ${l.line}: ${l.text.trim()}`),
        `${path} still declares \`${token}\`. D-262-11: a prerendered page cannot render a ` +
          `different view per reader, which is AC1. Comments are stripped before this check, so ` +
          `a docblock explaining the removal does not red it.`,
      ).toEqual([]);
    },
  );
});

describe("`/settings`' clause of D-262-11 is VACUOUS and is recorded rather than banked", () => {
  /*
   * D-262-11 says the two tokens come off "all five profile routes and `/settings`". Measured on
   * the tree this suite was written against, `app/settings/page.tsx` carries NEITHER token: the
   * five profile routes are 1 and 1 each, `/settings` is 0 and 0.
   *
   * So an absence assertion over `/settings` passes today, before any work, and would go on
   * passing if the cutover never happened. It is a cell whose subject's default already agrees
   * with it. Asserting it silently beside the five real ones would add a green that measures
   * nothing and read as six routes covered.
   *
   * It is written HERE, once, as an explicit statement that the clause is unfalsifiable from
   * source — with the measurement that makes it so — rather than left out (which hides that the
   * ruling names six surfaces) or folded in (which inflates the coverage).
   */
  it("carries neither token today, so its absence after the cutover proves nothing", () => {
    const settings = byPath.get(SETTINGS_ROUTE)!;
    for (const token of TOKENS) {
      expect(
        settings.code.includes(token),
        `\`${SETTINGS_ROUTE}\` now contains \`${token}\`. That INVERTS this cell's reason for ` +
          `existing: the clause was vacuous only because the token was absent to begin with. If ` +
          `the cutover added it, D-262-11 is being contradicted and the five-route cell above ` +
          `should be widened to six.`,
      ).toBe(false);
    }
  });
});
