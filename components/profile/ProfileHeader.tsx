import type { Author } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

/** Identity first; the validator badge is explicitly marked as a preview signal. */
export function ProfileHeader({ author }: { author: Author }) {
  return (
    <header className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 sm:p-8">
      <div
        aria-hidden
        className="tech-grid pointer-events-none absolute inset-0 opacity-40"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar author={author} size="xl" />

        <div className="flex flex-col gap-2">
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
          </div>

          <span className="font-mono text-sm text-muted">
            @{author.username}
          </span>

          {author.bio && (
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
              {author.bio}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
