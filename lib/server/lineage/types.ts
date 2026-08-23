/* ============================================================
   DarkPrint backend — lineage: the drift report's shape
   T110's Published signatures block. Three tones and a list of
   repins, and the split between `repins` and `reason` is AC5's
   mechanism rather than a naming choice: a `blocked` drift has to
   be renderable without naming the upstream at all, and a single
   message string would leave a call site doing string surgery to
   get there.
   ============================================================ */

export type DriftTone = "ok" | "moved" | "blocked";

/**
 * One card the upstream repinned after this copy was taken.
 *
 * The four fields are `UpstreamMoved`'s (`lib/data/bundles.ts:107-113`), field for field,
 * and that file is what fixes their meaning: `from` is the version THIS copy still carries
 * and `to` is the version the upstream now pins. `components/bundle/Aside.tsx:185-215`
 * renders exactly that sentence — "`<owner>/<slug>` repinned `card@from → to` on `<date>`.
 * Your copy still carries `<from>`" — so a reading where `to` is merely "the newest version
 * of that card in the registry" would print a claim about the upstream that the upstream
 * never made.
 *
 * `card` is the bare card id and never `id@version`: it is also the route the panel links
 * to, `/nodes/<card>`, and both versions are already beside it.
 */
export interface Repin {
  card: string;
  from: string;
  to: string;
  /** When the upstream release that first carries `to` was published. */
  at: Date;
}

/**
 * What has happened to a copy since it was taken.
 *
 * `blocked` describes THIS bundle's own problem and never frames it as falling behind
 * (contract, AC5), which is why `reason` is a separate optional field: it is the whole of
 * what a `blocked` drift renders, and nothing in it names an upstream.
 *
 * `repins` is empty for `ok` and for `blocked`. A bundle that does not resolve is not a
 * bundle whose distance from its upstream is worth reporting, and reporting both would put
 * the upstream back into a rendering AC5 keeps it out of.
 */
export interface Drift {
  tone: DriftTone;
  repins: readonly Repin[];
  reason?: string;
}
