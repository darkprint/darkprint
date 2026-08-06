/* ============================================================
   /spec — the paper both figures are drawn on.

   Two things are shared and neither is decoration.

   The first is the sheet itself, so Fig. 1 and Fig. 2 read as two
   plates of one drawing set rather than two components that
   happened to pick the same register.

   The second is the scroll box, which exists for phones. A scene
   is authored in viewBox units and scales to whatever width it is
   given, so a 720-unit drawing on a 390-pixel screen renders its
   10-unit labels at five pixels, which is a drawing nobody can
   read. Below the minimum width the scene keeps its size and the
   box pans instead. The box takes a tab stop and a name for the
   same reason `SourcePanel` does: nothing inside it is focusable,
   so without one a keyboard-only reader cannot scroll it at all
   (WCAG 2.1.1).

   Not a client component. It renders markup and nothing else, and
   both figures carry their own `"use client"`.
   ============================================================ */

import { Sheet } from "@/components/viz";

export function FigureFrame({
  label,
  title,
  note,
  scrollLabel,
  caption,
  children,
}: {
  /** Mono caption along the top edge. The plate number and its subject. */
  label: React.ReactNode;
  /** Title block, left. */
  title: React.ReactNode;
  /** Title block, right. */
  note: React.ReactNode;
  /** Names the scroll box for a screen reader, e.g. "Fig. 1". */
  scrollLabel: string;
  caption: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-3">
      <Sheet
        register="blueprint"
        label={label}
        title={title}
        note={note}
        bodyClassName="p-0"
      >
        <div
          tabIndex={0}
          role="group"
          aria-label={`${scrollLabel}, scrollable`}
          className="overflow-x-auto p-4 sm:p-6"
        >
          <div className="min-w-[38rem]">{children}</div>
        </div>
      </Sheet>
      {/* `.prose-lane` here rather than at each call site.
          ------------------------------------------------------------
          A caption is body prose — it is the only sentence on the plate written to be
          read straight through — and uncapped it ran the full 1152px container, which
          put "On the card, ◆ marks a value…" at 183 characters a line on the one
          sentence that has to teach two marks at once. Three of the four pages that
          mount a figure had already worked around that with a
          `[&_figcaption]:max-w-[var(--measure)]` wrapper, which is the same rule stated
          three times in places that cannot see each other. The frame owns the caption,
          so the frame owns its measure. The drawing above keeps the full container:
          a figure is not prose. */}
      <figcaption className="prose-lane text-sm leading-relaxed text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}
