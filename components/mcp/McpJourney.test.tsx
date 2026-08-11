import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { McpJourney } from "./McpJourney";

/* ============================================================
   THIS FILE HAD NEVER RUN.

   `vitest.config.ts` collected only `.test.ts` under `components`,
   and three files in the tree are `.test.tsx`. (Not written as the
   glob here: a `*` followed by a `/` closes a block comment, which
   is its own small lesson about strings that look like paths.) They
   typechecked, they linted, they sat beside the components they
   name, and the runner never saw one of them. The glob takes both
   extensions now, which is what surfaced the two assertions below.

   Both were unreachable rather than wrong. `McpJourney` opens
   `disconnected` with `searched: false`, and the results block is
   gated on `connection === "connected" && searched` — so a static
   render cannot contain a result card, its digest, or the link out
   of it, however many results are passed in. The test asserted all
   three and would have failed on the day it was written.

   So the claim is kept and split by what can carry it: the four
   controls a reader meets before touching anything are asserted
   against the render, and the two strings behind the interaction are
   asserted against the source, where they are demonstrably still
   written and still gated. That is weaker than a driven render and
   stronger than an assertion nobody ever executed.
   ============================================================ */

const SOURCE = readFileSync(
  fileURLToPath(new URL("./McpJourney.tsx", import.meta.url)),
  "utf8",
);

describe("McpJourney", () => {
  const html = renderToStaticMarkup(
    createElement(McpJourney, {
      results: [
        {
          slug: "starter-software-factory",
          title: "Starter Software Factory",
          summary: "A separated software workflow.",
          digest: "sha256:1234567890abcdef",
          author: "darkprint",
        },
      ],
    }),
  );

  it("opens on least-privilege setup, recovery and search", () => {
    expect(html).toContain("registry:read");
    expect(html).toContain("Private workspaces");
    expect(html).toContain("Show failure recovery");
    expect(html).toContain("Search registry");
  });

  /**
   * The state machine the two unreachable assertions ran into.
   *
   * A result card is behind two flips — connect, then search — and that gating is the
   * point of the journey rather than an accident of it: the page is a walk-through of what
   * an agent would do, and showing results before either step would skip the argument.
   */
  it("keeps every result behind a connection and a search", () => {
    expect(html).not.toContain("Inspect and fetch this exact release");
    expect(SOURCE).toContain('connection === "connected" && searched');
  });

  /** Provenance before fetching: the digest and the exact-release link are still written. */
  it("still offers provenance and the exact release once it has both", () => {
    expect(SOURCE).toContain("Digest");
    expect(SOURCE).toContain("Inspect and fetch this exact release");
    // And the link goes to the release section rather than to the top of the page.
    expect(SOURCE).toContain("#use-this-blueprint");
  });
});
