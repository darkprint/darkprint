"use client";

import { useMemo } from "react";
import { DownloadPanel, type DownloadCard } from "@/components/blueprint/DownloadPanel";
import {
  BUNDLE_README,
  FACTORY_DOT,
  TOPOLOGY_DOT,
  type ExportedFile,
} from "@/lib/content/bundle-export";
import { cx } from "@/lib/format";

/* ============================================================
   The end of the path: the factory, as files.
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
  summary,
  className,
}: {
  /** `exportBundle` over the chosen factory, with no demonstration edge in it. */
  files: readonly ExportedFile[];
  digest?: string;
  /** Error-severity diagnostics the engine reported on these exact bytes. */
  errors: number;
  /** The three choices in one line, for the reader to check before downloading. */
  summary: string;
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
        and a factory the engine cannot vouch for is not one to download.
      </p>
    );
  }

  return (
    <div className={cx("flex flex-col gap-5", className)}>
      <p className="text-[15px] leading-relaxed text-muted">
        This is your factory. {summary}
      </p>
      <p className="text-[15px] leading-relaxed text-muted">
        The folder has the same shape as every blueprint in the gallery.{" "}
        <code className="font-mono text-fg">{FACTORY_DOT}</code>{" "}is what Attractor runs,
        with each card&rsquo;s <code className="font-mono text-fg">spec</code>{" "}inlined as
        the prompt its agent receives.{" "}
        <code className="font-mono text-fg">{TOPOLOGY_DOT}</code>{" "}is the topology with the
        card version pinned on every node.{" "}
        <code className="font-mono text-fg">{BUNDLE_README}</code>{" "}states the digest, the
        command, and the two computed scores in the engine&rsquo;s own words.
      </p>

      <DownloadPanel
        factoryHref={hrefs.get(FACTORY_DOT) ?? ""}
        topologyHref={hrefs.get(TOPOLOGY_DOT) ?? ""}
        readmeHref={hrefs.get(BUNDLE_README) ?? ""}
        cards={cards}
        className="max-w-xl"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
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

          {/* An inventory, not a second set of links: the panel above already downloads
              every one of these, and two routes to the same bytes is noise. What this adds
              is the shape of the folder and what each file weighs. */}
          <ul className="flex max-h-[22rem] flex-col divide-y divide-line overflow-auto rounded-lg border border-line">
            {files.map((file) => (
              <li key={file.path} className="flex items-baseline gap-3 px-4 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">
                  {file.path}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-dim">
                  {bytes(file.text).toLocaleString("en-GB")} B
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Doc 2 §6 is Fase 4. No account prompt, and no button that implies one. */}
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-muted">
            There is nowhere to save this. Accounts, profiles and publishing are designed
            and none of them is built, so the download is the whole of it. Keep the folder
            somewhere you will find it again, because this page cannot hand it back to you.
          </p>
          <p className="text-[13px] leading-relaxed text-muted">
            Nothing was uploaded and nothing was recorded. The graph was assembled and
            scored in this tab. DarkPrint watches no run and holds none of your provider
            keys.
          </p>
          <p className="text-[13px] leading-relaxed text-muted">
            Run it with <code className="font-mono text-fg">attractor run {FACTORY_DOT}</code>{" "}
            on your own machine. The README states the digest these files hash to, so you
            can confirm that what you have is what was scored on this page.
          </p>
        </div>
      </div>
    </div>
  );
}
