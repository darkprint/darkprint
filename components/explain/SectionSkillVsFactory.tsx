import { SectionHeading } from "@/components/ui/SectionHeading";

/* ============================================================
   Doc 2 §3, first half: "Una Skill dà una capacità a un agente.
   Una dark factory è l'architettura di più agenti, e soprattutto
   è l'insieme delle regole di isolamento tra loro."

   The comparison is drawn without ranking the two. A Skill is not
   a worse dark factory; it is a smaller object, and the reason
   the distinction earns a page is that only one of the two has
   somewhere to record an isolation rule.

   ── What this section absorbed, and what that let it drop ──
   Redesign spec §3 moves the landing's `SectionNotSkill` here. Its
   two panels made the same distinction these two make, in a second
   set of words, so absorbing it cost nothing and paid for the cut
   §5 licences: prose that says the same thing a second time. The
   panel bodies lost their middle sentences, and the paragraph that
   announced what the next section would do went with them, since
   the next section is directly underneath.
   ============================================================ */

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
    label: "Skill",
    glyph: "◆",
    color: "var(--color-cyan)",
    title: "A capability, handed to one agent",
    body: "It states what the agent can do and supplies what it needs to do it: instructions, plus a tool or two. Everything it changes happens inside one head.",
  },
  {
    id: "factory",
    label: "Dark factory",
    glyph: "▧",
    color: "var(--color-violet)",
    title: "Several agents, with the wiring written down",
    body: "One card per node saying what that node does and which model runs it. One edge for every place an output becomes somebody else's input. What the graph records is which node receives which artefact.",
  },
];

/** Four rows a reader can scan without reading the panels above them. */
const ROWS: { question: string; skill: string; factory: string }[] = [
  { question: "The unit", skill: "one agent", factory: "a graph of agents" },
  {
    question: "Written as",
    skill: "instructions and tools",
    factory: "a DOT topology plus one card per node",
  },
  {
    question: "What it adds",
    skill: "something an agent can now do",
    factory: "who receives what, and who never does",
  },
  { question: "Composes by", skill: "being loaded", factory: "being wired" },
];

const TH = "pb-2 font-normal uppercase tracking-[0.14em] text-[10px] text-dim";

export function SectionSkillVsFactory() {
  return (
    <section id="comparison" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The comparison"
          title="Two objects at different altitudes"
          lead="Both are things you can write down and hand to somebody else. They describe different amounts of the world, and the gap between those amounts is where this site lives."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {SIDES.map((side) => (
            <article
              key={side.id}
              className="panel flex flex-col gap-4 p-6"
              style={{ borderTop: `2px solid ${side.color}` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md font-mono text-xl"
                  style={{
                    color: side.color,
                    backgroundColor: `color-mix(in oklab, ${side.color} 14%, transparent)`,
                  }}
                  aria-hidden
                >
                  {side.glyph}
                </span>
                <span
                  className="font-mono text-[11px] uppercase tracking-[0.16em]"
                  style={{ color: side.color }}
                >
                  {side.label}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold text-fg">{side.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{side.body}</p>
            </article>
          ))}
        </div>

        <div className="panel mt-5 p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-[13px]">
              <caption className="sr-only">
                A Skill and a dark factory compared on four questions: what the unit is,
                how it is written down, what it adds, and how it composes.
              </caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className={`${TH} font-mono`}>
                    <span className="sr-only">Question</span>
                  </th>
                  <th scope="col" className={`${TH} font-mono pl-4 text-cyan`}>
                    Skill
                  </th>
                  <th scope="col" className={`${TH} font-mono pl-4 text-violet`}>
                    Dark factory
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ROWS.map((row) => (
                  <tr key={row.question}>
                    <th
                      scope="row"
                      className="w-[9rem] py-3 pr-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.14em] text-dim"
                    >
                      {row.question}
                    </th>
                    <td className="py-3 pl-4 align-top text-muted">{row.skill}</td>
                    <td className="py-3 pl-4 align-top text-fg">{row.factory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 max-w-3xl border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-muted">
          A Skill can make a node better at its job. It has nothing to say about what that
          node is forbidden to see, because inside a Skill there is nobody else in the
          picture to be isolated from.
        </p>
      </div>
    </section>
  );
}
