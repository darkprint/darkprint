import { describe, expect, it } from "vitest";
import { error, warning } from "@/lib/core";
import type { Diagnostic } from "@/lib/core";
import { ok } from "./ok";

describe("ok", () => {
  it("responds 200 with a plain JSON body", async () => {
    const response = ok({ hello: "world" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ hello: "world" });
  });

  it("AC4: a payload carrying diagnostics is still 200, and the diagnostics survive serialisation intact including location", async () => {
    const diagnostics: Diagnostic[] = [
      error("dot/parse-error", "Unexpected token.", {
        hint: "Check for an unclosed brace.",
        location: { file: "blueprint.dot", line: 3, column: 12 },
      }),
      warning("card/duplicate-phase", "Phase declared twice.", {
        location: { cardRef: "solver@1.0.0", path: "phases[1]" },
      }),
    ];

    const response = ok({ blueprint: undefined, diagnostics });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.diagnostics).toEqual(diagnostics);
    expect(body.diagnostics[0].location).toEqual({ file: "blueprint.dot", line: 3, column: 12 });
    expect(body.diagnostics[1].location).toEqual({ cardRef: "solver@1.0.0", path: "phases[1]" });
  });
});
