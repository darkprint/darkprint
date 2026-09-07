import { cx } from "@/lib/format";
import { VisibilityControl } from "@/components/bundle/VisibilityControl";

/* ============================================================
   The visibility switch a bundle with no release shows its owner.

   This file used to be the column beside a bundle: what the
   registry does not hold, the identity rows, the upstream drift and
   the releases. The owner took those panels off the page one at a
   time and the graph runs full width now. `VisibilitySwitch` is the
   one export left with a mount, in `DraftLanding`, which hands it
   the live PATCH /api/bundles/{owner}/{slug}/visibility control.
   `components/profile/OwnedBundles.tsx` draws its own row control
   for released bundles, so nothing here is on the path a reader
   takes to change a visibility.
   ============================================================ */

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
  /** Owner-only, live. Wins over the drawn-and-disabled default below. */
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
        /* Nothing in this render is seeded: the column is real and the route writes it,
           so the line carries no marker. */
        <p className="mt-2 text-[11px] text-dim">
          {blocked
            ? "This bundle does not resolve. Publishing is refused for a reason of its own. The switch above still writes."
            : "Changes here save immediately."}
        </p>
      ) : (
        /* The visibility is stored and read, and this render received no `live` control,
           so the switch is drawn and switched off. The marker stays for the half that is
           still a limit of this instance. */
        <p className="mt-2 font-mono text-[11px] text-amber">
          {blocked
            ? "◐ seeded · this bundle does not resolve, so it could not publish even with a registry behind it"
            : "◐ seeded · the visibility above is stored and read. The switch is drawn and switched off because no route accepts the change."}
        </p>
      )}
    </section>
  );
}

