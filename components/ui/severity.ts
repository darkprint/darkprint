import type { Severity } from "@/lib/core";

/**
 * How a diagnostic's severity is presented, everywhere on the site.
 *
 * **The glyph and the word both carry the meaning — the colour is decoration, so a
 * reader who cannot see it loses nothing.** That rule was written in
 * `components/ui/DiagnosticList.tsx` and held there, and it was broken the moment a
 * second surface started rendering diagnostics: the length pass (cut density, keep every
 * statement reachable) moved the criteria notes off the sidebar list and into the panel
 * that interprets them, and the
 * new renderers emitted an `aria-hidden` amber ▲ with no word beside it. The word
 * "warning" then appeared on none of the nine blueprint pages, where it had been on all
 * nine. A screen-reader user got no severity at all, and the same ▲ meant "warning" in
 * one block and "votes" two blocks below it in the same sidebar.
 *
 * The table lives in its own module so there is exactly one of it. Any surface that
 * prints a diagnostic imports `SEVERITY_META` and prints `word` next to `glyph`;
 * `components/blueprint/severity-word.test.ts` builds the archive's nine bundles and
 * fails if a severity reaches a reader as a glyph alone.
 */
export const SEVERITY_META: Record<
  Severity,
  { glyph: string; word: string; color: string }
> = {
  error: { glyph: "✕", word: "error", color: "var(--color-signal)" },
  warning: { glyph: "▲", word: "warning", color: "var(--color-amber)" },
  info: { glyph: "•", word: "info", color: "var(--color-cyan)" },
};

/** "2 errors, 1 warning" — the one-line verdict, used bare and as a summary. */
export function severityCount(counts: Record<Severity, number>): string {
  const parts: string[] = [];
  for (const severity of ["error", "warning", "info"] as const) {
    const n = counts[severity];
    if (n > 0) parts.push(`${n} ${SEVERITY_META[severity].word}${n === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}
