/* ============================================================
   T090 — the published surface

   "The contract must name the interface, not only the
   behaviour": three separate T000 defects had one cause, which was
   a contract that said what each capability must *do* and never
   what it must *look like*. These tests bind the three names the
   Published signatures block spells and nothing else.
   ============================================================ */

import { describe, expect, it } from "vitest";

import { EXPORT, PUBLISHED, loadExport, requiredFn } from "./contract";

describe("T090 published surface", () => {
  it("publishes exportRelease from the barrel the contract names", async () => {
    const mod = await loadExport();
    const fn = requiredFn(mod, "exportRelease");
    expect(typeof fn).toBe("function");
  });

  it("publishes serveFile from the barrel the contract names", async () => {
    const mod = await loadExport();
    const fn = requiredFn(mod, "serveFile");
    expect(typeof fn).toBe("function");
  });

  it("publishes serveCard from the barrel the contract names", async () => {
    const mod = await loadExport();
    const fn = requiredFn(mod, "serveCard");
    expect(typeof fn).toBe("function");
  });

  it("publishes recordDownload from the barrel the contract names", async () => {
    /* Published at the blind suite's delivery, after this author reported that B-14's "one event
       per served file" had no name, arity or table to bind to. It is the same signature T150
       publishes, so the two tasks cannot grow two spellings of one event. */
    const mod = await loadExport();
    const fn = requiredFn(mod, "recordDownload");
    expect(typeof fn).toBe("function");
  });

  /**
   * Arity, because the two serving functions differ in it and a swap is silent.
   *
   * `serveFile(db, actor, ref, path)` takes four and `serveCard(db, actor, ref)` takes three, so
   * an implementation that gave `serveCard` a fourth parameter — or `serveFile` three — would be
   * one whose callers pass arguments into the wrong slot with no type error at the boundary a
   * dynamic import crosses. Declared arity only: a default or a rest parameter would move this
   * number legitimately, which is why the assertion is on the published shape and the message
   * says so rather than treating any other number as a defect on its own.
   */
  it("takes the parameter lists the Published signatures block states", async () => {
    const mod = await loadExport();
    const arities: Record<string, number> = {
      exportRelease: 4,
      serveFile: 4,
      serveCard: 3,
      recordDownload: 2,
    };
    for (const [name, expected] of Object.entries(arities)) {
      const fn = requiredFn(mod, name as keyof typeof PUBLISHED);
      expect(
        fn.length,
        `${EXPORT}'s \`${name}\` declares ${fn.length} parameters.\n` +
          `  T090's contract: ${PUBLISHED[name as keyof typeof PUBLISHED]}\n` +
          `  A default or rest parameter moves this number legitimately; a swapped parameter ` +
          `list does not, and the two are indistinguishable to a caller crossing a dynamic ` +
          `import.`,
      ).toBe(expected);
    }
  });

  /**
   * `ServedFile` is an interface, so it has no runtime witness of its own and is pinned where it
   * is actually produced — see `serve.test.ts`, which asserts the three fields and that `bytes`
   * is a `Uint8Array` on a file that was really served. Stated here so the surface file is not
   * read as covering it.
   */
  it("does not export ServedFile as a value, because it is a type", async () => {
    const mod = await loadExport();
    expect(
      mod.ServedFile,
      `${EXPORT} exports a runtime value called \`ServedFile\`. The contract publishes it as ` +
        `\`${PUBLISHED.ServedFile}\` — an interface. Its fields are pinned on a really-served ` +
        `file in serve.test.ts.`,
    ).toBeUndefined();
  });
});
