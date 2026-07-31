"use client";

import { useState } from "react";
import type { Comment } from "@/lib/types";
import { prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * Community notes on a blueprint. Validators are flagged inline — the design gives
 * their votes more weight, so it matters who is talking — but the badge is a seeded
 * boolean and no vote is weighted anywhere yet. No form: every note here comes out
 * of `lib/data/community.ts`, static seed data with no pagination or fetch behind it.
 *
 * The empty state said all of that and the populated one said none of it, so a blueprint
 * that happened to have a note rendered a named author, a date and a vote count as facts
 * (doc 2 §0.4). The marker is on the heading now, where it is read whichever branch the
 * list takes, and it is the same `◐ seeded` the scorecard and `/u/` use.
 *
 * PROJECT.md §3.1 originally put one note open and the rest behind a `<details>`
 * disclosure. This pass raises that to the first 10 and swaps the disclosure for a real
 * "Load more" button — a `<button>`, not a triangle — since a growing list of notes reads
 * better as "here's the first page, ask for the rest" than as a single fold. That reveal
 * needs client-side state, and since the whole point of the change is one small
 * `useState` living beside the heading and empty state this component already renders,
 * this file is a client component rather than splitting the toggle into a second file for
 * a handful of lines. Worth being honest about the one thing that changes as a result:
 * notes past the first 10 no longer sit in the server-rendered HTML the way the old
 * disclosure kept them (closed but present) — they only enter the DOM once "Load more" is
 * clicked, so find-in-page won't reach them until then.
 */
/** How many notes render immediately, before the rest sit behind "Load more". */
const VISIBLE_NOTES = 10;

export function Comments({ comments }: { comments: Comment[] }) {
  const visible = comments.slice(0, VISIBLE_NOTES);
  const rest = comments.slice(VISIBLE_NOTES);
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
          <NoteList comments={visible} />
          {rest.length > 0 && <LoadMoreNotes comments={rest} />}
        </div>
      )}
    </section>
  );
}

/** The rest of the notes, past the first {@link VISIBLE_NOTES}, revealed on click. */
function LoadMoreNotes({ comments }: { comments: Comment[] }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return <NoteList comments={comments} />;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      onClick={() => setRevealed(true)}
    >
      Load more ({comments.length})
    </Button>
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
