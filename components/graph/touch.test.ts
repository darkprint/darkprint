/* ============================================================
   The detail-page drawing on a touch screen.

   A finger that lands on the pane would pan the drawing and never scroll the page, so the
   drawing stays still on a coarse pointer until the reader turns on Move. This reads the
   source because the pointer is a browser fact `renderToStaticMarkup` never sees, and the
   server snapshot always answers "fine".
   ============================================================ */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(new URL("./BlueprintGraph.tsx", import.meta.url), "utf8");

describe("the drawing on a touch screen", () => {
  it("gates every drag and pinch on the pointer or the Move switch", () => {
    for (const prop of ["panOnDrag", "zoomOnPinch", "zoomOnDoubleClick", "nodesDraggable"]) {
      expect(SOURCE, `${prop} is not gated on \`pannable\``).toContain(`${prop}={pannable}`);
    }
    expect(SOURCE, "a bare `panOnDrag` pans on touch whatever else is set").not.toMatch(
      /\bpanOnDrag\s*\n/,
    );
  });

  it("hands the gesture back to the page while the drawing is still", () => {
    // React Flow's stylesheet sets `touch-action: none` on the pane unconditionally.
    expect(SOURCE).toContain('pannable ? "" : "[&_.react-flow__pane]:!touch-auto "');
  });

  it("offers the switch, named and stateful, only to a coarse pointer", () => {
    expect(SOURCE).toContain("moving={fine ? undefined :");
    expect(SOURCE).toContain("aria-pressed={moving.on}");
    expect(SOURCE).toContain('"Move the drawing"');
  });
});
