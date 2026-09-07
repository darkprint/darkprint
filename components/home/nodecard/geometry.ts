/* ============================================================
   The listing's one measured number.

   `YamlListing` sets `NC.line` as the height of every row rather
   than letting the mono face decide, so a line number in the gutter
   and the line it numbers stay on the same row whatever font loads.
   ============================================================ */

export const NC = {
  /** Row height of one line of the listing, in CSS pixels. */
  line: 22,
} as const;
