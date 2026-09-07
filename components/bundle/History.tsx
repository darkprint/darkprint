import type { HistoryEntry } from "@/lib/data/bundles";
import { cx, prettyDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ============================================================
   History, and the word this site will not let it mean.

   There is no repository behind a blueprint. Each entry below is a published snapshot
   addressed by its own digest, a hash over the graph and every card version it pinned, and
   never a patch against the row under it. Nothing here can be pulled, checked out, reverted
   or merged, and the closing note says so in the open: a column of version numbers with
   messages beside them is a commit log to everybody who has ever seen one.

   The two disabled controls are drawn rather than omitted because both are real things a
   registry could do with a digest and neither is built; a dead control with a reason states
   the design without claiming it. Compare only renders where there are two snapshots, since
   on one it could never do anything even in a finished product.
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
      {/* The rail: a ring per entry and a hairline between them. The upstream row takes the
          dimmest tone, so the lineage reads as the end of your own history rather than as
          one more of your releases. */}
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
          {/* When the version IS the digest the two are one string, and printing it twice
              is noise. */}
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
        {/* No width cap: a release message is the blueprint's own summary, which the header
            above prints at full width, and one sentence wrapping at two widths reads as a
            defect. */}
        <p className="border-l border-line pl-4 text-[13px] leading-relaxed text-muted">
          {entry.message}
        </p>
        <p className="font-mono text-[11px] text-dim">
          {/* Text rather than a link: an entry's author is a handle off the release manifest,
              and those handles may hold no account. */}
          <span>{entry.author}</span>{" "}
          · {prettyDate(entry.at)}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        {comparable && (
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Comparing two releases is designed and not built."
          >
            Compare (soon)
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled
          title="Copying a release into your account is designed and not built."
        >
          Copy to my account (soon)
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
          each release is a frozen snapshot, addressed by its digest
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
        There is no repository behind a release, so there is nothing to pull. Comparing two
        releases and copying one into your account are designed and not built.
      </p>
    </section>
  );
}
