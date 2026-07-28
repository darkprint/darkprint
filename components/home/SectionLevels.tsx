/* ============================================================
   Rung 3 of doc 2 §2.1 — self-localisation. The rung the site was
   missing, and the reason a cold tester could not read the old one:
   "il sito definisce il concetto prima di far localizzare il
   lettore" (§0).

   Three jobs, in this order:

   1. put the reader somewhere. The levels are turned toward them
      ("oggi sei probabilmente al livello 2"), not presented as a
      taxonomy to admire;
   2. land the hook of §1: the gap to level 4 is architectural and
      organisational, the technology already exists, what is missing
      are the patterns for structuring the work. That sentence is the
      whole positioning argument — it tells the reader their problem
      is a design problem, and design is what this site collects;
   3. defuse the tension §1.1 flags in as many words. Rung 3 implies
      level 4 is a destination. The per-blueprint autonomy band must
      not inherit that reading, so the two scales are named apart on
      the same screen where the confusion would otherwise start.

   ⚠️ §1.1 is binding here more than anywhere: nothing in this file
   may teach a reader to optimise a number. The four levels describe
   an organisation; the band describes one graph. No arrows between
   the levels, no progress track, no wording that makes level 2 a
   deficiency.
   ============================================================ */

import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

type Level = {
  n: 1 | 2 | 3 | 4;
  name: string;
  body: string;
  /** The one the reader is most likely standing on. Stated, never styled as a fault. */
  you?: boolean;
};

/**
 * The four levels, in the wording this site uses.
 *
 * The framing is the one the Bluegrid piece sets out and the HackerNoon piece works
 * through; the sentences are ours, because a landing that paraphrases a source badly is
 * worse than one that says plainly which source it is borrowing from. Both are linked
 * underneath.
 *
 * Level 2 and level 4 are the two the positioning depends on, and both are phrased the
 * way doc 2 §1 phrases them: level 2 is "prompti, revisioni, mergi", level 4 is the
 * factory. The other two are described in the same register so the list reads as one
 * scale rather than as two borrowed ones.
 */
const LEVELS: Level[] = [
  {
    n: 1,
    name: "Completion",
    body: "The model finishes the line you are typing. You are still the one writing the code.",
  },
  {
    n: 2,
    name: "AI-assisted",
    body: "You prompt, you review, you merge. An agent does most of the typing and you stay on the critical path for every change.",
    you: true,
  },
  {
    n: 3,
    name: "Delegated",
    body: "An agent takes a whole task end to end. A person still reads the result and decides whether it lands.",
  },
  {
    n: 4,
    name: "Autonomous",
    body: "A specification goes in. The pipeline plans, builds, tests, debugs and releases, and nobody is standing on the path it takes.",
  },
];

type Source = { title: string; where: string; href: string; note: string };

/** The three references doc 2 §1 asks the landing to carry. Every URL is a real one. */
const SOURCES: Source[] = [
  {
    title: "AI Dark Factory Pattern, Part 1: What It Is (and Isn't)",
    where: "BlueGrid",
    href: "https://bluegrid.io/blog/ai-dark-factory-pattern-part-1-what-is-it-and-isnt/",
    note: "Where the four levels come from, and the FANUC comparison.",
  },
  {
    title: "The Dark Factory Pattern: Moving From AI-Assisted to Fully Autonomous Coding",
    where: "HackerNoon",
    href: "https://hackernoon.com/the-dark-factory-pattern-moving-from-ai-assisted-to-fully-autonomous-coding",
    note: "One team's account of the climb, written from level 2.",
  },
  {
    title: "strongdm/attractor",
    where: "GitHub",
    href: "https://github.com/strongdm/attractor",
    note: "The operational case. StrongDM published the specification of its graph runner and no source code. DarkPrint's DOT stays readable by it.",
  },
];

export function SectionLevels() {
  return (
    <section id="levels" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="Where you are today"
          title="Most teams are at level 2"
          lead="Before the rest of this makes sense, find yourself on the list. It describes how far along a team is with agents, and where you land decides which problem you actually have."
        />

        <ol className="mt-10 flex flex-col gap-3">
          {LEVELS.map((l) => (
            <li
              key={l.n}
              className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-baseline sm:gap-6"
              style={
                l.you
                  ? { borderColor: "var(--color-cyan)" }
                  : undefined
              }
            >
              <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:w-56">
                <span className="inline-flex items-center rounded border border-line-bright bg-surface-3 px-2 py-0.5 font-mono text-sm text-fg">
                  level {l.n}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  {l.name}
                </span>
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted">
                {l.body}
                {l.you && (
                  <span className="ml-2 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-cyan">
                    <span aria-hidden>◀ </span>
                    you are probably here
                  </span>
                )}
              </p>
            </li>
          ))}
        </ol>

        {/* Doc 2 §1's hook. The one sentence that does the positioning. */}
        <div className="mt-8 rounded-lg border border-cyan/30 bg-cyan/5 p-6 sm:p-8">
          <p className="max-w-3xl font-display text-xl leading-snug text-fg sm:text-2xl">
            The gap between level 2 and level 4 is architectural and organisational.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-muted">
            The technology to run at level 4 already exists. What is missing are the
            patterns for structuring the work: what each agent is handed, and what each
            one is kept away from. Better models will not supply that. It is a design
            problem, and designs are what this site collects.
          </p>
        </div>

        {/* ---------- doc 2 §1.1, in as many words ---------- */}
        <div id="autonomy" className="panel mt-6 scroll-mt-24 p-6 sm:p-8">
          <h3 className="font-display text-xl font-semibold text-fg">
            One word, two scales
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            Both of them run 1 to 4 and they measure different subjects. Keeping them
            apart matters, because the second one is printed on every blueprint in the
            gallery.
          </p>

          <dl className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col gap-2 border-l-2 border-line-bright pl-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                The four levels above
              </dt>
              <dd className="text-sm leading-relaxed text-muted">
                <span className="text-fg">The maturity of an organisation.</span> What a
                team is able to do at all, across everything it ships.
              </dd>
            </div>
            <div className="flex flex-col gap-2 border-l-2 border-cyan/50 pl-4">
              <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan">
                The autonomy band on a blueprint
              </dt>
              <dd className="text-sm leading-relaxed text-muted">
                <span className="text-fg">A design choice on one graph.</span> What that
                factory automated, and where its author decided a person should act.
              </dd>
            </div>
          </dl>

          <p className="mt-6 max-w-3xl border-t border-line pt-5 text-sm leading-relaxed text-muted">
            A level 4 team publishes level 2 blueprints on purpose. A factory that stops
            for a person before it releases is a factory whose author decided where a
            person belongs, and the band records that decision. In the gallery the band
            filters; it never ranks, and nothing here badges or rewards a blueprint for
            the number it lands on.{" "}
            <Link
              href="/blueprints"
              className="text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
            >
              See it on the blueprints
            </Link>
            .
          </p>
        </div>

        {/* ---------- sources ---------- */}
        <div className="mt-10 border-t border-line pt-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Where this framing comes from
          </h3>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {SOURCES.map((s) => (
              <li key={s.href} className="flex flex-col gap-1.5">
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium leading-snug text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan"
                >
                  {s.title}
                  <span className="ml-1 font-mono text-[11px] text-dim" aria-hidden>
                    ↗
                  </span>
                </a>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                  {s.where}
                </span>
                <p className="text-xs leading-relaxed text-dim">{s.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
