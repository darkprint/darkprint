import Link from "next/link";

import type { Lineage } from "@/lib/data/bundles";
import type { Author } from "@/lib/types";
import { ActionPill } from "@/components/ui/ActionPill";
import { Avatar } from "@/components/ui/Avatar";
import { FavoriteStar } from "@/components/ui/FavoriteStar";
import { MetaPill } from "@/components/ui/MetaPill";
import { ForkButton } from "@/components/bundle/ForkButton";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-20 LIVE (T280): the Star control (`star`) and the Fork button (`fork`, SEAM-70) each
// take an additive prop below. Absent, each draws the same pill switched off, with a `title`
// naming what is not stored yet.
// SEAM-57 (watch) is no longer anchored here. The owner asked the Watch pill off this band
// on 2026-09-06; the seam is still LIVE and `components/profile/ProfileHeader.tsx` still
// mounts a Watch control over it, so the route is unchanged and only this file's stake in
// it is gone.

/* ============================================================
   The band a bundle opens with: who owns it, what it is called, where it came from.

   `owner / slug` in `font-display text-xl`, the way a repository names itself. The slug
   carries the weight (`font-semibold`) because the handle is context and the name is the
   subject, and the separator is `text-faint` — the one token on this site that may never
   be live text, which is exactly right for a slash nobody reads.

   ── The action row: Star, Fork, download (owner, 2026-09-06) ──
   The owner named the order and the third slot in one sentence: "remove the Code button and
   move on top right on the side right of the Star; the order should be: star, fork, download
   blueprint." So the row is two split pills (`ActionPill`) and then whatever the caller puts
   in `download`, left to right.

   `Watch` LEFT, and the `watchers` count went with it. It was GitHub's first pill and it was
   never GitHub's verb here: `/api/authors/{handle}/watch` follows the PERSON who owns the
   bundle, so a pill on a bundle's band offered to subscribe a reader to something they were
   not looking at. The route is untouched and `components/profile/ProfileHeader.tsx` still
   draws a Watch control on the profile it actually addresses.

   `Get the folder` CAME BACK, as `download`. It spent one pass as a `Code` dropdown on the
   file list's header row, which is GitHub's shape; the owner asked it back into the band, on
   the right of Star and Fork. The slot is a `ReactNode` rather than `CodeMenu`'s props
   because a blueprint and a card do not hand over the same thing: this page passes
   `components/bundle/CodeMenu.tsx` in cyan, and a card's page passes its own control in
   copper (`--color-copper-line`), which is what tells the two registers apart.

   `Save` FOLDED INTO `Star`. They were a private bookmark and a public counter drawn as
   two adjacent controls; the owner ruled them one concept, so `FavoriteStar` draws a
   single starred/unstarred pill here and writes the account save behind it (see that
   file's header for what the Saved tab reads and why the save write survives the fold).
   A `support` figure still draws the same pill switched off and marked `◐`, because the
   fold changed how many controls a reader sees and not whether a seeded number says so.

   `Fork` and `Star` each take an additive prop (`fork`, `star`) that swaps a
   drawn-and-disabled pill for a live control over `/api/bundles/[owner]/[slug]/fork` and
   `lib/server/counters`. A caller supplying neither gets two switched-off pills, each saying
   in its `title` what is missing — which is the state `DraftLanding` is in, and it is
   accurate there: a bundle with no release has no counter row to fork or star.
   ============================================================ */

export function BundleHeader({
  owner,
  slug,
  visibility,
  summary,
  lineage,
  driftNote,
  forks,
  saveId,
  support,
  breadcrumb,
  title,
  validator = false,
  below,
  note,
  children,
  star,
  fork,
  download,
  identityMeta,
}: {
  owner: Author;
  slug: string;
  /**
   * Omitted draws no pill at all, which is a card's answer rather than a bundle's: a card
   * version is reachable exactly when the blueprint pinning it is, so it holds no visibility
   * column of its own to state. A bundle always passes one.
   */
  visibility?: "public" | "private";
  summary: string;
  lineage?: Lineage;
  /** The clause after the lineage, when the upstream has moved. Amber where it renders. */
  driftNote?: string;
  forks: number;
  /**
   * `FavoriteStar`'s compound key, so a bundle and a card can never collide.
   *
   * Still required after the fold: it is what tells the star control whether the account
   * can hold a save for this target. For a blueprint the answer is no (D-262-04), and the
   * key is what makes that a decision the control takes rather than one it guesses.
   */
  saveId: string;
  /**
   * A star figure the caller holds from a fixture rather than from `getSignals`.
   *
   * Absent rather than zero where there is none: a bundle nobody can see has not been
   * starred down to nothing, it has never had a counter row. It draws the same pill `star`
   * draws, switched off and marked `◐` — the marker stays because the figure is still
   * illustrative on this path (D-262-07), and a caller with a live count passes `star`.
   */
  support?: number;
  /* ---- the four slots the published view fills and the owner view does not ---- */
  /** The row above the identity line: where a reader came from. */
  breadcrumb?: React.ReactNode;
  /** The bundle's human name. A published blueprint has one; a private copy is its slug. */
  title?: string;
  /** The owner's `✦ validator` mark, beside the visibility pill. */
  validator?: boolean;
  /** Under the actions: the version line on the published view. */
  below?: React.ReactNode;
  /**
   * A statement under the actions, for a caller that has one. There is no default: the
   * sentence that used to fill it (`a snapshot over HTTP, not a clone`) described the
   * download button, and the limit is stated inside the download's own panel now — in
   * `CodeMenu`, beside the command it is a limit on, rather than under a row of pills.
   */
  note?: string;
  /** Under the summary: the kind badge, the autonomy reading, the tags. */
  children?: React.ReactNode;
  /** T280: the Star control, live. It is the save gesture too — see `FavoriteStar`. */
  star?: { api: string; count: number; starred: boolean; signedIn: boolean };
  /** T280: the Fork button, live. Wins over the drawn-and-disabled default. */
  fork?: { api: string; sourceVersion: string; signedIn: boolean; viewerHandle?: string };
  /**
   * The third control in the action row, right of Fork: how a reader takes the thing.
   *
   * A node rather than a props bag, because the two callers hand over two different objects
   * and in two different registers. The blueprint page passes `CodeMenu` (cyan, the
   * blueprint's colour); a card's page passes its own control in copper. Absent draws
   * nothing at all, which is what a bundle with no fetchable release wants — a control whose
   * command names a version it does not have is a control that refuses.
   */
  download?: React.ReactNode;
  /**
   * Extra chips in the identity line, after the visibility pill and the forked marker.
   *
   * For a subject whose last identity slot is not a visibility: a card puts its version
   * there, which is the other half of `owner / id` and the fact a reader needs before
   * copying anything below.
   */
  identityMeta?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="container-page flex flex-col gap-5 py-8">
        {/* The identity and the actions share a row. The summary and the chips do NOT sit in
            it: they are below, at the band's full width. See the note above the summary. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            {breadcrumb}
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2">
                <Avatar author={owner} size="sm" link />
                <Link
                  href={`/u/${owner.username}`}
                  className="font-display text-xl text-cyan transition-colors hoverable:hover:text-cyan-bright"
                >
                  {owner.username}
                </Link>
              </span>
              <span aria-hidden className="font-display text-xl text-faint">
                /
              </span>
              <span className="font-display text-xl font-semibold text-fg">{slug}</span>
              {visibility !== undefined && (
                <MetaPill tone="surface">
                  {visibility === "private" ? "Private" : "Public"}
                </MetaPill>
              )}
              {lineage !== undefined && <MetaPill>forked</MetaPill>}
              {identityMeta}
              {validator && (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan">
                  ✦ validator
                </span>
              )}
            </div>

            {/* The name, under the identity line rather than instead of it. A slug is what a
                bundle is addressed by and a title is what it is called, and the published view
                needs both: the breadcrumb above and the download command below both name the
                slug, and the `h1` is what a reader arrives for. */}
            {title !== undefined && (
              <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-fg">
                {title}
              </h1>
            )}

            {lineage !== undefined && (
              <p className="font-mono text-[11px] text-dim">
                forked from{" "}
                <Link
                  href={`/blueprints/${lineage.slug}`}
                  className="text-muted transition-colors hoverable:hover:text-cyan"
                >
                  {lineage.owner} / {lineage.slug}
                </Link>{" "}
                at {lineage.version}
                {driftNote !== undefined && (
                  <>
                    {" · "}
                    <span className="text-amber">{driftNote}</span>
                  </>
                )}
              </p>
            )}

            {/* No width cap. Both branches carried `max-w-2xl`, which is 672px inside a
                1200px `container-page`, so the summary broke about where the reader's eye
                had another 500px of empty band to the right of it. The owner asked for this
                line specifically, on 2026-09-04: "the description below the blueprint name
                should be extended in full horizontal space". It is also the site-wide rule
                this repository already holds elsewhere, and a cap here was the exception
                rather than the pattern. The two branches now differ only in type size, which
                is the one thing they were ever meant to differ in. */}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            {/* Star, Fork, download, left to right, on the owner's instruction of 2026-09-06.
                The download is last because it is the one control that opens a panel under
                itself: `CodeMenu`'s dropdown is anchored `right-0`, and only the final item in
                a wrapping row is guaranteed to end at the group's own right edge. */}
            <div className="flex flex-wrap items-center gap-2">
              {star !== undefined ? (
                <FavoriteStar id={saveId} star={star} />
              ) : support !== undefined ? (
                <FavoriteStar id={saveId} count={support} seeded />
              ) : (
                /* Zero, and it is not a stand-in: `lib/server/counters` keys a target by a
                   released bundle's row, so a caller with neither prop is a bundle no counter
                   has ever had a row for. Nobody has starred it because nobody could, which
                   is why this one carries no `◐` — the number is not illustrative, it is the
                   count. */
                <ActionPill
                  glyph="star"
                  label="Star"
                  count={0}
                  disabled
                  title="Nothing stores a star for this bundle yet."
                />
              )}
              {fork === undefined ? (
                <ActionPill
                  glyph="fork"
                  label="Fork"
                  count={forks}
                  disabled
                  title="Nothing copies this bundle into an account yet. Take the folder from the download beside this instead."
                />
              ) : (
                <ForkButton
                  api={fork.api}
                  sourceVersion={fork.sourceVersion}
                  signedIn={fork.signedIn}
                  viewerHandle={fork.viewerHandle}
                  forks={forks}
                />
              )}
              {download}
            </div>
            {below}

            {note !== undefined && (
              <span className="font-mono text-[11px] text-dim">{note}</span>
            )}
          </div>
        </div>

        {/* THE SUMMARY IS NOT IN THE ROW ABOVE, and that is the whole point of the nesting.
            Owner instruction, 2026-09-06: "make the description below the name of a card or a
            blueprint occupy full horizontal space."

            The cap came off this paragraph on 2026-09-04 and it was still not full width,
            which is why the instruction came a second time. `max-w-2xl` was only half the
            constraint; the other half was structural. While the summary sat in the left
            column of a `lg:justify-between` row, the action pills set its right edge, so it
            measured 743px inside a 1200px band and broke with 457px of empty band beside it.
            A reader cannot tell that from a cap, because there is no cap to find.

            The chips travel with it so the reading order is unchanged: title, summary, chips.
            `min-w-0` is gone with the column and is not needed here, since this is a block in
            a column rather than a flex child that could refuse to shrink. */}
        <div className="flex flex-col gap-2">
          <p
            className={
              title === undefined
                ? "text-sm leading-relaxed text-muted"
                : "text-lg leading-relaxed text-muted"
            }
          >
            {summary}
          </p>

          {children}
        </div>
      </div>
    </header>
  );
}
