"use client";

import type {
  AutonomyResult,
  Diagnostic,
  JsonValue,
  ResolvedBlueprint,
  SecurityResult,
} from "@/lib/core";
import { ITERATION_CAP_KEYS } from "@/lib/core";
import type { StarterRunBudget } from "@/lib/starter/variants";
import { autonomyStatement, cx } from "@/lib/format";
import { LEAK_EDGE, STARTER_NODES } from "./choices";
import type { UncappedReading } from "./state";

/* ============================================================
   The seven steps, and the prose beside each one.
   ------------------------------------------------------------
   Doc 2 §5.1 fixes the order: whole → part → whole. The factory
   entire, then one node and its card, then the choices that make
   it grow. §5.3 fixes the order of the choices inside that, §5.4
   places the demonstration where the reader is already looking at
   the builder and the tester, and §5.5 puts the loop last because
   it is where the earlier steps converge.

   Nothing in this file states a score. Every figure the reader
   sees is passed in from `loadBundle` or from `starterRunBudget`,
   and the sentences that carry one are written to read correctly
   whatever it turns out to be.

   ── Why three steps are split in two ──
   The control for a step sits inside pane 1, on the node it is
   about (§5.7). A step whose whole argument is printed above the
   panes puts its control a screen and a half below the fold, and
   the reader who flips the switch never sees the paragraph that
   explains what just happened. So the steps that argue at length
   export an intro and a reading: the intro sets up the choice and
   goes above the panes, the reading is the consequence and goes
   under them, next to the control that produced it.
   ============================================================ */

export type StepId =
  | "whole"
  | "node"
  | "output"
  | "switch"
  | "approval"
  | "loop"
  | "download";

export interface StepDef {
  id: StepId;
  /** Short label for the step bar. */
  nav: string;
  title: string;
  /** The node this step's control hangs on, when it has one. */
  choiceNode?: string;
}

export const STEPS: readonly StepDef[] = [
  { id: "whole", nav: "The factory", title: "Five nodes, one factory" },
  { id: "node", nav: "One node", title: "One node, four blocks" },
  {
    id: "output",
    nav: "What it builds",
    title: "What does your factory build?",
    choiceNode: STARTER_NODES.builder,
  },
  {
    id: "switch",
    nav: "The absent edge",
    title: "The edge that is not there",
    choiceNode: STARTER_NODES.builder,
  },
  {
    id: "approval",
    nav: "Who ends a run",
    title: "Who decides the work is finished?",
    choiceNode: STARTER_NODES.tester,
  },
  {
    id: "loop",
    nav: "The loop",
    title: "How many turns before it gives up?",
    choiceNode: STARTER_NODES.debugger,
  },
  { id: "download", nav: "Take it away", title: "Your factory, as files" },
];

/* --------------------- shared bits --------------------- */

const P = "text-[15px] leading-relaxed text-muted";

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <p className="overflow-x-auto rounded border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-dim">
      {children}
    </p>
  );
}

function Aside({
  title,
  tone = "line",
  children,
}: {
  title: string;
  tone?: "line" | "signal";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-lg border px-4 py-3",
        tone === "signal" ? "border-signal/40 bg-signal/5" : "border-line bg-surface-2/50",
      )}
    >
      <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-dim">{title}</h3>
      {children}
    </div>
  );
}

/* --------------------- 1. the whole factory --------------------- */

export function WholeStep() {
  return (
    <>
      <p className={P}>
        A dark factory turns a written specification into working software. This one has
        five nodes, one for each phase of that work: planning, implementation, testing,
        debugging, deployment.
      </p>
      <p className={P}>
        Nothing on this page runs. The four panes below are four readings of one bundle.
        The drawing is built from the DOT. The DOT pins a card on every node. The card is a
        file, and it is one of the files you download at the end.
      </p>
      <p className={P}>
        Select a node in the drawing and the other three panes go to it. It works the other
        way too: pick a line of the DOT or a field of the card and the drawing follows.
      </p>
    </>
  );
}

/* --------------------- 2. one node --------------------- */

export function NodeStep() {
  return (
    <>
      <p className={P}>
        Here is the <code className="font-mono text-fg">{STARTER_NODES.builder}</code>{" "}and
        the card it pins. A card seen on its own is a YAML file with fields in it, which is
        why it comes second.
      </p>
      <p className={P}>
        A card has four blocks. <span className="text-fg">Identity</span>{" "}carries the id the
        DOT points at. <span className="text-fg">Behaviour</span>{" "}carries{" "}
        <code className="font-mono text-fg">spec</code>, the prose handed to the agent when
        the graph is instantiated. <span className="text-fg">Interfaces</span>{" "}declare what
        arrives and what leaves. <span className="text-fg">Evaluation metadata</span>{" "}is
        read by DarkPrint&rsquo;s static analysis and by nothing at run time.
      </p>
      <p className={P}>
        Pane 2 lays those blocks out as slots and fills them from the document in pane 4. A
        slot the card leaves empty is an answer: a node that needs no tool has said so.
      </p>
    </>
  );
}

/* --------------------- 3. choice 1 --------------------- */

export function OutputStep({ digest }: { digest?: string }) {
  return (
    <>
      <p className={P}>
        Pick what this factory produces. This is the easiest question on the page and the
        one that makes the download yours rather than the registry&rsquo;s example.
      </p>
      <p className={P}>
        The graph does not change and neither computed score moves. What changes is the
        prose in every card, and the prose is what the agent is handed when the graph runs.
      </p>
      <p className={P}>
        Watch pane 4 while you choose. The builder&rsquo;s{" "}
        <code className="font-mono text-fg">spec</code>{" "}is rewritten, the ports change type
        where the artefact changes kind, and the bundle digest changes with them.
        {digest !== undefined && (
          <>
            {" "}
            Right now it is{" "}
            <code className="font-mono text-[13px] break-all text-fg">
              {digest.slice(0, 23)}…
            </code>
          </>
        )}
      </p>
    </>
  );
}

/* --------------------- 4. the demonstration switch --------------------- */

export function SwitchIntro({ on }: { on: boolean }) {
  return (
    <>
      <p className={P}>
        The planner writes two artefacts: a build brief and the acceptance criteria. The
        brief goes to the builder. The criteria go to the tester.
      </p>
      <p className={P}>
        Pane 1 lists{" "}
        <code className="font-mono text-signal">
          {LEAK_EDGE.source} ⇢ {LEAK_EDGE.target}
        </code>{" "}
        under <span className="text-fg">not drawn</span>. Pane 3 draws it struck through
        where the statement would have gone. Pane 2 hangs the same gap on the
        builder&rsquo;s <code className="font-mono text-fg">spec</code>, because an absent
        edge is isolation only when the content is absent from the prose too.
      </p>
      {!on && (
        <p className={P}>
          The switch is in pane 1, on the builder. Turn it on and watch the panel beside
          you: the builder&rsquo;s card already names the acceptance criteria among the
          types it refuses, so the engine answers twice.
        </p>
      )}
    </>
  );
}

export function SwitchReading({
  on,
  before,
  after,
  errors = [],
  dotLine,
  dotStatement,
}: {
  on: boolean;
  /** The factory as chosen. */
  before?: SecurityResult;
  /** The same factory with the edge written in. Only while the switch is on. */
  after?: SecurityResult;
  /**
   * What the engine refused about the graph with the edge in it, from `BuildState.errors`.
   *
   * The switch stopped being a demonstration about a score. `code-builder@1.0.0` declares
   * `cannot: [acceptance-criteria]`, so the edge raises `bundle/prohibition-violated` and
   * the bundle does not resolve — and pane 4 is showing that same card, whose `notes` tell
   * the reader in as many words that an edge carrying the criteria into this node fails
   * the bundle "whatever the prose says". Reporting the security drop and nothing else
   * left the card and the panel contradicting each other on the same screen.
   */
  errors?: readonly Diagnostic[];
  /** Where the statement landed in the DOT, when it did. */
  dotLine?: number;
  /** That line, verbatim from the file the panes are showing. */
  dotStatement?: string;
}) {
  if (!on) return null;
  const leak = after?.findings.find((finding) => finding.marker === "criteria-leak");
  return (
    <Aside title="What the analyzer just read" tone="signal">
      <p className="text-[13px] leading-relaxed text-muted">
        The statement is in the file now
        {dotLine !== undefined && (
          <>
            , at line <span className="font-mono text-fg">{dotLine}</span>{" "}of the DOT
          </>
        )}
        .
      </p>
      {dotStatement !== undefined && <Quote>{dotStatement}</Quote>}

      {/* The refusal, before the reading. An error is the end of the matter everywhere
          else on the site, and this is the step whose card says so. */}
      {errors.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] leading-relaxed text-fg">
            The bundle does not resolve. The builder&rsquo;s card lists the acceptance
            criteria among the types it will not accept, and an edge now carries them into
            it.
          </p>
          <ul className="flex flex-col gap-2">
            {errors.map((diagnostic) => (
              <li
                key={`${diagnostic.code} ${diagnostic.message}`}
                className="flex flex-col gap-1 rounded border border-signal/40 bg-signal/5 px-2.5 py-1.5"
              >
                <code className="font-mono text-[11px] text-signal">{diagnostic.code}</code>
                <span className="text-[13px] leading-relaxed text-muted">
                  {diagnostic.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {before !== undefined && after !== undefined && (
        <p className="text-[13px] leading-relaxed text-muted">
          The security metric runs on it anyway, so there is a second answer to read:
          it kept level <span className="font-mono text-fg">{before.level}</span>{" "}a moment
          ago and reads level <span className="font-mono text-signal">{after.level}</span>
          {" "}now. One author wrote a rule about their own node and the graph broke it;
          the metric reads the topology and charges what it finds there. Both point at the
          same edge.
        </p>
      )}
      {leak !== undefined && (
        <p className="text-[13px] leading-relaxed text-fg">{leak.explanation}</p>
      )}
      {after !== undefined && <Quote>{after.rationale}</Quote>}
      <p className="text-[13px] leading-relaxed text-muted">
        An agent that can read the acceptance criteria can write work shaped to pass them.
        The suite goes green and the problem is untouched. Isolation is a property of the
        topology, so the analyzer can read it off the graph without running anything, and it
        just did.
      </p>
      <p className="text-[13px] leading-relaxed text-muted">
        Turn it back off. Nobody would ship this, which is why it is not one of the choices.
      </p>
    </Aside>
  );
}

/* --------------------- 5. choice 2 --------------------- */

export function ApprovalIntro() {
  return (
    <>
      <p className={P}>
        The tester can release a green build on its own. A named approver can also stand at
        the release boundary, read the report, and answer before anything ships.
      </p>
      <p className={P}>
        Both are complete factories and both belong in the gallery. The autonomy class
        records which one you drew, and the panel beside you names the class for the graph
        on screen along with the arithmetic behind it. It describes the shape of the graph.
      </p>
      <p className={P}>
        If this factory touches something you cannot take back, the approver is the design
        you want. The other class describes a different factory. It does not describe a
        better one, and nothing on DarkPrint ranks the two.
      </p>
    </>
  );
}

export function ApprovalReading({ autonomy }: { autonomy?: AutonomyResult }) {
  if (autonomy === undefined) return null;
  const people = autonomy.contributions.filter((c) => c.requiresHuman);
  return (
    <Aside title="What the analyzer counted">
      {/* Less the band ordinal (doc 2 §1.1); the counts and the threshold survive. */}
      <Quote>{autonomyStatement(autonomy.rationale)}</Quote>
      {people.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">
          No node in this graph hands control to a person.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((c) => (
            <li key={c.nodeId} className="text-[13px] leading-relaxed text-fg">
              <span className="font-mono text-violet" aria-hidden>
                ⏸{" "}
              </span>
              <code className="font-mono text-[12px] text-muted">{c.nodeId}</code>{" "}
              {c.explanation}
            </li>
          ))}
        </ul>
      )}
    </Aside>
  );
}

/* --------------------- 6. choice 3, and the loop --------------------- */

/** One `params` entry of the debugger's card, printed as the document writes it. */
function Param({ name, value }: { name: string; value: JsonValue | undefined }) {
  if (value === undefined) return null;
  return (
    <code className="font-mono text-[12px] text-fg">
      {name}: {typeof value === "string" ? value : JSON.stringify(value)}
    </code>
  );
}

export function LoopIntro() {
  return (
    <>
      <p className={P}>
        The loop is{" "}
        <code className="font-mono text-fg">
          {STARTER_NODES.tester} → {STARTER_NODES.debugger} → {STARTER_NODES.tester}
        </code>
        . It does not go back to the builder.
      </p>
      <p className={P}>
        Two reasons, and each holds without the other. The work already done is preserved,
        so the run converges instead of regenerating from scratch and oscillating. And the
        builder stays isolated from every fact about the failures for the whole run.
      </p>
      <p className={P}>
        The slider is in pane 1, on the debugger. Move it, then read what follows.
      </p>
    </>
  );
}

export function LoopDetail({
  blueprint,
  budget,
  uncapped,
  security,
}: {
  blueprint?: ResolvedBlueprint;
  budget?: StarterRunBudget;
  uncapped?: UncappedReading;
  security?: SecurityResult;
}) {
  // The three requirements, read off the card the reader has in pane 4 rather than
  // asserted. A card that stopped declaring one of them would make the row go quiet
  // instead of leaving a paragraph on the page describing a factory nobody downloaded.
  const params =
    blueprint?.nodes.find((node) => node.nodeId === STARTER_NODES.debugger)?.card.params ??
    {};
  const capKey = ITERATION_CAP_KEYS.find((key) => params[key] !== undefined);

  return (
    <>
      <Aside title="What the slider moves">
        {budget !== undefined && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">
              This is the working behind the three figures beside the slider. At a cap of{" "}
              <span className="font-mono text-fg">{budget.maxIterations}</span>{" "}the tester
              runs at most{" "}
              <span className="font-mono text-fg">{budget.testerRunsAtMost}</span>{" "}times and
              the debugger at most{" "}
              <span className="font-mono text-fg">{budget.debuggerRunsAtMost}</span>, so a
              run reaches a model at most{" "}
              <span className="font-mono text-cyan">{budget.modelCallsAtMost}</span>{" "}times.
            </p>
            <Quote>
              planner 1 + builder 1 + tester {budget.testerRunsAtMost} + debugger{" "}
              {budget.debuggerRunsAtMost} = {budget.modelCallsAtMost}
            </Quote>
          </>
        )}
        <p className="text-[13px] leading-relaxed text-muted">
          The two computed levels are not among the figures that move. They are read off the
          topology and the cards, and a cap of 1 and a cap of 10 are both a cap
          {security !== undefined && (
            <>
              , so security stays at level{" "}
              <span className="font-mono text-fg">{security.level}</span>{" "}either way
            </>
          )}
          . What the cap is worth shows up in the three counts instead, and they are counts
          rather than estimates.
        </p>
        {uncapped !== undefined && (
          <>
            <p className="text-[13px] leading-relaxed text-muted">
              Take the cap away entirely and the same analyzer reads level{" "}
              <span className="font-mono text-signal">{uncapped.level}</span>.
            </p>
            <Quote>{uncapped.rationale}</Quote>
          </>
        )}
        <p className="text-[13px] leading-relaxed text-muted">
          A low cap costs you convergence: fewer turns, more runs that stop without a green
          build. A high cap costs you model calls and widens the accumulated leak below.
          Designing a dark factory is a trade, and neither end of this slider is the answer.
        </p>
        <p className="text-[11px] leading-relaxed text-dim">
          What a run costs in money and time is not on this page. Execution happens on your
          machine, so both are reported by whoever runs a blueprint and DarkPrint has no way
          to measure them. The counts beside the slider are the part that can be read off
          the graph without running it.
        </p>
      </Aside>

      <Aside title="The obvious objection">
        <p className="text-[13px] leading-relaxed text-muted">
          If the builder must not see the criteria, why may the debugger see the failures?
        </p>
        <p className="text-[13px] leading-relaxed text-fg">
          Seeing the criteria lets an agent write work built to pass them without solving
          the problem. Seeing the evidence of a failure it caused only tells it what broke.
          The first is gaming. The second is feedback.
        </p>
        <p className="text-[13px] leading-relaxed text-muted">
          So the debugger receives stack traces, failed assertions, and obtained beside
          expected. It does not receive the criteria set. Hand it everything and it starts
          special-casing again.
        </p>
      </Aside>

      <Aside title="Why the cap is also an isolation control">
        <p className="text-[13px] leading-relaxed text-muted">
          Over many turns that distinction wears thin. Each round of error messages reveals
          another slice of the acceptance surface, and a debugger that accumulates them can
          reconstruct a good deal of the criteria without ever being shown them. The cap
          bounds the runtime and it bounds that leak.
          {budget !== undefined && (
            <>
              {" "}
              At the position the slider is in, the debugger sees at most{" "}
              <span className="font-mono text-fg">{budget.debuggerRunsAtMost}</span>{" "}
              {budget.debuggerRunsAtMost === 1 ? "round" : "rounds"} of it. That is the
              third figure beside the slider, and it is the same number as the debugger
              runs above: a round of evidence is a run of the debugger.
            </>
          )}
        </p>
      </Aside>

      <p className={P}>
        A healthy loop needs three things. The analyzer can check the first from the graph
        and has to take the other two from the card.
      </p>
      <dl className="flex flex-col gap-3 border-l-2 border-line pl-4">
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-fg">An iteration cap.</dt>
          <dd className="text-[13px] leading-relaxed text-muted">
            Without one the cycle has no exit condition, and doc 3 §4.1 charges{" "}
            <code className="font-mono text-[12px]">unbounded-loop</code>{" "}for it. The slider
            in pane 1 writes it into the debugger&rsquo;s card and into{" "}
            <code className="font-mono text-[12px]">max_retries</code>{" "}in the runnable DOT.
            {capKey !== undefined && (
              <>
                {" "}
                <Param name={capKey} value={params[capKey]} />
              </>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-fg">A progress criterion.</dt>
          <dd className="text-[13px] leading-relaxed text-muted">
            If two turns produce identical failures the debugger is circling, and another
            pass costs a round without buying information. That is a statement about the
            content of two runs, which a topology cannot express, so it lives in the
            card.{" "}
            {params.stop_on_repeated_evidence === undefined ? (
              <>Read the debugger&rsquo;s prose in pane 4 and make sure it is there.</>
            ) : (
              <Param
                name="stop_on_repeated_evidence"
                value={params.stop_on_repeated_evidence}
              />
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-[13px] text-fg">An escalation path.</dt>
          <dd className="text-[13px] leading-relaxed text-muted">
            A run that spends its cap has to do something other than fail where it stands.
            This one ends and hands back the evidence it gathered, so whoever filed the
            request can decide whether the plan was wrong.{" "}
            {params.on_cap_exhausted !== undefined && (
              <Param name="on_cap_exhausted" value={params.on_cap_exhausted} />
            )}{" "}
            An edge back to the planner is the other answer, and it costs something: it
            would take the planner&rsquo;s incoming degree above zero and move the
            run&rsquo;s entry point onto the builder.
          </dd>
        </div>
      </dl>
    </>
  );
}
