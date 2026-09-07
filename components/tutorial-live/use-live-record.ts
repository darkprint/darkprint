"use client";

import { useEffect, useState } from "react";

import { INITIAL, advance, conditionalHeaders, readOutcome, type BoardState } from "./poll";

/**
 * The board's state, polled from `GET /api/tutorial/live/<token>`.
 *
 * A timer chain rather than an interval, so a slow answer never overlaps the next request
 * and a failure can lengthen the wait. The state the next request is built from is held
 * in a local rather than read back out of React, because the effect's closure would
 * otherwise see the first render's value forever. An unmount aborts the request in
 * flight and drops its answer, so a page navigated away from never flips to
 * "reconnecting" in a component that is gone.
 */
export function useLiveRecord(token: string): BoardState {
  const [state, setState] = useState<BoardState>(INITIAL);

  useEffect(() => {
    let current: BoardState = INITIAL;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const tick = async () => {
      let outcome;
      try {
        const response = await fetch(`/api/tutorial/live/${token}`, {
          cache: "no-store",
          headers: conditionalHeaders(current),
          signal: controller.signal,
        });
        outcome = await readOutcome(response);
      } catch {
        if (cancelled) return;
        outcome = { kind: "failed" as const };
      }
      if (cancelled) return;
      const { next, delayMs } = advance(current, outcome);
      current = next;
      setState(next);
      if (delayMs !== undefined) timer = setTimeout(() => void tick(), delayMs);
    };

    void tick();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [token]);

  return state;
}
