"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { announceMenuOpened, useCloseWhenAnotherMenuOpens } from "@/components/ui/menu-group";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// TODO(SEAM-70) (cited at line 45): POST /api/bundles/{owner}/{slug}/fork

/** Which page this action renders on, so its copy names the right thing. */
type ForkKind = "blueprint" | "node";

/**
 * "Fork blueprint", built to the locked design in this pass's spec §1 rather than to the
 * author's own words for it.
 *
 * The author's ask is the GitHub model, restated this pass and sharpened: "the fork can
 * be private to a user, the idea follows exactly the idea of github". So a fork belongs to
 * an account, is visible only to its owner until they publish it, and the profile at
 * `/u/[username]` is where it would be listed.
 *
 * None of that is built. There is no account system and none is being built this pass
 * (Fase 4, PROJECT.md §3.5), so this panel says both halves and marks which is which: what
 * forking does today, in the present tense, and what it is meant to become, behind
 * `ComingSoonBadge`. A button that fired a second download under a "fork" label would
 * either lie about what just happened or duplicate `DownloadPanel` under a worse name, so
 * the link still points at `#download`, which already lists every file a fork needs.
 *
 * `ForkScene` used to hang at the top of this panel and the author asked it out. Its job
 * was to show that a fork is a copied folder, which the sentence below says in fewer
 * pixels, and drawing a published graph beside a forked one implied both copies exist
 * somewhere on this site. They do not: one is yours, on your disk.
 *
 * A toggle button with `aria-expanded`, not a `<details>`: the panel has to sit inside a
 * `relative` wrapper so it can float below the button without stretching the header row
 * it shares with the download button (see the `absolute` panel below), and a `<summary>`
 * built to look like `Button`'s outline variant is more surface than a controlled toggle.
 *
 * `kind` is the one thing that differs between the two pages this renders on: a
 * blueprint is a folder and its whole-folder download lives at `#download` on its own
 * page; a node card is a single file and this page's own "Download card" button carries
 * that same anchor instead. Defaulting to `"blueprint"` keeps the existing call on
 * `app/blueprints/[slug]/page.tsx` rendering exactly what it did before this prop existed.
 */
export function ForkAction({
  className,
  kind = "blueprint",
}: {
  className?: string;
  kind?: ForkKind;
}) {
  const [open, setOpen] = useState(false);
  // A stable id across renders, so `aria-controls` always names the element that exists,
  // not a guess a second instance of this component on the same page could collide with.
  const panelId = useId();

  // This panel and `CloneMenu`'s sit in the same header row, both centred under their own
  // trigger and both wider than the gap between the two triggers: open together, the second
  // covers the first. `components/ui/menu-group.ts` is the one-event coordination that
  // keeps one open at a time, and it is why `panelId` doubles as this menu's identity.
  const close = useCallback(() => setOpen(false), []);
  useCloseWhenAnotherMenuOpens(panelId, close);

  return (
    <div className={cx("relative", className)}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((o) => {
            if (!o) announceMenuOpened(panelId);
            return !o;
          });
        }}
      >
        {kind === "node" ? "Fork card" : "Fork blueprint"}
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
          aria-label={
            kind === "node"
              ? "What forking this card means"
              : "What forking this blueprint means"
          }
          className="absolute left-1/2 top-[calc(100%+0.5rem)] z-20 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-3 rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40"
        >
          <p className="text-xs leading-relaxed text-muted">
            {kind === "node"
              ? "Forking a card means copying this file into one of your own and editing it there: a line changed, or a person put where a step in the graph hands off. Either copy is a complete card."
              : "Forking a blueprint means copying this folder into one of your own and editing it there: a card changed, or a person put where the release goes out. Either copy is a complete blueprint."}{" "}
            <span className="text-fg">
              This site holds no copy of it, and no account stands behind a fork.
            </span>
          </p>

          {/* The intended model, kept apart from the paragraph above so the present tense
              and the future one are never read as one claim. */}
          <div className="flex flex-col gap-1.5 rounded-md border border-amber/30 bg-amber/5 p-3">
            <ComingSoonBadge className="self-start" />
            <p className="text-xs leading-relaxed text-muted">
              Forks are meant to work the way they do on GitHub: yours, kept private until
              you publish, and listed on your profile. Accounts are not built, so today a
              fork is a folder on your machine and nothing here knows about it.
            </p>
          </div>

          <Link
            href="#download"
            className="inline-flex items-center gap-1.5 self-start font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan"
          >
            {kind === "node"
              ? "Take the card from Download"
              : "Take the whole folder from Download"}
            <span aria-hidden>↓</span>
          </Link>
        </div>
      )}
    </div>
  );
}
