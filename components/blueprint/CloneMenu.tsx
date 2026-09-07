"use client";

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
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
   shut. A panel gated on `open && (…)` renders none of itself into the static markup, so
   no honesty assertion can be written over its badge. This one is always there, which is
   the precondition for the ledger entry in
   `components/site/honesty.test.ts` that holds the CLI's disclaimer in place.

   ── Two shapes, one body ──
   `menu` is the dropdown for a header row, where the reader is one click from it. `plain`
   is the same body with no trigger, for inside a panel that already sits behind a
   disclosure — a dropdown inside a disclosure would be two clicks and a floating panel
   inside a panel.
   ============================================================ */

/** Which page this renders on, so the copy names the right thing. */
type CloneKind = "blueprint" | "node";

/**
 * The trigger, per kind, and the two differences between them are both the owner's.
 *
 * The label: the owner asked for the node card's header to read "star, fork, Download
 * Card" (2026-09-05), so on a card this menu IS the download control and wears its name.
 * A blueprint's header is unchanged.
 *
 * The colour: `--color-amber`, on the owner's ruling of 2026-09-06 — "the amber should be
 * the dominant color on the cards sections. So that an user in a glance can know wheter
 * they are on a blueprint or in a card."
 *
 * ── The argument this replaces, which is worth reading and does not get to win again ──
 * The `node` pill was copper. `app/globals.css` reserved amber for two claims,
 * `ComingSoonBadge` ("not built yet") and the box shape that leaves the page, and held
 * that painting the most literally-built thing on the site in the not-built-yet colour was
 * the one lie the figure could not afford. That paragraph was spent once, on 2026-09-05,
 * to answer this same owner asking for this same thing. They have now asked a second time
 * in their own words, and the shelf this control sits one route away from was already
 * amber-led. A reservation is a claim about which meanings may spend a hue; which hue
 * carries a whole register is the owner's call, and they have made it twice.
 *
 * ── The collision, and the thing that is NOT allowed to disappear into it ──
 * The panel this trigger opens fences an unbuilt CLI preview in amber and puts a
 * `ComingSoonBadge` inside the fence. Both are honesty claims, and CLAUDE.md forbids
 * weakening one — camouflage weakens one. So the two are separated by FORM rather than by
 * hue, and the separation is deliberate on both sides:
 *
 *   * this trigger carries NO amber ground at rest. Border, label and caret only, with a
 *     tint arriving on hover. A filled amber rectangle is the honesty shape and stays
 *     unique to it;
 *   * the fence below keeps its fill AND gains the heavy leading rule the site's
 *     leaves-the-page box already uses, so the claim reads as a slab rather than as one
 *     more accent in the register around it.
 *
 * `components/nodes/card-header-controls.test.ts` holds both halves.
 *
 * Contrast, measured for this hue rather than carried over from copper's: `--color-amber`
 * #ffb020 on `--color-surface` #0a0c16 is 10.66:1 against the 8.35:1 copper read, and the
 * 60% border composites to 4.35:1 where `copper-line/40` sat at 2.19:1 and missed the 3:1
 * floor WCAG 1.4.11 sets for a non-text boundary. Every number here goes up.
 *
 * `h-9` on the card, `h-10` on the blueprint. On a card this trigger stands third in a row
 * of three beside two `ActionPill`s, which are `h-9`; on a blueprint it does not.
 */
const TRIGGER: Record<CloneKind, { label: string; pill: string; caret: string }> = {
  blueprint: {
    label: "Get the folder",
    pill: "h-10 border-line-bright bg-transparent text-fg hoverable:hover:border-cyan hoverable:hover:text-cyan",
    caret: "text-dim",
  },
  node: {
    label: "Download card",
    pill: "h-9 border-amber/60 bg-transparent text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
    caret: "text-amber",
  },
};

export function CloneMenu({
  kind,
  command,
  cliCommand,
  save,
  variant = "menu",
  className,
}: {
  kind: CloneKind;
  /** `bundleDownloadCommand(...)` / `cardDownloadCommand(...)`, computed at build time. */
  command: string;
  /** What `darkprint clone` would read once there is a `darkprint`. Never runnable. */
  cliCommand: string;
  /**
   * The click-to-save control, when the caller has one: a `download` link the reader
   * presses instead of pasting a command. Rendered first in the panel, because the
   * panel's order is its argument (see `CloneBody`) and this is the shortest path from
   * the page to the file on disk.
   *
   * A `ReactNode` rather than an href, so it stays SERVER-rendered in the caller. The node
   * page's link carries the whole card document in a `data:` URI; handed over as a string
   * it would be serialised into this client component's payload as well as into the
   * markup, for a button that does not need a client at all.
   */
  save?: ReactNode;
  variant?: "menu" | "plain";
  className?: string;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (details.current !== null) details.current.open = false;
  }, []);
  useCloseWhenAnotherMenuOpens(id, close);

  const body = <CloneBody kind={kind} command={command} cliCommand={cliCommand} save={save} />;

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
        className={cx(
          "inline-flex cursor-pointer select-none list-none items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97] [&::-webkit-details-marker]:hidden",
          TRIGGER[kind].pill,
        )}
      >
        {TRIGGER[kind].label}
        <span
          aria-hidden
          className={cx(
            "inline-block transition-transform group-open:rotate-180",
            TRIGGER[kind].caret,
          )}
        >
          ▾
        </span>
      </summary>

      {/* `right-0` rather than centred under the trigger, and the difference is measured
          rather than stylistic. The trigger sits in a header group the page pushes to the
          right with `ml-auto … justify-end`, so this one — the last item before the
          download button — has its right edge at or near the column's right edge at every
          width. Centring it there is what breaks: at 390px the trigger runs 229→366, a
          centred 358px panel lands 118→476, and 86px of it is off the screen with the body
          scrolling sideways to reach it. Anchored right, the same panel lands 8→366 and is
          wholly visible.

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
 * under it, and the thing that does not exist is last and fenced off in amber.
 *
 * Amber now also carries the card's whole accent register (see `TRIGGER`), so the fence can
 * no longer rely on hue alone to say "this half is not built". It relies on shape: a filled
 * ground, a heavy leading rule, a badge and the refusal in words. Nothing in the register
 * around it carries a fill or a leading rule, which is what keeps the claim readable as a
 * claim. The working command, its copy button and the prose around it stay `text-fg` and
 * `text-dim`; tinting a command that runs today to match its neighbour would say the
 * opposite of the truth in this panel.
 */
function CloneBody({
  kind,
  command,
  cliCommand,
  save,
}: {
  kind: CloneKind;
  command: string;
  cliCommand: string;
  save?: ReactNode;
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

      {/* The click-to-save path, above the paste-into-a-terminal one. It used to stand as
          its own button in the node page's header row; the owner asked that row down to
          three controls (star, fork, download), so the two download paths are one control
          with the button inside it rather than one of them being dropped. Ordered first
          because the panel's order is its argument and this is the one that needs nothing
          but a click. */}
      {save}

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
          The command copies {kind === "node" ? "the file" : "the folder"} as it stands.
          That is a snapshot, not a clone.
        </span>{" "}
        There is no repository behind it and no history, so there is nothing to pull
        later. When{" "}
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
          "run this", and there is nothing to run.

          The leading rule is the load-bearing part since the owner made amber the card's
          register (2026-09-06). `app/globals.css` gives the leaves-the-page box the same
          shape, a tinted amber ground under a heavy amber edge, and that shape is what
          separates an honesty claim from an accent now that both are the same hue. The
          fill went 5% to 8% for the same reason: this block has to read as a slab beside a
          trigger that is amber line work on nothing. `border-l-2` after the `border`
          shorthand, which is the order Tailwind emits them in, so the leading edge wins. */}
      <div className="flex flex-col gap-2 rounded-md border border-amber/30 border-l-2 border-l-amber bg-amber/8 p-3">
        <ComingSoonBadge className="self-start" />
        <code className="block overflow-x-auto font-mono text-[11px] leading-relaxed text-dim select-none">
          {cliCommand}
        </code>
        <p className="text-xs leading-relaxed text-muted">
          {/* The refusal stays FRONT-LOADED. The plain-English pass moved "is not built
              yet" to the end of the clause, which is grammatical and worse: a reader
              skimming an amber panel must meet the refusal before the capability it
              describes, and the subject sat five nouns away from its verb. The sentence
              splitting that pass added is kept. */}
          Not built yet: a darkprint CLI that clones a {subject} by name
          {kind === "node"
            ? ", and fetches the version you ask for"
            : ", resolves every card it pins and tells you when one of them moves"}
          . There is nothing to install today. The line above is a preview, not a command.
        </p>
      </div>
    </div>
  );
}
