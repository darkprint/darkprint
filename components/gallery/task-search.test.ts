import { afterEach, describe, expect, it, vi } from "vitest";
import { createTaskSearch, taskRequest, taskStatus } from "./task-search";

const answer = (name: string, encoder = "present") => ({
  hits: [{ item: { slug: name, ownerHandle: "author", manifest: {} }, score: 0.7, evidence: ["similarity:0.70"] }],
  facets: {}, ordered: true, encoder,
});
const flush = async () => { await vi.advanceTimersByTimeAsync(250); };

afterEach(() => { vi.useRealTimers(); });

describe("task requests preserve service ranking", () => {
  it("sends filters before ranking and never sends a browse sort", () => {
    const params = new URLSearchParams("sort=type&type=validation&phase=testing&human=1&risk=1&unknown=x");
    const url = new URL(taskRequest("cards", " judge against a rubric ", params), "https://example.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "judge against a rubric", type: "validation", human: "1", risk: "1" });
    expect(taskRequest("blueprints", "clean records", new URLSearchParams("sort=oldest&cat=data&tag=etl&autonomy=supervised&phase=testing&df=1&gates=required")))
      .toBe("/api/search/blueprints?q=clean+records&tag=etl&cat=data&forks=all");
    expect(taskRequest("cards", "  ", params)).toBe("");
  });

  it("debounces and preserves the response and evidence without lexical filtering", async () => {
    vi.useFakeTimers();
    const data = answer("nightly-data-janitor");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));
    const store = createTaskSearch(fetcher);
    const stop = store.start("/api/search/blueprints?q=validate+and+clean+customer+data");
    expect(store.getSnapshot().status).toBe("loading");
    expect(fetcher).not.toHaveBeenCalled();
    await flush();
    expect(store.getSnapshot()).toEqual({ request: "/api/search/blueprints?q=validate+and+clean+customer+data", status: "ready", data });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "omit", cache: "no-store" });
    stop();
  });

  it("rejects stale success and error responses even when fetch ignores cancellation", async () => {
    vi.useFakeTimers();
    let oldResolve!: (response: Response) => void;
    let oldReject!: (reason: Error) => void;
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => new Promise((resolve) => { oldResolve = resolve; }))
      .mockImplementationOnce(() => new Promise((_, reject) => { oldReject = reject; }))
      .mockResolvedValue(Response.json(answer("current")));
    const store = createTaskSearch(fetcher);
    const stopFirst = store.start("first"); await flush(); stopFirst();
    const stopSecond = store.start("second"); await flush(); stopSecond();
    store.start("current"); await flush();
    oldResolve(Response.json(answer("stale"))); oldReject(new Error("stale failure"));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot()).toEqual({ request: "current", status: "ready", data: answer("current") });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("clearing cancels both debounced and in-flight searches", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer("late")));
    const store = createTaskSearch(fetcher);
    const stop = store.start("pending"); stop(); await flush();
    expect(fetcher).not.toHaveBeenCalled();
    let resolve!: (response: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const cancel = store.start("in-flight"); await flush(); cancel();
    resolve(Response.json(answer("late"))); await vi.advanceTimersByTimeAsync(0);
    expect(store.getSnapshot().status).toBe("loading");
  });

  it.each([503, 429])("an HTTP %s is an error rather than zero hits", async (status) => {
    vi.useFakeTimers();
    const store = createTaskSearch(vi.fn<typeof fetch>().mockResolvedValue(new Response("untrusted detail", { status })));
    store.start("query"); await flush();
    expect(store.getSnapshot()).toEqual({ request: "query", status: "error" });
    expect(taskStatus(store.getSnapshot())).toContain("Search is unavailable");
  });

  it("handles network and malformed JSON failures, then permits retry", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(Response.json({ hits: [] }))
      .mockResolvedValue(Response.json(answer("retried")));
    const store = createTaskSearch(fetcher);
    for (let i = 0; i < 3; i++) {
      store.start("same"); await flush();
      expect(store.getSnapshot().status).toBe("error");
    }
    store.start("same"); await flush();
    expect(store.getSnapshot().status).toBe("ready");
  });

  it("rejects malformed hit content rather than crashing the result renderer", async () => {
    vi.useFakeTimers();
    const store = createTaskSearch(vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      ...answer("broken"), hits: [{ item: { slug: "broken", ownerHandle: "author", manifest: { title: {} } }, score: 0.5, evidence: [] }],
    })));
    store.start("query"); await flush();
    expect(store.getSnapshot().status).toBe("error");
  });

  it("distinguishes lexical degradation from incomplete ranking evidence", async () => {
    vi.useFakeTimers();
    const store = createTaskSearch(vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer("lexical", "absent"))));
    store.start("query"); await flush();
    expect(taskStatus(store.getSnapshot())).toContain("Word matching only");
    expect(taskStatus({ request: "q", status: "ready", data: { hits: [{ item: {} as never, evidence: ["spec:rubric"], score: 0.1 }], facets: {}, ordered: true, encoder: "present" } })).toContain("limited ranking evidence");
  });
});
