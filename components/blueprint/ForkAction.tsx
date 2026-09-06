"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { announceMenuOpened, useCloseWhenAnotherMenuOpens } from "@/components/ui/menu-group";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-70 LIVE (T280): POST /api/bundles/{owner}/{slug}/fork — wired at the header's own
// Fork button (`components/bundle/ForkButton.tsx`), which this panel now points to.
// SEAM-118 LIVE: the card fork is a route of its own now, and its control is
// `components/nodes/CardForkButton.tsx`. This panel does not explain it.

/**
 * "Fork blueprint", built to the locked design in this pass's spec §1 rather than to the
 * author's own words for it.
 *
 * **NOTHING MOUNTS THIS COMPONENT.** Measured 2026-09-06, both halves separately: no file
 * under `app/`, `components/`, `lib/`, `tests/`, `scripts/` or `packages/` imports it, and
 * a grep over `app/` and `components/` for its own JSX opening tag returns nothing. The tag
 * is described rather than written out here, because a needle quoted in prose is a needle a
 * source-reading guard cannot tell from a real mount.
 *
 * Where each half of it went. The blueprint mode was replaced by the header's own Fork pill
 * (`components/bundle/ForkButton.tsx`, through `BundleHeader`'s `fork` prop), which performs
 * the write this panel only ever explained. The `kind="node"` mode was replaced by
 * `components/nodes/CardForkButton.tsx` over `POST /api/cards/{id}/fork`, and the branch
 * itself was deleted from this file before its caller was.
 *
 * It survives rather than being deleted, and the reason is not sentiment:
 *
 *   - whether an unmounted component survives is the owner's call, the same rule
 *     `components/bundle/Aside.tsx`'s header states over its own four.
 *   - six files that are not this one still reason ABOUT it in prose:
 *     `components/ui/menu-group.ts` and `components/blueprint/CloneMenu.tsx` derive their
 *     own floating-panel behaviour from what this one does, `components/bundle/code-menu.test.ts`
 *     and `components/nodes/card-header-controls.test.ts` cite it, `CardForkButton.tsx`
 *     records what it replaced, and `components/site/honesty.test.ts` contrasts a `<details>`
 *     with this panel's controlled toggle. That last one is byte-frozen, so a deletion here
 *     would leave a sentence nobody can correct without an owner-attributed amendment.
 *   - `docs/architecture/seams.md` anchors SEAM-70 at this file's line range and
 *     `docs/DECISIONS.md` cites it as D-17's implemented evidence.
 *
 * So the file is kept and this paragraph is the honest label on it. Nothing below should be
 * read as describing something a reader can reach.
 *
 * The author's ask is the GitHub model, restated this pass and sharpened: "the fork can
 * be private to a user, the idea follows exactly the idea of github". So a fork belongs to
 * an account, is visible only to its owner until they publish it, and the profile at
 * `/u/[username]` is where it would be listed.
 *
 * **T280: that model is built and live for a blueprint**, through the header's own Fork
 * button (`components/bundle/ForkButton.tsx`) over `POST /api/bundles/[owner]/[slug]/fork`
 * — this panel's job narrows to explaining what it does and pointing there, rather than
 * describing a future. The link points at `#download`, which already lists every file a
 * hand-taken folder needs: a button that fired a second download under a "fork" label would
 * either lie about what just happened or duplicate `DownloadPanel` under a worse name.
 *
 * **The `kind="node"` branch is deleted, and the reason is that its copy became false.**
 * It carried a `ComingSoonBadge` and the sentence that this site has a fork route for a
 * whole blueprint and none for a single card. `POST /api/cards/{id}/fork` shipped
 * (SEAM-118) and `components/nodes/CardForkButton.tsx` is the control that calls it, so
 * the badge would now be a "not built yet" marker over something built, which is the one
 * direction D-78 rules out. The branch had no caller left on `/nodes/[...id]` either: that
 * header carries the real Fork button in the slot this panel used to take.
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
 */
export function ForkAction({ className }: { className?: string }) {
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
          <p className="text-xs leading-relaxed text-muted">
            Forking a blueprint means copying this folder into one of your own and editing
            it there. You change a card, or you place a person where the release goes out.
            Either copy is a complete blueprint.{" "}
            <span className="text-fg">
              The Fork button above does this for real, into your own account; use it
              there. This panel is for taking the folder by hand instead, with no account
              behind the copy.
            </span>
          </p>

          {/* T280: live, and kept apart from the paragraph above so the two registers are
              never read as one claim. */}
          <div className="flex flex-col gap-1.5 rounded-md border border-line bg-void/40 p-3">
            <p className="text-xs leading-relaxed text-muted">
              A fork made through the header button follows the GitHub model: yours,
              private unless your account&rsquo;s own default is public, and listed
              on your profile.
            </p>
          </div>

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
