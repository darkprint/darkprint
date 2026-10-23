import type { BlueprintSummary, CardSummary } from "@/lib/server/registry";
import type { Results } from "@/lib/server/search/types";

export type TaskResults = Results<BlueprintSummary | CardSummary>;
export type TaskState =
  | { request: string; status: "loading" }
  | { request: string; status: "error" }
  | { request: string; status: "ready"; data: TaskResults };

const FILTERS = {
  blueprints: ["tag", "cat", "phase", "autonomy", "df", "gates"],
  cards: ["type", "phase", "human", "risk"],
} as const;

/** Browse ordering would turn the service's vector channel off, so it stays in the URL only. */
export function taskRequest(
  kind: keyof typeof FILTERS,
  query: string,
  params: URLSearchParams,
): string {
  if (query.trim() === "") return "";
  const next = new URLSearchParams({ q: query.trim() });
  for (const key of FILTERS[kind]) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }
  if (kind === "blueprints") next.set("forks", "all");
  return `/api/search/${kind}?${next}`;
}

function isSearchItem(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  if ("slug" in item) {
    if (typeof item.slug !== "string" || typeof item.ownerHandle !== "string" ||
      typeof item.manifest !== "object" || item.manifest === null) return false;
    const manifest = item.manifest as Record<string, unknown>;
    return (manifest.title === undefined || typeof manifest.title === "string") &&
      (manifest.summary === undefined || typeof manifest.summary === "string");
  }
  if (typeof item.id !== "string" || typeof item.ref !== "string" ||
    typeof item.version !== "string" || typeof item.card !== "object" || item.card === null) return false;
  const card = item.card as Record<string, unknown>;
  return typeof card.name === "string" && typeof card.action === "string";
}

function isResults(value: unknown): value is TaskResults {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Partial<TaskResults>;
  return Array.isArray(result.hits) && typeof result.ordered === "boolean" &&
    (result.encoder === "present" || result.encoder === "absent") &&
    result.hits.every((hit) => typeof hit === "object" && hit !== null &&
      isSearchItem(hit.item) &&
      typeof hit.score === "number" && Number.isFinite(hit.score) &&
      Array.isArray(hit.evidence) && hit.evidence.every((entry: unknown) => typeof entry === "string"));
}

/** Each hook owns a store; cancelled requests cannot publish, even if fetch ignores abort. */
export function createTaskSearch(fetcher: typeof fetch = fetch) {
  let state: TaskState = { request: "", status: "loading" };
  const listeners = new Set<() => void>();
  const publish = (next: TaskState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start(request: string) {
      let active = true;
      const controller = new AbortController();
      publish({ request, status: "loading" });
      const timer = setTimeout(async () => {
        try {
          const response = await fetcher(request, {
            signal: controller.signal,
            credentials: "omit",
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Search failed");
          const data: unknown = await response.json();
          if (!isResults(data)) throw new Error("Invalid search response");
          if (active) publish({ request, status: "ready", data });
        } catch {
          if (active) publish({ request, status: "error" });
        }
      }, 250);
      return () => {
        active = false;
        clearTimeout(timer);
        controller.abort();
      };
    },
  };
}

export function taskStatus(state: TaskState): string {
  if (state.status === "loading") return "Searching the registry…";
  if (state.status === "error") return "Search is unavailable. Try again or clear the query to browse.";
  if (state.data.encoder === "absent") return "Word matching only. Semantic search is unavailable.";
  if (!state.data.ordered || state.data.hits.some((hit) =>
    !hit.evidence.some((entry) => entry.startsWith("similarity:")))) {
    return "Search returned limited ranking evidence. Some results may use word matching only.";
  }
  return "Results in service relevance order, with matching evidence. Up to 20 hits.";
}
