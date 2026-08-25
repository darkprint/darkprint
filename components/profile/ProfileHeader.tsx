import type { Author } from "@/lib/types";
import { compact, monthYear } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { SupportButton, WatchButton } from "./SocialControls";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-56 LIVE: downloads and stars, off `getSignalsMany` (`components/profile/load.ts`).
// SEAM-57 LIVE: POST/DELETE /api/authors/{handle}/watch and .../support.

/* ============================================================
   Identity first, then what this account holds, then what you can do about it.

   Four things arrived here with the accounts pass, and T280 wired three of the four that
   were still seeded or switched off:

   - the **summary line** counts what the handle has authored. Counted off `content/`, so
     it carries no marker and needs none;
   - **community signals** (downloads, stars, validated) used to be their own amber panel
     below the fold, on `/u/[username]` only, before folding into this header (below the
     identity, in the same panel, on every profile tab). They are counted now —
     `downloads`/`stars` off `getSignalsMany`, `validated` off `getProfile`'s own count over
     run reports — so the panel carries `✓ counted` and no disclaimer. `reputation` stood
     here once and was dropped rather than folded in — nothing on the site ever explained
     what it measured or how it moved, where every figure that survived is a sum or a count
     over something else the account holds, so the doc can say in one sentence what the
     number is;
   - **community support** is a live toggle now (`SupportButton`), the endorsement half of
     `0004_social` (D-131-05) — no longer the static pill `FavoriteStar` draws for its own
     seeded branch;
   - **Watch** is a live toggle too (`WatchButton`), over `follow`. Both controls' own file
     states the one thing neither can know: whether THIS viewer already watches or supports
     this handle, before their first click in this session.

   The owner's two controls are the exception on THIS page, and only because both
   destinations are real: `Edit profile` opens `/settings` and `New bundle` opens the
   create flow at `/new`, which hands back a real bundle. Neither claims to write to an
   account beyond what it says.

   ── `validated`, and why it does not contradict `EvidenceLayers` ──
   "Blueprints of OTHER accounts this one downloaded, ran, and reported statistics for" is a
   claim about runs, and a given blueprint's own `Run evidence` panel
   (`components/blueprint/EvidenceLayers.tsx`) may still say "no verified runs" honestly —
   the two do not disagree. `validated` is `getProfile`'s own count over `run_report`
   (D-131-06, distinct bundles, public only, third parties only), which is real: T180 wires
   the submission `POST /api/blueprints/[owner]/[slug]/runs` reaches. What is still absent
   is INSTRUMENTATION — nothing here measures an actual execution, only what a caller
   self-reported after one — and that is the residual sentence `ProfileShell`'s own notice
   carries, not a claim this figure makes silently.
   ============================================================ */

export function ProfileHeader({
  author,
  blueprints,
  cards,
  downloads,
  stars,
  validated,
  joinedAt,
  watchers,
  support,
  owner = false,
  viewerSignedIn = false,
}: {
  author: Author;
  /** Counted off the archive by the caller. */
  blueprints: number;
  cards: number;
  /** Summed via `getSignalsMany` over this account's own live bundles (`load.ts`). */
  downloads: number;
  /** Summed via `getSignalsMany` over this account's own bundles and published cards. */
  stars: number;
  /** `getProfile`'s own count over `run_report` (T131, D-131-06). */
  validated: number;
  /** ISO date, rendered at month resolution. */
  joinedAt: string;
  watchers: number;
  support: number;
  /** Whether the reader is looking at their own profile. */
  owner?: boolean;
  /** Whether the reader has ANY session — what a non-owner needs to Watch or Support. */
  viewerSignedIn?: boolean;
}) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 sm:p-8">
      <div
        aria-hidden
        className="tech-grid pointer-events-none absolute inset-0 opacity-40"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar author={author} size="xl" />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
              {author.displayName}
            </h1>
            {author.validator && (
              <span
                title="Preview badge; validator voting is not built"
                className="inline-flex"
              >
                <Badge
                  color="var(--color-cyan)"
                  className="border-cyan/40! bg-cyan/10! text-cyan!"
                >
                  ✦ Validator
                </Badge>
              </span>
            )}
            {owner && (
              <span className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
                This is you
              </span>
            )}
          </div>

          <span className="font-mono text-sm text-muted">@{author.username}</span>

          {author.bio && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {author.bio}
            </p>
          )}

          {/* Counted, so no marker. The counts are `text-fg` against a `text-dim` line so
              the figures read first and the nouns second. */}
          <p className="mt-1 font-mono text-[11px] text-dim">
            <span className="text-fg">{blueprints}</span> blueprint
            {blueprints === 1 ? "" : "s"} · <span className="text-fg">{cards}</span> card
            {cards === 1 ? "" : "s"}
          </p>

          {/* Community signals, folded in from the panel that used to sit below the fold
              on the overview tab alone. `✓ counted` now: every figure on this line is a
              real sum or a real count (`load.ts`'s header has the ledger), so there is no
              amber marker left to carry and no disclaimer sentence to append. */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-dim">
            <span className="text-emerald" aria-hidden>
              ✓
            </span>
            <span className="text-fg">{compact(downloads)}</span> downloads
            <span className="text-faint">·</span>
            <span className="text-fg">{compact(stars)}</span> stars
            <span className="text-faint">·</span>
            <span className="text-fg">{compact(validated)}</span> validated
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {owner ? (
              <>
                <ButtonLink href="/settings" variant="outline">
                  Edit profile
                </ButtonLink>
                <ButtonLink href="/new">New bundle</ButtonLink>
              </>
            ) : (
              <>
                <WatchButton handle={author.username} watchers={watchers} signedIn={viewerSignedIn} />
                <SupportButton handle={author.username} support={support} signedIn={viewerSignedIn} />
              </>
            )}
          </div>
          <span className="font-mono text-[11px] text-dim">
            Joined {monthYear(joinedAt)}
          </span>
        </div>
      </div>
    </header>
  );
}
