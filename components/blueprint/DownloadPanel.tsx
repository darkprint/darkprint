"use client";

import { useState } from "react";
import { cx } from "@/lib/format";

/** One downloadable card document. */
export interface DownloadCard {
  /** Pinned ref, e.g. "spec-planner@1.0.0". */
  ref: string;
  href: string;
}

/**
 * The bundle, as files a reader can actually take away.
 *
 * Doc 2 §11 item 10: the point of the artefact is that it "deve girare da riga di comando
 * su una macchina utente", so the panel leads with the file Attractor runs and the command
 * that runs it, and everything else sits under them. The site generates these files at
 * build time into `public/bundles/<slug>/` — there is no server to build an archive on
 * request — and the hrefs are handed in already computed, which keeps the engine out of
 * the browser bundle.
 *
 * A client component only for the copy button. Everything it renders is plain data.
 */
export function DownloadPanel({
  headingLevel = "h2",
  factoryHref,
  topologyHref,
  readmeHref,
  agentsHref,
  vocabulary,
  cards,
  className,
}: {
  /**
   * `h3` where the panel sits under a section that already has an `h2`.
   *
   * Defaults to `h2`, so `/blueprints/[slug]` keeps the outline it was approved with
   * (`references/reading.md` lists it as a benchmark). `/build`'s step 7 opts in: it had
   * three sibling `h2`s, which said the page had three equal sections when it has one.
   */
  headingLevel?: "h2" | "h3";
  /** `/bundles/<slug>/factory.dot` — the Attractor-runnable pipeline. */
  factoryHref: string;
  /** `/bundles/<slug>/blueprint.dot` — the topology, card pins intact. */
  topologyHref: string;
  readmeHref: string;
  /**
   * `AGENTS.md`, the half of the folder addressed to whatever adapts the pattern.
   *
   * Optional only so a caller that has not been updated keeps compiling; every bundle
   * carries the file (`lib/content/bundle-export.ts` writes it unconditionally), so a
   * panel rendering without it is offering a reader eight of nine files and saying
   * nothing about the ninth.
   */
  agentsHref?: string;
  /**
   * Doc 3 §7's local terms, when a card in this bundle declares one. Absent for a bundle
   * written entirely in the curated core, which is most of them.
   */
  vocabulary?: { href: string; termIds: readonly string[] };
  /** Every card the graph pins, deduplicated and sorted. */
  cards: readonly DownloadCard[];
  className?: string;
}) {
  const command = "attractor run factory.dot";
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  const Heading = headingLevel;

  return (
    <section
      id="download"
      aria-labelledby="download-heading"
      className={cx("panel scroll-mt-24 p-5", className)}
    >
      <div className="mb-3 flex items-center justify-between">
        {/* See `headingLevel`. `id="download-heading"` and the `aria-labelledby` that
            points at it are unchanged, and so is `id="download"` on the section, which is
            the bookmark `ForkAction` targets. */}
        <Heading
          id="download-heading"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim"
        >
          Download
        </Heading>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
          runs on your machine
        </span>
      </div>

      {/* The runnable artefact, first and largest. */}
      <a
        href={factoryHref}
        download="factory.dot"
        className="flex items-center justify-between gap-3 rounded-md border border-line-bright px-3 py-2.5 transition-colors hover:border-cyan"
      >
        <span className="font-mono text-sm text-fg">factory.dot</span>
        <span className="shrink-0 font-mono text-[11px] text-cyan">↓ download</span>
      </a>
      <p className="mt-2 text-xs leading-snug text-dim">
        The pipeline Attractor runs. Every node carries its card&rsquo;s{" "}
        <code className="font-mono text-muted">spec</code> as the prompt its agent
        receives, so this one file is enough to start.
      </p>

      {/* The command. Copyable, because it is the thing a reader retypes wrongly. */}
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={
            copied ? "Run command copied to the clipboard" : "Copy the run command"
          }
          className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-cyan hover:text-cyan"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      {/* Doc 1 §0.1.3, stated where the download happens rather than only in the README. */}
      <p className="mt-2 text-xs leading-snug text-dim">
        Execution happens on your machine. DarkPrint distributes these files and analyses
        them. It runs nothing and holds none of your provider keys.
      </p>

      {/* The other two files. */}
      <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line">
        <li className="py-2.5">
          <a
            href={topologyHref}
            download="blueprint.dot"
            className="group flex items-baseline justify-between gap-2"
          >
            <span className="font-mono text-sm text-fg transition-colors group-hover:text-cyan">
              blueprint.dot
            </span>
            <span className="shrink-0 font-mono text-[11px] text-dim">↓</span>
          </a>
          <p className="text-xs leading-snug text-dim">
            The topology as the registry stores it, with the exact card version pinned on
            each node.
          </p>
        </li>
        {vocabulary !== undefined && (
          <li className="py-2.5">
            <a
              href={vocabulary.href}
              download="extensions.yaml"
              className="group flex items-baseline justify-between gap-2"
            >
              <span className="font-mono text-sm text-fg transition-colors group-hover:text-cyan">
                ontology/extensions.yaml
              </span>
              <span className="shrink-0 font-mono text-[11px] text-dim">↓</span>
            </a>
            <p className="text-xs leading-snug text-dim">
              The local terms these cards declare, and the weights that price them.
              Scoring the bundle without this file leaves{" "}
              <span className="font-mono text-muted">{vocabulary.termIds.join(", ")}</span>{" "}
              resolving against nothing.
            </p>
          </li>
        )}
        <li className="py-2.5">
          <a
            href={readmeHref}
            download="README.md"
            className="group flex items-baseline justify-between gap-2"
          >
            <span className="font-mono text-sm text-fg transition-colors group-hover:text-cyan">
              README.md
            </span>
            <span className="shrink-0 font-mono text-[11px] text-dim">↓</span>
          </a>
          <p className="text-xs leading-snug text-dim">
            What this bundle is, which digest it came from, and how to run it.
          </p>
        </li>
        {/* The ninth file. It shipped in every bundle from the commit that generated it
            and was linked from nowhere: this panel offered four kinds, the step-7
            inventory list was the only place on the site a reader learned it existed, and
            the comment beside that list claimed this panel already downloaded everything.
            A folder with a file nobody is told about is the failure the README's own
            "what is in the folder" table exists to prevent. */}
        {agentsHref !== undefined && agentsHref !== "" && (
          <li className="py-2.5">
            <a
              href={agentsHref}
              download="AGENTS.md"
              className="group flex items-baseline justify-between gap-2"
            >
              <span className="font-mono text-sm text-fg transition-colors group-hover:text-cyan">
                AGENTS.md
              </span>
              <span className="shrink-0 font-mono text-[11px] text-dim">↓</span>
            </a>
            <p className="text-xs leading-snug text-dim">
              The same folder addressed to an agent adapting it: what must never be
              connected, what each node takes, and how the graph is wired.
            </p>
          </li>
        )}
      </ul>

      {/* The cards, folded away: the panel above already lists the same names, and this
          is the one place they are files rather than links into the node library. */}
      {cards.length > 0 && (
        <details className="group mt-3 border-t border-line pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-xs text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
            <span
              className="inline-block text-cyan transition-transform group-open:rotate-90"
              aria-hidden
            >
              ▸
            </span>
            Node cards
            <span className="text-dim">
              {cards.length} YAML file{cards.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {cards.map((card) => (
              <li key={card.ref} className="py-1.5 first:pt-0 last:pb-0">
                <a
                  href={card.href}
                  download={`${card.ref}.yaml`}
                  className="group/card flex items-baseline justify-between gap-2"
                >
                  <span className="min-w-0 truncate font-mono text-[11px] text-muted transition-colors group-hover/card:text-cyan">
                    {card.ref}.yaml
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-dim">↓</span>
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Doc 2 §6 is Fase 4. Saying so here costs one sentence and stops the download
          from implying an account flow that does not exist. */}
      <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-dim">
        There is nowhere to save this yet. Accounts and publishing are designed and not
        built, so the download is the whole of it.
      </p>
    </section>
  );
}
