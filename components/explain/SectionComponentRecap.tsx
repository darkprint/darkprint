import Link from "next/link";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { allNodeCards, getOntologyView, getRegistry } from "@/lib/content";
import { kindHref, termHref } from "@/lib/href";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Doc 2 §3's closing ask: "Serve una pagina di recap delle
   componenti (blueprint, nodo, ontologia, fase) che spieghi cosa
   sono e come si distinguono tra loro."

   Four entries, each linking at the surface where the thing
   actually lives, and each carrying the count the archive
   currently holds rather than a number typed into the copy.
   The distinctions are the paragraph underneath, because the
   confusable pairs are across entries and not inside one.

   ── The condensation ──
   Redesign spec §4.4 asks this page concise and §5 licences one
   cut: prose that says the same thing a second time. Every entry
   body lost the clause that restated its own first sentence. The
   third closing paragraph went entirely, because it was the phase
   entry again — phase and node type as two dimensions of one card
   is what that entry opens with, and the one claim the paragraph
   added on top of it (a card may name several phases or none, and
   a step outside all five is not a defect) has moved up into the
   entry itself.
   ============================================================ */

type Entry = {
  id: string;
  label: string;
  glyph: string;
  color: string;
  count: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

/** The five phase terms, with their labels read out of the vocabulary. */
const PHASES = CORE_PHASE_IDS.map((id) => ({
  id,
  label: getOntologyView().get(id)?.label ?? id,
}));

function entries(): Entry[] {
  const registry = getRegistry();
  // The curated set, not the merged view. The card names the vocabulary two authors hold
  // each other to, and the merged count folds in this archive's own namespaced overlay —
  // which is how the recap came to print 50 where `/ontology` prints 49.
  const terms = partitionTerms(getOntologyView().ontology.terms).core.length;

  return [
    {
      id: "blueprint",
      label: "Blueprint",
      glyph: "▧",
      color: "var(--color-cyan)",
      count: `${registry.blueprints().length} in the archive`,
      title: "The whole factory, as one graph",
      body: "A DOT file carrying the topology, plus one pinned card version for every node in it. Hashed and versioned as a unit, so a score can be reproduced years later against the exact cards it was computed from. This is the unit you take away.",
      href: kindHref("blueprint"),
      cta: "Browse blueprints",
    },
    {
      id: "node",
      label: "Node",
      glyph: "◫",
      color: "var(--color-amber)",
      count: `${allNodeCards().length} distinct cards`,
      title: "One step, fully described",
      body: "A card stating what the step does, which model or tool does it, the typed ports it reads and writes, whether a person acts there, and the spec the agent is handed when the graph is instantiated. Versioned on its own, and pinnable by several blueprints without being copied.",
      href: kindHref("node"),
      cta: "Browse node cards",
    },
    {
      id: "ontology",
      label: "Ontology",
      glyph: "⬡",
      color: "var(--color-violet)",
      count: `${terms} curated terms`,
      title: "The vocabulary the cards are written in",
      body: "Every structural field on a card points into it: the node's type, the data type on each port, the tools it needs, the risk markers it declares. It is what lets an analyzer read a graph it has never seen, and what stops two authors from naming one thing twice.",
      href: kindHref("ontology"),
      cta: "Read the ontology",
    },
    {
      id: "phase",
      label: "Phase",
      glyph: "◷",
      color: "var(--color-emerald)",
      count: `${PHASES.length}, and no more`,
      title: "Where a node stands in the lifecycle",
      body: "A term in the ontology like any other, on its own dimension: a card says what kind of thing the node is and, separately, where in the arc it acts. A card may name several phases or none. These five are the one closed set in the vocabulary, because a sixth would be a different definition of the word factory. Which of them a blueprint has nodes in is its phase coverage, and an intake step standing outside all five is not a defect.",
      href: "/ontology#phases-heading",
      cta: "See the five phases",
    },
  ];
}

export function SectionComponentRecap() {
  return (
    <section id="components" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The vocabulary of this site"
          title="Four words used precisely"
          lead="They get used loosely everywhere else. Here each one names exactly one thing, and the pages are built on the difference between them."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {entries().map((entry) => (
            <article
              key={entry.id}
              className="panel flex flex-col gap-3 p-6"
              style={{ borderTop: `2px solid ${entry.color}` }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: entry.color }}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {entry.glyph}
                  </span>
                  {entry.label}
                </span>
                <span className="font-mono text-[11px] text-dim">{entry.count}</span>
              </div>

              <h3 className="font-display text-xl font-semibold leading-snug text-fg">
                {entry.title}
              </h3>
              <p className="flex-1 text-sm leading-relaxed text-muted">{entry.body}</p>

              {entry.id === "phase" && (
                <ul className="flex flex-wrap gap-1.5">
                  {PHASES.map((phase) => (
                    <li key={phase.id}>
                      <Link
                        href={termHref(phase.id)}
                        className="inline-flex rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-line-bright hover:text-cyan"
                      >
                        {phase.id}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href={entry.href}
                className="mt-1 inline-flex w-fit items-center gap-1.5 font-mono text-xs transition-transform hover:translate-x-0.5"
                style={{ color: entry.color }}
              >
                {entry.cta}
                <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 flex max-w-3xl flex-col gap-3 border-l-2 border-line-bright pl-4">
          <p className="text-sm leading-relaxed text-muted">
            Blueprint and node are the two structural levels, and nothing sits between
            them. A reusable sub-graph would be a third, with an arbitrary line drawn
            somewhere, so the format answers that need by letting one blueprint reference
            another as a composite node. Nothing on the site does it today.
          </p>
          <p className="text-sm leading-relaxed text-muted">
            The ontology sits underneath both of them: it is the vocabulary the other two
            are written in, which is why a term has no version of its own the way a card
            does. There is one curated core, versioned as a whole, with room for terms
            coined in somebody&apos;s own namespace.
          </p>
        </div>
      </div>
    </section>
  );
}
