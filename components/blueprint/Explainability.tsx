"use client";

import type {
  AutonomyContribution,
  AutonomyResult,
  MarkerProvenance,
  SecurityFinding,
  SecurityResult,
} from "@/lib/core";
import { cx } from "@/lib/format";

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
 * no "N out of 4", no progress bar, no green tick rewarding a graph with nobody in
 * it, and no red alarm on a node where somebody is. A blueprint with a human gate is
 * a blueprint that has decided where a person acts, and the surface has to read that
 * way or the barrier to publishing that §1.1 exists to remove comes straight back.
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
    glyph: "⏸",
    word: "a person acts",
    // Violet, not the signal pink the schematic paints a gate in. Doc 2 §1.1: the
    // indicator says where the people are, and an alarm colour on those rows is the
    // evaluative reading the principle rules out.
    color: "var(--color-violet)",
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

/** Why this node counts as one where a person acts, in the shortest true form. */
function reasonLabel(contribution: AutonomyContribution): string | undefined {
  switch (contribution.reason) {
    case "requires-human-flag":
      return "requires_human: true";
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
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
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
  highlighted,
  onHighlight,
}: {
  autonomy: AutonomyResult;
  highlighted?: string;
  onHighlight: (nodeId: string | undefined) => void;
}) {
  // Partitioned, never subtracted — see AUTONOMY_GROUP. The three predicates are
  // mutually exclusive and cover every contribution, so the tallies always add up to
  // `autonomy.totalNodes` and `unattended.length` equals `autonomy.autonomousNodes`.
  const staffed = autonomy.contributions.filter((c) => c.requiresHuman);
  const unattended = autonomy.contributions.filter((c) => c.resolved && !c.requiresHuman);
  const undescribed = autonomy.contributions.filter((c) => !c.resolved && !c.requiresHuman);

  return (
    <section className="panel p-5" aria-labelledby="autonomy-explained">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 id="autonomy-explained" className={LABEL}>
          Autonomy — who is in the loop
        </h3>
        <span className="font-mono text-[11px] text-dim">
          autonomy level {autonomy.level} · {autonomy.label}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        The level describes the shape of this graph. What the breakdown below says is
        where the people are: which nodes run unattended, which ones a person acts in,
        and which ones the bundle has nothing to say about.
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
        <Rationale text={autonomy.rationale} />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className={LABEL}>Where a person acts</h4>
          <span className="font-mono text-[11px] text-dim">{staffed.length}</span>
        </div>

        {staffed.length === 0 ? (
          // Deliberately no tick and no green: doc 2 §1.1 rules out a surface that
          // congratulates a graph for having nobody in it.
          <p className="text-sm leading-relaxed text-muted">
            {autonomy.totalNodes === 0
              ? "This graph declares no nodes, so there is nothing here to run and nobody in it."
              : "No node in this graph hands control to a person."}
          </p>
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
            The graph draws these nodes and no card in the bundle describes them.
            Nothing states how they run, so they count in the total the fraction is
            taken over while belonging to neither group above.
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
    </section>
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
            className="inline-flex items-baseline gap-1 font-mono text-[10px] uppercase tracking-[0.14em]"
            style={{ color: provenance.color }}
          >
            <span aria-hidden>{provenance.glyph}</span>
            {provenance.word}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-fg">{finding.explanation}</p>
        {finding.hint !== undefined && (
          <p className="text-xs leading-relaxed text-muted">
            <span className="font-mono text-dim">hint </span>
            {finding.hint}
          </p>
        )}
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

  return (
    <section className="panel p-5" aria-labelledby="security-explained">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 id="security-explained" className={LABEL}>
          Security — what it gets to touch
        </h3>
        <span className="font-mono text-[11px] text-dim">
          security level {security.level}
        </span>
      </div>

      <p className="mb-3 text-sm leading-relaxed text-muted">
        The score starts at four and every risk marker present subtracts its weight.
        A marker carried by several nodes is charged once for the blueprint, and the
        nodes that fired it are all named.
      </p>

      {/* Scrolls sideways on a narrow viewport and holds no focusable cell, so it
          needs a tab stop of its own to be reachable by keyboard (WCAG 2.1.1). */}
      <div
        tabIndex={0}
        role="group"
        aria-label="Security ledger — scrollable"
        className="overflow-x-auto"
      >
        <table className="w-full min-w-[19rem] font-mono text-[12px]">
          <caption className="sr-only">
            Security ledger: four points to start, minus one row for every risk marker
            present in this blueprint. Each marker is charged once however many nodes
            carry it, and the nodes column says how many fired it.
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th
                scope="col"
                className="pb-2 font-normal uppercase tracking-[0.14em] text-[10px] text-dim"
              >
                Risk marker
              </th>
              <th
                scope="col"
                className="pb-2 pl-3 text-right font-normal uppercase tracking-[0.14em] text-[10px] text-dim"
              >
                Nodes
              </th>
              <th
                scope="col"
                className="pb-2 pl-3 text-right font-normal uppercase tracking-[0.14em] text-[10px] text-dim"
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
              <td className="py-2 pl-3 text-right text-dim">—</td>
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
                    <span className="mt-0.5 block text-[10px] leading-snug text-dim">
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
              <td className="pt-2 pl-3 text-right text-dim">—</td>
              <td className="pt-2 pl-3 text-right tabular-nums text-fg">
                {security.raw.toFixed(2)}
              </td>
            </tr>
            {/* The raw total is unclamped, so the level is the second half of the
                arithmetic and not a restatement of the first. */}
            <tr>
              <th scope="row" className="pt-1 text-left font-normal text-muted">
                Security level
              </th>
              <td className="pt-1 pl-3 text-right text-dim">—</td>
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

      <div className="mt-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className={LABEL}>Findings</h4>
          <span className="font-mono text-[11px] text-dim">
            {security.findings.length}
          </span>
        </div>

        {clean ? (
          <p className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            <span className="mt-0.5 font-mono text-emerald" aria-hidden>
              ✓
            </span>
            <span>
              Nothing fired. No card in this bundle declares a risk marker and the
              analyzer derived none from the graph, so the four points the score starts
              with are the four it keeps.
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
              means the node&rsquo;s own card lists the marker.{" "}
              <span
                className="font-mono uppercase tracking-[0.12em]"
                style={{ color: PROVENANCE_META.inferred.color }}
              >
                <span aria-hidden>{PROVENANCE_META.inferred.glyph}</span>{" "}
                {PROVENANCE_META.inferred.word}
              </span>{" "}
              means the analyzer read it off the graph, which it does for unbounded
              loops, unvalidated external access and criteria leaks whether or not the
              card mentions them.
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
    </section>
  );
}

/* --------------------- the section --------------------- */

export function Explainability({
  autonomy,
  security,
  nodeNames,
  highlighted,
  onHighlight,
  className,
}: {
  autonomy: AutonomyResult;
  security: SecurityResult;
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
      <h2
        id="explainability-heading"
        className="font-display text-xl font-semibold text-fg"
      >
        How the two computed scores were reached
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
        Autonomy and Security are the two scores the registry computes rather than
        collects. Both are read off the graph above without running it, and both show
        their working: which nodes were counted, which markers were charged, and the
        sentence the engine wrote for each. Select a node name to find it in the
        schematic.
      </p>
      {/* Doc 3 §8: a score that does not name the vocabulary it was computed under is
          not comparable with any other score. Both results carry the same version,
          taken from the view the bundle was resolved against. */}
      <p className="mt-2 font-mono text-[11px] text-dim">
        scored under ontology v{security.ontologyVersion}. Two scores computed under
        different vocabulary versions are not comparable.
      </p>

      <div className="mt-5 flex flex-col gap-4">
        <AutonomyPanel
          autonomy={autonomy}
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
