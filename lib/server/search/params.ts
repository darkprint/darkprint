/* ============================================================
   DarkPrint backend — reading the query string
   `params` is `Record<string, string>` and not a typed shape per
   surface, and the contract says why: a typed shape makes an
   unknown key a compile error at the call site and a 400 at the
   boundary, breaking exactly the shared links AC1 exists to
   protect. So every key this module cares about is READ BY NAME
   and every other key is untouched — which is AC1's "an unknown
   key is ignored rather than erroring" holding by construction
   rather than by a branch that has to remember to do nothing.

   That construction is what D-200-20's third AC1 cell tests, and
   it is the load-bearing one: `{tag: T, gibberish: "x"}` must
   equal `{tag: T}`, so the unknown key was ignored WHILE a known
   key was still honoured. A function that ignores every key passes
   the first two cells of that triple and fails this one.
   ============================================================ */

/**
 * A filter value, or `undefined` when the caller did not set one.
 *
 * An EMPTY string is `undefined`, because `?tag=` is what a shelf writes when a reader
 * clears a control (`useQueryState` drops the key, but a hand-edited or half-cleared URL
 * reaches here) and "filter by the empty tag" is nothing anybody meant.
 */
export function value(params: Record<string, string>, key: string): string | undefined {
  const raw = params[key];
  return raw === undefined || raw === "" ? undefined : raw;
}

/**
 * The three boolean keys — `df`, `human`, `risk` — read exactly as the merged shelves read
 * them: `params.get(k) === "1"` (`GalleryBrowser.tsx`, `NodeBrowser.tsx`), ratified by
 * D-200-19.
 *
 * So `df=0` is OFF rather than an error, and so is `df=true`, `df=yes` and every other
 * spelling. That is the shared-link rule again: a URL somebody bookmarked with a stale
 * value must still answer, and the only value that has ever meant ON is `1`.
 */
export function flag(params: Record<string, string>, key: string): boolean {
  return params[key] === "1";
}

/**
 * An enum-valued key, resolved against the values this surface publishes.
 *
 * **THE ONE RULE FOR EVERY ENUM KEY, AND IT IS HERE BECAUSE HAVING IT IN ONE PLACE IS THE
 * FINDING (D-200-37).** `sort` had an exact-match whitelist and `forks` did not, so
 * `sort=SLUG` fell back while `forks=banana`, `forks=ALL` and `forks=all ` each behaved
 * like `rolled` and OMITTING `forks` behaved like `all`. A case variation or a trailing
 * space in a pasted link flipped the shelf — which is precisely the shared link the fixed
 * parameter set exists to protect.
 *
 * Absent, empty and unrecognised all reach `fallback`, in one branch. Exact match and not a
 * case-insensitive or trimmed one: the published set is fixed, so a value that is not in it
 * is not a near miss to be repaired, and repairing it here would be this module inventing a
 * spelling the live URLs do not have.
 *
 * D-200-10 is why an unrecognised value falls back rather than erroring — "the same rule
 * AC1 gives an unknown KEY", and AC1's rule for an unknown key is that it is ignored. Both
 * break a shared link if they 400.
 */
export function oneOf<K extends string, F extends K | undefined>(
  params: Record<string, string>,
  key: string,
  allowed: readonly K[],
  fallback: F,
): K | F {
  return allowed.find((candidate) => candidate === params[key]) ?? fallback;
}

/**
 * The caller's explicit ordering instruction, or `undefined`.
 *
 * `sort` is the one enum key whose fallback is `undefined` rather than a value, and that is
 * a real difference rather than an inconsistency: "no sort" is a STATE — it leaves a `q`
 * free to rank (D-200-09) — whereas "no forks" is not, because the shelf is always in one
 * stance or another. So this is `oneOf` with the fallback that says *nothing was asked*.
 */
export function sortKey<K extends string>(
  params: Record<string, string>,
  allowed: readonly K[],
): K | undefined {
  return oneOf(params, "sort", allowed, undefined);
}

/**
 * A request's query string as the `Record<string, string>` the three searchers take.
 *
 * **First wins on a repeated key**, which is `URLSearchParams.get`'s own answer and
 * therefore what the merged shelves already do (`useQueryState` reads every filter through
 * `params.get`). `Object.fromEntries(url.searchParams)` would give LAST, so `?tag=a&tag=b`
 * would filter differently at the route than it does on the page it mirrors — a divergence
 * nobody would find until somebody pasted a link with a duplicated key.
 *
 * Nothing is validated here and nothing is rejected: an unknown key travels through and is
 * ignored downstream (AC1), because a 400 on a key nobody reads breaks exactly the shared
 * links the fixed parameter sets exist to protect.
 */
export function searchParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of new URL(url).searchParams) {
    if (!Object.hasOwn(out, key)) out[key] = raw;
  }
  return out;
}
