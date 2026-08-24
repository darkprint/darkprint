/* ============================================================
   T190 — the three routes D-190-05 publishes

        GET   /api/account/notifications                    -> 200 { preferences } | 401
        PATCH /api/account/notifications  Partial<Preferences>
                                                            -> 200 { preferences } | 400 | 401
        GET   /api/account/notifications/unsubscribe?token= -> 200 { kind } | 404

   ── SEAM-47's response is SUPERSEDED, and this file binds the
   block ──
   `docs/architecture/seams.md:109` publishes
   `{ notifications: NotificationSetting[] }` — four objects
   carrying title and note copy. The block publishes
   `{ preferences }`, four booleans. D-190-05 settles it: "SEAM-47's
   NotificationSetting[] response SUPERSEDED". A blind suite binding
   the docs here would have reported a defect against an
   implementer who followed the contract.

   ── the unsubscribe route carries NO SESSION, deliberately ──
   D-190-05: "the token IS the auth, and its path being
   session-shaped is recorded as deliberate (C6)". So the cell for
   it drives an ANONYMOUS request and requires a 200 — the opposite
   of what the path's neighbours do, and the reason it is written
   down rather than left to look like an oversight.

   ── `app/api/internal/events/**` is STRUCK ──
   D-190-05 removes it from `Owns` and it is NOT BUILT. The last
   cell asserts its absence, because a struck route that gets built
   anyway is an unauthenticated `enqueue` ingress — a mail-injection
   surface — and nothing else in the tree would notice it appear.
   `tests/route-partition.test.ts` reds on a route no `Owns` line
   claims, so an unclaimed one is caught there; a route claimed by a
   STRUCK clause is exactly the gap between the two guards.
   ============================================================ */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES_PIN,
  PREFERENCE_KEYS,
  type Scratch,
  bind,
  callRoute,
  deferred,
  describe_,
  dropScratchDatabases,
  mark,
  plantAccount,
  plantedToken,
  recordingDelivery,
  scratchDatabase,
  sessionCookie,
  withRoutesPointedAt,
} from "./contract";

const setup = deferred<Scratch>(() => scratchDatabase("routes"));

afterAll(async () => {
  await dropScratchDatabases();
});

/** The `{ preferences }` envelope, checked as a shape before anything reads through it. */
function preferencesOf(json: unknown, where: string): Record<string, unknown> {
  if (typeof json !== "object" || json === null) {
    throw new Error(`${where} answered ${describe_(json)}; the block publishes { preferences }.`);
  }
  const body = json as Record<string, unknown>;
  const preferences = body.preferences;
  if (typeof preferences !== "object" || preferences === null) {
    throw new Error(
      `${where} answered ${JSON.stringify(body)}.\n` +
        `  D-190-05 publishes the response as \`{ preferences }\` and SUPERSEDES SEAM-47's ` +
        `\`{ notifications: NotificationSetting[] }\`, which is a frontend view shape carrying ` +
        `title and note copy this module does not own.`,
    );
  }
  return preferences as Record<string, unknown>;
}

describe("T190 routes: GET /api/account/notifications", () => {
  it("answers a signed-in owner 200 with the four preferences", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("r-get").toLowerCase(), { digest: true });

    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("get", { cookie: sessionCookie(account.accountId, account.handle) }),
    );

    expect(answer.status, `GET answered ${answer.status}: ${answer.body}`).toBe(200);
    const preferences = preferencesOf(answer.json, "GET /api/account/notifications");
    expect(Object.keys(preferences).sort()).toEqual([...PREFERENCE_KEYS].sort());
    expect(
      preferences.digest,
      "the route answered the default rather than the stored value, so it is not reading the " +
        "column.",
    ).toBe(true);
    expect(preferences.fork).toBe(DEFAULT_PREFERENCES_PIN.fork);
  });

  it("answers an anonymous caller 401", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () => callRoute("get"));
    expect(
      answer.status,
      `D-190-05 publishes \`| 401\` on this route and marks it \`(session)\`. It answered ` +
        `${answer.status}: ${answer.body}`,
    ).toBe(401);
  });
});

describe("T190 routes: PATCH /api/account/notifications", () => {
  it("applies a partial patch and answers the whole record", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("r-patch").toLowerCase(), {});

    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("patch", {
        cookie: sessionCookie(account.accountId, account.handle),
        body: { digest: true },
      }),
    );

    expect(answer.status, `PATCH answered ${answer.status}: ${answer.body}`).toBe(200);
    const preferences = preferencesOf(answer.json, "PATCH /api/account/notifications");
    expect(preferences.digest, "the patch was not applied").toBe(true);
    expect(
      Object.keys(preferences).sort(),
      "the wire answered the patch rather than the whole record. The module publishes " +
        "`Promise<Preferences>` and the route publishes `{ preferences }`.",
    ).toEqual([...PREFERENCE_KEYS].sort());

    /* And it survives a read through the OTHER route, so it crossed the storage. */
    const read = await withRoutesPointedAt(scratch.url, () =>
      callRoute("get", { cookie: sessionCookie(account.accountId, account.handle) }),
    );
    expect(preferencesOf(read.json, "the GET after a PATCH")).toEqual(preferences);
  });

  it("answers an anonymous caller 401 and writes nothing", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("r-patch-401").toLowerCase(), {});

    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("patch", { body: { digest: true } }),
    );
    expect(answer.status, `answered ${answer.status}: ${answer.body}`).toBe(401);

    const [row] = await scratch.query(
      "select notification_preferences as prefs from account where id = $1",
      [account.accountId],
    );
    expect(
      row?.prefs,
      "the route answered 401 AND the write landed. A refusal that writes first satisfies " +
        "every status assertion a reviewer would make.",
    ).toEqual({});
  });

  it.each([
    { label: "a non-boolean value", body: { digest: "yes" } },
    { label: "a non-object body", body: [] as unknown },
    { label: "a null body", body: null as unknown },
  ])("answers 400 for $label", async ({ body }) => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("r-400").toLowerCase(), {});

    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("patch", {
        cookie: sessionCookie(account.accountId, account.handle),
        body,
      }),
    );

    expect(
      answer.status,
      `D-190-05 publishes \`| 400\` on this route. \`${JSON.stringify(body)}\` answered ` +
        `${answer.status}: ${answer.body}\n` +
        `  \`Partial<Preferences>\` stops nothing at runtime and a route body is user input, ` +
        `so the four booleans are checked at the wire or they are not checked.`,
    ).toBe(400);
  });
});

describe("T190 routes: GET /api/account/notifications/unsubscribe", () => {
  /**
   * The token is the auth. This request carries NO cookie on purpose — a reader clicking an
   * unsubscribe link in their mail is not signed in, and D-190-05 records the path's
   * session-shaped neighbourhood as deliberate rather than as an oversight.
   */
  it("spends a token from an anonymous request and answers 200 { kind }", async () => {
    const scratch = await setup.require();
    const account = await plantAccount(scratch, mark("r-unsub").toLowerCase(), { fork: true });

    const enqueue = await bind("enqueue");
    await enqueue(scratch.db, {
      kind: "fork",
      accountId: account.accountId,
      subject: { slug: "t190-up", fork: "b1" },
    });
    const recorder = recordingDelivery();
    const deliverPending = await bind("deliverPending");
    await deliverPending(scratch.db, recorder.delivery);
    const token = recorder.delivered[0]?.unsubscribeToken;
    expect(token, "no token was delivered, so this cell has none to spend").toBeTruthy();

    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: `token=${encodeURIComponent(String(token))}` }),
    );

    expect(
      answer.status,
      `an anonymous unsubscribe answered ${answer.status}: ${answer.body}\n` +
        `  D-190-05: "the unsubscribe route carries NO session — the token IS the auth".`,
    ).toBe(200);
    expect(answer.json).toEqual({ kind: "fork" });

    const [row] = await scratch.query(
      "select notification_preferences as prefs from account where id = $1",
      [account.accountId],
    );
    expect(
      (row?.prefs as Record<string, unknown> | undefined)?.fork,
      "the route answered 200 and the preference did not move.",
    ).toBe(false);
  });

  /**
   * D-190-12 amended this route's published statuses to `200 | 400 | 404`, and the amendment
   * came out of this round: I asserted 404 here from a block that listed only `200 | 404`, the
   * implementation answered 400, and the ruling moved the BLOCK rather than the code — the
   * implementer's reasoning was better than mine and my own oracle argument did not survive
   * contact ("the caller already knows whether it sent a token").
   *
   * These cells are REPOINTED at the amended block, not loosened. The ruling's actual content
   * is that a missing token and a dead token are DIFFERENT debugging facts, so the last cell
   * asserts the difference rather than merely accepting each status on its own — an assertion
   * that took both would be green against an implementation that had collapsed them.
   */
  it("answers 400 for the empty token ''", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: "token=" }),
    );
    expect(
      answer.status,
      `D-190-12 publishes \`400 for an EMPTY or ABSENT token\`. It answered ${answer.status}: ` +
        `${answer.body}`,
    ).toBe(400);
  });

  /**
   * A WHITESPACE-ONLY token, asserted only as far as the contract goes — and narrowed after I
   * over-reached on it.
   *
   * My first version of the cell above drove `["", "   "]` and demanded 400 for both. It redded,
   * and the red was mine: D-190-12 says "EMPTY or ABSENT", and `"   "` is neither — it is a
   * three-character string. `tokenFrom` tests `token === null || token === ""`, so whitespace
   * passes through as a token and is refused as unknown, which is 404. I had bundled whitespace
   * into the empty class on my own initiative, which is the guessing this round exists to catch,
   * and I was doing it while REPOINTING a cell at a ruling.
   *
   * So this asserts what IS ruled and no more: whatever the status, the request must be REFUSED
   * and must render the one published sentence. Whether a whitespace-only token is "empty" for
   * D-190-12's purposes is an open boundary, reported rather than decided here.
   *
   * Worth noting for whoever rules it: at the MODULE level `""` and `"   "` are already
   * identical — `unsubscribe.test.ts` drives both and both answer "this link is no longer
   * valid." The split exists only at the wire.
   */
  it("refuses a whitespace-only token, and the status is an OPEN boundary", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: `token=${encodeURIComponent("   ")}` }),
    );

    expect(
      answer.status,
      `a whitespace-only token was ACCEPTED (${answer.status}). Whichever of 400 or 404 is ` +
        `right, it is not a success.`,
    ).not.toBe(200);
    expect(
      [400, 404],
      `a whitespace-only token answered ${answer.status}, which is outside the two statuses ` +
        `D-190-12 publishes for a refusal on this route.`,
    ).toContain(answer.status);
  });

  it("answers 400 with no token parameter at all", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () => callRoute("unsubscribe"));
    expect(
      answer.status,
      `D-190-12: an ABSENT token is a 400. It answered ${answer.status}: ${answer.body}`,
    ).toBe(400);
  });

  it("answers 404 for a well-formed token that names nothing", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: `token=${encodeURIComponent(plantedToken())}` }),
    );
    expect(
      answer.status,
      `a token that is present and simply unknown is a DEAD token, which D-190-12 keeps at 404. ` +
        `It answered ${answer.status}: ${answer.body}`,
    ).toBe(404);
  });

  /** The ruling's own claim: the two cases are different debugging facts. */
  it("a missing token and a dead token are DISTINGUISHABLE", async () => {
    const scratch = await setup.require();
    const missing = await withRoutesPointedAt(scratch.url, () => callRoute("unsubscribe"));
    const dead = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: `token=${encodeURIComponent(plantedToken())}` }),
    );
    expect(
      missing.status,
      `D-190-12 ratifies the split for a stated reason — "a missing token and a dead token are ` +
        `different debugging facts and the caller already knows which it sent". Both answered ` +
        `${missing.status}, so the distinction the ruling bought does not exist.\n` +
        `  Asserted as a DIFFERENCE, not as two independent statuses: cells that check each ` +
        `alone are both green against an implementation that collapsed them onto one code.`,
    ).not.toBe(dead.status);
  });
});

describe("T190: the struck internal-events routes are NOT built (D-190-05)", () => {
  /**
   * A struck route that gets built anyway is an unauthenticated `enqueue` ingress.
   *
   * `tests/route-partition.test.ts` reds on a route no `Owns` line claims — but this clause is
   * struck THROUGH, and a `~~...~~` path is still text a regex over the line can find. So the
   * gap between "claimed" and "granted" is exactly here, and this is the cell that closes it.
   */
  it("`app/api/internal/` does not exist", () => {
    const dir = fileURLToPath(new URL("../../../app/api/internal/", import.meta.url));

    /* The control, and this cell is the one place in the suite that needs one most.
       Every other assertion here FAILS CLOSED — a wrong path makes `routeTable()` throw and
       `barrelSource()` return undefined, and both are reds. This one fails OPEN: a path that
       points at nothing answers `false` and the cell passes forever, reporting a struck route
       as unbuilt whether or not anybody built it. It was the only cell green in the blind run,
       which is exactly the position where a silent zero hides.

       So the same construction is aimed at a sibling that certainly DOES exist. If this reds,
       the relative path is wrong and the assertion below is meaningless rather than satisfied. */
    const sibling = fileURLToPath(new URL("../../../app/api/account/", import.meta.url));
    expect(
      existsSync(sibling),
      `\`${sibling}\` was not found, so this file's \`../../../app/api/\` path does not reach ` +
        `the route tree at all — and the assertion below is then a zero obtained from a typo ` +
        `rather than from a route nobody built.`,
    ).toBe(true);

    expect(
      existsSync(dir),
      `\`app/api/internal/\` exists.\n` +
        `  D-190-05 STRUCK \`app/api/internal/events/**\` from T190's Owns and it is NOT ` +
        `BUILT: "\`lib/server/auth\` publishes \`withSession\` and nothing operator- or ` +
        `key-shaped, no AC needs HTTP ingress, and an unauthenticated route calling ` +
        `\`enqueue\` is a mail-injection surface".\n` +
        `  If this is being reinstated, the auth mechanism has to be published first — that ` +
        `was the whole reason for striking it.`,
    ).toBe(false);
  });
});
