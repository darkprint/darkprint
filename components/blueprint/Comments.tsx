import type { Comment } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Community notes on a blueprint. Validators are flagged inline — their votes
 * carry more weight, so it matters who is talking. Server-rendered; no state.
 */
export function Comments({ comments }: { comments: Comment[] }) {
  return (
    <section aria-labelledby="community-notes">
      <h2
        id="community-notes"
        className="mb-4 font-display text-xl font-semibold text-fg"
      >
        Community notes{" "}
        <span className="font-mono text-sm font-normal text-dim">
          ({comments.length})
        </span>
      </h2>

      {comments.length === 0 ? (
        <div className="panel px-5 py-8 text-center">
          <p className="text-sm text-muted">No notes yet.</p>
          <p className="mt-1 text-xs text-dim">
            Run this blueprint and be the first to report how it behaves.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="panel p-4">
              <div className="flex items-start gap-3">
                <Avatar author={c.author} size="md" link />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-fg">
                      {c.author.displayName}
                    </span>
                    {c.author.validator && (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-cyan">
                        ✦ validator
                      </span>
                    )}
                    <span className="text-faint">·</span>
                    <span className="font-mono text-[11px] text-dim">
                      {prettyDate(c.createdAt)}
                    </span>
                    <span
                      className="ml-auto font-mono text-[11px] text-emerald"
                      title={`${c.votes} up-votes`}
                    >
                      ▲ {c.votes}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {c.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
