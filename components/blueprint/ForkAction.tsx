"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/viz";
import { ForkScene } from "@/components/home/lifecycle/ForkScene";

/**
 * "Fork blueprint", built to the locked design in this pass's spec §1 rather than to the
 * author's own words for it.
 *
 * The author's ask was the GitHub model verbatim: "the blueprint is forked in the user
 * account and then the user can download it, edit it and upload it back." There is no
 * account system, no server-side fork and none is being built this pass (Fase 4,
 * PROJECT.md §3.5) — so a button that fired a second download under a "fork" label would
 * either lie about what just happened or duplicate `DownloadPanel` under a worse name.
 * What ships instead is a real interaction: a disclosure holding `ForkScene` (already
 * built, already honest — "a property of the format", "either one runs on your machine"),
 * two sentences saying the same thing in words, and a link to `#download`, which already
 * lists every file a fork actually needs. "Get the files" has one honest answer on this
 * page, and this button points at it rather than inventing a second one.
 *
 * A toggle button with `aria-expanded`, not a `<details>`: the panel has to sit inside a
 * `relative` wrapper so it can float below the button without stretching the header row
 * it shares with the download button (see the `absolute` panel below), and a `<summary>`
 * built to look like `Button`'s outline variant is more surface than a controlled toggle.
 */
export function ForkAction({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // A stable id across renders, so `aria-controls` always names the element that exists,
  // not a guess a second instance of this component on the same page could collide with.
  const panelId = useId();

  return (
    <div className={cx("relative", className)}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Fork blueprint
        <span
          aria-hidden
          className={cx(
            "inline-block text-dim transition-transform",
            open && "rotate-180",
          )}
        >
          ▾
        </span>
      </Button>

      {/* Centred under the button rather than `right-0`-anchored to it. This wrapper
          sizes to the left button of a two-button pair a *parent* `ml-auto` pushes to
          a header row's right end — near the row's right edge on a wide viewport, but
          on a phone the row wraps and this button lands left-of-centre with
          `min(22rem, 100vw-2rem)` of panel width to its right. `right-0` measured
          this: the panel's left edge landed 92px off the left of a 488px viewport.
          Centring keeps the panel wholly on screen at any width the trigger can land
          at. */}
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="What forking this blueprint means"
          className="absolute left-1/2 top-[calc(100%+0.5rem)] z-20 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40"
        >
          {/* Same drawing, same caption, `SectionLifecycle` used before this pass
              retired that section (spec §2.1) — reused unmodified rather than resized,
              because `FlowScene`'s `<svg>` is `w-full h-auto` over a `viewBox`: it already
              scales to whatever this panel's width turns out to be, so shrinking the
              frame here would only shrink it a second time. */}
          <Sheet
            register="blueprint"
            label="cp -r · git init"
            title="the same folder, edited"
            note="a property of the format"
          >
            <ForkScene />
          </Sheet>

          <p className="text-xs leading-relaxed text-muted">
            Forking a blueprint means copying this folder into one of your own, the same
            edit the drawing above shows: a card changed, or a person put where the
            release goes out, and either copy is a complete blueprint. This site holds no
            copy of it, and no account stands behind a fork.
          </p>

          <Link
            href="#download"
            className="inline-flex items-center gap-1.5 self-start font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            Take the whole folder from Download
            <span aria-hidden>↓</span>
          </Link>
        </div>
      )}
    </div>
  );
}
