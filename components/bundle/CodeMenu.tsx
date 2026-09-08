import { cx } from "@/lib/format";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";

/* ============================================================
   "Get blueprint ▾" in the header band, right of Star and Fork.

   GitHub's "Code ▾", with its two items and nothing else: Download, a real file the browser
   saves, and Clone, the command line that fetches the same files by name. A native
   `<details>` rather than a script-driven menu: it is keyboard operable with no code,
   find-in-page reaches the command inside it, and the whole panel is in the prerendered
   HTML whether it is open or shut, which is what lets `code-menu.test.ts` hold the sentences
   below in place.

   Download comes first because it is the item that needs nothing installed. Clone sits
   under a badge because the package that would carry the command to a stranger's machine is
   not published to npm; the copy button stays, since the line is the CLI's own grammar and
   the verb runs from a build of the repository.

   The word "git" is not rendered. There is no repository behind a blueprint, no history and
   nothing to pull.

   A server component: nothing in it needs state, and the page it sits on is prerendered.
   ============================================================ */

/** The file the Download item hands over. */
interface CodeMenuDownload {
  /** The archive route for this release, pinned to its digest so the file names the release shown. */
  href: string;
  /** What the browser saves it as: `<slug>-<version>.tgz`. */
  name: string;
}

/**
 * The two registers this control is drawn in. A blueprint is cyan, the site's own accent; a
 * card is amber, so a reader can tell at a glance which of the two they are on.
 *
 * The amber trigger carries no amber ground at rest, only its border, its label and a hover
 * tint: a filled amber slab is the shape an honesty claim wears (the badge below, the box
 * that leaves the page), and the register must not borrow it.
 *
 * Contrast, `--color-amber` #ffb020 on `--color-surface` #0a0c16: 10.66:1 for the label; the
 * 50% border composites to 3.36:1, past the 3:1 floor for a non-text boundary.
 */
const TONE = {
  cyan: {
    trigger:
      "border-cyan/40 bg-cyan/5 text-cyan hoverable:hover:border-cyan hoverable:hover:bg-cyan/10",
    download:
      "border-cyan/40 text-cyan hoverable:hover:border-cyan hoverable:hover:bg-cyan/10",
  },
  amber: {
    trigger:
      "border-amber/50 bg-transparent text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
    download:
      "border-amber/60 text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
  },
} as const;

export function CodeMenu({
  download,
  cloneCommand,
  label = "Get blueprint",
  tone = "cyan",
  className,
}: {
  /** The archive of this release, as the link the Download item is. */
  download: CodeMenuDownload;
  /**
   * The `npx -y darkprint clone <owner>/<slug>` line, built by the caller so the CLI's own
   * grammar has one home.
   */
  cloneCommand: string;
  /**
   * What the trigger says. The default is the blueprint band's; a card page passes
   * `Get card`. The panel's prose is not parameterised: every sentence in it is a claim
   * about a release, and a caller able to swap the copy could drop a disclosure without any
   * cell noticing.
   */
  label?: string;
  /** Which register the trigger is drawn in. See `TONE`. */
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <details className={cx("group relative", className)}>
      {/* `Button`'s outline variant, spelled out, because a `<summary>` cannot be a
          `<button>`. `h-9` to match the two `ActionPill`s beside it in the band. The press
          list names `scale` explicitly: Tailwind v4 compiles `scale-[0.97]` to the standalone
          `scale:` property, which a `transition-property` naming only `transform` misses. */}
      <summary
        className={cx(
          "inline-flex h-9 cursor-pointer select-none list-none items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverable:active:scale-[0.97] [&::-webkit-details-marker]:hidden",
          TONE[tone].trigger,
        )}
      >
        {label}
        <span
          aria-hidden
          className="inline-block text-dim transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      {/* Anchored to the right edge: this trigger is the last item in a row aligned to the
          band's right edge, and a panel centred on it runs off a 390px screen. */}
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-4 rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40">
        {/* ---- 1. Download ---- */}
        <div className="flex flex-col gap-2">
          <p className="label-lead text-fg">Download</p>
          {/* `download` names the file so a browser that would otherwise open the archive
              inline writes it to disk instead. */}
          <a
            href={download.href}
            download={download.name}
            className={cx(
              "inline-flex h-9 w-fit items-center gap-2 rounded-md border px-3 font-mono text-[12px] transition-colors",
              TONE[tone].download,
            )}
          >
            <span aria-hidden>↓</span>
            {download.name}
          </a>
          <p className="text-xs leading-relaxed text-muted">
            Every file of this release in one archive, ready to unpack into a folder.
          </p>
        </div>

        {/* ---- 2. Clone ---- */}
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="label-lead text-fg">Clone</p>
          {/* One unwrapped line in its own horizontal scroller. A `\`-continued form breaks
              the moment it is pasted into a terminal that eats the backslash. */}
          <div className="flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-void px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg">
              <code>{cloneCommand}</code>
            </pre>
            <CopyButton text={cloneCommand} ariaLabel="Copy the clone command" />
          </div>
          {/* Fenced in the honesty shape: a filled ground under a heavy leading rule, a badge
              and the limit in words, so the claim stays readable beside an amber register. */}
          <div className="flex flex-col gap-2 rounded-md border border-amber/30 border-l-2 border-l-amber bg-amber/8 p-3">
            <ComingSoonBadge className="self-start" />
            <p className="text-xs leading-relaxed text-muted">
              Not installable yet: the darkprint package is not published to npm, so npx
              finds nothing to run. The verb itself runs from a build of the private
              repository.
            </p>
          </div>
        </div>

        {/* What both items are, said once under them: nothing here is a repository. */}
        <p className="border-t border-line pt-3 text-xs leading-relaxed text-muted">
          <span className="text-fg">There is no repository and no history behind a release.</span>{" "}
          Download hands you its files as they stand, and Clone fetches the same files by
          name.
        </p>
      </div>
    </details>
  );
}
