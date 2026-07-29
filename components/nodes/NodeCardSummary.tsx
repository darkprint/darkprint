import Link from "next/link";
import type { Author } from "@/lib/types";
import { HUMAN_PRESENCE_MARK, cx } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { TagPill } from "@/components/ui/TagPill";

/**
 * One node card at library altitude — enough to decide whether to open it, and
 * nothing that needs the ontology at render time. The page resolves the term
 * labels once on the server; this shape is plain data, so the browser can filter
 * a few dozen of them without a round trip.
 */
export interface NodeSummary {
  id: string;
  version: string;
  /** "id@version" — the exact thing a blueprint pins. */
  ref: string;
  name: string;
  /** The one-line statement of what the node does. */
  action: string;
  /** `node-type` term id, and the label the ontology gives it. */
  type: string;
  typeLabel: string;
  /**
   * The `phase` terms the card declares, in the order it wrote them, each with its
   * ontology label.
   *
   * A list, and often an empty one. The five phases describe the factory, not every
   * node in it: an intake, a retrieval step or a router declares none, and a node that
   * both builds and fixes declares two. Nothing downstream may read the empty list as
   * a missing value.
   */
  phases: { id: string; label: string }[];
  /** `tool` term ids, as the card writes them. */
  tools: string[];
  requiresHuman: boolean;
  /** `risk-marker` labels, already resolved. */
  riskMarkers: string[];
  /** Blueprints pinning any version of this card. */
  usedIn: number;
  /**
   * Who published this card, resolved against the user table on the server.
   *
   * `undefined` covers two different things and the tile renders both the same way: a
   * card that declares no `author`, and one naming somebody the table does not hold.
   * The second is the reason this is a resolved `Author` rather than the raw string —
   * `/u/[username]` is `dynamicParams = false` over the six known profiles, so linking
   * an unresolved name would ship a 404 from a grid of 53 tiles.
   */
  author?: Author;
}

/** How many tool chips fit before the rest collapse into a count. */
const TOOLS_SHOWN = 3;

/**
 * The grid tile. Sibling of `ContentCard`, minus the schematic — a node card has
 * no graph of its own, so its preview is what it declares: type, action, tools,
 * and how far it has travelled.
 */
export function NodeCardSummary({
  node,
  className,
}: {
  node: NodeSummary;
  className?: string;
}) {
  const risk = node.riskMarkers.length;
  const overflow = node.tools.length - TOOLS_SHOWN;

  return (
    <article
      className={cx(
        "group relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-amber)]",
        className,
      )}
    >
      {/* The whole tile's click target, stretched under everything except the star.
          See `FavoriteStar`'s own comment for why this is a sibling rather than a
          `<button>` nested inside the link. */}
      <Link href={nodeHref(node.id)} className="absolute inset-0 z-10">
        <span className="sr-only">{node.name}</span>
      </Link>

      <FavoriteStar id={`node:${node.ref}`} className="absolute right-2 top-2 z-20" />

      <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge color="var(--color-amber)">{node.typeLabel}</Badge>
          {/* Which stretch of the lifecycle this node works in. Named, not abbreviated
              — a tile has the room the gallery card's strip does not.

              One chip per declared phase, and **nothing at all** when the card declares
              none. A tile that printed "no phase" would draw an empty slot next to a
              filled one and turn a complete answer into a hole in the row; the tiles
              that carry no phase chip are the answer to the browser's own "not in a
              named phase" filter, and the card page says it in words. */}
          {node.phases.map((phase) => (
            <span
              key={phase.id}
              className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] text-muted"
            >
              {phase.label.toLowerCase()}
            </span>
          ))}
        </span>
        <span className="font-mono text-[11px] text-dim">{node.ref}</span>
      </div>

      <div className="flex-1">
        {/* `h2`: the grid sits directly under the `/nodes` page title, so a tile is a
            level down from it — the outline must not skip a level. */}
        <h2 className="font-display text-base font-semibold leading-snug text-fg group-hover:text-cyan">
          {node.name}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted">
          {node.action}
        </p>
      </div>

      {node.tools.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {node.tools.slice(0, TOOLS_SHOWN).map((tool) => (
            <TagPill key={tool} label={tool} />
          ))}
          {overflow > 0 && (
            <span className="font-mono text-[11px] text-dim">+{overflow} more</span>
          )}
        </div>
      )}

      {/* Who published it, linked to their profile (author's request, 2026-07-29). Its
          own row above the counts: the row below is a wrapping mono strip of three
          independent facts, and a name inside it reads as a fourth one.

          `relative z-20` for the same reason `FavoriteStar` carries it — the tile's
          stretched `<Link>` sits at `z-10` over everything in plain flow, so a nested
          link without its own stacking context is covered and the click opens the node
          instead. `w-fit` keeps the target on the name. */}
      {node.author !== undefined && (
        <Link
          href={`/u/${node.author.username}`}
          className="group/author relative z-20 flex w-fit items-center gap-2"
        >
          <Avatar author={node.author} size="sm" />
          <span className="text-xs text-muted group-hover/author:text-fg">
            {node.author.displayName}
          </span>
        </Link>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 font-mono text-[11px] text-dim">
        <span>
          used in {node.usedIn} blueprint{node.usedIn === 1 ? "" : "s"}
        </span>
        {/* Dot, count and word together: the colour is the last thing that carries it. */}
        <span
          className={cx(
            "inline-flex items-center gap-1.5",
            risk > 0 ? "text-amber" : "text-dim",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {risk === 0 ? "no risk markers" : `${risk} risk marker${risk === 1 ? "" : "s"}`}
        </span>
        {/* Violet, from `HUMAN_PRESENCE_MARK`. Doc 2 §1.1: the row states where a person
            acts, and the node page it links to says the same thing in the same colour. */}
        {node.requiresHuman && (
          <span
            className={cx("inline-flex items-center gap-1", HUMAN_PRESENCE_MARK.className)}
          >
            <span aria-hidden>{HUMAN_PRESENCE_MARK.glyph}</span> human in the loop
          </span>
        )}
      </div>
    </article>
  );
}
