"use client";

import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { announceMenuOpened, useCloseWhenAnotherMenuOpens } from "@/components/ui/menu-group";

/* ============================================================
   "Get card ▾": GitHub's "Code ▾" for a card, with its two items.

   Download is the card document itself, as a link the browser saves; Clone is the
   `npx -y darkprint clone <owner>/<name>@<version>` line with a copy button. The panel is a
   native `<details>` for the reasons `components/bundle/CodeMenu.tsx` gives: keyboard
   operable with no code, findable in page, and wholly in the prerendered HTML whether open
   or shut, which is what lets `components/site/honesty.test.ts` hold the sentence under
   Clone in place.

   There is no repository behind a card. The word "git" is not rendered by this component,
   and the panel says in words what Download and Clone each hand over.

   A client component, unlike `CodeMenu`, because a card page carries two dropdowns and
   `menu-group` closes one when the other opens; a `<details>` alone cannot hear its
   neighbour.
   ============================================================ */

/** Which page this renders on, so the trigger and the fence name the right thing. */
type CloneKind = "blueprint" | "node";

/**
 * The trigger, per kind. A card is amber, the register the owner gave the card pages so a
 * reader can tell at a glance which of the two they are on; a blueprint keeps the site's
 * neutral outline. The amber trigger carries no amber ground at rest: a filled amber slab is
 * the shape an honesty claim wears, and the register must not borrow it.
 *
 * `h-9` on the card, `h-10` on the blueprint. On a card this trigger stands third in a row
 * of three beside two `ActionPill`s, which are `h-9`.
 */
const TRIGGER: Record<CloneKind, { label: string; pill: string; caret: string; download: string }> = {
  blueprint: {
    label: "Get blueprint",
    pill: "h-10 border-line-bright bg-transparent text-fg hoverable:hover:border-cyan hoverable:hover:text-cyan",
    caret: "text-dim",
    download: "border-line-bright text-fg hoverable:hover:border-cyan hoverable:hover:text-cyan",
  },
  node: {
    label: "Get card",
    pill: "h-9 border-amber/60 bg-transparent text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
    caret: "text-amber",
    download: "border-amber/60 text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
  },
};

export function CloneMenu({
  kind,
  cloneCommand,
  download,
  variant = "menu",
  className,
}: {
  kind: CloneKind;
  /** The `npx -y darkprint clone …` line, built by the caller so the CLI's grammar has one home. */
  cloneCommand: string;
  /**
   * The Download item: an `<a download>` the reader presses to save the file.
   *
   * A `ReactNode` rather than an href, so it stays SERVER-rendered in the caller. The card
   * page's link carries the whole card document in a `data:` URI; handed over as a string
   * it would be serialised into this client component's payload as well as into the markup,
   * for a link that does not need a client at all. Absent when there is no stored document,
   * and the item then says so rather than offering a link to nothing.
   */
  download?: ReactNode;
  variant?: "menu" | "plain";
  className?: string;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);

  const close = useCallback(() => {
    if (details.current !== null) details.current.open = false;
  }, []);
  useCloseWhenAnotherMenuOpens(id, close);

  const body = <CloneBody kind={kind} cloneCommand={cloneCommand} download={download} />;

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
          and the triggers in this header row have to look like one set. The press list
          names `scale` explicitly: Tailwind v4 compiles `scale-[0.97]` to the standalone
          `scale:` property, which a `transition-property` naming only `transform` misses. */}
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

      {/* `right-0` rather than centred under the trigger: this is the last item in a header
          group the page pushes to the right, so its right edge sits at the column's edge at
          every width, and a centred panel runs off a 390px screen. `z-30` so that if a
          reader somehow gets both panels open, the one they just asked for is readable. */}
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40">
        {body}
      </div>
    </details>
  );
}

/**
 * The two items, Download then Clone, and one sentence under them saying what each hands
 * over. Download first because it needs nothing installed.
 *
 * Amber also carries the card's whole accent register (see `TRIGGER`), so the fence under
 * Clone cannot rely on hue alone to say "this half is not built". It relies on shape: a
 * filled ground, a heavy leading rule, a badge and the refusal in words. Nothing in the
 * register around it carries a fill or a leading rule.
 */
function CloneBody({
  kind,
  cloneCommand,
  download,
}: {
  kind: CloneKind;
  cloneCommand: string;
  download?: ReactNode;
}) {
  /** What the reader is on the page of. */
  const subject = kind === "node" ? "card" : "blueprint";

  return (
    <div className="flex flex-col gap-4">
      {/* ---- 1. Download ---- */}
      <div className="flex flex-col gap-2">
        <p className="label-lead text-fg">Download</p>
        {download ?? (
          <p className="text-xs leading-relaxed text-dim">
            No stored document for this {subject}, so there is no file to save.
          </p>
        )}
      </div>

      {/* ---- 2. Clone ---- */}
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="label-lead text-fg">Clone</p>
        {/* One unwrapped line in its own horizontal scroller. A `\`-continued multi-line
            form breaks the moment it is pasted into a terminal that eats the backslash. */}
        <div className="flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-void px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg">
            <code>{cloneCommand}</code>
          </pre>
          <CopyButton text={cloneCommand} ariaLabel="Copy the clone command" />
        </div>

        {/* The fence: a filled ground under a heavy leading rule, a badge and the limit in
            words. `border-l-2` after the `border` shorthand, which is the order Tailwind
            emits them in, so the leading edge wins. The card verb is the half the CLI does
            not have yet; the package is the half neither kind has. */}
        <div className="flex flex-col gap-2 rounded-md border border-amber/30 border-l-2 border-l-amber bg-amber/8 p-3">
          <ComingSoonBadge className="self-start" />
          <p className="text-xs leading-relaxed text-muted">
            {kind === "node" ? (
              <>
                Not built yet: a darkprint CLI that clones a card by name. The darkprint
                package is not published to npm, so this line runs nowhere today.
              </>
            ) : (
              <>
                Not installable yet: the darkprint package is not published to npm, so this
                line runs only from a checkout of the repository.
              </>
            )}
          </p>
        </div>
      </div>

      {/* What both items are, said once under them: nothing here is a repository. */}
      <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
        <span className="text-fg">
          There is no repository and no history behind a {kind === "node" ? "card" : "release"}.
        </span>{" "}
        {kind === "node"
          ? "Download hands you the document as it stands, and Clone fetches the same document by name."
          : "Download hands you its files as they stand, and Clone fetches the same files by name."}
      </p>
    </div>
  );
}
