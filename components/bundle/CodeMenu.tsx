import { cx } from "@/lib/format";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { CopyButton } from "@/components/ui/CopyButton";

/* ============================================================
   "Download blueprint ▾" in the header band, right of Star and Fork.

   One disclosure holding the command that works, the command that does not yet, and every
   file in the release. A native `<details>` rather than a script-driven menu: it is keyboard
   operable with no code, find-in-page reaches the command inside it, and the whole panel is
   in the prerendered HTML whether it is open or shut, which is what lets `code-menu.test.ts`
   hold the sentences below in place.

   The order is the argument. The `curl` line runs today and comes first, with a copy
   button. The `darkprint clone` line sits last under a badge, with no copy button, because
   the package that would carry it to a stranger's machine is not published to npm; a copy
   button says "run this", and nothing here offers to load a line into a clipboard that
   would fail there.

   The word "git" is not rendered. There is no repository behind a blueprint, no history and
   nothing to pull.

   A server component: nothing in it needs state, and the page it sits on is prerendered.
   ============================================================ */

/** One file in the release, and where it is really served from. */
interface CodeMenuFile {
  /** Bundle-relative, forward slashes, as `releaseFiles` returns it. */
  path: string;
  href: string;
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
  cyan: "border-cyan/40 bg-cyan/5 text-cyan hoverable:hover:border-cyan hoverable:hover:bg-cyan/10",
  amber:
    "border-amber/50 bg-transparent text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
} as const;

export function CodeMenu({
  command,
  cliCommand,
  files,
  label = "Download blueprint",
  tone = "cyan",
  className,
}: {
  /** The `curl` line that fetches every file of this release at its digest address. */
  command: string;
  /**
   * The `darkprint clone …` line for this release, built by the caller so the CLI's own
   * grammar has one home. Printed under a badge and never offered to the clipboard.
   */
  cliCommand: string;
  /**
   * Every file the download contains. Empty is a real state, a release with nothing to
   * list, and the list is then omitted rather than drawn empty.
   */
  files: readonly CodeMenuFile[];
  /**
   * What the trigger says. The default is the blueprint band's; a card page passes
   * `Download card`. The panel's prose is not parameterised: every sentence in it is a claim
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
          TONE[tone],
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
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40">
        <p className="label-lead text-fg">Download the folder</p>

        {/* One unwrapped line in its own horizontal scroller. A `\`-continued form breaks
            the moment it is pasted into a terminal that eats the backslash. */}
        <div className="flex items-start gap-2">
          <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-line bg-void px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg">
            <code>{command}</code>
          </pre>
          <CopyButton text={command} ariaLabel="Copy the command that downloads this folder" />
        </div>

        <p className="text-xs leading-relaxed text-muted">
          <span className="text-fg">
            It copies the release named above, as it stands right now. That is a snapshot,
            not a clone.
          </span>{" "}
          There is no repository behind it and no history, so there is nothing to pull
          later.
        </p>

        {/* PowerShell 5.1 aliases `curl` to `Invoke-WebRequest`, which rejects every flag
            above with a parameter-binding error. */}
        <p className="text-xs leading-relaxed text-dim">
          On Windows PowerShell, write <code className="font-mono text-muted">curl.exe</code>:
          the bare <code className="font-mono text-muted">curl</code> there is an alias for a
          different program.
        </p>

        {/* Fenced in the honesty shape: a filled ground under a heavy leading rule, a badge
            and the limit in words, so the claim stays readable beside an amber register. */}
        <div className="flex flex-col gap-2 rounded-md border border-amber/30 border-l-2 border-l-amber bg-amber/8 p-3">
          <ComingSoonBadge className="self-start" />
          <code className="block overflow-x-auto font-mono text-[11px] leading-relaxed text-dim select-none">
            {cliCommand}
          </code>
          <p className="text-xs leading-relaxed text-muted">
            Not installable yet: the darkprint package is not published to npm, so this line
            runs only from a checkout of the repository.
          </p>
        </div>

        {files.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <p className="flex items-center gap-2 font-mono text-xs text-muted">
              Files
              <span className="text-dim">
                {files.length} file{files.length === 1 ? "" : "s"}
              </span>
            </p>
            {/* One at a time, for the reader who wants the README and not the folder.
                `download` names the path so a browser that would otherwise render the
                document inline writes it to disk instead. */}
            <ul className="flex flex-col divide-y divide-line">
              {files.map((file) => (
                <li key={file.path} className="py-1.5 first:pt-0 last:pb-0">
                  <a
                    href={file.href}
                    download={file.path}
                    className="group/file flex items-baseline justify-between gap-2"
                  >
                    <span
                      className={cx(
                        "min-w-0 truncate font-mono text-[11px] text-muted transition-colors",
                        tone === "cyan"
                          ? "group-hover/file:text-cyan"
                          : "group-hover/file:text-amber",
                      )}
                    >
                      {file.path}
                    </span>
                    <span aria-hidden className="shrink-0 font-mono text-[11px] text-dim">
                      ↓
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
