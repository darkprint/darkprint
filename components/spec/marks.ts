/* ============================================================
   The two glyphs the spec figures spell one distinction with.

   `◆` is a value the vocabulary defines and the engine resolves;
   `◌` is free text nothing is held to. The site already spends `◌`
   on exactly this meaning in `CheckTable`, which `/spec/card`
   mounts, so the figures and the prose use one glyph between them.
   (It used to be the "Shown, and checked by nothing" panel that
   carried it there; that panel went with "The split" in the same
   pass described below, and `CheckTable` is what still prints the
   glyph on that route.)

   ── Why they are a module of their own ──
   They lived in `components/spec/SpecLayers.tsx`, which drew DRW-101
   ("three languages, one bundle") on `/spec`. The IA pass deleted
   `/spec` — `/what-a-blueprint-is` is the door onto the three layer
   pages now — and the author asked for that figure and its caption
   off the site in the same breath, so the drawing went with the
   route it was the opening plate of.

   `EnforcementFigure` still imports both marks, and an import
   reaching into a deleted file's neighbour for two string constants
   is how a deletion becomes a resurrection. Plain data, no JSX and
   no React, so a `environment: "node"` suite can read it.

   NOT a live page mount, as of the same IA pass: `EnforcementFigure`
   sat inside "The split" on `/spec/card` and that band is gone, so
   it draws for `components/viz/scene-labels.test.ts` and for no
   reader. This module therefore has exactly one consumer and that
   consumer has none — a state the author should resolve one way or
   the other rather than leave standing.

   They are exported rather than inlined for the reason they always
   were: two plates spelling the same distinction with different
   glyphs is the defect, and one declaration makes that impossible.
   ============================================================ */

/** A value the vocabulary defines and the engine resolves. */
export const RESOLVED_MARK = "◆";

/** A value nothing in the archive holds to a list. */
export const FREE_TEXT_MARK = "◌";
