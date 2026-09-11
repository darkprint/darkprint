"use client";

import { useSyncExternalStore } from "react";

import { SITE_ORIGIN } from "@/lib/site";

import { LiveBoardView } from "./LiveBoardView";
import { useLiveRecord } from "./use-live-record";

/**
 * The client half of `/tutorial/live/[token]`: the poll, joined to the renderer.
 *
 * Everything a test wants to see is in `LiveBoardView`, which takes a state and never
 * fetches; everything a browser has to do is in `useLiveRecord`. This file is the only place
 * the two meet, so neither has to know about the other.
 *
 * The origin the board prints its own address with is the reader's, read off the window
 * once it exists. The server snapshot is the site's origin so the prerender and the first
 * client render agree; on the site itself the two are the same string.
 */
const noSubscription = () => () => {};

export function LiveBoard({ token }: { token: string }) {
  const state = useLiveRecord(token);
  const origin = useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => SITE_ORIGIN,
  );
  return <LiveBoardView state={state} token={token} origin={origin} />;
}
