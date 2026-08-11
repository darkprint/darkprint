import Link from "next/link";

import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { cx } from "@/lib/format";
import { MCP_CONNECT_COMMAND, MCP_ROUTE } from "@/lib/mcp";
import { SKILL_INSTALL_COMMAND, SKILL_ROUTE } from "@/lib/skill";

/* ============================================================
   The two ways in, in the hero's top-left corner.

   ── Why they left `Wordmark` ──
   They sat at the foot of the centred column, last in the entrance, arriving at 1.26s
   behind the buttons. Two things were wrong with that and the author named both.

   **They are not part of the lockup.** The wordmark is a name, a rule and a claim, animated
   as one object. A command a reader can copy is a different kind of thing, and being inside
   that component is what put it on the timeline in the first place: `Wordmark`'s docblock
   says every element the timeline touches carries a `data-mark`, so anything living there
   acquires a beat by proximity. Out here there is no timeline to join.

   **They should be readable immediately.** A reader who arrives knowing what DarkPrint is
   comes for the install line, and the old order made them wait out a 1.4-second entrance to
   see it. Nothing here fades, scales or waits; the server renders it and that is what a
   reader gets, with JS, without it, and with reduced motion.

   ── Why in flow rather than pinned ──
   The corner is the ask, and `absolute` is the obvious way to hit it. It is also how the
   chips end up over the name on a short window: the hero is `min-h` of one viewport, the
   lockup is around 500px of it, and two out-of-flow chips at the top would cross the
   letters somewhere under 700px of height. In flow at the top of a column they cannot,
   and the cost is that the lockup centres in what is left rather than in the whole section.
   ============================================================ */

/**
 * One row per way in, in the author's order: the thing that works, then the thing that
 * does not yet. `built` decides both the border and whether the badge is drawn, so a
 * command cannot quietly lose the sentence that says it is not connected to anything.
 */
const SETUPS = [
  {
    key: "skill",
    label: "Design your blueprint",
    command: SKILL_INSTALL_COMMAND,
    href: SKILL_ROUTE,
    built: true,
  },
  {
    key: "mcp",
    label: "Connect via MCP",
    command: MCP_CONNECT_COMMAND,
    href: MCP_ROUTE,
    built: false,
  },
] as const;

export function SetupChips() {
  return (
    <div className="flex w-fit max-w-full flex-col gap-3">
      {SETUPS.map((setup) => (
        <Link
          key={setup.key}
          data-setup={setup.key}
          href={setup.href}
          className={cx(
            "group flex max-w-full flex-col items-start gap-1 rounded-md border bg-surface-2/80 px-3 py-2 text-left transition-[transform,scale,color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
            setup.built
              ? "border-emerald/50 hoverable:hover:border-emerald/75"
              : "border-line hoverable:hover:border-line-bright",
          )}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="label">{setup.label}</span>
            {!setup.built && <ComingSoonBadge />}
          </span>
          <span
            className={cx(
              "max-w-full font-mono text-xs transition-colors",
              setup.built ? "text-emerald hoverable:group-hover:text-fg" : "text-muted",
            )}
          >
            {`$ ${setup.command}`}
          </span>
        </Link>
      ))}
    </div>
  );
}
