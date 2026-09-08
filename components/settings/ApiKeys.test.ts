import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { plainText } from "@/components/ui/visible-text";
import { ApiKeys, PUBLISH_CURL, SCOPE_COPY } from "./ApiKeys";

/**
 * The scope sentences are read once, at the moment a key is minted, so they have to say what
 * the routes do today. The write sentence used to say no endpoint accepted a key for a write;
 * `POST /api/bundles`, `POST /api/cards` and `POST /api/blueprints/[owner]/[slug]/runs` now
 * do, behind `withSessionOrWriteKey`, and these cells pin the copy to that.
 */
describe("API key scope copy", () => {
  it("the write sentence names the three write routes and the bearer form", () => {
    const blurb = SCOPE_COPY.write.blurb;
    expect(blurb).toContain("POST /api/bundles");
    expect(blurb).toContain("POST /api/cards");
    expect(blurb).toContain("POST /api/blueprints/{owner}/{slug}/runs");
    expect(blurb).toContain("bearer token");
    expect(blurb).toContain("agent");
  });

  it("the write sentence no longer says the key unlocks nothing", () => {
    const blurb = SCOPE_COPY.write.blurb.toLowerCase();
    expect(blurb).not.toContain("no endpoint accepts");
    expect(blurb).not.toContain("yet");
    expect(blurb).not.toContain("not built");
    expect(blurb).not.toContain("when one does");
  });

  it("the curl targets POST /api/bundles on the www host with a bearer header", () => {
    expect(PUBLISH_CURL).toContain("curl -X POST https://www.darkprint.io/api/bundles");
    expect(PUBLISH_CURL).toContain('-H "Authorization: Bearer $DARKPRINT_API_KEY"');
    expect(PUBLISH_CURL).toContain('-H "Content-Type: application/json"');
    expect(PUBLISH_CURL).toContain("--data @publish.json");
    /* Never the apex: production serves www. */
    expect(PUBLISH_CURL).not.toMatch(/https:\/\/darkprint\.io\//);
  });

  it("the read sentence promises no write and points at what does", () => {
    expect(SCOPE_COPY.read.blurb).toContain("authorises no write");
    expect(SCOPE_COPY.read.blurb).toContain("write key");
  });

  it("renders the read sentence by default, and no em dash reaches the page", () => {
    const html = renderToStaticMarkup(createElement(ApiKeys));
    const text = plainText(html);
    expect(text).toContain(SCOPE_COPY.read.blurb);
    expect(text).toContain("Write");
    expect(html).not.toContain("—");
    for (const copy of Object.values(SCOPE_COPY)) expect(copy.blurb).not.toContain("—");
    expect(PUBLISH_CURL).not.toContain("—");
  });
});
