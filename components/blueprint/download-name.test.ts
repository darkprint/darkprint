/* ============================================================
   The header's quick download button, held against the file it
   actually saves.

   Lifecycle-scoring spec §3.1: the button used to read "Download
   factory.dot" and point at `factoryHref`. The author's ask was a
   text-only rename to "Download blueprint.dot", and the page's own
   comment records why that could not be a text-only change: "a label
   and a saved filename that disagree is a defect this project has
   fixed before." The fix moved the `href`/`download` pair onto
   `topologyHref`/`TOPOLOGY_DOT` alongside the rename, and this is the
   test that would have caught the version where only the label
   moved — a build, `tsc` and every other suite in this project are
   silent about a `download` attribute that disagrees with the text
   beside it, because nothing else reads the two together.

   Rendered the way `weight-provenance.test.ts` and
   `components/site/honesty.test.ts` render a route from a test: the
   page is an async server component, awaited directly with a real
   slug rather than mounted through a router, and handed to
   `renderToStaticMarkup`. No DOM: this is a markup string held
   against three literals.
   ============================================================ */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Page from "@/app/blueprints/[slug]/page";
import { allBlueprints } from "@/lib/content";
import { FACTORY_DOT, TOPOLOGY_DOT, bundleHref } from "@/lib/content/bundle-export";

const BLUEPRINTS = allBlueprints();

/** `Page` takes `params` as a promise, same shape `PageProps` gives it at request time. */
async function render(slug: string): Promise<string> {
  const page = Page as unknown as (props: {
    params: Promise<{ slug: string }>;
  }) => Promise<ReactElement>;
  return renderToStaticMarkup(await page({ params: Promise.resolve({ slug }) }));
}

describe("the archive this test is held over", () => {
  it("has more than one blueprint, so a slug-specific fluke cannot pass every case", () => {
    expect(BLUEPRINTS.length).toBeGreaterThan(1);
  });
});

describe("the header's quick download button names the file it saves", () => {
  it.each(BLUEPRINTS.map((bp) => bp.slug))(
    "%s: the label, the download attribute and the href all name blueprint.dot",
    async (slug) => {
      const html = await render(slug);
      const at = html.indexOf("Download blueprint.dot");
      expect(at, `${slug} has no "Download blueprint.dot" button`).toBeGreaterThan(-1);

      // The attributes render immediately in front of the label on this element
      // (`download="…" href="…"` then the text node) — a fixed window in front of the
      // match is enough to hold the one anchor without picking up an unrelated link
      // earlier on the page.
      const tag = html.slice(Math.max(0, at - 250), at);
      expect(tag, `${slug}: download attribute is not blueprint.dot`).toContain(
        `download="${TOPOLOGY_DOT}"`,
      );
      expect(tag, `${slug}: href does not point at the topology file`).toContain(
        `href="${bundleHref(slug, TOPOLOGY_DOT)}"`,
      );
      // The exact regression this guards: a rename that moves the label and leaves the
      // attribute pointing at the runnable pipeline instead of the topology file.
      expect(tag, `${slug}: still saves ${FACTORY_DOT} under the new label`).not.toContain(
        FACTORY_DOT,
      );
    },
  );
});
