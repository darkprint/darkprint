import Link from "next/link";

import type { OwnedBundle } from "@/lib/data/bundles";
import type { Blueprint } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { MetaPill } from "@/components/ui/MetaPill";
import { SupportPill } from "./parts";

/* ============================================================
   Your blueprints: one list, public and private together.

   The whole argument of the accounts pass is in this component's shape. There is one list,
   one row type and one model — a blueprint belongs to an account and is public or private.
   Some of them happen to have an upstream, and when they do the lineage renders as a line
   under the name. There is no `Forks` section, no fork tab and no second row component,
   because a fork is a fact about a bundle rather than a kind of bundle.

   ── Which half of a row is counted, and which is seeded ──
   A published row names a bundle in `content/`: its class, its digest and its date are read
   off the archive at build time and are exactly what `/blueprints/<slug>` prints. A private
   row is a fixture in `lib/data/bundles.ts` and nothing about it can be checked. The two
   are not marked row by row — a wall of `◐` would drown the list — but the section head
   says which is which, and the private rows are the ones that carry a version pill,
   because the archive has no version to print.

   ── No version pill on a published row, and that is not an omission ──
   A published bundle is addressed by the digest of its own bytes. There is no `version`
   field in `blueprint.yaml`, and there is no chain of releases behind one: the site's own
   position is that history here is a list of identities rather than a chain of patches. So
   a published row prints the digest the archive computed, a private row prints the version
   its fixture claims, and the note at the foot of the list says why they differ.

   ── One list for both readers ──
   A visitor gets this list too, on the author's instruction, rather than the tile grid it
   used to draw. A tile is a browsing surface: it crops the summary, drops the digest and
   the drift note, and puts three bundles on a row so the eye reads across a set instead of
   down a shelf. What a profile is for is the shelf. So the rows are identical for both
   readers and `owner` decides the three things that genuinely differ: where a row points,
   whether the visibility pill means anything, and whether there are controls at all.
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

function Row({ row, owner }: { row: OwnedRow; owner: boolean }) {
  const { bundle, blueprint } = row;
  const draft = bundle.draft;
  const isPrivate = bundle.visibility === "private";

  const summary = blueprint?.summary ?? draft?.summary ?? "";
  const autonomy = blueprint?.autonomy.label ?? draft?.autonomy ?? "";
  const digest = blueprint === undefined ? draft?.digest : `${blueprint.digest.slice(0, 13)}…`;
  const edited = prettyDate(blueprint?.updatedAt ?? draft?.editedAt ?? "");

  return (
    <div className="flex flex-col gap-5 border-b border-line p-5 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* The owner's row points at the owner's own view of the bundle, published or
              not. A published one also has a public page, and the owner view links to it
              from its aside rather than the list offering two destinations for one name.
              A visitor has no owner view to go to: `/u/<handle>/<slug>` is prerendered
              only for the bundles the account fixture holds, so a visitor row that pointed
              there would 404 on every profile but one. */}
          <Link
            href={owner ? `/u/${bundle.owner}/${bundle.slug}` : `/blueprints/${bundle.slug}`}
            className="font-display text-lg font-semibold text-cyan transition-colors hoverable:hover:text-cyan-bright"
          >
            {bundle.slug}
          </Link>
          {/* Only on the owner's list, where it tells two kinds of row apart. Every row a
              visitor can see is public, so the pill would be the same word on every one of
              them, which is a legend for a distinction that is not being drawn. */}
          {owner && <MetaPill tone="surface">{isPrivate ? "Private" : "Public"}</MetaPill>}
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

        <p className="max-w-[52ch] text-sm leading-relaxed text-muted">{summary}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[11px]">
          <span className="text-muted">{autonomy}</span>
          <span className="text-dim">{digest}</span>
          <span className="text-dim">edited {edited}</span>
          {bundle.drift !== undefined && (
            <span className={DRIFT_TONE[bundle.drift.tone]}>{bundle.drift.note}</span>
          )}
          {blueprint !== undefined && <SupportPill count={blueprint.votes} />}
        </div>
      </div>

      {/* No controls column at all for a visitor, rather than a disabled one: `Publish`
          and the overflow menu are the owner's affordances, and drawing them switched off
          on somebody else's shelf would offer a reader actions over a bundle that is not
          theirs. The honesty markers are for controls that will exist, not for controls
          that will never belong to this reader. */}
      {owner && (
        <div className="flex shrink-0 flex-col items-start gap-2 sm:w-[200px] sm:items-end">
          <div className="flex items-center gap-2">
            {isPrivate && (
              <Button
                size="sm"
                variant="outline"
                disabled
                title={
                  bundle.drift?.tone === "blocked"
                    ? "This bundle does not resolve, so it could not publish even with a registry behind it."
                    : "Nothing publishes yet: there is no account and no registry write path."
                }
              >
                Publish
              </Button>
            )}
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
          {isPrivate && (
            <span
              className={cx(
                "font-mono text-[11px] sm:text-right",
                bundle.drift?.tone === "blocked" ? "text-amber" : "text-dim",
              )}
            >
              {bundle.drift?.tone === "blocked"
                ? "will not publish until it resolves"
                : "only you can see this"}
            </span>
          )}
        </div>
      )}
    </div>
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

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-5 py-4">
        <h2 className="label-lead">{owner ? "Your blueprints" : "Published blueprints"}</h2>
        <span className="font-mono text-[11px] text-dim">
          {owner ? `${publicCount} public · ${privateCount} private` : `${rows.length} in the registry`}
        </span>
      </div>

      {rows.map((row) => (
        <Row key={row.bundle.slug} row={row} owner={owner} />
      ))}

      <div className="flex flex-col gap-4 bg-surface-2/50 px-5 py-4 sm:flex-row sm:gap-5">
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
              The public rows are read off the archive, digest and all; the star figure
              beside one is seeded community support, because there is no ballot. The
              private rows are seeded whole, in{" "}
              <span className="font-mono text-fg">lib/data/bundles.ts</span>, and nothing
              stores them: they carry a version because a fixture claims one, where a
              published bundle is addressed by the digest of its own bytes.
            </p>
          ) : (
            <p>
              Every row is a bundle in <span className="font-mono text-fg">content/</span>,
              read off the archive at build time, digest and all. Private bundles are never
              listed here and no count on this page includes one. The star figure beside a
              row is seeded community support, because there is no ballot.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
