"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/* ============================================================
   Vercel Web Analytics, with live tutorial tokens kept out of it.

   A live page's address is `/tutorial/live/<token>`, and the token is
   the whole authority over that page. Analytics records the pathname
   of every view, which would put every token into the project's
   dashboard as a page view. The path is rewritten to its route
   pattern before the event leaves the browser, so the dashboard
   counts live-page views and names no token.

   A client component because `beforeSend` is a function and the root
   layout is a server component, which cannot pass one.
   ============================================================ */

const LIVE_PREFIX = "/tutorial/live/";

function redactLiveToken(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (!url.pathname.startsWith(LIVE_PREFIX)) return event;
    url.pathname = `${LIVE_PREFIX}[token]`;
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function SiteAnalytics() {
  return <Analytics beforeSend={redactLiveToken} />;
}
