/* ============================================================
   The schematic's block, as a number rather than a rendered box.
   ------------------------------------------------------------
   `AgentNode.tsx` draws the block and `lib/content/layout.ts` places it, and until this
   module existed neither knew how wide the other thought it was. That gap shipped a
   defect: the block was `min-w-[150px] max-w-[220px]`, so a node with a long name grew to
   220 while `layerGap` put the next column 200 away, and the two boxes overlapped by 20
   flow units. Nothing on the archive showed it, because an archive card is called
   `Spec Planner` and stops at 150. `/build` generates its names from the reader's own
   choices — `Python Script Factory Release Gate` — so every one of its blocks sat at the
   220 ceiling, and at stage width the middle column was measured lying 24x75px across the
   block to its left.

   So the block has ONE width now, stated here, and three things read it:

   - `AgentNode.tsx`, which writes it as the `w-[150px]` utility. Tailwind needs the
     literal class, so the number appears twice by necessity; `block.test.ts` pins the two
     together rather than trusting a comment to keep them in step.
   - `lib/content/layout.ts`, whose `layerGap` has to clear it. 200 - 150 leaves 50 flow
     units between columns, which is the clearance an edge can be seen in.
   - `components/graph/frame.ts` and the guard over it, which need to know where a name is
     drawn WITHOUT a browser to measure it. That is the property a `max-w` could never
     give them: a range is not a position.

   ── Why 150 and not 220 with a wider gap ──
   Both fixes clear the overlap. Widening `layerGap` to 240 keeps the wide block and makes
   every drawing on the site 20% wider, which costs the archive's seven-node schematics
   real width they already do not have. Fixing the block at the `min-w` the site already
   drew most nodes at costs one thing instead: a long name wraps to another line, which
   `rowGap` was raised to 180 to hold. A wrapped name is legible; a block written across
   its neighbour is not.
   ============================================================ */

/** The drawn width of one block, in flow units. Every node is exactly this wide. */
export const BLOCK_WIDTH = 150;

/**
 * Where a block's own text starts and ends inside it, measured from the block's left edge.
 *
 * `AgentNode`'s box is `border` (1) + `px-3` (12) on each side, and the kind accent is a
 * `position: absolute` bar at `left-0` that overlaps the padding rather than consuming
 * layout width. So a name is drawn between 13 and `BLOCK_WIDTH - 13`, left-aligned, and
 * wraps inside that range.
 *
 * The guard measures the whole range rather than the name's own advance width. That is
 * deliberate and it errs in the safe direction: the range is at least as wide as any name
 * inside it, so a frame edge that misses the range misses the word, and a guard built on
 * it can report a clip that a shorter name would have survived but can never miss one.
 * It also means no font metric enters the measurement — `components/viz/label-boxes.ts`
 * needs `ADVANCE` because it measures SVG `<text>` the browser never laid out; here the
 * browser has already wrapped the name inside a box this file states outright.
 */
export const BLOCK_TEXT_INSET = 13;
