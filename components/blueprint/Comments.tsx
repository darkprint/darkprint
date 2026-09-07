"use client";

import { useCallback, useState } from "react";
import type { Comment } from "@/lib/types";
import { cx, prettyDate } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

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
  /**
   * Who is reading. `handle` marks their own rows (`mine`) and now also draws the mark
   * beside the compose box, so `displayName` and `avatarHue` are read here too: built
   * from the handle alone, an account that carries a stored hue would show one colour
   * next to the box and a different one on the note a second after it posts. Both stay
   * optional, so a caller holding only the handle still type-checks and degrades to the
   * handle-derived colour the note rows already fall back to.
   */
  viewer: {
    signedIn: boolean;
    handle?: string;
    displayName?: string;
    avatarHue?: number;
  };
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
          <p className="mt-1 text-xs leading-relaxed text-dim">
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
                  {prettyDate(c.createdAt.slice(0, 10))}
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
          <p className="mt-1 text-xs leading-relaxed text-dim">
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

      <PostForm
        apiBase={live.apiBase}
        viewer={live.viewer}
        onPosted={onPosted}
        subject={subject}
        className="mt-3"
      />
    </section>
  );
}

/**
 * The mark to the left of the compose box.
 *
 * With a handle, it is the viewer's own avatar, through the same `Avatar` at the same
 * `md` size the posted notes use, so the box lands in the thread's column instead of
 * starting at its own margin. It does not link: a posted row links because a reader
 * wants to visit whoever wrote it, while a link on your own box, one tab stop before
 * your half-typed draft, only offers to navigate away from it.
 *
 * With no handle — signed out, or an actor the page could not name — it is an empty
 * dashed ring. There is no honest face for that slot: the viewer is not any of the
 * people in the thread, so reusing a commenter's avatar or minting a stand-in person
 * would put somebody else's identity on an empty textarea. `aria-hidden`, because the
 * sentence beside it already says who may post and a decorative ring adds nothing to it.
 */
function ComposerAvatar({ viewer }: { viewer: LiveNotes["viewer"] }) {
  if (viewer.handle !== undefined) {
    return (
      <Avatar
        author={{
          username: viewer.handle,
          displayName: viewer.displayName ?? viewer.handle,
          /* The same fallback `LiveNoteRow` applies to a note's author, so an account
             with no stored hue keeps one colour across the box and the note it posts. */
          avatarHue: viewer.avatarHue ?? hueFrom(viewer.handle),
          validator: false,
        }}
        size="md"
      />
    );
  }
  return (
    <span
      aria-hidden
      /* 32px is `Avatar`'s `md`. It is restated here because that scale is private to
         `components/ui/Avatar.tsx`, and it has to match: this sits in the same column
         as the avatars on the notes above and any other diameter breaks the line. */
      className="inline-flex h-8 w-8 shrink-0 rounded-full border border-dashed border-line bg-surface-2"
    />
  );
}

function PostForm({
  apiBase,
  viewer,
  onPosted,
  subject,
  className,
}: {
  apiBase: string;
  viewer: LiveNotes["viewer"];
  onPosted: (note: NoteView) => void;
  /** What the page is about, so a card's form does not ask about a blueprint. */
  subject: string;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!viewer.signedIn) {
    return (
      <div className={cx("flex items-start gap-3", className)}>
        <ComposerAvatar viewer={viewer} />
        {/* `py-1.5` drops this one line onto the ring's optical centre; the posted rows
            get the same alignment for free from the height of their name row. */}
        <p className="min-w-0 flex-1 py-1.5 text-xs leading-relaxed text-dim">
          Sign in to post a note.
        </p>
      </div>
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
    /* Avatar in a fixed left column, everything else in a `min-w-0 flex-1` beside it:
       the shape `NoteList` and `LiveNoteRow` already use, inside the same `panel p-4`,
       so the composer reads as the next row of the thread rather than a form pinned
       under it. The panel is what puts this avatar on the same vertical line as the
       ones above, which sit inset by the notes' own padding. */
    <form onSubmit={submit} className={cx("panel flex items-start gap-3 p-4", className)}>
      <ComposerAvatar viewer={viewer} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Say something about this ${subject}.`}
          rows={3}
          className="w-full resize-y rounded-md border border-line bg-surface-2 p-3 text-sm text-fg placeholder:text-dim focus:border-cyan focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={posting || body.trim() === ""}>
            {posting ? "Posting…" : "Post"}
          </Button>
          {error !== undefined && <span className="text-xs text-signal">{error}</span>}
        </div>
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
     `components/profile/SocialControls.tsx`, which discloses the identical missing read for
     follow and support and starts both controls unpressed on every load; the citation used
     to point at `components/bundle/WatchButton.tsx`, deleted with the bundle Watch control
     on 2026-09-06). A second click here is harmless — `insertNoteVote` is idempotent — this
     flag only stops the optimistic count from moving twice. */
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
