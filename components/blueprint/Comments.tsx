import type { Comment } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { More } from "@/components/ui/More";

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
 *
 * PROJECT.md §3.1: the first note is open and the rest sit behind a disclosure. The
 * count in the heading is of all of them, the `◐ seeded` marker and the sentence about
 * there being no form, no account and no ballot are outside the disclosure, and every
 * note is still in the prerendered HTML for find-in-page. Nothing here is folded that a
 * reader would be misled by not seeing.
 */
/** How many notes stand open before the rest go behind the disclosure. */
const OPEN_NOTES = 1;

export function Comments({ comments }: { comments: Comment[] }) {
  const open = comments.slice(0, OPEN_NOTES);
  const folded = comments.slice(OPEN_NOTES);
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
            no form on this page and no runner behind it, so posting is not built.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <NoteList comments={open} />
          {folded.length > 0 && (
            <More
              summary={`${folded.length} more note${folded.length === 1 ? "" : "s"}, seeded like the first`}
            >
              <NoteList comments={folded} />
            </More>
          )}
        </div>
      )}
    </section>
  );
}

function NoteList({ comments }: { comments: Comment[] }) {
  return (
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
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
