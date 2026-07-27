/* ============================================================
   DarkPrint — the autonomy section of the homepage
   Doc 2 §1.1 is binding on every word here: "un blueprint non deve
   essere completamente autonomo per avere valore su DarkPrint …
   quel punteggio è descrittivo, non qualitativo."

   Which rules out four things this section used to do:

   - a four-segment gauge per band, filled to the level with the
     remainder greyed out. That is the "barra di progresso che
     suggerisce un vuoto da riempire" the principle names outright;
   - a dim → amber → cyan → emerald ramp across the bands, i.e. the
     visual grammar of a warning climbing to a pass. Every band now
     renders identically, and nothing on this page is keyed by
     colour alone;
   - arrows between the bands and a title reading "from assisted to
     closed-loop", which stage a journey with a destination;
   - "a node counts against autonomy", "gives up the most
     autonomy", "what a gate costs" — the number is not a budget
     being spent.

   What replaces them is what §1.1 asks the indicator to do
   instead: state the band, and say **where the people are**.
   ============================================================ */

import Link from "next/link";
import type { AutonomyContribution } from "@/lib/core";
import { DARKPRINT_CONFIG } from "@/lib/core";
import type { AutonomyLevel, Blueprint } from "@/lib/types";
import { allBlueprints } from "@/lib/content";
import { AUTONOMY_LABELS, NODE_KIND_META } from "@/lib/format";
import { contentHref } from "@/lib/href";
import { SectionHeading } from "@/components/ui/SectionHeading";

/* The analyzer's own calibration, not a copy of it. Doc 3 §9 and doc 1 §11 both leave
   the cut-offs open, so the moment they are re-tuned this section has to move with them
   — which it can only do if it never writes one of them down. */
const { level4, level3, level2 } = DARKPRINT_CONFIG.autonomy;

/** Two decimals, the way `computeAutonomy` prints a threshold in its rationale. */
function dec(n: number): string {
  return n.toFixed(2);
}

/** The same cut-off as a share of the graph, for the prose half of each band. */
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

type Band = {
  level: AutonomyLevel;
  /** The comparison the analyzer actually makes, verbatim. */
  rule: string;
  /** What a graph in this band looks like. A shape, never a shortfall. */
  blurb: string;
};

/**
 * The four bands. Both halves are generated: the mono rule mirrors the comparison chain
 * in `computeAutonomy` exactly — strictly greater than `level4` at the top,
 * greater-or-equal for the two below it — and the prose restates the same number in
 * words, so nothing here means anything the engine does not.
 *
 * The blurbs describe where the people stand in a graph of that shape. None of them says
 * what the graph lacks: doc 2 §1.1's whole point is that a blueprint with a person in it
 * has decided where a person acts, and a reader who publishes one should not find their
 * own design written up as a deficit.
 */
const BANDS: Band[] = [
  {
    level: 1,
    rule: `share < ${dec(level2)}`,
    blurb: `Under ${pct(level2)} of the nodes run unattended. People are stationed through the whole arc, and the agents do their work inside steps a person opens and closes.`,
  },
  {
    level: 2,
    rule: `${dec(level2)} ≤ share < ${dec(level3)}`,
    blurb: `${pct(level2)} to ${pct(level3)}. Agents carry the work; a person is posted at the moves the author decided a person should make.`,
  },
  {
    level: 3,
    rule: `${dec(level3)} ≤ share ≤ ${dec(level4)}`,
    blurb: `${pct(level3)} to ${pct(level4)}. The graph runs itself between a few named nodes where somebody signs off or supplies something only they have.`,
  },
  {
    level: 4,
    rule: `share > ${dec(level4)}`,
    blurb: `Above ${pct(level4)}. Nobody is posted in the graph: it plans, executes, verifies and ships on its own, and the lights are off.`,
  },
];

/** The same ⏸ the schematic legend and the explainability panel use for a human node. */
const GATE = NODE_KIND_META.gate;

/** What put a person at this node, in the vocabulary the card actually uses. */
function reasonFor(c: AutonomyContribution): string {
  if (c.reason === "human-in-the-loop-type") return `type: ${c.term ?? "human-in-the-loop"}`;
  if (c.reason === "requires-human-flag") return "requires_human: true";
  return "a person acts here";
}

interface Example {
  blueprint: Blueprint;
  /** The nodes a person acts at — doc 2 §1.1's "dove sono gli interventi umani". */
  people: AutonomyContribution[];
}

/**
 * A blueprint from the archive that has people in it, and where they are.
 *
 * The pick is by *how many* nodes a person acts at, not by the lowest fraction: the
 * point is to show the interventions, and the graph with the most of them shows the most.
 * The slug breaks a tie so the pick is stable from one build to the next, and it comes
 * out of the archive rather than being named here.
 *
 * `requiresHuman` is read off each contribution rather than derived from
 * `totalNodes − autonomousNodes`. Those two counts do not partition the graph: a node
 * whose card is missing from the bundle is `resolved: false` and is neither unattended
 * nor staffed, so subtracting would put a person at a node where nobody is — which is
 * precisely the thing this section exists to get right.
 */
function example(): Example | undefined {
  let best: Example | undefined;
  for (const blueprint of allBlueprints()) {
    const people = blueprint.analysis.autonomy.contributions.filter((c) => c.requiresHuman);
    if (people.length === 0) continue;
    if (
      best === undefined ||
      people.length > best.people.length ||
      (people.length === best.people.length && blueprint.slug < best.blueprint.slug)
    ) {
      best = { blueprint, people };
    }
  }
  return best;
}

const EXAMPLE = example();

export function SectionAutonomy() {
  return (
    <section id="autonomy" className="bg-surface py-20 sm:py-28">
      <div className="container-page">
        <SectionHeading
          eyebrow="The autonomy bands"
          title="Autonomy says where the people are"
          lead="It is the share of a graph's nodes whose type is not a kind of human-in-the-loop, reported as one of four bands. The bands are read out of the analyzer's own config, so this page cannot quote a threshold the engine has stopped using — and they are a description of a design decision, not a mark. In the gallery they filter; they never rank."
        />

        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BANDS.map((b) => (
            <li key={b.level} className="panel flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {/* A bordered token, not a track: it has no empty half to read as a
                    gap. Identical for all four bands, so nothing is keyed by colour. */}
                <span className="inline-flex items-center gap-1 rounded border border-line-bright bg-surface-3 px-2 py-0.5 font-mono text-sm text-fg">
                  level {b.level}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                  {AUTONOMY_LABELS[b.level]}
                </span>
              </div>
              <p className="font-mono text-[11px] leading-relaxed text-dim">{b.rule}</p>
              <p className="text-sm leading-relaxed text-muted">{b.blurb}</p>
            </li>
          ))}
        </ul>

        <p className="mt-4 max-w-3xl text-xs leading-relaxed text-dim">
          The four are listed by the share that produces them, which is the only thing
          that orders them. Level 4 does not sit above level 1: a factory that stops for a
          person before it publishes is not a worse factory than one that does not, it is
          a factory whose author decided where a person belongs. Nothing on DarkPrint
          ranks, badges or rewards a blueprint for the band it lands in.
        </p>

        <div className="mt-8 flex items-start gap-4 rounded-lg border border-signal/30 bg-signal/5 p-5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-lg"
            style={{
              color: GATE.color,
              backgroundColor: `color-mix(in oklab, ${GATE.color} 14%, transparent)`,
            }}
            aria-hidden
          >
            {GATE.glyph}
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="text-sm leading-relaxed text-muted">
              <span className="font-medium text-fg">
                A person acts at a node in exactly two ways
              </span>{" "}
              — its type sits under{" "}
              <span className="font-mono text-signal">human-in-the-loop</span> in the
              ontology, which is how a{" "}
              <span className="font-mono text-signal">human-input</span> node is counted
              without anybody remembering to tick a flag, or the card says{" "}
              <span className="font-mono text-signal">requires_human: true</span> on a type
              that says nothing about people either way. A node whose card is missing from
              the bundle is in neither group: nothing states how it runs, so it is counted
              in the total with no person recorded at it. Nothing is executed — the reading
              is taken off the drawing, and anyone who downloads the bundle can redo it.
            </p>

            {EXAMPLE !== undefined && (
              <>
                <p className="text-sm leading-relaxed text-muted">
                  Which is why the indicator points at nodes rather than at a shortfall.{" "}
                  <Link
                    href={contentHref(EXAMPLE.blueprint)}
                    className="font-medium text-fg underline decoration-line-bright underline-offset-2 transition-colors hover:text-cyan"
                  >
                    {EXAMPLE.blueprint.title}
                  </Link>{" "}
                  comes out at autonomy level{" "}
                  {EXAMPLE.blueprint.analysis.autonomy.level}, and here is exactly where
                  its {EXAMPLE.people.length === 1 ? "person is" : "people are"}:
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {EXAMPLE.people.map((c) => (
                    <li
                      key={c.nodeId}
                      className="inline-flex items-center gap-2 rounded border border-line bg-surface-2 px-2 py-1 text-[12px]"
                    >
                      <span className="font-mono text-signal" aria-hidden>
                        {GATE.glyph}
                      </span>
                      <span className="text-fg">{c.name}</span>
                      <span className="font-mono text-[11px] text-dim">{reasonFor(c)}</span>
                    </li>
                  ))}
                </ul>
                <p className="rounded border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-dim">
                  {EXAMPLE.blueprint.analysis.autonomy.rationale}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Doc 2 §1 flags this tension explicitly and asks the landing copy not to let
            the two readings of "level" blur into each other. */}
        <p className="mt-6 max-w-3xl border-l-2 border-line-bright pl-4 text-sm leading-relaxed text-muted">
          One word, two meanings, and they are worth keeping apart. The industry&apos;s
          levels 1&ndash;4 describe the <span className="text-fg">maturity of an
          organisation</span> — what a team is able to do at all. A blueprint&apos;s
          autonomy band describes a <span className="text-fg">design decision about one
          graph</span> — what that factory automated and what it deliberately did not. A
          level 4 team publishes level 2 blueprints all the time, on purpose.
        </p>
      </div>
    </section>
  );
}
