"use client";

import { useMemo } from "react";
import { DownloadPanel, type DownloadCard } from "@/components/blueprint/DownloadPanel";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import {
  BUNDLE_AGENTS,
  BUNDLE_README,
  TOPOLOGY_DOT,
  type ExportedFile,
} from "@/lib/content/bundle-export";
import { cx } from "@/lib/format";

/* ============================================================
   One of the two exits: the factory, as files.
   ------------------------------------------------------------
   The same `exportBundle` every blueprint in the gallery is
   published through, so what comes down here has the same shape as
   what comes down there: a runnable `factory.dot` with each card's
   `spec` inlined as the prompt its agent receives, the topology
   with the pins intact, the cards themselves, and a README that
   quotes the two computed scores.

   The files are built in the tab. There is no server to zip a
   folder on request (doc 1 §0.1.3, doc 2 §11 item 10), and the
   combination the reader has chosen is one of eighty, so they are
   assembled from the generated text on the page and handed over as
   `data:` URLs. The bytes are the ones the engine scored, because
   the engine scored them here.

   `DownloadPanel` is item 10's component, reused unchanged. It
   already carries the two sentences this step has to end on: that
   execution happens on the reader's machine, and that there is
   nowhere to save any of this yet.

   ── Task 5: this is no longer step 8 of 8 ──
   `AgentHandoff` (`./AgentHandoff.tsx`) is the other exit, and the two are co-equal: take
   the worked example as files here, or take a brief that gets the reader's own agent to
   write a blueprint for a different goal there. Neither is the fallback for the other, so
   this component carries nothing that assumes a step position — no counter, no Back/Next —
   and says two things that used to go unsaid anywhere on the page: that
   `lib/content/bundle-export.ts` already writes an `AGENTS.md` into this exact folder, and
   that the hour a reader is about to spend belongs to wiring the folder into their own
   agent runner, not to reading this page.

   ── Fix round 1: co-equal in fact, not just in the docblock's own claim ──
   Task 6's review measured the gap this paragraph asserted away: only `AgentHandoff` carried
   a heading, so a reader scanning the two exits met a title on one side and a wall of prose
   on the other — which is not what "co-equal" reads as, whatever this comment said about it.
   This component's own `h3`, added directly above the paragraph below, is the fix; nothing
   else in this component changed.
   ============================================================ */

const CARD_PREFIX = "cards/";

/** One file as something a browser will save. */
function dataHref(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

function bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function DownloadStep({
  files,
  digest,
  errors,
  className,
}: {
  /** `exportBundle` over the chosen factory, with no demonstration edge in it. */
  files: readonly ExportedFile[];
  digest?: string;
  /** Error-severity diagnostics the engine reported on these exact bytes. */
  errors: number;
  /* `summary` was here: the three choices in one line, for a reader to check before
     downloading. It had one reader, the paragraph the author removed on 2026-08-08, and the
     three choices it recited are the three controls directly above this step. Dropping the
     prop rather than leaving it unread is how the removal reaches the caller. */
  className?: string;
}) {
  const hrefs = useMemo(() => {
    const out = new Map<string, string>();
    for (const file of files) out.set(file.path, dataHref(file.text));
    return out;
  }, [files]);

  const cards: DownloadCard[] = useMemo(
    () =>
      files
        .filter((file) => file.path.startsWith(CARD_PREFIX))
        .map((file) => ({
          ref: file.path.slice(CARD_PREFIX.length).replace(/\.yaml$/, ""),
          href: hrefs.get(file.path) ?? "",
        })),
    [files, hrefs],
  );

  const total = useMemo(
    () => files.reduce((sum, file) => sum + bytes(file.text), 0),
    [files],
  );

  if (files.length === 0) {
    return (
      <p className={cx("text-[15px] leading-relaxed text-muted", className)}>
        There are no files to hand over. The bundle behind these choices did not resolve,
        and a blueprint the engine cannot vouch for is not one to download.
      </p>
    );
  }

  return (
    <div className={cx("flex flex-col gap-5", className)}>
      {/* "This starter, as files" until 2026-08-08. The title names what the button under
          it does now, which is what the section's own heading used to be doing for it. */}
      <h3 className="font-display text-lg font-semibold text-fg">Download the bundle</h3>

      {/* A paragraph stood here — "This is your blueprint, in the same folder shape as
          everything else in the gallery … It ships with its own AGENTS.md" — and the author
          asked it out on 2026-08-08 along with the two headings around it.

          What it was doing, `DownloadPanel` directly below does better and file by file: it
          lists `AGENTS.md` with a line saying what is in it, and the three choices the
          `{summary}` clause recited are the three controls a reader has just used. A
          paragraph describing a panel that is one element away was the duplication this
          file's own notes have been trimming since it was written.

          `summary`, `BUNDLE_AGENTS` and the `bytes` roll-up it used go with it where they
          have no other reader. */}
      <DownloadPanel
        headingLevel="h3"
        topologyHref={hrefs.get(TOPOLOGY_DOT) ?? ""}
        readmeHref={hrefs.get(BUNDLE_README) ?? ""}
        agentsHref={hrefs.get(BUNDLE_AGENTS) ?? ""}
        cards={cards}
      />

      {/* `min-w-0` on both columns. A grid item's automatic minimum size is its
          min-content, so the digest row — `sha256:` and 64 hex characters — held this
          column open at 389px inside a 342px track on a 390px phone and the whole
          document scrolled sideways by 23px. Measured on step 8 at 390×844: body
          `scrollWidth` 413 against a 390 viewport. The reader never asked for a second
          axis, and a page that slides under a thumb on the one step whose job is to hand
          over a folder reads as broken rather than as wide. */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          {/* What the engine said about these exact bytes, so the claim that the artefact
              works is checkable on the page rather than taken on trust. */}
          <div className="rounded-lg border border-line bg-surface-2/50 px-4 py-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
              <dt className="uppercase tracking-[0.14em] text-dim">Files</dt>
              <dd className="text-muted">
                {files.length} · {total.toLocaleString("en-GB")} bytes
              </dd>
              <dt className="uppercase tracking-[0.14em] text-dim">Digest</dt>
              <dd className="break-all text-muted">{digest ?? "not computed"}</dd>
              <dt className="uppercase tracking-[0.14em] text-dim">Validator</dt>
              <dd className={errors === 0 ? "text-emerald" : "text-signal"}>
                {errors === 0
                  ? "resolved with no errors"
                  : `${errors} error${errors === 1 ? "" : "s"}`}
              </dd>
            </dl>
          </div>

          {/* A per-file inventory stood here — every path in the folder with its byte
              count — and the author asked it out on 2026-08-08.

              The row above keeps the two facts it was really carrying: how many files there
              are and what they weigh in total. What the list added was nine paths a reader
              cannot act on from here, in a `max-h-[22rem]` scroller, directly under a panel
              that already downloads every one of them by name. Two routes to the same bytes
              is what the note here already called noise; the list was the third telling of
              a folder the panel above draws. */}
        </div>

        {/* Doc 2 §6 is Fase 4. No account prompt, and no button that implies one.
            `DownloadPanel` above already ends on "there is nowhere to save this yet", and
            already carries the run command and doc 1 §0.1.3's sentence about execution
            happening on the reader's machine. Repeating either of them a screen-width away
            is §5's duplication, so what is left here is the part the panel does not say:
            that nothing was recorded, and how to check the bytes against the page. */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* "Nothing was uploaded and nothing was recorded" is gone from here. It was
              the fourth telling on this route and the second on this screen:
              `DownloadPanel`, twenty lines above, already says execution happens on the
              reader's machine and that the site holds none of their keys, which is the
              same claim and more of it. */}
          {/* A sentence about the README quoting the digest and both readings stood here
              and the author asked it out. The digest is in the row directly above it, as
              text a reader can select, and the README says what it says whether or not this
              page describes it in advance. */}
          {/* "Keep the folder somewhere you will find it again. This page cannot hand
              it back to you." stood here and is gone: it was the third statement of the
              same fact inside 460px of step 7. `DownloadPanel` says "Execution happens on
              your machine" at the top of the panel and "There is nowhere to save this yet"
              290px below it, both of which say it better and neither of which repeats the
              other. Repetition turns honesty into anxiety, which is the failure mode the
              site-wide disclaimer rule was written for. */}
        </div>
      </div>

      {/* Task 5, step 2: the hour belongs here and nowhere else on `/build`. The lead on
          `app/build/page.tsx` used to attach "about an hour" to the three choices above —
          to reading this page — and that was never the true cost: three radio buttons and
          a download take a few minutes. What takes an hour is everything after this
          sentence, on the reader's own machine, which is why it is written in the past
          tense of the download ("you now have the folder") rather than as a promise about
          what is still ahead on this screen. */}
      <p className="text-[13px] leading-relaxed text-dim">
        You now have the folder. Wiring it to your own agent runner and getting a first
        green run takes about an hour.
      </p>

      {/* Task 5, step 4: the registry lookup the author has planned — an agent calling
          DarkPrint's own registry over MCP for the blueprint that best fits a goal,
          instead of a reader picking a starter by hand. No MCP server exists, so this is
          stated as coming and never as available; `ComingSoonBadge` carries that the same
          way it does everywhere else on the site (`/skill`, `ForkAction`), and the
          sentence beside it is pinned in `components/site/honesty.test.ts` alongside its
          twin in `AgentHandoff` below, because a page that just handed over an agent-ready
          folder is the page most likely to read as though the call already exists. */}
      <p className="flex flex-wrap items-center gap-2 text-[13px] leading-relaxed text-dim">
        <ComingSoonBadge />
        Not built yet: your agent querying the registry over MCP for the blueprint that
        best fits a goal like this one.
      </p>

      {/* `AgentHandoff` does not render inside this component. It sits one level up, in
          `BuildWorkspace.tsx`, in the other half of the grid this box is one cell of.
          ------------------------------------------------------------
          It is the author's own generalisation of the path (2026-08-04) and the mirror of
          the `AGENTS.md` named above. It used to be read as a second, optional offer
          standing between the artefact and the only control that left the step (measured
          at 1440px, before it moved: the first download link at y=690, "Validate it" at
          y=2274, 570px of that offer in between). That measurement explained why it moved
          out of this component; it is not what it is now. Task 5 promoted it to a co-equal
          exit from `/build` — take this folder as files, or take the brief instead — and
          `BuildWorkspace.tsx` places the two side by side on one row, with neither a
          postscript to the other and no step position printed around either.
          `AgentHandoff` keeps its own link to `/upload`. */}
    </div>
  );
}
