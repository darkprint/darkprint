/* ============================================================
   One roving tablist, shared
   ------------------------------------------------------------
   Three tablists on this site hand-wrote the same rule: find the open tab's index, read the
   arrow key that was pressed, wrap at both ends, jump on Home/End, move focus with the
   selection. `/build`'s four-pane view wrote it first; `InstallTabs.tsx`'s client picker
   says in its own comment that its copy was ported from that one rather than reinvented;
   and `WorkspaceStage.tsx` needed the identical rule a third time, for the stage's
   Graph/DOT/Cards/Vocabulary/Score row. A third hand-written copy was exactly what that
   comment was warning against: a copy stops being "ported from the one implementation" the
   moment there no longer is one, which is now literally true — the four-pane view was
   deleted along with the eight-step path it was the interface of.

   So this is the rule, factored out once: which index a key moves a roving tablist to,
   given where it is now and how many tabs there are. `WorkspaceStage.tsx` calls it.
   `InstallTabs.tsx` is left as it is: the task that factored this out was not asked for it,
   its copy already carries its own comment explaining the reuse it intends, and touching a
   second unrelated file would be a bigger diff than the line it would save there.

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
 * which is what a tablist wants when `aria-orientation="vertical"` describes the list as a
 * whole but each row inside it reads left to right, so both axes are real on screen.
 * `/build`'s deleted four-pane view was that shape and is why the member exists; nothing
 * mounts it today, and `tablist.test.ts` is what keeps the behaviour honest for whatever
 * asks for it next.
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
 * negative or an out-of-range one. `length <= 0` is the one input a modulus cannot make
 * total on its own (`x % 0` is `NaN` for every `x`), so it is guarded explicitly rather
 * than left to fall out of the arithmetic below — a tablist with no tabs has no index to
 * move to, on any key.
 */
export function nextTabIndex(
  key: string,
  at: number,
  length: number,
  orientation: TabOrientation,
): number | undefined {
  if (length <= 0) return undefined;

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
