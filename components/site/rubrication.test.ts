import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { avatarGradient } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { FLOW } from "@/components/viz/flow";

type Rgb = [number, number, number];
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const colors = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*#([a-f0-9]{6})/g)].map(([, name, hex]) => [
    name, [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255),
  ]),
);

function luminance(rgb: number[]) {
  const linear = rgb.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: number[], b: number[]) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

function hsl(hue: number, saturation: number, lightness: number): Rgb {
  const s = saturation / 100;
  const l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

describe("paper theme contrast", () => {
  it("keeps every text ink readable on every neutral paper surface", () => {
    for (const ground of ["void", "surface", "surface-2", "surface-3", "blue-paper"]) {
      for (const ink of ["fg", "muted", "dim", "cyan", "cyan-bright", "blueprint-line", "blueprint-ink", "copper-line", "copper-ink", "amber", "amber-bright", "amber-ink", "violet", "emerald", "signal", "warn"]) {
        expect(contrast(colors[ink], colors[ground]), `${ink} text on ${ground} must clear WCAG AA`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(colors["line-bright"], colors[ground]), `form boundaries on ${ground} must clear 3:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps light labels readable on filled actions and current-group markers", () => {
    for (const ground of ["cyan", "cyan-bright", "copper-line", "amber"]) {
      expect(contrast(colors.void, colors[ground]), `light label on ${ground}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps graph connections visible without an animated pulse", () => {
    for (const ground of ["void", "surface-2", "blue-paper"]) {
      const line = colors["blueprint-line"].map((v, i) => v * FLOW.edge.lineOpacity + colors[ground][i] * (1 - FLOW.edge.lineOpacity));
      expect(contrast(line, colors[ground]), `static graph connection on ${ground}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps avatar initials readable across every stored hue", () => {
    for (let hue = 0; hue < 360; hue++) {
      const stops = [...avatarGradient(hue).matchAll(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/g)];
      expect(stops).toHaveLength(2);
      for (const [, h, s, l] of stops) {
        expect(contrast(colors["avatar-ink"], hsl(Number(h), Number(s), Number(l))), `avatar hue ${hue}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const html = renderToStaticMarkup(createElement(Avatar, {
      author: { username: "example", displayName: "Example Author", avatarHue: 240, validator: false },
    }));
    expect(html).toContain("text-avatar-ink");
  });
});
