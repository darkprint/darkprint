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
import { PROFILE_ROUTES, SETTINGS_ROUTE, resolved } from "./partition";

const TOKENS = ["dynamicParams", "generateStaticParams"] as const;

/* Per cell rather than at module scope: a throw during collection deletes this file's cells
   instead of failing them, and the deletion is invisible on the line a reader quotes. */
function read(path: string): Source {
  const [source] = sources([resolved(path)], 1);
  return source;
}

describe("premise: the four profile routes are still routes", () => {
  /*
   * A deleted route satisfies "the token is absent" perfectly. So before any absence is read as
   * evidence, each file has to still be a page: it parses, it imports something, and it has a
   * default export, which is what makes a file under `app/` a route at all.
   */
  it.each(PROFILE_ROUTES)("%s parses, imports, and default-exports", (path) => {
    const source = read(path);
    expect(importSpecifiers(source).length, `${path} yielded no imports`).toBeGreaterThan(0);
    expect(
      /export\s+default\s/.test(source.code),
      `${path} has no default export, so it is no longer a route and the absence of ` +
        `\`generateStaticParams\` below says nothing about how it renders.`,
    ).toBe(true);
  });
});

describe("D-262-11: the four profile routes go per-request", () => {
  /*
   * Scoped per route AND per token — the 2x2 rather than one cell over the union. Both tokens
   * are removed together in the obvious implementation, so a cell asserting "neither appears
   * anywhere in the four" stays green when one route keeps `dynamicParams` and the check finds
   * the other four clean. That is the masking shape, and it costs nothing to avoid.
   */
  it.each(PROFILE_ROUTES.flatMap((p) => TOKENS.map((t) => [p, t] as const)))(
    "%s carries no `%s`",
    (path, token) => {
      const source = read(path);
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
   * D-262-11 says the two tokens come off "all five profile routes and `/settings`". That
   * ruling's own wording is left QUOTED at five and is not silently updated to four: the
   * `terms` route was deleted on 2026-09-06 (owner: "remove the section Ontology terms"), so
   * the ruling now governs one fewer route than it names. A quotation that drifts to match
   * the tree stops being evidence of what was decided. Measured on
   * the tree this suite was written against, `app/settings/page.tsx` carries NEITHER token: the
   * four surviving profile routes are 1 and 1 each, `/settings` is 0 and 0.
   *
   * So an absence assertion over `/settings` passes today, before any work, and would go on
   * passing if the cutover never happened. It is a cell whose subject's default already agrees
   * with it. Asserting it silently beside the four real ones would add a green that measures
   * nothing and read as six routes covered.
   *
   * It is written HERE, once, as an explicit statement that the clause is unfalsifiable from
   * source — with the measurement that makes it so — rather than left out (which hides that the
   * ruling names six surfaces) or folded in (which inflates the coverage).
   */
  it("carries neither token today, so its absence after the cutover proves nothing", () => {
    const settings = read(SETTINGS_ROUTE);
    for (const token of TOKENS) {
      expect(
        settings.code.includes(token),
        `\`${SETTINGS_ROUTE}\` now contains \`${token}\`. That INVERTS this cell's reason for ` +
          `existing: the clause was vacuous only because the token was absent to begin with. If ` +
          `the cutover added it, D-262-11 is being contradicted and the four-route cell above ` +
          `should be widened to six.`,
      ).toBe(false);
    }
  });
});

describe("D-262-11's other door: a route can be pinned static WITHOUT `generateStaticParams`", () => {
  /*
   * `dynamicParams` and `generateStaticParams` are not the only way to prerender a page. Next's
   * route segment config also has `export const dynamic = "force-static"`, `revalidate` and
   * `fetchCache`, and `force-static` alone would defeat AC1 with both of D-262-11's tokens
   * absent — the route would render once and serve every reader the same HTML.
   *
   * Checked against this version's own docs rather than from memory, since this repository
   * warns that its Next is not the one in training data: `export const dynamic = 'force-static'`
   * is current here and carries no deprecation notice.
   *
   * ── THIS CLAUSE IS VACUOUS TODAY AND IS RECORDED AS SUCH, NOT BANKED ──
   * Measured across the six routes AND repository-wide: `dynamic`, `revalidate` and
   * `fetchCache` occur ZERO times in `app/**`. So this cell passes now, before any work, and
   * cannot distinguish a correct cutover from an absent one — the same shape as the `/settings`
   * clause above, and it is written for the same reason: the gap is real even though the
   * measurement is not yet discriminating.
   *
   * What it guards is a FORWARD regression with a plausible cause. An implementer silencing a
   * build warning with `export const dynamic = "force-static"` would satisfy every other cell in
   * this file — both D-262-11 tokens stay absent — and silently make the owner view a page
   * again, which is precisely the assumption AC1 exists to break.
   */
  /* Word-boundaried. `export const dynamic` as a plain substring also matches
     `export const dynamicParams`, so the first version of this cell redded all five profile
     routes as they stood then (four survive; see the quotation note above)
     routes for carrying the token the cell ABOVE already owns — a second cell re-reporting the
     first one's finding, which inflates a count and hides that this clause is really vacuous. */
  const PINS = [
    /export\s+const\s+dynamic\s*[:=]/,
    /export\s+const\s+revalidate\s*[:=]/,
    /export\s+const\s+fetchCache\s*[:=]/,
  ];

  it.each([...PROFILE_ROUTES, SETTINGS_ROUTE])("%s pins no static segment config", (path) => {
    const source = read(path);
    const found = PINS.flatMap((pin) =>
      source.code
        .split("\n")
        .map((text, i) => ({ text, line: i + 1 }))
        .filter((l) => pin.test(l.text))
        .map((l) => `line ${l.line}: ${l.text.trim()}`),
    );
    expect(
      found,
      `${path} declares route segment config that can prerender it. D-262-11: a prerendered ` +
        `page cannot render a different view per reader, which is AC1 — and \`force-static\` ` +
        `reaches that with \`generateStaticParams\` absent, so the cells above would all pass. ` +
        `If a value here is deliberately dynamic (\`dynamic = "force-dynamic"\`), this cell is ` +
        `too broad and should test the VALUE rather than the export: widen it, do not delete it.`,
    ).toEqual([]);
  });
});
