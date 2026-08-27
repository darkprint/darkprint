"use client";

import { useCallback, useState } from "react";
import { cx } from "@/lib/format";
import { Button } from "@/components/ui/Button";

/* ============================================================
   Casting a ballot, live: POST/GET /api/blueprints/[owner]/[slug]/votes
   over `lib/server/ballot` (T160, wired T280). Three 0-100 sliders,
   one per community axis — the same three `metricsFor` reads as
   `value`/`detail` on the scorecard once B7's `live` prop lands there
   (CONTRACT-FE.md's pinned `LiveSignals`); this control is the OTHER
   half, the write a reader makes rather than the read a bar shows.
   ============================================================ */

/** Structural, not imported: a "use client" file may not reach `lib/server/ballot`. */
export interface WireMetricAggregate {
  value: number;
  sampleSize: number;
  isSample: boolean;
}

export interface WireAggregate {
  efficacy: WireMetricAggregate;
  reliability: WireMetricAggregate;
  transparency: WireMetricAggregate;
}

const AXES = [
  { key: "efficacy", label: "Efficacy" },
  { key: "reliability", label: "Reliability" },
  { key: "transparency", label: "Transparency" },
] as const;

function detailFor(m: WireMetricAggregate): string {
  if (m.sampleSize === 0) return "No ballots cast yet.";
  const n = `${m.sampleSize} ballot${m.sampleSize === 1 ? "" : "s"}`;
  return m.isSample ? `${n}, a small sample.` : n;
}

export function VoteControl({
  api,
  aggregate,
  signedIn,
}: {
  /** `/api/blueprints/{owner}/{slug}/votes`. GET reads, POST casts. */
  api: string;
  aggregate: WireAggregate;
  signedIn: boolean;
}) {
  const [current, setCurrent] = useState(aggregate);
  const [draft, setDraft] = useState<Partial<Record<(typeof AXES)[number]["key"], number>>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const cast = useCallback(() => {
    if (Object.keys(draft).length === 0 || pending) return;
    setPending(true);
    setError(undefined);
    void (async () => {
      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!response.ok) {
          const problem = (await response.json().catch(() => undefined)) as
            | { detail?: string }
            | undefined;
          setError(problem?.detail ?? "That ballot was not accepted.");
          return;
        }
        const json = (await response.json()) as { aggregate: WireAggregate };
        setCurrent(json.aggregate);
        setDraft({});
      } catch {
        setError("That ballot did not send. Check your connection and try again.");
      } finally {
        setPending(false);
      }
    })();
  }, [api, draft, pending]);

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="label">Cast a ballot</span>
        {!signedIn && (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
            read only
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {AXES.map(({ key, label }) => {
          const metric = current[key];
          const value = draft[key] ?? Math.round(metric.value);
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg">{label}</span>
                <span className="font-mono text-[13px] tabular-nums text-cyan">{value}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={value}
                disabled={!signedIn || pending}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [key]: Number(event.target.value) }))
                }
                className={cx("w-full accent-cyan", !signedIn && "cursor-not-allowed opacity-60")}
                aria-label={`${label}, 0 to 100`}
              />
              <span className="text-[11px] text-dim">{detailFor(metric)}</span>
            </div>
          );
        })}
      </div>

      {signedIn ? (
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={Object.keys(draft).length === 0 || pending}
            onClick={cast}
          >
            {pending ? "Casting…" : "Cast ballot"}
          </Button>
          {error !== undefined && <span className="text-[11px] text-signal">{error}</span>}
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-relaxed text-dim">
          Sign in to cast a ballot. The three values above are everyone else&rsquo;s.
        </p>
      )}
    </section>
  );
}
