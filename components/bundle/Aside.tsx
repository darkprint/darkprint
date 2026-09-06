import Link from "next/link";

import type { Release, UpstreamMoved } from "@/lib/data/bundles";
import { cx, prettyDate } from "@/lib/format";
import { nodeHref } from "@/lib/href";
import { Button, ButtonLink } from "@/components/ui/Button";
import { MetaPill } from "@/components/ui/MetaPill";
import { VisibilityControl } from "@/components/bundle/VisibilityControl";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-67 LIVE (T280): PATCH /api/bundles/{owner}/{slug}/visibility — `VisibilitySwitch`'s
// `live` prop. Its only caller is `DraftLanding` as of 2026-09-06; see the header below.
// TODO(SEAM-68) (cited at line 272): POST /api/bundles/{owner}/{slug}/releases
// SEAM-71 is no longer anchored here. The `Forks` panel was deleted on 2026-09-05 (§11.0
// Q30) after the owner took it off the page on 2026-09-04; the seam is still LIVE and the
// page still reads `forksOf` for the header's fork count, so the route and the filter are
// unchanged and only this file's stake in them is gone.
// TODO(SEAM-72) (cited at line 180): GET /api/bundles/{owner}/{slug}/drift
// TODO(SEAM-73) (cited at line 24): n/a

/* ============================================================
   What was the column beside a bundle: what it is not, who can see it, what it hashes to,
   whether the upstream has moved, and what has been released.

   THERE IS NO SUCH COLUMN ANY MORE, and this header says so rather than describing a layout
   nothing draws. `/blueprints/[owner]/[slug]` carried it; the owner emptied it one panel at a
   time (2026-09-04 and 2026-09-05) and on 2026-09-06 took the last one off — "remove the
   panel visibility from the blueprint card" — so the two-column grid around it went with it
   and the graph runs the full width instead.

   Where the five exports stand, measured with `grep -rn "<Name" app components --include="*.tsx"`
   rather than assumed:

     `VisibilitySwitch`      ONE mount, `components/bundle/DraftLanding.tsx`, which hands it
                             the live SEAM-67 control for a bundle with no release.
     `PageHolds`             no mount
     `SeededBundleFacts`     no mount
     `UpstreamMovedPanel`    no mount
     `Releases`              no mount, since 2026-09-05

   THE OWED MOUNT HAS LANDED, and the two sentences that said otherwise are gone rather than
   softened. The owner ruled the switch belongs on the account's own blueprint list ("such
   option should be visible only on the user account list of the blueprints"), and
   `components/profile/OwnedBundles.tsx` now draws a `RowVisibility` per row on
   `/u/[username]`, on both row shapes. So a bundle WITH a release does have a visibility
   control, and this header claimed the opposite for a wave after it stopped being true.

   That shelf built its own component over `VisibilityControl` rather than mounting
   `VisibilitySwitch` from here, which is why the census above still reads ONE. This file is
   not on the path a reader takes to change a visibility any more, and nothing here should
   suggest the shelf is waiting on it.

   The four unmounted exports are kept rather than deleted because whether an unmounted
   component survives is the owner's call and §11.0 carries the row. The census was
   re-measured on 2026-09-06 with a grep for each name's JSX opening tag over `app/` and
   `components/`; all four came back with nothing. Nothing here should be read as a claim
   that they are reachable.
   ============================================================ */

/**
 * What the registry does not hold.
 *
 * The first panel on the page's right, and deliberately the first: a page that lists a
 * folder, a history and a set of releases looks like a page that watched something happen.
 * Nothing here has. `README.md` and `PROJECT.md` both put this limit at the top of what
 * they say about the site, and this is where a reader meets it on a bundle.
 */
export function PageHolds() {
  return (
    <section className="panel p-5">
      <span className="label">What this page does not hold</span>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        The registry stores this bundle and who owns it. It does not store a run, a
        key, or any telemetry about either. Execution stays on your machine.
      </p>
    </section>
  );
}

/**
 * The visibility switch, owner only, drawn as two segments and switched off.
 *
 * The copy is the point of the panel rather than the control: publishing runs the
 * validator, gives a fork a scorecard of its own, and does not touch the upstream. A
 * reader deciding whether to publish a copy of somebody else's work is owed that before
 * they press anything, and none of it depends on the switch working.
 */
export function VisibilitySwitch({
  visibility,
  blocked = false,
  live,
}: {
  visibility: "public" | "private";
  /** The bundle does not resolve, so publishing is refused for a reason of its own. */
  blocked?: boolean;
  /** T280: owner-only, live. Wins over the drawn-and-disabled default below. */
  live?: { api: string };
}) {
  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="label">Visibility</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
          owner only
        </span>
      </div>

      {live !== undefined ? (
        <VisibilityControl api={live.api} visibility={visibility} />
      ) : (
        /* A radiogroup rather than two buttons: the two are one choice, and a screen reader
           should hear them as such. Both are `aria-disabled` and neither is bound, which is
           what the note under them says in words. */
        <div
          role="radiogroup"
          aria-label="Visibility"
          aria-disabled
          className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-line bg-void p-1"
        >
          {(["public", "private"] as const).map((option) => (
            <span
              key={option}
              role="radio"
              aria-checked={visibility === option}
              className={cx(
                "cursor-not-allowed rounded-sm px-3 py-1.5 text-center font-mono text-[11px] uppercase tracking-[0.12em]",
                visibility === option
                  ? "border border-cyan/50 bg-cyan/10 text-cyan"
                  : "text-dim",
              )}
            >
              {option}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        Publishing runs the validator over your graph and gives the copy a scorecard of its
        own. It does not change the upstream, and the lineage line stays.
      </p>
      {live !== undefined ? (
        /* T280 fills the gap the amber line below has stated since D-262-15: `bundle.visibility`
           was already a real, read column, and now `PATCH /api/bundles/[owner]/[slug]/visibility`
           is the route that writes it — SEAM-67 above is LIVE rather than a TODO. Nothing here
           is seeded any more, so the marker comes off rather than being reworded a third time. */
        <p className="mt-2 text-[11px] text-dim">
          {blocked
            ? "This bundle does not resolve. Publishing is refused for a reason of its own. The switch above still writes."
            : "Changes here save immediately."}
        </p>
      ) : (
        /* HALF OF THIS SENTENCE BECAME FALSE AND HALF DID NOT, so it is rewritten rather
            than deleted — D-262-15's move, where two `DangerRow` reasons were rewritten
            because there was an account and there was ownership and what was missing was the
            ROUTE. Measured here the same way: `bundle.visibility` is a real column, the
            canonical page reads it per request and the pill above states it (AC6, D-261-01),
            so "nothing stores a visibility" is false and the marker cannot keep saying it.
            The switch still writes nothing in THIS render — no `live` prop reached it, which
            is this component's own caller declining the live control, not the route being
            absent (SEAM-67 is LIVE) — so the switched-off half stays true of this instance
            and stays said. Deleting the whole line would be D-78's removed-early direction
            for the half that is still a limit. */
        <p className="mt-2 font-mono text-[11px] text-amber">
          {blocked
            ? "◐ seeded · this bundle does not resolve, so it could not publish even with a registry behind it"
            : "◐ seeded · the visibility above is stored and read. The switch is drawn and switched off because no route accepts the change."}
        </p>
      )}
    </section>
  );
}

/**
 * The bundle's identity rows, for a bundle the engine has never seen.
 *
 * `BundlePanel` is the real one and it renders for a published bundle: it takes the
 * digest the engine computed and the nodes it resolved. A private bundle has neither, so
 * this draws the same rows off a fixture and says so, rather than feeding invented nodes
 * into a component whose whole subject is content addressing.
 */
export function SeededBundleFacts({
  digest,
  nodes,
  pinnedCards,
  ontologyDeclared,
  scoredUnder,
  autonomy,
  resolves,
}: {
  digest: string;
  nodes: number;
  pinnedCards: number;
  ontologyDeclared: string;
  scoredUnder: string;
  autonomy: string;
  /** False when the bundle carries a node with no card, so there is no digest at all. */
  resolves: boolean;
}) {
  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="label">Bundle</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
          ◐ seeded
        </span>
      </div>

      <code
        className={cx(
          "block truncate rounded border border-line bg-surface-2 px-2 py-1 font-mono text-[11px]",
          resolves ? "text-fg" : "text-amber",
        )}
        title={digest}
      >
        {digest}
      </code>
      <p className="mt-2 text-xs leading-snug text-dim">
        {resolves
          ? "A digest is hashed over the DOT source and every card version the graph pins. This one is a fixture: nothing has hashed a bundle that exists only in lib/data/."
          : "No digest exists for this bundle. The engine hashes the DOT and every card version it pins, and it cannot hash a card that is not there."}
      </p>

      <dl className="mt-4 flex flex-col divide-y divide-line">
        {[
          ["Nodes", String(nodes)],
          ["Pinned cards", String(pinnedCards)],
          ["Ontology declared", `v${ontologyDeclared}`],
          ["Scores computed under", scoredUnder === "not computed" ? scoredUnder : `v${scoredUnder}`],
          ["Autonomy", autonomy],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2.5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-mono text-sm tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-xs leading-snug text-dim">
        Two scores from different ontology versions are not comparable.
      </p>
    </section>
  );
}

/**
 * The upstream repinned a card after this copy was taken.
 *
 * `.route-box`, which is the one shape on this site whose job is to send a reader
 * somewhere else, and the one other place amber is under contract for. Both halves are
 * true here: the panel is amber because it points away, and where it points is a card page
 * with the two versions on it, so the claim can be checked rather than taken.
 */
export function UpstreamMovedPanel({
  moved,
  upstream,
}: {
  moved: UpstreamMoved;
  upstream: { owner: string; slug: string };
}) {
  return (
    <section className="route-box p-5">
      <span className="route-label">Upstream moved</span>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        <Link
          href={`/blueprints/${upstream.slug}`}
          className="font-mono text-[12px] text-fg transition-colors hoverable:hover:text-cyan"
        >
          {upstream.owner}/{upstream.slug}
        </Link>{" "}
        repinned{" "}
        <span className="font-mono text-[12px] text-amber">
          {moved.card}@{moved.from} → {moved.to}
        </span>{" "}
        on {prettyDate(moved.at)}. Your copy still carries {moved.from}, so the two bundles
        hash differently and their security readings are not the same measurement.
      </p>
      <Link
        href={nodeHref(moved.card)}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-amber transition-colors hoverable:hover:border-amber"
      >
        Review the change →
      </Link>
    </section>
  );
}

/**
 * The releases, newest first.
 *
 * A release is the folder as it stood, kept at its digest. That is the property the note
 * at the foot states and the reason old ones matter: a pin somebody took never stops
 * resolving, which is the whole argument for content addressing.
 */
export function Releases({
  releases,
  fetchable,
  publishHref,
}: {
  releases: readonly Release[];
  /** Whether the folder is really on disk. False for anything unpublished. */
  fetchable: boolean;
  /**
   * T280: `/upload?owner=X&slug=Y`, owner-only — present only when `!fetchable` is also
   * true and the caller is the owner. `undefined` keeps the disabled button below, which
   * is what every caller that has not opted in still gets.
   */
  publishHref?: string;
}) {
  if (releases.length === 0) {
    return (
      <section className="panel p-5">
        <span className="label">Releases</span>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          None. A release is a snapshot addressed by its digest, and this bundle has no
          digest: two of its nodes have no card, so the loader refuses it.
        </p>
      </section>
    );
  }

  const [latest, ...older] = releases;

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Releases</span>
        <span className="font-mono text-[11px] text-dim">{releases.length}</span>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-[13px] text-cyan">{latest.version}</span>
          <MetaPill>latest</MetaPill>
        </div>
        <span className="font-mono text-[11px] text-dim">
          {prettyDate(latest.at)} · {latest.files} files · {latest.size}
        </span>
      </div>

      {older.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {older.map((release) => (
            <li key={release.version} className="font-mono text-[11px] text-dim">
              <span className="text-muted">{release.version}</span> ·{" "}
              {prettyDate(release.at)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs leading-relaxed text-dim">
        A release is the folder as it stood, kept at its digest, so a pin somebody took
        never stops resolving.{" "}
        {fetchable
          ? "This one is on disk and the command under Code, on the file list, fetches it."
          : "None of these is fetchable: the bundle is private, and the sizes and file counts below the version are seeded."}
      </p>
      {!fetchable && publishHref !== undefined && (
        <ButtonLink variant="outline" size="sm" className="mt-3" href={publishHref}>
          Publish a release
        </ButtonLink>
      )}
      {!fetchable && publishHref === undefined && (
        <Button
          variant="outline"
          size="sm"
          disabled
          className="mt-3"
          title="Publishing is the bundle owner's action, from this page."
        >
          Publish a release
        </Button>
      )}
    </section>
  );
}
