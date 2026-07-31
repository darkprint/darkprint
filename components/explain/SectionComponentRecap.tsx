import Link from "next/link";
import { CORE_PHASE_IDS, partitionTerms } from "@/lib/core";
import { allNodeCards, getOntologyView, getRegistry } from "@/lib/content";
import { kindHref, termHref } from "@/lib/href";
import { More } from "@/components/ui/More";
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
   entry again.

   ── The length pass ──
   This was the second-longest block on the page and the one a
   reader reaches last, after the demonstration has already made
   the argument. Two things changed.

   First, it is behind a `More`. The recap is reference: four words
   and where each one lives. A reader who wants it opens it, and
   the text stays in the prerendered HTML, keyboard reachable and
   findable by find-in-page, which is the property that makes this
   a cut in density rather than a cut in what the page says.

   Second, every entry body that a linked page already carries in
   full was cut down to the sentence this page needs, because the
   entry is a signpost and the page it points at is the article.
   What went, and where it lives:

   - "and what stops two authors from naming one thing twice" —
     `/ontology` and `/spec/ontology` both print that sentence, and
     the ontology entry links to the first.
   - "Versioned on its own, and pinnable by several blueprints
     without being copied" — `/nodes` opens on "Every card is
     versioned, content-addressed, and pinned by exact reference",
     and the node entry links there.
   - the phase entry's four sentences about the closed set, several
     phases or none, phase coverage and a step outside all five —
     `/ontology`'s Phases block says all four at greater length,
     including "a sixth phase would be a different definition of
     the thing being described" and "nothing scores a node for
     standing outside them". The entry links straight at it.
   - "There is one curated core, versioned as a whole, with room
     for terms coined in somebody's own namespace" — `/ontology`
     and `/spec/ontology` both describe the merge and the reserved
     core version.

   What stayed is what nothing else on the site says: the two
   structural levels with the composite node between them that is
   not built, and a term having no version of its own.
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
      title: "The whole blueprint, as one graph",
      body: "A DOT file plus one pinned card version per node, hashed and versioned as a unit so a score stays checkable against the exact cards behind it.",
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
      body: "What the step does, which model runs it, the typed ports it reads and writes, whether a person acts there, and the spec the agent is handed.",
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
      body: "Every structural field on a card is a reference into it, which is what lets an analyzer read a graph it has never seen.",
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
      // The distinction is the whole reason this entry is on a recap rather than only on
      // `/ontology`: phase and node type are two dimensions of one card, and a reader who
      // has met both words needs to be told they do not compete.
      body: "A dimension of its own: a card says what kind of thing a node is and, separately, where in the arc it acts.",
      href: "/ontology#phases-heading",
      cta: "See the five phases",
    },
  ];
}

export function SectionComponentRecap() {
  return (
    // Shorter than the sections above it. Closed, this is a heading and one row, and the
    // band it used to sit in was sized for four panels.
    <section id="components" className="bg-void py-14 sm:py-16">
      <div className="container-page">
        <SectionHeading
          eyebrow="The vocabulary of this site"
          title="Four words used precisely"
        />

        <More
          className="mt-8"
          summary="Blueprint, node, ontology, phase: what each one names, and how they differ"
        >
          <div className="grid gap-5 md:grid-cols-2">
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

          {/* The one distinction no linked page makes, and the one absence of a feature
              that has to be stated wherever the composite node is mentioned. */}
          <p className="max-w-3xl border-l-2 border-line-bright pl-4 text-sm leading-relaxed text-muted">
            Blueprint and node are the two structural levels, with nothing between them:
            the format lets one blueprint reference another as a composite node, and
            nothing on the site does that today. The ontology sits under both, which is why
            a term carries no version of its own the way a card does.
          </p>
        </More>
      </div>
    </section>
  );
}
