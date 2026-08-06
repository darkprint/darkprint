/* ============================================================
   Prose with `backticked` identifiers in it.
   ------------------------------------------------------------
   Four unrelated bodies of text on this site are written that
   way — the engine's version bump reasons, a card author's
   `notes`, the node card figure's annotations, and the field
   notes in `components/panes/field-notes.ts` — and the port,
   parameter and diagnostic names inside the ticks are the
   substance of the sentence rather than decoration.

   It lived in `components/nodes/VersionHistory.tsx`, its first
   and busiest caller, until the field notes needed it. That file
   imports `inferBump` from `lib/core`, and `SkeletonPane` is a
   client component: importing the renderer from there would have
   pulled the engine into the browser bundle to draw a `<code>`
   tag. So it moved here, where it depends on nothing at all.
   ============================================================ */

export function Ticked({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code
            key={i}
            className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-fg"
          >
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
