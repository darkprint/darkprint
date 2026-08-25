/* ============================================================
   T262 AC5, D-262-03 and D-262-06 — the files that must not move

   "Passes unchanged" is the strongest form a cutover criterion
   takes, and it is also the one with no enforcement unless somebody
   asserts it. The section's own rule — do not weaken, skip or
   rewrite a named test to make a cutover pass — binds an implementer
   who owns its regression tests, and D-262-03 established that the
   blind author may not read the file that would catch it. So the
   check available from here is a CONTENT DIGEST, and that is what
   this file is.

   ── why a digest and not a re-run ──
   Running `tabs.test.ts` here would prove it passes, which is not
   the criterion: a rewritten test that passes is exactly the failure
   D-262-03 exists to prevent, and it passes. Only content answers
   "unchanged".

   ── why a LITERAL digest and not `git show <ref>` ──
   `tests/error-hygiene.test.ts:113` takes its domain from a REF,
   `git ls-tree -d backend lib/server/`, and a ref is a mutable
   global that a guard dereferences at run time — so a merge can move
   what the guard is comparing against. A literal taken at a named
   sha cannot move, and a red then says which of the two things
   happened rather than silently re-baselining.

   Digests below are sha256 of the file bytes, taken on `backend` at
   `1bfee90`, verified equal to `git show 1bfee90:<path>` at the time
   of writing.
   ============================================================ */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { sources } from "./contract";
import { resolved } from "./partition";

interface Frozen {
  readonly path: string;
  readonly sha256: string;
  readonly why: string;
}

const FROZEN: readonly Frozen[] = [
  {
    path: "components/site/nav.test.ts",
    sha256: "d691ff4ccbfd2a8b9659c172262e036e151b122c3eb75118fe195ad6e54c9477",
    why: "AC5 names it must-pass-unchanged. D-262-06 turns that into a constraint on the cutover: it imports `ACCOUNT_MENU` as a module-scope array and reads `.href` off every row, and a static import of a static array is what a per-request session cannot be. AMENDED ONCE, by ruling (D-262-29, owner-stated 2026-08-25): `/welcome` was added as a route no header may link, its `ELSEWHERE` exemption edited this file, and this pin was moved in the SAME commit. The freeze fired correctly — an author editing a guard so their own change passes is exactly what it watches for — and the amendment is recorded rather than quietly re-baselined. The exemption was falsified before the pin moved: a throwaway top-level route still reds the assertion, so the guard was narrowed by one named route and not blunted. AMENDED AGAIN at T280 (owner-instructed wiring wave, 2026-08-25): `/new` joined `ELSEWHERE` (a creation form reached from the profile shelf's own button, same reasoning as `/upload`), and the same falsification ran before this pin moved — a throwaway `app/zzz-probe` route still reds by name.",
  },
  {
    path: "components/profile/tabs.test.ts",
    sha256: "9c5b42eca8f18db9f435139228081e6ad0cc4cb9a75e66d264def791a8e06928",
    why: "AC5 names it, and D-262-02 established it stays whole only because D-262-01 kept the fixtures. If `lib/data/**` is deleted after all, three of its six suites lose their subject and this red is the first sign. AMENDED at T280 (owner-instructed, 2026-08-25): the profile index became the bundle shelf, `blueprints` took the empty segment and `overview` left `PROFILE_TABS`, so the suite's root-tab cell now finds `blueprints`; re-pinned in the same commit as the tabs.ts change it reads.",
  },
  {
    path: "components/profile/tabs.ts",
    sha256: "6ae570cfce5bb6ff60e1c78652176e38f0449e1340625b89ef9d5569997f6785",
    why: "D-262-03. `lib/server/naming/reserved.ts:13` imports `RESERVED_PROFILE_SEGMENTS` from it and `isReservedSlug()` is that import and nothing else, so merged T070's slug refusal is decided here. Add a sixth tab and the registry silently refuses a sixth name. AMENDED at T280 (owner-instructed, 2026-08-25): `overview` left the table and `blueprints` took the empty segment, so the reserved set derives to cards/saved/terms — `blueprints` became an allocatable slug and t070's literals moved in the same commit. The freeze fired exactly as designed; the change it caught is the wave's own instruction, not an author dodging a guard.",
  },
];

describe("AC5 and D-262-03: the frozen files are byte-identical", () => {
  it.each(FROZEN)("$path", ({ path, sha256, why }) => {
    /*
     * `sources()` first, so "the file was deleted" reds as a PartitionError naming the path
     * rather than as a digest mismatch against an empty read. The two have different repairs.
     */
    const [source] = sources([resolved(path)], 1);
    const actual = createHash("sha256").update(readFileSync(source.path)).digest("hex");
    expect(
      actual,
      `${path} has changed. ${why}\n\n` +
        `Pinned at sha256 ${sha256}, taken on \`backend\` at \`1bfee90\`. If the change is ` +
        `intended, it is a change to a file this task was told not to move, and it needs a ` +
        `ruling before the pin is updated — updating the pin to match is the removal of this ` +
        `assertion, not the satisfaction of it.`,
    ).toBe(sha256);
  });
});

describe("D-262-06: `ACCOUNT_MENU` stays a static, handle-free shape", () => {
  /*
   * The digest above pins `nav.test.ts`, which is the READER. This pins the thing it reads, and
   * it is a separate criterion: `nav.test.ts` could stay byte-identical while `ACCOUNT_MENU`
   * becomes a function or gains an interpolated handle, and then the must-pass-unchanged test
   * fails for a reason no digest predicted.
   *
   * The ruling is "keep the rows static and handle-free, interpolate the handle at RENDER", so
   * what is decidable from source is exactly that: every `href` in the declaration is a plain
   * string literal. A template with a substitution, or a value computed per request, reds.
   *
   * `SiteHeader.tsx` is T262's under D-262-06 and this author has not read it. It is parsed.
   */
  it("no `href` in the declaration carries a substitution", () => {
    const [source] = sources([resolved("components/site/SiteHeader.tsx")], 1);
    const sf = ts.createSourceFile(
      source.path,
      source.raw,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    let declaration: ts.VariableDeclaration | undefined;
    const find = (n: ts.Node) => {
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === "ACCOUNT_MENU"
      ) {
        declaration = n;
      }
      n.forEachChild(find);
    };
    find(sf);

    /* The premise, and it fails outside the negative: a renamed or removed `ACCOUNT_MENU` would
       satisfy "no interpolated href" perfectly, and `nav.test.ts:47` imports it by that name. */
    expect(
      declaration,
      "`ACCOUNT_MENU` is not declared in `components/site/SiteHeader.tsx`. `nav.test.ts:47` " +
        "imports it by name, so this is a must-pass-unchanged test losing its subject.",
    ).toBeDefined();

    const offenders: string[] = [];
    const walk = (n: ts.Node) => {
      if (
        ts.isPropertyAssignment(n) &&
        ((ts.isIdentifier(n.name) && n.name.text === "href") ||
          (ts.isStringLiteral(n.name) && n.name.text === "href"))
      ) {
        const line = sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        /* The criterion is STATIC, not a spelling. A backtick string with no `${}` is as static
           as a quoted one, and refusing it would red a correct rewrite over an incidental form —
           which is how T263's blind author lost 29 of 31 cells. What cannot stand is a
           substitution: that is a value read when the module is evaluated, once per process,
           which is precisely what a per-request session is not. */
        const init = n.initializer;
        const isStatic =
          ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init);
        if (!isStatic) offenders.push(`line ${line}: ${ts.SyntaxKind[init.kind]}`);
      }
      n.forEachChild(walk);
    };
    walk(declaration!);

    expect(
      offenders,
      "a row's `href` is computed rather than static. D-262-06: the rows stay static and " +
        "handle-free and the handle is interpolated at RENDER, because `nav.test.ts` reads " +
        "`.href` off every row from a module-scope import — and a static import of a static " +
        "array is exactly what a per-request session cannot be.",
    ).toEqual([]);
  });
});
