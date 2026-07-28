import type { Metadata } from "next";

import { getRegistry } from "@/lib/content";
import { SectionNodeCard } from "@/components/home/SectionNodeCard";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { EnforcementFigure } from "@/components/spec/EnforcementFigure";
import { Id, LABEL, SpecLink } from "@/components/spec/parts";
import { CARD_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
import { SectionHeading } from "@/components/ui/SectionHeading";
// Read-only import of `/what-it-isnt`'s build-time derivation. That module runs the
// analyzer over the starter bundle with one edge added and hands back what the engine
// said; re-deriving it here would give the site two answers to one question, and the
// answer this page needs is the exact `bundle/prohibition-violated` sentence. This page
// quotes one diagnostic and links across for the full demonstration.
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

   ── What was cut (spec §5) ──
   The `SourcePanel` that used to sit beside this layer's prose
   showed `cards/code-builder@1.0.0.yaml` in full, which is the
   same document the section above now scrolls through line by line
   from the same `cardSource` call. Two listings of one file on one
   page is the case §5 names. The download and the raw text are one
   link away on `/nodes/code-builder`, which the prose already
   points at, and that page reads the same bytes.

   ── Why the enforcement argument lives here ──
   It is an argument about one field. `cannot` is a card field, the
   two entries it carries are on the card above, and the table
   between them has a row for it. On the old single page it sat
   four screens below the card and read as a separate subject.

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

/** The card this page works on. It carries both kinds of `cannot` entry. */
const CARD_REF = "code-builder@1.0.0";

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
            lead="One node, fully described: what it is, what instructs it, what it may use, what arrives, what leaves, and what must never arrive. A published version is never edited in place, so a change means a new file and a new version number."
          />
        </div>
      </header>

      {/* The figure this page opens with: the card the whole page is about, annotated
          line by line and read straight out of `content/cards/`. */}
      <SectionNodeCard />

      <div className="container-page flex flex-col gap-14 py-14">
        <section
          className="flex max-w-3xl flex-col gap-4 text-[15px] leading-relaxed text-muted"
          aria-labelledby="fields-heading"
        >
          <h2
            id="fields-heading"
            className="font-display text-2xl font-semibold tracking-tight text-fg"
          >
            Half of it resolves, half of it is for a reader
          </h2>
          <p>
            YAML is the spelling the archive uses and the validator reads JSON on
            the same schema. Roughly half the fields are references into the
            vocabulary: <Id>type</Id>, <Id>phase</Id>, <Id>tools</Id>,{" "}
            <Id>risk_markers</Id> and every port type resolve against the
            ontology or the card does not load. <Id>model</Id>, <Id>mcp</Id>,{" "}
            <Id>skill</Id>, <Id>spec</Id> and <Id>notes</Id> are text, and the
            table below says which is which for every field there is.
          </p>
          <p>
            <Id>{CARD_REF}</Id> is the reference case for the field that does
            both. Its <Id>cannot</Id> list holds one entry naming a data type and
            one written as a sentence, and the last section on this page follows
            what happens to each.
          </p>
          <p className="text-sm">
            <SpecLink href="/nodes/code-builder">
              Read this card on its own page
            </SpecLink>{" "}
            for the resolved version and the file as it is stored, or{" "}
            <SpecLink href="/nodes">browse the library</SpecLink> of{" "}
            {registry.latestCards().length} cards written against this schema.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <CheckLegend />
          <CheckTable
            rows={CARD_ROWS}
            caption="What the engine checks on a node card, and what it leaves to the author"
          />
        </section>

        {/* ---------- the split one field carries ---------- */}
        <section
          className="flex flex-col gap-6 border-t border-line pt-8"
          aria-labelledby="enforced-heading"
        >
          <div className="flex flex-col gap-3">
            <span className={LABEL}>The distinction that matters</span>
            <h2
              id="enforced-heading"
              className="font-display text-2xl font-semibold tracking-tight text-fg"
            >
              Checked against the graph, or shown to a reader
            </h2>
            <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
              Some of what a card declares is held against the topology by an
              analyzer and the rest is text. Both are legitimate, and a reader
              has to be able to tell which is which without running anything.
              One field carries the whole distinction.
            </p>
          </div>

          <EnforcementFigure />

          <div className="grid gap-5 md:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald">
                Held against the graph
              </span>
              <p className="text-sm leading-relaxed text-muted">
                <Id>cannot: [acceptance-criteria]</Id> names a data type in the
                ontology, and a data type is what an edge carries. So the
                resolver has something to check it against: every edge into this
                node, and every output the source declares. An edge able to carry
                the type, meaning the type itself or anything narrower, raises{" "}
                <Id>bundle/prohibition-violated</Id> at error severity and the
                bundle stops resolving.
              </p>
            </div>
            <div className="panel flex flex-col gap-3 p-5">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
                <span aria-hidden>◌ </span>Shown, and checked by nothing
              </span>
              <p className="text-sm leading-relaxed text-muted">
                <Id>cannot: [read the checks the work will be run against]</Id>{" "}
                names no term, so there is no topology to hold it against. It is
                published, it appears on the card, and the engine has no way to
                decide it. Writing one is legitimate and it addresses a reader.
                The validator stays quiet on it by design, because reporting an
                unknown term here would fire on the entry the field was named
                for.
              </p>
            </div>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              <p className="max-w-3xl text-[15px] leading-relaxed text-muted">
                Adding one line to the starter&apos;s DOT is enough to trip it.
                The sentence below is not written into this page: it comes back
                from the resolver during the build, run over the starter bundle
                with <Id>{ADDED_DOT_LINE}</Id> inserted.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
                  {refusal.code}
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
              <p className="text-sm text-dim">
                <SpecLink href="/what-it-isnt">The full demonstration</SpecLink>{" "}
                puts the two graphs side by side and shows what the security
                analyzer says about the same edge.
              </p>
            </div>
          )}
        </section>

        <SpecPager href={HERE} />
      </div>
    </>
  );
}
