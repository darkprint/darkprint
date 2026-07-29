/* ============================================================
   Doc 2 §3, first half: "Una Skill dà una capacità a un agente.
   Una dark factory è l'architettura di più agenti, e soprattutto
   è l'insieme delle regole di isolamento tra loro."

   The comparison is drawn without ranking the two. A Skill is not
   a worse dark factory; it is a smaller object, and the reason
   the distinction earns a page is that only one of the two has
   somewhere to record an isolation rule.

   ── What this block absorbed, and what that let it drop ──
   Redesign spec §3 moved the landing's `SectionNotSkill` here. Its
   two panels made the same distinction the table makes, in a second
   set of words, so absorbing it cost nothing and paid for the cut
   §5 licences: prose that says the same thing a second time.

   ── Why this is no longer a section of its own ──
   The length pass. The author's complaint is "a very long single
   page that makes the user leave", and this page was three sections
   that had been merged rather than one argument: `SectionWhatItIs`
   said what a dark factory is, then this said it again as an
   eyebrow, a title, a lead and two panels before the table finally
   drew the distinction. Four openings for one comparison.

   So the eyebrow, the title, the lead and the two panels are gone
   and the table is rendered inside `#what-it-is`, directly under
   the paragraph that says what a dark factory is. What the two
   panels carried survives in the rows: "Everything it changes
   happens inside one head" is the `The unit` row, and "what the
   graph records is which node receives which artefact" is the
   `What it adds` row.

   The file keeps its name because `app/page.tsx` records rung 5 of
   doc 2 §2.1 as having been folded into `SectionSkillVsFactory`,
   and a comment pointing at a file that no longer exists is the
   stale reference `architecture/website.md` warns about.
   ============================================================ */

/** Four rows a reader can scan without a paragraph in front of them. */
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

export function SkillComparison() {
  return (
    <div className="mt-10">
      <h3 className="font-display text-xl font-semibold tracking-tight text-fg">
        Two objects at different altitudes
      </h3>

      <div className="panel mt-4 p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-[13px]">
            <caption className="sr-only">
              A Skill and a dark factory compared on four questions.
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

      {/* The page's title claim, resolved. Two sentences stood here and both said that the
          smaller object has nowhere to record a prohibition; §5 licences the cut and this
          is the half that names a Skill, which is what the page is about. */}
      <p className="mt-6 max-w-3xl border-l-2 border-line-bright pl-4 text-[15px] leading-relaxed text-muted">
        A Skill can make a node better at its job, and it has nowhere to record what that
        node must never see.
      </p>
    </div>
  );
}
