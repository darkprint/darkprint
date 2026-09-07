import Link from "next/link";
import type { Author } from "@/lib/types";
import { HUMAN_PRESENCE_MARK, NODE_KIND_META, cx } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { TagPill } from "@/components/ui/TagPill";
import { Ticked } from "@/components/ui/Ticked";

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
  /**
   * Whether a person acts at this node.
   *
   * DERIVED, and resolved on the server before a tile is built: the card carries a `type`
   * and no boolean beside it, so the answer is `requiresHuman(ontology, card.type)` — the
   * same call `computeAutonomy` makes about a node inside a graph. A tile and the blueprint
   * page that resolves the same card therefore cannot disagree about where the people are,
   * which they could when the card stored the answer twice.
   *
   * `false` also covers "this registry has published no vocabulary to ask", and the tile
   * draws no marker either way rather than printing the word "unattended" over a question
   * it could not resolve.
   */
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
  /**
   * Absent everywhere the tile has always meant "public" — `/nodes`, every archive-derived
   * card on a profile — because every one of those is a document in `content/cards/` and a
   * card there is public by definition. Only `/u/[username]/cards`'s owner list ever passes
   * `"private"`, off `CardSummary.visibility` (`cardsOwnedBy`, T132) — a real
   * `card_version.visibility` column now, not a seeded fixture: see the violet border and
   * pill this tile draws for that one case.
   */
  visibility?: "public" | "private";
}

/** How many tool chips fit before the rest collapse into a count. */
const TOOLS_SHOWN = 3;

/**
 * The colour of the tile's lit disc, by the ontology `node-type` the card declares.
 *
 * `/nodes` is the one route in the site where a node had no graphic mark at all: 53 tiles
 * of stacked text, arrived at from a landing on which a node is a point of light. The disc
 * is that mark at tile scale, and its colour is the only thing carrying which of the five
 * kinds a reader is looking at once the group heading has scrolled away.
 *
 * The values come from `NODE_KIND_META` — the schematic's own node-kind palette — so a
 * disc on a shelf tile and the node it becomes inside a blueprint's drawing are the same
 * colour rather than two independent inventions. Two departures from a straight
 * `KIND_BY_TYPE` walk, both deliberate:
 *
 * - `human-gate` (and `human-input`) take `HUMAN_PRESENCE_MARK`, violet, not the `gate`
 *   row's `--color-signal`. Doc 2 §1.1: signal is the alarm colour and is spent on
 *   defects. The schematic can afford it because it has a legend beside it; this tile
 *   cannot, because the same tile prints `⏸ human in the loop` in violet three rows
 *   below, and a pink disc above a violet mark says the human step is the fault.
 * - `decision` reads its colour off the `planner` row (`--color-cyan`) rather than the
 *   `router` row, whose violet is now spoken for by the line above. What that buys is
 *   better than the swap it replaces: the two `evaluative` types — decision and
 *   validation — end up holding the two cyans, base and bright, so the five discs echo
 *   the ontology's own tree rather than five unrelated picks. Its two human siblings
 *   share violet for the same reason.
 */
const TYPE_TONE: Readonly<Record<string, string>> = {
  agent: NODE_KIND_META.executor.color,
  tool: NODE_KIND_META.tool.color,
  decision: NODE_KIND_META.planner.color,
  validation: NODE_KIND_META.verifier.color,
  "human-gate": HUMAN_PRESENCE_MARK.color,
  "human-input": HUMAN_PRESENCE_MARK.color,
};

/**
 * A type the table does not know takes the neutral tool grey rather than being guessed
 * into one of the five. Grey is the one answer that does not claim something the card did
 * not say.
 *
 * Two kinds of type land here. A local one declared under `broader` (doc 3 §7), which is
 * what the fallback was written for, and the `orchestration` branch — `parallel`,
 * `parallel.fan-in`, `manager-loop` — which is core and deliberately has no row. The tile
 * carries no legend, so a sixth colour would be a distinction the reader cannot decode,
 * and both remaining accents are spoken for by the two lines above. The disc says
 * "not one of the five" and the type is printed in words on the same tile.
 */
const DEFAULT_TONE = NODE_KIND_META.tool.color;

/**
 * The lit disc: halo, core, thin ring — the same three shells `FlowNode` draws in the
 * scenes, at the one size a text row can carry.
 *
 * `aria-hidden`, and not a decision worth revisiting: the group heading above the run
 * names the type in words, and the card's own page repeats it. The disc is the visual
 * echo of a fact already stated, so announcing it would put the type into every tile's
 * accessible name twice over.
 */
function NodeDisc({ tone }: { tone: string }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="-12 -12 24 24"
      aria-hidden
      className="shrink-0 self-center"
    >
      <circle r={9} fill={tone} fillOpacity={0.18} />
      <circle r={4.5} fill={tone} />
      <circle r={6.5} fill="none" stroke={tone} strokeOpacity={0.5} strokeWidth={1} />
    </svg>
  );
}

/**
 * The grid tile. Sibling of `ContentCard`, minus the schematic — a node card has
 * no graph of its own, so its preview is what it declares: type, action, tools,
 * and how far it has travelled.
 */
export function NodeCardSummary({
  node,
  showType = true,
  className,
}: {
  node: NodeSummary;
  /**
   * Draw the node-type badge.
   *
   * Off inside a type group, where the sticky heading above the run already says it.
   * With it on, all 24 tiles under `Tool` carried a chip reading "Tool" — the loudest
   * object on the tile spending itself on the one fact the reader could not be missing.
   */
  showType?: boolean;
  className?: string;
}) {
  const risk = node.riskMarkers.length;
  const overflow = node.tools.length - TOOLS_SHOWN;
  const titleId = `node-${node.ref}-title`;
  const isPrivate = node.visibility === "private";

  return (
    <article
      className={cx(
        "group relative flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-all duration-200 hover:border-line-bright hover:shadow-[0_12px_40px_-24px_var(--color-amber)]",
        /* `!` for the reason `DeadControl` and `DraftRow` both already carry it: `cx` is a
           plain string join (`lib/format.ts`), not a specificity-aware merge, so appending
           `border-violet/60` after `border border-line` leaves both classes in the DOM and
           the winner depends on Tailwind's build-time scan order rather than on this call
           site. `!important` is the one override this file can guarantee regardless of
           that order. 60% opacity measures 3.24:1 against `--color-surface`, which clears
           the 3:1 floor WCAG 1.4.11 sets for a non-text UI boundary. */
        isPrivate && "border-violet/60! hover:border-violet!",
        className,
      )}
    >
      {/* The whole tile's click target, stretched under everything except the star.
          See `FavoriteStar`'s own comment for why this is a sibling rather than a
          `<button>` nested inside the link.

          `aria-labelledby` pointing at the heading, rather than an `sr-only` copy of
          the name inside the link. The copy meant every tile announced its own name
          twice — "Assemble Stage … Assemble Stage, Assemble the transformed…" — 53
          times down the page. Naming the link by the heading it opens says it once. */}
      <Link
        href={nodeHref(node.id)}
        aria-labelledby={titleId}
        className="absolute inset-0 z-10"
      />

      <FavoriteStar id={`node:${node.ref}`} className="absolute right-2 top-2 z-20" />

      {/* The head row is a THREE-TRACK GRID, not a wrapping flex row.
          ------------------------------------------------------------
          As `flex flex-wrap … justify-between` its height was data-dependent: any tile
          whose phase list plus ref exceeded the column width dropped the ref onto a
          second line and pushed its own title down a row. Measured across all 53 tiles
          in the grouped default, exactly one row disagreed with itself — Diff Triager
          and Exploratory Solver started their titles at y=46 while Evidence Synthesizer,
          between them, started at y=70.

          disc | phases | ref, with the middle track the only one allowed to give: the
          phase is the soft fact, so it is the thing that clips. The ref is the identity
          — the exact string a blueprint pins — and sits in an `auto` track, so it is
          never the thing that wraps. Both clip visually only: the text stays whole in
          the DOM, so a screen reader still reads the full phase list and the full ref.
          `truncate` on the ref is the floor under the pathological case, a ref wider
          than the tile, where an `auto` track would otherwise blow the card open; the
          `title` is what the string falls back to there. One line on every tile,
          whatever the data — measured, all 53 titles now start at y=53. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 pr-8">
        <NodeDisc tone={TYPE_TONE[node.type] ?? DEFAULT_TONE} />
        <span className="flex min-w-0 items-baseline gap-x-2">
          {showType && (
            <Badge color="var(--color-amber)" className="shrink-0">
              {node.typeLabel}
            </Badge>
          )}
          {/* Which stretch of the lifecycle this node works in. Named, not abbreviated
              — a tile has the room the gallery card's strip does not.

              Plain text, not a pill. As a pill it was pixel-identical to the type badge
              beside it — same background, border, height, radius, colour and 11px size,
              separated only by a 6px dot — so two different kinds of fact wore one
              object. The badge is a term the card declares about what it *is*; a phase
              is where it stands. Setting them apart costs nothing and stops the row
              reading as a run of interchangeable chips.

              One entry per declared phase, and **nothing at all** when the card declares
              none. A tile that printed "no phase" would draw an empty slot next to a
              filled one and turn a complete answer into a hole in the row; the tiles
              that carry no phase are the answer to the browser's own "not in a named
              phase" filter, and the card page says it in words. */}
          {node.phases.length > 0 && (
            <span className="min-w-0 truncate font-mono text-[11px] text-muted">
              {node.phases.map((phase) => phase.label.toLowerCase()).join(" · ")}
            </span>
          )}
        </span>
        <span className="truncate font-mono text-[11px] text-dim" title={node.ref}>
          {node.ref}
        </span>
      </div>

      {/* No `flex-1` here. It put every tile's spare height directly under the clamped
          sentence, so the 35 tiles that declare no tools opened a 34px hole between a
          paragraph that had visibly run out of room and the row below it. The slack
          belongs at the tag row — see `ContentCard`, which had the same argument. */}
      <div>
        {/* One identity per card, at the top, the way `ContentCard` carries it since the
            accounts pass. A shelf of 53 tiles that named 53 people in their last row and
            named the card's own id in small print told a reader who made it before it told
            them what it is called. `owner / id` is how a registry addresses a thing.

            `relative z-20` for the reason `FavoriteStar` carries it: the tile's stretched
            `<Link>` sits at `z-10` over everything in plain flow, so a nested link with no
            stacking context of its own is covered and the click opens the card instead.
            `w-fit` keeps the target on the handle. */}
        {node.author !== undefined && (
          <span className="relative z-20 mb-1.5 flex w-fit items-center gap-2 pr-8 font-mono text-xs">
            <Avatar author={node.author} size="sm" link />
            <Link
              href={`/u/${node.author.username}`}
              className="text-muted transition-colors hoverable:hover:text-fg"
            >
              {node.author.username}
            </Link>
            <span aria-hidden className="text-faint">
              /
            </span>
            {/* Amber, on the owner's ruling of 2026-09-06 — "the amber should be the
                dominant color on the cards sections" — and the third answer this one line
                has had. It was `text-cyan`, on the general rule that cyan marks what a
                reader can act on, and every tile on this shelf is actionable, so the rule
                was picking out nothing. It became copper on 2026-08-12, when the owner
                asked the gallery to highlight in orange rather than blue. Amber is the same
                instruction, granted a second time and now with a token behind it: the tile
                already carried an amber type badge, an amber hover shadow and an amber risk
                line, so copper on the id was the one thing on this tile still speaking a
                register of its own. The tile is still a link and still says so, by being a
                link and by lifting on hover.

                #ffb020 on `--color-surface` #0a0c16 is 10.66:1, up from copper's 8.35:1. */}
            <span className="min-w-0 truncate text-amber">{node.id}</span>
          </span>
        )}
        {/* Violet, the same second job the accent takes on `DraftRow`'s `Private` pill —
            see the note where `--color-violet` is declared in `app/globals.css`. Full
            opacity text, unlike the border: 7.16:1 against `--color-surface`, well past
            the 4.5:1 AA floor for text this size. */}
        {isPrivate && (
          <span className="relative z-20 mb-1.5 inline-flex w-fit shrink-0 rounded-full border border-violet/60 px-2.5 py-0.5 font-mono text-[11px] text-violet">
            Private
          </span>
        )}
        {/* `h2`: the grid sits directly under the `/nodes` page title, so a tile is a
            level down from it — the outline must not skip a level. */}
        {/* `h3`, under the group heading `NodeBrowser` now prints per node type. It was
            an `h2`, which put 53 siblings at one level with nothing above them; the
            outline is the browser's structure and a card is a member of a group, not a
            peer of one. `headingLevel` is not a prop because there is no caller that
            wants a different answer: every mount of this component sits inside a group. */}
        <h3
          id={titleId}
          /* `group-hover:text-amber`, with the id above it: one register per tile, and
             `app/globals.css` job 3 makes it the card's. It was copper. */
          className="font-display text-base font-semibold leading-snug text-fg group-hover:text-amber"
        >
          {node.name}
        </h3>
        {/* Three lines, not two: measured across the library, 52 of the 53 actions were
            cut mid-word at two. The tile's height is set by the footer row below, so the
            third line is room the card already had. */}
        <p className="mt-1 line-clamp-3 text-sm leading-snug text-muted">
          <Ticked text={node.action} />
        </p>
      </div>

      {/* Always rendered, always `flex-1` — this is where the grid's spare height goes,
          so tiles of unequal description length still line their footers up across a
          row without opening a gap under the sentence. Empty on the 35 tool-less cards,
          which costs nothing and is the point. */}
      <div className="flex flex-1 flex-wrap content-start items-start gap-1.5">
        {node.tools.length > 0 && (
          <>
            {node.tools.slice(0, TOOLS_SHOWN).map((tool) => (
              <TagPill key={tool} label={tool} />
            ))}
            {overflow > 0 && (
              <span className="font-mono text-[11px] text-dim">+{overflow} more</span>
            )}
          </>
        )}
      </div>

      {/* The author chip stood here and moved to the top of the tile with the accounts
          pass: one identity per card, above the name rather than under the drawing. The
          argument for its old position — "its own row above the counts, because a name
          inside a wrapping mono strip reads as a fourth fact" — is answered by the move
          rather than lost: it is not in that strip now either. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line pt-3 font-mono text-[11px] text-dim">
        <span>
          used in {node.usedIn} blueprint{node.usedIn === 1 ? "" : "s"}
        </span>
        {/* Only when there is one.
            ------------------------------------------------------------
            This span used to render unconditionally, which printed `● no risk markers`
            on 45 of the 53 tiles — the one line on the card reserved for signal, spent
            saying nothing, 45 times down a page, until it read as a decorative rule
            under every card and the eight tiles that had something to say lost the
            contrast that made them worth reading. The browser already offers the
            positive case as a pressable chip (`△ carries a risk marker`), so a tile
            printing the negative was restating the complement of a filter.

            Absence is the default state and the default state is silent. The exception
            stays loud, in amber, which is what the colour is for. Dot, count and word
            together: the colour is the last thing that carries it. */}
        {risk > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {risk} risk marker{risk === 1 ? "" : "s"}
          </span>
        )}
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
