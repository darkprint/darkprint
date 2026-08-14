import { describe, expect, it } from "vitest";

import { CORE_ONTOLOGY } from "@/lib/core";

import { asOntology, CORE_VOCABULARY_TITLE } from "./vocabulary";

/* ============================================================
   The schema has no title column, so `CORE_VOCABULARY_TITLE` is a
   literal that also lives in `lib/core/ontology/core.ts`. Two
   copies of a literal with nothing comparing them is how
   `bundle_owner_slug_key` drifted, and it fails silently — the day
   someone edits one, `openView` starts reporting a title the core
   vocabulary no longer has and no gate notices.

   The tie is asserted here rather than enforced at runtime so the
   store does not take the 507-line core vocabulary as a dependency
   for one string: a test imports freely, a module should not.
   ============================================================ */

describe("T030 the core vocabulary title", () => {
  it("equals CORE_ONTOLOGY.title, which is the literal it duplicates", () => {
    expect(
      CORE_VOCABULARY_TITLE,
      "CORE_VOCABULARY_TITLE has drifted from CORE_ONTOLOGY.title. The schema holds no " +
        "title column, so this constant is the only source for `Ontology.title` — update it, " +
        "or add the column if a non-core vocabulary is now being versioned.",
    ).toBe(CORE_ONTOLOGY.title);
  });

  it("puts the title and the caller's version into the Ontology the merge consumes", () => {
    const ontology = asOntology("1.2.3", []);
    expect(ontology).toEqual({ version: "1.2.3", title: CORE_ONTOLOGY.title, terms: [] });
  });
});
