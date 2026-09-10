/* ============================================================
   Every write address under /api/bundles refuses a wrong method
   with an `Allow` header naming the one method it does take.

   Next synthesises the 405 for a method a route file does not
   export, and that response carries no `Allow` and no body: a
   caller who guesses wrong is told the guess failed and nothing
   else, which leaves an agent holding an address to guess verbs
   against it. Each refusal is therefore written by hand, and the
   header is what this file holds it to.

   The expected method is spelled out in the table rather than read
   from the route's own `ALLOW`. The claim is that the header names
   the method the address REALLY takes, and an oracle the route
   supplies moves with the route instead of checking it.

   No database. A method refusal is decided before any handler that
   would open a pool, so every cell runs on an empty environment.
   ============================================================ */

import { describe, expect, it } from "vitest";

const ORIGIN = "https://darkprint.io";
const PROBLEM_TYPE = "https://darkprint.io/problems/method-not-allowed";

/** The two exports a refusing address publishes. Typed, so a dropped export fails typecheck. */
interface Refusing {
  GET(request: Request): Response;
  OPTIONS(): Response;
}

interface Address {
  /** The route pattern, for the cell's name. */
  readonly route: string;
  /** A concrete path, which is also the `instance` the problem document has to report. */
  readonly path: string;
  /** The method the address serves, written here and not imported. */
  readonly allow: string;
  readonly load: () => Promise<Refusing>;
}

/* One literal `import()` per row rather than a computed specifier: resolving the relative
   path is the bundler's job and it needs the string visible at the call site, which is why
   every route test in this tree writes each one out. */
const ADDRESSES: readonly Address[] = [
  {
    route: "POST /api/bundles",
    path: "/api/bundles",
    allow: "POST",
    load: () => import("./route"),
  },
  {
    route: "POST /api/bundles/draft",
    path: "/api/bundles/draft",
    allow: "POST",
    load: () => import("./draft/route"),
  },
  {
    route: "DELETE /api/bundles/[owner]/[slug]",
    path: "/api/bundles/acme/nightly-triage",
    allow: "DELETE",
    load: () => import("./[owner]/[slug]/route"),
  },
  {
    route: "PATCH /api/bundles/[owner]/[slug]/visibility",
    path: "/api/bundles/acme/nightly-triage/visibility",
    allow: "PATCH",
    load: () => import("./[owner]/[slug]/visibility/route"),
  },
  {
    route: "POST /api/bundles/[owner]/[slug]/fork",
    path: "/api/bundles/acme/nightly-triage/fork",
    allow: "POST",
    load: () => import("./[owner]/[slug]/fork/route"),
  },
];

describe("the five write addresses under /api/bundles", () => {
  it.each(ADDRESSES)("$route answers GET with 405 and its own method in Allow", async (address) => {
    const { GET, OPTIONS } = await address.load();

    const refusal = GET(new Request(`${ORIGIN}${address.path}`));
    expect(refusal.status).toBe(405);
    expect(refusal.headers.get("allow")).toBe(address.allow);
    expect(refusal.headers.get("content-type")).toBe("application/problem+json");

    const body = (await refusal.json()) as { type: string; detail: string; instance: string };
    expect(body.type).toBe(PROBLEM_TYPE);
    expect(body.instance).toBe(address.path);
    /* The sentence has to name the method too. A refusal whose body repeats nothing the
       header said leaves a caller reading headers to find the one useful fact. */
    expect(body.detail).toContain(address.allow);

    /* The OPTIONS export is the half a synthesised answer gets wrong: Next builds its Allow
       from every method the file exports, and GET is exported here only to say no. */
    const options = OPTIONS();
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe(address.allow);
  });
});
