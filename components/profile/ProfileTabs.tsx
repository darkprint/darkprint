import Link from "next/link";

import { cx } from "@/lib/format";
import { PROFILE_TABS, profileTabHref, type ProfileTabId } from "./tabs";

/**
 * The tab strip: five routes, one of them the page a reader is on.
 *
 * No client state and no `usePathname`. Each page names its own tab, which is the only
 * arrangement where the active tab survives being prerendered — and every count is passed
 * in rather than computed here, because four of the five come off the archive and this
 * component has no business reaching for it.
 *
 * A count of `undefined` prints no pill. That is the overview, which counts nothing, and
 * it is not the same as a count of zero, which is a fact worth printing.
 */
export function ProfileTabs({
  username,
  active,
  counts,
  owner = false,
  note,
}: {
  username: string;
  active: ProfileTabId;
  counts: Partial<Record<ProfileTabId, number>>;
  owner?: boolean;
  /** The line at the strip's right end. Absent on the owner's own view. */
  note?: string;
}) {
  const tabs = PROFILE_TABS.filter((tab) => owner || tab.ownerOnly !== true);

  return (
    /* `pb-px` is not spacing, it is the fix for a scrollbar.
       ------------------------------------------------------------
       The active tab sits 1px lower than its own margin box (`-mb-px`) so its 2px underline
       covers this strip's 1px rule instead of stacking on top of it. That 1px is real
       overflow — and `overflow-x: auto` computes `overflow-y` to `auto` as well when the
       other axis is `visible`, per the overflow spec, so the strip rendered a vertical
       scrollbar thumb over the note at its right end. Measured in Chrome:
       `clientHeight` 45, `scrollHeight` 46. One pixel of bottom padding gives the overhang
       somewhere to land and the two agree. */
    <div className="mt-5 flex items-end gap-1 overflow-x-auto border-b border-line pb-px">
      <nav aria-label="Profile sections" className="flex items-end gap-1">
        {tabs.map((tab) => {
          const current = tab.id === active;
          const count = counts[tab.id];
          return (
            <Link
              key={tab.id}
              href={profileTabHref(username, tab)}
              aria-current={current ? "page" : undefined}
              className={cx(
                "-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-3 text-sm transition-colors",
                current
                  ? "border-cyan text-cyan"
                  : "border-transparent text-muted hoverable:hover:text-fg",
              )}
            >
              {tab.label}
              {count !== undefined && (
                <span
                  className={cx(
                    "rounded-full border px-1.5 font-mono text-[11px]",
                    current
                      ? "border-cyan/40 bg-cyan/10 text-cyan"
                      : "border-line text-dim",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      {note !== undefined && (
        <span className="ml-auto hidden shrink-0 py-3 pl-4 font-mono text-[11px] text-dim sm:inline">
          {note}
        </span>
      )}
    </div>
  );
}
