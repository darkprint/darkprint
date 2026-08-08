import { cx } from "@/lib/format";
import { CloneMenu } from "@/components/blueprint/CloneMenu";

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
 * No longer a client component. It was one only for its inline copy button; that block is
 * now `components/ui/CopyButton.tsx`, which carries the `"use client"` itself, so every
 * filename, href and sentence in this panel is rendered on the server and none of it waits
 * on script.
 */
export function DownloadPanel({
  headingLevel = "h2",
  topologyHref,
  readmeHref,
  agentsHref,
  vocabulary,
  cards,
  clone,
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
  /* `factoryHref` was here and is gone with the block that drew it. The file is still
     exported into every bundle and `/build` still hands it over; this panel simply does not
     teach a build product. Callers passing it now fail to typecheck, which is the point:
     the prop leaving is how the removal reaches them. */
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
  /**
   * The one command that fetches this whole folder in one go, and the `darkprint clone`
   * line that would replace it if that CLI existed. Both are built by
   * `lib/content/bundle-export.ts` from the same file list the generator wrote, so the
   * command and the folder on disk cannot disagree.
   *
   * Optional, because one caller correctly has nothing to pass: `/build`'s step 7 renders
   * a bundle assembled in the browser from the reader's own choices, which was never
   * written under `public/bundles/` and therefore has no URL to fetch it from. A command
   * there would 404 on every line.
   */
  clone?: { command: string; cliCommand: string };
  className?: string;
}) {

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

      {/* `factory.dot` led this panel — the file, a sentence about Attractor, the
          `attractor run factory.dot` command with its copy button, and the line about
          execution happening on your machine — and the author asked the whole block out on
          2026-08-08.

          It is a BUILD PRODUCT, and the same instruction took it off
          `/what-a-blueprint-is`'s list of what a bundle is for the same reason: a compiled
          export written by the exporter is not one of the things somebody authors. A panel
          whose largest element was the one file in the folder nobody writes led with the
          output of the process instead of with the process's subject.

          `blueprint.dot` is first now, which is also the order the bundle's own README and
          `AGENTS.md` describe the folder in.

          WHAT WENT WITH IT, and what did not. The sentence "Execution happens on your
          machine … It runs nothing and holds none of your provider keys" was in that block
          and it is doc 1 §0.1.3, pinned by `components/site/honesty.test.ts`. It is re-laid
          below the file list rather than deleted — the claim is about the whole download,
          not about one file in it, and it reads better as the panel's closing statement
          than as a footnote to a command that is gone.

          `factoryHref` stays on the props: the file is still exported, still in every
          bundle, and `/build`'s own step still hands it over. This panel simply stops
          teaching it. */}
      {/* Taking the folder rather than the files one at a time.
          It sits here, after the runnable artefact and its command, and not above them:
          `factory.dot` is first and largest because it is the thing that runs, and a
          462-character curl line above it would demote the one file a reader needs. The
          reading order is now what the panel always meant — here is the file that runs,
          here is how to run it, here is how to take the whole folder in one go, and here
          is each remaining file on its own.

          `variant="plain"`, because this panel already lives behind a
          `<More summary="Download">` on the blueprint page and a floating dropdown inside
          a disclosure is two clicks and a panel inside a panel. The header row carries the
          `menu` variant for the reader who never opens this. */}
      {clone !== undefined && (
        <CloneMenu
          kind="blueprint"
          variant="plain"
          command={clone.command}
          cliCommand={clone.cliCommand}
          className="mt-4"
        />
      )}

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
      {/* Open, not a `<details>`, on the author's instruction: "remove the fact that Node
          cards can be collapsable in this page."

          The cards are half of what a bundle IS — one per node, pinned by version — and
          folding them behind a triangle put the larger half of the folder one click further
          away than `README.md`. The disclosure was there to keep the panel short when it
          also carried the `factory.dot` block above it; that block is gone, so the panel has
          the room it was borrowing. */}
      {cards.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="flex items-center gap-2 font-mono text-xs text-muted">
            Node cards
            <span className="text-dim">
              {cards.length} YAML file{cards.length === 1 ? "" : "s"}
            </span>
          </p>
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
        </div>
      )}

      {/* Doc 1 §0.1.3, moved here with the removal of the `factory.dot` block it used to
          close. `components/site/honesty.test.ts` pins this sentence to this panel. */}
      <p className="mt-4 border-t border-line pt-3 text-xs leading-snug text-dim">
        Execution happens on your machine. DarkPrint distributes these files and analyses
        them. It runs nothing and holds none of your provider keys.
      </p>

      {/* Doc 2 §6's sentence stood here — "There is nowhere to save this yet. Accounts and
          publishing are designed and not built…" — and the author asked it out on
          2026-08-08.

          Nothing on this panel now implies an account flow: there is no save control, no
          sign-in, and no second destination for the files — a reader downloads, and that is
          visibly the whole of it. The refusal is still made where a reader could actually
          expect the opposite, which is `/upload`'s dropzone and `/skill`'s handover, both
          pinned in `components/site/honesty.test.ts`. A panel that offers only downloads
          does not owe an apology for not offering uploads. */}
    </section>
  );
}
