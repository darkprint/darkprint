"use client";

import { useState } from "react";
import Link from "next/link";
import type { Diagnostic } from "@/lib/core";
import { shortDigest } from "@/lib/core";
import { cx } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { DiagnosticList } from "@/components/ui/DiagnosticList";

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
 * thing shown and the one thing worth copying — and every node under it is a link back
 * to the card it came from.
 *
 * A client component only for the copy button; everything it renders is plain data.
 */
export function BundlePanel({
  digest,
  ontologyVersion,
  scoredOntologyVersion,
  nodes,
  pinnedCards,
  diagnostics,
  className,
}: {
  /** Full "sha256:…" bundle digest. */
  digest: string;
  /** The vocabulary version the manifest is written against. */
  ontologyVersion: string;
  /**
   * The vocabulary version the two computed scores were actually produced under —
   * `AutonomyResult.ontologyVersion`, which is read off the view the bundle was
   * resolved against rather than off the manifest.
   *
   * Doc 3 §8: "La scheda deve indicare con quale versione dell'ontologia un punteggio
   * è stato calcolato, altrimenti due valutazioni non sono confrontabili." Tuning a
   * weight is only a PATCH of the ontology and still moves every score in the archive,
   * so a number without its version is not comparable with anything.
   *
   * Shown next to the manifest's declaration rather than instead of it, because the
   * two answer different questions and are allowed to disagree: the manifest says what
   * the author wrote the bundle against, this says what the engine queried.
   */
  scoredOntologyVersion: string;
  nodes: readonly BundleNode[];
  /** Distinct card refs pinned — lower than the node count when a card is reused. */
  pinnedCards: number;
  /** Non-error notes the engine left on this bundle. */
  diagnostics: readonly Diagnostic[];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const versionsAgree = scoredOntologyVersion === ontologyVersion;

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
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
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
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-sm text-muted">Ontology declared</dt>
            <dd className="font-mono text-sm tabular-nums text-violet">
              v{ontologyVersion}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted">Scores computed under</dt>
            <dd
              className={cx(
                "flex items-baseline gap-1.5 font-mono text-sm tabular-nums",
                versionsAgree ? "text-violet" : "text-amber",
              )}
            >
              {/* Glyph and value, never the colour on its own — and the sentence
                  below spells the mismatch out in words. */}
              {!versionsAgree && <span aria-hidden>▲</span>}
              v{scoredOntologyVersion}
            </dd>
          </div>
        </dl>

        {/* Doc 3 §8. Weights live in the configuration and retuning one is a PATCH of
            the ontology that still moves every score in the archive, so Autonomy and
            Security only mean something next to the vocabulary that produced them. */}
        <p className="mt-2 text-xs leading-snug text-dim">
          {versionsAgree
            ? "Autonomy and Security were computed against this vocabulary. Two scores from different ontology versions are not comparable."
            : `The manifest is written against v${ontologyVersion} and the scores were computed against v${scoredOntologyVersion}. Read them against the second, and treat any comparison with a blueprint scored under a different version as a comparison of two different measurements.`}
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
            Node cards
          </span>
          <ul className="flex flex-col divide-y divide-line">
            {nodes.map((node) => (
              <li key={node.nodeId} className="py-2 first:pt-0 last:pb-0">
                <Link
                  href={nodeHref(node.cardId)}
                  className="group flex items-baseline justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-sm text-fg transition-colors group-hover:text-cyan">
                    {node.label}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-dim">
                    {node.version === "" ? "unpinned" : node.version}
                  </span>
                </Link>
                <span className="font-mono text-[10px] text-dim">
                  {node.nodeId} · {node.cardId}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Warnings are information, not something to tuck away. Measured on the archive as
          it stands: nine bundles, of which eight carry `analysis/criteria-leak-unanchored`
          — the most important check in the system has nothing to anchor on in any of them
          — two of those also carry `analysis/criteria-out-of-band`, and the ninth, the
          starter, carries `analysis/criteria-relayed-through-judge` for doc 2 §5.5's
          repair loop. Zero errors, and not one of these warnings costs a point. So this
          list is normally non-empty and normally the honest reading rather than the
          affirmative one, which is exactly why it renders instead of hiding. */}
      <DiagnosticList diagnostics={diagnostics} title="Validation notes" collapsible />
    </div>
  );
}
