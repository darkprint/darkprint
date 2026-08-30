/* ============================================================
   The one HTTP client, after it learned a method.

   `request` was GET-only until `packages/cli`'s `report` verb
   needed to post a run report. The alternative was a second client
   in the CLI with a second base-URL default, a second env read and
   a second copy of the 429 rendering, which D-270-05(2) names as
   the thing not to do ("one env contract, one base-URL default, one
   429 rendering"). So this file holds the two properties that
   change makes load-bearing:

   **The default is unmoved.** Every call site in this repository
   passes no `init`, and each one has to keep sending exactly the
   GET it sent before — no method, no body, the same two headers.
   A widened function whose default drifted would break four
   verbs and an MCP server at once.

   **A caller's headers ADD, they do not replace.** `report` sends a
   session cookie and still needs `accept`, and an implementation
   that assigned the caller's object over the defaults would drop
   the `authorization` header of a keyed client without any cell
   noticing.

   Nothing here opens a socket: `fetch` is injected, which is the
   member's whole reason for existing (D-270-05(2)).
   ============================================================ */

import { describe, expect, it } from "vitest";

import { optionsFromEnv, request, RegistryError, type RegistryOptions } from "./registry";

interface Seen {
  url: string;
  method: string | undefined;
  body: unknown;
  headers: Headers;
}

function recording(response: () => Response): { seen: Seen[]; options: RegistryOptions } {
  const seen: Seen[] = [];
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: init?.method,
      body: init?.body,
      headers: new Headers(init?.headers),
    });
    return response();
  }) as unknown as typeof fetch;
  return { seen, options: { baseUrl: "https://registry.test", fetch: fetchStub } };
}

const ok = () => new Response("{}", { status: 200 });

describe("a request with no init", () => {
  it("sends no method and no body, so it is the GET every read route takes", async () => {
    const { seen, options } = recording(ok);
    await request(options, "/api/mcp/search?q=x");
    expect(seen[0].url).toBe("https://registry.test/api/mcp/search?q=x");
    expect(seen[0].method).toBeUndefined();
    expect(seen[0].body).toBeUndefined();
  });

  it("still sends the accept header, and the bearer when a key is configured", async () => {
    const { seen, options } = recording(ok);
    await request({ ...options, apiKey: "dp_secret" }, "/x");
    expect(seen[0].headers.get("accept")).toBe("application/json, text/yaml");
    expect(seen[0].headers.get("authorization")).toBe("Bearer dp_secret");
  });

  /* `Function.length` stops at the first parameter with a default, and `?` erases to
     nothing while `= undefined` does not. Both spellings have shipped here and the `?` was
     charged, so the arity is asserted rather than assumed: a third parameter spelled `?`
     would move this to 3 and move a published number with it. */
  it("publishes two parameters, because the third is spelled `= undefined`", () => {
    expect((request as (...args: never[]) => unknown).length).toBe(2);
  });
});

describe("a request with an init", () => {
  it("sends the method and the body it was given", async () => {
    const { seen, options } = recording(ok);
    await request(options, "/api/blueprints/a/b/runs", {
      method: "POST",
      body: JSON.stringify({ costUnits: 1 }),
    });
    expect(seen[0].method).toBe("POST");
    expect(seen[0].body).toBe('{"costUnits":1}');
  });

  /* The merge, in the direction that matters. A caller adding one header must not lose the
     two this module sets, and a keyed client posting a report has to keep sending its key
     even though the write route does not read one — dropping it silently would make the
     rate-limit ceiling change under a caller who configured a key. */
  it("adds a caller's headers to the defaults rather than replacing them", async () => {
    const { seen, options } = recording(ok);
    await request({ ...options, apiKey: "dp_secret" }, "/x", {
      headers: { cookie: "darkprint_session=abc", "content-type": "application/json" },
    });
    expect(seen[0].headers.get("cookie")).toBe("darkprint_session=abc");
    expect(seen[0].headers.get("content-type")).toBe("application/json");
    expect(seen[0].headers.get("accept")).toBe("application/json, text/yaml");
    expect(seen[0].headers.get("authorization")).toBe("Bearer dp_secret");
  });

  it("lets a caller override a default it names", async () => {
    const { seen, options } = recording(ok);
    await request(options, "/x", { headers: { accept: "text/plain" } });
    expect(seen[0].headers.get("accept")).toBe("text/plain");
  });
});

describe("the refusals, unchanged by the widening", () => {
  it("renders a 404 as the sentence that does not distinguish private from absent", async () => {
    const { options } = recording(() => new Response("{}", { status: 404 }));
    await expect(request(options, "/x", { method: "POST" })).rejects.toThrow(RegistryError);
    await expect(request(options, "/x", { method: "POST" })).rejects.toThrow(
      /404 rather than 403/,
    );
  });

  it("renders a refusal's own detail for any other status", async () => {
    const { options } = recording(
      () =>
        new Response(JSON.stringify({ detail: "runs: the report is malformed." }), { status: 400 }),
    );
    await expect(request(options, "/x", { method: "POST" })).rejects.toThrow(
      "runs: the report is malformed.",
    );
  });

  it("says the host is unreachable rather than not-found when the fetch throws", async () => {
    const options: RegistryOptions = {
      baseUrl: "https://registry.test",
      fetch: (() => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    };
    await expect(request(options, "/x", { method: "POST" })).rejects.toThrow(/Could not reach/);
  });
});

describe("the env contract, stated once", () => {
  it("defaults the base URL and reads the key, with no session of its own", () => {
    const options = optionsFromEnv({} as NodeJS.ProcessEnv);
    expect(options.baseUrl).toBe("https://darkprint.io");
    expect(options.apiKey).toBeUndefined();
    /* A session is NOT part of this shape and must not become part of it: this module is
       the read client an MCP server runs, and it has no business holding a credential that
       acts as a person. `packages/cli/src/registry.ts` resolves DARKPRINT_SESSION for the
       one verb that writes, and passes it as a header. */
    expect(Object.hasOwn(options, "session")).toBe(false);
  });
});
