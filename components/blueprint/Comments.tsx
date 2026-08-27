"use client";

import { useCallback, useState } from "react";
import type { Comment } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-79/SEAM-82 LIVE (T280): GET/POST /api/blueprints/{owner}/{slug}/notes and the card
// mirror at /api/cards/{id}/notes, plus /{noteId} (PATCH/DELETE) and /{noteId}/vote (POST).
// `live` below is the wiring; the fixture path underneath it is untouched.

/**
 * Community notes on a blueprint or a card. Two renderers behind one export, chosen by
 * whether `live` is present — the pinned cross-agent interface CONTRACT-FE.md's frontend
 * phase fixes, because B2 mounts this over `/api/cards/{id}/notes` the same way this file's
 * own page mounts it over the blueprint address.
 *
 * **Without `live`**: exactly the fixture rendering this component always had. Validators
 * are flagged inline — the design gives their votes more weight, so it matters who is
 * talking — but the badge is a seeded boolean and no vote is weighted anywhere yet. No form:
 * every note here comes out of `lib/data/community.ts`, static seed data with no pagination
 * or fetch behind it. The `◐ seeded` marker on the heading renders ONLY in this mode.
 *
 * **With `live`**: the real store. A load-more using the cursor, a post form when
 * `viewer.signedIn`, upvotes, and edit/delete on rows the viewer authored — a tombstone
 * renders as a muted "removed" row rather than disappearing, because `deleteNote` keeps the
 * row so the count and the cursor both stay honest (B-18) and this UI keeps the same
 * promise. `comments` still has to be passed (the frozen surface's existing required prop)
 * even when `live` wins the render — see the header on `components/bundle/BundleHeader.tsx`
 * for the same shape of decision.
 */
export interface NoteAuthorView {
  handle: string;
  displayName: string;
  avatarHue?: number;
}

export interface NoteView {
  id: string;
  author: NoteAuthorView;
  body: string;
  /** ISO string — the wire form of `NoteRecord.createdAt`, which JSON has no `Date` for. */
  createdAt: string;
  votes: number;
  deleted: boolean;
  /** Whether the signed-in viewer authored this note, so edit/delete render on their own rows. */
  mine: boolean;
}

export interface LiveNotes {
  target: { kind: "blueprint" | "card"; refId: string };
  /** e.g. `/api/blueprints/{owner}/{slug}/notes` or `/api/cards/{id}/notes`. */
  apiBase: string;
  initial: { notes: NoteView[]; cursor: string | null };
  viewer: { signedIn: boolean; handle?: string };
}

/** How many notes render immediately, before the rest sit behind "Load more" — fixture mode only. */
const VISIBLE_NOTES = 10;

/**
 * What the empty state calls the thing being discussed.
 *
 * The sentence was hard-coded to "blueprint" and this component is mounted on the node
 * card pages too, so all 53 of them closed with "this blueprint has none" — the wrong
 * noun, in the last sentence a reader meets. A default keeps every existing blueprint
 * call site unchanged.
 */
export function Comments({
  comments,
  subject = "blueprint",
  live,
}: {
  comments: Comment[];
  subject?: string;
  live?: LiveNotes;
}) {
  if (live !== undefined) return <LiveComments live={live} subject={subject} />;

  const visible = comments.slice(0, VISIBLE_NOTES);
  const rest = comments.slice(VISIBLE_NOTES);
  return (
    <section aria-labelledby="community-notes">
      <h2
        id="community-notes"
        className="mb-4 flex scroll-mt-24 flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl font-semibold text-fg"
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
            Notes are seeded rows in the index, and this {subject} has none. There is
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
                  <span className="font-mono text-[11px] uppercase tracking-wide text-cyan">
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

/* ============================================================
   Live mode.
   ============================================================ */

/** Deterministic hue from a handle, matching `lib/content/view.ts`'s `authorFor` fallback —
    an account whose `avatarHue` column is null still gets one colour, stable across renders. */
function hueFrom(seed: string): number {
  let acc = 0;
  for (let i = 0; i < seed.length; i += 1) acc = (acc * 31 + seed.charCodeAt(i)) % 360;
  return acc;
}

/** The wire shape a fetch response carries: `PublicAuthor`, JSON-serialized. */
interface WireAuthor {
  handle: string | null;
  displayName: string | null;
  avatarHue: number | null;
  validator: boolean;
}

interface WireNote {
  id: string;
  author: WireAuthor;
  body: string;
  createdAt: string;
  votes: number;
  deleted: boolean;
}

function viewOf(note: WireNote, viewerHandle: string | undefined): NoteView {
  const handle = note.author.handle ?? "unknown";
  return {
    id: note.id,
    author: {
      handle,
      displayName: note.author.displayName ?? handle,
      ...(note.author.avatarHue !== null ? { avatarHue: note.author.avatarHue } : {}),
    },
    body: note.body,
    createdAt: note.createdAt,
    votes: note.votes,
    deleted: note.deleted,
    mine: viewerHandle !== undefined && note.author.handle === viewerHandle,
  };
}

function LiveComments({ live, subject }: { live: LiveNotes; subject: string }) {
  const [notes, setNotes] = useState(live.initial.notes);
  const [cursor, setCursor] = useState(live.initial.cursor);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (cursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`${live.apiBase}?after=${encodeURIComponent(cursor)}`);
      if (!response.ok) return;
      const page = (await response.json()) as { notes: WireNote[]; cursor: string | null };
      /* De-duplicated by id: a note POSTED while this fetch was in flight is already in
         `prev` AND in the server's page (keyset pagination is oldest-first, so a fresh
         note lands at the tail of the last page). A blind append would show it twice. */
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        const fresh = page.notes.filter((n) => !seen.has(n.id));
        /* Re-sorted because a note posted while the fetch ran sits at `prev`'s tail and
           the page carries OLDER rows; ISO timestamps sort lexicographically. */
        return [...prev, ...fresh.map((n) => viewOf(n, live.viewer.handle))].sort((a, b) =>
          a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
        );
      });
      setCursor(page.cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, live.apiBase, live.viewer.handle]);

  const onPosted = useCallback((note: NoteView) => {
    setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [...prev, note]));
  }, []);

  const onChanged = useCallback((note: NoteView) => {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
  }, []);

  return (
    <section aria-labelledby="community-notes">
      <h2
        id="community-notes"
        className="mb-4 flex scroll-mt-24 flex-wrap items-baseline gap-x-3 gap-y-1 font-display text-xl font-semibold text-fg"
      >
        Community notes{" "}
        <span className="font-mono text-sm font-normal text-dim">
          ({notes.length}
          {cursor !== null && "+"})
        </span>
      </h2>

      {notes.length === 0 ? (
        <div className="panel px-5 py-8 text-center">
          <p className="text-sm text-muted">No notes yet.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-dim">
            {live.viewer.signedIn
              ? `Be the first to say something about this ${subject}.`
              : `Nobody has posted about this ${subject} yet.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <LiveNoteList notes={notes} apiBase={live.apiBase} viewer={live.viewer} onChanged={onChanged} />
          {cursor !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}

      <PostForm apiBase={live.apiBase} viewer={live.viewer} onPosted={onPosted} className="mt-3" />
    </section>
  );
}

function PostForm({
  apiBase,
  viewer,
  onPosted,
  className,
}: {
  apiBase: string;
  viewer: LiveNotes["viewer"];
  onPosted: (note: NoteView) => void;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!viewer.signedIn) {
    return (
      <p className={cx("text-xs leading-relaxed text-dim", className)}>
        Sign in to post a note.
      </p>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed === "" || posting) return;
    setPosting(true);
    setError(undefined);
    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => undefined)) as
          | { detail?: string }
          | undefined;
        setError(problem?.detail ?? "That note was not accepted.");
        return;
      }
      const { note } = (await response.json()) as { note: WireNote };
      onPosted(viewOf(note, viewer.handle));
      setBody("");
    } catch {
      setError("That note did not send. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={submit} className={cx("flex flex-col gap-2", className)}>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Say something about this blueprint."
        rows={3}
        className="w-full resize-y rounded-md border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-dim focus:border-cyan focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={posting || body.trim() === ""}>
          {posting ? "Posting…" : "Post"}
        </Button>
        {error !== undefined && <span className="text-xs text-signal">{error}</span>}
      </div>
    </form>
  );
}

function LiveNoteList({
  notes,
  apiBase,
  viewer,
  onChanged,
}: {
  notes: readonly NoteView[];
  apiBase: string;
  viewer: LiveNotes["viewer"];
  onChanged: (note: NoteView) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) =>
        note.deleted ? (
          <li key={note.id} className="panel p-4 text-xs italic text-dim">
            This note was removed.
          </li>
        ) : (
          <LiveNoteRow key={note.id} note={note} apiBase={apiBase} viewer={viewer} onChanged={onChanged} />
        ),
      )}
    </ul>
  );
}

function LiveNoteRow({
  note,
  apiBase,
  viewer,
  onChanged,
}: {
  note: NoteView;
  apiBase: string;
  viewer: LiveNotes["viewer"];
  onChanged: (note: NoteView) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  /* Session-local only: `voteNote` has no reader for "did I already vote this note", the
     same gap `lib/server/profiles`'s own header names for follow state (see
     `components/bundle/WatchButton.tsx`). A second click here is harmless — `insertNoteVote`
     is idempotent — this flag only stops the optimistic count from moving twice. */
  const [voted, setVoted] = useState(false);

  const author = {
    username: note.author.handle,
    displayName: note.author.displayName,
    avatarHue: note.author.avatarHue ?? hueFrom(note.author.handle),
    validator: false,
  };

  const vote = async () => {
    if (!viewer.signedIn || voted) return;
    setVoted(true);
    onChanged({ ...note, votes: note.votes + 1 });
    try {
      const response = await fetch(`${apiBase}/${note.id}/vote`, { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      const { note: updated } = (await response.json()) as { note: WireNote };
      onChanged(viewOf(updated, viewer.handle));
    } catch {
      setVoted(false);
      onChanged(note);
    }
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (trimmed === "" || busy) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const response = await fetch(`${apiBase}/${note.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (response.ok) {
        const { note: updated } = (await response.json()) as { note: WireNote };
        onChanged(viewOf(updated, viewer.handle));
        setEditing(false);
      } else {
        const problem = (await response.json().catch(() => undefined)) as
          | { detail?: string }
          | undefined;
        setActionError(problem?.detail ?? "That edit was not accepted. The note may have moved under you.");
      }
    } catch {
      setActionError("That edit did not send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setActionError(undefined);
    try {
      const response = await fetch(`${apiBase}/${note.id}`, { method: "DELETE" });
      if (response.ok) {
        onChanged({ ...note, deleted: true, body: "" });
      } else {
        setActionError("That delete was not accepted. Reload to see the note's current state.");
      }
    } catch {
      setActionError("That delete did not send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="panel p-4">
      <div className="flex items-start gap-3">
        <Avatar author={author} size="md" link />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-fg">{note.author.displayName}</span>
            <span className="text-faint">·</span>
            <span className="font-mono text-[11px] text-dim">{prettyDate(note.createdAt)}</span>
            <button
              type="button"
              onClick={() => void vote()}
              disabled={!viewer.signedIn || voted}
              aria-pressed={voted}
              title={viewer.signedIn ? "Vote this note up" : "Sign in to vote"}
              className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] text-emerald disabled:cursor-not-allowed disabled:opacity-70"
            >
              ▲ {note.votes}
            </button>
          </div>

          {editing ? (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-line bg-surface-2 p-2.5 text-sm text-fg focus:border-cyan focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void saveEdit()}>
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setDraft(note.body);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-muted">{note.body}</p>
          )}

          {actionError !== undefined && (
            <span role="alert" className="mt-1 block text-xs text-signal">
              {actionError}
            </span>
          )}

          {note.mine && !editing && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim transition-colors hoverable:hover:text-cyan"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim transition-colors hoverable:hover:text-signal"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
