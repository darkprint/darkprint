import { HeroAction } from "darkprint";

// HeroAction has no props: it reads GET /api/auth/session on mount and picks one
// of four states from the answer. The capture harness is a static file server, so
// that route 404s and `readSession` lands on `unreachable`, which the component
// renders as null. Only a 401 reaches the `anonymous` branch. Answering that one
// request here lets the real component run its real code path; every other
// request is left alone.
if (typeof window !== "undefined") {
  const passthrough = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return url.includes("/api/auth/session")
      ? Promise.resolve(new Response("{}", { status: 401, headers: { "content-type": "application/json" } }))
      : passthrough(input, init);
  };
}

/**
 * What an anonymous visitor meets above the fold. The signed-in states need a
 * session this harness has no backend to issue, so the card shows the one state
 * a first-time reader actually sees.
 */
export const Anonymous = () => (
  <div className="flex max-w-lg flex-col gap-4">
    <p className="text-sm text-dim">What the fold shows above the two route doors:</p>
    <HeroAction />
  </div>
);
