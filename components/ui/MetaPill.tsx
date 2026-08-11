/**
 * A small bordered pill stating one fact about the thing beside it.
 *
 * `Public`, `Private`, a version, `forked`, `latest`. It is deliberately not `Badge`:
 * `Badge` carries a coloured dot and a meaning, and these say something plain about a
 * bundle. Two tones and no more — `surface` for the one a reader should read first
 * (visibility), `line` for the rest — because a row of five differently-lit pills stops
 * ranking anything.
 *
 * It lives in `components/ui` rather than beside its first caller because three surfaces
 * now draw it: the pinned cards, the owner's bundle list, and a bundle's own header band.
 */
export function MetaPill({
  children,
  tone = "line",
}: {
  children: React.ReactNode;
  tone?: "line" | "surface";
}) {
  return (
    <span
      className={
        tone === "surface"
          ? "shrink-0 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 font-mono text-[11px] text-muted"
          : "shrink-0 rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-dim"
      }
    >
      {children}
    </span>
  );
}
