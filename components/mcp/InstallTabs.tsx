"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { cx } from "@/lib/format";
import { MCP_CLIENTS } from "./clients";

export function InstallTabs({ className }: { className?: string } = {}) {
  const [active, setActive] = useState<string>(MCP_CLIENTS[0].id);
  const current = MCP_CLIENTS.find((c) => c.id === active) ?? MCP_CLIENTS[0];
  // Ties each tab to the one panel it discloses, the same `id`/`aria-controls`/
  // `aria-labelledby` triangle `components/build/WorkspaceStage.tsx` uses for the five
  // tabs of `/build`'s stage.
  const tabsId = useId();

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /**
   * Arrow keys across the tablist, with selection following focus — the same
   * automatic-activation rule `components/build/tablist.ts` holds for every other tablist
   * on the site, written out here rather than imported. It was ported from `/build`'s own
   * tablist before that rule was factored out, and `tablist.ts`'s docblock records why this
   * copy was left where it is: `nextTabIndex(key, at, MCP_CLIENTS.length, "horizontal")` is
   * exactly the branch below, and swapping to it is a change worth making the day this file
   * is open for another reason.
   */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const at = MCP_CLIENTS.findIndex((client) => client.id === active);
    let next = -1;
    if (event.key === "ArrowRight") next = (at + 1) % MCP_CLIENTS.length;
    else if (event.key === "ArrowLeft") next = (at - 1 + MCP_CLIENTS.length) % MCP_CLIENTS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = MCP_CLIENTS.length - 1;
    else return;
    event.preventDefault();
    setActive(MCP_CLIENTS[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    /* No panel and no emerald frame, since 2026-08-11.
       ------------------------------------------------------------
       Both were the author's instruction on 2026-08-07: `.panel` with `border-emerald/50`,
       because emerald is the engine's register — `app/globals.css` calls it "a figure read
       off the engine" — and this holds six client configurations, which is machine-facing
       text if anything on the site is. The reasoning was sound and the frame was carrying a
       tension the comment had to spend a paragraph defusing: green reads as "this works",
       and nothing here does.

       The 3a mock resolves it by not framing the block at all. The tabs are chips, the
       snippet is one bordered box, and the register is carried by the section around them —
       which now opens by saying the package does not exist. A frame that needs a paragraph
       explaining why it is not a lie is a frame doing too much work. */
    <div className={cx("flex min-w-0 max-w-full flex-col gap-3", className)}>
      {/* Chips, not a ruled tab bar. The mock fills the active one in `--color-blueprint-ink`
          and outlines the rest, at the same padding, in title case rather than the uppercase
          run this used — six client names at 0.1em tracking read as six section labels, and
          they are controls. The active chip carries a transparent border so selecting one
          does not move the row by two pixels. */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="MCP client"
        onKeyDown={onTabKeyDown}
      >
        {MCP_CLIENTS.map((client, index) => {
          const isActive = client.id === active;
          return (
            <button
              key={client.id}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${client.id}`}
              aria-selected={isActive}
              aria-controls={`${tabsId}-panel`}
              tabIndex={isActive ? 0 : -1}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              onClick={() => setActive(client.id)}
              className={cx(
                // Press at 0.97 — the middle of the site's three bands (≤40px → 0.94,
                // 40–200px → 0.97, >200px → 0.99) — on an explicit property list, because
                // `transition-colors` cannot carry a press and `transition-all` would put
                // layout properties on the same clock. `scale` is named alongside
                // `transform`: Tailwind v4 compiles `scale-[0.97]` to the standalone
                // `scale:` property, which CSS transitions separately from `transform`.
                //
                // The unselected tab keeps `text-dim` exactly as it was: unselected is not
                // disabled, and borrowing the disabled ink would say the other three
                // clients are unavailable rather than unshown.
                "rounded-md border px-2.5 py-1.5 font-mono text-xs transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97]",
                isActive
                  ? "border-transparent bg-blueprint-ink text-void"
                  : "border-line text-muted hoverable:hover:text-fg",
              )}
            >
              {client.label}
            </button>
          );
        })}
      </div>

      {/* The reserved height is gone, and it is the reason this component was opened.
          ------------------------------------------------------------
          It was `min-h-[248px]`, and the arithmetic behind it was right: the snippets run
          1 line and 8 lines, so switching from Claude Code to Claude Desktop shoves
          everything below this block 112px down the page in a single frame — the reader
          clicks a tab and the thing they were reading leaves the screen. Reserving the
          tallest client's height fixed that.

          What it cost is what the author saw: the default tab is the ONE-line client, so
          every reader who never touches a tab meets 200px of empty box under a single
          command. A fix for an interaction nobody has performed yet, paid for on arrival by
          everybody. The mock draws the block at the height of its contents and this follows
          it.

          The jump is therefore back, and it is worth naming rather than leaving to be
          rediscovered: selecting Claude Desktop, Cursor, VS Code or Gemini CLI grows this
          box by about 110px and moves the rest of the page down with it. If that becomes
          the complaint, the fix is not this `min-h` again — it is to stop the growth
          mattering, by putting the block last in its section or by giving the `<pre>` its
          own scroll at a fixed height. */}
      <div
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${current.id}`}
        className="flex min-w-0 flex-col gap-3"
      >
        {/* The `{label} configuration` heading and the emerald `configuration` chip stood
            here, one above the snippet and one opposite it, and between them they printed
            the word twice over a box whose contents are self-evidently configuration. The
            mock has neither, and §1's own intro carries the claim now: "The shape of the
            configuration, so the proposal can be read against a real host."
            `InstallTabs.test.ts` follows that move rather than the wording. */}

        {/* `key` remounts the box on a tab change so `starting:opacity-0` has a first style
            to transition from — a 120ms fade that says the text under the cursor was
            replaced, not merely re-rendered. Pure CSS, resting state at full opacity: the
            snippet is readable with no script, and in a browser without `@starting-style`
            the rule is dropped and the snippet simply appears.

            The copy control is `CopyButton`, which is what every other command on the site
            hands its string to, and the mock draws one here. It was absent while this block
            was framed as a specimen rather than as something to use. */}
        <div
          key={current.id}
          className="flex min-w-0 items-start gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3 transition-opacity duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0"
        >
          {/* `--color-blueprint-line`, on the author's instruction, and it is the site's
              blue rather than A blue. The two candidates are not interchangeable:
              `app/globals.css` reserves `--color-cyan` for one meaning — "cyan is
              interactive, and the site does not spend it elsewhere" — and this snippet is
              text a reader copies, not a control. `--color-blueprint-line` is the
              cyanotype pole's own line colour, which is what the register this page is
              drawn in uses for the thing being drawn.

              It is also the counterpart to `/skill`'s emerald command, and the difference
              between the two is exactly right: emerald is "a figure read off the engine",
              spent there on a command that genuinely reaches one, and this command reaches
              nothing. Blueprint blue says drawing, not engine. */}
          <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-blueprint-line">
            <code>{current.snippet}</code>
          </pre>
          <CopyButton
            text={current.snippet}
            ariaLabel={`Copy the ${current.label} configuration`}
          />
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3 text-sm leading-relaxed text-dim">
          <p>{current.note}</p>
          {current.docsHref !== undefined && (
            <Link
              href={current.docsHref}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 font-mono text-cyan underline decoration-cyan/40 underline-offset-4"
            >
              Client docs ↗
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
