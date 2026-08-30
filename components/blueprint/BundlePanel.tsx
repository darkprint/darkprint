"use client";

import { useState } from "react";
import Link from "next/link";
import type { Diagnostic } from "@/lib/core";
import { shortDigest, summarize } from "@/lib/core";
import { cx } from "@/lib/format";
import { DiagnosticList } from "@/components/ui/DiagnosticList";
import { SEVERITY_META, severityCount } from "@/components/ui/severity";

/** One drawn node joined to the card version it instantiates. */
export interface BundleNode {
  /** DOT node id — the instance in this graph. */
  nodeId: string;
  /** The card's name, as printed on the schematic. */
  label: string;
  /** Card id, without the version — what `/nodes/<id>` is keyed on. */
  cardId: string;
  version: string;
}

/**
 * What this blueprint actually is on disk: a digest over the DOT source and the exact
 * card versions it pins. §4 makes that digest the bundle's identity, so it is the first
 * thing shown and the one thing worth copying.
 *
 * A client component only for the copy button; everything it renders is plain data.
 */
export function BundlePanel({
  digest,
  scoredOntologyVersion,
  nodes,
  pinnedCards,
  diagnostics,
  explainedNotes = [],
  className,
}: {
  /** Full "sha256:…" bundle digest. */
  digest: string;
  /**
   * The vocabulary version the two computed scores were actually produced under —
   * `AutonomyResult.ontologyVersion`, which is read off the view the bundle was
   * resolved against.
   *
   * Doc 3 §8: "La scheda deve indicare con quale versione dell'ontologia un punteggio
   * è stato calcolato, altrimenti due valutazioni non sono confrontabili." Tuning a
   * weight is only a PATCH of the ontology and still moves every score in the archive,
   * so a number without its version is not comparable with anything. That is why this
   * row survives a change that took every other ontology version off this page.
   *
   * There used to be a second row beside it, `ontologyVersion`, the version the MANIFEST
   * declared, with a triangle and a paragraph for the case where the two disagreed. A
   * manifest declares no vocabulary version now, and the disagreement it reported was
   * between two hand-maintained copies of one number rather than between two readings of
   * this blueprint. What is left is the one figure that is a fact about the score.
   */
  scoredOntologyVersion: string;
  nodes: readonly BundleNode[];
  /** Distinct card refs pinned — lower than the node count when a card is reused. */
  pinnedCards: number;
  /**
   * Non-error notes the engine left on this bundle that no other surface renders.
   *
   * PROJECT.md §3.1: the criteria notes are not in here. They are printed in full,
   * message and hint alike, inside the explainability panel's criteria block, and
   * printing them again three inches away was one diagnostic making one point twice.
   * The page splits them; `explainedNotes` is how many went the other way.
   */
  diagnostics: readonly Diagnostic[];
  /**
   * The non-error notes the explainability panel renders instead of this list.
   * Stated rather than dropped: a bundle whose only note went there must not read as a
   * bundle the validator had nothing to say about.
   *
   * The notes themselves and not a count, because the count alone loses the severity.
   * `DiagnosticList` prints "Validation notes — 1 warning" over a list it owns, and when
   * PROJECT.md §3.1 routed these notes away this panel replaced that with an aria-hidden
   * amber triangle. The word "warning" was then on none of the nine blueprint pages,
   * where it had been on all nine. `components/ui/severity.ts` records the rule; passing
   * the diagnostics lets this line obey it from the same table, and stay right if a note
   * of another severity is ever routed here.
   */
  explainedNotes?: readonly Diagnostic[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
            Bundle
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
            content-addressed
          </span>
        </div>

        <div className="flex items-center gap-2">
          <code
            className="min-w-0 flex-1 truncate rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg"
            title={digest}
          >
            {shortDigest(digest)}
          </code>
          <button
            type="button"
            onClick={copy}
            aria-label={
              copied
                ? "Bundle digest copied to the clipboard"
                : "Copy the full bundle digest"
            }
            className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
        <p className="mt-2 text-xs leading-snug text-dim">
          Hashed over the DOT source and every card version below. Change one byte of
          either and this is a different bundle.
        </p>

        <dl className="mt-4 flex flex-col divide-y divide-line">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-sm text-muted">Nodes</dt>
            <dd className="font-mono text-sm tabular-nums text-fg">{nodes.length}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-sm text-muted">Pinned cards</dt>
            <dd className="font-mono text-sm tabular-nums text-fg">{pinnedCards}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted">Scores computed under</dt>
            <dd className="font-mono text-sm tabular-nums text-violet">
              v{scoredOntologyVersion}
            </dd>
          </div>
        </dl>

        {/* Doc 3 §8. Weights live in the configuration and retuning one is a PATCH of
            the ontology that still moves every score in the archive, so Autonomy and
            Security only mean something next to the vocabulary that produced them. This
            is the claim the row above cannot make on its own, and it is the reason the
            row is still here. */}
        <p className="mt-2 text-xs leading-snug text-dim">
          Two scores from different ontology versions are not comparable.
        </p>
      </section>

      {/* Warnings are information, not something to tuck away. Measured on the archive as
          it stands: nine bundles, of which eight carry `analysis/criteria-leak-unanchored`
          — the most important check in the system has nothing to anchor on in any of them
          — two of those also carry `analysis/criteria-out-of-band`, and the ninth, the
          starter, carries `analysis/criteria-relayed-through-judge` for doc 2 §5.5's
          repair loop. Zero errors, and not one of these warnings costs a point. So this
          list is normally non-empty and normally the honest reading rather than the
          affirmative one, which is exactly why it renders instead of hiding.

          PROJECT.md §3.1 moved the criteria notes to the one panel that interprets them
          instead of deleting them, which is why the count and the route are stated here.
          The list itself renders whenever it has something to say, and also when nothing
          was routed away, so "no problems found" is only ever printed over a bundle that
          really has none. */}
      {explainedNotes.length > 0 && (
        <p className="panel px-4 py-3 text-xs leading-relaxed text-dim">
          {/* Glyph and word, from `components/ui/severity.ts`. The colour is decoration
              and the triangle alone is not enough: two blocks below, in this same
              sidebar, ▲ is the seeded vote count. */}
          <span className="font-mono" style={{ color: SEVERITY_META.warning.color }} aria-hidden>
            {SEVERITY_META.warning.glyph}{" "}
          </span>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.14em]"
            style={{ color: SEVERITY_META.warning.color }}
          >
            {severityCount(summarize(explainedNotes))}
          </span>
          {explainedNotes.length === 1
            ? ", from the criteria-leak check, is printed under "
            : ", from the criteria-leak check, are printed under "}
          <Link
            href="#security-explained"
            className="text-muted underline-offset-4 hover:text-cyan hover:underline"
          >
            Static risk exposure
          </Link>{" "}
          with the {explainedNotes.length === 1 ? "node" : "nodes"} named. Nothing there
          costs a point.
        </p>
      )}
      {(diagnostics.length > 0 || explainedNotes.length === 0) && (
        <DiagnosticList diagnostics={diagnostics} title="Validation notes" collapsible />
      )}
    </div>
  );
}
