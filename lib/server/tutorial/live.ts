/* ============================================================
   DarkPrint backend: the live tutorial channel's three verbs
   `openLive` mints a page, `putLive` stores the draft the
   blueprint-writing skill posts after each phase, `getLive` hands
   it to the page that polls. Every row is a `LiveDraft` from
   `lib/core/tutorial/live.ts`, validated by the route before it
   gets here; this module trusts the type it is handed and never
   re-reads the body.

   ── one clock ──
   `expires_at` is written from `new Date()` and compared against
   `new Date()`. The table's `now()` defaults are informational.
   Mixing the process clock with the database clock would make a
   row live or dead depending on which side asked, and a page and
   a skill on the same token would disagree about whether it was
   still open.

   ── expiry is enforced, not only recorded ──
   A row past its `expires_at` is dead the moment it is read, not
   the next time somebody sweeps: `putLive` refuses it in its WHERE
   clause, `getLive` deletes it on sight, and `openLive` sweeps the
   rest so the table does not grow with every reader who never came
   back. There is no scheduled job, because nothing here runs one.
   ============================================================ */

import { randomBytes } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { schema, type Db } from "@/lib/db";
import { isLiveToken, type LiveDraft, type LiveOpened, type LiveRecord } from "@/lib/core/tutorial/live";
import { withTutorialStore } from "./store";

const table = schema.tutorialDraft;

/** How long a page stays open with nobody writing to it. Refreshed on every accepted PUT. */
export const LIVE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * What a page holds before the skill has posted anything. `LiveRecord.draft` is not optional
 * and the column is NOT NULL, so an opened page has to hold a draft; the page reads an empty
 * `dot` at the first phase as "waiting for the first post".
 */
const EMPTY_DRAFT: LiveDraft = {
  phase: "need",
  bundle: {
    manifest: { slug: "", title: "", summary: "", tags: [] },
    dot: "",
    cardFiles: {},
  },
};

export interface OpenLiveOptions {
  /** The site's own origin, from which the page URL is built. Never the request's Host. */
  origin: string;
}

/** What `putLive` answers when the write landed. */
export interface LiveWritten {
  revision: number;
  updatedAt: string;
  expiresAt: string;
}

/**
 * Mint a page. 24 random bytes as base64url is the 32 URL-safe characters
 * `LIVE_TOKEN_PATTERN` admits, and a collision on a text primary key would surface as a
 * unique violation rather than as a silent overwrite.
 *
 * The sweep runs here rather than on a schedule: opening a page is the one event that is
 * rare, bounded by the rate limit, and happens whenever the tutorial is in use at all.
 */
export async function openLive(db: Db, options: OpenLiveOptions): Promise<LiveOpened> {
  return withTutorialStore("openLive", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LIVE_TTL_MS);
    const token = randomBytes(24).toString("base64url");
    await db.delete(table).where(lte(table.expiresAt, now));
    await db.insert(table).values({
      token,
      phase: EMPTY_DRAFT.phase,
      draft: EMPTY_DRAFT,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    });
    return {
      token,
      url: `${options.origin}/tutorial/live/${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  });
}

/**
 * Store the latest draft for a page. One statement: the revision increments in the UPDATE
 * itself, so two posts racing on one token cannot both read 3 and both write 4, and a token
 * that is unknown or already expired falls out of the WHERE clause as an empty RETURNING.
 *
 * A token that does not match the pattern never reaches a statement. The route has already
 * answered 400 for it; this is what keeps the module honest when called from elsewhere.
 */
export async function putLive(db: Db, token: string, draft: LiveDraft): Promise<LiveWritten | undefined> {
  if (!isLiveToken(token)) return undefined;
  return withTutorialStore("putLive", async () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LIVE_TTL_MS);
    const [row] = await db
      .update(table)
      .set({
        phase: draft.phase,
        draft,
        revision: sql`${table.revision} + 1`,
        updatedAt: now,
        expiresAt,
      })
      .where(and(eq(table.token, token), gt(table.expiresAt, now)))
      .returning({ revision: table.revision, updatedAt: table.updatedAt, expiresAt: table.expiresAt });
    if (row === undefined) return undefined;
    return {
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    };
  });
}

/**
 * Read a page. An expired row answers `undefined` and is deleted on the way out, with the
 * expiry repeated in the DELETE's WHERE so a write that refreshed the row between the two
 * statements is not thrown away.
 */
export async function getLive(db: Db, token: string): Promise<LiveRecord | undefined> {
  if (!isLiveToken(token)) return undefined;
  return withTutorialStore("getLive", async () => {
    const now = new Date();
    const [row] = await db.select().from(table).where(eq(table.token, token));
    if (row === undefined) return undefined;
    if (row.expiresAt.getTime() <= now.getTime()) {
      await db.delete(table).where(and(eq(table.token, token), lte(table.expiresAt, now)));
      return undefined;
    }
    return {
      token: row.token,
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      /* Written by `putLive` from a value `parseLiveDraft` produced, or by `openLive` from
         the constant above; nothing else writes the column. */
      draft: row.draft as LiveDraft,
    };
  });
}
