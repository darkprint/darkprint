import type { HistoryEntry } from "@/lib/data/bundles";
import { cx, prettyDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ============================================================
   History, and the word this site will not let it mean.

   There is no repository behind a bundle. Each entry below is a **published snapshot
   addressed by its own digest** — a hash over the DOT source and every card version it
   pinned — not a patch against the row under it. Nothing here can be pulled, checked out,
   reverted or merged, and the closing note says so in the open rather than leaving a
   reader to infer it from a column of version numbers with messages beside them, which is
   a commit log to everybody who has ever seen one.

   That is also why `Take` is switched off rather than missing. It is a real thing a
   registry could do with a digest and it is not built; drawing it dead with a reason states
   the design without claiming it. `Diff` is different and only renders where there are two
   snapshots: on a bundle with one it could never do anything even in a finished product,
   and a control like that is worse than one that is merely not built yet.

   `honesty.test.ts` forbids the word `git` on the download surfaces. It is not forbidden
   here, and it does not appear here either.
   ============================================================ */

const TAG_TONE = {
  latest: "border-emerald/40 bg-emerald/10 text-emerald",
  "fork point": "border-violet/40 bg-violet/10 text-violet",
  upstream: "border-line text-dim",
} as const;

function Entry({
  entry,
  upstream,
  comparable,
}: {
  entry: HistoryEntry;
  upstream: boolean;
  /** Whether there is a second snapshot to compare this one against. */
  comparable: boolean;
}) {
  return (
    <li className="relative flex gap-4 border-b border-line px-5 py-4 last:border-b-0">
      {/* The rail: a ring per entry and a hairline between them. The upstream row is drawn
          in the dimmest tone the ladder has, so the lineage reads as the end of your own
          history rather than as one more of your releases. */}
      <span aria-hidden className="relative flex w-3 shrink-0 justify-center">
        <span
          className={cx(
            "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border",
            upstream ? "border-line-bright bg-surface" : "border-cyan bg-void",
          )}
        />
      </span>

      <div className={cx("flex min-w-0 flex-1 flex-col gap-2", upstream && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] text-fg">{entry.version}</span>
          {/* A published bundle has no version but its digest, so the two are the same
              string and printing it twice is noise. A private one names its own versions
              and the digest is the second fact. */}
          {entry.digest !== entry.version && (
            <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-dim">
              {entry.digest}
            </span>
          )}
          {entry.tag !== undefined && (
            <span
              className={cx(
                "rounded-full border px-2 py-0.5 font-mono text-[11px]",
                TAG_TONE[entry.tag],
              )}
            >
              {entry.tag}
            </span>
          )}
        </div>
        <p className="max-w-[62ch] border-l border-line pl-4 text-[13px] leading-relaxed text-muted">
          {entry.message}
        </p>
        <p className="font-mono text-[11px] text-dim">
          {/* Text, for the reason `FileTree` states in full: an entry's author is a handle
              off the release manifest, those handles hold no accounts (D-250-11), and a
              link to a profile that 404s was the defect D-260-25 ruled and D-261-06
              assigns here. One surface on this row rather than `FileTree`'s two — there is
              no avatar beside it to link a second time. */}
          <span>{entry.author}</span>{" "}
          · {prettyDate(entry.at)}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        {/* `Diff` needs two snapshots. A bundle with one has nothing to compare against,
            and a control that could never do anything even in a finished product is worse
            than one that is merely not built yet. */}
        {comparable && (
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Comparing two digests is designed and not built."
          >
            Diff
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled
          title="Nothing copies a snapshot into an account: there are no accounts."
        >
          Take
        </Button>
      </div>
    </li>
  );
}

export function History({ entries }: { entries: readonly HistoryEntry[] }) {
  return (
    <section
      id="history"
      aria-labelledby="history-title"
      className="scroll-mt-24 overflow-hidden rounded-lg border border-line bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-3.5">
        <h2 id="history-title" className="label-lead">
          History
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
          a version is a digest, not a commit
        </span>
      </div>

      <ul>
        {entries.map((entry) => (
          <Entry
            key={`${entry.version}-${entry.digest}`}
            entry={entry}
            upstream={entry.tag === "upstream"}
            comparable={entries.length > 1}
          />
        ))}
      </ul>

      <p className="border-t border-line bg-surface-2/50 px-5 py-4 text-xs leading-relaxed text-dim">
        There is no repository behind a bundle. Each row is a published snapshot addressed
        by its own digest, so history here is a list of identities rather than a chain of
        patches, and nothing in it can be pulled. Comparing two of them, and copying one
        into an account, are both designed and neither is built.
      </p>
    </section>
  );
}
