"use client";

import { useCallback, useId, useRef, type KeyboardEvent } from "react";
import { cx } from "@/lib/format";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { announceMenuOpened, useCloseWhenAnotherMenuOpens } from "@/components/ui/menu-group";

/* ============================================================
   Taking the folder from a terminal — GitHub's "Code ▾", honestly.

   The author asked for "a sort of `git clone blueprint_name` as for github … when
   downloading a blueprint or a yaml card". Half of that ask is real and half of it is a
   word, and this component is built to keep the two apart.

   ── What is real ──
   The bundles are static files under `public/bundles/<slug>/`, and curl's own URL
   globbing fetches all of them in one command, recreating `cards/` and `ontology/` under
   a folder named after the blueprint. `lib/content/bundle-export.ts` builds the string —
   `bundleDownloadCommand`, whose docblock records every flag and the alternative it was
   measured against — from `bundleFilePaths`, so the command names exactly the files the
   generator wrote and cannot drift from them. Verified end to end: exit 0, the folder
   lands, `diff -r` against `public/bundles/<slug>` reports no differences.

   ── What is a word ──
   There is no repository. No history, no remote, nothing to pull, nothing to check out.
   The command copies a **snapshot**, and the difference is stated under it rather than
   left for a reader to discover when `git pull` fails. The word "git" is not rendered by
   this component at all: `components/site/honesty.test.ts` asserts its absence over both
   kinds of this panel, and `lib/content/bundle-export.test.ts` asserts it over every
   command the archive can produce. The word "clone" survives in exactly one place — the
   `darkprint clone` line — because that is the thing that would genuinely be a clone, and
   it wears `ComingSoonBadge` because it does not exist.

   ── Why a native `<details>` ──
   `components/ui/More.tsx` and every disclosure around it are `<details>`, and this is a
   disclosure. That buys three things this panel specifically needs: it is keyboard
   operable with no code (Enter/Space on the summary, tab into the panel), find-in-page
   reaches the command inside it, and — the reason it is allowed to carry a "not built
   yet" claim at all — the whole panel is in the prerendered HTML whether it is open or
   shut. `ForkAction` gates its panel on `open && (…)`, so its badge is simply absent from
   the static markup and no honesty assertion can be written over it. This one is always
   there, which is the precondition for the ledger entry in
   `components/site/honesty.test.ts` that holds the CLI's disclaimer in place.

   ── Two shapes, one body ──
   `menu` is the dropdown for a header row, where the reader is one click from it. `plain`
   is the same body with no trigger, for inside `DownloadPanel`, which already sits behind
   a `<More summary="Download">` — a dropdown inside a disclosure would be two clicks and
   a floating panel inside a panel.
   ============================================================ */

/** Which page this renders on, so the copy names the right thing. */
type CloneKind = "blueprint" | "node";

export function CloneMenu({
  kind,
  command,
  cliCommand,
  variant = "menu",
  className,
}: {
  kind: CloneKind;
  /** `bundleDownloadCommand(...)` / `cardDownloadCommand(...)`, computed at build time. */
  command: string;
  /** What `darkprint clone` would read once there is a `darkprint`. Never runnable. */
  cliCommand: string;
  variant?: "menu" | "plain";
  className?: string;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (details.current !== null) details.current.open = false;
  }, []);
  useCloseWhenAnotherMenuOpens(id, close);

  const body = <CloneBody kind={kind} command={command} cliCommand={cliCommand} />;

  if (variant === "plain") {
    return (
      <div className={cx("rounded-md border border-line bg-surface-2/40 p-3", className)}>
        {body}
      </div>
    );
  }

  return (
    <details
      ref={details}
      className={cx("group relative", className)}
      onToggle={(event) => {
        if (event.currentTarget.open) announceMenuOpened(id);
      }}
      // Escape closes and hands focus back to the trigger, which is what every other
      // dropdown on the web does and what `<details>` alone does not do. Bound on the
      // element rather than on `document`, so it only fires for a reader who is inside
      // this panel.
      onKeyDown={(event: KeyboardEvent<HTMLDetailsElement>) => {
        if (event.key !== "Escape" || !event.currentTarget.open) return;
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }}
    >
      {/* `Button`'s outline variant, spelled out: a `<summary>` cannot be a `<button>`,
          and the two triggers in this header row have to look like one pair. The press
          list names `scale` explicitly — Tailwind v4 compiles `scale-[0.97]` to the
          standalone `scale:` property, which a `transition-property` naming only
          `transform` does not cover (see `components/ui/Button.tsx`). */}
      <summary
        className="inline-flex h-10 cursor-pointer select-none list-none items-center justify-center gap-2 whitespace-nowrap rounded-md border border-line-bright bg-transparent px-4 text-sm text-fg transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:hover:border-cyan hoverable:hover:text-cyan hoverable:active:scale-[0.97] [&::-webkit-details-marker]:hidden"
      >
        {kind === "node" ? "Get the file" : "Get the folder"}
        <span
          aria-hidden
          className="inline-block text-dim transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      {/* `right-0`, where `ForkAction`'s sibling panel is centred, and the difference is
          measured rather than stylistic. Both triggers sit in a header group the page
          pushes to the right with `ml-auto … justify-end`, so this one — the last item
          before the download button — has its right edge at or near the column's right
          edge at every width. Centring it there is what breaks: at 390px the trigger runs
          229→366, a centred 358px panel lands 118→476, and 86px of it is off the screen
          with the body scrolling sideways to reach it. Anchored right, the same panel
          lands 8→366 and is wholly visible. `ForkAction` is the leftmost of the group and
          measured the mirror image of this, which is why the two differ.

          `z-30` rather than `z-20`: if a reader somehow gets both panels open, the one
          they just asked for is the readable one. */}
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40">
        {body}
      </div>
    </details>
  );
}

/**
 * The command, what it does not do, and the CLI that would.
 *
 * Order is the argument: the thing that works is first and largest, its limit is directly
 * under it, and the thing that does not exist is last and fenced off in amber. Amber is
 * spent here on exactly the two jobs it is reserved for — `ComingSoonBadge` and the
 * surround around the half of this panel that is not built. The working command, its copy
 * button and the prose around it stay cyan and `text-dim`; tinting a command that runs
 * today to match its neighbour would say the opposite of the truth in this panel.
 */
function CloneBody({
  kind,
  command,
  cliCommand,
}: {
  kind: CloneKind;
  command: string;
  cliCommand: string;
}) {
  /** What lands on disk: a directory for a blueprint, one document for a card. */
  const thing = kind === "node" ? "card" : "folder";
  /** What the reader is on the page of. The noun the ledger's claim is written with. */
  const subject = kind === "node" ? "card" : "blueprint";

  return (
    <div className="flex flex-col gap-3">
      <p className="label-lead text-fg">
        {kind === "node" ? "Take the file" : "Take the whole folder"}
      </p>

      {/* One unwrapped line in its own horizontal scroller. A `\`-continued multi-line
          form breaks the moment it is pasted into a terminal that eats the backslash, and
          the longest bundle's command is 462 characters — nothing wraps that readably on
          a 390px phone either. `overflow-x-auto` keeps it off the page's own scrollbar. */}
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-void px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg">
          <code>{command}</code>
        </pre>
        <CopyButton
          text={command}
          ariaLabel={`Copy the command that downloads this ${thing}`}
        />
      </div>

      {/* The honest difference from a clone, beside the command rather than behind
          anything. Both halves are load-bearing: what it is not (a repository), and what
          that costs (the list of files is fixed at the moment this page was built, so a
          copy kept in a script goes stale when a pin moves). */}
      <p className="text-xs leading-relaxed text-muted">
        These are static files over HTTP.{" "}
        <span className="text-fg">
          The command copies {kind === "node" ? "the file" : "the folder"} as it stands
          right now — a snapshot, not a clone.
        </span>{" "}
        There is no repository behind it, no history, and nothing to pull later. When{" "}
        {kind === "node" ? "a new version is published" : "a card in this blueprint is repinned"},
        come back for the command again rather than re-running an old copy of it.
      </p>

      {/* PowerShell 5.1 aliases `curl` to `Invoke-WebRequest`, which rejects every flag in
          the line above with a parameter-binding error. One sentence is cheaper than a
          Windows reader concluding that the one working thing on this menu is broken. */}
      <p className="text-xs leading-relaxed text-dim">
        On Windows PowerShell, write <code className="font-mono text-muted">curl.exe</code>:
        the bare <code className="font-mono text-muted">curl</code> there is an alias for a
        different program.
      </p>

      {/* Not built. No copy button, on purpose — a copy button is an affordance that says
          "run this", and there is nothing to run. */}
      <div className="flex flex-col gap-2 rounded-md border border-amber/30 bg-amber/5 p-3">
        <ComingSoonBadge className="self-start" />
        <code className="block overflow-x-auto font-mono text-[11px] leading-relaxed text-dim select-none">
          {cliCommand}
        </code>
        <p className="text-xs leading-relaxed text-muted">
          Not built yet: a darkprint CLI that clones a {subject} by name
          {kind === "node"
            ? ", and fetches the version you ask for"
            : ", resolves every card it pins and tells you when one of them moves"}
          . There is nothing to install today, so the line above is a preview and not a
          command.
        </p>
      </div>
    </div>
  );
}
