import Link from "next/link";
import type { AnyContent } from "@/lib/types";
import { compact, cx } from "@/lib/format";
import { contentHref } from "@/lib/href";
import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { Avatar } from "./Avatar";
import { KindBadge } from "./Badge";
import { AutonomyMeter } from "./AutonomyMeter";
import { TagPill } from "./TagPill";

function Meta({ downloads, votes }: { downloads: number; votes: number }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] text-dim">
      <span title="Downloads">↓ {compact(downloads)}</span>
      <span title="Votes">▲ {compact(votes)}</span>
    </div>
  );
}

/** Gallery / profile card for any content kind. */
export function ContentCard({
  item,
  className,
}: {
  item: AnyContent;
  className?: string;
}) {
  return (
    <Link
      href={contentHref(item)}
      className={cx(
        "group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-cyan)]",
        className,
      )}
    >
      {/* preview */}
      <div className="relative h-40 overflow-hidden border-b border-line bg-blueprint-deep/40 bp-grid">
        {item.kind !== "ontology" ? (
          <GraphThumbnail
            graph={item.graph}
            className="h-full w-full p-2 opacity-90 transition-transform duration-300 group-hover:scale-[1.03]"
            ariaLabel={`${item.title} pipeline preview`}
          />
        ) : (
          <div className="flex h-full flex-wrap content-center items-center justify-center gap-1.5 p-4">
            {item.nodeTypes.slice(0, 6).map((nt) => (
              <span
                key={nt.name}
                className="rounded border border-blueprint-line/40 bg-blueprint/30 px-2 py-1 font-mono text-[11px] text-blueprint-ink"
              >
                {nt.name}
              </span>
            ))}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <KindBadge kind={item.kind} />
          {item.kind === "blueprint" && (
            <AutonomyMeter autonomy={item.autonomy} size="sm" showLabel={false} />
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-display text-lg font-semibold leading-snug text-fg group-hover:text-cyan">
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
            {item.summary}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 3).map((t) => (
            <TagPill key={t} label={t} />
          ))}
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-2">
            <Avatar author={item.author} size="sm" />
            <span className="text-xs text-muted">{item.author.displayName}</span>
          </div>
          <Meta downloads={item.downloads} votes={item.votes} />
        </div>
      </div>
    </Link>
  );
}
