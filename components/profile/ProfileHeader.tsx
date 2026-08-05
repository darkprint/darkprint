import type { Author } from "@/lib/types";
import { compact } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Stat } from "@/components/ui/Stat";

/**
 * Identity block for a builder's profile: gradient avatar, name, handle,
 * the validator badge and the standout reputation number.
 *
 * Both of those last two are seeded, and the copy has to say so in the present tense
 * rather than describing the design as if it had shipped: `reputation` is a literal in
 * `lib/data/users.ts` and `validator` is a boolean beside it. Nothing in this repository
 * records a ballot, so nothing accrues and no vote is weighted — which is exactly what
 * the homepage's telemetry section already says.
 */
export function ProfileHeader({ author }: { author: Author }) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div
        aria-hidden
        className="tech-grid pointer-events-none absolute inset-0 opacity-40"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar author={author} size="xl" />

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
                {author.displayName}
              </h1>
              {author.validator && (
                <span
                  title="Seeded badge, votes are designed to carry extra weight, but voting is not built"
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
            </div>

            <span className="font-mono text-sm text-muted">
              @{author.username}
            </span>

            {author.bio && (
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                {author.bio}
              </p>
            )}

            {author.validator && (
              <span className="mt-1 font-mono text-[11px] tracking-wide text-cyan/80">
                ✦ Validator, designed to weight votes; voting is not built
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-line pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
          <Stat
            value={compact(author.reputation)}
            label="Reputation"
            accent="var(--color-violet)"
          />
          <span className="max-w-[14rem] font-mono text-[11px] leading-relaxed text-dim">
            <span className="text-amber" aria-hidden>
              ◐
            </span>{" "}
            <span className="uppercase tracking-[0.12em] text-amber">seeded</span>:
            nothing accrues it yet
          </span>
        </div>
      </div>
    </header>
  );
}
