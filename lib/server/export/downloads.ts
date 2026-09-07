/* ============================================================
   DarkPrint backend — B-14's download event, delegated
   "Downloads are counted by an explicit event at the serving
   edge, never derived from logs." This is that edge. The event
   itself is now `@/lib/server/counters`', which is what this
   file's own earlier `TODO` asked for and this file discharges: it
   read *"written here rather than through
   `@/lib/server/counters` because T150 is unmerged, and a dynamic
   `import()` specifier resolves at compile time, so importing an
   unmerged barrel does not gate green. The signature is the one
   T150 publishes, so the call site does not change when it lands
   — only where the name is imported from."* T150 has landed and
   the name now comes from there.

   Two live implementations of one verb writing one column is the
   shape this run has charged more than any other, so the copy
   goes rather than being kept in step by hand.

   ── Why this stays a re-export instead of the call sites moving
      to `@/lib/server/counters` ──
   `tests/server/t090/surface.test.ts` and
   `tests/server/t091/surface.test.ts` both require
   `recordDownload` to be published **from `@/lib/server/export`**,
   and T090's contract pins its arity at 2. That is a merged
   promise about this barrel's surface and it is not T150's to
   withdraw, so the surface is unchanged and only the author moved.

   It is worth saying that this is the one place the barrel
   headers' rule against re-exporting another module's name is
   deliberately overridden. `accounts` and `saves` both decline to
   re-export a foreign error class, because publishing it under a
   second name invites the re-rendering D-50-08 forbids. The
   difference here is that the re-export is the OLDER of the two
   surfaces: callers were promised this name at this address one
   wave before the owning module existed.

   ── What the widened parameter does and does not mean ──
   T150 publishes `kind` as `blueprint | card | term`, where T090
   published `blueprint | card`. Both call sites — `serve-file.ts`
   and `serve-card.ts` — pass a literal, so neither moves, and a
   `term` has no served file: the widening belongs to the counter,
   not to this edge.

   The grain is unchanged and is the table's own
   (`lib/db/schema.ts`, `target`): a blueprint counts per
   `bundle.id`, current-release-independent, so downloading two
   releases of one bundle is two downloads of that bundle; a card
   counts per bare `cardId`, never `id@version` (B-10 aggregates
   card counters per id, and AC7 asserts it directly).

   ── What moved with the author ──
   The never-rejects guarantee is unchanged and still ruled at
   `a037587`: a counter write that fails must not deny a legitimate
   download. What changed is where the failure goes. It was a
   `console.error`, with a comment saying *"the audit trail it
   belongs in is T240's and that task is unmerged"* — T240 merged
   at `a4de281`, `AUDIT_ACTIONS` carries `counter.write_failed`,
   and T150's `recordDownload` now writes that row. The console
   line survives there as the last resort for the case where the
   audit write fails too.
   ============================================================ */

export { recordDownload } from "@/lib/server/counters";
