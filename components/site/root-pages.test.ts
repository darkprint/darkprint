import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound, { metadata as notFoundMetadata } from "@/app/not-found";
import ErrorPage from "@/app/error";
import { plainText } from "@/components/ui/visible-text";

/* The two pages a reader meets when a route has nothing to show. Both are rendered here
   because neither is reachable from a route a test can name: one answers every unknown
   URL and every `notFound()`, the other every render that threw. */

describe("the not-found page", () => {
  const html = renderToStaticMarkup(createElement(NotFound));
  const text = plainText(html);

  it("names itself and stays out of search results", () => {
    expect(text).toContain("Page not found");
    expect(notFoundMetadata.title).toBe("Page not found");
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("offers the three places a reader most likely wanted", () => {
    expect(html).toContain('href="/blueprints"');
    expect(html).toContain('href="/nodes"');
    expect(html).toContain('href="/spec/card"');
    expect(text).toContain("Browse blueprints");
    expect(text).toContain("Browse cards");
  });

  it("says what an address looks like here", () => {
    expect(text).toContain("/blueprints/{owner}/{slug}");
    expect(text).toContain("/nodes/{id}");
    expect(text).toContain("/u/{handle}");
  });
});

describe("the error boundary", () => {
  function render(error: Error & { digest?: string }): string {
    return renderToStaticMarkup(
      createElement(ErrorPage, { error, unstable_retry: () => undefined }),
    );
  }

  it("says something went wrong, offers a retry, and prints no stack", () => {
    const error = Object.assign(new Error("boom at lib/secret.ts:12"), { digest: "abc123" });
    const text = plainText(render(error));
    expect(text).toContain("Something went wrong");
    expect(text).toContain("Try again");
    expect(text).toContain("Reference: abc123");
    expect(text, "the error's own message reached the page").not.toContain("lib/secret.ts");
    expect(text, "the error's own message reached the page").not.toContain("boom");
  });

  it("omits the reference line when there is no digest", () => {
    expect(plainText(render(new Error("x")))).not.toContain("Reference:");
  });
});
