"use client";

import "./globals.css";

/* Replaces the root layout when the layout itself fails, so it has to bring its own `<html>`
   and `<body>` and its own stylesheet; nothing from the layout is mounted around it. Kept to
   plain elements for the same reason: a component that failed inside the layout may be the
   one this page would otherwise import. */

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-void text-fg">
        <title>Something went wrong · DarkPrint</title>
        <main className="container-page flex flex-col gap-6 py-16 sm:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Error</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">
            Something went wrong
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            DarkPrint failed to render this page. Try again, or go back to the start.
          </p>
          {error.digest !== undefined && (
            <p className="font-mono text-[11px] text-dim">Reference: {error.digest}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="inline-flex h-10 items-center rounded-md bg-cyan px-4 text-sm font-medium text-void"
            >
              Try again
            </button>
            {/* A plain anchor on purpose: this page renders when the root layout failed,
                and the router that `<Link>` needs may be part of what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="inline-flex h-10 items-center rounded-md border border-line-bright px-4 text-sm text-fg"
            >
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
