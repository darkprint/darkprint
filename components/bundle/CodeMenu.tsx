import { cx } from "@/lib/format";

/* ============================================================
   "Download blueprint ▾" in the header band, right of Star and Fork.

   It opened as `Code ▾` on the file list's own header row, GitHub's shape. The owner asked
   for the word and the position both: "remove the Code button and move on top right on the
   side right of the Star; the order should be: star, fork, download blueprint." So the label
   says what the control does rather than naming the thing it hands over, and it sits in the
   band with the other two actions instead of on the panel it downloads.

   What did NOT change is that this is one disclosure holding one command and every file. The
   argument for that shape is below and none of it turned on where the trigger sits.

   ── What this replaces, and what it had to keep ──
   `components/blueprint/DownloadPanel.tsx` and `components/blueprint/CloneMenu.tsx` render
   the same two facts today: the command that fetches the folder, and every file in it as a
   link. Both headers are worth reading before touching this one; three of their decisions
   are carried over verbatim rather than re-derived.

     1. A native `<details>`, not a script-driven menu. It is keyboard operable with no
        code, find-in-page reaches the command inside it, and the whole panel is in the
        prerendered HTML whether it is open or shut. That last property is the precondition
        for asserting anything about the sentences below: a panel gated on `open && (…)` is
        simply absent from the markup a static render produces, and no honesty cell can be
        written over what is not there.
     2. No copy button. `CloneMenu` spends one on its `curl` line because that line runs
        today, and withholds one from its `darkprint` line because a copy button is an
        affordance that says "run this". The command here is the `darkprint` one, and the
        package behind it is not on npm (`app/capabilities/page.tsx` says the same thing at
        length: every verb runs from a checkout). So the command is printed, its limit is
        printed under it, and nothing here offers to load it into a clipboard.
     3. The word "git" is not rendered. There is no repository behind a bundle, no history
        and nothing to pull. `components/site/honesty.test.ts` holds that over the older
        menus; the cell in `code-menu.test.ts` holds it over this one.

   This one is a SERVER component, which `CloneMenu` could not be: that file needs `useRef`
   and `useId` for Escape-to-close and for closing when a sibling menu opens. Neither
   applies to the last control in a header band, and neither is worth a client bundle on a
   page whose whole point is that it is prerendered.
   ============================================================ */

/** One file in the release, and where it is really served from. */
interface CodeMenuFile {
  /** Bundle-relative, forward slashes, as `releaseFiles` returns it. */
  path: string;
  href: string;
}

/**
 * The two registers this control is drawn in, and they are not interchangeable.
 *
 * A blueprint is cyan, which is the site's own accent and the colour every blueprint surface
 * already carries. A card is AMBER, on the owner's instruction of 2026-09-06: "the amber
 * should be the dominant color on the cards sections. So that an user in a glance can know
 * wheter they are on a blueprint or in a card."
 *
 * ── What that overrules, kept because a reader arriving here needs it ──
 * This entry read `copper` until that ruling. `app/globals.css` reserved amber for two
 * claims, `ComingSoonBadge` and the box shape that leaves the page, and argued that a
 * working download must not wear the not-built-yet colour. The owner asked for amber once
 * on 2026-09-05, was answered with copper, and has now asked again in the same words. The
 * reservation was a preference dressed as a rule about which two claims may spend a hue; a
 * whole register carried by one page is a third claim, and it is the owner's to make.
 *
 * ── The collision the ruling creates, and what is done about it here ──
 * The card's own panel elsewhere in the header band (`components/blueprint/CloneMenu.tsx`)
 * fences an unbuilt CLI preview in amber, so the register and an honesty claim now share a
 * hue. What separates them is FORM, not colour: an honesty claim is a filled amber slab with
 * a heavy leading rule and the words that make the claim, and the register is line weight on
 * text and edges. This trigger therefore carries no amber ground at rest — only its border,
 * its label and a hover tint — so the filled amber slab stays unique to the claim.
 *
 * Contrast, re-measured for the hue rather than carried across it, `--color-amber` #ffb020
 * on `--color-surface` #0a0c16: 10.66:1, above the 9.10:1 the cyan tone reads and the 8.35:1
 * the copper one read. The 50% border composites to 3.36:1, past the 3:1 WCAG 1.4.11 floor
 * for a non-text boundary, where the copper it replaces sat at 2.83:1 and did not.
 */
const TONE = {
  cyan: "border-cyan/40 bg-cyan/5 text-cyan hoverable:hover:border-cyan hoverable:hover:bg-cyan/10",
  amber:
    "border-amber/50 bg-transparent text-amber hoverable:hover:border-amber hoverable:hover:bg-amber/10",
} as const;

export function CodeMenu({
  command,
  files,
  label = "Download blueprint",
  tone = "cyan",
  className,
}: {
  /**
   * The `darkprint clone …` line for this release, built by the caller.
   *
   * Handed in rather than composed here: the CLI's own grammar lives in
   * `packages/cli/src/run.ts` and the page knows which owner, slug and version it is
   * rendering. A component that assembled the string would be a second place for the
   * command to drift from the verb that answers it.
   */
  command: string;
  /**
   * Every file the download contains. Empty is a real state — a bundle with no published
   * release has nothing to list — and the list is then omitted rather than drawn empty.
   */
  files: readonly CodeMenuFile[];
  /**
   * What the trigger says. The default is the blueprint band's, in the owner's own words; a
   * card page passes `Download card`.
   *
   * The panel's own prose is NOT parameterised, and that is deliberate rather than an
   * oversight. Every sentence in it is a claim about a bundle release — the npm gap, the
   * snapshot-not-a-clone limit, the absence of anything to pull — and `code-menu.test.ts`
   * holds all three. A caller able to swap the copy could drop a disclosure without any cell
   * noticing. A subject that needs different sentences needs a different control.
   */
  label?: string;
  /** Which register the trigger is drawn in. See `TONE`. */
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <details className={cx("group relative", className)}>
      {/* `Button`'s outline variant, spelled out, because a `<summary>` cannot be a
          `<button>`. Accented rather than the neutral `border-line-bright`: it is the one
          control in this row a reader is looking for, the way GitHub's own is the accented
          one on the page.

          `h-9`, not the `h-8` this had on the file list's strip: the two pills beside it in
          the band are `ActionPill`s, which are `h-9`, and a 32px control between two 36px
          ones is a row that reads as misaligned rather than as three actions.

          The press list names `scale` explicitly — Tailwind v4 compiles `scale-[0.97]` to
          the standalone `scale:` property, which a `transition-property` naming only
          `transform` does not cover (see `components/ui/Button.tsx`). */}
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

      {/* `right-0`, for the reason `CloneMenu` measured: this trigger is the last item in a
          row aligned to the band's right edge, and a panel centred on it runs off a 390px
          screen and takes the body's horizontal scrollbar with it. Anchored to the right
          edge it is wholly visible at every width. Being last in the row is what makes that
          true — an item before a wrap point does not end where the group does. */}
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 rounded-lg border border-line-bright bg-surface-2 p-4 shadow-xl shadow-black/40">
        <p className="label-lead text-fg">Take the folder</p>

        {/* One unwrapped line in its own horizontal scroller. A `\`-continued form breaks
            the moment it is pasted into a terminal that eats the backslash. */}
        <pre className="overflow-x-auto rounded border border-line bg-void px-2 py-1.5 font-mono text-[11px] leading-relaxed text-fg">
          <code>{command}</code>
        </pre>

        {/* The limit on the command, directly under it. `darkprint clone` is implemented
            (`packages/cli/src/clone.ts`) and the package that would carry it to a strange
            machine is not published, which is a different claim from "not built yet" and
            has to be said as itself. */}
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-fg">
            The darkprint package is not on npm yet, so this runs from a checkout of the
            repository and not on a machine that has never seen it.
          </span>{" "}
          What it copies is the release named above, as it stands right now. That is a
          snapshot, not a clone. There is no repository behind it and no history, so there
          is nothing to pull later.
        </p>

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
                    {/* The hover follows the trigger's register rather than being cyan
                        for both callers. A card's file list lighting up cyan under the
                        pointer is the blueprint's colour appearing inside the one panel
                        the owner asked to read as a card. */}
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
