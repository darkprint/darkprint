"use client";

import Link from "next/link";

import type {
  AutonomyContribution,
  AutonomyResult,
  Diagnostic,
  MarkerProvenance,
  PhaseCoverage,
  SecurityFinding,
  SecurityResult,
} from "@/lib/core";
import { HUMAN_PRESENCE_MARK, autonomyStatement, cx } from "@/lib/format";
import {
  criteriaVerdict,
  CRITERIA_UNANCHORED_CODE,
  type CriteriaState,
} from "@/lib/criteria-state";
import { More } from "@/components/ui/More";
import { SEVERITY_META } from "@/components/ui/severity";

/**
 * The two computed metrics, showing their working. Doc 1 §8.3: an evaluation nobody
 * can audit is a rumour with a number attached, so every node that was counted and
 * every marker that was charged is named here, next to the sentence the engine wrote
 * for it.
 *
 * Two rules from the documents shape this file more than any layout choice does.
 *
 * **Doc 2 §1.1 — autonomy is a description, not a grade.** The panel says where the
 * people are. It never says how far the graph falls short of running without them:
 * no number at all, no progress bar, no green tick rewarding a graph with nobody in
 * it, and no red alarm on a node where somebody is. A blueprint with a human gate is
 * a blueprint that has decided where a person acts, and the surface has to read that
 * way or the barrier to publishing that §1.1 exists to remove comes straight back.
 *
 * The same rule covers the two classifications the panel prints. The autonomy class is
 * a name for the shape of the graph, and `isDarkFactory` is a name for one property of
 * that shape: no node in it waits for a person. Both are stated in the panel's plain
 * chrome, and the dark factory line is written so the graph beside it that keeps a gate
 * reads as a design and not as an attempt that fell short.
 *
 * **Doc 3 §5 — a marker counts once for the blueprint.** The ledger is one row per
 * `SecurityPenalty`, not one per occurrence: "un marcatore presente su più nodi conta
 * una volta sola per il blueprint, ma la spiegazione elenca tutti i nodi che l'hanno
 * fatto scattare". So the row carries the weight and the node list, and the findings
 * underneath carry a node each. The old occurrence count and its repeat curve
 * ("counts for less on repeat", "capped at 2×") described a rule the engine no longer
 * implements, and are gone rather than repointed.
 *
 * Markers are printed as their term ids. Doc 3 §7 lets an author define markers in
 * their own namespace, so any hand-maintained label table here would be both
 * incomplete and free to drift from the vocabulary; the id is what the author wrote
 * in the card and what they can grep for. `lib/core` prints ids in its rationale for
 * the same reason.
 *
 * Client-side only because of the highlight buttons — the analysis itself is computed
 * at build time and arrives as plain data. Every import from the engine is type-only,
 * so none of it is pulled into the browser bundle.
 *
 * **The length pass.** This panel was the longest prose block on a
 * blueprint page, and the complaint it answers is that a reader gives up before the
 * download. Two rules governed the cut and are worth stating, because the obvious way
 * to shorten an explainability panel is the one that breaks it:
 *
 * - Nothing the engine wrote was removed. Every rationale, every diagnostic message and
 *   every hint still renders verbatim. What was compressed is the panel's own framing
 *   around them, and what was deleted is framing that restated a sentence already on the
 *   page. A score with no reasoning is worse than a long explanation.
 * - Reference depth about *how the check works* sits behind `More`, which is a native
 *   `<details>`: still in the prerendered HTML, still keyboard-reachable, still found by
 *   find-in-page. Anything about *this blueprint* stays in the open.
 *
 * The criteria diagnostics used to render twice on the page, here and again in the
 * sidebar's validation notes. They render here only now.
 */

/* --------------------- shared presentation --------------------- */

/** The mono eyebrow the detail page's panels already use, applied to whichever
    element carries the right semantics — a heading here, a plain label there. */
const LABEL = "font-mono text-[11px] uppercase tracking-[0.18em] text-dim";

/**
 * Gravity of a security marker, as a glyph and a colour. The weight is printed on
 * every row, so the glyph is a second reading of the same fact rather than the only
 * one. A marker that carries no weight in this configuration was still found, and it
 * gets its own quiet glyph instead of borrowing the lightest penalty's.
 */
function tier(weight: number): { glyph: string; color: string } {
  if (weight >= 1.5) return { glyph: "✕", color: "var(--color-signal)" };
  if (weight >= 0.75) return { glyph: "▲", color: "var(--color-amber)" };
  if (weight > 0) return { glyph: "•", color: "var(--color-cyan)" };
  return { glyph: "◦", color: "var(--color-dim)" };
}

/**
 * The engine's remediation advice on a row, folded.
 *
 * A finding's *working* is the marker, the node, the weight on the
 * ledger and the sentence the engine wrote about it, and all of that stays in the open.
 * The hint is what to do next, which is 24 to 55 words a reader who is deciding whether
 * to download the bundle does not need and an author fixing it does. Measured on the
 * archive the hints alone ran to between 80 and 235 words a page.
 *
 * A native `<details>` with the same "hint" label the row printed before, so the text is
 * still in the prerendered HTML, still keyboard-reachable and still found by
 * find-in-page. It is not `More`, only because that component is a block with its own
 * border and this has to sit inline in a row.
 *
 * The pass that introduced the disclosure also collapsed an adjacent repeat of the same
 * hint to the literal "hint as on the row above." That was a defect the moment the hint
 * above it went behind a `<details>`: on `guarded-merge-bot` and `incident-commander` the
 * pointer sat under a closed disclosure and referred to text nothing on screen was
 * showing, a linear screen-reader pass reached a pointer with nothing behind it, and
 * find-in-page for the advice returned one hit where the baseline returned two. Every row
 * carries its own hint again. It costs no visible words, because a closed disclosure is
 * the same one line either way.
 */
function Hint({ text }: { text: string }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-baseline gap-1.5 font-mono text-xs text-dim transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <span
          className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
          aria-hidden
        >
          ▸
        </span>
        hint
      </summary>
      <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
    </details>
  );
}

/**
 * The severity the engine gave a diagnostic, as a word.
 *
 * `components/ui/severity.ts` records why this is not optional: the glyph and the word
 * both carry the meaning, and the colour is decoration. The length pass routed the
 * criteria notes out of the sidebar's `DiagnosticList` and into this panel, and the
 * replacement rows printed an `aria-hidden` glyph alone — so the word "warning", which
 * was on all nine blueprint pages, was on none of them. A screen-reader user got no
 * severity, and the same ▲ meant "warning" here and "votes" in the panel below.
 *
 * The glyph beside it stays free to say something else. On these rows it carries the
 * *kind* of note — amber ▲ for a channel worth acting on, dim ◌ for a limit on what was
 * looked at — which is a distinction the severity does not make. Two readings, both
 * written down.
 */
function SeverityWord({ severity }: { severity: Diagnostic["severity"] }) {
  const meta = SEVERITY_META[severity];
  return (
    <span
      className="font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{ color: meta.color }}
    >
      {meta.word}
    </span>
  );
}

/** The mono caption under each panel: the engine's own arithmetic, verbatim. */
function Rationale({ text }: { text: string }) {
  return (
    <p className="rounded border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-dim">
      {text}
    </p>
  );
}

/**
 * A node name that lights the node up in the schematic. A real button with a real
 * name, so it is reachable by keyboard and readable by a screen reader; the ring it
 * toggles is announced by the live region the canvas owns.
 */
function NodeButton({
  nodeId,
  name,
  active,
  onToggle,
}: {
  nodeId: string;
  name: string;
  active: boolean;
  onToggle: (nodeId: string | undefined) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(active ? undefined : nodeId)}
      aria-pressed={active}
      aria-label={
        active
          ? `Clear the schematic highlight on ${name}, node ${nodeId}`
          : `Highlight ${name}, node ${nodeId}, in the schematic`
      }
      className={cx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 font-mono text-[11px] transition-colors",
        active
          ? "border-cyan bg-cyan/10 text-cyan"
          : "border-line bg-surface-2 text-fg hover:border-line-bright hover:text-cyan",
      )}
    >
      <span aria-hidden className={active ? "text-cyan" : "text-dim"}>
        {active ? "◎" : "◌"}
      </span>
      {name}
      <span className="text-dim">{nodeId}</span>
    </button>
  );
}

/* --------------------- autonomy --------------------- */

/**
 * The three groups doc 3 §6 actually produces, and the reason this is not a
 * subtraction. `totalNodes − autonomousNodes` is **not** the number of nodes with a
 * person in them: a node whose card is missing has no `type` to test, so it is in
 * neither category, and counting it as staffed would draw an intervention marker
 * where nobody is.
 */
const AUTONOMY_GROUP = {
  unattended: {
    glyph: "▸",
    word: "run unattended",
    color: "var(--color-cyan)",
  },
  staffed: {
    glyph: HUMAN_PRESENCE_MARK.glyph,
    word: "a person acts",
    // Violet, unlike the signal pink the schematic paints a gate in. Doc 2 §1.1: the
    // indicator says where the people are, and an alarm colour on those rows is the
    // evaluative reading the principle rules out. Taken from the shared constant rather
    // than restated, because this comment is the rule and four other surfaces broke it
    // while it sat here.
    color: HUMAN_PRESENCE_MARK.color,
  },
  undescribed: {
    glyph: "▲",
    word: "no card in the bundle",
    // A broken card pointer is a genuine defect of the upload — `bundle/missing-card`
    // already reports it — so amber here is a statement about the bundle, not about
    // the design decision the level describes.
    color: "var(--color-amber)",
  },
} as const;

/**
 * Why this node counts as one where a person acts, in the shortest true form.
 *
 * One case, and a `switch` rather than an `if` on purpose: `HumanReason` used to have a
 * second member for a card that set `requires_human` on a type that said nothing about
 * people, and that field is gone. A `switch` over the union is what makes the compiler
 * name this function on the day somebody adds a third way to be staffed.
 */
function reasonLabel(contribution: AutonomyContribution): string | undefined {
  switch (contribution.reason) {
    case "human-in-the-loop-type":
      return `type ⊂ ${contribution.term ?? "human-in-the-loop"}`;
    default:
      return undefined;
  }
}

function Tally({
  glyph,
  word,
  count,
  color,
}: {
  glyph: string;
  word: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-2 rounded border border-line bg-surface-2 px-3 py-2">
      <dt
        className="flex min-w-0 flex-1 items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.14em]"
        style={{ color }}
      >
        <span aria-hidden>{glyph}</span>
        <span className="min-w-0">{word}</span>
      </dt>
      <dd className="font-mono text-sm tabular-nums text-fg">{count}</dd>
    </div>
  );
}

function ContributionRow({
  contribution,
  glyph,
  word,
  color,
  highlighted,
  onHighlight,
}: {
  contribution: AutonomyContribution;
  glyph: string;
  word: string;
  color: string;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  const reason = reasonLabel(contribution);
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 shrink-0 font-mono text-xs leading-5"
        style={{ color }}
        aria-hidden
      >
        {glyph}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color }}
          >
            {word}
          </span>
          {reason !== undefined && (
            <code className="font-mono text-[11px] text-dim">{reason}</code>
          )}
          {contribution.ref !== "" && (
            <code className="font-mono text-[11px] text-dim">{contribution.ref}</code>
          )}
        </div>
        <p className="text-sm leading-relaxed text-fg">{contribution.explanation}</p>
        <div className="pt-0.5">
          <NodeButton
            nodeId={contribution.nodeId}
            name={contribution.name}
            active={contribution.nodeId === highlighted}
            onToggle={onHighlight}
          />
        </div>
      </div>
    </li>
  );
}

function AutonomyPanel({
  autonomy,
  phaseCoverage,
  highlighted,
  onHighlight,
}: {
  autonomy: AutonomyResult;
  phaseCoverage: PhaseCoverage;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  // Partitioned, never subtracted — see AUTONOMY_GROUP. The three predicates are
  // mutually exclusive and cover every contribution, so the tallies always add up to
  // `autonomy.totalNodes` and `unattended.length` equals `autonomy.autonomousNodes`.
  const staffed = autonomy.contributions.filter((c) => c.requiresHuman);
  const unattended = autonomy.contributions.filter((c) => c.resolved && !c.requiresHuman);
  const undescribed = autonomy.contributions.filter((c) => !c.resolved && !c.requiresHuman);

  /* `open`, not closed.
     ------------------------------------------------------------
     The author: "The autonomy and security boxed should be reorganized making more
     appealing to read and easy. too many click to open. I want something coincise."

     Two panels that both opened closed meant two clicks before a reader saw anything the
     engine had computed, on a page whose whole claim is that the reading can be audited
     rather than trusted. A disclosure is for content a minority wants; the working behind
     the two numbers this page leads with is not that.

     So the polarity flips: the reading is on screen when the page loads and the
     `<details>` becomes a way to fold it away, which costs a click only to the reader who
     has finished with it. The summary row is unchanged and is the concise version,
     carrying the class and the score without opening anything.

     This can only help the honesty ledger: `openText` drops the body of a *closed*
     `<details>`, so every claim held over this component becomes more visible, never
     less. */
  return (
    <details open className="group panel p-5" aria-labelledby="autonomy-explained">
      <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span
            className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          <h3 id="autonomy-explained" className={LABEL}>
            Autonomy, who is in the loop
          </h3>
        </span>
        <span className="font-mono text-[11px] text-dim">
          Autonomy level: {autonomy.label}
        </span>
      </summary>

      {/* The second classification, stated where the counts behind it are on screen.
          Three branches, because `isDarkFactory` is false for two quite different
          reasons and collapsing them would print "a person stands in this graph" over a
          graph where nobody does. Each branch says what this graph is, in one
          sentence; the tallies and the named nodes below carry the rest. */}
      <p className="flex items-start gap-2 rounded border border-line bg-surface-2 px-3 py-2 text-sm leading-relaxed text-muted">
        {autonomy.isDarkFactory ? (
          <>
            <span className="mt-0.5 font-mono text-fg" aria-hidden>
              ◼
            </span>
            <span>
              <span className="text-fg">Classed a dark factory.</span>{" "}
              No node in this graph waits for a person.
            </span>
          </>
        ) : staffed.length > 0 ? (
          <>
            <span
              className={cx("mt-0.5 font-mono", HUMAN_PRESENCE_MARK.className)}
              aria-hidden
            >
              {HUMAN_PRESENCE_MARK.glyph}
            </span>
            <span>
              <span className="text-fg">A person stands in this graph.</span>{" "}
              &ldquo;Dark factory&rdquo; classifies a graph where nobody does. This one
              has {staffed.length === 1 ? "one" : staffed.length}, named below.
            </span>
          </>
        ) : undescribed.length === 0 && autonomy.totalNodes > 0 ? (
          /* Nobody waits, every node has a card, and it is still not a factory: the
             classification asks for the whole lifecycle too. This case did not exist
             before the phase half was added to `isDarkFactory` (2026-08-04), and without
             a branch of its own it fell through to the row below, which told two real
             blueprints that some of their nodes had no card. They all do.

             Worded as scope, not as a gap. Doc 2 §1.1 governs this sentence exactly as it
             governs the autonomy reading: a pattern that covers three phases is a pattern
             about three phases, and the five are what a *factory* is expected to have. */
          <>
            <span className="mt-0.5 font-mono text-muted" aria-hidden>
              ◻
            </span>
            <span>
              <span className="text-fg">Nobody stands in this graph.</span> It is not
              classed a dark factory because that also asks for the whole lifecycle, and
              this one covers {phaseCoverage.covered.length} of the five. No node here
              declares {phaseCoverage.missing.join(" or ")}.
            </span>
          </>
        ) : (
          <>
            <span className="mt-0.5 font-mono text-amber" aria-hidden>
              ▲
            </span>
            <span>
              <span className="text-fg">
                Nothing here classifies this graph either way.
              </span>{" "}
              {autonomy.totalNodes === 0
                ? "This bundle draws no nodes for it to be about."
                : "Some of these nodes have no card in the bundle, so what runs them is unstated."}
            </span>
          </>
        )}
      </p>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Tally
          glyph={AUTONOMY_GROUP.unattended.glyph}
          word={AUTONOMY_GROUP.unattended.word}
          count={unattended.length}
          color={AUTONOMY_GROUP.unattended.color}
        />
        <Tally
          glyph={AUTONOMY_GROUP.staffed.glyph}
          word={AUTONOMY_GROUP.staffed.word}
          count={staffed.length}
          color={AUTONOMY_GROUP.staffed.color}
        />
        <Tally
          glyph={AUTONOMY_GROUP.undescribed.glyph}
          word={AUTONOMY_GROUP.undescribed.word}
          count={undescribed.length}
          // Amber is a claim about the bundle, and with nothing missing there is no
          // claim to make.
          color={
            undescribed.length === 0
              ? "var(--color-dim)"
              : AUTONOMY_GROUP.undescribed.color
          }
        />
      </dl>

      <div className="mt-3">
        {/* The engine's sentence, less the band ordinal it ends on (doc 2 §1.1). The
            fraction and the threshold it is compared against survive, so the panel still
            prints working a reader can check against the published bundle. */}
        <Rationale text={autonomyStatement(autonomy.rationale)} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className={LABEL}>Where a person acts</h4>
          <span className="font-mono text-[11px] text-dim">{staffed.length}</span>
        </div>

        {staffed.length === 0 ? (
          /* Deliberately no tick and no green: doc 2 §1.1 rules out a surface that
             congratulates a graph for having nobody in it.

             And deliberately nothing at all in the ordinary case. "No node in this graph
             hands control to a person" sat here, fifty words under a classification line
             that had just said "No node in this graph waits for a person": one fact,
             twice, in one panel. The heading and its `0` are the answer where the line
             above has already given it, which is exactly when every node resolved and
             none is staffed. The other two cases still need words: an empty graph, and a
             graph the analyzer could not read, where the line above says something else
             entirely. */
          autonomy.totalNodes === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              This graph declares no nodes, so there is nothing here to run and nobody in
              it.
            </p>
          ) : undescribed.length > 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              No node in this graph hands control to a person.
            </p>
          ) : null
        ) : (
          <ul className="divide-y divide-line">
            {staffed.map((c) => (
              <ContributionRow
                key={c.nodeId}
                contribution={c}
                glyph={AUTONOMY_GROUP.staffed.glyph}
                word={AUTONOMY_GROUP.staffed.word}
                color={AUTONOMY_GROUP.staffed.color}
                highlighted={highlighted}
                onHighlight={onHighlight}
              />
            ))}
          </ul>
        )}
      </div>

      {undescribed.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className={LABEL}>No card in the bundle</h4>
            <span className="font-mono text-[11px] text-dim">{undescribed.length}</span>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            No card in the bundle describes these nodes, so nothing states how they run.
            They count in the total the fraction is taken over and belong to neither
            group above.
          </p>
          <ul className="divide-y divide-line">
            {undescribed.map((c) => (
              <ContributionRow
                key={c.nodeId}
                contribution={c}
                glyph={AUTONOMY_GROUP.undescribed.glyph}
                word={AUTONOMY_GROUP.undescribed.word}
                color={AUTONOMY_GROUP.undescribed.color}
                highlighted={highlighted}
                onHighlight={onHighlight}
              />
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

/* --------------------- security --------------------- */

/**
 * Doc 3 §4.1: three markers are derived from the graph whether or not the card says
 * so, and the rest are the author's own declaration. Which of the two established a
 * finding changes what the reader should do about it — edit the card, or edit the
 * graph — so it is stated on every row, as a glyph and a word.
 */
const PROVENANCE_META: Record<
  MarkerProvenance,
  { glyph: string; word: string; color: string }
> = {
  declared: { glyph: "◆", word: "declared", color: "var(--color-violet)" },
  inferred: { glyph: "◇", word: "inferred", color: "var(--color-cyan)" },
};

function FindingRow({
  finding,
  weight,
  nodeNames,
  highlighted,
  onHighlight,
}: {
  finding: SecurityFinding;
  /** The weight of the finding's marker, charged once on the ledger above. */
  weight: number;
  nodeNames: Readonly<Record<string, string>>;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  const { glyph, color } = tier(weight);
  const provenance = PROVENANCE_META[finding.establishedBy];
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className="mt-0.5 shrink-0 font-mono text-xs leading-5"
        style={{ color }}
        aria-hidden
      >
        {glyph}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <code
            className="font-mono text-[11px] break-all"
            style={{ color }}
          >
            {finding.marker}
          </code>
          <span
            className="inline-flex items-baseline gap-1 font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: provenance.color }}
          >
            <span aria-hidden>{provenance.glyph}</span>
            {provenance.word}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-fg">{finding.explanation}</p>
        {finding.hint !== undefined && <Hint text={finding.hint} />}
        <div className="pt-0.5">
          <NodeButton
            nodeId={finding.nodeId}
            name={nodeNames[finding.nodeId] ?? finding.nodeId}
            active={finding.nodeId === highlighted}
            onToggle={onHighlight}
          />
        </div>
      </div>
    </li>
  );
}

/* --------------------- criteria isolation --------------------- */

/**
 * What the analyzer was able to say about the criteria-leak check on this blueprint.
 *
 * The precedence and the derivation live in `lib/criteria-state`, deliberately outside
 * this component and under test: reasoning about the engine's output inline is how this
 * panel came to print "The check ran and found a route" over a bundle where the check had
 * not run at all, while the sidebar printed the engine's own "was not evaluated on this
 * blueprint" three inches away. See that file for the ordering and why.
 *
 * `quiet` is the honest name for the last state, and deliberately not "clean". Two
 * different graphs produce it: one where the check ran end to end and found no path, and
 * one where nothing is being judged at all so the check had no subject. The engine is
 * silent in both, and this panel cannot tell them apart without re-deriving the generator
 * set from the graph — which would be the analysis growing a second, drifting
 * implementation inside a React component. So the copy states both readings instead of
 * picking the flattering one.
 */
const CRITERIA_STATE_META: Record<
  CriteriaState,
  { glyph: string; word: string; color: string; border: string }
> = {
  leak: {
    glyph: "✕",
    word: "leak found",
    color: "var(--color-signal)",
    border: "border-signal/40 bg-signal/5",
  },
  /* Dashed, dim, hollow. Not amber and not signal: an author whose blueprint is in
     this state has not done anything wrong, and an alarm here would send them off to
     "fix" a graph that may well be isolated. Not emerald and not a tick either — that
     is the exact misreading the state exists to prevent. The dashed border is the same
     grammar the phase strip uses for a cell with no node: present, drawn, empty. */
  unanchored: {
    glyph: "◌",
    word: "not evaluated",
    color: "var(--color-dim)",
    border: "border-dashed border-line-bright bg-surface-2",
  },
  /* Amber, like every other warning on the page. The content detector did report
     something; under the shipped configuration a warning is the only thing it is allowed
     to report, and a warning nobody renders is a warning nobody has. */
  suspected: {
    glyph: "▲",
    word: "overlap suspected",
    color: "var(--color-amber)",
    border: "border-amber/40 bg-amber/5",
  },
  /* Dashed like `unanchored`, because it is the same kind of statement: a limit on what
     was looked at, not a judgement on what was found. */
  relayed: {
    glyph: "◌",
    word: "partly traced",
    color: "var(--color-dim)",
    border: "border-dashed border-line-bright bg-surface-2",
  },
  quiet: {
    glyph: "·",
    word: "nothing reported",
    color: "var(--color-dim)",
    border: "border-line bg-surface-2",
  },
};

/**
 * One channel the topology cannot answer for, as a row: a node, the sentence the engine
 * wrote, and the way to go and look at it.
 *
 * Two callers, two glyphs, and the difference is real. Amber ▲ for criteria arriving in
 * `params`, which names a specific key and is a design smell worth acting on. Dim ◌ for
 * a walk that stopped at a judge, which is a limit on what was looked at and not a
 * finding about the node — same grammar as the `unanchored` state. Neither charges
 * anything.
 */
function BlindChannelRow({
  diagnostic,
  nodeNames,
  highlighted,
  onHighlight,
  glyph = "▲",
  tone = "text-amber",
}: {
  diagnostic: Diagnostic;
  nodeNames: Readonly<Record<string, string>>;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
  glyph?: string;
  tone?: string;
}) {
  const nodeId = diagnostic.location?.nodeId;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className={cx("mt-0.5 shrink-0 font-mono text-xs leading-5", tone)} aria-hidden>
        {glyph}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* The engine's own severity and identifier for this note. Both used to be
            printed by the sidebar's validation list, which this panel replaced; neither
            a code a reader can grep the archive for nor the word that says how the
            engine graded it is something the length pass gets to drop. */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <SeverityWord severity={diagnostic.severity} />
          <code className="font-mono text-[11px] break-all text-dim">
            {diagnostic.code}
          </code>
        </div>
        <p className="text-sm leading-relaxed text-fg">{diagnostic.message}</p>
        {diagnostic.hint !== undefined && <Hint text={diagnostic.hint} />}
        {nodeId !== undefined && (
          <div className="pt-0.5">
            <NodeButton
              nodeId={nodeId}
              name={nodeNames[nodeId] ?? nodeId}
              active={nodeId === highlighted}
              onToggle={onHighlight}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Doc 3 §4.1's check, and whether it ran.
 *
 * It sits above the findings list rather than inside it because it is not a finding:
 * two of its three states are the analyzer reporting the limits of what it can see, and
 * neither of them moves the score. That is stated on the block, because a reader who has
 * just read a ledger of weighted penalties will otherwise assume anything printed under
 * "Security" was charged for.
 *
 * When a leak *was* found the block stays short and points down at the finding, which
 * carries the engine's own sentence, the nodes and the hint. Saying it twice on one
 * screen reads as two leaks.
 */
/**
 * One of the three isolation checks, and what it found.
 *
 * `finding === undefined` is the clean case and it is a real answer, not an absence: the
 * check ran and had nothing to report. It gets the emerald tick the rest of the site uses
 * for a figure the engine read, never a colour that would make a clean check look like an
 * achievement or a dirty one like a fault (doc 2 §1.1's register).
 *
 * "Could not be traced" is neither pass nor fail and says so in its own words. The panel
 * above already carries `◌ partly traced` for that state; this row is what makes it
 * specific.
 */
function CriteriaCheck({ label, finding }: { label: string; finding?: string }) {
  const clean = finding === undefined;
  return (
    <li className="flex items-baseline gap-2 text-xs leading-relaxed">
      <span
        aria-hidden
        className={cx("font-mono", clean ? "text-emerald" : "text-amber")}
      >
        {clean ? "✓" : "▲"}
      </span>
      <span className="text-dim">{label}</span>
      <span className={cx("ml-auto shrink-0 font-mono text-[11px]", clean ? "text-emerald" : "text-amber")}>
        {clean ? "nothing found" : finding}
      </span>
    </li>
  );
}

function CriteriaIsolation({
  security,
  nodeNames,
  highlighted,
  onHighlight,
}: {
  security: SecurityResult;
  nodeNames: Readonly<Record<string, string>>;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  const { state, leaks, inferred, unanchored, suspected, relayed, outOfBand } =
    criteriaVerdict(security);
  const meta = CRITERIA_STATE_META[state];

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className={LABEL}>Criteria isolation</h4>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: meta.color }}
        >
          <span aria-hidden>{meta.glyph}</span> {meta.word}
        </span>
      </div>

      {/* The principle stays in the open, because it is what the state
          token beside it means. What the analyzer looks for is reference depth about the
          check rather than about this blueprint, so it sits behind a disclosure: still
          prerendered, still keyboard-reachable, still found by find-in-page. */}
      {/* One sentence, not three. It used to add "Below is what the analyzer concluded,
          including where it could not look", which the three rows underneath now say for
          themselves, each with its own result. */}
      <p className="text-xs leading-relaxed text-dim">
        The work must not see what will judge it.
      </p>

      {/* The three checks with what each one found, in the open.

          This was a `<More summary="What the analyzer looks for">` listing the checks and
          stopping there, so a reader learned what the analyzer hunts for and never which
          of them came back clean. The author: "here you should report those aspect that
          where checked and are ok."

          Each result is read off the verdict rather than restated: `unanchored` means the
          walk could not run, an inferred leak means it found a route, a declared leak is
          the card's own statement, and `suspected` is the content detector. A check with
          nothing against it says so, which is the whole point of showing them. */}
      <ul className="flex flex-col gap-1.5">
        <CriteriaCheck
          label="A path from the criteria to a node feeding a validation node"
          finding={
            unanchored !== undefined
              ? "could not be traced"
              : inferred
                ? "a route was found"
                : undefined
          }
        />
        <CriteriaCheck
          label="A card declaring both the criteria and the artefact its judge reads"
          finding={leaks.length > 0 && !inferred ? "declared on a card" : undefined}
        />
        <CriteriaCheck
          label="The criteria turning up in a generator's own prose"
          finding={
            suspected.length > 0
              ? `${suspected.length} overlap${suspected.length === 1 ? "" : "s"} reported`
              : undefined
          }
        />
      </ul>

      <div className={cx("rounded-md border px-4 py-3", meta.border)}>
        {state === "leak" && (
          <p className="text-sm leading-relaxed text-fg">
            {inferred
              ? "The check ran and found a route."
              : "No route was traced. The marker is here because a card declares it. That is the author’s own statement about the node, not something the analyzer observed."}{" "}
            It is charged once in the ledger above, and the{" "}
            {leaks.length === 1 ? "finding" : `${leaks.length} findings`} below
            {leaks.length === 1 ? " names the node" : " name the nodes"} and what to
            change.
          </p>
        )}

        {/* Eight of the nine bundles land here, and the block ran to
            about 180 words on every one of them. The headline and the fact that nothing
            is charged stay in the open, because those are the two things a reader who
            has just read the ledger needs. The engine's own message and hint, and the
            paragraph about the state of the archive, go behind the disclosure: they name
            the node and the port to type, which is what an author acts on and not what a
            reader is deciding between. Nothing was deleted. A `<details>` keeps all of
            it in the prerendered HTML, and a declared marker is loud enough to stay
            outside it. */}
        {state === "unanchored" && unanchored !== undefined && (
          <div className="flex flex-col gap-2">
            {/* The severity and the code, in the open. Both were printed by the sidebar's
                validation list on all nine pages before §3.1 routed the note here, and
                the replacement printed neither: severity reached the reader as an
                aria-hidden glyph and the code went behind the disclosure below. */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <SeverityWord severity={unanchored.severity} />
              <code className="font-mono text-[11px] break-all text-dim">
                {unanchored.code}
              </code>
            </div>
            <p className="text-sm leading-relaxed text-fg">
              <span className="text-muted">
                Nothing here says this blueprint leaks its acceptance criteria, and
                nothing here says it does not.
              </span>{" "}
              The analyzer had nowhere to start, and nothing is charged for it.{" "}
              {/* The engine's own sharpest clause, promoted out of the hint and into the
                  open. Eight of the nine bundles land in this state, and §3.1's pass put
                  the whole of the engine's text behind the disclosure below, so the one
                  sentence that stops silence reading as a pass went from always-read to
                  never-read-unless-opened on eight pages at once. It is eleven words. It
                  is quoted verbatim from `analysis/criteria-leak-unanchored`'s hint,
                  where `lib/core/analysis/security.test.ts` pins it. */}
              <span className="text-fg">
                The absence of a finding here is silence. It is not a clean verdict.
              </span>
            </p>
            {/* A declared marker has no precondition at all, so it can sit on a bundle
                the check never ran on. It used to outrank this block and hide it; now it
                is stated inside it, as what it is. */}
            {leaks.length > 0 && (
              <p className="text-xs leading-relaxed text-amber">
                {leaks.length === 1 ? "One node declares" : `${leaks.length} nodes declare`}{" "}
                <code className="font-mono">criteria-leak</code> on{" "}
                {leaks.length === 1 ? "its" : "their"} own card, and{" "}
                {leaks.length === 1 ? "is" : "are"} charged for it in the ledger above.
                That is the author&rsquo;s statement, not a route the analyzer
                traced, and the analyzer could not trace one either way here.
              </p>
            )}
            <More summary="What the analyzer reported, and what to change">
              <p className="text-sm leading-relaxed text-muted">{unanchored.message}</p>
              {unanchored.hint !== undefined && (
                <p className="text-xs leading-relaxed text-muted">
                  <span className="font-mono text-dim">hint </span>
                  {unanchored.hint}
                </p>
              )}
              <p className="text-xs leading-relaxed text-dim">
                Most of the registry is in this state today. That is a gap in what the
                graphs declare, not a fault in what they do. The criteria are real, and
                the port that carries them is not typed. The analyzer records that it
                does not know. It does not charge for a leak it never observed.
              </p>
            </More>
          </div>
        )}

        {state === "suspected" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-fg">
              No route through the graph, and{" "}
              {suspected.length === 1 ? "one node" : `${suspected.length} nodes`} whose
              prose overlaps the criteria producer&rsquo;s. The rows below name{" "}
              {suspected.length === 1 ? "it" : "them"}.
            </p>
          </div>
        )}

        {state === "relayed" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-fg">
              No criteria leak was reported, and the check did not see the whole graph.
            </p>
            {/* The limit stated in full, in the open. §3.1's pass shortened this to "the
                rows below name where it stopped, nothing there is charged", which says
                what the score did and not what the silence means. The rest is the
                engine's own clause from `analysis/criteria-relayed-through-judge`, which
                after the pass was readable only inside a closed disclosure. */}
            <p className="text-xs leading-relaxed text-dim">
              The rows below name where it stopped. Nothing there is charged. A channel
              the topology cannot follow is not evidence of a leak. It is not evidence
              of isolation either.
            </p>
          </div>
        )}

        {state === "quiet" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-relaxed text-fg">
              No criteria leak was reported, and nothing stopped the check from looking.
            </p>
            {/* Behind the disclosure, not deleted: `quiet` is silence over two different
                graphs and the panel cannot tell them apart, which is the whole reason
                the state is not called "clean". A reader who wants to know which one
                this is opens it; nobody is misled by leaving it closed, because the
                headline claims no more than the engine said. */}
            <More summary="Two different graphs produce this">
              <p className="text-xs leading-relaxed text-dim">
                One graph has both the criteria producer and the judged node, but no
                path runs between them. In the other, nothing in the graph is being
                judged, so the check had no subject. The lifecycle rows and the schematic
                above say which of the two this is.
              </p>
            </More>
          </div>
        )}
      </div>

      {/* Rendered whatever the headline says, because a warning that only appears when it
          happens to win the state machine is a warning that disappears the moment
          something else fires. The content detector is the one that was invisible
          entirely: under the shipped config `similarityFiresMarker` is false, so this
          warning is the only thing it can ever emit, and nothing consumed it. */}
      {suspected.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
              <span aria-hidden>▲</span> criteria showing up in the prose
            </h5>
            <span className="font-mono text-[11px] text-dim">{suspected.length}</span>
          </div>
          <p className="text-xs leading-relaxed text-dim">
            Reported, never charged. Read both texts before acting on it.
          </p>
          <More summary="Why an overlap is reported and not charged">
            <p className="text-xs leading-relaxed text-dim">
              Doc 1 §3.2: isolation is the absence of the content from the spec, and an
              absent edge is only half of it. The comparison here is a proxy, because the
              acceptance criteria exist only at run time. The comparison actually uses
              the criteria producer&rsquo;s instructions for writing them.
            </p>
          </More>
          <ul className="divide-y divide-line">
            {suspected.map((d, i) => (
              <BlindChannelRow
                key={`${d.location?.nodeId ?? "bundle"}-${i}`}
                diagnostic={d}
                nodeNames={nodeNames}
                highlighted={highlighted}
                onHighlight={onHighlight}
              />
            ))}
          </ul>

        </div>
      )}

      {relayed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
              <span aria-hidden>◌</span> where the trace stopped
            </h5>
            <span className="font-mono text-[11px] text-dim">{relayed.length}</span>
          </div>
          {/* The length pass cut the feedback-against-gaming distinction from here on the
              grounds that the engine writes it into the hint on every row of this list.
              It does, and the same pass folded every hint into a closed disclosure, so
              the distinction left the page: it is the reason the walk stopping here
              matters at all, and a reader who never opens a row now has no idea what the
              channel is dangerous for. Restated in the open, in the panel's own words.
              The engine's version, with the doc's Italian and the iteration cap, stays on
              the row. */}
          <ul className="divide-y divide-line">
            {relayed.map((d, i) => (
              <BlindChannelRow
                key={`${d.location?.nodeId ?? "bundle"}-${i}`}
                diagnostic={d}
                nodeNames={nodeNames}
                highlighted={highlighted}
                onHighlight={onHighlight}
                glyph="◌"
                tone="text-dim"
              />
            ))}
          </ul>

          {/* Under the list, not above it.

              The author asked for this sentence gone: it reads as an explanation of how
              the check works, and this panel is meant to report what the check found.
              They are right about the position and it cannot simply go. It is a ledger
              claim held `open` (`components/site/honesty.test.ts`), and the reason is in
              the entry: the engine writes the same thing into the hint on every row of
              the list above, and every one of those hints is behind a closed disclosure.
              Delete this and the distinction between feedback and gaming leaves the
              visible page entirely, which is exactly the failure the length pass guards against.

              So it moves rather than goes. Above the list it was a preamble a reader had
              to get through before the findings; below it, it is the footnote that says
              why the findings above are worth naming. Removing it outright means removing
              the ledger entry, which is the author's call to make knowingly and not one
              to take inside a layout pass. */}
          <p className="text-xs leading-relaxed text-dim">
            The walk stops at a validation node on purpose. Seeing the evidence of a
            failure you caused is feedback. Seeing the criteria is gaming. The
            analyzer names the channel. It does not decide what crosses it.
          </p>
        </div>
      )}

      {outOfBand.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h5 className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber">
              <span aria-hidden>▲</span> criteria arriving off the graph
            </h5>
            <span className="font-mono text-[11px] text-dim">{outOfBand.length}</span>
          </div>
          <p className="text-xs leading-relaxed text-dim">
            These nodes name their acceptance criteria in a parameter instead of
            receiving them along an edge. Isolation is a property of the topology, so the
            check cannot follow that channel. On that channel, the result above says
            nothing either way. Nothing is charged: an unverifiable channel is not
            evidence of a leak.
          </p>
          <ul className="divide-y divide-line">
            {outOfBand.map((d, i) => (
              <BlindChannelRow
                key={`${d.location?.nodeId ?? "bundle"}-${i}`}
                diagnostic={d}
                nodeNames={nodeNames}
                highlighted={highlighted}
                onHighlight={onHighlight}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SecurityPanel({
  security,
  nodeNames,
  highlighted,
  onHighlight,
}: {
  security: SecurityResult;
  nodeNames: Readonly<Record<string, string>>;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  const clean = security.penalties.length === 0;
  // One weight per marker, which is the whole point of doc 3 §5 — the findings below
  // read theirs from here rather than carrying a per-node share of it.
  const weightOf = new Map(security.penalties.map((p) => [p.marker, p.weight]));
  const criteriaUnanchored = security.diagnostics.some(
    (d) => d.code === CRITERIA_UNANCHORED_CODE,
  );

  /* Open by default, for the reason recorded on the autonomy panel above. */
  return (
    <details open className="group panel p-5" aria-labelledby="security-explained">
      <summary className="mb-4 flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span
            className="inline-block shrink-0 text-cyan transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          {/* This id is a link target, so it needs the same offset every other anchor
              target on the site carries (`anchors.test.ts`). */}
          <h3 id="security-explained" className={cx("scroll-mt-24", LABEL)}>
            Static risk exposure, what it gets to touch
          </h3>
        </span>
        <span className="flex flex-col items-end gap-0.5 font-mono text-[11px] text-dim">
          <span>Static risk exposure: {security.raw.toFixed(2)} / 4.00</span>
          <span>risk level {security.level}</span>
        </span>
      </summary>

      {/* The arithmetic used to be restated here: "Four points to start, minus the
          weight of every risk marker present". `/reading-the-radar` describes the whole
          scale, every weight and both cuts, and the author's ruling is that it belongs
          there rather than on each of nine blueprint pages. What this panel is for is
          the ledger underneath, which says what *this* graph was charged.

          The `#weights` fragment came off the href on 2026-09-04. That id is declared by
          `components/spec/ScoringModel.tsx`, and since the author asked the graded page
          off the site no route mounts that component, so the fragment pointed at markup
          nothing renders — the case `components/site/nav.test.ts` fails on. The path
          itself stays and still resolves (308 to `/build`), which is what the sibling
          link in `components/explain/ConceptFigures.tsx` already does with the same
          sentence. */}
      <p className="mb-3 text-sm leading-relaxed text-muted">
        What this graph was charged, and for what.{" "}
        <Link
          href="/reading-the-radar"
          className="text-amber underline decoration-amber/40 underline-offset-4 transition-colors hover:text-amber-bright"
        >
          How a blueprint is graded <span aria-hidden>→</span>
        </Link>
      </p>

      {/* Scrolls sideways on a narrow viewport and holds no focusable cell, so it
          needs a tab stop of its own to be reachable by keyboard (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Static risk exposure ledger, scrollable"
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[19rem] font-mono text-[12px]">
          {/* Names the table. The charged-once rule was restated here and is in the
              paragraph directly above, which a screen reader reaches first; the nodes
              column carries the rest of what this used to spell out. */}
          <caption className="sr-only">
            Static risk exposure ledger
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th
                scope="col"
                className="pb-2 font-normal uppercase tracking-[0.14em] text-[11px] text-dim"
              >
                Risk marker
              </th>
              <th
                scope="col"
                className="pb-2 pl-3 text-right font-normal uppercase tracking-[0.14em] text-[11px] text-dim"
              >
                Nodes
              </th>
              <th
                scope="col"
                className="pb-2 pl-3 text-right font-normal uppercase tracking-[0.14em] text-[11px] text-dim"
              >
                Points
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <th scope="row" className="py-2 text-left font-normal text-muted">
                Clean start
              </th>
              <td className="py-2 pl-3 text-right text-dim"><span className="sr-only">not applicable</span></td>
              <td className="py-2 pl-3 text-right tabular-nums text-fg">4.00</td>
            </tr>
            {security.penalties.map((p) => {
              const { glyph, color } = tier(p.weight);
              return (
                <tr key={p.marker}>
                  <th scope="row" className="py-2 text-left font-normal text-fg">
                    <span className="mr-1.5" style={{ color }} aria-hidden>
                      {glyph}
                    </span>
                    <span className="break-all">{p.marker}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-dim">
                      {p.nodeIds.join(", ")}
                    </span>
                  </th>
                  <td className="py-2 pl-3 text-right align-top tabular-nums text-dim">
                    {p.nodeIds.length}
                  </td>
                  <td
                    className={cx(
                      "py-2 pl-3 text-right align-top tabular-nums",
                      p.weight === 0 ? "text-dim" : "text-amber",
                    )}
                  >
                    {p.weight === 0 ? "0.00" : `−${p.weight.toFixed(2)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-bright">
              <th scope="row" className="pt-2 text-left font-normal text-muted">
                Raw total
              </th>
              <td className="pt-2 pl-3 text-right text-dim"><span className="sr-only">not applicable</span></td>
              <td className="pt-2 pl-3 text-right tabular-nums text-fg">
                {security.raw.toFixed(2)}
              </td>
            </tr>
            {/* The raw total is unclamped, so the level is the second half of the
                arithmetic and not a restatement of the first. */}
            <tr>
              <th scope="row" className="pt-1 text-left font-normal text-muted">
                Static risk exposure band
              </th>
              <td className="pt-1 pl-3 text-right text-dim"><span className="sr-only">not applicable</span></td>
              <td className="pt-1 pl-3 text-right tabular-nums text-fg">
                {security.level}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3">
        <Rationale text={security.rationale} />
      </div>

      <CriteriaIsolation
        security={security}
        nodeNames={nodeNames}
        highlighted={highlighted}
        onHighlight={onHighlight}
      />

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className={LABEL}>Findings</h4>
          <span className="font-mono text-[11px] text-dim">
            {security.findings.length}
          </span>
        </div>

        {clean ? (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            {/* The tick is for "no marker fired", which is exactly what it used to
                claim on its own. With the criteria check unanchored that reading is
                too strong: one of the three inferred markers never got to look, so the
                sentence says so and points up at the block that explains it. Without
                the clause, the most important check in the system would be reported as
                a pass by the paragraph directly under it. */}
            <span className="mt-0.5 font-mono text-emerald" aria-hidden>
              ✓
            </span>
            <span>
              Nothing fired. No card in this bundle declares a risk marker and the
              analyzer derived none from the graph, so the score keeps all four points.
              {criteriaUnanchored && (
                <>
                  {" "}
                  <span className="text-dim">
                    One of the derivations did not run. The criteria-leak check
                    above found nothing to anchor on, so its silence is not a result.
                  </span>
                </>
              )}
            </span>
          </p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-dim">
              One row per node that fired a marker.{" "}
              <span
                className="font-mono uppercase tracking-[0.12em]"
                style={{ color: PROVENANCE_META.declared.color }}
              >
                <span aria-hidden>{PROVENANCE_META.declared.glyph}</span>{" "}
                {PROVENANCE_META.declared.word}
              </span>{" "}
              the node&rsquo;s own card lists it.{" "}
              <span
                className="font-mono uppercase tracking-[0.12em]"
                style={{ color: PROVENANCE_META.inferred.color }}
              >
                <span aria-hidden>{PROVENANCE_META.inferred.glyph}</span>{" "}
                {PROVENANCE_META.inferred.word}
              </span>{" "}
              the analyzer read it off the graph. It does this for unbounded loops,
              unvalidated external access and criteria leaks, whether or not the card
              mentions them.
            </p>
            <ul className="divide-y divide-line">
              {security.findings.map((finding) => (
                <FindingRow
                  key={`${finding.marker} ${finding.nodeId}`}
                  finding={finding}
                  weight={weightOf.get(finding.marker) ?? 0}
                  nodeNames={nodeNames}
                  highlighted={highlighted}
                  onHighlight={onHighlight}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}

/* --------------------- the section --------------------- */

export function Explainability({
  autonomy,
  security,
  phaseCoverage,
  nodeNames,
  highlighted,
  onHighlight,
  className,
}: {
  autonomy: AutonomyResult;
  security: SecurityResult;
  /** Read only to say why an unattended graph is not classed a dark factory. */
  phaseCoverage: PhaseCoverage;
  /** DOT node id → the name the schematic prints on it. */
  nodeNames: Readonly<Record<string, string>>;
  /** The node currently ringed in the schematic, if any. */
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="explainability-heading"
      className={cx("flex flex-col", className)}
    >
      {/* `scroll-mt-24`, like every other in-page anchor on the site. The scorecard in the
          sidebar links here by id, and `components/site/SiteHeader.tsx` is `sticky top-0`
          over a 4rem row, so without the offset the heading a reader is sent to lands
          under the chrome. */}
      <h2
        id="explainability-heading"
        className="scroll-mt-24 font-display text-xl font-semibold text-fg"
      >
        Autonomy and static risk
      </h2>

      <div className="mt-5 flex flex-col gap-4">
        <AutonomyPanel
          autonomy={autonomy}
          phaseCoverage={phaseCoverage}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
        <SecurityPanel
          security={security}
          nodeNames={nodeNames}
          highlighted={highlighted}
          onHighlight={onHighlight}
        />
      </div>
    </section>
  );
}
