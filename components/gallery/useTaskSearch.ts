"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useQueryState } from "@/components/ui/useQueryState";
import { createTaskSearch, taskRequest, type TaskState } from "./task-search";

/** A URL change owns the field again; a pending edit must never overwrite Back or Forward. */
export function useTaskQuery() {
  const { params, set, clear } = useQueryState();
  const query = params.get("q") ?? "";
  const [draft, setDraft] = useState<{ value: string; origin: string } | null>(null);
  const search = draft !== null && draft.origin === query ? draft.value : query;

  useEffect(() => {
    if (draft === null || draft.origin !== query) return;
    const timer = setTimeout(() => {
      set("q", draft.value.trim() === "" ? null : draft.value);
      setDraft(null);
    }, 250);
    const onPop = () => {
      clearTimeout(timer);
      setDraft(null);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
    };
  }, [draft, query, set]);

  return {
    params, setParam: set, search,
    setDraft: (value: string) => setDraft({ value, origin: query }),
    clear: (keys: readonly string[]) => {
      setDraft(null);
      clear(keys);
    },
  };
}

export function useTaskSearch(kind: "blueprints" | "cards", search: string, params: URLSearchParams) {
  const request = taskRequest(kind, search, params);
  const store = useMemo(() => createTaskSearch(), []);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (request === "") return;
    return store.start(request);
  }, [request, store, attempt]);
  const current: TaskState = state.request === request ? state : { request, status: "loading" };
  return {
    state: current,
    retry: () => setAttempt((value) => value + 1),
    searching: request !== "",
  };
}
