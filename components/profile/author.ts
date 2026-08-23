import type { PublicAuthor } from "@/lib/server/accounts";
import type { Author } from "@/lib/types";

/* ============================================================
   The one boundary between the backend's author shape and the site's.

   PURE. No `@/lib/db`, no `next/headers`, no server-only import — the site
   header is a client component and consumes this, so anything reaching a driver
   from here would put `pg` in a browser bundle (D-263-08's finding, one module
   over).

   ── Why a mapping instead of widening `Author` ──
   `PublicAuthor` is `handle: string | null`, `displayName: string | null`,
   `avatarHue: number | null`. `Author` (`lib/types.ts:172-180`) is total in all
   three. **`lib/types.ts` is in nobody's `Owns` and `Author` is consumed
   site-wide** — comments, cards, the gallery, the node browser — so D-262-14
   rules the widening out and the mapping in, here, resolving each null
   explicitly rather than with a `!`.

   The nulls are not theoretical. D-263-09 established the third session state is
   reachable by T050 AC1: **signed in, with no handle yet.** An account in that
   state has a row, an avatar and a settings page, and no profile URL.
   ============================================================ */

/**
 * The hue a handle-less or hue-less account draws with.
 *
 * A constant rather than a value derived from the handle, and the difference is
 * honesty rather than taste: a derived hue is indistinguishable on screen from a
 * hue the reader chose, so deriving one would show a stored preference where the
 * column holds `null`. This is visibly the same for every such account, which is
 * what a missing value should look like.
 */
const UNSET_HUE = 210;

/**
 * A `PublicAuthor` at the shape every profile component already draws.
 *
 * `username` is `""` for an account with no handle. That is a value no link may
 * be built from, which is why `profileHref` below exists and why no caller in
 * this task interpolates `username` into a path — a `/u/` link for a handle-less
 * account is the `/u/null` defect D-262-14 names, one substitution later.
 */
export function authorFor(author: PublicAuthor): Author {
  return {
    username: author.handle ?? "",
    /* Falls back to the handle before it falls back to a word: a reader with no
       display name is still named by their handle everywhere else on the site,
       and showing "Unnamed" beside a handle the page also prints would be the
       page disagreeing with itself. */
    displayName: author.displayName ?? author.handle ?? "Unnamed account",
    avatarHue: author.avatarHue ?? UNSET_HUE,
    validator: author.validator,
    ...(author.bio === undefined ? {} : { bio: author.bio }),
  };
}

/**
 * Where a handle's profile lives, or `undefined` when there is no profile to
 * link to.
 *
 * A function rather than a convention, because "omit the link when the handle is
 * null" is exactly the kind of rule that holds until the next caller forgets it.
 * `undefined` makes the omission the caller's only option instead of its
 * discipline.
 */
export function profileHref(handle: string | null, segment = ""): string | undefined {
  if (handle === null || handle === "") return undefined;
  return segment === "" ? `/u/${handle}` : `/u/${handle}/${segment}`;
}
