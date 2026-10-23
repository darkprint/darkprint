import { afterEach, beforeEach, expect, it, vi } from "vitest";

// This small hook runner exercises URL subscriptions and timers without a DOM dependency.
const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, pending: [] as (() => void)[], effects: [] as { deps: unknown[]; stop?: () => void }[], params: new URLSearchParams(), set: vi.fn(), clear: vi.fn() }));
vi.mock("react", () => ({
  useState(initial: unknown) {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (value: unknown) => { harness.slots[index] = value; }];
  },
  useEffect(run: () => (() => void) | undefined, deps: unknown[]) {
    const index = harness.cursor++;
    const old = harness.effects[index];
    if (old && old.deps.every((value, i) => Object.is(value, deps[i]))) return;
    harness.pending.push(() => { old?.stop?.(); harness.effects[index] = { deps, stop: run() }; });
  },
  useMemo: (run: () => unknown) => run(),
  useSyncExternalStore: vi.fn(),
}));
vi.mock("@/components/ui/useQueryState", () => ({
  useQueryState: () => ({ params: harness.params, set: harness.set, clear: harness.clear }),
}));
import { useTaskQuery as runTaskQuery } from "./useTaskSearch";

function render() {
  harness.cursor = 0;
  const result = runTaskQuery();
  for (const run of harness.pending.splice(0)) run();
  return result;
}
const events = new EventTarget();
beforeEach(() => {
  vi.useFakeTimers();
  harness.slots = []; harness.effects = []; harness.pending = [];
  harness.params = new URLSearchParams("q=original&sort=name");
  harness.set.mockReset().mockImplementation((key: string, value: string | null) => {
    if (value === null) harness.params.delete(key); else harness.params.set(key, value);
  });
  harness.clear.mockReset().mockImplementation((keys: string[]) => { for (const key of keys) harness.params.delete(key); });
  vi.stubGlobal("window", events);
});
afterEach(() => {
  for (const effect of harness.effects) effect?.stop?.();
  vi.unstubAllGlobals(); vi.useRealTimers();
});

it("uses shared-link state, debounces edits and releases the draft back to the URL", () => {
  expect(render().search).toBe("original");
  render().setDraft("private rubric");
  expect(render().search).toBe("private rubric");
  vi.advanceTimersByTime(250);
  expect(harness.params.get("q")).toBe("private rubric");
  expect(render().search).toBe("private rubric");
  harness.params.set("q", "from forward");
  events.dispatchEvent(new Event("popstate"));
  expect(render().search).toBe("from forward");
});

it("Back cancels a pending edit so it cannot overwrite the restored query", () => {
  render().setDraft("pending edit"); render();
  harness.params.set("q", "from back");
  events.dispatchEvent(new Event("popstate"));
  expect(render().search).toBe("from back");
  vi.advanceTimersByTime(500);
  expect(harness.set).not.toHaveBeenCalled();
  expect(harness.params.get("q")).toBe("from back");
});

it("clear removes the query and draft while preserving browse sort", () => {
  render().setDraft("pending"); render();
  render().clear(["q", "phase"]);
  expect(render().search).toBe("");
  vi.advanceTimersByTime(500);
  expect(harness.params.get("sort")).toBe("name");
  expect(harness.params.has("q")).toBe(false);
  expect(harness.set).not.toHaveBeenCalled();
});
