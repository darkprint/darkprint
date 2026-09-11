import { describe, expect, it } from "vitest";

import { error, info, warning, type Diagnostic } from "@/lib/core";

import {
  isProblemContentType,
  loadHttp,
  pickFn,
  readProblem,
  RFC9457_MEMBERS,
  requestWithCookie,
  REQUEST_URL,
  type UnknownFn,
} from "./contract";

/* ============================================================
   T000 acceptance criterion 4 — the envelope

   (4) a handler returning diagnostics returns 200 and the
       diagnostics survive serialisation intact, including
       `location`

   B-03 in one sentence: a bundle that resolves with errors is an
   answer, not a server failure. So the interesting case is not the
   empty diagnostic list, it is the payload carrying an
   *error*-severity diagnostic — that one still has to come back at
   200, with the diagnostic whole.

   The diagnostics here are built with the engine's own constructors
   (`@/lib/core`, present on this branch), not hand-written object
   literals. `lib/core/diagnostics.ts` omits absent optional keys
   rather than setting them to `undefined` "so diagnostics compare
   and serialize identically whether or not the caller passed
   `opts`" — an envelope that reintroduces `"hint": null` on the way
   out breaks that promise, and only a comparison against what the
   engine actually built can see it.
   ============================================================ */

const OK_NAMES = ["ok", "okJson", "jsonOk", "respond", "payload", "envelope", "data", "json"] as const;
const NOT_FOUND_NAMES = [
  "notFound",
  "notFoundProblem",
  "problemNotFound",
  "hidden",
  "missing",
] as const;

async function okResponse(payload: unknown): Promise<Response> {
  const mod = await loadHttp();
  const ok = pickFn(mod, "a 200 payload helper", OK_NAMES, "@/lib/server/http");
  const response = await ok(payload);
  if (!(response instanceof Response)) {
    throw new Error(`The 200 payload helper returned ${typeof response}; expected a Response.`);
  }
  return response;
}

/**
 * The contract pins the *shape* of a problem response and not the builder's signature.
 * Rather than declare one, each plausible argument list is tried in turn and every
 * failure is reported together, so a red here names what was attempted instead of
 * asserting an interface nobody agreed to.
 */
async function responseFrom(fn: UnknownFn, label: string, argLists: unknown[][]): Promise<Response> {
  const failures: string[] = [];
  for (const args of argLists) {
    try {
      const result = await fn(...args);
      if (result instanceof Response) return result;
      failures.push(`${label}(${args.length} arg(s)) returned ${typeof result}`);
    } catch (cause) {
      failures.push(`${label}(${args.length} arg(s)) threw: ${String(cause)}`);
    }
  }
  throw new Error(`No call to ${label} produced a Response.\n  ${failures.join("\n  ")}`);
}

/** One of each severity, and the fullest `location` the engine can emit. */
function diagnosticFixture(): Diagnostic[] {
  return [
    error("bundle/missing-card", "The bundle pins a card it does not carry.", {
      hint: "Add cards/solver@1.2.0.yaml to the bundle or unpin it.",
      location: {
        file: "cards/solver@1.2.0.yaml",
        line: 12,
        column: 3,
        nodeId: "solver",
        cardRef: "solver@1.2.0",
        edge: { source: "planner", target: "solver" },
        path: "inputs[1].type",
      },
    }),
    warning("attractor/hash-comment", "Attractor does not read a hash comment.", {
      location: { file: "topology.dot", line: 4 },
    }),
    /* No `hint`, no `location`: the shape `make()` produces when the caller passes no
       options, and the one a serialiser is most likely to pad out. */
    info("analysis/unresolved-node", "One node has no card in this bundle."),
  ];
}

describe("T000 AC4 — a payload carrying diagnostics returns 200, intact", () => {
  it("AC4: an error-severity diagnostic still comes back at 200", async () => {
    const diagnostics = diagnosticFixture();
    const response = await okResponse({ digest: "sha256:deadbeef", diagnostics });

    expect(response.status).toBe(200);
    expect(isProblemContentType(response.headers.get("content-type"))).toBe(false);
    expect(response.headers.get("content-type")?.split(";")[0].trim()).toBe("application/json");
  });

  it("AC4: every diagnostic survives serialisation, `location` included", async () => {
    const diagnostics = diagnosticFixture();
    const response = await okResponse({ diagnostics });
    const body = (await response.json()) as { diagnostics: Diagnostic[] };

    expect(body.diagnostics).toEqual(diagnostics);
    expect(body.diagnostics[0].location).toEqual({
      file: "cards/solver@1.2.0.yaml",
      line: 12,
      column: 3,
      nodeId: "solver",
      cardRef: "solver@1.2.0",
      edge: { source: "planner", target: "solver" },
      path: "inputs[1].type",
    });
  });

  it("AC4: the order of the diagnostics is data and is not re-sorted", async () => {
    /* Reversed on purpose: info, warning, error is precisely the order `sortDiagnostics`
       would undo, so an envelope that sorts on the way out cannot pass this by accident.
       `sortDiagnostics` exists in the engine and is the caller's to apply; an envelope
       that applies it hands every consumer a different order from the one the engine
       returned. */
    const diagnostics = [...diagnosticFixture()].reverse();
    const response = await okResponse({ diagnostics });
    const body = (await response.json()) as { diagnostics: Diagnostic[] };

    expect(body.diagnostics.map((d) => d.severity)).toEqual(["info", "warning", "error"]);
    expect(body.diagnostics).toEqual(diagnostics);
  });

  it("AC4: an absent optional key stays absent and never becomes null", async () => {
    const diagnostics = diagnosticFixture();
    const response = await okResponse({ diagnostics });
    const body = (await response.json()) as { diagnostics: Diagnostic[] };

    const plain = body.diagnostics[2];
    expect(Object.keys(plain).sort()).toEqual(["code", "message", "severity"]);
    expect("hint" in plain).toBe(false);
    expect("location" in plain).toBe(false);
  });

  it("AC4: an empty diagnostic list is a list, not an absence", async () => {
    const response = await okResponse({ diagnostics: [] });
    const body = (await response.json()) as { diagnostics: Diagnostic[] };

    expect(response.status).toBe(200);
    expect(body.diagnostics).toEqual([]);
    expect("diagnostics" in body).toBe(true);
  });
});

describe("T000 AC4 (edges) — what the envelope must not do to a payload", () => {
  it("an empty payload round-trips as an empty payload", async () => {
    const response = await okResponse({});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it("unicode in a message survives byte-for-byte", async () => {
    /* Combining marks, an astral plane character, a ZWJ sequence, a right-to-left mark
       and a NUL. Every one of them is something a card author can type and something a
       careless encoder mangles. */
    const message = "Å﻿ é́ 𝄞 👩‍💻 ‏؟ \u0000 end";
    const diagnostics = [info("analysis/empty-graph", message)];
    const body = (await (await okResponse({ diagnostics })).json()) as { diagnostics: Diagnostic[] };

    expect(body.diagnostics[0].message).toBe(message);
    expect([...body.diagnostics[0].message]).toEqual([...message]);
  });

  it("extra fields the caller puts on the payload are carried, not stripped", async () => {
    /* Later tasks return their own payloads through this envelope. One that keeps only
       the keys T000 happened to think of would silently drop half of T080's read model. */
    const payload = { digest: "sha256:00", extra: { nested: [1, 2, { deep: true }] }, count: 0 };
    expect(await (await okResponse(payload)).json()).toEqual(payload);
  });

  it("false, zero and the empty string survive as themselves", async () => {
    const payload = { flag: false, count: 0, note: "", list: [], object: {}, missing: null };
    expect(await (await okResponse(payload)).json()).toEqual(payload);
  });

  it("an oversized payload is still returned whole", async () => {
    const diagnostics = Array.from({ length: 2000 }, (_, i) =>
      warning("bundle/unpinned-card", `Card ${i} is not pinned.`, {
        location: { file: `cards/card-${i}.yaml`, line: i + 1 },
      }),
    );
    const body = (await (await okResponse({ diagnostics })).json()) as { diagnostics: Diagnostic[] };

    expect(body.diagnostics).toHaveLength(2000);
    expect(body.diagnostics[1999]).toEqual(diagnostics[1999]);
  });
});

describe("T000 contract — problem+json is RFC 9457, and hiding is a 404", () => {
  it("a resource the caller may not see is a 404 in problem+json", async () => {
    const mod = await loadHttp();
    const notFound = pickFn(mod, "a 404 helper", NOT_FOUND_NAMES, "@/lib/server/http");
    const response = await responseFrom(notFound, "the 404 helper", [
      [requestWithCookie()],
      [requestWithCookie(), "No such bundle."],
      [],
    ]);

    expect(response.status).toBe(404);
    expect(isProblemContentType(response.headers.get("content-type"))).toBe(true);
  });

  it("the 404 carries all five RFC 9457 members with the right types", async () => {
    const mod = await loadHttp();
    const notFound = pickFn(mod, "a 404 helper", NOT_FOUND_NAMES, "@/lib/server/http");
    const problem = await readProblem(
      await responseFrom(notFound, "the 404 helper", [
        [requestWithCookie()],
        [requestWithCookie(), "No such bundle."],
        [],
      ]),
    );

    expect(RFC9457_MEMBERS.filter((m) => problem[m] === undefined)).toEqual([]);
    expect(typeof problem.type).toBe("string");
    expect(typeof problem.title).toBe("string");
    expect(problem.status).toBe(404);
    expect(typeof problem.detail).toBe("string");
    expect(typeof problem.instance).toBe("string");
    /* RFC 9457 §3.1: `type` is a URI reference. "about:blank" is the one the spec names
       for a problem with no further semantics, and it is still a URI. */
    expect(() => new URL(String(problem.type), REQUEST_URL)).not.toThrow();
  });

  it("the 404 does not explain itself as a permission refusal", async () => {
    const mod = await loadHttp();
    const notFound = pickFn(mod, "a 404 helper", NOT_FOUND_NAMES, "@/lib/server/http");
    const problem = await readProblem(
      await responseFrom(notFound, "the 404 helper", [
        [requestWithCookie()],
        [requestWithCookie(), "No such bundle."],
        [],
      ]),
    );

    /* B-03's reason for 404 over 403 is that existence must not leak. A 404 whose prose
       says the caller lacks permission leaks it just as loudly as the status code would,
       and is the shape this rule is easiest to satisfy on paper and break in wording. */
    const prose = `${String(problem.title)} ${String(problem.detail)}`;
    expect(prose).not.toMatch(/forbidden|permission|not allowed|access denied|unauthori[sz]ed/i);
  });
});
