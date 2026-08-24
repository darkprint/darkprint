/* ============================================================
   T071 AC4 — the client cap, and the reason it is not enforcement

     "(4) `app/settings/page.tsx`'s handle field carries
      `maxLength={32}`, and the server refuses 33 **regardless** of
      the client cap, since a client cap is not enforcement"

   ── the criterion names a file that does not hold the field ──
   Measured on `66f502a` before a cell here was written:
   `app/settings/page.tsx` contains ZERO `<input> <textarea>
   <select> <TextField> <PrefixedField>` elements; it delegates to
   `<AccountForm>`, and the handle field is a `<PrefixedField
   id="handle">` inside `components/settings/AccountForm.tsx`.
   `maxLength` occurred zero times anywhere under `app/` or
   `components/`.

   D-071-01(2) dated the criterion's file to T262's `94232b8` — five
   days stale — and granted the two files that actually hold the
   field. D-071-02 then ratified the shape of this cell verbatim:
   **"parse the settings surface for the handle field wherever it
   lands; the cell must not depend on which of the three files
   carries the attribute."** T262 reached the same conclusion for the
   same reason and recorded it in `ac2-controls.test.ts`: "a cell
   scoped to the page then asserts a biconditional over an empty set".

   So the subject here is the settings SURFACE, walked, with a floor
   under it — a walk that returns nothing is the vacuity a named
   file was supposed to prevent and instead guarantees.

   ── two cells, because an attribute can be present and inert ──
   The hazard is specific and it is why `PrefixedField` is named
   above: it destructures a CLOSED prop list onto its `<input>` and
   spreads nothing. `maxLength={32}` written at that call site is
   accepted by TypeScript's JSX checker only if the prop was added to
   the component too — and if it was added to the props and not
   forwarded to the element, the source scan passes and the browser
   receives no cap at all.

   So the attribute is asserted at the source AND the rendered markup
   is asserted to carry it. Neither subsumes the other: the source
   cell survives a component refactor that breaks the render
   fixture's props and says so clearly; the render cell is the only
   one that can see the forwarding.

   ── and the third cell is the half the criterion exists for ──
   A client cap is a convenience. `maxLength` is absent from a
   `curl`, from every other client, and from a browser with the
   attribute removed in devtools. The server cell drives 33
   characters at the write door with no page involved at all, which
   is the sense in which "regardless" is a claim about the server.
   ============================================================ */

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AccountForm } from "@/components/settings/AccountForm";
import type { AccountRecord } from "@/lib/server/accounts";

import { invalidNamePrefix, rejects, unavailable, bind } from "./contract";
import { type HandleField, capOf, handleFieldsIn, handleInputIn, meansExactly } from "./sources";
import {
  MAX_HANDLE_LENGTH,
  allReservedHandles,
  clean,
  closeDatabase,
  createAccount,
  db,
  distinctNameOfLength,
  openDatabase,
} from "./fixtures";

const OVER = MAX_HANDLE_LENGTH + 1;

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/* ============================================================
   THE SURFACE, AS A UNION THAT CAN GROW AND CANNOT SHRINK

   T262's own construction, and its argument transfers unchanged: a
   walk decides how many cells exist, so anything that shortens it
   REMOVES assertions silently. The union of a named baseline taken
   at `66f502a` and the live walk means a file the change deletes
   still reds by name, a file it adds is picked up, and a rename does
   both.
   ============================================================ */

const BASELINE_SURFACE = [
  "app/settings/page.tsx",
  "components/settings/AccountForm.tsx",
  "components/settings/controls.tsx",
  "components/settings/ProfileFields.tsx",
] as const;

/** Below this the walk has lost files and every assertion over it has gone vacuous. */
const SURFACE_FLOOR = BASELINE_SURFACE.length;

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(join(REPO, dir), { withFileTypes: true });
  } catch {
    /* A missing directory is a premise violation and it must red in a CELL. Throwing during
       collection deletes every cell in the file: measured on this run, one emptied partition
       produced `Test Files 1 failed` beside `Tests 37 passed (37)` with 68 cells simply absent.
       Loud in the exit code, silent in the number a reader quotes. */
    return out;
  }
  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) out.push(path);
  }
  return out;
}

function surface(): string[] {
  return [...new Set([...BASELINE_SURFACE, ...walk("app/settings"), ...walk("components/settings")])];
}

/**
 * Every element on the settings surface that identifies itself as the handle field.
 *
 * The walk is here; the READING is in `sources.ts`, where a probe can hand it synthetic sources
 * that differ by one member. An inline reader could only ever run against the one tree this
 * suite runs on, where nothing produces a wrong-number cap — so its discriminating branch would
 * ship having never executed.
 */
function handleFields(): HandleField[] {
  const found: HandleField[] = [];
  for (const file of surface()) {
    let code: string;
    try {
      code = readFileSync(join(REPO, file), "utf8");
    } catch {
      continue; // reported by the premise cell, which names the count it got
    }
    found.push(...handleFieldsIn(file, code));
  }
  return found;
}

/* --------------------- the render fixture --------------------- */

/**
 * An account holding a handle, in the shape `AccountRecord` publishes.
 *
 * A fixed `joinedAt` rather than a fresh one: `lib/core/**` is isomorphic and this file renders
 * a component, so the markup must not vary between two runs of the same cell.
 */
const RENDERED_ACCOUNT: AccountRecord = {
  accountId: "00000000-0000-4000-8000-000000000071",
  author: {
    handle: "t071-render",
    displayName: "T071 render fixture",
    avatarHue: 210,
    validator: false,
  },
  email: "t071@example.test",
  joinedAt: new Date("2026-01-01T00:00:00.000Z"),
  validatorWeight: 0,
  defaultVisibility: "public",
};

function renderedSettingsMarkup(): string {
  /* `children` passed as the third argument rather than as a prop: `react/no-children-prop`
     refuses the prop form, and the two are the same thing to React. §05 and §06 arrive as
     children in production; `null` is enough here, because AC4's subject is §02's input. */
  return renderToStaticMarkup(
    createElement(AccountForm, { account: RENDERED_ACCOUNT, counts: null }, null),
  );
}

beforeAll(openDatabase, 60_000);
afterAll(closeDatabase, 60_000);
beforeEach(clean, 60_000);

describe("premise: the settings surface still has a handle field to cap", () => {
  it(`the walk reaches at least ${SURFACE_FLOOR} source files`, () => {
    const files = surface();
    expect(
      files.length,
      `the settings surface walk returned ${files.length} files. Every assertion below is ` +
        `quantified over this list, and a shortened list removes them silently rather than ` +
        `failing. Baseline taken at \`66f502a\`: ${BASELINE_SURFACE.join(", ")}.`,
    ).toBeGreaterThanOrEqual(SURFACE_FLOOR);
  });

  it("at least one element on the surface identifies itself as the handle field", () => {
    /* Zero means the marker moved and every cell below has nothing to be about. The count is
       NOT pinned at one: on `66f502a` it is 2 — a `<Field id="handle">` label wrapper and the
       `<PrefixedField id="handle">` inside it — and a correct implementation may leave both, so
       an exact pin here would red against a correct tree. That "more than one" is a real
       weakness of the source scan is why the rendered-markup cell exists: `maxLength` satisfied
       on the label wrapper and absent from the control passes this describe and reds there. */
    const fields = handleFields();
    expect(
      fields.map((f) => `${f.file}:${f.line} <${f.tag}>`),
      `elements carrying \`id="handle"\` on the settings surface. AC4 caps "the handle field", ` +
        `singular. If the wrapper and the control both carry the id, the cap has to be on the ` +
        `one that becomes an <input> — which is what the rendered-markup cell below measures ` +
        `and this one cannot.`,
    ).not.toEqual([]);
  });
});

describe("AC4, the client half: the handle field carries maxLength={32}", () => {
  it(`some element with \`id="handle"\` carries \`maxLength={${MAX_HANDLE_LENGTH}}\``, () => {
    const fields = handleFields();
    const capped = fields.filter((f) => f.maxLength !== undefined);
    expect(
      capped.map((f) => `${f.file}:${f.maxLength?.line} <${f.tag}> maxLength=${f.maxLength?.text}`),
      `no element carrying \`id="handle"\` on the settings surface has a \`maxLength\` at all. ` +
        `Found: ${fields.map((f) => `${f.file}:${f.line} <${f.tag}>`).join(", ") || "(nothing)"}. ` +
        `On \`66f502a\` the string \`maxLength\` occurred ZERO times under \`app/\` and ` +
        `\`components/\`, so this is a missing attribute and not a scan looking in the wrong ` +
        `place. D-071-01(2) grants \`components/settings/AccountForm.tsx\` and ` +
        `\`components/settings/controls.tsx\` for exactly this.`,
    ).not.toEqual([]);

    const wrong = capped.filter((f) => !meansExactly(f.maxLength?.text ?? "", MAX_HANDLE_LENGTH));
    expect(
      wrong.map((f) => `${f.file}:${f.maxLength?.line} maxLength=${f.maxLength?.text}`),
      `a \`maxLength\` on the handle field that is not ${MAX_HANDLE_LENGTH}. The criterion ` +
        `writes the number: "carries \`maxLength={${MAX_HANDLE_LENGTH}}\`". A cap of some other ` +
        `value satisfies "carries a maxLength" completely and caps the field somewhere the ` +
        `server does not. A reference to the published \`MAX_HANDLE_LENGTH\` is admitted.`,
    ).toEqual([]);
  });

  it(`and the rendered <input id="handle"> really carries maxlength="${MAX_HANDLE_LENGTH}"`, () => {
    /* The cell the source scan cannot be. `PrefixedField` destructures a closed prop list onto
       its `<input>` and spreads nothing, so a `maxLength` added to the props and not forwarded
       to the element passes the scan above and reaches no browser. Driven as a caller, through
       `renderToStaticMarkup` — the idiom this repository already uses for the plain half of a
       component — so what is asserted is what the markup says rather than what the source
       intends. */
    const markup = renderedSettingsMarkup();
    const input = handleInputIn(markup);
    expect(
      input,
      `the settings form rendered no \`<input id="handle">\`. The premise of this cell is that ` +
        `the handle field becomes an input; if the control changed shape, the source cell above ` +
        `still holds AC4 and this one needs re-pointing rather than deleting.`,
    ).toBeTypeOf("string");
    /* The attribute NAME is read case-insensitively and its VALUE exactly — see `capOf`. This
       assertion first ran matching the lowercase spelling and reported a dropped prop against a
       tag that carried `maxLength="32"`, because React 19 leaves this attribute camel-cased
       while lowercasing `tabIndex` beside it. HTML attribute names are case-insensitive, so the
       cap was reaching the browser and the red named the wrong file. */
    expect(
      capOf(input as string),
      `the handle input rendered as \`${input}\`. AC4's cap has to reach the ELEMENT: an ` +
        `attribute accepted as a prop and dropped before the \`<input>\` is a cap no browser ` +
        `ever applies, and the source scan cannot tell that apart from a correct forwarding.`,
    ).toBe(String(MAX_HANDLE_LENGTH));
  });
});

describe("AC4, the server half: 33 is refused REGARDLESS of the client cap", () => {
  it(`allocateHandle refuses ${OVER} characters with no page involved`, async () => {
    /* The half the criterion exists for, and the reason it says "regardless": `maxLength` is
       absent from a `curl`, from every non-browser client, and from a browser with the
       attribute deleted in devtools. Nothing in this cell renders anything — the string simply
       arrives at the write door the length the client was supposed to have prevented.

       Deliberately the WRITE door and not the query door: a client cap and a query-side check
       fail together in exactly the same way, by letting the row in. */
    const handle = distinctNameOfLength(OVER, "nocap");
    const account = await createAccount();
    const allocate = await bind("allocateHandle");

    await rejects(() => allocate(db(), account, handle), `allocateHandle(db, id, ${OVER} chars)`, {
      expectedPrefix: invalidNamePrefix("allocateHandle", handle),
    });
    expect(
      await allReservedHandles(),
      `a ${OVER}-character handle reached \`handle_reservation\` through the write door. The ` +
        `client cap is not enforcement: it is not present in any request this cell made.`,
    ).toEqual([]);
  });

  it(`checkHandle answers \`illegal\` for ${OVER} characters the client would never have sent`, async () => {
    const handle = distinctNameOfLength(OVER, "nocap");
    const check = await bind("checkHandle");
    await unavailable(() => check(db(), handle), `checkHandle(db, ${OVER} chars)`, "illegal");
  });
});
