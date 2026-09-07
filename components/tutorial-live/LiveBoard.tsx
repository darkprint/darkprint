"use client";

import { LiveBoardView } from "./LiveBoardView";
import { useLiveRecord } from "./use-live-record";

/**
 * The client half of `/tutorial/live/[token]`: the poll, joined to the renderer.
 *
 * Two lines on purpose. Everything a test wants to see is in `LiveBoardView`, which takes
 * a state and never fetches; everything a browser has to do is in `useLiveRecord`. This
 * file is the only place the two meet, so neither has to know about the other.
 */
export function LiveBoard({ token }: { token: string }) {
  const state = useLiveRecord(token);
  return <LiveBoardView state={state} token={token} />;
}
