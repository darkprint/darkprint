"use client";

import { Button, ButtonLink } from "@/components/ui/Button";

/* The boundary under the root layout, so the header and footer stay up around a page that
   failed to render. No stack: a server error reaches the browser as a generic message and a
   digest, and the digest is what matches the server log. It is labelled "Reference" because
   "digest" means a release's SHA-256 everywhere else on this site. */

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="container-page flex flex-col gap-8 py-16 sm:py-20">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">Error</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fg">
          Something went wrong
        </h1>
      </header>
      <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 px-6 py-6">
        <p className="text-[15px] leading-relaxed text-muted">
          This page failed to render. Try again, or start from the blueprint list.
        </p>
        {error.digest !== undefined && (
          <p className="font-mono text-[11px] text-dim">Reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <ButtonLink href="/blueprints" variant="outline">
            Browse blueprints
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
