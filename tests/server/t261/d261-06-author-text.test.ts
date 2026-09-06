/* ============================================================
   T261 / D-261-06 — an author handle that holds no account is
   TEXT. The owner's link stays.

   D-260-25 ruled end state (d) and recorded it OWED rather than
   assigned, because its carriers sat outside T260's partition.
   They are inside T261's, so D-261-06 assigns it. The split is
   D-250-18's own and it decides which surfaces move:

     OWNER   re-attribution moved ownership to a registry account
             that EXISTS -> `/u/{owner}` resolves -> the link STAYS
     AUTHOR  `release.manifest.author` keeps the original handle,
             one of the six that hold NO account (D-250-11)
             -> every `/u/{handle}` is a 404 -> TEXT, no link

   ── why these assert on RENDERED OUTPUT and not on source ──
   Because the source has two spellings for one link and a grep
   finds one of them. BOTH of these files carry the handle twice:

     FileTree.tsx:80   <Avatar author={author} … link />
     FileTree.tsx:81   <Link href={`/u/${author.username}`}>
     BundleHeader.tsx:96  <Avatar author={owner} … link />
     BundleHeader.tsx:98  <Link href={`/u/${owner.username}`}>

   `Avatar` builds its own `<Link href={`/u/${author.username}`}>`
   internally (`components/ui/Avatar.tsx:66-69`), so a source scan
   of FileTree for `href=` sees one link and the reader gets two.
   A cell satisfied by removing the visible one would stay green
   while the avatar went on 404-ing. Rendered markup has no such
   blind spot: both spellings arrive as `<a href="/u/…">`.

   ── the blind position ──
   These cells RED against the tree as it stands, because the
   cutover has not happened and both files still link. That is the
   blind position, not a defect. What they must NOT do is red for
   some other reason, which is what the instrument cell below is
   for: a render that returned nothing would satisfy every
   "contains no link" assertion here at once.
   ============================================================ */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Author } from "@/lib/types";
import { FileTree } from "@/components/bundle/FileTree";
import { History } from "@/components/bundle/History";
import { BundleHeader } from "@/components/bundle/BundleHeader";

/**
 * One of D-250-11's six, verbatim.
 *
 * Named rather than invented: the ruling is about these six handles specifically, and a
 * fixture handle like `test-author` would be a claim about a handle the archive does not
 * contain and the registry has no opinion about.
 */
const ACCOUNTLESS = "lupo";

/** The six, so a later reader can see the population the rule is about. */
const THE_SIX = ["hachi", "k0bra", "lupo", "mara-veil", "orin", "sol-antczak"] as const;

const author: Author = {
  username: ACCOUNTLESS,
  displayName: "Lupo",
  avatarHue: 210,
  validator: false,
};

/** The re-attributed owner: D-250-04's own handle, which DOES hold an account. */
const OWNER_HANDLE = "darkprint";
const owner: Author = {
  username: OWNER_HANDLE,
  displayName: "DarkPrint",
  avatarHue: 190,
  validator: true,
};

function fileTree(): string {
  return renderToStaticMarkup(
    createElement(FileTree, {
      files: [
        { path: "topology.dot", kind: "dot", change: "the graph", state: "source", at: "2026-08-01" },
        { path: "README.md", kind: "doc", change: "what it is", state: "generated", at: "2026-08-01" },
      ],
      lastChange: { message: "published", digest: "sha256:abc", at: "2026-08-01" },
      author,
      footnote: "one folder",
    }),
  );
}

function history(): string {
  return renderToStaticMarkup(
    createElement(History, {
      entries: [
        { version: "1.0.0", digest: "abc1234", tag: "latest", message: "first", author: ACCOUNTLESS, at: "2026-08-01" },
      ],
    }),
  );
}

function bundleHeader(): string {
  return renderToStaticMarkup(
    createElement(BundleHeader, {
      owner,
      slug: "starter-software-factory",
      visibility: "public",
      summary: "a bundle",
      // No `watchers`. The Watch pill left `BundleHeader` on 2026-09-06 with the owner's
      // header rework, and the prop went with it. Nothing this file asserts was about the
      // count: it is a profile-link guard, and it reads the avatar and the handle.
      forks: 0,
      saveId: "blueprint:starter-software-factory",
      title: "Starter software factory",
    }),
  );
}

/** Every `href` in some markup that points at a profile, whatever spelled it. */
function profileLinks(html: string, handle: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)]
    .map(([, href]) => href)
    .filter((href) => href === `/u/${handle}` || href.startsWith(`/u/${handle}?`));
}

describe("D-261-06: the instrument", () => {
  /*
   * The premise for every "carries no profile link" cell below, and it fails outside all of
   * them. A render that threw, or returned an empty string, satisfies every absence
   * assertion in this file at once — the exact vacuity `tests/server/t260/contract.ts`
   * refuses at file level. So: the renders produce markup, and the scanner can SEE a
   * profile link when one is really there.
   */
  it("renders markup, and finds a profile link where one exists", () => {
    for (const [name, html] of [
      ["FileTree", fileTree()],
      ["History", history()],
      ["BundleHeader", bundleHeader()],
    ] as const) {
      expect(html.length, `${name} rendered nothing; every absence cell below is vacuous`)
        .toBeGreaterThan(200);
    }

    // The scanner, proved against a case that MUST have links: the owner's header.
    expect(
      profileLinks(bundleHeader(), OWNER_HANDLE).length,
      "the href scanner found no owner link in a header that carries two. It has stopped " +
        "matching, so every `toEqual([])` below would pass against a page full of 404s.",
    ).toBeGreaterThan(0);
  });

  it("names the six D-250-11 handles the rule is about", () => {
    expect(THE_SIX).toHaveLength(6);
    expect(THE_SIX).toContain(ACCOUNTLESS);
  });
});

describe("D-261-06: an accountless AUTHOR is text", () => {
  it("FileTree prints the handle and links it nowhere", () => {
    const html = fileTree();

    expect(
      html,
      "FileTree no longer prints the author's handle at all. End state (d) is the handle as " +
        "TEXT — removing the link and the name together is not the honest end state, it is " +
        "dropping the attribution the archive actually carries (D-250-18).",
    ).toContain(ACCOUNTLESS);

    expect(
      profileLinks(html, ACCOUNTLESS),
      `FileTree still links \`/u/${ACCOUNTLESS}\`, which holds no account (D-250-11) and ` +
        `404s.\n\n` +
        `NOTE THE TWO SURFACES: \`FileTree.tsx:80\` mounts \`<Avatar … link />\`, which builds ` +
        `its own \`/u/\` link inside \`components/ui/Avatar.tsx:66-69\`, and \`:81\` writes a ` +
        `second one on the handle text. Removing the visible \`<Link>\` and leaving the ` +
        `avatar's \`link\` prop set fixes neither — this cell reads rendered markup precisely ` +
        `so it cannot be half-satisfied.`,
    ).toEqual([]);
  });

  it("History prints the handle and links it nowhere", () => {
    const html = history();

    expect(html, "History no longer prints the entry's author").toContain(ACCOUNTLESS);

    expect(
      profileLinks(html, ACCOUNTLESS),
      `History still links \`/u/${ACCOUNTLESS}\` (History.tsx:83-88). A published snapshot ` +
        `records who authored it; under D-250-18 that handle stays the original one, and ` +
        `under D-250-11 it holds no account. A rendered link behind it is the defect ` +
        `D-260-25 named and D-261-06 assigns here.`,
    ).toEqual([]);
  });
});

describe("D-261-06: the OWNER's link stays, and both of its surfaces do", () => {
  /*
   * The other half of the split, and the control that keeps the two cells above from being
   * satisfiable by "delete every profile link on the page".
   *
   * Two links today: the avatar and the handle text. Pinned at two rather than at "at
   * least one" because they are two independent click targets for one reader — and because
   * a cell asserting `>= 1` is exactly the shape that stayed green while one of the two
   * disappeared, which is the finding that produced this file's rendered-output approach.
   */
  it("BundleHeader still links the owner from the avatar AND the handle", () => {
    const links = profileLinks(bundleHeader(), OWNER_HANDLE);

    expect(
      links.length,
      `the owner's profile link is gone from BundleHeader. Re-attribution moved OWNERSHIP to ` +
        `a registry account that EXISTS (D-250-18), so \`/u/${OWNER_HANDLE}\` resolves and ` +
        `D-261-06 rules this link STAYS. The author cells above must not be satisfied by ` +
        `removing every profile link on the page.`,
    ).toBeGreaterThanOrEqual(2);

    expect(links.every((href) => href === `/u/${OWNER_HANDLE}`)).toBe(true);
  });
});
