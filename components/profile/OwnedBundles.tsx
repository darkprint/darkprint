"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { OwnedBundleSummary } from "@/lib/server/registry";
import type { Blueprint } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { useQueryState } from "@/components/ui/useQueryState";
import { VisibilityControl } from "@/components/bundle/VisibilityControl";
import { ButtonLink } from "@/components/ui/Button";
import { MetaPill } from "@/components/ui/MetaPill";
import { CARD_SHELL } from "@/components/ui/ContentCard";
import { ContentRow, ROW_GRID, RowThumbFrame } from "@/components/ui/ContentRow";
import { DeleteBundleControl } from "@/components/profile/DeleteBundleControl";
import { blueprintHref } from "@/lib/href";
import { shelfEmptyMessage } from "./parts";
import type { ShelfSort } from "./SortControl";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-67 LIVE: PATCH /api/bundles/{owner}/{slug}/visibility — `visibilityApi` below, drawn
// once per row for the owner. This shelf is the only surface that carries it for a bundle
// that HAS a release (2026-09-06, when it came off the blueprint page). `DraftLanding` still
// draws `VisibilitySwitch` for a bundle with none, which is the state where there is no
// detail page to have carried it in the first place.

/* ============================================================
   Your blueprints: one list, public and private together, live off the registry (T280).

   `ownedBundles(db, actor, handle)` replaced `bundlesOwnedBy(username)` in `load.ts` — see
   that file's own header for the cutover — and the row shape changed with it.
   `OwnedBundleSummary` is a projection of the `bundle` row itself, not a fully resolved
   archive entry: it has a title, a summary, a visibility and (when a release exists) a
   version, a digest and a node count, and nothing else. `ContentRow` wants a full
   `Blueprint` — a graph to draw, an author to attribute, a scorecard to fold into the
   autonomy meter — which a bare row from `bundle` cannot supply.

   So a row takes ONE of two shapes now, and the branch is the same test the old
   `DraftRow`/`ContentRow` split used, widened by one more case:

   - **released, and `content/` carries the same slug for this owner** — `ContentRow`
     itself, the same row `/blueprints` draws, because there is a full archive entry to
     draw it from.
   - **everything else** — `SummaryRow`, below: a zero-release draft (the GitHub
     empty-repository state, rendered as "no release yet" rather than hidden — B-06 stays
     untouched, this is a DIFFERENT reader that wants exactly the rows the public shelf
     skips) or a released bundle the static content archive has never heard of (created
     through `/new` and `/upload` rather than shipped in `content/`).

   `SummaryRow` draws less than `ContentRow` does — no graph, because a summary carries no
   graph to draw — but it draws every field the live row actually has, including a `Publish`
   link for the owner: `/upload?owner=<handle>&slug=<slug>` lands a release on THIS bundle
   whether it has none yet or already has one (B6's prefill contract), so the one link
   serves both "publish a first release" and "publish a new one".

   ── Who can see it, changed from here and nowhere else ──
   The owner, 2026-09-06: "remove the panel visibility from the blueprint card; such option
   should be visible only on the user account list of the blueprints". This file is the
   second half of that sentence, and it has to serve BOTH row shapes — a published bundle
   the archive carries is exactly the case that lost its switch when the bundle page's
   column came off, so a control on `SummaryRow` alone would leave the regression standing
   on the rows that hit it. `RowVisibility` below is the one mount, drawn twice.

   ── Violet, unconditionally, on a private row ──
   Unchanged from before T280: `Private` takes violet on the author's instruction
   (`app/globals.css`'s accent comment carries the reasoning), and it is a fact about
   `summary.visibility` rather than a branch this component invents.

   ── Find, sort and visibility, all three live over the loaded rows ──
   `FindBox` writes `?q=`, `SortControl` writes `?sort=`, `VisibilityFilter` writes
   `?visibility=` — three keys, one `useQueryState`, no prop passed between any control and
   this list. All three run on both branches: a visitor's rows are always `public`, so the
   visibility filter is inert there rather than absent, the same reasoning that kept it
   inert (rather than removed) before this pass.
   ============================================================ */

/** One row: the live summary, and the same slug's archive entry when there is one. */
export interface OwnedRow {
  summary: OwnedBundleSummary;
  /** Present when `content/` carries a blueprint at this slug for this owner. */
  blueprint?: Blueprint;
}

/**
 * SEAM-67's address for one row, built in the one place this shelf builds it.
 *
 * Exported so a cell can pin the address without a live request: `api` reaches `fetch` and
 * never reaches the markup, so no render of this list can see where a segment points.
 * The shape matches the bundle page's own call site (`app/blueprints/[owner]/[slug]/page.tsx`),
 * unescaped for the reason that one is: a handle and a slug are already constrained to the
 * path-safe set by `lib/server/naming`, so escaping here would only make the two disagree.
 */
export function visibilityApi(ownerHandle: string, slug: string): string {
  return `/api/bundles/${ownerHandle}/${slug}/visibility`;
}

/**
 * The visibility control for one row, owner only, and the ONE mount both row shapes share.
 *
 * A shared component rather than two call sites, because the two branches below draw
 * almost nothing else in common and a control that lands on one of them is the exact
 * failure this file is fixing.
 *
 * `router.refresh()` on a saved change, the same device `DeleteBundleControl` uses after a
 * delete: the row's violet border, its `Private` pill and the `n public · n private` count
 * in the heading all render the value the page was loaded with, and an archived row is
 * drawn by `ContentRow`, which this file cannot reach into at all. Re-reading the shelf
 * from the registry is the only way all four agree with what was just pressed.
 */
function RowVisibility({
  ownerHandle,
  slug,
  visibility,
  className,
}: {
  ownerHandle: string;
  slug: string;
  visibility: "public" | "private";
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={className}>
      <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
        Who can see this
      </span>
      {/* The name carries the slug because a shelf mounts one of these per row, and
          `Visibility` repeated down a list names nothing. `DeleteBundleControl` above
          settled that shape for this shelf first. */}
      <VisibilityControl
        label={`Visibility of ${slug}`}
        api={visibilityApi(ownerHandle, slug)}
        visibility={visibility}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

/** A bundle drawn straight off its own row: no graph, because a summary has none to draw. */
function SummaryRow({
  row,
  owner,
  ownerHandle,
}: {
  row: OwnedRow;
  owner: boolean;
  ownerHandle: string;
}) {
  const { summary } = row;
  const draft = summary.releaseCount === 0;
  const href = blueprintHref(ownerHandle, summary.slug);

  return (
    <article
      className={cx(
        CARD_SHELL,
        ROW_GRID,
        /* `!` for the reason `NodeCardSummary` states in full: `cx` does not de-duplicate
           or order classes by specificity, so overriding `CARD_SHELL`'s own `border-line`
           needs `!important` rather than append-and-hope. */
        summary.visibility === "private" && "border-violet/60! hoverable:hover:border-violet!",
      )}
    >
      {/* ---------- zone 1: no graph to draw ----------
          Dashed rather than `ContentRow`'s solid frame: the site's own register for
          "nothing lives here yet" over a drawing this row genuinely does not have — a
          summary carries no DOT and no card refs to lay one out from. */}
      <RowThumbFrame className="flex items-center justify-center border-dashed">
        <span className="px-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
          {draft ? "no release yet" : "no graph drawn"}
        </span>
      </RowThumbFrame>

      {/* ---------- zone 2: what the row itself carries ---------- */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={href}
            className="font-display text-lg font-semibold text-cyan transition-colors hoverable:hover:text-cyan-bright"
          >
            {summary.title ?? summary.slug}
          </Link>
          {summary.visibility === "private" && (
            <span className="shrink-0 rounded-full border border-violet/60 px-2.5 py-0.5 font-mono text-[11px] text-violet">
              Private
            </span>
          )}
          {draft ? (
            <MetaPill>Draft</MetaPill>
          ) : (
            summary.currentVersion !== undefined && <MetaPill>{summary.currentVersion}</MetaPill>
          )}
        </div>

        {/* The slug on its own line, but only when the link text above just said the
            title instead — a row with no title already shows the slug as its heading. */}
        {summary.title !== undefined && summary.title !== summary.slug && (
          <span className="font-mono text-[11px] text-dim">{summary.slug}</span>
        )}

        <p className="line-clamp-3 text-sm leading-snug text-muted">{summary.summary ?? ""}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5 font-mono text-[11px] text-dim">
          {!draft && summary.digest !== undefined && <span>{summary.digest.slice(0, 12)}</span>}
          {!draft && summary.nodeCount !== undefined && (
            <span>
              {summary.nodeCount} node{summary.nodeCount === 1 ? "" : "s"}
            </span>
          )}
          <span>updated {prettyDate(summary.updatedAt.toISOString().slice(0, 10))}</span>
        </div>
      </div>

      {/* ---------- zone 3: the owner's controls ----------
          The trash sits top-right (owner-instructed, 2026-08-25) and only on THIS row
          shape: a ContentRow-shaped row is a public released blueprint, which the server
          refuses to delete (published stays), so it gets no dead control to click. */}
      {owner && (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <DeleteBundleControl ownerHandle={ownerHandle} slug={summary.slug} />
          <ButtonLink
            href={`/upload?owner=${encodeURIComponent(ownerHandle)}&slug=${encodeURIComponent(summary.slug)}`}
            size="sm"
            variant="outline"
          >
            {draft ? "Publish" : "Publish new release"}
          </ButtonLink>
          {/* The sentence that stood here said, in words, what the control below now says
              live: private read as "only you can see this" and public as "public". Two
              statements of one fact that disagree the moment a segment is pressed, and the
              control is the one that can answer for the press, so the sentence went rather
              than the switch. Nothing is lost from the row: the same value still reaches a
              reader as the pressed segment, and the violet pill above still marks a private
              row for someone scanning the list. */}
          <RowVisibility
            ownerHandle={ownerHandle}
            slug={summary.slug}
            visibility={summary.visibility}
            className="w-full"
          />
        </div>
      )}
    </article>
  );
}

export function OwnedBundles({
  rows,
  owner,
  ownerHandle,
}: {
  rows: readonly OwnedRow[];
  /**
   * Whether the reader's own session names the handle this shelf belongs to.
   *
   * It decides the heading, the count, the controls and the destination of a row, and it
   * is a prop rather than a second component because there is one blueprint list on this
   * site: two components would be two places for the row to drift.
   */
  owner: boolean;
  /** The handle this shelf belongs to — every row's canonical URL is built from it. */
  ownerHandle: string;
}) {
  const publicCount = rows.filter((r) => r.summary.visibility === "public").length;
  const privateCount = rows.length - publicCount;

  /* Three keys, one `useQueryState`, read independently — see the file docblock. Counts
     above still describe the FULL list: a filter deciding what is on screen should not
     also rewrite what the account holds. */
  const { params } = useQueryState();
  const visibility = params.get("visibility");
  const query = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "updated") as ShelfSort;

  const needle = query.trim().toLowerCase();
  const byVisibility =
    visibility === null ? rows : rows.filter((row) => row.summary.visibility === visibility);
  const bySearch =
    needle === ""
      ? byVisibility
      : byVisibility.filter((row) =>
          [row.summary.title, row.summary.slug, row.summary.summary].some(
            (field) => field !== undefined && field.toLowerCase().includes(needle),
          ),
        );
  const visible = [...bySearch].sort((a, b) =>
    sort === "az"
      ? a.summary.slug.localeCompare(b.summary.slug)
      : b.summary.updatedAt.getTime() - a.summary.updatedAt.getTime(),
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-lead">{owner ? "Your blueprints" : "Published blueprints"}</h2>
        <span className="font-mono text-[11px] text-dim">
          {owner
            ? `${publicCount} public · ${privateCount} private`
            : `${rows.length} public`}
        </span>
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface/40 px-5 py-8 text-center font-mono text-[13px] text-dim">
          {shelfEmptyMessage("rows", visibility, query)}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((row) =>
          row.blueprint !== undefined && row.summary.releaseCount > 0 ? (
            /* A strip UNDER the row rather than a zone inside it: `ContentRow` is the shelf's
               shared row and its three zones are spoken for, so an owner-only control has
               nowhere to sit in it — and this list is not the file that gets to widen a
               component `/blueprints` draws for every reader. The strip carries the row's own
               `p-[18px]` gutter and holds the control at zone 3's 236px (`ROW_GRID`), so the
               switch lands under the coverage strip instead of stretching the row's width. */
            <div key={row.summary.slug} className="flex flex-col gap-1.5">
              <ContentRow item={row.blueprint} />
              {owner && (
                <div className="rounded-lg border border-line bg-surface-2/40 px-[18px] py-3">
                  <RowVisibility
                    ownerHandle={ownerHandle}
                    slug={row.summary.slug}
                    visibility={row.summary.visibility}
                    className="w-full sm:ml-auto sm:w-[236px]"
                  />
                </div>
              )}
            </div>
          ) : (
            <SummaryRow key={row.summary.slug} row={row} owner={owner} ownerHandle={ownerHandle} />
          ),
        )}
      </div>

      {/* The owner's half of this panel came off on the owner's instruction (2026-08-26):
          two paragraphs explaining the draft state and where the rows are read from, to a
          reader who is looking at their own shelf and can see both. The VISITOR's sentence
          stays and the panel renders only for them, because it carries a disclosure rather
          than an explanation: a visitor cannot tell from an incomplete list that private
          bundles are missing from it, and from the counts, unless the page says so. */}
      {!owner && (
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 px-5 py-4 sm:flex-row sm:gap-5">
          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
            The model
          </span>
          <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
            <p>
              Every row is a bundle this account has made public, released or not. Private
              bundles are never listed here and no count on this page includes one.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
