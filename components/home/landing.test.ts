import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import { SectionBlueprintFiles } from "./SectionBlueprintFiles";
import { getBlueprintBySlug, getNodeCard } from "@/lib/content";
import { parseDot } from "@/lib/core";
import { FLOW } from "@/components/viz/flow";

const render = () => renderToStaticMarkup(createElement(SectionBlueprintFiles));

describe("the simplified landing", () => {
  it("renders the hero and three sections", () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    expect(html.match(/<section\b/g)).toHaveLength(4);
    expect(html.indexOf('id="example"')).toBeLessThan(html.indexOf('id="blueprint"'));
    expect(html.indexOf('id="blueprint"')).toBeLessThan(html.indexOf('id="first-blueprint"'));
    expect(html).not.toContain("Reproducible runs, improvable steps");
  });

  it("shows the card version pinned by the displayed graph", () => {
    const blueprint = getBlueprintBySlug("starter-software-factory")!;
    const graph = parseDot(blueprint.graph.dot).graph!;
    const pin = graph.nodes.find((node) => node.id === "builder")!.attrs.card;
    const html = render();
    expect(html, "the paired card must use the graph’s exact builder pin").toContain(`cards/${pin}.yaml`);
    for (const node of graph.nodes) expect(html).toContain(node.id);
    expect(html).toContain("Your own runner executes the files");
  });

  it("names the actual graph node after the card shown beside it", () => {
    const card = getNodeCard("code-builder", "1.0.1")!.card;
    const html = render();
    const svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    const builder = svg.match(/<g data-viz="node" data-viz-id="builder"[\s\S]*?<text[^>]*data-viz="label"[^>]*>([^<]+)<\/text>/);
    expect(builder?.[1], "the graph’s builder node must visibly name the paired card").toBe(card.name);
  });

  it("keeps graph labels legible in the phone panel", () => {
    const html = render();
    const svg = html.match(/<svg[\s\S]*?<\/svg>/)![0];
    const width = Number(svg.match(/viewBox="[^ ]+ [^ ]+ ([^ ]+)/)![1]);
    const panelClasses = html.match(/<figure[^>]*class="([^"]*)"/)![1];
    const padding = Number(panelClasses.match(/(?:^| )p-(\d+)(?: |$)/)![1]) * 4;
    // Reserve a scrollbar as well as the page gutter and figure border.
    const panelWidth = 360 - 16 - 48 - padding * 2 - 2;
    const sizes = [...svg.matchAll(/font-size="([\d.]+)"/g)].map((match) => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) {
      expect(size * panelWidth / width, "a graph label falls below the legibility floor").toBeGreaterThanOrEqual(FLOW.frame.legible);
    }
  });

  it("draws the card’s ports and boundary from its published fields", () => {
    const card = getNodeCard("code-builder", "1.0.1")!.card;
    const html = render();
    for (const port of [...card.inputs, ...card.outputs]) {
      expect(html).toContain(`>${port.name}</dd>`);
      expect(html).toContain(`>${port.type}</dd>`);
    }
    for (const term of card.cannot) {
      expect(html, "the card boundary must name the published prohibition").toContain(term);
    }
    expect(html).toContain(card.name);
    expect(html).toContain(card.model);
  });
});
