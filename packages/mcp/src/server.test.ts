/* ============================================================
   darkprint mcp — the transport, driven rather than read
   Colocated here because the packages glob D-220-08 added to
   `vitest.config.ts` collects it, and because this is the half of
   T220 the blind suite is ruled OUT of: D-220-09 says no cell
   under `tests/server/t220` can drive a 429, since none of the
   four `Db`-taking verbs carries an ip, a key or a tier. So AC6
   has exactly one instrument and it is this file.

   Everything is driven through the real `serve` loop over a real
   pipe, with only `fetch` stubbed. A test that called `rateLimitMessage`
   directly would assert this package agrees with itself and would
   stay green the day `tools/call` starts rendering a refusal as an
   RPC error — which is the one mistake that makes AC6 false while
   every string in it stays correct.
   ============================================================ */

import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { RegistryOptions } from "./registry";
import { runServer } from "./server";

/** Runs the server over one scripted session and returns the messages it wrote. */
async function session(
  lines: readonly unknown[],
  stub: typeof fetch,
): Promise<Record<string, unknown>[]> {
  const input = Readable.from([lines.map((line) => `${JSON.stringify(line)}\n`).join("")]);
  const written: string[] = [];
  const output = new Writable({
    write(chunk: Buffer, _encoding, done) {
      written.push(chunk.toString("utf8"));
      done();
    },
  });

  const options: RegistryOptions = { baseUrl: "https://registry.test", fetch: stub };
  await runServer(options, input, output);

  return written
    .join("")
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** A stub that answers every request with one canned response. */
function answering(response: Response): typeof fetch {
  return (() => Promise.resolve(response)) as typeof fetch;
}

function problem429(members: Record<string, unknown>): Response {
  return new Response(JSON.stringify(members), {
    status: 429,
    headers: { "content-type": "application/problem+json" },
  });
}

/** D-230-09's published key set, byte for byte, as `rateLimited()` emits it. */
const RATE_LIMITED = {
  type: "https://darkprint.io/problems/rate-limited",
  title: "Rate limited",
  status: 429,
  /* `rateLimitDetail`'s form, byte for byte (`limits/errors.ts:182`). It carries the instant
     TOO, which is what made the first version of the `resetAt` cell below vacuous — see
     there. */
  detail: "read: limit of 600 per hour reached; resets at 2099-01-01T00:00:00.000Z.",
  instance: "/api/mcp/search",
  limit: 600,
  remaining: 0,
  resetAt: "2099-01-01T00:00:00.000Z",
  keysAvailable: true,
};

const INITIALIZE = { jsonrpc: "2.0", id: 1, method: "initialize", params: {} };

describe("the MCP transport speaks the protocol", () => {
  it("answers initialize with a version and a tools capability", async () => {
    const [reply] = await session([INITIALIZE], answering(new Response("{}")));
    const result = reply?.result as Record<string, unknown>;

    expect(reply?.id).toBe(1);
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.capabilities).toEqual({ tools: {} });
  });

  it("lists the four advertised operations, the compiler, and nothing else", async () => {
    const [, list] = await session(
      [INITIALIZE, { jsonrpc: "2.0", id: 2, method: "tools/list" }],
      answering(new Response("{}")),
    );
    const tools = (list?.result as { tools: { name: string }[] }).tools;

    /* Still an exact set and not a superset: a tool nobody argued for is a capability
       nobody granted, and a missing one is an operation `/mcp` advertises.
       AMENDED for `export_pipeline`. This cell read four and said "a fifth tool is a
       capability the contract's `read access and nothing else` does not grant", which is
       the right rule and is not what `export_pipeline` does. It reaches the release route
       and the files route, both of which `fetch_release` already grants and `clone`
       already uses; it writes nothing; and it returns a transformation of those bytes
       rather than anything new out of the registry. An agent that calls it can reproduce
       the answer with `darkprint clone` and `darkprint export --attractor`, which is the
       test of whether a tool granted access or only saved a step.
       The four still stand for the four operations `app/mcp/page.tsx` advertises, and
       `tests/server/t220/surface.test.ts` holds the barrel to that page's own count. This
       list is the distributable's, which is a wider thing than the page's table. */
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "export_pipeline",
      "fetch_release",
      "inspect_provenance",
      "read_card",
      "search",
    ]);
  });

  it("writes no response to a notification", async () => {
    const written = await session(
      [{ jsonrpc: "2.0", method: "notifications/initialized" }],
      answering(new Response("{}")),
    );
    expect(written).toEqual([]);
  });

  it("answers a malformed line with -32700 and keeps serving", async () => {
    const input = Readable.from(["{not json\n" + `${JSON.stringify(INITIALIZE)}\n`]);
    const written: string[] = [];
    const output = new Writable({
      write(chunk: Buffer, _encoding, done) {
        written.push(chunk.toString("utf8"));
        done();
      },
    });
    await runServer(
      { baseUrl: "https://registry.test", fetch: answering(new Response("{}")) },
      input,
      output,
    );

    const messages = written.join("").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect((messages[0].error as { code: number }).code).toBe(-32700);
    /* The second message is the point: a bad line must not end the session. */
    expect(messages[1].id).toBe(1);
  });
});

describe("AC6: an unkeyed client is limited and told so in a form an agent can act on", () => {
  it("renders the 429 as a TOOL RESULT, which is the only place the model reads", async () => {
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      answering(problem429(RATE_LIMITED)),
    );

    /* NOT `error`. A JSON-RPC error is a transport fault the host shows the user and the
       model never sees, so a refusal rendered there is opaque to exactly the audience the
       criterion names — while every string inside it stays correct. */
    expect(call?.error, "the refusal must not be an RPC error; the model cannot read one").toBeUndefined();
    const result = call?.result as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
  });

  it("names the ceiling, the reset instant and the key affordance", async () => {
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      answering(problem429(RATE_LIMITED)),
    );
    const text = (call?.result as { content: { text: string }[] }).content[0].text;

    /* The three things AC6 requires reach the client. `detail` carries the limit byte for
       byte (D-230-09: "`detail` is the admissible form byte for byte"), so asserting the
       number rather than the sentence keeps this cell from pinning T230's wording. */
    expect(text, "the ceiling").toContain("600");
    expect(text, "the reset instant").toContain("2099-01-01T00:00:00.000Z");

    /* ── this assertion is the one that measures the `resetAt` MEMBER, and the obvious one
       above does not ──

       Measured, not reasoned: deleting the `resetAt` branch from `rateLimitMessage` reddened
       0 of 10 cells. `detail` is the admissible form byte for byte and the form ends
       `resets at <instant>`, so the instant is in the text whether or not this client ever
       looked at the member — the assertion above passes against a client that reads only
       `detail`, which is precisely the client D-230-09 published a machine-readable member to
       stop people writing.

       `about ... from now` can only be produced by `new Date(problem.resetAt)`. It is the one
       string in the message that no `detail` can supply. */
    expect(text, "the member was PARSED, not the sentence copied").toContain("from now");
    expect(text.toLowerCase(), "that a key exists and raises the ceiling").toContain("key");
    expect(text, "how a caller supplies one, or the affordance is not actionable").toContain(
      "DARKPRINT_API_KEY",
    );

    /* The failure this cell exists to exclude, named rather than merely not admitted: a bare
       status code is a refusal an agent retries against immediately and forever. */
    expect(text, "an opaque refusal is the failure mode the criterion names").not.toBe("429");
  });

  it("reports the reset instant from a 429 that carries no `detail` at all", async () => {
    /* The isolating cell. With `detail` absent the member is the ONLY source of the instant,
       so this reds under any client that reads the sentence instead of the field — including
       an older registry whose form has not got one. */
    const membersOnly = { status: 429, limit: 600, remaining: 0, resetAt: "2099-01-01T00:00:00.000Z", keysAvailable: true };
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      answering(problem429(membersOnly)),
    );
    const text = (call?.result as { content: { text: string }[] }).content[0].text;

    expect(text).toContain("2099-01-01T00:00:00.000Z");
    expect(text, "the ceiling survives an absent `detail` too").toContain("600");
  });

  it("says nothing about keys when the registry does not offer them", async () => {
    const withoutKeys = { ...RATE_LIMITED, keysAvailable: false };
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      answering(problem429(withoutKeys)),
    );
    const text = (call?.result as { content: { text: string }[] }).content[0].text;

    /* The disagreeing control. Without it every assertion above passes against a client that
       prints the key sentence unconditionally, and the affordance would then be a constant
       rather than something read off the wire. */
    expect(text).not.toContain("DARKPRINT_API_KEY");
    expect(text, "the limit is still reported").toContain("2099-01-01T00:00:00.000Z");
  });

  it("still refuses legibly when the 429 carries none of T230's members", async () => {
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      answering(new Response("<html>gateway</html>", { status: 429 })),
    );
    const result = call?.result as { isError?: boolean; content: { text: string }[] };

    /* A proxy's own error page reaches a client that is older or newer than the service. A
       formatter that throws here turns a rate limit into an internal error, which is the
       opaque refusal again by a different route. */
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain("rate limited");
  });
});

describe("a 404 does not read as an outage, and an outage does not read as a 404", () => {
  it("says the address holds nothing, or is not public", async () => {
    const [, call] = await session(
      [
        INITIALIZE,
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "read_card", arguments: { ref: "nope@1.0.0" } },
        },
      ],
      answering(new Response("{}", { status: 404 })),
    );
    const text = (call?.result as { content: { text: string }[] }).content[0].text;
    expect(text.toLowerCase()).toContain("nothing at that address");
  });

  it("says the registry is unreachable when the fetch itself fails", async () => {
    const failing = (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch;
    const [, call] = await session(
      [
        INITIALIZE,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "search", arguments: { task: "x" } } },
      ],
      failing,
    );
    const text = (call?.result as { content: { text: string }[] }).content[0].text;

    /* An agent told "not found" stops looking; an agent told the host is unreachable retries
       or tells its user. Excluding the wrong sentence, not merely admitting the right one. */
    expect(text).toContain("Could not reach");
    expect(text.toLowerCase()).not.toContain("nothing at that address");
  });
});
