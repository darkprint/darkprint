import Link from "next/link";

import { GraphThumbnail } from "@/components/graph/GraphThumbnail";
import { cx, prettyDate } from "@/lib/format";
import { blueprintRecordHref } from "@/lib/href";
import type { AnyContent } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CARD_SHELL } from "./ContentCard";
import { FavoriteStar } from "./FavoriteStar";

const THUMB = { width: 380, height: 132 } as const;

const ROW_SPACING = "grid grid-cols-1 items-center gap-6 p-[18px]";

// Owner summaries reserve a third column for publishing controls.
export const ROW_GRID = `${ROW_SPACING} lg:grid-cols-[380px_minmax(0,1fr)_236px]`;
const BLUEPRINT_ROW_GRID = `${ROW_SPACING} lg:grid-cols-[380px_minmax(0,1fr)]`;

export function RowThumbFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-md border border-line bg-blueprint-deep/40 bp-grid",
        className,
      )}
      style={{ height: THUMB.height }}
    >
      {children}
    </div>
  );
}

export function ContentRow({
  item,
  forks = 0,
  lineage,
  className,
}: {
  item: AnyContent;
  forks?: number;
  lineage?: { owner: string; slug: string };
  className?: string;
}) {
  return (
    <article
      className={cx(CARD_SHELL, BLUEPRINT_ROW_GRID, className)}
    >
      <Link href={blueprintRecordHref(item)} className="absolute inset-0 z-10">
        <span className="sr-only">{item.title}</span>
      </Link>

      <FavoriteStar id={`blueprint:${item.slug}`} className="absolute right-2 top-2 z-20" />

      <RowThumbFrame>
        <GraphThumbnail
          graph={item.graph}
          nodeLabels={false}
          className="h-full w-full p-2 transition-transform duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:scale-[1.03]"
          ariaLabel={`${item.title} pipeline preview`}
        />
      </RowThumbFrame>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="relative z-20 flex w-fit max-w-full items-center gap-2 font-mono text-xs">
          <Avatar author={item.author} size="sm" link />
          <Link
            href={`/u/${item.author.username}`}
            className="text-muted transition-colors hoverable:hover:text-fg"
          >
            {item.author.username}
          </Link>
          <span aria-hidden className="text-faint">
            /
          </span>
          <span className="min-w-0 truncate text-cyan">{item.slug}</span>
          {lineage !== undefined && (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-dim">
              forked
            </span>
          )}
        </span>
        {lineage !== undefined && (
          <span className="font-mono text-[11px] text-dim">
            forked from {lineage.owner} / {lineage.slug}
          </span>
        )}
        <h3 className="font-display text-[22px] font-normal leading-snug text-fg transition-colors duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:group-hover:text-cyan">
          {item.title}
        </h3>
        <p className="line-clamp-3 text-sm leading-snug text-muted">{item.summary}</p>

        <span className="pt-0.5 font-mono text-[11px] text-dim">
          {item.graph.nodes.length} node{item.graph.nodes.length === 1 ? "" : "s"}
          {" · "}
          {item.graph.edges.length} edge{item.graph.edges.length === 1 ? "" : "s"}
        </span>
        <span className="font-mono text-[11px] text-dim">
          {prettyDate(item.updatedAt)}
          {forks > 0 && (
            <>
              {" · "}
              {forks} fork{forks === 1 ? "" : "s"}
            </>
          )}
        </span>
      </div>
    </article>
  );
}
