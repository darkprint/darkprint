/* ============================================================
   T263 AC1 — the wizard's Publish button reaches the registry.

   D-263-07 ruled AC1 to reading (1) of three: "AC1 is satisfied by
   what the PAGE renders from what it submitted, with only `digest`
   coming back — never by the response body." Merged `publish`
   returns `{ bundleId, releaseId, digest, created }` — no `owner`,
   no `slug`, and `releaseId` is an id rather than a version — while
   SEAM-69 still publishes `{ owner, slug, digest, release }`.
   Widening `PublishResult` is a change to a merged module and to
   T100's published block, so nothing here asserts a response field
   T100 does not return.

   ── why this file is about the REQUEST ──
   D-263-07 also found SEAM-69's request shape stale: it lists
   `{ manifest, dot, cardFiles, vocabulary?, visibility }` and omits
   `ownerHandle` and `version`, **both `readString` in
   `app/api/bundles/route.ts`, both a 400 when absent**. An
   implementer building the body from that row publishes nothing and
   gets a bad request every time. That is a cutover wiring failure,
   not a T100 criterion, and it is what this file measures.

   ── every count below was falsified before it was written ──
   On the comment-stripped partition at `32274eb`:
   `fetch(` 0, `"POST"` 0, `/api/bundles` 0 (2 in comments),
   `ownerHandle` 0, `visibility` 0. D-263-09 says T263 is the first
   client of the backend in this repository, and the zero for
   `fetch(` across the whole partition is that claim measured rather
   than repeated.
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
    /* Comment-stripped, and that is the whole reason this cell means anything: `/api/bundles`
       occurs twice in `UploadFlow.tsx`'s docblocks at `32274eb`, so the same assertion over
       raw bytes is already green on a tree where nothing is wired. */
    expect(
      occurrences(code, /\/api\/bundles/),
      "AC1: no code path in the route reaches POST /api/bundles (the two raw occurrences " +
        "at HEAD are docblocks). D-263-08: the seam is HTTP, not the `@/lib/server/publish` " +
        "barrel, which reaches `pg` and cannot be in a client bundle.",
    ).toBeGreaterThan(0);
    expect(
      occurrences(code, /["'`]POST["'`]/),
      "AC1: /api/bundles is named but nothing POSTs to it",
    ).toBeGreaterThan(0);
  });

  /**
   * The two fields SEAM-69's row omits. Split from the other four into their own cell
   * deliberately: a body built from the stale row still carries `manifest`, `dot` and
   * `cardFiles`, so a cell asserting all six at once would report "the body is wrong"
   * without saying which half, and the two halves have different causes.
   */
  it("submits the two fields SEAM-69's stale row omits and the route requires", () => {
    premise(files);
    const code = publishBodyText(files);
    for (const field of ["ownerHandle", "version"] as const) {
      expect(
        occurrences(code, new RegExp(`\\b${field}\\b`)),
        `AC1/D-263-07: the publish body never names \`${field}\`. ` +
          "`app/api/bundles/route.ts` reads it with `readString` and answers 400 when it is " +
          "absent, so a body built from SEAM-69's shape is refused on every publish.",
      ).toBeGreaterThan(0);
    }
  });

  /* Scoped to the file that names `/api/bundles`, for the reason `publishBodyText` records:
     partition-wide, all four already occur because the wizard builds them for its in-tab
     validation, and the cell was green on a tree where nothing publishes. */
  it("submits the four fields SEAM-69 does list", () => {
    premise(files);
    const code = publishBodyText(files);
    for (const field of ["slug", "dot", "cardFiles", "manifest"] as const) {
      expect(
        occurrences(code, new RegExp(`\\b${field}\\b`)),
        `AC1: the publish body never names \`${field}\``,
      ).toBeGreaterThan(0);
    }
  });

  /**
   * D-263-09. Omitting the control would work — an absent `visibility` takes the account
   * default — which is exactly why it needs asserting: the ledger sentence AC5 retires is
   * "an account to upload into, **with each blueprint public or private the way a repository
   * is**", and shipping the account half without the visibility half would take a marker off
   * a claim that only half became true. D-78 moves a marker in one direction only.
   */
  it("offers the visibility choice the retired ledger sentence promised", () => {
    premise(files);
    /* Two clauses, because "the control exists" and "its value is sent" are different
       claims and the first was masking the second. Partition-wide, `visibility` occurs in
       `UploadFlow.tsx` for the step-2 control, so removing it from the request body
       reddened 0 of 44 — the same masking that hid the `version` clause. The second
       expectation is scoped to the file that names `/api/bundles`. */
    expect(
      occurrences(files.map((f) => f.code).join("\n"), /visibility/i),
      "D-263-09: no visibility control on the route, but AC5 retires the sentence that " +
        "promised each blueprint would be public or private. Half a claim came true.",
    ).toBeGreaterThan(0);
    expect(
      occurrences(publishBodyText(files), /visibility/i),
      "D-263-09: the visibility control exists but its value never reaches the request " +
        "body, so the choice the retired ledger sentence promised does not leave the tab.",
    ).toBeGreaterThan(0);
  });

  /**
   * D-263-09: "Keep the session read in ONE file under `components/upload/**` so a later
   * task can lift it whole", because T263 is the first client of the backend and whatever
   * it writes becomes the pattern.
   *
   * **The second half of this cell is vacuous until the first half passes**, and that is
   * stated rather than hidden: with no session read anywhere, "at most one file reads the
   * session" is true of a tree that does not publish at all. The first `expect` is what
   * stops it being read as coverage.
   */
  it("reads the session in exactly one file", () => {
    premise(files);
    /* Files that PERFORM the read, not files that mention the word. The first version
       counted `/\bsession\b/` and found three — the module, its consumer and the publish
       client — which is what a single well-placed module looks like from the outside. The
       criterion is where the READ lives, so `/api/auth/session` is what to count. */
    const readers = files.filter((f) => /\/api\/auth\/session/.test(f.code)).map((f) => f.path);
    expect(
      readers.length,
      "AC1/D-263-09: `ownerHandle` comes from the session and nothing in the route reads one",
    ).toBeGreaterThan(0);
    expect(
      readers.length,
      `D-263-09: the session read is spread across ${readers.join(", ")}. One file, so a ` +
        "later task can lift it whole.",
    ).toBe(1);
  });
});
