"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { cx } from "@/lib/format";

export interface McpResult {
  slug: string;
  title: string;
  summary: string;
  digest: string;
  author: string;
}

type Connection = "disconnected" | "connected" | "error";

export function McpJourney({ results }: { results: readonly McpResult[] }) {
  const [connection, setConnection] = useState<Connection>("disconnected");
  const [query, setQuery] = useState("workflow that separates implementation from acceptance criteria");
  const [searched, setSearched] = useState(false);

  return (
    <section aria-labelledby="connection-title" className="panel overflow-hidden">
      <div className="grid lg:grid-cols-[0.7fr_1.3fr]">
        <div className="border-b border-line p-5 lg:border-b-0 lg:border-r sm:p-6">
          <p className="label">Connection test</p>
          <h2 id="connection-title" className="mt-2 font-display text-2xl font-semibold text-fg">
            Connect the published registry
          </h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Requested access</dt>
              <dd className="font-mono text-fg">registry:read</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Private workspaces</dt>
              <dd className="font-mono text-dim">not requested</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Status</dt>
              <dd
                className={cx(
                  "font-mono",
                  connection === "connected"
                    ? "text-emerald"
                    : connection === "error"
                      ? "text-signal"
                      : "text-dim",
                )}
                role="status"
                aria-live="polite"
              >
                {connection}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            {connection === "connected" ? (
              <Button variant="outline" onClick={() => { setConnection("disconnected"); setSearched(false); }}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={() => setConnection("connected")}>
                {connection === "error" ? "Retry connection" : "Connect registry"}
              </Button>
            )}
            {connection !== "connected" && (
              <Button variant="ghost" onClick={() => setConnection("error")}>
                Show failure recovery
              </Button>
            )}
          </div>

          {connection === "error" && (
            <div className="mt-4 rounded-lg border border-signal/35 bg-signal/5 p-3 text-sm leading-relaxed text-muted">
              The client could not complete the connection test. Confirm the server URL,
              re-authorize the read scope, then retry. No registry result was added to agent context.
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <p className="label">Example retrieval</p>
          <label htmlFor="mcp-query" className="mt-2 block font-display text-xl font-semibold text-fg">
            Search by the work in front of you
          </label>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              id="mcp-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={connection !== "connected"}
              className="min-w-0 flex-1 rounded-md border border-line bg-void px-3 py-2 text-sm text-fg outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-cyan"
            />
            <Button
              disabled={connection !== "connected" || query.trim() === ""}
              onClick={() => setSearched(true)}
            >
              Search registry
            </Button>
          </div>

          {connection !== "connected" && (
            <p className="mt-3 text-sm text-dim">Pass the connection test to run the example search.</p>
          )}

          {connection === "connected" && searched && (
            <div className="mt-5 space-y-3" aria-live="polite">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
                {results.length} task-relevant results · inspect provenance before fetching
              </p>
              {results.map((result) => (
                <article key={result.slug} className="rounded-lg border border-line bg-surface-2/50 p-4">
                  <h3 className="font-display text-lg font-semibold text-fg">{result.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{result.summary}</p>
                  <dl className="mt-3 grid gap-1 font-mono text-[11px] text-dim sm:grid-cols-2">
                    <div><dt className="inline">Author </dt><dd className="inline text-muted">{result.author}</dd></div>
                    <div><dt className="inline">Digest </dt><dd className="inline text-muted">{result.digest.slice(0, 16)}…</dd></div>
                  </dl>
                  <Link
                    href={`/blueprints/${result.slug}#use-this-blueprint`}
                    className="mt-3 inline-block font-mono text-xs text-cyan underline decoration-cyan/40 underline-offset-4"
                  >
                    Inspect and fetch this exact release →
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
