/* ============================================================
   T263 AC1 — the wizard's Publish button reaches the registry.

   The page is judged by what it submits, never by the response
   body: `publish` returns `{ bundleId, releaseId, digest, created }`
   and the wizard renders from what it sent plus the digest.

   The route requires `ownerHandle` and `version` in the body (both
   `readString` in `app/api/bundles/route.ts`, both a 400 when
   absent), so a body missing either publishes nothing. That wiring
   is what this file measures, on comment-stripped source, because
   `/api/bundles` also occurs in docblocks and a raw grep is green
   on a tree where nothing is wired.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { occurrences, premise, publishBodyText, routeFiles } from "./source";

const files = routeFiles();

describe("AC1 — a clean bundle publishes", () => {
  it("the partition is real and still carries what survives", () => {
    premise(files);
  });

  it("the route reaches POST /api/bundles", () => {
    premise(files);
    const code = files.map((f) => f.code).join("\n");
    expect(
      occurrences(code, /\/api\/bundles/),
      "no code path in the route reaches POST /api/bundles. The seam is HTTP: the " +
        "`@/lib/server/publish` barrel reaches `pg` and cannot be in a client bundle.",
    ).toBeGreaterThan(0);
    expect(
      occurrences(code, /["'`]POST["'`]/),
      "/api/bundles is named but nothing POSTs to it",
    ).toBeGreaterThan(0);
  });

  /**
   * Split from the other four deliberately: a body built without these two still carries
   * `manifest`, `dot` and `cardFiles`, so one cell over all six would say "the body is
   * wrong" without saying which half, and the two halves have different causes.
   */
  it("submits the two fields the route requires beyond the bundle itself", () => {
    premise(files);
    const code = publishBodyText(files);
    for (const field of ["ownerHandle", "version"] as const) {
      expect(
        occurrences(code, new RegExp(`\\b${field}\\b`)),
        `the publish body never names \`${field}\`. \`app/api/bundles/route.ts\` reads it ` +
          "with `readString` and answers 400 when it is absent.",
      ).toBeGreaterThan(0);
    }
  });

  /* Scoped to the file that names `/api/bundles`, for the reason `publishBodyText` records:
     partition-wide, all four already occur because the wizard builds them for its in-tab
     validation, and the cell was green on a tree where nothing publishes. */
  it("submits the bundle's four fields", () => {
    premise(files);
    const code = publishBodyText(files);
    for (const field of ["slug", "dot", "cardFiles", "manifest"] as const) {
      expect(
        occurrences(code, new RegExp(`\\b${field}\\b`)),
        `the publish body never names \`${field}\``,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * Omitting the control would work, since an absent `visibility` takes the account
   * default, which is exactly why it needs asserting: the wizard offers a public or private
   * choice and the choice has to leave the tab.
   */
  it("offers the visibility choice and sends it", () => {
    premise(files);
    /* Two clauses, because "the control exists" and "its value is sent" are different
       claims and the first was masking the second: `visibility` occurs in `UploadFlow.tsx`
       for the step-2 control, so removing it from the request body alone reddened nothing.
       The second expectation is scoped to the file that names `/api/bundles`. */
    expect(
      occurrences(files.map((f) => f.code).join("\n"), /visibility/i),
      "no visibility control on the route",
    ).toBeGreaterThan(0);
    expect(
      occurrences(publishBodyText(files), /visibility/i),
      "the visibility control exists but its value never reaches the request body",
    ).toBeGreaterThan(0);
  });

  /**
   * The session read lives in ONE file under `components/upload/**` so a later change can
   * lift it whole. The second half of this cell is vacuous until the first half passes,
   * which is why the first `expect` exists.
   */
  it("reads the session in exactly one file", () => {
    premise(files);
    /* Files that PERFORM the read, not files that mention the word: the module, its consumer
       and the publish client all say `session`, so `/api/auth/session` is what to count. */
    const readers = files.filter((f) => /\/api\/auth\/session/.test(f.code)).map((f) => f.path);
    expect(
      readers.length,
      "`ownerHandle` comes from the session and nothing in the route reads one",
    ).toBeGreaterThan(0);
    expect(
      readers.length,
      `the session read is spread across ${readers.join(", ")}. One file, so a later change ` +
        "can lift it whole.",
    ).toBe(1);
  });
});
