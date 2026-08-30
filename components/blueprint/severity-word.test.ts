/* ============================================================
   Severity reaches a reader as a word, on every blueprint page.

   `components/ui/severity.ts` states the rule and why it exists:
   the glyph and the word both carry the meaning, and the colour is
   decoration. `DiagnosticList` held it from the day it was written.

   It broke anyway. PROJECT.md §3.1's length pass moved the criteria
   notes off the sidebar's `DiagnosticList` and into the panel that
   interprets them, and the two new renderers emitted an amber ▲
   marked `aria-hidden` with no word beside it. The word "warning",
   which appeared on all nine blueprint pages, then appeared on
   none: a screen-reader user got no severity at all, a reader who
   cannot resolve colour got a triangle, and the same triangle meant
   "votes" two panels below it in the same sidebar.

   The defect was invisible to every test in the suite because no
   test rendered the surface. This one does, over the nine bundles
   in `content/` rather than over a fixture, so a note the archive
   grows tomorrow is covered on the day it appears.

   `"use client"` is an instruction to the bundler about where code
   is *sent*. Every client component on an SSG site is still
   rendered to HTML at build time, and effects do not run under
   `renderToStaticMarkup`, so what comes back here is what a reader
   with no JavaScript gets.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { allBlueprints } from "@/lib/content";
import {
  CRITERIA_OUT_OF_BAND_CODE,
  CRITERIA_RELAYED_CODE,
  CRITERIA_SUSPECTED_CODE,
  CRITERIA_UNANCHORED_CODE,
} from "@/lib/criteria-state";
import { SEVERITY_META } from "@/components/ui/severity";
import { openText, plainText } from "@/components/ui/visible-text";

import { BundlePanel } from "./BundlePanel";
import { Explainability } from "./Explainability";

const BLUEPRINTS = allBlueprints();

/** The four codes `app/blueprints/[owner]/[slug]/page.tsx` routes into the panel. */
const EXPLAINED = new Set<string>([
  CRITERIA_UNANCHORED_CODE,
  CRITERIA_OUT_OF_BAND_CODE,
  CRITERIA_SUSPECTED_CODE,
  CRITERIA_RELAYED_CODE,
]);

/** Everything one blueprint page prints about its analysis, as one string of HTML. */
function pageHtml(bp: (typeof BLUEPRINTS)[number]): string {
  const nodeNames: Record<string, string> = {};
  for (const node of bp.graph.nodes) nodeNames[node.id] = node.label;

  const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");

  return (
    renderToStaticMarkup(
      createElement(Explainability, {
        autonomy: bp.analysis.autonomy,
        security: bp.analysis.security,
        phaseCoverage: bp.analysis.phaseCoverage,
        nodeNames,
        onHighlight: () => {},
      }),
    ) +
    renderToStaticMarkup(
      createElement(BundlePanel, {
        digest: bp.digest,
        scoredOntologyVersion: bp.analysis.autonomy.ontologyVersion,
        nodes: bp.graph.nodes.map((n) => ({
          nodeId: n.id,
          label: n.label,
          cardId: n.id,
          version: "1.0.0",
        })),
        pinnedCards: bp.cardRefs.length,
        diagnostics: notes.filter((d) => !EXPLAINED.has(d.code)),
        explainedNotes: notes.filter((d) => EXPLAINED.has(d.code)),
      }),
    )
  );
}

const RENDERED = new Map(BLUEPRINTS.map((bp) => [bp.slug, pageHtml(bp)]));

describe("the archive is what this test is held over", () => {
  it("has the nine bundles, and notes on all of them", () => {
    // A walk that matched nothing passes every case below.
    expect(BLUEPRINTS.length).toBe(9);
    for (const bp of BLUEPRINTS) {
      const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");
      expect(notes.length, bp.slug).toBeGreaterThan(0);
    }
  });
});

describe("severity is a word, not only a glyph", () => {
  it.each(BLUEPRINTS.map((bp) => [bp.slug, bp] as const))(
    "%s prints the severity beside the code of every note it renders",
    (slug, bp) => {
      const open = openText(RENDERED.get(slug) ?? "");
      const notes = bp.analysis.diagnostics.filter((d) => d.severity !== "error");
      expect(notes.length, `${slug} has no non-error note`).toBeGreaterThan(0);

      for (const note of notes) {
        const word = SEVERITY_META[note.severity].word;
        const at = open.indexOf(note.code);
        expect(at, `${slug} never prints ${note.code} outside a closed disclosure`)
          .toBeGreaterThan(-1);
        // The word immediately in front of the code, which is the layout `DiagnosticList`
        // has always used and the one the criteria panel now matches. A page-wide
        // "does the word appear anywhere" check passes while a single row drops it.
        expect(
          open.slice(Math.max(0, at - 60), at),
          `${slug} prints ${note.code} with no "${word}" in front of it`,
        ).toContain(word);
      }
    },
  );

  it("says the word beside the triangle the vote count also uses", () => {
    // The collision that made this more than a formality: `▲` is the seeded vote glyph
    // in the same sidebar, and the sidebar's own routed-notes line prints no code for the
    // check above to anchor on. Every bundle in the archive carries at least one warning.
    for (const bp of BLUEPRINTS) {
      expect(openText(RENDERED.get(bp.slug) ?? ""), bp.slug).toContain("warning");
    }
  });
});

describe("every hint is on its own row", () => {
  /**
   * §3.1 folded the engine's hints into an inline `<details>` and collapsed an adjacent
   * repeat to the literal "hint as on the row above." Two of the nine bundles hit that
   * branch, and on both the row it pointed at had just gone behind a closed disclosure:
   * the pointer referred to text nothing on screen was showing, and find-in-page for the
   * advice returned one hit where the baseline returned two.
   */
  it("never points at a row instead of carrying its own hint", () => {
    for (const bp of BLUEPRINTS) {
      expect(plainText(RENDERED.get(bp.slug) ?? ""), bp.slug).not.toContain(
        "as on the row above",
      );
    }
  });

  it("carries the engine's hint for every finding that has one", () => {
    for (const bp of BLUEPRINTS) {
      const html = plainText(RENDERED.get(bp.slug) ?? "");
      for (const finding of bp.analysis.security.findings) {
        if (finding.hint === undefined) continue;
        // The whole hint, not a prefix: a pointer would satisfy a prefix check.
        expect(html, `${bp.slug} · ${finding.marker} · ${finding.nodeId}`).toContain(
          plainText(finding.hint).trim(),
        );
      }
    }
  });
});
