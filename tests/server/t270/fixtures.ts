/* ============================================================
   T270 — fixtures

   Two kinds of thing live here and they are deliberately separate.

   ── the ARCHIVE, which is the second axis ──
   AC1 compares the CLI's diagnostics to THE SERVER'S. The server
   half is not modelled here and must never be: `readContent()`
   and `validateBundle()` are the merged implementation, written
   by other tasks, and that is exactly what makes them a real
   reference rather than a consistency check. An oracle written by
   the author of the assertions carries the author's misreading
   into both halves, and no mutation can then separate them — this
   project has already paid for that once. So the reference here is
   an IMPORT, never a reimplementation.

   ── the WIZARD'S LAYOUT, which is a ruled shape ──
   D-270-01 C6 makes `<dir>` the layout `/upload` accepts:
   `topology.dot` required, `cards/*.yaml`, and an OPTIONAL
   manifest. D-270-02 rules the stub the CLI supplies when the
   manifest is absent, after this suite measured that the "named
   constant" C6 cited does not exist — `assembleBundle`'s defaults
   are inline literals in a `"use client"` file that imports React,
   and `untitled-blueprint` is spelled twice with different
   conditions.

   The manifest FILENAME binds the wizard's own regex, not one
   spelling: `MANIFEST_NAME` at `components/upload/BundleDropzone.ts
   x:104` is `/^blueprint\.(ya?ml|json)$/i`, so `/upload` accepts
   `blueprint.yaml`, `blueprint.yml` AND `blueprint.json`. C6 said
   one; the code says three, and the code wins. `MANIFEST_SPELLINGS`
   below is what a cell quantifies over so all three are driven
   rather than the one anybody would have typed.
   ============================================================ */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Bundle, BundleManifest, OntologyTerm } from "@/lib/core";
import { contentVocabulary, readContent, type LoadedBundle } from "@/lib/content/read";

/* --------------------- the archive --------------------- */

/**
 * The nine, read the way the build reads them.
 *
 * A floor rather than a bare export: a walk that stopped reaching the archive would leave
 * every AC1 cell quantified over `[]` and reporting a pass per bundle it never opened. The
 * number is asserted as nine because AC1's own words are "the nine archive bundles" — if the
 * archive grows, AC1's wording is what needs a ruling, not this line quietly following it.
 */
export const ARCHIVE: readonly LoadedBundle[] = (() => {
  const loaded = readContent();
  if (loaded.length !== 9) {
    throw new Error(
      `backend.md §T270 AC1 says "the nine archive bundles"; \`readContent()\` returned ` +
        `${loaded.length}.\n` +
        `  BROKEN TEST rather than a failed criterion: every AC1 cell is quantified over this ` +
        `list. If the archive has genuinely changed size, AC1's wording needs a ruling.`,
    );
  }
  return loaded;
})();

/**
 * The archive's ontology overlay, which exactly one of the nine carries.
 *
 * Measured: `find public/bundles -name extensions.yaml` returns
 * `public/bundles/frontline-triage/ontology/extensions.yaml` and nothing else. That single
 * bundle is the whole of AC1's overlay coverage, so a cell that skipped it would test the
 * one path where the CLI and the server can most easily disagree — `validateBundle` builds
 * `ontologyView(CORE_ONTOLOGY, extensions)` and a caller passing no extensions scores the
 * same folder against the curated core alone.
 */
export const EXTENSIONS: readonly OntologyTerm[] = (() => {
  /* `contentVocabulary()` is `ContentVocabulary | undefined` — the archive is allowed to ship
     without an overlay. A floor rather than a `!`: absent, every overlay cell below would run
     against the curated core alone and PASS, testing the one path AC1 is least likely to
     break instead of the one it is most likely to. The assertion states the premise; the
     non-null assertion would have hidden that it had stopped holding. */
  const vocabulary = contentVocabulary();
  if (vocabulary === undefined || vocabulary.terms.length === 0) {
    throw new Error(
      "`contentVocabulary()` returned no ontology overlay.\n" +
        "  AC1's overlay coverage is exactly one bundle (`frontline-triage`), and without an " +
        "overlay those cells compare two runs that both scored against the curated core — " +
        "green, and blind to the difference they exist to catch. BROKEN TEST.",
    );
  }
  return vocabulary.terms;
})();

/** The one archive bundle whose folder carries `ontology/extensions.yaml`. */
export const OVERLAY_SLUG = "frontline-triage";

/* --------------------- the wizard's accepted layout --------------------- */

/** `components/upload/BundleDropzone.tsx:104`, consumed rather than retyped as one spelling. */
export const MANIFEST_NAME = /^blueprint\.(ya?ml|json)$/i;

/**
 * The three filenames `MANIFEST_NAME` admits, so a cell drives all three.
 *
 * Derived by testing candidates against the regex rather than listed, so a widened regex
 * widens this and a narrowed one narrows it. The floor is three because the pattern admits
 * three today and a cell quantified over one spelling is a cell blind to the other two.
 */
export const MANIFEST_SPELLINGS: readonly string[] = (() => {
  const admitted = ["blueprint.yaml", "blueprint.yml", "blueprint.json"].filter((name) =>
    MANIFEST_NAME.test(name),
  );
  if (admitted.length !== 3) {
    throw new Error(
      `\`MANIFEST_NAME\` admits ${admitted.length} of the three spellings /upload accepts ` +
        `(${JSON.stringify(admitted)}). This fixture is a copy of ` +
        `components/upload/BundleDropzone.tsx:104 and has drifted from it. BROKEN TEST.`,
    );
  }
  return admitted;
})();

/**
 * The manifest D-270-02 rules the CLI supplies when `<dir>` carries none.
 *
 * Written as a function of the directory name, which is the only input a local `validate`
 * has. `ontologyVersion` is the behaviour-bearing field and is NOT a free choice:
 * `resolveBundle` reads it at `lib/core/bundle/resolve.ts:714,726,730,732` and emits
 * `bundle/ontology-mismatch` from it, so a stub disagreeing with the server caller's default
 * fails AC1 through the stub rather than through the engine. `CORE_ONTOLOGY.version` is the
 * wizard's own fallback, which is why the ruling picked it.
 *
 * `description` and `category` are OMITTED rather than set undefined: the ruling omits them,
 * and an explicitly-undefined key is a different object to anything comparing key sets.
 */
export function ruledManifestStub(dirName: string): BundleManifest {
  return {
    slug: slugify(dirName) || "untitled-blueprint",
    title: dirName,
    summary: "",
    tags: [],
  };
}

/**
 * The slug rule, reproduced from the shape the wizard uses.
 *
 * Flagged rather than hidden: this IS a reimplementation, and it is one because the wizard's
 * `slugify` lives behind a `"use client"` module that imports React and cannot be pulled into
 * a Node test without pulling React with it. It is used ONLY to build the expected stub, never
 * to decide whether the CLI is right about anything else, and the cell that asserts the stub
 * says so. If the two ever disagree the divergence is a finding about this line.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* --------------------- writing a folder to disk --------------------- */

export interface FolderOptions {
  /** Which manifest spelling to write, or `undefined` for the absent-manifest path. */
  readonly manifest?: string;
  /** Write `ontology/extensions.yaml` beside the cards. */
  readonly vocabulary?: string;
  /** Name the temp directory, so `ruledManifestStub` has a known input. */
  readonly dirName?: string;
}

const created: string[] = [];

/**
 * Write one bundle into a fresh temp directory in the wizard's accepted layout.
 *
 * `tmpdir()` rather than a path inside the repository: a fixture that writes into the working
 * tree can be committed by accident and shows up in `git status` as though a gate had
 * produced it. Every directory is registered in `created` so `cleanupFolders()` can remove
 * them in an `afterAll`; nothing here removes a directory it did not make.
 */
export function writeBundleFolder(bundle: Bundle, options: FolderOptions = {}): string {
  const base = mkdtempSync(join(tmpdir(), "t270-"));
  created.push(base);

  const root = options.dirName === undefined ? base : join(base, options.dirName);
  mkdirSync(root, { recursive: true });

  writeFileSync(join(root, "topology.dot"), bundle.dot, "utf8");

  for (const [file, text] of Object.entries(bundle.cardFiles)) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }

  if (options.manifest !== undefined) {
    /* Serialised as JSON for the `.json` spelling and as YAML for the other two. A JSON
       document is also valid YAML, so the same bytes would parse either way — but writing
       `{...}` into a file called `blueprint.yaml` would test a tolerance nobody promised
       rather than the spelling the wizard accepts. */
    writeFileSync(join(root, options.manifest), manifestText(bundle.manifest, options.manifest));
  }

  if (options.vocabulary !== undefined) {
    mkdirSync(join(root, "ontology"), { recursive: true });
    writeFileSync(join(root, "ontology", "extensions.yaml"), options.vocabulary, "utf8");
  }

  return root;
}

function manifestText(manifest: BundleManifest, filename: string): string {
  if (filename.toLowerCase().endsWith(".json")) return JSON.stringify(manifest, null, 2);
  return [
    `slug: ${manifest.slug}`,
    `title: ${JSON.stringify(manifest.title)}`,
    `summary: ${JSON.stringify(manifest.summary)}`,
    /* There is no `ontologyVersion` line, because a manifest no longer has that member.
       It used to be written here in camelCase, which was the key BOTH readers accepted, and
       the reason is worth keeping: this fixture once wrote it as `ontology_version`,
       neither reader found it, and every manifest cell silently fell back to the stub — so
       the with-manifest and absent-manifest paths were the SAME test. It was found by a
       prediction MISS (mutating the stub's `ontologyVersion` was predicted to red 1 cell and
       reddened 26), and the lesson survives the field: a cell asserting an explicit value is
       vacuous when the subject's default already equals it. `title` and `summary` are what
       distinguish the two paths now. */
    `tags: [${manifest.tags.map((tag) => JSON.stringify(tag)).join(", ")}]`,
    "",
  ].join("\n");
}

/** Remove every directory this module created, and nothing else. */
export function cleanupFolders(): void {
  while (created.length > 0) {
    const dir = created.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
}
