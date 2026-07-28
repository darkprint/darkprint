/* ============================================================
   Rung 5 of doc 2 §2.1 — what it isn't.

   §3: "Una Skill dà una capacità a un agente. Una dark factory è
   l'architettura di più agenti, e soprattutto è l'insieme delle
   regole di isolamento tra loro."

   The doc gives two reasons this section carries more weight than it
   looks like it does, and both are here:

   1. it explains the concept better than any abstract definition;
   2. it justifies the whole premise of the site. If the value is in
      the structure, a repository of graphs makes sense and a
      repository of prompts does not.

   Rung 4 above already showed the isolation rule on a real graph and
   watched the score move. This rung does the half that one cannot:
   *why* the rule exists, which is a fact about how models behave, and
   why it is unwriteable as a skill. The full treatment is /what-it-isnt.
   ============================================================ */

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Side = {
  id: string;
  label: string;
  glyph: string;
  color: string;
  title: string;
  body: string;
};

const SIDES: Side[] = [
  {
    id: "skill",
    label: "A skill",
    glyph: "◈",
    color: "var(--color-violet)",
    title: "One agent, one capability",
    body: "A skill hands an agent an ability it did not have. It is written for a single actor and it travels alone. Nothing in it can say anything about a second agent, because there is no second agent in view.",
  },
  {
    id: "factory",
    label: "A dark factory",
    glyph: "▧",
    color: "var(--color-cyan)",
    title: "Several agents, and the walls between them",
    body: "A factory is an arrangement of agents, and most of its design is in what each one is denied. Who receives which artefact, and who is kept away from what. None of that lives inside any single agent.",
  },
];

export function SectionNotSkill() {
  return (
    <section id="not-a-skill" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="What it isn't"
          title="This is not a collection of skills"
          lead="The question comes up immediately, and answering it explains the concept better than a definition does."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {SIDES.map((s) => (
            <article
              key={s.id}
              className="panel flex flex-col gap-4 p-6"
              style={{ borderTop: `2px solid ${s.color}` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-lg"
                  style={{
                    color: s.color,
                    backgroundColor: `color-mix(in oklab, ${s.color} 14%, transparent)`,
                  }}
                  aria-hidden
                >
                  {s.glyph}
                </span>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: s.color }}
                >
                  {s.label}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </article>
          ))}
        </div>

        {/* The example doc 2 §3 says carries the whole distinction. */}
        <div className="mt-6 rounded-lg border border-signal/30 bg-signal/5 p-6 sm:p-8">
          <p className="max-w-3xl font-display text-xl leading-snug text-fg">
            Whoever writes the code must never see the acceptance tests. If it sees them,
            it games them.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
            The deeper version of the problem is that the model which produced the change
            is the same one telling you it is fine. Language models agree with their own
            previous turns and declare victory over work they just did. Generation and
            validation have to be completely isolated, and isolation is something you do
            to a topology.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
            There is no way to write that rule as a skill. It is a statement about who is
            connected to whom, and above all about who is cut off from what.
          </p>
        </div>

        <p className="mt-8 max-w-3xl text-base leading-relaxed text-muted">
          Which settles what a registry like this should hold. If the value of a dark
          factory is in its structure, then a library of graphs is the useful artefact and
          a library of prompts is the wrong shape for the problem.{" "}
          <Link
            href="/what-it-isnt"
            className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
          >
            The long version, with the graph
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
