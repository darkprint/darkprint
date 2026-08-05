"use client";

import type {
  AutonomyResult,
  Diagnostic,
  JsonValue,
  PhaseCoverage,
  ResolvedBlueprint,
  SecurityResult,
} from "@/lib/core";
import { ITERATION_CAP_KEYS } from "@/lib/core";
import type { StarterRunBudget } from "@/lib/starter/variants";
import { autonomyStatement, cx } from "@/lib/format";
/* Moved out of this file when `/what-it-isnt` and the climb needed the same device;
   `components/ui/More.tsx` carries the reasoning. */
import { More } from "@/components/ui/More";
import { LEAK_EDGE, STARTER_NODES } from "./choices";
import { LifecycleStrip } from "./LifecycleStrip";
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

   ── One idea per step, and `More` for the rest ──
   Redesign spec §4.3, on the author's reading of this page: "it's
   way too dense. The user gets bored and starts skipping." A
   skipped page teaches nothing, so the argument each step is
   actually making is the only thing above the panes, and the
   support behind it went into `More`, a plain `<details>`.

   That is a change of what is on screen and not of what is on the
   page. Every sentence is still in the document, still keyboard
   reachable and still findable by find-in-page.

   Five passages left the route outright, and redesign spec §5 is
   the licence for each: the same statement is already on screen
   beside where it stood.

     · doc 1 §8's "what a run costs is reported by whoever runs
       it" — `ScorePanel` carries it and never unmounts;
     · the download step's walk through the folder — `DownloadPanel`
       sits under it and describes every file as it lists it;
     · its second telling of "there is nowhere to save this" — the
       same panel ends on it;
     · its second printing of `attractor run factory.dot` — the
       panel prints it with a copy button;
     · the rail caption's third telling of "nothing is executed" —
       the panel above it and the page header both say so.

   Nothing else was deleted. Where a sentence reads shorter here it
   was rewritten, and the claims it carried are asserted against
   the live page rather than trusted.

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
  | "vocabulary"
  | "output"
  | "switch"
  | "approval"
  | "loop"
  | "download";

/** Which of the three readings a step is talking about, so the pane opens on it. */
export type StepReading = "skeleton" | "dot" | "card" | "vocabulary";

export interface StepDef {
  id: StepId;
  /** Short label for the step bar. */
  nav: string;
  title: string;
  /** The node this step's control hangs on, when it has one. */
  choiceNode?: string;
  /**
   * Which reading pane opens with the step.
   *
   * §4.3 asks for a clear primary among the four panes, so pane 1 is always drawn and
   * panes 2 to 4 share one frame. A step that argues about a document has to be able to
   * put that document in front of the reader, and this is how it says which.
   */
  reading?: StepReading;
}

export const STEPS: readonly StepDef[] = [
  { id: "whole", nav: "The blueprint", title: "Five nodes, one blueprint", reading: "dot" },
  { id: "node", nav: "One node", title: "One node, four blocks", reading: "skeleton" },
  /* The third component, which this path did not walk.
     ------------------------------------------------------------
     Steps 1 and 2 introduced the graph and the card and then went straight to the
     choices, so the reader made four decisions about files written against a vocabulary
     nobody had shown them. `/what-a-blueprint-is`, the item above this one in the Learn
     menu, teaches three parts; this path taught two. It is third because it is the part
     that only means anything once you have seen a word in the DOT and the same word in a
     card, which is exactly what steps 1 and 2 just did. */
  {
    id: "vocabulary",
    nav: "The vocabulary",
    title: "The words both files use",
    reading: "vocabulary",
  },
  {
    id: "output",
    nav: "What it builds",
    title: "What does your blueprint build?",
    choiceNode: STARTER_NODES.builder,
    reading: "card",
  },
  {
    id: "switch",
    nav: "The absent edge",
    title: "The edge that is not there",
    choiceNode: STARTER_NODES.builder,
    reading: "dot",
  },
  {
    id: "approval",
    nav: "Who ends a run",
    title: "Who decides the work is finished?",
    choiceNode: STARTER_NODES.tester,
    reading: "dot",
  },
  {
    id: "loop",
    nav: "The loop",
    title: "How many turns before it gives up?",
    choiceNode: STARTER_NODES.debugger,
    reading: "card",
  },
  { id: "download", nav: "Take it away", title: "Your blueprint, as files", reading: "dot" },
];

/* --------------------- shared bits --------------------- */

const P = "text-[15px] leading-relaxed text-muted";
const SMALL = "text-[13px] leading-relaxed text-muted";

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
      <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-dim">{title}</h3>
      {children}
    </div>
  );
}

/* --------------------- 1. the whole factory --------------------- */

export function WholeStep({
  coverage,
  nodeNames,
}: {
  coverage?: PhaseCoverage;
  /** Node id -> the name the schematic prints. Absent while the bundle does not resolve. */
  nodeNames?: Readonly<Record<string, string>>;
}) {
  return (
    <>
      {/* Opened on "a dark factory turns a written specification into working software"
          until 2026-08-04. That is the older framing the author moved past: blueprints are
          the object and a dark factory is one badge some of them earn. The first sentence a
          reader meets on the authoring page is the wrong place to teach the exception, and
          on this blueprint it is doubly wrong, because the five phases below are what makes
          this particular one qualify. */}
      <p className={P}>
        A blueprint is a pattern for getting work done by agents, written down as a graph.
        This one turns a written specification into working software, with five nodes, one
        for each phase of that work: planning, implementation, testing, debugging,
        deployment.
      </p>
      {/* The legend the sentence above promises. It names phases; the panes below draw
          node names, and until now a reader had to hold one against the other themselves.
          Read off the blueprint, so it follows a change of choice rather than describing
          the variant that happened to be default. */}
      {coverage !== undefined && nodeNames !== undefined && (
        <LifecycleStrip coverage={coverage} nodeNames={nodeNames} className="my-1" />
      )}
      {/* "Nothing on this page runs." stood here and is gone, on the author's reading:
          "there is no need to specify everytime". It was the second of four tellings on
          this one route. The page header says "Every score is computed in this
          tab...
          Nothing is uploaded." above the step bar, where it never unmounts and a reader
          meets it on arrival, and `DownloadPanel` says the stronger version at step 7,
          beside the download it qualifies: execution happens on your machine and the site
          holds none of your provider keys.

          Doc 2 §0.4 asks for the claim on the surface, not once per screenful. Cutting a
          telling that a reader can see at the same time as the one that survives is not
          the claim going quiet; deleting the last one on a surface would be. */}
      <More summary="How the panes below fit together">
        <p className={SMALL}>
          The drawing comes from the DOT. The DOT pins a card on every node, and the card is
          one of the files you download at the end. Select a node, a line of the DOT or a
          field of the card, and the rest follow.
        </p>
      </More>
    </>
  );
}

/* --------------------- 2. one node --------------------- */

export function NodeStep() {
  return (
    <>
      <p className={P}>
        Here is the <code className="font-mono text-fg">{STARTER_NODES.builder}</code>{" "}and
        the card it pins. Every card has four blocks: identity, behaviour, interfaces, and
        evaluation metadata.
      </p>
      <More summary="What each block carries">
        <p className={SMALL}>
          <span className="text-fg">Identity</span>{" "}is the id the DOT points at.{" "}
          <span className="text-fg">Behaviour</span>{" "}carries{" "}
          <code className="font-mono text-fg">spec</code>, the prose handed to the agent when
          the graph is instantiated. <span className="text-fg">Interfaces</span>{" "}declare what
          arrives and what leaves. <span className="text-fg">Evaluation metadata</span>{" "}is
          read by DarkPrint&rsquo;s static analysis and by nothing at run time.
        </p>
        <p className={SMALL}>
          A card seen on its own is a YAML file with fields in it, which is why the skeleton
          is the reading beside it: it lays the blocks out as slots and fills them from the
          document. A slot the card leaves empty is an answer, so a node that needs no tool
          has said so.
        </p>
      </More>
    </>
  );
}

export function VocabularyStep() {
  return (
    <>
      <p className={P}>
        The graph and the card you have just read are written against the same closed list
        of terms. When the DOT says a node covers{" "}
        <code className="font-mono text-fg">implementation</code>{" "}and the card says the
        same, that is one term in one vocabulary and not two files that happen to agree.
      </p>
      <More summary="Why a closed list, and what it buys">
        <p className={SMALL}>
          A checker can only catch a disagreement between two files if it knows what
          agreement looks like. A free-text field lets two authors write{" "}
          <code className="font-mono text-fg">implementation</code>{" "}and{" "}
          <code className="font-mono text-fg">impl</code>{" "}and leaves nothing able to tell
          that they meant one thing. Every term in the reading beside this one resolves, or
          the bundle does not.
        </p>
        <p className={SMALL}>
          It is also what makes a prohibition enforceable. An entry in{" "}
          <code className="font-mono text-fg">cannot</code>{" "}that names a data type is a
          rule the resolver holds every incoming edge to; an entry naming anything else is
          a sentence addressed to a reader. That is the difference the next four steps turn
          on, and it exists because the name is a term rather than a word.
        </p>
      </More>
    </>
  );
}

/* --------------------- 4. choice 1 --------------------- */

export function OutputStep({ digest }: { digest?: string }) {
  return (
    <>
      <p className={P}>
        Pick what this blueprint produces. The graph does not change and neither computed score
        moves. The prose in every card does, and the prose is what the agent is handed when
        the graph runs.
      </p>
      {digest !== undefined && (
        <p className="font-mono text-[11px] text-dim">
          digest{" "}
          <span className="break-all text-fg">{digest.slice(0, 23)}…</span>
        </p>
      )}
      <More summary="What moves when you choose">
        <p className={SMALL}>
          The builder&rsquo;s <code className="font-mono text-fg">spec</code>{" "}is rewritten,
          the ports change type where the artefact changes kind, and the digest above changes
          with them. This is what makes the download yours rather than the
          registry&rsquo;s example.
        </p>
      </More>
    </>
  );
}

/* --------------------- 4. the demonstration switch --------------------- */

export function SwitchIntro({ on }: { on: boolean }) {
  return (
    <>
      <p className={P}>
        The planner writes a build brief and the acceptance criteria. The brief goes to the
        builder. The criteria go to the tester.
      </p>
      {!on && (
        <p className={P}>
          The switch on the builder writes the missing edge in. Turn it on and read what the
          engine says.
        </p>
      )}
      <More summary="Where the gap shows, on all three readings">
        <p className={SMALL}>
          The graph lists{" "}
          <code className="font-mono text-signal">
            {LEAK_EDGE.source} ⇢ {LEAK_EDGE.target}
          </code>{" "}
          under <span className="text-fg">not drawn</span>. The DOT draws it struck through
          where the statement would have gone. The skeleton hangs the same gap on the
          builder&rsquo;s <code className="font-mono text-fg">spec</code>, because an absent
          edge is isolation only when the content is absent from the prose too.
        </p>
      </More>
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
   *
   * The refusal therefore stays above the fold of this aside and outside the disclosure,
   * ahead of the security reading, which is the order §4.3's density pass had to preserve.
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

      <More summary="The second answer, from the security metric">
        {before !== undefined && after !== undefined && (
          <p className={SMALL}>
            The metric runs on the graph anyway: level{" "}
            <span className="font-mono text-fg">{before.level}</span>{" "}a moment ago, level{" "}
            <span className="font-mono text-signal">{after.level}</span>{" "}now. One author
            wrote a rule about their own node and the graph broke it, and the metric reads
            the topology and charges what it finds there. Both point at the same edge.
          </p>
        )}
        {leak !== undefined && (
          <p className="text-[13px] leading-relaxed text-fg">{leak.explanation}</p>
        )}
        {after !== undefined && <Quote>{after.rationale}</Quote>}
        <p className={SMALL}>
          An agent that can read the acceptance criteria can write work shaped to pass them.
          The suite goes green and the problem is untouched. Isolation is a property of the
          topology, so the analyzer reads it off the graph without running anything.
        </p>
      </More>

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
        Both are complete blueprints and both belong in the gallery. Nothing on DarkPrint
        ranks the two, and the autonomy class records which one you drew.
      </p>
      <More summary="Choosing between them">
        <p className={SMALL}>
          If this blueprint touches something you cannot take back, the approver is the design
          you want. The other class describes a different blueprint. The panel beside you names
          the class for the graph on screen along with the arithmetic behind it, and it
          describes the shape of the graph.
        </p>
      </More>
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
        . It does not go back to the builder. The slider on the debugger caps it.
      </p>
      <More summary="Why the loop stops at the debugger">
        <p className={SMALL}>
          Going back to the builder would regenerate from scratch and oscillate instead of
          converging on the work already done, and it would end the builder&rsquo;s
          isolation from every fact about the failures for the whole run. Either reason
          holds without the other.
        </p>
      </More>
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
      {/* The `<Aside title="What the slider moves">` that stood here is gone. It printed
          the cap arithmetic a third time on a screen that already carried it twice: the
          `CapSlider`'s own three readings sit directly above it inside pane 1, and
          `ScorePanel`'s "The run" prints the same sum and never unmounts. An earlier pass
          had already moved doc 1 §8's cost sentence out of this aside for exactly that
          reason and left the numbers behind.

          Nothing is lost. Every figure it showed is read from `budget`, and both surviving
          tellings read from the same object, so they move together when the slider does.
          The audit of this route marked this block `ornament`, and the verifier confirmed
          all three tellings on one screen at the default choices before it was cut. */}
      {/* Two disclosures where there were four paragraphs and two asides. The cap's effect
          on the two computed levels and its effect on the accumulated leak are one subject
          read twice, so they are folded behind one summary each rather than printed in
          sequence under the arithmetic that is the step's actual argument (§4.3). */}
      <More summary="What the cap does not move">
        <p className={SMALL}>
          Neither computed level moves with it. A cap of 1 and a cap of 10 are both a cap
          {security !== undefined && (
            <>
              , so security stays at level{" "}
              <span className="font-mono text-fg">{security.level}</span>{" "}either way
            </>
          )}
          . What the cap is worth shows up in the three counts beside the slider, and they
          are counts rather than estimates.
        </p>
        {uncapped !== undefined && (
          <>
            <p className={SMALL}>
              Take the cap away entirely and the same analyzer reads level{" "}
              <span className="font-mono text-signal">{uncapped.level}</span>.
            </p>
            <Quote>{uncapped.rationale}</Quote>
          </>
        )}
        <p className={SMALL}>
          A low cap costs convergence: fewer turns, more runs that stop without a green
          build. A high cap costs model calls and widens the accumulated leak. Designing a
          dark factory is a trade, and neither end of the slider is the answer.
        </p>
      </More>

      <More summary="Why the debugger may see the failures when the builder may not see the criteria">
        <p className={SMALL}>
          Seeing the criteria lets an agent write work built to pass them without solving the
          problem. Seeing the evidence of a failure it caused only tells it what broke. The
          first is gaming. The second is feedback. So the debugger receives stack traces,
          failed assertions, and obtained beside expected. It does not receive the criteria
          set. Hand it everything and it starts special-casing again.
        </p>
        <p className={SMALL}>
          Over many turns that distinction wears thin. Each round of error messages reveals
          another slice of the acceptance surface, and a debugger that accumulates them can
          reconstruct a good deal of the criteria without ever being shown them. The cap
          bounds the runtime and it bounds that leak.
          {budget !== undefined && (
            <>
              {" "}
              At the position the slider is in, the debugger sees at most{" "}
              <span className="font-mono text-fg">{budget.debuggerRunsAtMost}</span>{" "}
              {budget.debuggerRunsAtMost === 1 ? "round" : "rounds"} of it. A round of
              evidence is a run of the debugger, which is why that is the same number as the
              debugger runs above.
            </>
          )}
        </p>
      </More>

      <More summary="What a healthy loop needs">
        <p className={SMALL}>
          Three things. The analyzer can check the first from the graph and has to take the
          other two from the card.
        </p>
        <dl className="flex flex-col gap-3 border-l-2 border-line pl-4">
          <div className="flex flex-col gap-1">
            <dt className="text-[13px] text-fg">An iteration cap.</dt>
            <dd className="text-[13px] leading-relaxed text-muted">
              Without one the cycle has no exit condition, and doc 3 §4.1 charges{" "}
              <code className="font-mono text-[12px]">unbounded-loop</code>{" "}for it. The
              slider writes it into the debugger&rsquo;s card and into{" "}
              <code className="font-mono text-[12px]">max_retries</code>{" "}in the runnable
              DOT.
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
              pass buys nothing. A topology cannot say that about the content of two runs, so
              it lives in the card.{" "}
              {params.stop_on_repeated_evidence === undefined ? (
                <>Read the debugger&rsquo;s prose in the card and make sure it is there.</>
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
              This one ends and hands the evidence back, so whoever filed the request can
              decide whether the plan was wrong.{" "}
              {params.on_cap_exhausted !== undefined && (
                <Param name="on_cap_exhausted" value={params.on_cap_exhausted} />
              )}{" "}
              An edge back to the planner is the other answer, and it costs something: the
              planner&rsquo;s incoming degree goes above zero and the run&rsquo;s entry point
              moves onto the builder.
            </dd>
          </div>
        </dl>
      </More>
    </>
  );
}
