import type { Author } from "@/lib/types";
import { compact, monthYear } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";

/* ============================================================
   Identity first, then what this account holds, then what you can do about it.

   Three things arrived here with the accounts pass, and two of them are controls that do
   not work. That is stated rather than styled around:

   - the **summary line** counts what the handle has authored. Counted off `content/`, so
     it carries no marker and needs none;
   - **community support** is the seeded figure `FavoriteStar` prints beside a blueprint,
     in the same bordered pill with the same amber `◐`. There is no ballot;
   - **Watch** would need somewhere to write a follow, and there is nowhere. It renders
     switched off with the seeded count beside it rather than as a button that swallows a
     click.

   The owner's two controls are the exception, and only because both destinations are real:
   `Edit profile` opens `/settings` and `New blueprint` opens the workspace at `/build`,
   which really does hand back a bundle. Neither claims to write to an account, and the
   page says above them that nothing does.
   ============================================================ */

export function ProfileHeader({
  author,
  blueprints,
  cards,
  joinedAt,
  watchers,
  support,
  owner = false,
}: {
  author: Author;
  /** Counted off the archive by the caller. */
  blueprints: number;
  cards: number;
  /** ISO date, rendered at month resolution. */
  joinedAt: string;
  watchers: number;
  support: number;
  /** Whether the reader is looking at their own profile. */
  owner?: boolean;
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
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            {owner ? (
              <>
                <ButtonLink href="/settings" variant="outline">
                  Edit profile
                </ButtonLink>
                <ButtonLink href="/build">New blueprint</ButtonLink>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled
                  title="Nothing stores a follow yet: there are no accounts behind this page."
                >
                  Watch <span className="font-mono text-[11px] text-dim">{watchers}</span>
                </Button>
                {/* The same pill `FavoriteStar` draws for its seeded branch, at the one
                    place on the site where the subject is a person rather than a bundle.
                    Spelled out rather than mounted, because that component's own control
                    is a bookmark for a *thing* and there is nothing here to bookmark. */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-muted"
                  title="Seeded support count; no community backend is connected"
                  aria-label={`${support} community stars, seeded`}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    width={14}
                    height={14}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                  >
                    <path d="M12 3.5l2.47 5.006 5.53.804-4 3.9.944 5.507L12 16.9l-4.944 2.6.944-5.507-4-3.9 5.53-.804L12 3.5z" />
                  </svg>
                  {compact(support)}
                  <span className="text-amber" aria-hidden>
                    ◐
                  </span>
                </span>
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
