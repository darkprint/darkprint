/* ============================================================
   One roving tablist, shared
   ------------------------------------------------------------
   `BuildPanes.tsx`'s three-reading tablist and `InstallTabs.tsx`'s client-picker tablist
   each hand-write the same rule: find the open tab's index, read the arrow key that was
   pressed, wrap at both ends, jump on Home/End, move focus with the selection.
   `InstallTabs.tsx`'s own comment already says its copy was "ported here rather than
   reinvented" from `BuildPanes.tsx`. `WorkspaceStage.tsx` needs the identical rule a third
   time, for the stage's own Graph/DOT/Cards/Vocabulary/Score row, and a third hand-written
   copy is exactly what that comment was warning against: two of the three copies would stop
   being "ported from the one implementation" the moment there no longer was one.

   So this is the rule, factored out once: which index a key moves a roving tablist to,
   given where it is now and how many tabs there are. `BuildPanes.tsx` is refactored to call
   it below — its own behaviour is unchanged; see `nextTabIndex`'s `"both"` orientation,
   which is exactly the four-arrow binding its `onTabKeyDown` used to write inline, wrapping
   the same way at the same two ends. `InstallTabs.tsx` is left as it is: this task's brief
   did not ask for it, its copy already carries its own comment explaining the reuse it
   intends, and touching a second unrelated file behind this task's brief would be a bigger
   diff than the line it would save there.

   Pure and React-free, like `./surfaces.ts`: a keyboard mapping has no reason to import a
   hook, and staying import-free is what lets a `.test.ts` exercise it directly without
   rendering anything.
   ============================================================ */

/**
 * How a roving tablist's arrow keys are bound to a direction.
 *
 * `"horizontal"` binds only ArrowLeft/ArrowRight — the ARIA default for a `role="tablist"`
 * that carries no `aria-orientation`, and what `InstallTabs.tsx`'s single row of clients and
 * `WorkspaceStage.tsx`'s top-level Graph/DOT/Cards/Vocabulary/Score row both are.
 * `"vertical"` binds only ArrowUp/ArrowDown. `"both"` binds all four keys to the same step,
 * which is `BuildPanes.tsx`'s own tablist: `aria-orientation="vertical"` on the list as a
 * whole, but each part's row of view buttons reads left-to-right, so both axes are real on
 * screen there, and its own comment says so.
 */
export type TabOrientation = "horizontal" | "vertical" | "both";

/**
 * The index a roving tablist moves to on one keydown, or `undefined` for a key this
 * tablist does not bind — the caller's cue to let the event fall through rather than call
 * `preventDefault`.
 *
 * Total and side-effect-free: `at` and `length` are the caller's own state, so the same
 * four inputs always answer the same index. Wrapping at both ends —
 * `(at + 1) % length` forward, `(at - 1 + length) % length` back — means a tablist of one
 * tab answers every arrow key with its own single index rather than cycling through a
 * negative or an out-of-range one.
 */
export function nextTabIndex(
  key: string,
  at: number,
  length: number,
  orientation: TabOrientation,
): number | undefined {
  const forwardKeys: readonly string[] =
    orientation === "vertical"
      ? ["ArrowDown"]
      : orientation === "horizontal"
        ? ["ArrowRight"]
        : ["ArrowDown", "ArrowRight"];
  const backwardKeys: readonly string[] =
    orientation === "vertical"
      ? ["ArrowUp"]
      : orientation === "horizontal"
        ? ["ArrowLeft"]
        : ["ArrowUp", "ArrowLeft"];

  if (forwardKeys.includes(key)) return (at + 1) % length;
  if (backwardKeys.includes(key)) return (at - 1 + length) % length;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return undefined;
}
