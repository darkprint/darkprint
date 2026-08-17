/**
 * Scratch coverage for the pure half, run by the implementer only — does not count
 * as verification (docs/ORCHESTRATION.md, Agent A). No database: everything here is
 * reachable without one, and putting it behind `skipIf(!DATABASE_URL)` would make a
 * pure guard silently unrun in a worktree with no compose stack.
 */
import { describe, expect, it } from "vitest";
import { RESERVED_PROFILE_SEGMENTS } from "@/components/profile/tabs";
import { isReservedSlug, validateCardId, validateNamespace } from "./index";

describe("lib/server/naming — the grammar, derived from the engine", () => {
  it("accepts the shapes the archive already ships", () => {
    /* Handles from `lib/data/users.ts`, slugs from `content/blueprints/`. If the derived
       grammar refused one of these, the registry could not name what it already holds. */
    for (const name of ["mara-veil", "k0bra", "sol-antczak", "orin", "frontline-triage"]) {
      expect(validateNamespace(name), name).toEqual([]);
      expect(validateCardId(name), name).toEqual([]);
    }
    expect(validateCardId("berti/solver-a")).toEqual([]);
  });

  it("refuses a namespaced value as a namespace, and reports it as `card/bad-id`", () => {
    const [diagnostic, ...rest] = validateNamespace("berti/solver-a");
    expect(rest).toEqual([]);
    expect(diagnostic.code).toBe("card/bad-id");
    expect(diagnostic.severity).toBe("error");
    expect(diagnostic.message).toBe("Namespace `berti/solver-a` is not a legal identifier.");
  });

  it("refuses surrounding whitespace, which a bare parse would have trimmed away", () => {
    /* The reason `isCardId` round-trips rather than testing for `undefined`: `parseCardRef`
       trims, so " solver" parses cleanly as "solver" and a name with a leading space would
       otherwise be stored — a different string from the one the caller asked for. */
    expect(validateCardId(" solver")).toHaveLength(1);
    expect(validateCardId("solver ")).toHaveLength(1);
    expect(validateNamespace(" mara-veil")).toHaveLength(1);
  });

  it("refuses everything outside `[a-z0-9-]`, an unpaired surrogate included", () => {
    for (const bad of [
      "",
      "Mara-Veil",
      "mara_veil",
      "mara veil",
      "mara--veil",
      "-mara",
      "mara-",
      "mara/",
      "/mara",
      "a/b/c",
      "mara.veil",
      "mara@veil",
      "mara\nveil",
      "mara\u00A0veil",
      /* D-12: `pg` sends `text` as UTF-8 and an unpaired surrogate has none, so Postgres
         would store U+FFFD and the primary key would stop being the name asked for. The
         grammar is what keeps one from ever reaching the driver. */
      "mara\uD800veil",
      "\uDC00",
    ]) {
      expect(validateNamespace(bad), JSON.stringify(bad)).toHaveLength(1);
    }
  });

  it("reserves exactly the segments the profile tabs occupy, read from that module", () => {
    /* Derived on both sides on purpose: a fifth tab has to become a fifth reserved slug
       with nothing here to update, and a list restated here would pass while disagreeing
       with the routes. */
    for (const segment of RESERVED_PROFILE_SEGMENTS) {
      expect(isReservedSlug(segment), segment).toBe(true);
    }
    expect(RESERVED_PROFILE_SEGMENTS).toContain("saved");
    expect(isReservedSlug("frontline-triage")).toBe(false);
    expect(isReservedSlug("blueprints-2")).toBe(false);
  });
});
