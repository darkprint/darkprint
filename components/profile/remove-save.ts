/* ============================================================
   Removing a row from the Saved shelf: both writes, in the order
   that cannot leave them disagreeing.

   Save was folded into Star on 2026-09-05 (D-132), so a card on this
   shelf is a card the reader has starred. `Remove` used to issue one
   request — `DELETE /api/account/saves` — which took the row off the
   shelf and left the public star standing, and the shelf's own footer
   disclosed that as a gap (§11.0 Q24). Two gestures became one concept
   and one of the two removal paths was not folded with them.

   This is the fold, and it lives beside the component rather than
   inside it so the ORDER and the FAILURE ARMS are drivable by a test.
   `components/profile/remove-save.test.ts` holds them.
   ============================================================ */

/** What `DELETE /api/account/saves` takes, and what `SavedRow.target` carries. */
export interface SaveTarget {
  kind: "blueprint" | "card" | "term";
  refId: string;
}

export interface RemovalRequest {
  target: SaveTarget;
  /**
   * The star this row's save is the index of, for a row that has one. A card does; a
   * vocabulary term has no star at all, and a blueprint save cannot be written today
   * (D-262-04), so `undefined` is the ordinary state of a row rather than an error.
   */
  star?: {
    /** `POST /api/cards/{id}/star`. A TOGGLE, which is why `starred` is read first. */
    api: string;
    /** Where the star stood when the page rendered. */
    starred: boolean;
  };
}

/** Where the star ended up, so the caller can say something true about it. */
export type StarOutcome =
  /** The row never had one to clear. */
  | "absent"
  /** It is down, either because this call put it down or because it already was. */
  | "cleared"
  /** The write failed and the star is still up, so the save was left alone too. */
  | "standing";

export interface RemovalResult {
  /** `true` only when the save row is actually gone. */
  removed: boolean;
  star: StarOutcome;
}

/**
 * The star route for a bare card id.
 *
 * B-10 keys a card's counters per id, and a save row's `refId` for a card IS that id, so
 * there is no lookup between the two. Written here rather than in the loader because the
 * removal is what addresses it and a route spelled in two files drifts in one of them.
 */
export function cardStarApi(refId: string): string {
  return `/api/cards/${encodeURIComponent(refId)}/star`;
}

/**
 * Give every card row the star its save is the index of.
 *
 * Structural over `RemovalRequest` so the loader can hand its own display rows in and get
 * them back widened: the shelf's row type carries a `href`, a `summary` and a `kind` this
 * module has no business knowing about. A row this misses is a row whose `Remove` cannot
 * clear the star, which is the Q24 defect returning quietly, so the attachment has cells
 * of its own rather than being read off the loader by eye.
 *
 * A refId missing from `starred` is treated as unstarred: a card the counters have never
 * seen has no star to take down, and pressing the toggle for it would put one up.
 */
export function attachStars<Row extends RemovalRequest>(
  rows: readonly Row[],
  starred: ReadonlyMap<string, boolean>,
): Row[] {
  return rows.map((row) =>
    row.target.kind === "card"
      ? {
          ...row,
          star: { api: cardStarApi(row.target.refId), starred: starred.get(row.target.refId) ?? false },
        }
      : row,
  );
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const SAVES_PATH = "/api/account/saves";

/** The star route's answer, as much of it as this needs. */
async function starredAfter(response: Response): Promise<boolean | undefined> {
  try {
    const json = (await response.json()) as {
      signals?: { starredByCaller?: boolean };
    };
    return json.signals?.starredByCaller;
  } catch {
    /* A 200 whose body will not parse says nothing about where the star ended up. The
       caller treats `undefined` as "cannot tell", which stops the second toggle below
       from firing on a guess. */
    return undefined;
  }
}

/**
 * Un-star, then un-save.
 *
 * ── Why the star goes first ──
 * If the star write fails, this returns without touching the save, and the row stays on
 * screen with its star up. That is the one state the two writes can end in that nobody has
 * to be told about: nothing moved. Deleting the save first and failing on the star is
 * exactly the divergence Q24 named, reintroduced on an error path.
 *
 * ── Why the answer is read back ──
 * `POST /api/cards/{id}/star` is a toggle, and `star.starred` is where the star stood when
 * the server rendered this page. A reader who starred the card in another tab since then
 * would have this click STAR it. So the response is checked, and a toggle that went the
 * wrong way is put back — bounded at two requests, never a loop. A row whose snapshot
 * already says unstarred issues no star request at all, which is what keeps a save that
 * predates the fold from being starred by the click that removes it.
 */
export async function removeSavedRow(
  row: RemovalRequest,
  fetchImpl: Fetch = fetch,
): Promise<RemovalResult> {
  const star: StarOutcome = row.star === undefined ? "absent" : "cleared";

  if (row.star !== undefined && row.star.starred) {
    const cleared = await clearStar(row.star.api, fetchImpl);
    if (!cleared) return { removed: false, star: "standing" };
  }

  try {
    const response = await fetchImpl(SAVES_PATH, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row.target),
    });
    return { removed: response.ok, star };
  } catch {
    return { removed: false, star };
  }
}

/** One toggle, and one correction if the toggle went the wrong way. */
async function clearStar(api: string, fetchImpl: Fetch): Promise<boolean> {
  try {
    const first = await fetchImpl(api, { method: "POST" });
    if (!first.ok) return false;
    if ((await starredAfter(first)) !== true) return true;

    /* The snapshot was stale and this click starred the card. Put it back rather than
       leaving a star this gesture created behind a row it is about to delete. */
    const second = await fetchImpl(api, { method: "POST" });
    if (!second.ok) return false;
    return (await starredAfter(second)) === false;
  } catch {
    return false;
  }
}
