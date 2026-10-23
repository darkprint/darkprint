import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BlueprintSummary, CardSummary } from "@/lib/server/registry";
import type { Blueprint } from "@/lib/types";
import type { NodeSummary } from "@/components/nodes/NodeCardSummary";
import { GalleryBrowser } from "./GalleryBrowser";
import { NodeBrowser } from "@/components/nodes/NodeBrowser";
import { TaskSearchResults } from "./TaskSearchResults";
import type { TaskState } from "./task-search";

const mock = vi.hoisted(() => ({ query: "validate and clean customer data", params: new URLSearchParams("sort=oldest"), state: {} as TaskState }));
vi.mock("./useTaskSearch", () => ({
  useTaskQuery: () => ({ search: mock.query, params: mock.params, clear: vi.fn(), setParam: vi.fn(), setDraft: vi.fn() }),
  useTaskSearch: () => ({ searching: mock.query.trim() !== "", state: mock.state, retry: vi.fn() }),
}));

const blueprint = (slug: string, title: string) => ({ ownerHandle: "author", slug, manifest: { title, summary: "Maintains records" } }) as BlueprintSummary;
const card = (id: string, name: string) => ({ id, ref: `${id}@1.0.0`, version: "1.0.0", card: { name, action: "Checks output" } }) as CardSummary;
const state = (items: (BlueprintSummary | CardSummary)[]): TaskState => ({
  request: "query", status: "ready", data: { facets: {}, ordered: true, encoder: "present", hits: items.map((item, i) => ({ item, score: 0.8 - i / 10, evidence: ["similarity:0.70", "spec:rubric"] })) },
});

beforeEach(() => {
  mock.query = "validate and clean customer data";
  mock.params = new URLSearchParams("sort=oldest");
});

it("the blueprint browser displays semantic-only hits in service order despite a browse sort", () => {
  mock.state = state([blueprint("janitor", "Zebra records"), blueprint("other", "Alpha records")]);
  const html = renderToStaticMarkup(createElement(GalleryBrowser, { blueprints: [], categories: [] }));
  expect(html).toContain("Zebra records");
  expect(html.indexOf("Zebra records")).toBeLessThan(html.indexOf("Alpha records"));
  expect(html).toContain("similarity:0.70");
  expect(html).toContain("Service relevance");
  expect(html).not.toContain("No blueprints match");
});

it("the node browser does not regroup or substring-filter rubric hits", () => {
  mock.query = "judge against a private rubric";
  mock.state = state([card("verifier", "Zebra verifier"), card("reviewer", "Alpha reviewer")]);
  const html = renderToStaticMarkup(createElement(NodeBrowser, { nodes: [], types: [] }));
  expect(html).toContain("Zebra verifier");
  expect(html.indexOf("Zebra verifier")).toBeLessThan(html.indexOf("Alpha reviewer"));
  expect(html).toContain("spec:rubric");
  expect(html).not.toContain("No node cards match");
  expect(html).not.toContain("Jump to a card type");
});

it("clearing a query restores browse filters and sorting without needing a response", () => {
  mock.query = "";
  mock.state = { request: "old", status: "error" };
  mock.params = new URLSearchParams("sort=name&type=validation");
  const node = (id: string, name: string, type: string): NodeSummary => ({ id, name, type, typeLabel: type, version: "1.0.0", ref: `${id}@1.0.0`, action: "Checks", phases: [], tools: [], riskMarkers: [], requiresHuman: false, usedIn: 0 });
  const html = renderToStaticMarkup(createElement(NodeBrowser, { nodes: [node("z", "Zebra verifier", "validation"), node("a", "Alpha verifier", "validation"), node("b", "Banana tool", "tool")], types: [] }));
  expect(html.indexOf("Alpha verifier")).toBeLessThan(html.indexOf("Zebra verifier"));
  expect(html).not.toContain("Banana tool");
  expect(html).not.toContain("Search is unavailable");
  expect(html).not.toContain("Task search results");
});

it("empty-query blueprint category filtering remains local", () => {
  mock.query = " ";
  mock.params = new URLSearchParams("cat=data");
  const bp = (title: string, category: string) => ({ title, category, slug: title, updatedAt: "", createdAt: "", tags: [], autonomy: { autonomyClass: "supervised", label: "Supervised", level: 2 }, analysis: { phaseCoverage: { covered: [] } } }) as unknown as Blueprint;
  const html = renderToStaticMarkup(createElement(GalleryBrowser, { blueprints: [bp("excluded", "software")], categories: ["data", "software"] }));
  expect(html).toContain("No blueprints match");
  expect(html).not.toContain("Task search results");
});

describe("honest search presentation", () => {
  it.each(["loading", "error"] as const)("%s never claims no matches", (status) => {
    const html = renderToStaticMarkup(createElement(TaskSearchResults, { state: { request: "q", status }, retry: vi.fn() }));
    expect(html).not.toContain("No search results");
    expect(html).toContain('role="status"');
    if (status === "loading") expect(html).toContain('aria-busy="true"');
    else expect(html).toContain("Retry search");
  });

  it("escapes untrusted content and evidence", () => {
    const current = state([card("safe", "<script>alert(1)</script>")]);
    if (current.status !== "ready") throw new Error("fixture");
    current.data.hits[0].evidence = ["<img src=x onerror=alert(1)>"];
    const html = renderToStaticMarkup(createElement(TaskSearchResults, { state: current, retry: vi.fn() }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
});
