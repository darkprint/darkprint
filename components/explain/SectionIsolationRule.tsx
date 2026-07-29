import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Doc 2 §3's centrepiece, and doc 2 §9's first hint of the week:
   the isolation between generator and validator, and the
   sycophancy problem underneath it.

   Doc 2 gives two reasons this section matters more than it
   looks, and both have to survive into the page:

     1. it explains the concept better than any abstract
        definition, and
     2. it justifies the entire premise of the site. If the value
        is in the structure, a repository of graphs makes sense
        and a repository of prompts does not.

   The second one is the block at the bottom of this file. It is
   stated outright rather than implied, because implied is how it
   was lost the first time.

   ── The condensation, and what was taken out ──
   Redesign spec §4.4 asks for this page concise, and §5 licences
   one cut: prose that says the same thing a second time. Three
   paragraphs stood between the failure cards and the panel, and
   the first two both said that no instruction added to the builder
   enforces the rule. They are one paragraph now. The panel's third
   paragraph described the data model, which the four-word recap
   at the foot of this page describes as its whole subject.

   The landing's `SectionNotSkill` said the same thing again on the
   home page and has been absorbed here (spec §3).

   ── The length pass, and the three sentences it removed ──
   Each was a claim this page already made somewhere a reader had
   passed a moment earlier:

   - "The property lives one level up, in the topology: who is
     connected to whom, and above all who is cut off from what."
     The page header's lead is "the architecture of several agents,
     and above all the isolation rules between them", and the
     comparison table's `What it adds` row is "who receives what,
     and who never does". Three statements of one claim inside two
     screens.
   - "The fact worth keeping is an edge somebody chose not to
     draw." The demonstration directly below opens on "the thing
     worth studying about it is an edge it does not have", over a
     drawing of that edge not being there.
   - The prompt-collection paragraph, whose load-bearing clause was
     "it has nowhere to record that the first must never receive
     what the second checks". `SkillComparison` closes on the same
     claim about a Skill, which is the object this page is named
     for. The sentence that did not repeat anything, "A list of
     texts has no edges", stayed and now closes the panel.
   ============================================================ */

/** The two ways a generator that can read its own checks goes wrong. */
const FAILURES: { id: string; tag: string; color: string; title: string; body: string }[] = [
  {
    id: "gaming",
    tag: "direct",
    color: "var(--color-amber)",
    title: "It writes against the checks",
    body: "A generator that can read the criteria aims at them, special-casing the inputs the tests use. The general case stays broken, everything passes, and the criteria have stopped measuring anything.",
  },
  {
    id: "sycophancy",
    tag: "the one people walk into",
    color: "var(--color-signal)",
    title: "It grades its own work",
    body: "The model that produced the change is the same model reporting the change is fine. LLMs agree with their own previous turns and declare victory over what they just produced. A review by the author reads like a real review and is worth nothing.",
  },
];

export function SectionIsolationRule() {
  // `bg-void` and a rule on top, rather than the alternating `bg-surface` it used to take.
  // The comparison moved into `#what-it-is` above, which is void, and the demonstration
  // below is surface; a tinted band here would leave the demonstration with nothing to
  // stand out against.
  return (
    <section id="isolation" className="border-t border-line bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The example that settles it"
          title="The builder never sees the tests"
          lead="One rule does more work here than any definition, and it still cannot be written as a Skill."
        />

        {/* The rule, given the weight doc 2 §3 gives it. */}
        <blockquote className="panel mt-8 border-l-2 border-l-signal p-6 sm:p-8">
          <p className="font-display text-2xl leading-snug font-medium text-fg sm:text-3xl">
            Whoever writes the code must never see the acceptance tests. If it sees them,
            it games them.
          </p>
        </blockquote>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {FAILURES.map((f) => (
            <article key={f.id} className="panel flex flex-col gap-3 p-6">
              <span
                className="w-fit rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: f.color }}
              >
                {f.tag}
              </span>
              <h3 className="font-display text-lg font-semibold text-fg">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <p className="text-[15px] leading-relaxed text-muted">
              So generation and validation are held apart, and no instruction added to the
              builder holds them apart: a rule a model applies to itself is one the same
              model gets to interpret, on the same run, with the same incentives.
            </p>
            {/* The half of isolation a picture cannot carry. Nothing else on this page
                says the check reads the specs, and the demonstration below is entirely
                about edges, so removing this would leave the page claiming less than the
                engine does. */}
            <p className="rounded border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-dim">
              A card whose prose restates the criteria is isolated on the drawing and
              leaking in practice, so the check reads the specs as well as the edges. Only
              one of the two halves is visible in a picture.
            </p>
          </div>

          {/* Doc 2 §3, reason two: this is the argument the whole registry rests on. */}
          <div className="panel flex flex-col gap-4 border-t-2 border-t-cyan p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
              Why the site stores graphs
            </span>
            <p className="text-[15px] leading-relaxed text-fg">
              If the value of a dark factory is in its structure, then a repository of
              graphs holds that value and a repository of prompts does not. A list of texts
              has no edges.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
