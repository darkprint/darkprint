/* ============================================================
   The centrepiece. Spec §3.2, and the author's most specific
   request:

     "i'd like you show in a nice way in the landing page the
      template of a node (the yaml) that gets annotated … when
      scrolling down."

   This file is the server half, and it is short on purpose. It
   reads one card off the archive and hands the bytes to the client
   scene, which does the tokenising and the choreography. The
   division matters for the reason spec §1 gives: `lib/content` is
   server-only, so the card has to be read here, and the YAML has to
   be *text* here, so the listing that ends up in
   `.next/server/app/index.html` is the finished one.

   `code-builder@1.0.0` rather than a written-for-the-page example,
   because the spec asks for a card the site can be held to: it is
   the one carrying `cannot: [acceptance-criteria]`, the resolver
   enforces that entry, and `/nodes/code-builder` shows the same
   document in full. An invented card would make the ninth
   annotation a claim about a file nobody can open.

   ── Two figures this used to mount, and why it mounts a third ──
   The same request ended "eventually, when reached the end, there
   is a dezoom that place such node card within a node of a generic
   graph", and `NodeCardStage` was that: a copper graticule plate,
   a drawn leader line from each run to its note, per-head buttons,
   a `calc(100vh + 2500px)` track and the dezoom at the end. The
   author asked for the opposite of it, of this page specifically:
   "make /spec/card's scrollable node panel the same as the home's",
   and "it should scroll in the middle of the screen". So the stage
   went and `CardWalk`, the landing's walk, took its place —
   `components/viz/scene-labels.test.ts` records the dezoom leaving
   the site, since this page was its only mount.

   Then the author, of the walk on this page: "in /spec/card avoid
   the effect on scrolling of the card panel (keep it for the other
   pages). I prefer here the approach adopted in /spec/topology for
   the panel starter-software-factory/blueprint.dot."

   So this file mounts `CardBreakdown`, which is the node card under
   `components/panes/DotBreakdown.tsx`'s interaction: nine buttons in
   a rail, a click lights the lines that part is about, and no scroll
   position is read anywhere. THE PARENTHESIS IS PART OF THE
   INSTRUCTION — the landing keeps the walk, through
   `components/home/SectionNodeIsCard.tsx`, and `CardWalk` is
   deliberately still alive for it. `CardBreakdown`'s own header
   argues the split rather than leaving it to be rediscovered.

   What has not changed through any of it is the property spec §3
   said the move to this page may not cost: it still reads the real
   card through `cardSource`, and
   `components/spec/spec-routes.test.ts` holds this file to that call
   by name.

   ── The `bodies={{}}` that went with the walk ──
   The walk takes a per-step wording override and this page passed an
   empty one, so every note fell through to `annotations.ts`'s
   45-word reference bodies — the ones carrying
   `bundle/prohibition-violated`, `bundle/port-mismatch` and
   `llm_model`. `CardBreakdown` has no override to pass: it reads
   `note.body` and there is no second mount of it to want anything
   else. The three diagnostic codes are on the page whose subject
   they are, by construction rather than by an empty record.
   ============================================================ */

import { cardSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { CardBreakdown } from "./nodecard/CardBreakdown";

const CARD_REF = "code-builder@1.0.0";

export function SectionNodeCard() {
  const source = cardSource(CARD_REF);
  if (source === undefined) return null;

  return (
    <section id="node-card" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="One node, line by line"
          title="A node is a card, and the card is checkable"
          lead={
            <>
              This is{" "}
              <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[13px] text-fg">
                {CARD_REF}
              </code>{" "}
              as the archive stores it. Nine places on the card decide what the node is,
              what it does, the brief it is handed, which model it runs, what it may
              reach, what arrives and what must never arrive. The last of those is why
              whoever writes the code never reads the tests the work is judged against.
              {/* The affordance, said once in prose. The rail's hover hint and focus ring
                  are the visual affordance, and neither is available to a reader who has
                  not yet moved a pointer over the figure — which on this page is most of
                  them, because the card is the first thing under the heading. One clause,
                  and it describes what the figure does rather than instructing anybody:
                  every part is already open and marked before a single click. */}{" "}
              Pick one on the right and the lines it is about light up on the left.
            </>
          }
        />

        <div className="mt-10">
          <CardBreakdown
            /* The trailing newline every file on disk ends with would otherwise render as
               a blank line 53 under a 52-line card, and would be counted and printed in
               the figcaption's line total. */
            source={source.trimEnd()}
            cardRef={CARD_REF}
          />
        </div>
      </div>
    </section>
  );
}
