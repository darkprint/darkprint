import type { Metadata } from "next";
import Link from "next/link";

import { getNodeCard } from "@/lib/content";
import {
  EvalHarnessBlueprint,
  WhatACardReaches,
} from "@/components/explain/ConceptFigures";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { OnwardRoutes } from "@/components/ui/OnwardRoutes";

/* ============================================================
   /concepts — eval, harness, rubric, tool, MCP, skill, and the
   one the site does not model.

   The author asked for a page explaining these, built around a
   node card zooming out to a graph, and added: "Correct anything
   I'm wrong."

   ── The corrections, and the two that came back out ──
   Three were written and one is left in the copy:
   **observability is not modelled here at all**, no field on a
   card, no term in the vocabulary, nothing in `lib/core`. It is a
   real practice and this vocabulary has no opinion on it, which is
   worth saying rather than drawing a box for.

   The other two are gone on the author's word, and the reason is
   the same for both: "You are still enforcing the fact about what
   runs and what not on the website. I said to stop to do that."

   1. "Connected nodes are a blueprint, not a harness ... DarkPrint
      publishes the blueprint and analyses it standing still." The
      first half is now drawn instead of asserted, in
      `EvalHarnessBlueprint`. The second half was the enforcement.
   2. "Nothing on this site evaluates a run ... there is no runner
      here."

   What stays elsewhere on the site, and why it is not the same
   thing: a `◐ seeded` marker and a `ComingSoonBadge` sentence
   qualify a specific figure or control a reader is looking at, and
   `components/site/honesty.test.ts` holds several of those open.
   The two above qualified nothing on the page they sat on.

   ── Why the fields are read, not typed ──
   Every field named below is pulled off `code-builder@1.0.0`, the
   card the rest of the site opens with. A page explaining what
   `mcp` and `cannot` are, illustrated with invented values, would
   be teaching a schema nobody ships.

   Motion is `anim-strip-in` from `globals.css`: the resting style
   is the finished one and the animation is added on top, inside
   `prefers-reduced-motion: no-preference`. Nothing here needs
   script to be legible.

   Static: no `generateStaticParams`, no `dynamicParams`, server
   component, no props (Next 16, `docs/01-app/03-api-reference/
   03-file-conventions/page.md`).
   ============================================================ */

export const metadata: Metadata = {
  title: "Eval, harness, rubric and the rest",
  description:
    "What a tool, an MCP server, a skill and a guardrail are on a node card, what a harness actually is, and what an eval and a rubric would mean here. Including the two this site does not model.",
};

const LINK =
  "text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright";

function Correction({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg border border-amber/30 bg-amber/5 px-4 py-3 text-sm leading-relaxed text-muted">
      <span aria-hidden className="font-mono text-amber">
        ▲
      </span>
      <span>{children}</span>
    </p>
  );
}

export default function ConceptsPage() {
  const builder = getNodeCard("code-builder");
  const card = builder?.card;

  return (
    <>
      <header className="border-b border-line bg-void py-16 sm:py-20">
        <div className="container-page">
          <SectionHeading
            as="h1"
            eyebrow="The words"
            title="Eval, harness, rubric and the rest"
            lead="These words travel together and mean different things to different people. Here is what each one is on this site, starting inside one node card and zooming out until the whole graph is in view."
          />
        </div>
      </header>

      {/* ---------- one card ---------- */}
      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Zoom in"
            title="Inside one node"
            lead="A card is the whole of what a node is. Four of its rows decide what that node can do, one decides what it must never do, and one prices what breaks if it goes wrong. None of the six is a step in the run: the card describes the step, and points outward at things that live outside the graph."
          />

          {card !== undefined && (
            <>
              <WhatACardReaches
                model={card.model ?? "inherits"}
                tools={card.tools.length > 0 ? card.tools.join(", ") : "none"}
                mcp={card.mcp.length > 0 ? card.mcp.join(", ") : "none"}
                skill={card.skill ?? "none"}
                cannot={card.cannot.length > 0 ? (card.cannot[0] ?? "") : "nothing declared"}
                riskMarkers={
                  card.riskMarkers.length > 0 ? card.riskMarkers.join(", ") : "none declared"
                }
              />

            </>
          )}
        </div>
      </section>

      {/* ---------- zoom out ---------- */}
      <section className="border-t border-line bg-void py-16">
        <div className="container-page flex flex-col gap-8">
          <SectionHeading
            eyebrow="Zoom out"
            title="Many nodes, and the thing that runs them"
            lead="Wire the nodes together and you have a blueprint: who hands what to whom, and which edges were deliberately left out. Give that blueprint a harness and it runs; grade what comes back against a rubric and you have an eval."
          />

          {/* The Correction that stood here read "Connected nodes are a blueprint, not a
              harness ... DarkPrint publishes the blueprint and analyses it standing
              still." The figure below now draws that relation, and the second half was
              the site telling a reader again what does and does not run here, which the
              author has asked off twice. */}
          <EvalHarnessBlueprint />

          {/* And the paragraph after it, "And then there is the run ... none of it happens
              on this site", is gone for the same reason. */}
        </div>
      </section>

      {/* ---------- eval and rubric ---------- */}
      <section className="border-t border-line bg-surface py-16">
        <div className="container-page flex flex-col gap-8">
          {/* This section opened with a lead defining an eval and a card defining the
              rubric, and the figure above now says both: the frames are the definition
              and the rubric box names `acceptance-criteria` itself. What is left is the
              one thing containment cannot draw, which is why the rubric is kept away from
              the node being judged. */}
          <SectionHeading
            eyebrow="Judging the work"
            title="Why the rubric is kept away"
            lead="A verdict is worth something because the node doing the work never saw what it would be judged against. That is a property of the topology, so it is checkable."
          />

          {/* The link used to be a paragraph of nothing but the link, sitting alone
              between a lead and a callout. It says what it is for now, which is the
              question the lead above raises and does not answer: how a topology can be
              checked for something nobody drew. */}
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
            The check is topological, so it holds whoever wrote the graph: no path may
            carry <code className="font-mono text-[13px] text-amber">acceptance-criteria</code>{" "}
            into the node whose work that criteria will judge.{" "}
            <Link href="/spec/topology" className={LINK}>
              The edge that is not there <span aria-hidden>&rarr;</span>
            </Link>
          </p>

          <Correction>
            <span className="text-fg">One correction.</span>{" "}
            <span className="text-fg">Observability</span> is not modelled here at all: no
            field on a card, no term in the vocabulary, nothing in the engine. Traces,
            token counts and latency belong to a run rather than to a graph. It is a real
            practice and this vocabulary has no opinion on it, which is worth saying rather
            than drawing a box for.
          </Correction>

          {/* This page taught six words and then stopped. The two places those words are
              load-bearing are the card that declares them and the library of cards. */}
          <OnwardRoutes
            className="mt-4"
            routes={[
              {
                href: "/spec/card",
                label: "The node card, in YAML",
                blurb: "Where these words become fields the engine reads.",
              },
              {
                href: "/nodes",
                label: "The node library",
                blurb: "Every card in the registry, and what each one declares.",
              },
            ]}
          />
        </div>
      </section>
    </>
  );
}
