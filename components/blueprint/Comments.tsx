import type { Comment } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Community notes on a blueprint. Validators are flagged inline — the design gives
 * their votes more weight, so it matters who is talking — but the badge is a seeded
 * boolean and no vote is weighted anywhere yet. Server-rendered; no state, and no
 * form: every note here comes out of `lib/data/community.ts`.
 *
 * The empty state said all of that and the populated one said none of it, so a blueprint
 * that happened to have a note rendered a named author, a date and a vote count as facts
 * (doc 2 §0.4). The marker is on the heading now, where it is read whichever branch the
 * list takes, and it is the same `◐ seeded` the scorecard and `/u/` use.
 */
export function Comments({ comments }: { comments: Comment[] }) {
  return (
    <section aria-labelledby="community-notes">
      <h2
        id="community-notes"
        className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl font-semibold text-fg"
      >
        Community notes{" "}
        <span className="font-mono text-sm font-normal text-dim">
          ({comments.length})
        </span>
        <span className="font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-amber">
          <span aria-hidden>◐ </span>seeded
        </span>
      </h2>
      {comments.length > 0 && (
        <p className="-mt-2 mb-4 text-xs leading-relaxed text-dim">
          Rows in the index, authors included. There is no form on this page, no account
          behind a name and no ballot behind a count.
        </p>
      )}

      {comments.length === 0 ? (
        <div className="panel px-5 py-8 text-center">
          <p className="text-sm text-muted">No notes yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-dim">
            Notes are seeded rows in the index, and this blueprint has none. There is
            no form on this page and no runner behind it — posting is not built.
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
