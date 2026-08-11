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
   * The claim is unchanged and the mechanism moved.
   *
   * It used to be one regex over `app/blueprints/[slug]/page.tsx`, matching an `<h1>` and a
   * `<FavoriteStar count={bp.votes}>` in the same file. The accounts pass moved both into
   * `components/bundle/BundleHeader.tsx`, the band `/u/<owner>/<slug>` also mounts, so that
   * regex stopped matching while the page carried on drawing exactly what it asserted.
   *
   * A guard that fails on a move it should not care about gets deleted by the next author,
   * so this now checks the two halves where they actually are: the page hands the figure
   * and the title to the band, and the band really draws them together. The second half is
   * a render over a real archive blueprint rather than a fixture, so it also fails if the
   * band stops printing one of them.
   */
  it("puts the seeded blueprint support count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/blueprints/[slug]/page.tsx`, "utf8");
    const mount = /<BundleHeader\b([\s\S]*?)\/?>/.exec(source);
    expect(mount, "the blueprint page no longer mounts <BundleHeader>").not.toBeNull();
    expect(mount?.[1]).toContain("title={bp.title}");
    expect(mount?.[1]).toContain("support={bp.votes}");

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
        support: bp!.votes,
      }),
    );
    expect(html, "the band stopped printing the title").toContain(bp!.title);
    expect(html, "the band stopped printing the support figure").toContain(
      compact(bp!.votes),
    );
    // And it is still marked seeded where it renders, which is the point of printing it.
    expect(html.toLowerCase()).toContain("seeded");
  });

  it("puts the seeded node support count beside the title", () => {
    const source = readFileSync(`${ROOT}/app/nodes/[...id]/page.tsx`, "utf8");
    expect(source).toContain("const stars = starsFor(card.id)");
    expect(source).toMatch(/<h1[\s\S]*?<FavoriteStar[\s\S]*?count=\{stars\}/);
  });

  it("keeps an unknown node at zero support", () => {
    expect(downloadsFor("not-in-the-archive")).toBe(0);
    expect(starsFor("not-in-the-archive")).toBe(0);
  });
});
