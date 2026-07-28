/* ============================================================
   The centrepiece. Spec §3.2, and the author's most specific
   request:

     "i'd like you show in a nice way in the landing page the
      template of a node (the yaml) that gets annotated … when
      scrolling down. Eventually, when reached the end, there is a
      dezoom that place such node card within a node of a generic
      graph."

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
   document in full. An invented card would make the seventh
   annotation a claim about a file nobody can open.

   Nothing here is passed a colour, a size or a layout. Doc 2 §1.1's
   one live decision in this section is `darkFactory`, which is read
   off the engine's analysis of the starter bundle rather than
   asserted, so the classification the dezoom prints stays true if
   the archive changes under it.
   ============================================================ */

import { cardSource, getBlueprintBySlug } from "@/lib/content";
import { nodeHref } from "@/lib/href";
import { SectionHeading } from "@/components/ui/SectionHeading";

import { NodeCardStage } from "./nodecard/NodeCardStage";

const CARD_REF = "code-builder@1.0.0";
const CARD_ID = "code-builder";

/** The bundle the dezoom lands in, and the one this card is a node of. */
const SLUG = "starter-software-factory";

export function SectionNodeCard() {
  const source = cardSource(CARD_REF);
  if (source === undefined) return null;
  const bundle = getBlueprintBySlug(SLUG);

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
              as the archive stores it. Seven places on the card decide what the node is,
              which model it runs, what it may reach, what arrives and what must never
              arrive. The last of those is why whoever writes the code never reads the
              tests the work is judged against.
            </>
          }
        />

        <div className="mt-10">
          <NodeCardStage
            /* The trailing newline every file on disk ends with would otherwise render as
               a blank line 53 under a 52-line card, and would count as a line in the
               reel's arithmetic. */
            source={source.trimEnd()}
            cardRef={CARD_REF}
            cardHref={nodeHref(CARD_ID)}
            darkFactory={bundle?.autonomy.isDarkFactory ?? false}
          />
        </div>
      </div>
    </section>
  );
}
