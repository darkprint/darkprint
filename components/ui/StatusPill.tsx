import { cx } from "@/lib/format";

/** The four words a capability row is allowed to say about itself. */
export type CapabilityStatus = "live" | "checkout" | "not built" | "by design";

/**
 * One tone per word, spelled once.
 *
 * The table lives here rather than at the call sites because a status word painted two
 * ways on one page stops being a status: a reader who learns emerald from the first table
 * has to learn it again at the second. Emerald is what this site spends on a figure read
 * off the engine, and blueprint ink is what the hairline rows on `/skill` and `/mcp`
 * already give to a name written in a document.
 *
 * `by design` is muted, and it must never become amber. `app/globals.css` reserves
 * `--color-amber` for "not built yet" and names its two contracted consumers,
 * `ComingSoonBadge` and `.route-box`. A row marked `by design` is the opposite claim: the
 * thing is built and it declines to do something on purpose, so amber there would tell a
 * reader that work is owed on a row where none is. `not built` takes amber for the same
 * reason it works at all, since that row makes exactly the claim the badge makes, said as
 * a word in a column instead of as a pill. `app/skill/page.tsx` already spends it that
 * way on its unbuilt rows.
 */
const STATUS_TONE: Record<CapabilityStatus, string> = {
  live: "text-emerald",
  checkout: "text-blueprint-ink",
  "not built": "text-amber",
  "by design": "text-muted",
};

/**
 * A status word, for the status column of a capability table.
 *
 * No border, whatever the name suggests: it stands in a column beside plain text, and a
 * frame around every value would draw a second grid over the one the rows already make.
 * 11px mono is the floor `app/globals.css` writes down and states has no exceptions, so a
 * crowded status column cannot buy width by going smaller.
 *
 * Lower case, tracked at 0.06em rather than the 0.18em label tier, because
 * `app/globals.css` rules that a mono uppercase run is a LABEL and a label is not a
 * heading level. These are values sitting under a label, so they do not dress as one.
 * `whitespace-nowrap` since two of the four words are two words, and a status broken
 * across lines reads as two statuses.
 */
export function StatusPill({
  status,
  className,
}: {
  status: CapabilityStatus;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "font-mono text-[11px] tracking-[0.06em] whitespace-nowrap",
        STATUS_TONE[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
