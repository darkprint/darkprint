/* ============================================================
   The owner's controls on their own profile, and the rule they are the exception to

   `ProfileHeader`'s own header states it: every control on this page is a real
   destination, and the owner's three are allowed only because all three land
   somewhere that does what the label says. A fourth button to a route that does
   not exist, or a relabelled one pointing at a flow that cannot take what its
   name promises, is the failure this file is here to catch.

   Read off the SOURCE rather than a render. The component takes a live session
   and a handle and mounts client islands for watch and support; standing those
   up would test the fixtures. What is being held here is which href each label
   goes to, which the source states literally.
   ============================================================ */

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SOURCE = readFileSync(`${ROOT}components/profile/ProfileHeader.tsx`, "utf8");

/** The `<ButtonLink>` calls in the owner's branch, as `[href, label]`. */
function ownerButtons(): [href: string, label: string][] {
  const at = SOURCE.indexOf("{owner ? (");
  expect(at, "the owner branch is gone from ProfileHeader").toBeGreaterThan(-1);
  const branch = SOURCE.slice(at, SOURCE.indexOf(") : (", at));
  return [...branch.matchAll(/<ButtonLink\s+href="([^"]+)"[^>]*>\s*([^<]+?)\s*<\/ButtonLink>/g)].map(
    (m) => [m[1], m[2]],
  );
}

describe("the owner's controls", () => {
  it("offers a card alongside a blueprint, which is the pair the registry holds", () => {
    const labels = ownerButtons().map(([, label]) => label);
    expect(labels, "the owner can no longer reach one of the two things they can publish").toEqual(
      expect.arrayContaining(["New blueprint", "New card"]),
    );
  });

  it("sends each label somewhere that takes what the label names", () => {
    const byLabel = new Map(ownerButtons().map(([href, label]) => [label, href]));
    expect(byLabel.get("New blueprint")).toBe("/new");
    /* `?kind=node` and not a bare `/upload`: the flow opens on Blueprint otherwise, and a
       reader who clicked `New card` would be asked the question their click answered. */
    expect(byLabel.get("New card")).toBe("/upload?kind=node");
    expect(byLabel.get("Edit profile")).toBe("/settings");
  });

  it("names only routes that exist, since a dead control is what the header forbids", () => {
    for (const [href] of ownerButtons()) {
      const route = href.split("?")[0];
      const page = `${ROOT}app${route}/page.tsx`;
      expect(
        statSync(page, { throwIfNoEntry: false }),
        `the owner's controls link to ${route}, and app${route}/page.tsx is not there`,
      ).toBeDefined();
    }
  });
});

describe("the upload flow can be opened on the kind a caller names", () => {
  const FLOW = readFileSync(`${ROOT}components/upload/UploadFlow.tsx`, "utf8");
  const PAGE = readFileSync(`${ROOT}app/upload/page.tsx`, "utf8");

  it("seeds the picker from the prop rather than always opening on Blueprint", () => {
    expect(
      FLOW,
      "`New card` lands on the picker's default again, so the button asks a question it answered",
    ).toContain('useState<ContentKind>(initialKind ?? "blueprint")');
  });

  it("takes the kind from the query string and refuses a value the flow has no step for", () => {
    expect(PAGE).toMatch(/firstString\(params, "kind"\)/);
    /* The narrowing is the point: an unknown `?kind=` opens Blueprint rather than putting
       the flow in a state with no step behind it. */
    expect(PAGE).toMatch(/asked === "node"/);
    expect(PAGE).toMatch(/: undefined/);
  });
});
