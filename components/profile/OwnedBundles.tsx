"use client";

import Link from "next/link";

import type { OwnedBundle } from "@/lib/data/bundles";
import type { Blueprint } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { useQueryState } from "@/components/ui/useQueryState";
import { Button } from "@/components/ui/Button";
import { MetaPill } from "@/components/ui/MetaPill";
import { CARD_SHELL } from "@/components/ui/ContentCard";
import { ContentRow, ROW_GRID, RowThumbFrame } from "@/components/ui/ContentRow";

/* ============================================================
   Your blueprints: one list, public and private together, one row TEMPLATE for all of it.

   Published rows draw `ContentRow` itself, the same component `/blueprints` draws.
   `ContentRow` takes `item: AnyContent`, a fully resolved archive entry with a graph and
   an analysis, which a private row does not have and cannot fabricate — `lib/data/
   bundles.ts`'s own header states the rule this follows from: **a seeded bundle is always
   private**, and a public bundle is a claim about the registry a fixture cannot make true.
   So `blueprint` presence on a row IS the test for which branch it takes, not an
   incidental fact about today's seed data.

   `DraftRow` below is what a private row draws instead, and the first pass got this wrong:
   it drew its own frame (`flex flex-col … sm:flex-row`), so the two published rows on this
   shelf read as gallery rows and the three private ones read as a leftover list underneath
   them — the author flagged exactly that ("not every blueprint … has changed the
   template"). `DraftRow` now imports `ROW_GRID` and `RowThumbFrame` from `ContentRow`
   itself rather than reconstructing them, so the two components are provably the same
   three-zone shape (`380px_minmax(0,1fr)_236px`) and cannot drift apart the way two
   independently-written "looks similar" rows would. What differs is only what each zone
   is FILLED with:

   - zone 1: `ContentRow` draws `GraphThumbnail`; `DraftRow` draws the frame with nothing
     in it but a status word, because a draft's graph genuinely does not exist — there is
     no digest to hash it into (`Draft.digest` is a sentence, not a hash, on a bundle that
     does not resolve) and borrowing the upstream's graph for a fork would draw a topology
     this bundle does not have. `border-dashed` on the frame is the site's existing
     register for "nothing lives here yet" (`EmptyState`, `BundleDropzone`).
   - zone 2: the draft's real fields — slug, Private pill, version pill, forked pill and
     lineage line, summary, autonomy, digest (or the sentence explaining its absence),
     edited date, drift note. Same typography as `ContentRow`'s zone 2, because a reader
     comparing rows down a shelf should not have to recalibrate type scale mid-list.
   - zone 3: `ContentRow` draws the coverage strip and the date/forks/resolved line;
     `DraftRow` has no coverage to strip (no analysis) and draws the owner controls
     (`Publish`, overflow) and the "only you can see this" / "will not publish" caption in
     the same slot instead — the same fields the pre-template row put beside a private
     entry, just aligned to the shared column rather than to a bespoke one.

   A visitor never sees a `DraftRow`: every row `/u/[username]/blueprints` builds for a
   visitor comes from `allBlueprints()` and always carries a `blueprint`
   (`components/profile/load.ts`), so `owner` is true on every `DraftRow` this app renders
   today. The prop stays rather than being inlined to `true`, because "a private row is
   owner-only" is a fact about the data, not about this component, and asserting it here
   would be asserting something this file cannot check.

   ── Violet, unconditionally, on the whole row ──
   `Private` took violet on the author's instruction (`app/globals.css`'s accent comment
   carries the reasoning). Every `DraftRow` is a private row — the file docblock above
   already establishes that — so the tint is not an `isPrivate` branch inside this
   component, it is simply what `DraftRow` always draws.

   ── A client component now, for the visibility filter ──
   `useQueryState` reads the same `?visibility=` key `VisibilityFilter` writes, with no
   prop between them — the address bar is the connection, the same shape `GalleryBrowser`
   and `NodeBrowser` use for their own filters. Filtering runs on both branches: a
   visitor's rows are always `public`, so the filter is inert there rather than absent,
   which is simpler than threading `owner` through to suppress it and no less honest — an
   inert filter still answers correctly, it just never has a second answer to give.
   ============================================================ */

/** One row, with its archive half resolved by the caller when there is one. */
export interface OwnedRow {
  bundle: OwnedBundle;
  /** Present exactly when `bundle.draft` is absent. */
  blueprint?: Blueprint;
}

const DRIFT_TONE = {
  ok: "text-emerald",
  moved: "text-amber",
  blocked: "text-amber",
} as const;

/** A private, unpublished bundle: fixture data only, so it cannot become a `ContentRow`. */
function DraftRow({ row, owner }: { row: OwnedRow; owner: boolean }) {
  const { bundle } = row;
  const draft = bundle.draft;
  const blocked = bundle.drift?.tone === "blocked";

  return (
    <article
      className={cx(
        CARD_SHELL,
        ROW_GRID,
        /* `!` for the reason `NodeCardSummary` states in full: `cx` does not de-duplicate
           or order classes by specificity, so overriding `CARD_SHELL`'s own
           `border-line` needs `!important` rather than append-and-hope. */
        "border-violet/60! hoverable:hover:border-violet!",
      )}
    >
      {/* ---------- zone 1: no drawing to draw ----------
          Dashed rather than `ContentRow`'s solid frame: the site's own register for
          "nothing lives here yet" rather than a graph this bundle cannot produce. */}
      <RowThumbFrame className="flex items-center justify-center border-dashed">
        <span className="px-4 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
          {blocked ? "does not resolve" : "no graph published"}
        </span>
      </RowThumbFrame>

      {/* ---------- zone 2: what the draft claims about itself ---------- */}
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* The owner's row points at the owner's own view of the bundle. A visitor never
              reaches a `DraftRow` at all — every bundle a visitor's list holds resolves to
              a `blueprint` and takes the `ContentRow` branch above instead. */}
          <Link
            href={`/u/${bundle.owner}/${bundle.slug}`}
            className="font-display text-lg font-semibold text-cyan transition-colors hoverable:hover:text-cyan-bright"
          >
            {bundle.slug}
          </Link>
          {/* Not `MetaPill`: that component's own docblock is explicit that it keeps to
              two tones "because a row of five differently-lit pills stops ranking
              anything," and widening it to a third would break that rule for every
              other caller to buy this one row a colour. Same shape, spelled out. */}
          <span className="shrink-0 rounded-full border border-violet/60 px-2.5 py-0.5 font-mono text-[11px] text-violet">
            Private
          </span>
          {draft !== undefined && <MetaPill>{draft.version}</MetaPill>}
          {bundle.forkedFrom !== undefined && <MetaPill>forked</MetaPill>}
        </div>

        {/* Only when there is an upstream. A row without one prints nothing here rather
            than "not a fork", which would make lineage read as a property every bundle
            has an answer to. */}
        {bundle.forkedFrom !== undefined && (
          <p className="font-mono text-[11px] text-dim">
            forked from{" "}
            <Link
              href={`/blueprints/${bundle.forkedFrom.slug}`}
              className="text-muted transition-colors hoverable:hover:text-cyan"
            >
              {bundle.forkedFrom.owner} / {bundle.forkedFrom.slug}
            </Link>{" "}
            at {bundle.forkedFrom.version}
          </p>
        )}

        <p className="line-clamp-3 text-sm leading-snug text-muted">{draft?.summary ?? ""}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5 font-mono text-[11px] text-dim">
          <span className="text-muted">{draft?.autonomy ?? ""}</span>
          <span>{draft?.digest}</span>
          <span>edited {prettyDate(draft?.editedAt ?? "")}</span>
          {bundle.drift !== undefined && (
            <span className={DRIFT_TONE[bundle.drift.tone]}>{bundle.drift.note}</span>
          )}
        </div>
      </div>

      {/* ---------- zone 3: no coverage to strip, the owner's controls instead ----------
          A private row is never rendered for a visitor at all (see the file docblock), so
          unlike the pre-template row this branch does not need an `owner` guard of its
          own — it stays on the prop so the fact stays checkable rather than assumed. */}
      {owner && (
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled
              title={
                blocked
                  ? "This bundle does not resolve, so it could not publish even with a registry behind it."
                  : "Nothing publishes yet: there is no account and no registry write path."
              }
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled
              aria-label="More actions"
              title="Nothing here is stored yet."
              className="w-8 px-0!"
            >
              <span aria-hidden>⋯</span>
            </Button>
          </div>
          <span
            className={cx(
              "font-mono text-[11px] sm:text-right",
              blocked ? "text-amber" : "text-dim",
            )}
          >
            {blocked ? "will not publish until it resolves" : "only you can see this"}
          </span>
        </div>
      )}
    </article>
  );
}

export function OwnedBundles({
  rows,
  owner,
}: {
  rows: readonly OwnedRow[];
  /**
   * Whether the seeded signed-in handle is the one whose shelf this is.
   *
   * It decides the heading, the count, the controls and the destination of a row, and it
   * is a prop rather than a second component because there is one blueprint list on this
   * site: two components would be two places for the row to drift.
   */
  owner: boolean;
}) {
  const publicCount = rows.filter((r) => r.bundle.visibility === "public").length;
  const privateCount = rows.length - publicCount;

  /* The same key `VisibilityFilter` writes, read independently — see the file docblock.
     `visible` narrows the shelf; `publicCount`/`privateCount` above still describe the
     full list, because the header states a fact about the account and a filter deciding
     what's on screen should not also rewrite what the account holds. */
  const { params } = useQueryState();
  const visibility = params.get("visibility");
  const visible =
    visibility === null ? rows : rows.filter((row) => row.bundle.visibility === visibility);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="label-lead">{owner ? "Your blueprints" : "Published blueprints"}</h2>
        <span className="font-mono text-[11px] text-dim">
          {owner ? `${publicCount} public · ${privateCount} private` : `${rows.length} in the registry`}
        </span>
      </div>

      {visible.length === 0 && (
        <p className="rounded-lg border border-dashed border-line bg-surface/40 px-5 py-8 text-center font-mono text-[13px] text-dim">
          No {visibility} rows on this shelf.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((row) =>
          row.blueprint !== undefined ? (
            <ContentRow
              key={row.bundle.slug}
              item={row.blueprint}
              lineage={row.bundle.forkedFrom}
            />
          ) : (
            <DraftRow key={row.bundle.slug} row={row} owner={owner} />
          ),
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 px-5 py-4 sm:flex-row sm:gap-5">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-dim">
          The model
        </span>
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
          <p>
            A blueprint belongs to an account and is public or private. Some of them started
            as a copy of somebody else&rsquo;s, and those keep a pointer at what they came
            from so the registry can say when the upstream repins a card. Being a fork is a
            fact about a bundle, not a kind of bundle.
          </p>
          {/* The second paragraph is about where the rows came from, so it says something
              different to each reader. A visitor is looking at the archive and nothing
              else; the owner is looking at the archive and at fixtures at the same time,
              which is the sentence that has to be on the owner's list and would be a
              falsehood on anybody else's. */}
          {owner ? (
            <p>
              The public rows are the same row{" "}
              <span className="font-mono text-fg">/blueprints</span> draws, resolved off
              the archive. The private rows are seeded whole, in{" "}
              <span className="font-mono text-fg">lib/data/bundles.ts</span>, and nothing
              stores them: they carry a version because a fixture claims one, where a
              published bundle is addressed by the digest of its own bytes.
            </p>
          ) : (
            <p>
              Every row is a bundle in <span className="font-mono text-fg">content/</span>,
              read off the archive at build time and drawn with the same row{" "}
              <span className="font-mono text-fg">/blueprints</span> uses. Private bundles
              are never listed here and no count on this page includes one.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
