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

   ── The stage this used to mount, and why it does not ──
   The same request ended "eventually, when reached the end, there
   is a dezoom that place such node card within a node of a generic
   graph", and `NodeCardStage` was that: a copper graticule plate,
   a drawn leader line from each run to its note, per-head buttons,
   a `calc(100vh + 2500px)` track and the dezoom at the end. The
   author has since asked for the opposite, of this page
   specifically: "make /spec/card's scrollable node panel the same
   as the home's", and "it should scroll in the middle of the
   screen".

   `CardWalk` is the home's. Mounting it here is a net deletion of
   the three things the stage was built for, so the deletion is
   recorded rather than implied — `CardWalk`'s own header lists
   what went and `components/viz/scene-labels.test.ts` records the
   dezoom leaving the site, since this page was its only mount.

   What did NOT change is the property spec §3 said the move to this
   page may not cost: it still reads the real card through
   `cardSource`, and `components/spec/spec-routes.test.ts` holds
   this file to that call by name.

   ── The one prop that differs from the landing's mount ──
   `bodies={{}}`. An empty override rather than an omitted one: the
   landing gets `CardWalk`'s 25-word wording, and this page gets
   `annotations.ts`'s 45-word reference bodies, which are the ones
   carrying `bundle/prohibition-violated`, `bundle/port-mismatch`
   and `llm_model`. Dropping to the short wording here would take
   three diagnostic codes off the page whose subject they are.
   ============================================================ */

import { cardSource } from "@/lib/content";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { CardWalk } from "./nodecard/CardWalk";

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
            </>
          }
        />

        <div className="mt-10">
          <CardWalk
            /* The trailing newline every file on disk ends with would otherwise render as
               a blank line 53 under a 52-line card, and would count as a line in the
               reel's arithmetic. */
            source={source.trimEnd()}
            cardRef={CARD_REF}
            bodies={{}}
          />
        </div>
      </div>
    </section>
  );
}
