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
   ============================================================ */

/** The two ways a generator that can read its own checks goes wrong. */
const FAILURES: { id: string; tag: string; color: string; title: string; body: string }[] = [
  {
    id: "gaming",
    tag: "direct",
    color: "var(--color-amber)",
    title: "It writes against the checks",
    body: "A generator that can read the acceptance criteria will aim at them. It special-cases the inputs the tests use. The general case stays broken and everything passes, so the work looks finished and the criteria have stopped measuring anything.",
  },
  {
    id: "sycophancy",
    tag: "the one people walk into",
    color: "var(--color-signal)",
    title: "It grades its own work",
    body: "The model that produced the change is the same model reporting that the change is fine. LLMs agree with their own previous turns and are quick to declare victory over something they just produced. A review by the author reads exactly like a real review, in the same confident register, and it is worth nothing.",
  },
];

export function SectionIsolationRule() {
  return (
    <section id="isolation" className="bg-void py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The example that settles it"
          title="The builder never sees the tests"
          lead="One rule does more work here than any definition. Most people agree with it on sight, and it still cannot be written as a Skill."
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
              So generation and validation are held apart. The node that writes the code
              and the node that judges it are two different nodes, and the acceptance
              criteria only ever reach the second one. That is the design decision, and it
              has to be enforced somewhere.
            </p>
            <p className="text-[15px] leading-relaxed text-muted">
              No instruction added to the builder enforces it. The builder cannot decline
              to use what it was handed, and a rule it applies to itself is a rule the same
              model gets to interpret, on the same run, with the same incentives. The
              property lives one level up, in the topology: who is connected to whom, and
              above all who is cut off from what.
            </p>
            <p className="rounded border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-dim">
              Isolation is not only a missing arrow. A card whose prose restates the
              criteria is isolated on the drawing and leaking in practice, so the check
              reads the specs as well as the edges. Both halves have to hold, and only one
              of them is visible in a picture.
            </p>
          </div>

          {/* Doc 2 §3, reason two: this is the argument the whole registry rests on. */}
          <div className="panel flex flex-col gap-4 border-t-2 border-t-cyan p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
              Why the site stores graphs
            </span>
            <p className="text-[15px] leading-relaxed text-fg">
              If the value of a dark factory is in its structure, then a repository of
              graphs holds that value and a repository of prompts does not.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              A prompt collection can give you an excellent builder prompt and an excellent
              tester prompt, sitting next to each other on the same page, and it has
              nowhere to record that the first must never receive what the second checks.
              The fact worth keeping is an edge somebody chose not to draw. A list of texts
              has no edges.
            </p>
            <p className="text-sm leading-relaxed text-muted">
              Which is why every entry in this registry is a graph with typed ports and a
              versioned card behind each node, and why the two scores it computes are read
              off that structure. The data model and the positioning hold each other up.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
