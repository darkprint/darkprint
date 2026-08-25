/* ============================================================
   POST /api/bundles/draft
   0007_drafts (T280): the GitHub-style "Create repository" verb —
   a bundle that exists before any release does. Session required;
   the owner is always the session's own account, never a body
   field (unlike `POST /api/bundles`, whose `ownerHandle` lets the
   CLI publish on a caller's behalf and which `can` then checks —
   there is nothing to impersonate here, since a draft is created
   with no bytes and no release to attribute).

   ── slug: grammar and reservation through `checkSlug`, taken
      through `createBundle`'s own constraint ──
   `checkSlug` answers two refusals the unique index on
   `(owner_id, slug)` cannot: "illegal" (not a legal `CARD_ID`
   segment — the column is plain `text` and would happily store
   anything) and "reserved" (one of the four profile-tab segments,
   which the index has no opinion about either). Both are checked
   before the write. "taken" is deliberately NOT special-cased from
   `checkSlug`'s own answer: the authoritative refusal is the
   unique index itself, reached by attempting `createBundle` and
   catching its typed `ArchiveConflictError` — the same mapping
   `POST /api/bundles` already uses for exactly this constraint, so
   the message and the status keep one author. That also closes the
   TOCTOU window a pure pre-check would leave open between the
   answer and the write.

   ── visibility ──
   Defaults to the owner's account default (`account.defaultVisibility`),
   never a route-level constant — the same rule `forkBundle` applies
   and for the same reason: an account set to private must not have
   something created publicly by a default that was not theirs.
   ============================================================ */

import { getSharedDbClient } from "@/lib/db";
import { actorFrom, getAccount } from "@/lib/server/accounts";
import { ArchiveConflictError, createBundle } from "@/lib/server/archive";
import { withSession } from "@/lib/server/auth";
import { badRequest, conflict, ok, PROBLEM_TYPE_BASE, problem } from "@/lib/server/http";
import { checkSlug } from "@/lib/server/naming";
import { isRefusal, readObjectBody, readOptionalString, readString } from "../../validate/body";

/** An array-of-strings field, absent and `null` both meaning "not supplied" — `tags`' own
    shape, which none of `../../validate/body`'s shared readers carry a case for. */
function readOptionalStringArray(
  body: Record<string, unknown>,
  key: string,
): { value?: readonly string[] } | { detail: string } {
  const raw = body[key];
  if (raw === undefined || raw === null) return {};
  if (!Array.isArray(raw) || !raw.every((entry) => typeof entry === "string")) {
    return { detail: `\`${key}\` must be an array of strings when present.` };
  }
  return { value: raw };
}

/** `visibility`, when supplied. Absent means the owner's account default — see the header. */
function readOptionalVisibility(
  body: Record<string, unknown>,
): { value?: "public" | "private" } | { detail: string } {
  const raw = body.visibility;
  if (raw === undefined || raw === null) return {};
  if (raw !== "public" && raw !== "private") {
    return { detail: '`visibility` must be "public" or "private" when present.' };
  }
  return { value: raw };
}

export async function POST(request: Request): Promise<Response> {
  return withSession(request, async (session) => {
    const parsed = await readObjectBody(request);
    if ("refusal" in parsed) return parsed.refusal;
    const { body } = parsed;

    const slug = readString(body, "slug");
    if (isRefusal(slug)) return badRequest(request, slug.detail);
    /* Optional since the owner's 2026-08-25 instruction: /new asks for one name, the way
       GitHub asks for a repository name — the slug IS the identity, and every display
       already falls back to it (`title ?? slug`). A caller may still send a title. */
    const title = readOptionalString(body, "title");
    if (isRefusal(title)) return badRequest(request, title.detail);
    const summary = readOptionalString(body, "summary");
    if (isRefusal(summary)) return badRequest(request, summary.detail);
    const description = readOptionalString(body, "description");
    if (isRefusal(description)) return badRequest(request, description.detail);
    const category = readOptionalString(body, "category");
    if (isRefusal(category)) return badRequest(request, category.detail);
    const tags = readOptionalStringArray(body, "tags");
    if (isRefusal(tags)) return badRequest(request, tags.detail);
    const visibility = readOptionalVisibility(body);
    if (isRefusal(visibility)) return badRequest(request, visibility.detail);

    const { db } = getSharedDbClient();
    const actor = actorFrom(session);

    /* Reading the caller's own row rather than trusting `session.handle` for the account
       default: the session cookie carries the handle at MINT time (`account/handle`'s own
       header records the same staleness for a rename), and `defaultVisibility` is not on
       the session at all. `getAccount` never refuses a caller its own row (T050 AC1), so
       `undefined` here is not a state a live session reaches. */
    const account = await getAccount(db, actor, session.accountId);
    if (account === undefined) {
      throw new Error("draft: session named an account with no row — unreachable through a live session.");
    }
    if (account.author.handle === null) {
      return problem(request, {
        type: `${PROBLEM_TYPE_BASE}/handle-required`,
        title: "Handle required",
        status: 403,
        detail: "draft: this account has no handle yet.",
      });
    }

    const availability = await checkSlug(db, session.accountId, slug.value);
    if (!availability.available && availability.reason === "illegal") {
      return badRequest(request, `\`slug\`: \`${slug.value}\` is not a legal identifier.`);
    }
    if (!availability.available && availability.reason === "reserved") {
      return conflict(request, `draft: \`${slug.value}\` is reserved and cannot be used as a bundle slug.`);
    }
    /* `availability.reason === "taken"` falls through deliberately — `createBundle` below
       is the authoritative check (the header explains why) and its `ArchiveConflictError`
       is what the `catch` maps, so "already taken" is answered once rather than twice. */

    try {
      const created = await createBundle(db, {
        ownerId: session.accountId,
        slug: slug.value,
        visibility: visibility.value ?? account.defaultVisibility,
        ...(title.value === undefined ? {} : { title: title.value }),
        ...(summary.value === undefined ? {} : { summary: summary.value }),
        ...(description.value === undefined ? {} : { description: description.value }),
        ...(category.value === undefined ? {} : { category: category.value }),
        ...(tags.value === undefined ? {} : { tags: tags.value }),
      });
      return ok({
        bundle: {
          owner: account.author.handle,
          slug: created.slug,
          visibility: created.visibility,
          title: created.title,
          createdAt: created.createdAt,
        },
      });
    } catch (thrown) {
      if (thrown instanceof ArchiveConflictError) {
        return problem(request, {
          type: `${PROBLEM_TYPE_BASE}/archive-${thrown.kind}`,
          title: "Already exists",
          status: 409,
          detail: thrown.message,
        });
      }
      throw thrown;
    }
  });
}
