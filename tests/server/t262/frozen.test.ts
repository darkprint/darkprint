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
    /* Seventh amendment (owner-instructed, 2026-09-06): the owner asked whether the ontology
       should exist at all, or whether everything should unify under the Attractor
       specification, because two specification documents read as two rival standards. The
       investigation answered that the vocabulary describes the layer Attractor leaves open
       and that the friction is the ORDER a reader meets them in, and the owner replied: "The
       motivations you provided are sound. Apply them."

       So the crosswalk at `/spec/attractor` moves from stop 04 to stop 01, and
       `/spec/ontology` folds into `/spec/card` — every ontology term exists to be a legal
       value of a card field, so each is printed beside the field that consumes it. This is
       the SECOND fold of the same subject in one day, and it lands on the file the sixth
       amendment directly below had just rewritten for the first one.

       Three things moved and none of them is a floor being slid.

       `RENAMED` repoints `/ontology` onto `/spec/card` and GAINS `/spec/ontology ->
       /spec/card`. Both in one hop: the sixth amendment left `/ontology` pointing at
       `/spec/ontology`, and leaving it there would have made it a 308 onto a 308, which is
       the cost this table's own `/which-tasks` entry records and the fourth time in three
       days it has been refused. The row puts four assertions on each path at once, which is
       why it is the whole of the redirect half of this amendment.

       The Decision-1 cell is rewritten for the FOURTH time, and this rewrite ends the
       question rather than restating it. The cell asked which of two routes wears the bare
       word "Ontology"; the sixth amendment answered it with one route and one absence, and
       now neither route exists. So both halves point the same way — `HEADER_LABELS` must
       know neither `/ontology` nor `/spec/ontology` — and the positive moves to the
       destination, `/spec/card` keeping the file form its surviving sibling has.

       One test NAME changed, and no assertion with it: "uses the shared 00-06 sequence for
       the Learn dropdown" became "uses the shared sequence for the Learn dropdown". The
       range had been wrong since the sandbox was deleted and would have been wrong again
       today; the cell compares the dropdown against `SPEC_SEQUENCE` element-wise and never
       read it.

       Falsified before this pin moved, with four probes, each applied, run, and reverted:

         1. a `/spec/ontology` docs row restored to `NAV` reds the rewritten cell by name
            with its own message ("a header row points at /spec/ontology, which 308s onto
            /spec/card"), plus three more it should red;
         2. a `/ontology` Browse row restored reds the same cell with the same message for
            the other path, which is what makes the two halves independent rather than one
            claim written twice;
         3. deleting the new rule from `next.config.ts` reds the `RENAMED` row ("no redirect
            for /spec/ontology");
         4. the standing probe the fourth, fifth and sixth amendments used — a throwaway
            `app/zzz-probe` route — still reds "lists every top-level route in the header" by
            name, so the parts of this file the amendment did not touch are unchanged in
            force.

       The previous pin was
       `fdb11c4401adb34168f77f275b78533578c27d56c00abbe9e617f0f7f4e2e0b9`, and unlike the
       fourth, fifth and sixth it IS fetchable: that state committed as `69dd106`, so
       `git show 69dd106:components/site/nav.test.ts | shasum -a 256` reproduces it and
       `git diff` on this file prints this amendment alone.

       Sixth amendment (owner-instructed, 2026-09-06): the owner folded the ontology browser
       into the spec page and deleted its index. In their own words: "move the ontology page
       in the /spec/ontology substituing the "every term" box. Then, you can delete the
       /ontology page".

       This is the THIRD reversal of one decision, and the amendment is worth reading as
       that rather than as an edit. `/ontology` was a 308 onto `/spec/ontology`; the accounts
       pass gave it a real page and `components/ontology/canonical-route.test.ts` was written
       to pin the split "so neither can quietly absorb the other again"; the owner has now
       absorbed one into the other. A guard written to prevent exactly this is being inverted
       by the person entitled to invert it, and the reason it was written stays in the tree.

       Three things moved in this file and none of them is a floor being slid.

       `RENAMED` gains `/ontology -> /spec/ontology`, which puts four assertions on the fold
       at once: the 308 exists and is permanent, the destination is a real page, no page
       shadows the source, and no chrome table names the retired path. `/ontology/<term>` is
       deliberately NOT covered by that row, because a `source` with no parameter is an exact
       anchored pattern and the term detail pages keep their URLs.

       The Decision-1 cell is rewritten for the third time. It asked which of two routes
       wears the bare word "Ontology"; there is one route now, so the question has no second
       subject. What survives is the half that still has one — the spec row keeps the file
       form its two siblings have — and the other half inverts into `HEADER_LABELS` not
       knowing `/ontology` at all.

       A cell is ADDED: "never puts two labels on one route". It is the converse of the cell
       above it, it was missing for as long as this file has existed, and the fold is what
       exposed the hole. `HEADER_LABELS` is a `Map` keyed by href, so two `NAV` rows at one
       route do not collide, they overwrite, and every label check in the file then reads the
       survivor.

       Falsified before this pin moved, and NOT with the `zzz-probe` route the amendments
       below used: that probe exercises a cell this amendment does not touch. The probe here
       is the repair that was actually rejected. Repointing the Browse row at the spec page
       (`{ href: "/spec/ontology", label: "Ontology", group: "browse" }` restored to `NAV`,
       run, removed) reds the new cell by name, with its own message about the Map
       overwriting, and reds NOTHING ELSE in the file — the pre-existing footer-parity cell
       stays green because the footer row went in the same change. So the mistake this
       amendment is guarding against was, before the added cell, completely silent. A second
       probe restoring a `/ontology` row reds the rewritten Decision-1 cell by name
       ("a header row points at /ontology, which 308s onto /spec/ontology"), and a third,
       deleting the new rule from `next.config.ts`, reds the `RENAMED` row ("no redirect for
       /ontology"). All three were reverted before the digest below was taken.

       The previous pin was
       `04d541b0ec1a9e0a02bbe750dcbdb857335c0c7afbff2439757ff1b78de6b439`. Like the fourth
       and fifth, it is a working-copy digest rather than a fetchable one: that state was
       never committed, so `git show` produces no such bytes and `git diff` on this file
       prints the fourth, fifth and sixth amendments together.

       Fifth amendment (owner-instructed, 2026-09-06): the owner deleted `/build` and the
       whole `components/build` tree ("delete /build, it is not useful and make confusion"),
       and the fourth amendment directly below had, two days earlier, repointed two retired
       paths ONTO that route. Three things moved and none of them is a floor being slid.

       `RENAMED` now sends `/spec/scoring` and `/reading-the-radar` to
       `/what-a-blueprint-is`, each as its own row and each in one hop. The fourth
       amendment's own argument is what forces the shape: chaining a 308 onto a 308 costs
       every older link two hops, so a destination that is itself retired has to be replaced
       rather than pointed through. `/reading-the-radar` is a row here for the first time,
       because until this change it was a destination rather than a source.

       `uploadLabels` was widened to read `NAV` through a
       `readonly { href: string; label: string }[]`. `NAV` is a `const` array of object
       literals, so TypeScript infers `href` as the union of the paths actually in it; the
       workspace row's `href` was the one `string` in that union and widened the whole field.
       Losing that row turned the cell's `item.href === "/upload"` into a comparison between
       non-overlapping types, which is a compile error rather than an empty result. Casting
       the comparison away would have let the compiler prove the cell vacuous, and the cell
       exists to red on the day a `/upload` row comes back.

       Falsified before this pin moved, the same way the amendments below were: a throwaway
       `app/zzz-probe/page.tsx` still reds "lists every top-level route in the header" by
       name, with `expected [ 'zzz-probe' ] to deeply equal []` and 22 of the file's 23 cells
       passing. The probe was removed and the file re-hashed to the digest below.

       The previous pin was
       `57291ed4cce24e5c23745ead6958b1c343c8d8cffe8c86d69f24f711dff15bc8`, and no `git show`
       produces those bytes: the fourth amendment was still uncommitted when this one landed
       on top of it, so that state was never committed. A sha256 of a working copy is
       computable without being fetchable, which is the cost this file's header accepts when
       it chooses a literal over a ref. `git diff components/site/nav.test.ts` compares
       against the THIRD pin, `784ad4ef…`, whose bytes are the committed ones, so that diff
       prints the fourth and the fifth amendments together and has to be read as two changes.

       Fourth amendment (owner-instructed, 2026-09-04): the author asked the page "How a
       blueprint is graded" off the site and chose a redirect over an unlisting, so
       `/reading-the-radar` left the header nav and this file could not stay both frozen and
       true. Two cells moved, and neither is a floor being slid. The RENAMED table gains
       `/reading-the-radar -> /build` and repoints `/spec/scoring` onto `/build` as well,
       because that path had merged into the retired page and chaining a 308 onto a 308
       costs every older link two hops. The fragment cell's named link was
       `/reading-the-radar#weights`, whose id was declared by the deleted page; it is
       re-pointed at `/what-a-blueprint-is#run`, which is a JSX attribute in a product
       component and therefore covers the same half of the regex the old one did.

       Falsified before this pin moved, the same way the amendments above were: a throwaway
       `app/zzz-probe` route still reds "lists every top-level route in the header" by name,
       so the guard is unchanged in force and only its subject moved.

       The previous pin was `784ad4efb0394cf1936782fc3bf5da50a85c2f18847ec8719955a66b7437cdb4`.

       Third amendment (owner-instructed, 2026-08-25): the Publish button left the chrome,
       so the /upload parity cells inverted — NAV must hold no /upload row and the source
       must carry no /upload href. Falsified before this pin moved: a probe link in the
       header reds the flipped cell by name.

       Eighth amendment (owner-instructed, 2026-09-06): "remove Validate and Publish it is
       only Publish". The upload route's `<h1>` and its `metadata.title` both became
       `Publish`, and this file is where the two are held together because they drifted apart
       once.

       THE CELL GOT STRICTER RATHER THAN BEING RETARGETED. It asserted both names; it now also
       asserts the OLD name survives in neither, so a half-done rename reds where before it
       would have passed on whichever half had been updated. Falsified before this pin moved:
       renaming only the `<h1>` and leaving `metadata.title` red the cell by name, and
       `app/upload/page.tsx` was restored from a `cp` copy and verified byte-identical with
       `diff -q`.

       The owner's other half needed no code and is recorded because a reader will look for
       it: "only if u are a register user u can publish" is ALREADY TRUE, verified rather than
       built. `canPublish` requires `session.state === "ready"`, `doPublish` re-checks it
       before sending, and `components/upload/session.ts` keeps anonymous, no-handle and
       unreachable apart so each gets its own sentence instead of one dead button. */
    sha256: "835a906a8d1c3431faa567f43a03702ccc1fe49803e1fedf714df2cffe7edf13",
    why: "AC5 names it must-pass-unchanged. D-262-06 turns that into a constraint on the cutover: it imports `ACCOUNT_MENU` as a module-scope array and reads `.href` off every row, and a static import of a static array is what a per-request session cannot be. AMENDED ONCE, by ruling (D-262-29, owner-stated 2026-08-25): `/welcome` was added as a route no header may link, its `ELSEWHERE` exemption edited this file, and this pin was moved in the SAME commit. The freeze fired correctly — an author editing a guard so their own change passes is exactly what it watches for — and the amendment is recorded rather than quietly re-baselined. The exemption was falsified before the pin moved: a throwaway top-level route still reds the assertion, so the guard was narrowed by one named route and not blunted. AMENDED AGAIN at T280 (owner-instructed wiring wave, 2026-08-25): `/new` joined `ELSEWHERE` (a creation form reached from the profile shelf's own button, same reasoning as `/upload`), and the same falsification ran before this pin moved — a throwaway `app/zzz-probe` route still reds by name.",
  },
  {
    path: "components/profile/tabs.test.ts",
    sha256: "9c5b42eca8f18db9f435139228081e6ad0cc4cb9a75e66d264def791a8e06928",
    why: "AC5 names it, and D-262-02 established it stays whole only because D-262-01 kept the fixtures. If `lib/data/**` is deleted after all, three of its six suites lose their subject and this red is the first sign. AMENDED at T280 (owner-instructed, 2026-08-25): the profile index became the bundle shelf, `blueprints` took the empty segment and `overview` left `PROFILE_TABS`, so the suite's root-tab cell now finds `blueprints`; re-pinned in the same commit as the tabs.ts change it reads.",
  },
  {
    path: "components/profile/tabs.ts",
    sha256: "5ffa0e7f5c81b21f25205862094394e6ab435829121586d98e7d7f94c96b0c0b",
    why: "D-262-03. `lib/server/naming/reserved.ts:13` imports `RESERVED_PROFILE_SEGMENTS` from it and `isReservedSlug()` is that import and nothing else, so merged T070's slug refusal is decided here. Add a sixth tab and the registry silently refuses a sixth name. AMENDED at T280 (owner-instructed, 2026-08-25): `overview` left the table and `blueprints` took the empty segment, so the reserved set derives to cards/saved/terms — `blueprints` became an allocatable slug and t070's literals moved in the same commit. The freeze fired exactly as designed; the change it caught is the wave's own instruction, not an author dodging a guard. AMENDED A SECOND TIME, DELIBERATELY, 2026-09-06, at the owner's instruction: \"remove the section Ontology terms\". The `terms` tab left the table and `app/u/[username]/terms/page.tsx` was deleted with it, so the reserved set derives to cards/saved. This amendment runs the sentence above IN REVERSE — the hazard it names is a tab ARRIVING and a name being silently refused; here a tab LEAVES and `terms` becomes silently ALLOCATABLE, which is the same guard catching the same coupling from the other side. Verified rather than reasoned, with a throwaway probe run against the amended file and then deleted: `RESERVED_PROFILE_SEGMENTS` is exactly [cards, saved], `PROFILE_TABS` is exactly [blueprints, cards, saved], `isReservedSlug(\"terms\")` is false and `isReservedSlug(\"saved\")` is still true, so the set narrowed by one member and did not collapse. `components/profile/tabs.test.ts` needed NO edit and its own pin did not move: it asserts the arity relation (`RESERVED_PROFILE_SEGMENTS.length === PROFILE_TABS.length - 1`) and names only `saved`, so it holds at three tabs exactly as it held at four — which is why a structural assertion outlived the table it was written against. SEAM-60 (`GET /api/authors/{handle}/terms`) lost its only anchor in the tree with the deleted route. The previous pin was `6ae570cfce5bb6ff60e1c78652176e38f0449e1340625b89ef9d5569997f6785`.",
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
