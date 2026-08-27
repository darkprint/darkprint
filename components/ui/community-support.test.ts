import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { compact } from "@/lib/format";
import { downloadsFor, starsFor } from "@/lib/data/node-community";
import { BundleHeader } from "@/components/bundle/BundleHeader";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

describe("community support on detail pages", () => {
  /**
   * The claim moved twice now, and each move is recorded rather than silently repointed.
   *
   * It used to be one regex over `app/blueprints/[owner]/[slug]/page.tsx`, matching an `<h1>` and a
   * `<FavoriteStar count={bp.votes}>` in the same file. The accounts pass moved both into
   * `components/bundle/BundleHeader.tsx`; T280 moves the FIGURE itself a second time, off
   * `bp.votes` (a seeded fixture number, `EMPTY_COMMUNITY`'s `0` since this page stopped
   * reading `lib/data/community.ts`) and onto `signals.starCount` from `getSignals` — the
   * live star count `POST /api/blueprints/{owner}/{slug}/star` moves. The support figure
   * this page prints is therefore no longer seeded at all, which is why the render half
   * below stops asserting the `◐ seeded` marker: the marker's job was to say a number was
   * illustrative, and this one is not.
   */
  it("puts the live blueprint star count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/blueprints/[owner]/[slug]/page.tsx`, "utf8");
    const mount = /<BundleHeader\b([\s\S]*?)\/?>/.exec(source);
    expect(mount, "the blueprint page no longer mounts <BundleHeader>").not.toBeNull();
    expect(mount?.[1]).toContain("title={bp.title}");
    expect(mount?.[1], "BundleHeader is not given the live `star` prop").toContain("star={{");
    expect(
      mount?.[1],
      "the star pill's count is not read off getSignals's answer",
    ).toContain("count: signals?.starCount");

    const [bp] = allBlueprints();
    expect(bp, "the archive is empty").toBeDefined();
    const html = renderToStaticMarkup(
      createElement(BundleHeader, {
        owner: bp!.author,
        slug: bp!.slug,
        visibility: "public" as const,
        title: bp!.title,
        summary: bp!.summary,
        watchers: 0,
        forks: 0,
        saveId: `blueprint:${bp!.slug}`,
        star: { api: "/api/blueprints/darkprint/x/star", count: 214, starred: false, signedIn: false },
      }),
    );
    expect(html, "the band stopped printing the title").toContain(bp!.title);
    expect(html, "the band stopped printing the live star count").toContain(compact(214));
  });

  /**
   * T280 wires this figure to `lib/server/counters`. `starsFor`/`NODE_DOWNLOADS` are still
   * this file's fixtures — `lib/data/node-community.ts` stays for the tests below and for
   * any caller that has not cut over — but the page itself reads `getSignals` now, and the
   * `◐ seeded` glyph the earlier cell pinned no longer renders beside a real counter
   * (D-78's other direction).
   */
  it("puts the live node support count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/nodes/[...id]/page.tsx`, "utf8");
    expect(source).toContain('getSignals(db, actor, { kind: "card", refId: card.id })');
    const mount = /<h1[\s\S]*?<FavoriteStar\b([\s\S]*?)\/>/.exec(source);
    expect(mount, "the node page no longer mounts <FavoriteStar> beside its <h1>").not.toBeNull();
    expect(mount?.[1], "FavoriteStar is not given the live `star` prop").toContain("star={{");
    expect(mount?.[1], "the star pill's count is not read off getSignals's answer").toContain(
      "count: signals.starCount",
    );
  });

  it("keeps an unknown node at zero support", () => {
    expect(downloadsFor("not-in-the-archive")).toBe(0);
    expect(starsFor("not-in-the-archive")).toBe(0);
  });
});
