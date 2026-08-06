/* ============================================================
   Where the listing sits, in pixels, computed rather than measured.

   The obvious way to place a scroll-driven figure is to read
   `getBoundingClientRect()` off the live DOM, and the obvious way is
   wrong here for three reasons: the measurement has to happen after
   layout, so the first painted frame is drawn against stale numbers;
   it has to be re-run on every font load and resize, which is a
   second observer on top of the one the scroll already needs; and
   none of it exists on the server, so the markup that ends up in
   `.next/server/app/index.html` would be the un-positioned one.

   So the layout is arithmetic instead. Every quantity below is a
   number the CSS is *told*, never one it is asked for: the listing
   sets `NC.line` as its row height and the reel's shift follows from
   it without anybody looking at the page. `nodecard.test.ts` checks
   the arithmetic, which is only possible because it is arithmetic.

   All of it is inert below `lg`. The classes that consume these
   numbers carry the `lg:` prefix and are only emitted when motion is
   allowed, so a phone and a reader who asked for no motion get the
   stacked listing at its natural height and none of this runs.

   ── What this file used to carry, and why it does not ──
   It held a second set of numbers for `NodeCardStage`: a rail pitch
   (`head`/`gap`/`body`), a leader-line gutter with `leaderPath`,
   `bandCentre` and `railCentre` to draw the elbow between the two, a
   `PIN_TRAVEL`/`STAGE_HEIGHT`/`STEP_RESERVE` scroll budget, and the
   `dezoom` ramp. `/spec/card` was that stage's only mount and it now
   mounts `CardWalk`, the same walk the landing draws, on the
   author's instruction ("make /spec/card's scrollable node panel the
   same as the home's"). The stage, the leader and the dezoom went
   with the mount rather than being left as code the tests were the
   only readers of.

   What survived is the half both walks always shared, and the reel
   arithmetic below is now ONE function rather than two: `CardWalk`
   used to re-derive its own `shiftFor` because `reelShift` clamped
   against the stage's shorter window, and there is only one window
   left to clamp against.
   ============================================================ */

export const NC = {
  /** Row height of one line of the listing. Set on the row, so it holds whatever the
      mono face's own metrics are. */
  line: 22,
  /**
   * Rows of the card visible in the window while the reel is running.
   *
   * Twenty-four rather than eighteen because the figure is pinned and centred, and at
   * eighteen it stood 495px tall inside a 900px viewport with void above and below it.
   * At twenty-four the figure measures 612.5px, a little over two thirds of the screen it
   * holds. `CardWalk`'s sticky offset is half that height, written in rem because CSS
   * cannot ask, and it has to move whenever this number does.
   */
  rows: 24,
  /**
   * Height of the window the listing scrolls inside while the reel is running.
   *
   * `rows × line`, stated as a literal because the object cannot read its own fields, and
   * `nodecard.test.ts` holds the two together. Whole rows and nothing else: the chrome
   * (`PAD_Y` in `CardWalk`) is the 1px border at each end and no padding, because a
   * scroll container's bottom padding does not hold a blank strip open at the visible
   * edge — it sits after the last line of the file, 1160px down.
   */
  window: 528,
  /**
   * Lines of head-room kept above the run being annotated, so the reader sees what comes
   * before it rather than the run arriving at the top edge.
   *
   * Three, which is `CardWalk`'s number and not the stage's six. The stage parked six
   * rows above a 504px window; this window is 528px and the walk reads better with the
   * run higher in it, because there is no leader line drawing the eye to a particular
   * band and the annotated run has to be the thing at the top of the window.
   */
  park: 3,
} as const;

/**
 * How far the listing is shifted up, in px, to bring a run into the window.
 *
 * Negative or zero. Clamped at both ends: never above the first line, never past the
 * point where the last line reaches the bottom edge, because a window showing blank
 * space under the end of the file reads as a rendering fault rather than as an ending.
 */
export function reelShift(from: number, totalLines: number): number {
  const wanted = (from - 1 - NC.park) * NC.line;
  const furthest = Math.max(0, totalLines * NC.line - NC.window);
  const y = Math.min(Math.max(wanted, 0), furthest);
  // Negating zero gives -0, which stringifies into `translateY(-0px)`. Valid CSS and a
  // puzzling thing to find in a style attribute.
  return y === 0 ? 0 : -y;
}
