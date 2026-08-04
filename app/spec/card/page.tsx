import type { Metadata } from "next";

import { getRegistry } from "@/lib/content";
import { SectionNodeCard } from "@/components/home/SectionNodeCard";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { EnforcementFigure } from "@/components/spec/EnforcementFigure";
import { Id, SpecLink } from "@/components/spec/parts";
import { CARD_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { More } from "@/components/ui/More";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SEVERITY_META } from "@/components/ui/severity";
// Read-only import of the build-time derivation in `components/explain/starter-isolation`.
// That module runs the analyzer over the starter bundle with one edge added and hands back
// what the engine said; re-deriving it here would give the site two answers to one
// question, and the answer this page needs is the exact `bundle/prohibition-violated`
// sentence. It was written for `/what-it-isnt`, which drew both graphs; that page is gone
// and this page and `components/panes/absences.ts` are what keep the module alive.
import {
  errorsOf,
  isolationDemo,
  ADDED_DOT_LINE,
} from "@/components/explain/starter-isolation";

/* ============================================================
   /spec/card — layer 2 of the spec language.

   Redesign spec §4.1, on the author's reading of the single page:
   "the spec language is ok, but you should reorganize the content
   otherwise it is a very long single page that makes the user
   leave." §4.1 asks each layer page to open with its figure, and
   §3 says which figure this one gets: the annotated node card that
   was the landing's centrepiece, moved to the page whose subject
   it is.

   ── The centrepiece is imported, and it still reads the archive ──
   `SectionNodeCard` calls `cardSource("code-builder@1.0.0")` and
   hands the bytes to the scene, which tokenises them in the
   browser. So the listing a reader scrolls through is the file in
   `content/cards/`, byte for byte, and the seven annotations are
   resolved against that text rather than typed beside it
   (`components/home/nodecard/annotations.ts`). Replacing it with a
   transcription would have cost the one property it was built for,
   and §3 says so directly: "it reads the real card through
   `cardSource` and that must survive the move." It is owned by the
   landing this pass, so it is imported by path and not edited.

   ── The length pass (PROJECT.md §3.1) ──
   The page was the longest of the four at 2,054 prose words, and
   the seven annotations turned out to be arguing with the prose
   around them. What went, and where each claim it carried now
   lives:

     · the h1 lead's list of what a card says. `SectionNodeCard`'s
       own lead, one screen below it, makes the same list from the
       same card. Only the two claims that list did not carry are
       left: the JSON spelling, and that a published version is
       never edited in place.

     · the whole "Half of it resolves, half of it is for a reader"
       section. Fig. 1 on `/spec` already draws that split and its
       caption names both markers, and the table below carries it
       per field in the third column. The field lists inside it
       (`type`, `phase`, `tools`, `risk_markers`, port types on one
       side; `model`, `mcp`, `skill`, `spec`, `notes` on the other)
       are each a row of that table, so the enumeration was the
       table read aloud. Its middle paragraph pointed forward at a
       section two screens down and stated nothing.

     · the enforcement section's own lead, which said the same
       thing a third time before the figure that draws it.

     · the two panels' opening sentences, which restated annotation
       07 and Fig. 2's caption. Both panels keep exactly what
       neither of those says: that a *narrower* type violates the
       prohibition too, and that the validator's silence on a
       free-text entry is deliberate.

   Nothing was moved off the page except into the annotations and
   figures already making the point. The field table is reference
   depth rather than repetition, so it went behind `More` instead:
   still prerendered, still keyboard reachable, still found by
   find-in-page (§4.3's device, and the reason it is allowed).

   ── Why the enforcement argument lives here ──
   It is an argument about one field. `cannot` is a card field, the
   two entries it carries are on the card above, and the table has
   a row for it. On the old single page it sat four screens below
   the card and read as a separate subject.

   ── What was cut earlier (spec §5) ──
   The `SourcePanel` that used to sit beside this layer's prose
   showed `cards/code-builder@1.0.0.yaml` in full, which is the
   same document the section above now scrolls through line by line
   from the same `cardSource` call. The download and the raw text
   are one link away on `/nodes/code-builder`, which the prose
   still points at, and that page reads the same bytes.

   ── No route config ──
   A static segment, so there is no `generateStaticParams` and no
   `dynamicParams` to close (Next 16,
   `docs/01-app/03-api-reference/03-file-conventions/page.md`). The
   page is a server component and takes no props.
   ============================================================ */

export const metadata: Metadata = {
  title: "The node card, in YAML",
  description:
    "Layer 2 of a DarkPrint blueprint: one YAML card per node, saying what it is, what instructs it, what arrives, what leaves and what must never arrive. With the field-by-field list of what the engine checks.",
};

const HERE = "/spec/card";

export default function SpecCardPage() {
  const { page } = specNeighbours(HERE);
  const registry = getRegistry();

  // The engine's own sentence about the edge Fig. 2 draws. Quoted rather than
  // paraphrased, and guarded rather than indexed blindly: a page arguing that a
  // declaration is enforced should drop the quotation rather than invent one if the
  // demonstration ever stops being derivable.
  const demo = isolationDemo();
  const refusal =
    demo === undefined
      ? undefined
      : errorsOf(demo.leaked).find(
          (d) => d.code === "bundle/prohibition-violated",
        );

  return (
    <>
      <header className="border-b border-line bg-void py-12 sm:py-16">
        <div className="container-page flex flex-col gap-6">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="The validator reads JSON on the same schema as the YAML. A published version is never edited in place, so a change means a new file and a new version number."
          />
        </div>
      </header>

      {/* The figure this page opens with: the card the whole page is about, annotated
          line by line and read straight out of `content/cards/`. */}
      <SectionNodeCard />

      <div className="container-page flex flex-col gap-14 py-14">
        {/* ---------- the split one field carries ---------- */}
        <section
          className="flex flex-col gap-6"
          aria-labelledby="enforced-heading"
        >
          <h2
            id="enforced-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            Checked against the graph, or shown to a reader
          </h2>

          {/* PROJECT.md §3.1's length pass deleted the lead this section opened on, on
              the grounds that the heading and Fig. 2's caption between them say it. They
              say the split and they say how to tell the two apart by reading. Neither
              says the other half, which is the page's thesis: an entry nothing checks is
              not a defect. Panel B below asserts it of the free-text entry alone, so the
              symmetry had one side. Seventeen words. */}
          <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
            Both are legitimate, and a reader has to be able to tell which is which
            without running anything.
          </p>

          <EnforcementFigure />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald">
                Held against the graph
              </span>
              {/* The severity and the code are on the plate above (`error · the bundle
                  does not resolve`) and in the quoted diagnostic below, so this says the
                  part neither of them does: what the resolver compares, and that a
                  narrower type is caught as well. */}
              <p className="text-sm leading-relaxed text-muted">
                Every edge into this node is held against it, and so is every
                output the source declares. A type narrower than the one named
                violates it just the same.
              </p>
            </div>
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                <span aria-hidden>◌ </span>Shown, and checked by nothing
              </span>
              <p className="text-sm leading-relaxed text-muted">
                An entry naming no term is legitimate and it addresses a reader.
                The validator stays quiet on it by design, because reporting an
                unknown term here would fire on the entry the field was named
                for.
              </p>
            </div>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
                The sentence below comes back from the resolver during the
                build rather than from this page, run over the starter bundle
                with <Id>{ADDED_DOT_LINE}</Id> inserted.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                {/* The severity in word form, beside the code, from the same table the
                    validator's own lists use. §3.1's pass deleted the sentence that
                    carried "at error severity" and left the word only on Fig. 2's plate,
                    which is inside an `<svg>`; "error" as a severity was then on no page
                    of the site outside the field table below, which is itself folded.
                    Read off the diagnostic rather than typed, so it cannot drift from
                    what the engine actually returned. */}
                <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span style={{ color: SEVERITY_META[refusal.severity].color }}>
                    {SEVERITY_META[refusal.severity].word}
                  </span>
                  <span className="text-signal">{refusal.code}</span>
                </p>
                <p className="mt-2 font-mono text-[12px] leading-relaxed text-fg">
                  {refusal.message}
                </p>
                {refusal.hint !== undefined && (
                  <p className="mt-2 font-mono text-[11px] leading-relaxed text-dim">
                    {refusal.hint}
                  </p>
                )}
              </div>
              {/* Pointed at the topology layer when `/what-it-isnt` was removed. The
                  sentence had to change with the href, not just follow it: the old target
                  drew the clean and leaked graphs side by side and quoted the analyzer on
                  both, and nothing on the site does that now. What survives is the
                  prohibition drawn as an edge the starter graph does not have. */}
              <p className="text-sm text-dim">
                <SpecLink href="/spec/topology">The topology layer</SpecLink>{" "}
                draws the same prohibition as an edge the starter graph does not
                have, beside the card that declares it.
              </p>
            </div>
          )}
        </section>

        {/* ---------- the reference, folded away ----------
            §4.3's disclosure rather than a cut: fifteen rows naming the diagnostic
            behind each field is the one place several of these codes appear on the
            site, and a code is what makes the page's claims greppable. Behind a
            `<details>` it stays in the prerendered HTML and stays searchable, so a
            reader who wants the schema loses nothing and a reader who wanted the
            argument is not reading a table to reach the pager. */}
        <section
          className="flex flex-col gap-4 border-t border-line pt-8"
          aria-labelledby="fields-heading"
        >
          <h2
            id="fields-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            Every field, and what holds it
          </h2>
          <p className="text-sm text-muted">
            <SpecLink href="/nodes/code-builder">
              Read this card on its own page
            </SpecLink>{" "}
            for the resolved version and the file as it is stored, or{" "}
            <SpecLink href="/nodes">browse the library</SpecLink> of{" "}
            {registry.latestCards().length} cards written against this schema.
          </p>
          <More summary="Field by field, with the code behind each">
            <CheckLegend />
            <CheckTable
              rows={CARD_ROWS}
              caption="What the engine checks on a node card, and what it leaves to the author"
            />
          </More>
        </section>

        <SpecPager href={HERE} />
      </div>
    </>
  );
}
