/* ============================================================
   Rung 2 of doc 2 §2.1 — the anchoring.

   "Ancoraggio. La fabbrica al buio. Una riga, e il nome del sito
   diventa autoesplicativo."

   One line is the brief, so this section is short on purpose. It
   does two things and stops: it says where the term comes from, and
   it makes `DarkPrint` decode itself. The three trait cards that
   used to live here (decision autonomy / closed loop / specs over
   code) are gone — they defined the concept before the reader had
   located themselves, which is the exact failure doc 2 §0 diagnoses.

   The lead does not restate why the lights are off. The hero, one
   screen up, has just said it ("nobody is on the floor who would
   need them"), and §2.5 rules out a sentence whose only job is to
   say the previous one again.
   ============================================================ */

import { CORE_PHASE_IDS } from "@/lib/core";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { phaseLabel } from "@/components/ui/PhaseCoverage";

/* The five phases in lifecycle order, read out of the vocabulary rather than typed
   here. They are the one closed dimension of the ontology, so this strip cannot go
   stale against what a card is allowed to declare. */
const PHASES = [...CORE_PHASE_IDS];

export function SectionAnchor() {
  return (
    <section id="anchor" className="relative overflow-hidden bg-void py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 tech-grid opacity-70"
        style={{
          maskImage: "linear-gradient(to bottom, black, transparent 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent 78%)",
        }}
      />
      <div className="container-page relative">
        <SectionHeading
          eyebrow="Where the name comes from"
          title="A dark factory runs with the lights off"
          lead="FANUC has been building robots with robots in Oshino since 2001, and the plant runs unlit. A software dark factory is the same arrangement: a specification goes in, and the work happens without anyone standing over it."
        />

        <ol className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PHASES.map((id, i) => (
            <li
              key={id}
              className="panel flex flex-col gap-1.5 px-4 py-3"
              style={{ borderTop: "2px solid var(--color-cyan)" }}
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-dim">
                0{i + 1}
              </span>
              <span className="font-display text-sm font-medium text-fg">
                {phaseLabel(id)}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 font-mono text-[11px] text-dim">
          the five phases a factory can cover, in the order it runs them
        </p>

        <p className="mt-10 max-w-3xl border-l-2 border-cyan/50 pl-5 text-base leading-relaxed text-muted">
          The factory is dark. The drawing of one is a{" "}
          <span className="text-fg">blueprint</span>. This site is where those
          drawings are kept.
        </p>
      </div>
    </section>
  );
}
