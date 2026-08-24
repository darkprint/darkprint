/* ============================================================
   T261 — the route tree the migration produces, and the page it
   forecloses.

   ── the near-miss this file is written out of ──
   The first instrument I reached for was `getSortedRoutes`
   (`next/dist/shared/lib/router/utils/sorted-routes.js`), which
   throws on D-261-02's ruled shape:

     "You cannot use different slug names for the same dynamic
      path ('slug' !== 'owner')."

   That is a TRUE throw from an instrument the App Router build
   DOES NOT RUN. `next/dist/build/index.js:715` calls
   `validateAppPaths`, whose own comment says it replaces that
   logic; it groups routes by FULL normalized structure, and a
   one-segment wildcard structure is not the two-segment one, so
   they do not conflict. Re-measured on the validator that runs,
   D-261-02's shape is buildable — and it is pinned here so the
   next reader does not have to rediscover which of the two
   validators is the live one.

   ── the consequence, which is the point ──
   The redirector at `app/blueprints/[slug]/` and a page at
   `app/blueprints/[owner]/` are the SAME structure with different
   slug names, and that pair really does throw. So for as long as
   the redirector lives, NO PAGE MAY EVER SIT AT
   `/blueprints/{owner}` — T261's `Owns` line reads
   `app/blueprints/[owner]/**` and means, in practice,
   `app/blueprints/[owner]/[slug]/**` only.

   A future owner-index attempt would otherwise fail inside
   `next build`, in a message about slug names, at a moment when
   nobody is looking for a ruling. It fails here instead, with the
   ruling's name on it.

   ── every cell binds the validator LAST ──
   `validateAppPaths` is reached through a deep `next/dist` path.
   Binding it at file scope would make an absent or renamed module
   red every cell below with a message about route shapes, which
   would be a claim about Next's packaging wearing the clothes of a
   claim about this repository's routes.
   ============================================================ */

import { describe, expect, it } from "vitest";

type Validate = (paths: string[]) => unknown;

/** Bound per cell, never at file scope. See the header. */
async function validator(): Promise<Validate> {
  const mod = await import("next/dist/build/validate-app-paths.js");
  const fn = (mod as { validateAppPaths?: Validate }).validateAppPaths;
  if (typeof fn !== "function") {
    throw new Error(
      "`next/dist/build/validate-app-paths.js` no longer exports `validateAppPaths`. " +
        "Next's app-path validation has moved; find where `build/index.js` calls it now " +
        "before trusting anything below.",
    );
  }
  return fn;
}

/** Whether a set of app paths survives the validator the build actually runs. */
async function accepts(paths: string[]): Promise<{ ok: boolean; message: string }> {
  const validate = await validator();
  try {
    validate(paths);
    return { ok: true, message: "" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

const REDIRECTOR = "/blueprints/[slug]/page";
const CANONICAL = "/blueprints/[owner]/[slug]/page";
const SHELF = "/blueprints/page";
const OWNER_INDEX = "/blueprints/[owner]/page";

describe("D-261-02's ruled route shape is buildable", () => {
  it("accepts the redirector beside the canonical detail route", async () => {
    const result = await accepts([SHELF, REDIRECTOR, CANONICAL]);
    expect(
      result.ok,
      `the ruled shape is rejected by the validator \`next build\` runs:\n${result.message}\n\n` +
        `If this reds, D-261-02's mechanism does not exist and AC1 has no carrier. Do not ` +
        `"fix" it by renaming a segment — the segment names are the ruling.`,
    ).toBe(true);
  });

  /*
   * The positive control, and without it the cell above is resolution rather than
   * discrimination: a validator that accepted everything would pass it. This pair is the
   * one the migration must never produce, so the control and the foreclosure are the same
   * measurement read twice.
   */
  it("still rejects a genuinely ambiguous pair, so the acceptance above means something", async () => {
    const result = await accepts([REDIRECTOR, OWNER_INDEX]);
    expect(
      result.ok,
      "`validateAppPaths` accepted `[slug]` and `[owner]` as siblings at one level. It has " +
        "stopped discriminating, so every acceptance in this file is vacuous.",
    ).toBe(false);
    expect(result.message).toMatch(/Ambiguous|slug names/i);
  });

  it("accepts the canonical route on its own, and the shipped /u tree", async () => {
    // Two negative controls: the acceptance is not an artefact of the redirector's presence,
    // and the validator agrees with a tree this repository already ships and builds.
    expect((await accepts([SHELF, CANONICAL])).ok).toBe(true);
    expect((await accepts(["/u/[username]/page", "/u/[username]/[slug]/page"])).ok).toBe(true);
  });
});

describe("and it forecloses a page at /blueprints/{owner}", () => {
  /*
   * D-261-07's record, pinned suite-side.
   *
   * This is the same fact as the positive control above, asserted as a CONSTRAINT ON THIS
   * TASK rather than as a property of Next: `Owns: app/blueprints/[owner]/**` cannot mean
   * an owner index while the redirector holds `[slug]`.
   */
  it("cannot host an owner index while the redirector holds [slug]", async () => {
    const result = await accepts([SHELF, REDIRECTOR, CANONICAL, OWNER_INDEX]);
    expect(
      result.ok,
      "an owner index at `/blueprints/{owner}` now builds, which means the redirector has " +
        "left `app/blueprints/[slug]/`. Either B-09's old-URL 308 is gone — AC1 — or it moved " +
        "somewhere this suite does not know about. Find it before adding the index.",
    ).toBe(false);
  });
});
