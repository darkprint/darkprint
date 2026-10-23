"use client";

import Link from "next/link";
import { taskStatus, type TaskState } from "./task-search";

export function TaskSearchResults({ state, retry }: { state: TaskState; retry: () => void }) {
  return (
    <section aria-label="Task search results" aria-busy={state.status === "loading"} className="flex flex-col gap-3">
      <p role="status" aria-live="polite" className="text-sm text-muted">{taskStatus(state)}</p>
      {state.status === "error" && (
        <button type="button" onClick={retry} className="self-start text-sm text-fg underline">Retry search</button>
      )}
      {state.status === "ready" && (
        <>
          <p className="font-mono text-xs text-dim">{state.data.hits.length} search hits</p>
          {state.data.hits.length === 0 ? (
            <h2 className="font-display text-lg text-fg">No search results. Try a broader task or remove a filter.</h2>
          ) : (
            <ol className="flex flex-col gap-3">
              {state.data.hits.map((hit) => {
                const item = hit.item;
                const blueprint = "slug" in item;
                const identity = blueprint ? `${item.ownerHandle}/${item.slug}` : item.ref;
                const href = blueprint
                  ? `/blueprints/${encodeURIComponent(item.ownerHandle)}/${encodeURIComponent(item.slug)}`
                  : `/nodes/${item.id.split("/").map(encodeURIComponent).join("/")}#version-history`;
                return (
                  <li key={identity} className="panel flex flex-col gap-2 p-5">
                    <h2 className="font-display text-lg text-fg">
                      <Link href={href} className="underline decoration-line-bright underline-offset-4">
                        {blueprint ? item.manifest.title || item.slug : item.card.name || item.id}
                      </Link>
                    </h2>
                    <p className="break-words font-mono text-xs text-dim">{identity}</p>
                    <p className="text-sm text-muted">{blueprint ? item.manifest.summary : item.card.action}</p>
                    {!blueprint && <p className="text-xs text-dim">The card page shows the latest version and its version history.</p>}
                    <details className="text-sm text-muted">
                      <summary>Matching evidence</summary>
                      <p className="mt-2 font-mono text-xs">Service score: {hit.score.toFixed(3)}</p>
                      {hit.evidence.length === 0 ? <p>No ranking evidence provided.</p> : (
                        <ul className="mt-2 flex flex-col gap-1">
                          {hit.evidence.map((entry, index) => <li key={index} className="break-words font-mono text-xs">{entry}</li>)}
                        </ul>
                      )}
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
