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

  it.each(["", "not-a-token"])("answers 404 for the token %o", async (token) => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () =>
      callRoute("unsubscribe", { query: `token=${encodeURIComponent(token)}` }),
    );
    expect(
      answer.status,
      `D-190-05 publishes \`| 404\` on this route. It answered ${answer.status}: ${answer.body}`,
    ).toBe(404);
  });

  it("answers 404 with no token parameter at all", async () => {
    const scratch = await setup.require();
    const answer = await withRoutesPointedAt(scratch.url, () => callRoute("unsubscribe"));
    expect(
      answer.status,
      `a request with no \`token\` answered ${answer.status}: ${answer.body}. The published ` +
        `answers are 200 and 404, and a missing parameter is not a 200.`,
    ).toBe(404);
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
