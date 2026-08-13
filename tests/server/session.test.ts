import { describe, expect, it } from "vitest";

import {
  cookieHeaderFrom,
  isProblemContentType,
  loadAuth,
  pickFn,
  readProblem,
  requestWithCookie,
  RFC9457_MEMBERS,
  tamper,
  type UnknownFn,
} from "./contract";

/* ============================================================
   T000 acceptance criterion 3 — the session guard

   (3) a request with no session reaching a guarded handler
       receives a problem+json 401 and no body from the handler

   Two claims, and the second is the one that is easy to lose. A
   guard that runs the handler, reads its answer and then replaces
   it with a 401 satisfies the status code and fails the criterion:
   the handler has already touched the database, already written the
   audit row (B-14), and its payload has already been built out of
   data the caller was never entitled to. So the handler here counts
   its own calls, and the count is the assertion.

   The session itself is B-02: a GitHub OAuth cookie exposing
   `{ accountId, handle }` "or nothing". Nothing, not a partial
   session and not a thrown error — a reader that throws on a
   corrupt cookie turns an ordinary logged-out visitor with a stale
   cookie into a 500.
   ============================================================ */

const GUARD_NAMES = [
  "requireSession",
  "withSession",
  "requireAuth",
  "withAuth",
  "guard",
  "protect",
  "authenticated",
] as const;
const READ_NAMES = ["readSession", "getSession", "sessionFromRequest", "currentSession"] as const;
const WRITE_NAMES = [
  "createSessionCookie",
  "sessionCookie",
  "sealSession",
  "issueSession",
  "signSession",
  "writeSession",
  "setSession",
  "encodeSession",
] as const;

const SENTINEL = "handler-payload-that-must-not-escape";
const ACCOUNT = { accountId: "acc_01HZY8QK2M4N6P8R0S2T4V6X8Z", handle: "ada" };

/** Counts its own calls, so "the handler never ran" is a number and not an inference. */
function countingHandler(): { handler: UnknownFn; calls: () => number } {
  let calls = 0;
  return {
    handler: () => {
      calls += 1;
      return new Response(JSON.stringify({ secret: SENTINEL }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
    calls: () => calls,
  };
}

/* --------------------- calling the guard --------------------- */

type GuardShape = "wrapper" | "wrapper-with-context" | "direct";

/**
 * Which way round the guard takes its arguments. Resolved once, with a throwaway
 * handler, and then reused: probing the shapes against the handler under test would let a
 * shape that happens to invoke the handler pollute the call count that AC3 turns on.
 */
let shape: Promise<GuardShape> | undefined;

async function guardFn(): Promise<UnknownFn> {
  return pickFn(await loadAuth(), "a session guard", GUARD_NAMES, "@/lib/server/auth");
}

async function resolveShape(): Promise<GuardShape> {
  shape ??= (async () => {
    const guard = await guardFn();
    const throwaway: UnknownFn = () => new Response("{}", { status: 200 });
    const failures: string[] = [];

    try {
      const wrapped = await guard(throwaway);
      if (typeof wrapped === "function") {
        for (const [name, args] of [
          ["wrapper", [requestWithCookie()]],
          ["wrapper-with-context", [requestWithCookie(), {}]],
        ] as const) {
          try {
            if ((await (wrapped as UnknownFn)(...args)) instanceof Response) return name;
          } catch (cause) {
            failures.push(`${name}: ${String(cause)}`);
          }
        }
      } else {
        failures.push(`guard(handler) returned ${typeof wrapped}, not a function`);
      }
    } catch (cause) {
      failures.push(`guard(handler): ${String(cause)}`);
    }

    try {
      if ((await guard(requestWithCookie(), throwaway)) instanceof Response) return "direct";
    } catch (cause) {
      failures.push(`guard(request, handler): ${String(cause)}`);
    }

    throw new Error(`No call to the session guard produced a Response.\n  ${failures.join("\n  ")}`);
  })();
  return shape;
}

async function callGuard(handler: UnknownFn, cookie?: string): Promise<Response> {
  const guard = await guardFn();
  const request = requestWithCookie(cookie);
  const how = await resolveShape();

  let response: unknown;
  if (how === "direct") {
    response = await guard(request, handler);
  } else {
    const wrapped = (await guard(handler)) as UnknownFn;
    response = await wrapped(...(how === "wrapper" ? [request] : [request, {}]));
  }

  if (!(response instanceof Response)) {
    throw new Error(`The session guard returned ${typeof response}; expected a Response.`);
  }
  return response;
}

/* --------------------- issuing and reading a cookie --------------------- */

async function validCookie(account: { accountId: string; handle: string } = ACCOUNT): Promise<string> {
  const write = pickFn(await loadAuth(), "a session writer", WRITE_NAMES, "@/lib/server/auth");
  const failures: string[] = [];
  for (const args of [[account], [account.accountId, account.handle]]) {
    try {
      return await cookieHeaderFrom(await write(...args));
    } catch (cause) {
      failures.push(`${args.length} arg(s): ${String(cause)}`);
    }
  }
  throw new Error(`No call to the session writer produced a cookie.\n  ${failures.join("\n  ")}`);
}

async function readSession(cookie?: string): Promise<unknown> {
  const read = pickFn(await loadAuth(), "a session reader", READ_NAMES, "@/lib/server/auth");
  return await read(requestWithCookie(cookie));
}

/* --------------------- AC3 --------------------- */

describe("T000 AC3 — no session reaching a guarded handler", () => {
  it("AC3: the response is 401 in application/problem+json", async () => {
    const { handler } = countingHandler();
    const response = await callGuard(handler);

    expect(response.status).toBe(401);
    expect(isProblemContentType(response.headers.get("content-type"))).toBe(true);
  });

  it("AC3: the handler never runs and none of its payload reaches the caller", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler);

    expect(calls()).toBe(0);
    expect(await response.text()).not.toContain(SENTINEL);
  });

  it("AC3: the 401 carries all five RFC 9457 members, with status matching", async () => {
    const { handler } = countingHandler();
    const problem = await readProblem(await callGuard(handler));

    expect(RFC9457_MEMBERS.filter((m) => problem[m] === undefined)).toEqual([]);
    expect(problem.status).toBe(401);
    expect(typeof problem.type).toBe("string");
    expect(typeof problem.title).toBe("string");
    expect(typeof problem.detail).toBe("string");
    expect(typeof problem.instance).toBe("string");
  });

  it("AC3: an empty cookie header is no session, not a malformed one", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler, "");

    expect(response.status).toBe(401);
    expect(calls()).toBe(0);
  });

  it("AC3: a cookie whose value is garbage is no session, and not a 500", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler, "session=not-a-real-session-value");

    expect(response.status).toBe(401);
    expect(calls()).toBe(0);
  });

  it("AC3: an unrelated cookie on the request changes nothing", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler, "theme=violet; consent=1");

    expect(response.status).toBe(401);
    expect(calls()).toBe(0);
  });

  it("AC3: a tampered session cookie is refused and the handler still never runs", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler, tamper(await validCookie()));

    /* The cookie is well-formed and one character wrong. Without an integrity check this
       is where a forged `accountId` walks in wearing a valid shape. */
    expect(response.status).toBe(401);
    expect(calls()).toBe(0);
  });

  it("AC3 (the other half): a valid session lets the handler run exactly once", async () => {
    const { handler, calls } = countingHandler();
    const response = await callGuard(handler, await validCookie());

    /* A guard that refuses everything passes every assertion above and is useless. */
    expect(response.status).toBe(200);
    expect(calls()).toBe(1);
    expect(await response.text()).toContain(SENTINEL);
  });
});

/* --------------------- the session itself (B-02) --------------------- */

describe("T000 contract — the session is { accountId, handle } or nothing", () => {
  it("no cookie reads as nothing, and does not throw", async () => {
    await expect(readSession()).resolves.toBeFalsy();
  });

  it("a garbage cookie reads as nothing, and does not throw", async () => {
    await expect(readSession("session=%%%not-base64%%%")).resolves.toBeFalsy();
  });

  it("a tampered cookie reads as nothing, and does not throw", async () => {
    await expect(readSession(tamper(await validCookie()))).resolves.toBeFalsy();
  });

  it("a valid cookie reads back the account it was issued for", async () => {
    const session = await readSession(await validCookie());
    expect(session).toMatchObject(ACCOUNT);
  });

  it("the session exposes those two fields and nothing else", async () => {
    const session = (await readSession(await validCookie())) as Record<string, unknown>;
    /* "exposing `{ accountId, handle }` or nothing". A session that also carries the
       GitHub access token, an email or a role is a wider blast radius than B-02 asked
       for, and every later task reads this object. */
    expect(Object.keys(session).sort()).toEqual(["accountId", "handle"]);
  });

  it("a handle outside ASCII survives the round trip", async () => {
    /* Cookie values are a restricted grammar (RFC 6265 §4.1.1) and a handle is chosen by
       a person (B-05), so the sealing has to encode rather than concatenate. */
    const account = { accountId: "acc_unicode", handle: "ada-λ-守" };
    const session = await readSession(await validCookie(account));
    expect(session).toMatchObject(account);
  });

  it("no single-character edit to the cookie ever reads back as a different account", async () => {
    const cookie = await validCookie(ACCOUNT);
    const eq = cookie.indexOf("=");
    const name = cookie.slice(0, eq + 1);
    const value = cookie.slice(eq + 1);

    /* The whole cookie, one character at a time. Flipping a single character somewhere in
       the middle is not enough on its own: in most encodings the middle lands in the
       payload, the payload stops parsing, and a reader that never checks the signature at
       all still answers "nothing" and looks correct. Sweeping every position guarantees
       some edits land inside a string the payload can still parse, which is where an
       unverified cookie hands back an account nobody issued.

       Two outcomes are legal for each edit: nothing, or the account the cookie was issued
       for. Anything else is a forgery, and B-05 makes the stakes concrete — the handle in
       this object is the namespace every later task authorises against. */
    const forged: { at: number; read: unknown }[] = [];
    for (let at = 0; at < value.length; at += 1) {
      const replacement = value[at] === "A" ? "B" : "A";
      const mutated = `${name}${value.slice(0, at)}${replacement}${value.slice(at + 1)}`;
      const read = await readSession(mutated).catch(() => null);
      if (read && JSON.stringify(read) !== JSON.stringify(ACCOUNT)) forged.push({ at, read });
    }

    expect(forged).toEqual([]);
  }, 60_000);

  it("two sessions issued for different accounts do not read as each other", async () => {
    const first = await validCookie({ accountId: "acc_first", handle: "first" });
    const second = await validCookie({ accountId: "acc_second", handle: "second" });

    expect(await readSession(first)).toMatchObject({ accountId: "acc_first" });
    expect(await readSession(second)).toMatchObject({ accountId: "acc_second" });
  });
});
