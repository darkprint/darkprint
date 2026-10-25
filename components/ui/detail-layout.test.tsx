import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getNodeCard } from "@/lib/content";
import { NodeOverview } from "@/components/nodes/NodeOverview";
import { SkeletonPane } from "@/components/panes/SkeletonPane";
import { buildPaneModel } from "@/components/panes/build";
import { CARD_FIELD_KEYS, resolveFocus } from "@/components/panes/model";
import { SideRail } from "./SideRail";
import { openText, plainText } from "./visible-text";

const card = getNodeCard("code-builder", "1.0.1")!.card;
const pin = `${card.id}@${card.version}`;

it("keeps a visible keyboard focus ring on graph nodes", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  expect(css, "graph nodes must override React Flow's outline reset").toMatch(/\.react-flow \.react-flow__node\.selectable:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-cyan\)/);
});

it("detail navigation leaves the page width available and keeps every anchor reachable", () => {
  const html = renderToStaticMarkup(<SideRail layout="tabs" label="On this blueprint" header={<h1>Blueprint title</h1>} items={[{ href: "#blueprint-workspace", label: "Graph and cards" }, { href: "#files", label: "Files" }]}><section id="blueprint-workspace">Graph content</section></SideRail>);
  expect(html, "horizontal detail navigation must not reserve a left column").not.toContain("<aside");
  expect(html.match(/<nav\b/g)).toHaveLength(1);
  expect(html).toContain('href="#blueprint-workspace"');
  expect(html).toContain('href="#files"');
  expect(html.indexOf("Blueprint title")).toBeLessThan(html.indexOf("<nav"));
  expect(html.indexOf("</nav>")).toBeLessThan(html.indexOf("Graph content"));
});

it("node overview shows every published port and keeps constraint qualifications visible", () => {
  const html = renderToStaticMarkup(<NodeOverview card={card} />);
  const visible = openText(html);
  expect(visible).toContain(card.name);
  for (const port of [...card.inputs, ...card.outputs]) {
    expect(html, `published port ${port.name} must appear in the overview`).toContain(`>${port.name}</span>`);
    expect(visible).toContain(port.type);
  }
  for (const term of card.cannot) expect(visible).toContain(term);
  for (const promise of card.willNot) expect(visible).toContain(promise);
  expect(visible).toContain("DarkPrint checks these types against graph connections.");
  expect(visible).toContain("Nothing checks these promises automatically.");
});

it("empty ports and constraints remain valid overview states", () => {
  const html = renderToStaticMarkup(<NodeOverview card={{ ...card, inputs: [], outputs: [], cannot: [], willNot: [] }} />);
  expect(plainText(html).match(/None declared/g)).toHaveLength(2);
  expect(html).not.toContain("Cannot receive");
  expect(html).not.toContain("Author promises");
});

it("the selected node shows its exact pin and preserves every field behind the reference", () => {
  const model = buildPaneModel({ slug: "probe", title: "Probe", dot: `digraph probe { builder [card="${pin}"]; }`, nodes: [{ nodeId: "builder", label: card.name, ref: pin, card, yaml: `id: ${card.id}\nversion: ${card.version}\n` }] });
  const focus = resolveFocus(model, { nodeId: "builder" })!;
  const html = renderToStaticMarkup(createElement(SkeletonPane, { paneNumber: 2, inspector: true, model, focus, onSelectField: () => {}, onSelectAbsence: () => {} }));
  const identity = html.match(/<p class="mt-1 font-mono text-xs text-cyan">([\s\S]*?)<\/p>/)?.[0] ?? "";
  expect(plainText(identity), "the selected node must show its actual pinned card version").toContain(pin);
  expect(openText(html)).toContain(card.name);
  expect(plainText(html), "the inspector must retain the full published instructions").toContain(card.spec.replace(/`/g, ""));
  expect(openText(html)).toContain("both are valid");
  for (const field of CARD_FIELD_KEYS) expect(plainText(html)).toContain(field);
  const reference = html.match(/<details([^>]*)><summary[^>]*>All card fields and source lines/);
  expect(reference).not.toBeNull();
  expect(reference?.[1]).not.toContain("open");
  const fieldFocus = resolveFocus(model, { nodeId: "builder", field: "spec" })!;
  const selected = renderToStaticMarkup(createElement(SkeletonPane, { paneNumber: 2, inspector: true, model, focus: fieldFocus, onSelectField: () => {}, onSelectAbsence: () => {} }));
  expect(selected, "selecting a field must expose its full reference").toMatch(/<details[^>]*open=""[^>]*><summary[^>]*>All card fields and source lines/);
});

describe("detail page hierarchy", () => {
  const blueprint = readFileSync(new URL("../../app/blueprints/[owner]/[slug]/page.tsx", import.meta.url), "utf8");
  const node = readFileSync(new URL("../../app/nodes/[...id]/page.tsx", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("puts the graph before tool capabilities", () => {
    const graph = blueprint.indexOf('<div id="blueprint-workspace"');
    expect(graph).toBeGreaterThan(0);
    expect(graph, "graph must precede the secondary tool capabilities").toBeLessThan(blueprint.indexOf("<ToolScopes"));
    expect(blueprint).toContain('presentation="detail"');
  });

  it("puts node ports before the full instructions and reference", () => {
    const overview = node.indexOf("<NodeOverview card={card}");
    expect(overview).toBeGreaterThan(0);
    expect(overview, "node overview must precede instructions").toBeLessThan(node.indexOf('id="specification"'));
    expect(node.indexOf('id="specification"')).toBeLessThan(node.indexOf('id="fields"'));
    expect(node).toContain('layout="tabs"');
  });
});
