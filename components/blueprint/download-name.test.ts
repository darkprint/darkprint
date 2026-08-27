/* ============================================================
   The header's quick download saves the file its label names.

   The defect this was written for: the button pointed at `factory.dot` under a label that
   said `blueprint.dot`, so a reader who clicked "Download blueprint.dot" got the compiled
   pipeline instead of the topology they had just been reading. A label and a saved filename
   that disagree is a defect this project has fixed before, and the fix only holds while
   something checks that the two props land on the same element.

   ── Why this renders the COMPONENT and not the page (D-261-11) ──
   It used to `import Page from "@/app/blueprints/[slug]/page"` and invoke it. That worked
   while the page read `content/` at module scope and needed nothing but a slug. B-09 moved
   the route and the cutover made the body per-request: the page now opens a database and
   reads a session, so a node-environment cell that calls its default export needs
   infrastructure this suite has never had. **The segment export does not help — it protects
   the spelling, not the body**, which is the mechanism D-261-11 records for the next
   cutover.

   So the subject is `DownloadPanel` with props, which is `severity-word.test.ts`'s idiom
   and the house pattern: the same assertions over the same element, with the wiring half
   moved to the blind suite's route-rendering family rather than deleted. Ruled a rewrite
   and not a weakening BEFORE it was written (D-261-11).

   ── Why the hrefs are digest addresses now ──
   `bundleHref` named `public/bundles/<slug>/…`, the mirror `scripts/generate-bundles.ts`
   writes from `content/` before a build. A blueprint published since the last deploy has
   nothing there, so the page binds the release's immutable digest address instead
   (D-261-04). The expected values here are built the way the page builds them.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import { FACTORY_DOT, TOPOLOGY_DOT, cardFilePath } from "@/lib/content/bundle-export";
import { blueprintFileHref } from "@/lib/href";
import { DownloadPanel } from "./DownloadPanel";

const BLUEPRINTS = allBlueprints();

/** The handle the archive's nine are owned by, which is what their URLs carry. */
const OWNER = "darkprint";

/**
 * The panel exactly as the canonical page mounts it, for one bundle.
 *
 * The digest is the bundle's own, so the address under test is the one a reader would be
 * handed rather than a constant that happens to be a hex string.
 */
function render(bp: (typeof BLUEPRINTS)[number]): string {
  const at = { digest: bp.digest };
  return renderToStaticMarkup(
    createElement(DownloadPanel, {
      topologyHref: blueprintFileHref(OWNER, bp.slug, at, TOPOLOGY_DOT),
      readmeHref: blueprintFileHref(OWNER, bp.slug, at, "README.md"),
      agentsHref: blueprintFileHref(OWNER, bp.slug, at, "AGENTS.md"),
      cards: [...new Set(bp.cardRefs)].sort().map((ref) => ({
        ref,
        href: blueprintFileHref(OWNER, bp.slug, at, cardFilePath(ref)),
      })),
    }),
  );
}

describe("the archive this test is held over", () => {
  it("has more than one blueprint, so a slug-specific fluke cannot pass every case", () => {
    expect(BLUEPRINTS.length).toBeGreaterThan(1);
  });
});

describe("the header's quick download button names the file it saves", () => {
  /* AMENDED at the topology rename (owner-instructed, 2026-08-25; blob re-pinned in
     tests/server/t261/frozen-tests.test.ts in the same commit, cause named there). The
     file the registry stores is `topology.dot` now, so the pinned label moves WITH the
     `download=` attribute — moving one without the other is precisely the label/filename
     disagreement this suite was written to refuse, and for one working-tree moment the
     tree held that exact defect (label old, attribute new) because this file was frozen. */
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s: the label, the download attribute and the href all name topology.dot",
    (slug, bp) => {
      const html = render(bp);
      const at = html.indexOf("Download topology.dot");
      expect(at, `${slug} has no "Download topology.dot" button`).toBeGreaterThan(-1);

      /* The anchor that carries the label, taken by finding its opening tag rather than by
         stepping back a fixed number of bytes. It WAS a 250-character window, and that
         window stopped reaching: a digest address is three times longer than the mirror
         path it replaced, so the `href` fell outside it and every case failed on a panel
         that was rendering correctly. A byte count is a guess about how long a URL is. */
      const tag = html.slice(html.lastIndexOf("<a ", at), at);
      expect(tag, `${slug}: download attribute is not blueprint.dot`).toContain(
        `download="${TOPOLOGY_DOT}"`,
      );
      expect(tag, `${slug}: href does not point at the topology file`).toContain(
        `href="${blueprintFileHref(OWNER, slug, { digest: bp.digest }, TOPOLOGY_DOT)}"`,
      );
      // The exact regression this guards: a rename that moves the label and leaves the
      // attribute pointing at the runnable pipeline instead of the topology file.
      expect(tag, `${slug}: still saves ${FACTORY_DOT} under the new label`).not.toContain(
        FACTORY_DOT,
      );
    },
  );

  /**
   * The address is the release's, not the build's — the half of D-261-04 a prop-shaped
   * cell could otherwise pass without noticing.
   *
   * Held as a negative and a positive together: the mirror path may not come back, and the
   * digest of the bundle under test has to be IN the URL. A cell asserting only the first
   * would pass against a page that dropped the digest segment; one asserting only the
   * second would pass against a URL that carried both.
   */
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s: every download link is the release's digest address, not the static mirror",
    (slug, bp) => {
      const html = render(bp);
      expect(html, `${slug} still links the build-time mirror`).not.toContain(
        `/bundles/${slug}/`,
      );
      /* The digest's hex, not the whole `sha256:…` string. Every segment is percent-encoded
         (`bundleHref`'s rule, consumed rather than re-taken), so the `:` renders as `%3A`
         and an assertion on the raw digest fails against a correct URL. The hex tail is
         what makes this bundle's address different from another's and it survives either
         spelling — so this cell measures the property and not the encoding, which is a
         separate decision and `blueprintFileHref`'s to make. */
      const hex = bp.digest.slice(bp.digest.indexOf(":") + 1);
      expect(hex.length, `${slug}: no hex in the digest to look for`).toBeGreaterThan(16);
      expect(html, `${slug} does not carry its own digest in the URL`).toContain(hex);
    },
  );
});
