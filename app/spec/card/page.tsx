import type { Metadata } from "next";

import { WhatACardReaches } from "@/components/explain/ConceptFigures";
import { SectionNodeCard } from "@/components/home/SectionNodeCard";
import { CheckLegend, CheckTable } from "@/components/spec/CheckTable";
import { Id, SpecLink } from "@/components/spec/parts";
import { CARD_ROWS } from "@/components/spec/rows";
import { specNeighbours } from "@/components/spec/sequence";
import { SpecCrumb, SpecPager } from "@/components/spec/SpecPager";
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
import { getNodeCard } from "@/lib/content";

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
   `content/cards/`, byte for byte, and the nine annotations are
   resolved against that text rather than typed beside it
   (`components/home/nodecard/annotations.ts`). Replacing it with a
   transcription would have cost the one property it was built for,
   and §3 says so directly: "it reads the real card through
   `cardSource` and that must survive the move."

   ── This pass: the figure stops scrolling and starts listening ──
   The author, of this page: "in /spec/card avoid the effect on
   scrolling of the card panel (keep it for the other pages). I
   prefer here the approach adopted in /spec/topology for the panel
   starter-software-factory/blueprint.dot."

   So `SectionNodeCard` mounts `CardBreakdown`, which is the node
   card under the interaction `/spec/topology`'s DOT figure already
   uses: nine real buttons in the rail, `useRovingListbox` from
   `components/panes/listbox.ts` so the whole rail is one tab stop
   with the arrow keys walking it, `aria-pressed` for the state and
   a polite live region for the consequence. A click lights the
   lines that part is about. Nothing on this page reads a scroll
   position any more.

   **"keep it for the other pages" is the load-bearing clause.**
   `CardWalk` — the scroll walk this page used to mount — still
   renders on the landing through
   `components/home/SectionNodeIsCard.tsx`, and it is still guarded
   there by the case in `nodecard.test.ts` that asserts its source
   contains no `<button` and no `onClick`. That is why this is a
   second component rather than a `mode` prop: a prop would have put
   the buttons inside the walk's file and forced the guard that
   keeps nine controls off the landing's beat to be loosened.
   `CardBreakdown`'s header argues the whole split.

   What went with the walk, on this page only: the 190vh track, the
   sticky pin at `calc(50vh - 19.25rem)`, the 24-row window and the
   reel that slid the card through it. What replaces the window is
   nothing at all — the 52-line card is drawn WHOLE at every width,
   1162px of listing the page scrolls past, which is what the phone
   layout and the reduced-motion layout already showed. The two
   traps written up in `CardWalk` are therefore not merely avoided
   here, they are unreachable: there is no height to state beside
   `overflow-x: auto` and no transform to write.

   One thing the pick changed that the swap did not have to: the
   listing no longer bands all nine runs at once. It brackets them,
   with a rule down the margin and a two-digit step number at each
   head, both unconditional and both in the prerendered HTML, and
   spends the ground on the run a reader picked. That is
   `DotBreakdown`'s rule, and it transfers because its premise does:
   the nine annotations nearly tile this card, so nine bands is a lit
   listing and a lit listing is the same as an unlit one.
   `YamlListing`'s `Grounding` carries the argument and the
   measurement. The landing still bands all nine, because a figure
   nobody can pick has nothing else to point with.

   Both columns end up about the same height by construction rather
   than by luck: 1162px of listing against nine heads and nine open
   reference bodies, which `nodecard.test.ts` caps at 300 characters
   each. The page is shorter than it was, because 190vh of pinned
   track is gone.

   ── What this page carried and no longer does ──
   The band titled "The split" is gone on the author's instruction.
   It held the enforcement argument: a lead, `EnforcementFigure`,
   two panels, and the resolver's own refusal quoted off the build.
   Two sentences in it are pinned by `components/site/honesty.test.
   ts`, which is the repository's first non-negotiable, so they were
   REHOMED rather than dropped and both are still in the open:

     · "both are legitimate, and a reader has to be able to tell
       which is which without running anything" is now the last
       sentence of the `cannot` entry below, which is the field it
       was always about. It is half of this page's thesis — panel B
       asserted that the free-text entry is legitimate, and without
       this the symmetry has one side and an entry nothing checks
       reads as an entry that failed.

     · "error bundle/prohibition-violated", the severity in word
       form beside the code, is the quoted diagnostic under the
       field list. It is read off the engine's own `Diagnostic`
       rather than typed, exactly as before.

   `EnforcementFigure` loses its only page mount in this change.
   `components/viz/scene-labels.test.ts` renders it directly, so
   nothing fails; that is a figure the suite protects and no page
   shows, and it wants a deliberate decision from whoever owns
   `components/spec/`.

   ── The reference is open, and it names the subfields ──
   The field table used to sit behind `components/ui/More.tsx`. The
   author: "It has to stay opened not collapsable. Here it is
   important to describe the role of each subfield." So the
   `<details>` is gone, and the list under the table is the part
   §4.3's disclosure had been hiding the need for: `CARD_ROWS` is a
   table of top-level wire keys, and several of those keys hold
   structure the table has no column for — a port's four keys, the
   two list fields that look alike and are not, the two kinds of
   entry `cannot` accepts. No count is written into either the
   docblock or the prose: the one that was there ("fifteen rows")
   was already wrong about a table this page does not own. Every
   claim in that list is
   `lib/core/card/schema.ts` or `lib/core/card/validate.ts`, and
   each one says what the subfield DOES rather than restating its
   name.

   Also removed, on instruction: "Read this card on its own page
   for the resolved version and the file as it is stored, or browse
   the library of 53 cards written against this schema."
   `honesty.test.ts` does not pin it (checked, both directions:
   nothing in `CLAIMS` carries either clause), and `/nodes` is two
   clicks away in the header. Nothing else on the page linked
   `/nodes/code-builder`, so the archive is now reached from the nav
   rather than from here.

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

/**
 * The canonical h2, spelled the way `components/ui/SectionHeading.tsx` spells it.
 *
 * Every band below opens with a `.label-lead` and one of these. The sub-sections used to
 * draw at `text-2xl` (24px), which is neither of the two display steps the site has, and
 * carried no mono cue at all — so on a page whose `h1` and whose figure each spend a cyan
 * `.eyebrow`, the two sections after them were typographically indistinguishable.
 * `.label-lead` is the answer rather than a third eyebrow: the eyebrow names a page or a
 * full-bleed band, and this page has spent both.
 */
const BAND_H2 =
  "font-display text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-fg sm:text-[32px]";

/**
 * The nested keys, and the entries of the list fields, that `CARD_ROWS` has no column for.
 *
 * The table answers "what holds it" per top-level wire key, which is the right shape for
 * a reference and the wrong shape for six of them: `inputs · outputs` is one
 * row over a structure with four keys in it, `tools · risk_markers` is one row over two
 * lists that answer different questions, and `cannot` is one row over a list whose entries
 * are read two different ways depending on what they say.
 *
 * Every sentence here is `lib/core/card/schema.ts` or `lib/core/card/validate.ts` read
 * back, and the point of each entry is the ROLE — what the subfield decides, and what
 * goes wrong when it is absent or wrong. A list that said "`type`: the port's type" would
 * be the table again at greater length.
 *
 * `cannot` is last on purpose: the quoted refusal under this list is the engine's answer
 * to its first kind of entry, and the two read as one argument in that order.
 */
const SUBFIELDS: readonly { key: string; role: React.ReactNode }[] = [
  {
    key: "inputs[].name · outputs[].name",
    role: (
      <>
        The end of an edge rather than a label. A DOT edge writes{" "}
        <Id>{'[out="build", in="brief"]'}</Id> to say which pair of ports it joins, so a
        port name is an address the topology layer spells out loud. Unique within a side:
        two inputs both called <Id>brief</Id> leave the resolver no way to decide which one
        an edge meant, and it raises <Id>card/duplicate-port</Id> rather than picking one.
      </>
    ),
  },
  {
    key: "inputs[].type · outputs[].type",
    role: (
      <>
        The only subfield the resolver pairs on. It names a <Id>data-type</Id>{" "}
        term from the ontology, and an edge holds when the source&rsquo;s output type is
        the target&rsquo;s input type or a narrower kind of it. Everything a card says about
        what actually travels is carried by this one word; the rest of the port is written
        for a person.
      </>
    ),
  },
  {
    key: "inputs[].description · outputs[].description",
    role: (
      <>
        Free text for whoever wires the graph, read by nothing. It is where a port says the
        part its type cannot: that <Id>brief</Id> is the ordered build steps the run was
        instantiated with, and the only thing this node ever sees.
      </>
    ),
  },
  {
    key: "inputs[].required",
    role: (
      <>
        Inputs only, and true unless the card says otherwise. On an output it describes
        nothing, because an output is not something a node needs, and the validator reports{" "}
        <Id>card/bad-type</Id> against the exact path rather than dropping the key in
        silence. A flag that is quietly ignored reads as a flag that works.
      </>
    ),
  },
  {
    key: "phase[]",
    role: (
      <>
        Any number of the five lifecycle phases, and the wire key takes a single term or a
        sequence because both spellings read naturally in YAML. An empty list is a complete
        answer and never a hole: the five phases describe the factory, not every node in
        it, and an intake, a retrieval step or a memory store stands in none of them.
        Nothing that renders a card may draw the empty case as missing data.
      </>
    ),
  },
  {
    key: "tools[] · mcp[]",
    role: (
      <>
        Two lists that look alike and answer different questions. A <Id>tools</Id> entry is
        a capability term from the vocabulary, so it either resolves or raises{" "}
        <Id>card/unknown-term</Id>. An <Id>mcp</Id> entry is the name a concrete server is
        registered under on the machine that runs the graph, which the vocabulary has no
        term for and is not going to grow one. <Id>tools</Id> says what the node is
        permitted to do and <Id>mcp</Id> says which process supplies it; a node can carry
        either without the other, and merging them would lose the question each one
        answers.
      </>
    ),
  },
  {
    key: "risk_markers[]",
    role: (
      <>
        Each entry names a <Id>risk-marker</Id> term, and what the marker costs is set by
        the vocabulary rather than by the card. A locally coined marker with no{" "}
        <Id>defaultWeight</Id> counts zero, so a card can declare a risk the scoring never
        sees, which is the one outcome worth knowing about before you write one.
      </>
    ),
  },
  {
    key: "params.*",
    role: (
      <>
        Free in shape, and required to survive a JSON round-trip because the card is hashed
        as JSON into its digest. A value that cannot be serialised cannot be hashed, and a
        card that cannot be hashed cannot be pinned by a blueprint, so{" "}
        <Id>card/bad-type</Id> is raised where the value is written rather than at the
        point two digests disagree.
      </>
    ),
  },
  {
    key: "cannot[]",
    role: (
      <>
        Two kinds of entry in one list. An entry naming a <Id>data-type</Id> term is a
        prohibition the resolver enforces: an incoming edge able to carry that type, or a
        narrower kind of it, fails the bundle. An entry naming no term is read as free text
        and checked by nothing, which is what the second line under <Id>cannot</Id> on the
        card above is. Both are legitimate, and a reader has to be able to tell which is
        which without running anything.
      </>
    ),
  },
];

export default function SpecCardPage() {
  const { page } = specNeighbours(HERE);

  // The engine's own sentence about the prohibition the card above declares. Quoted
  // rather than paraphrased, and guarded rather than indexed blindly: a page arguing that
  // a declaration is enforced should drop the quotation rather than invent one if the
  // demonstration ever stops being derivable.
  /* The same card `SectionNodeCard` annotates, parsed, for the reach panel above it. */
  const reachCard = getNodeCard("code-builder")?.card;

  const demo = isolationDemo();
  const refusal =
    demo === undefined
      ? undefined
      : errorsOf(demo.leaked).find(
          (d) => d.code === "bundle/prohibition-violated",
        );

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page flex flex-col gap-5">
          <SpecCrumb href={HERE} />
          <SectionHeading
            as="h1"
            eyebrow={page.eyebrow}
            title={page.title}
            lead="The validator reads JSON on the same schema as the YAML. A published version is never edited in place, so a change means a new file and a new version number."
          />
        </div>
      </header>

      {/* ---------- what one card reaches, moved here 2026-08-08 ----------
          The author asked this panel off `/what-a-blueprint-is` and onto this page, "just
          below" the lead above.

          It belongs here and it was the odd one out there. `/what-a-blueprint-is` answers
          what a blueprint IS in three parts and a run; this figure is six named fields with
          two paragraphs of fine print each, which is reference material about one file
          format. This page is that file format, and the reader who arrives here has already
          decided to study a card rather than to find out what one is.

          Above `SectionNodeCard` rather than below it, because the annotated listing walks
          nine parts of a real document and this names the six fields that decide a node's
          reach. Fields, then the file.

          Every value is read off `code-builder@1.0.0`, the card the rest of the site opens
          with. A page explaining what `mcp` and `cannot` are, illustrated with invented
          values, would be teaching a schema nobody ships. */}
      {reachCard !== undefined && (
        <section id="card-reach" className="scroll-mt-24 border-b border-line bg-void py-12 sm:py-16">
          <div className="container-page">
            <WhatACardReaches
              model={reachCard.model ?? "inherits"}
              tools={reachCard.tools.length > 0 ? reachCard.tools.join(", ") : "none"}
              mcp={reachCard.mcp.length > 0 ? reachCard.mcp.join(", ") : "none"}
              skill={reachCard.skill ?? "none"}
              cannot={
                reachCard.cannot.length > 0 ? (reachCard.cannot[0] ?? "") : "nothing declared"
              }
              riskMarkers={
                reachCard.riskMarkers.length > 0
                  ? reachCard.riskMarkers.join(", ")
                  : "none declared"
              }
            />
          </div>
        </section>
      )}

      {/* The figure this page opens with: the card the whole page is about, annotated
          line by line, read straight out of `content/cards/`, and broken into nine parts
          a reader picks rather than scrolls through. */}
      <SectionNodeCard />

      {/* ---------- the reference, in the open ----------
          A band, not a row in a flex stack. The seam is a `border-t` and a ground
          change, the same device `/towards-a-dark-factory` marks its bands with, and it
          is now the only seam on the page: the band that used to sit between this and
          the figure is gone, so the figure's `bg-void` runs straight into this one's and
          the rule is what divides them. The pager below is `bg-surface/40`, which is the
          ground change that closes the page. */}
      <section
        className="border-t border-line bg-void py-16 sm:py-20"
        aria-labelledby="fields-heading"
      >
        <div className="container-page flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="label-lead">The reference</span>
            <h2 id="fields-heading" className={`${BAND_H2} scroll-mt-24`}>
              Every field, and what holds it
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Uncapped this ran 187 characters a line, the widest prose on the page. */}
            {/* No count in the sentence. The docblock this page shipped with said
                "fifteen rows" over a `CARD_ROWS` that has sixteen, because `provenance`
                was added and the prose was not: a number typed beside a list somebody
                else owns goes stale silently, and there is nothing here worth spending a
                render on `CARD_ROWS.length` for. */}
            <p className="prose-lane text-sm text-muted">
              One row per wire key, and the third column is the point: a diagnostic code is
              greppable, it is what the build and{" "}
              <SpecLink href="/upload">the upload check</SpecLink> print, and it is the
              difference between a promise and a rule you can go and trip on purpose.
            </p>
            <CheckLegend />
            <CheckTable
              rows={CARD_ROWS}
              caption="What the engine checks on a node card, and what it leaves to the author"
            />
          </div>

          <div className="flex flex-col gap-5">
            <h3 className="label-lead">Inside the fields that hold structure</h3>
            <p className="prose-lane text-sm text-muted">
              Several rows above stand over more than one thing. What each nested key
              decides, and what it costs to leave it out or to get it wrong.
            </p>
            {/* Two columns at `md`, because these are short definitions and one column of
                nine at the reading measure is a screen of scrolling for a list a reader
                scans rather than reads. 40px across and 20px down, both canonical tiers.

                The term is spelled exactly as `CheckTable` spells its row heads —
                `font-mono text-[12px] text-fg` — so the list reads as the table continued
                rather than as a second, differently-typed reference. Deliberately NOT
                copper: the register belongs to the figure above, where it marks the runs
                of one real file, and spending it on a list of key names would say these
                nine are lines of that card. */}
            <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
              {SUBFIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <dt className="font-mono text-[12px] text-fg">{field.key}</dt>
                  <dd className="text-sm leading-relaxed text-muted">{field.role}</dd>
                </div>
              ))}
            </dl>
          </div>

          {refusal !== undefined && (
            <div className="flex flex-col gap-3">
              {/* No `prose-lane`, on the author's instruction (2026-08-08). The 36rem
                  measure is right for a run of body prose a reader settles into; this is a
                  one-sentence caption for the panel directly under it, and the panel is
                  full width. Held to 36rem it broke over three lines and ended a third of
                  the way across, with an `<Id>` chip carrying a DOT statement wrapping
                  inside it — a caption narrower than the thing it captions reads as a
                  different column rather than as a label. */}
              <p className="text-[15px] leading-relaxed text-muted">
                The sentence below comes back from the resolver during the build rather
                than from this page, run over the starter bundle with{" "}
                <Id>{ADDED_DOT_LINE}</Id> inserted.
              </p>
              <div className="rounded-lg border border-line bg-surface-2 p-4">
                {/* The severity in word form, beside the code, from the same table the
                    validator's own lists use. An earlier length pass deleted the sentence
                    that carried "at error severity" and left the word only on a figure's
                    `<svg>` plate; that figure is now off the page too, so this is the one
                    place on `/spec/card` where the severity is a word a reader can find.
                    Read off the diagnostic rather than typed, so it cannot drift from what
                    the engine actually returned. `honesty.test.ts` pins the pair. */}
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
              {/* `.prose-lane`: uncapped, this sat at 182 characters a line. */}
              <p className="prose-lane text-sm text-dim">
                <SpecLink href="/spec/topology">The topology layer</SpecLink> draws the
                same prohibition as an edge the starter graph does not have, beside the
                card that declares it.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* The rail closes the page on the opposite ground, and with no `border-t` of its
          own: `SpecPager` draws one at container width, and a full-bleed rule 64px above
          an inset rule is two lines saying one thing. The ground change is the seam. */}
      <section className="bg-surface/40 py-16 sm:py-20">
        <div className="container-page">
          <SpecPager href={HERE} />
        </div>
      </section>
    </>
  );
}
