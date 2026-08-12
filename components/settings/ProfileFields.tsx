"use client";

import { useState } from "react";

import type { Author } from "@/lib/types";
import { avatarGradient } from "@/lib/format";
import { Field } from "./controls";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-44) (cited at line 1): PATCH /api/account/profile

/* ============================================================
   The one part of `/settings` that answers a gesture, and the rule that lets it.

   **A control works when its effect is local and immediate; it is disabled when its only
   effect would be persistence.** Everything else on this page falls on the second side of
   that line — a handle, an email, a notification switch and a visibility radio all mean
   nothing until something stores them — and is `readOnly` or `disabled` with the reason
   stated above the first panel.

   These three are the exception, and they earn it: a display name, a bio and a hue produce
   a preview, and the preview is the whole point of the section. The handoff asks for "a
   live preview card showing the generated gradient avatar", and a preview that cannot
   follow what you type is not one. Nothing here is written anywhere — reload and the seeded
   values are back — which is exactly what the strip at the top of the page says.

   ── Why the avatar is drawn here rather than mounted from `Avatar` ──
   `Avatar` takes an `Author` and derives everything from it, which is right for every other
   surface on the site: one record, one drawing. This one has to follow a hue the record
   does not have yet, so it draws the same geometry off `avatarGradient(hue)` — the same
   function, the same 64px, the same validator ring — with the number coming from the slider
   instead of from the row. If the two ever disagree, this is the copy to fix.
   ============================================================ */

/** The bio field's own ceiling. One sentence; the profile header renders it at `max-w-xl`. */
const BIO_LIMIT = 160;

/** `Avatar`'s `xl` size and its initial ratio, so the preview is the real drawing. */
const AVATAR_PX = 64;
const INITIAL_RATIO = 0.36;

function initials(name: string): string {
  const letters = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  // A name typed down to nothing still needs a circle with something in it.
  return letters === "" ? "?" : letters;
}

export function ProfileFields({ author }: { author: Author }) {
  const [displayName, setDisplayName] = useState(author.displayName);
  const [bio, setBio] = useState(author.bio ?? "");
  const [hue, setHue] = useState(author.avatarHue);

  const over = bio.length > BIO_LIMIT;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
      <div className="flex flex-col gap-5">
        <Field id="display-name" label="Display name">
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-10 rounded-md border border-line bg-void px-3 text-sm text-fg transition-colors focus:border-cyan"
          />
        </Field>

        <Field
          id="bio"
          label="Bio"
          hint={
            <>
              {/* The counter follows the field, which is the only reason it can be honest:
                  a static count over a field a reader can type into is a number that starts
                  lying at the first keystroke. */}
              <span className={over ? "text-amber" : undefined}>
                {bio.length} / {BIO_LIMIT}
              </span>{" "}
              · one sentence is enough; it renders under your name and on every card you
              publish
            </>
          }
        >
          <textarea
            id="bio"
            rows={3}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="resize-none rounded-md border border-line bg-void px-3 py-2.5 text-sm leading-relaxed text-fg transition-colors focus:border-cyan"
          />
        </Field>

        <Field
          id="avatar-hue"
          label="Avatar hue"
          hint={
            <>
              {hue}° · avatars are generated from one number, so no image is ever uploaded
              or stored
            </>
          }
        >
          <input
            id="avatar-hue"
            type="range"
            min={0}
            max={359}
            value={hue}
            onChange={(event) => setHue(Number(event.target.value))}
            className="w-full accent-cyan"
          />
        </Field>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-5">
        <span className="label">Preview</span>
        <span
          className={
            author.validator
              ? "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-void ring-2 ring-cyan/70 ring-offset-2 ring-offset-void"
              : "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-void"
          }
          style={{
            width: AVATAR_PX,
            height: AVATAR_PX,
            background: avatarGradient(hue),
            fontSize: AVATAR_PX * INITIAL_RATIO,
          }}
          title={displayName}
        >
          {initials(displayName)}
        </span>
        <span className="text-center font-display text-base font-semibold text-fg">
          {displayName === "" ? "Your name" : displayName}
        </span>
        <span className="font-mono text-[11px] text-dim">@{author.username}</span>
        {author.validator && (
          <span className="font-mono text-[11px] text-cyan">✦ validator ring</span>
        )}
        <p className="text-center font-mono text-[11px] leading-relaxed text-dim">
          Follows what you type. Nothing is stored: reload and the seeded values are back.
        </p>
      </div>
    </div>
  );
}
