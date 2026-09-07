#!/usr/bin/env node
/**
 * Brings a registry's `card_version` and `release` rows onto the current card shape: the
 * retired `requires_human` and manifest `ontologyVersion` keys are removed, and each
 * card's single `cannot` list is split into the enforced half (`cannot`, ontology
 * data-type ids) and the stated half (`will_not`, free sentences). A registry seeded
 * before that change holds rows the engine refuses, which empties `/blueprints` and
 * `/nodes` and breaks every download.
 *
 *   npm run migrate:stored-cards -- --expect-db <name>                         dry run
 *   npm run migrate:stored-cards -- --expect-db <name> --write \
 *       --rollback-sql <durable path> --rescore-analysis|--keep-analysis [--yes] [--purge-frozen]
 *   npm run migrate:stored-cards -- --expect-db <name> --check-manifest <path>.manifest.tsv
 *
 * ── Why a script and not a numbered migration ──
 * No SQL can invert this transform (reversing sentences out of `will_not` back into
 * `cannot` is not a function of the post-state), and the migration runner's own tests run
 * against an empty database where a data migration is a green no-op. It is an operator
 * action against one named database, so it says which database it is pointed at.
 *
 * ── Why UPDATEs and not a republish ──
 * No writer offers an update path: `publish()` refuses at `version-not-higher`, a
 * re-import reports every refused card as "already done", and a delete-and-reinsert would
 * change every row id, cascade away the embeddings and enqueue repin notifications.
 * Bypassing the writers means bypassing their guards, so those guards (`loadCard`,
 * `storedCardGaps`, `findWellFormednessIssue`, `parseStoredVocabulary`, `loadBundle` plus
 * `isReleasable`, both digest functions) are called directly on exactly the values about
 * to be written, before the transaction opens.
 *
 * ── Where each new value comes from ──
 * A card whose exact ref has a file under `content/cards/` is re-derived from that file,
 * and the mechanical transform of its stored bytes is the independent cross-check: the two
 * must agree on every field except `notes`, which the same change rewrote where the prose
 * described the retired fields as live. A card `content/` has superseded (a later version
 * of the same id exists) or never carried is transformed in place from its own bytes; a
 * stored release pins it by exact version, so re-deriving from a different version would
 * change the card it names. Every card, whichever path, must conserve its prohibitions:
 * the old `cannot` entries and the new `cannot` plus `will_not` entries are the same set.
 * The totals the post-write battery checks are derived from that plan and from the
 * pre-state row counts, printed before anything is written, and confirmed at a prompt
 * unless `--yes` is passed.
 *
 * ── The independent oracle ──
 * `public/bundles/<slug>/README.md` is generated from `content/` by `prebuild` and prints
 * the release digest, so for a release whose every card is archive-backed the computed
 * digest must equal it. A release pinning a superseded card describes an older card set
 * than the README and is reported as not comparable rather than compared.
 *
 * ── Running it against production ──
 * NOT VERIFIED AGAINST PRODUCTION. The dry run has been exercised against the local
 * database and against a copy of it reverted to the pre-migration shape; no connection to
 * the production database was made from this checkout. What is known of production: its
 * rows are in the old shape, it holds 57 cards and 9 releases, and eight of its refs have
 * since been superseded under `content/` by a version bump, which is the case the
 * superseded path exists for.
 *
 *  1. Read the census first: `npm run preflight:db -- <direct url>`. Unmigrated means
 *     "bodies with requiresHuman" equals "cards" and "bodies with willNot" is 0.
 *  2. Use a DIRECT or session-mode connection (Supabase: db.<ref>.supabase.co:5432), never
 *     the transaction pooler on port 6543: the run is one transaction of prepared
 *     statements. Keep the credential in a file outside the tree and source it there.
 *     `--expect-db` guards against the local `.env.example` overwriting `DATABASE_URL`;
 *     against a hosted target every database is called `postgres`, so READ THE
 *     `database host=` LINE this script prints and match it to the confirmed project.
 *  3. Take a whole-database plain-SQL dump (`pg_dump "$URL" --no-owner --no-privileges -f
 *     pre.sql`), restore it into a throwaway to prove the file restores, then prove it is
 *     the PRE state: `grep -c requiresHuman pre.sql` > 0 and `grep -c willNot pre.sql` == 0.
 *     A dump taken after the run restores exactly what you were trying to undo.
 *  4. Dry run. Read the `database host=` line, the per-card classification (archive,
 *     superseded, database-only), the notes that differ from the archive, the derived
 *     totals, and the per-release `old -> new` list with its `(matches README)` marks.
 *  5. Block `POST /api/bundles` and the fork route for the window: a publish landing
 *     between the run and the deploy writes a row in the old shape that the rollback file
 *     has never heard of.
 *  6. Write, with `--rollback-sql` on durable storage and exactly one of
 *     `--rescore-analysis` (rewrite autonomy/security/phase_coverage from the same
 *     `loadBundle`, so the registry agrees with the README) or `--keep-analysis`. Pass
 *     `--purge-frozen` unless the production bucket is known to hold nothing at the new
 *     digests: a download answers from a frozen object before it rebuilds one.
 *  7. Apply the rollback to a copy and read the manifest back green with `--check-manifest`
 *     before trusting it. After the write, every release digest has changed, so every
 *     `/d/<digest>` address recorded before the run now 404s; the embeddings are keyed by
 *     row id and re-embedding is a separate step.
 *
 * ── Running TypeScript ──
 * Node strips the types. The `@/` alias and the extensionless relative imports the engine
 * uses are not resolved by Node's ESM resolver, so the hook below is installed first and
 * every `lib/` import in this file is dynamic.
 */

/* Type-only, so Node's type stripping erases them and no runtime import is evaluated ahead
   of the resolver hook below. `verbatimModuleSyntax` is off and `isolatedModules` is on, so
   the `type` keyword is what makes that erasure explicit rather than inferred. */
import type { BundleManifest, CardRef, Diagnostic, NodeCard, OntologyTerm } from "@/lib/core";
import type { Db } from "@/lib/db";
import type { ExpectedTotals, StoredRefOrigin } from "./stored-card-migration.ts";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

/* --------------------- module resolution --------------------- */

/**
 * `module.registerHooks` (Node ≥22.15) is not declared by the @types/node this repository
 * pins. Declared locally rather than cast at the call site, so the hook body is still
 * type-checked against the shape Node documents.
 */
interface ResolveContext {
  readonly conditions?: readonly string[];
  readonly importAttributes?: Record<string, string>;
  readonly parentURL?: string;
}
interface ResolveOutcome {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}
type NextResolve = (specifier: string, context?: ResolveContext) => ResolveOutcome;
type ResolveHook = (specifier: string, context: ResolveContext, nextResolve: NextResolve) => ResolveOutcome;

/** The floor `package.json` declares and `.nvmrc` names, quoted in the failure below. */
const REQUIRED_NODE = "22.18.0";

const { registerHooks } = nodeModule as unknown as {
  registerHooks?: (hooks: { resolve?: ResolveHook }) => void;
};

if (typeof registerHooks !== "function") {
  throw new Error(
    [
      `DarkPrint needs Node ${REQUIRED_NODE} or newer to run this script. This is ${process.version}.`,
      "",
      "It resolves the app's `@/…` imports through `module.registerHooks`, which arrived in",
      "Node 22.15, and it is TypeScript, which Node strips from 22.18 on.",
      "",
      "package.json declares the floor in `engines.node` and .nvmrc names it: `nvm use` picks it up.",
    ].join("\n"),
  );
}

/** Repo root: this file sits in `scripts/`. */
const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Extensions tried, in order, for a specifier that names no file. */
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

/** The file a bare path names: itself, itself plus an extension, or its `index`. */
function fileFor(base: string): string | undefined {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) {
    if (existsSync(base + extension)) return base + extension;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of EXTENSIONS) {
      const index = join(base, `index${extension}`);
      if (existsSync(index)) return index;
    }
  }
  return undefined;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target: string | undefined;
    if (specifier.startsWith("@/")) {
      target = resolve(ROOT, specifier.slice(2));
    } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:") === true) {
      target = resolve(dirname(fileURLToPath(context.parentURL)), specifier);
    }
    if (target !== undefined) {
      const hit = fileFor(target);
      if (hit !== undefined) return { url: pathToFileURL(hit).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/* --------------------- the imports, once the hook is in place --------------------- */

const { eq } = await import("drizzle-orm");
const { createDbClient, createObjectStorage, objectStorageConfigFromEnv, schema } = await import("@/lib/db");
const { bundleDigest, canonicalJson, cardDigest, isReleasable, loadBundle, loadCard } = await import("@/lib/core");
const { contentOntology, contentVocabulary, readContent } = await import("@/lib/content/read");
const { cardFilePath } = await import("@/lib/content/bundle-export");
const { storedCardGaps } = await import("@/lib/server/cards/stored-card");
const { findWellFormednessIssue } = await import("@/lib/server/cards/well-formed");
const { parseStoredVocabulary } = await import("@/lib/server/archive");
const { openView } = await import("@/lib/server/ontology");
const {
  SMOKE_CHECKER_EXPECTED,
  SMOKE_CHECKER_REF,
  CARD_FIELDS,
  classifyStoredRef,
  dollarQuoted,
  expectedTotalsFrom,
  jsonbLiteral,
  migrateCardBody,
  migrateCardSource,
  prohibitionsConserved,
  refOf,
  textArrayLiteral,
} = await import("./stored-card-migration.ts");

/**
 * What the acceptance battery needs from a handle, and nothing more.
 *
 * `db.transaction` hands the callback a `PgTransaction`, not a `Db`, and the battery has to
 * run on it: a read issued on `db` inside the callback opens a SECOND pooled connection that
 * cannot see the uncommitted writes. Narrowing to the one method used keeps both handles
 * assignable without a cast that would also hide a genuine mismatch.
 */
type Reader = Pick<Db, "select">;

/* --------------------- arguments --------------------- */

/**
 * Every flag this script accepts. An argument outside this set is a refusal rather than
 * something ignored: a mistyped `--rescore-analyis` that silently fell through would leave
 * the run without the choice the write requires, and the operator would never see it.
 */
const KNOWN_FLAGS = new Set([
  "--plan",
  "--write",
  "--yes",
  "--expect-db",
  "--rollback-sql",
  "--rescore-analysis",
  "--keep-analysis",
  "--purge-frozen",
  "--check-manifest",
]);

const argv = process.argv.slice(2);

function valueOf(flag: string): string | undefined {
  const at = argv.indexOf(flag);
  if (at === -1) return undefined;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value.`);
  return value;
}

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i] as string;
  if (!arg.startsWith("--")) continue;
  if (!KNOWN_FLAGS.has(arg)) throw new Error(`Unknown flag ${arg}. Accepted: ${[...KNOWN_FLAGS].join(" ")}`);
  if (arg === "--expect-db" || arg === "--rollback-sql") i++;
}

/* A real write takes an explicit `--write`, and `--plan` is accepted as the spelling
   `scripts/import-seed.ts` established for the same thing. The DEFAULT is the dry run: a
   migration that writes when it is invoked with no flags is one keystroke from being run
   by somebody reading the help. */
const write = argv.includes("--write");
/* Skips the confirmation prompt that precedes a write; the derived totals are still printed. */
const yes = argv.includes("--yes");
const expectDb = valueOf("--expect-db");
const rollbackPath = valueOf("--rollback-sql");
const rescore = argv.includes("--rescore-analysis");
const keepAnalysis = argv.includes("--keep-analysis");
const purgeFrozen = argv.includes("--purge-frozen");
const checkManifestPath = valueOf("--check-manifest");

if (expectDb === undefined) {
  throw new Error(
    [
      "--expect-db <name> is required.",
      "",
      "`.env.example:6` names the REAL database, and this repository's own idiom",
      "`set -a; . ./.env.example; set +a` OVERWRITES any DATABASE_URL exported before it, so",
      "the natural way to point a dry run at a copy points it at production instead, and",
      "a byte-identical TEMPLATE clone prints an identical plan either way. Name the database",
      "you believe you are pointed at and this script will refuse if you are not.",
    ].join("\n"),
  );
}

if (checkManifestPath !== undefined && (write || rollbackPath !== undefined || rescore || keepAnalysis || purgeFrozen)) {
  throw new Error("--check-manifest is its own mode: it reads a manifest and compares it to the database, and writes nothing.");
}

if (write) {
  if (rollbackPath === undefined) throw new Error("--write needs --rollback-sql <path>: nothing is written without a rollback file.");
  if (rescore === keepAnalysis) {
    throw new Error(
      [
        "--write needs exactly one of --rescore-analysis or --keep-analysis, and neither is the default.",
        "",
        "A stored `release.autonomy` can disagree with the archive's own scorer for the same content,",
        "and after this run one digest addresses both the row and the committed README, so the",
        "disagreement would be invisible to every digest check.",
        "",
        "  --rescore-analysis  write autonomy/security/phase_coverage from the same loadBundle this",
        "                      script already runs, so the registry and the site agree. Changes no digest.",
        "  --keep-analysis     leave all three columns alone. Any disagreement becomes permanent.",
      ].join("\n"),
    );
  }
} else if (rescore || keepAnalysis || purgeFrozen || yes || rollbackPath !== undefined) {
  throw new Error("--rescore-analysis, --keep-analysis, --purge-frozen, --yes and --rollback-sql only apply to --write.");
}

/* --------------------- Phase A, step 0: the tree and the target --------------------- */

if (!existsSync(join(process.cwd(), "content"))) {
  throw new Error(
    `No \`content/\` directory under ${process.cwd()}. Run this from the repository root: the archive reader resolves \`content/\` against the working directory and memoizes the result (D-250-01).`,
  );
}

/* The 57 archive-backed cards are re-derived from `content/`, so `content/` IS the input to
   this migration. An uncommitted edit there would be written into the registry with no
   record of what was written: the mechanical cross-check below cannot see an edit to the
   `notes` of the five cards it already expects to differ, and `public/bundles` is not an
   independent witness either, since `prebuild` regenerates it from the same files. */
const dirty = execFileSync("git", ["status", "--porcelain", "--", "content", "public/bundles"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (dirty.trim() !== "") {
  throw new Error(
    ["`content/` or `public/bundles/` has uncommitted changes. Commit or stash them first:", "", dirty.trimEnd()].join("\n"),
  );
}
const headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
const target = new URL(databaseUrl);
const targetDb = decodeURIComponent(target.pathname.replace(/^\//, ""));

console.log(`tree      ${headSha}  (content/ and public/bundles/ clean)`);
console.log(`database  host=${target.hostname} port=${target.port || "5432"} database=${targetDb}`);
console.log(`mode      ${write ? `WRITE (${rescore ? "--rescore-analysis" : "--keep-analysis"})` : "dry run, nothing will be written"}`);

if (targetDb !== expectDb) {
  throw new Error(`DATABASE_URL names database "${targetDb}", and --expect-db says "${expectDb}". Refusing.`);
}

/* --------------------- Phase A, step 1: the archive --------------------- */

/* Throws on any error-severity diagnostic anywhere under `content/`, and checks the version
   bump rule over the whole card library on the way, so a multi-version card arrives at the
   write already checked. */
const archive = readContent();
const ontology = contentOntology();
const archiveVocabulary = contentVocabulary();
console.log(`archive   ${archive.length} blueprints, ontology ${ontology.ontology.title}`);

const CARDS_DIR = join(process.cwd(), "content", "cards");
/** Every `id@version` the archive carries a file for. */
const ARCHIVE_REFS: ReadonlySet<string> = new Set(
  readdirSync(CARDS_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => file.slice(0, -".yaml".length)),
);
const errorsIn = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] => diagnostics.filter((d) => d.severity === "error");

/* --------------------- the plan --------------------- */

interface CardPlan {
  rowId: string;
  ref: string;
  cardId: string;
  version: string;
  oldSource: string;
  oldBody: unknown;
  oldDigest: string;
  newSource: string;
  newBody: NodeCard;
  newDigest: string;
  /** Whether the new bytes came from `content/cards/<ref>.yaml` or from the row's own bytes. */
  origin: StoredRefOrigin;
}

interface ReleasePlan {
  rowId: string;
  slug: string;
  handle: string;
  oldDigest: string;
  oldManifest: Record<string, unknown>;
  oldCardDigests: string[];
  oldVocabulary: unknown;
  oldAnalysis: { autonomy: unknown; security: unknown; phaseCoverage: unknown };
  dot: string;
  cardRefs: string[];
  newManifest: Record<string, unknown>;
  newCardDigests: string[];
  newVocabulary: unknown;
  newDigest: string;
  newAnalysis: { autonomy: unknown; security: unknown; phaseCoverage: unknown };
}

const client = createDbClient(databaseUrl);

try {
  await main();
} finally {
  await client.close();
}

async function main(): Promise<void> {
  const db = client.db;

  /* `--check-manifest` is the rollback drill's second half and touches nothing else: it
     reads a manifest written before a run and says whether these rows still hold those
     bytes. It runs before Phase A because it has no use for a plan. It still pays for the
     clean-tree check and `readContent()` above, which run at module scope; that is
     conservative rather than necessary for a read-back, and it keeps one answer to "may
     this script run here" instead of two. */
  if (checkManifestPath !== undefined) {
    await checkManifest(db, checkManifestPath);
    return;
  }

  /* ---- Phase A, step 2: the card rows ---- */

  const cardRows = (await db.select().from(schema.cardVersion)).sort((a, b) =>
    refOf(a.cardId, a.version) < refOf(b.cardId, b.version) ? -1 : 1,
  );
  console.log(`rows      ${cardRows.length} card_version`);

  const cards: CardPlan[] = [];
  const notesDiverged: string[] = [];
  const otherDiverged: string[] = [];

  for (const row of cardRows) {
    const ref = refOf(row.cardId, row.version);

    /* The stored digest must describe the stored body BEFORE anything is changed. If the
       store has pre-existing drift, this migration would silently repair or silently
       deepen it under cover of a rewrite, and nobody could tell afterwards which. */
    if (digestOfStored(row.body) !== row.digest) {
      throw new Error(`${ref}: the stored digest does not describe the stored body. This store has pre-existing drift; stop and look at it.`);
    }

    const origin = classifyStoredRef(ref, ARCHIVE_REFS);
    let newSource: string;
    let newBody: NodeCard;

    if (origin === "archive") {
      /* ---- step 3a: re-derive from the archive ---- */
      const from = `content/cards/${ref}.yaml`;
      newSource = readFileSync(join(CARDS_DIR, `${ref}.yaml`), "utf8");
      const loaded = loadCard(newSource, { ontology, format: "yaml", file: from });
      if (loaded.card === undefined || errorsIn(loaded.diagnostics).length > 0) {
        throw new Error(`${from} does not load: ${errorsIn(loaded.diagnostics).map((d) => d.code).join(", ") || "no card"}`);
      }
      newBody = loaded.card;

      /* ---- step 4: the mechanical cross-check ----
         Re-derivation takes whatever `content/` holds, so on its own it is an unverified
         copy. The mechanical transform is the second, independent derivation: strip the two
         retired keys, split `cannot`. Where the two agree, the archive is provably the
         stored card brought forward and nothing else. A disagreement in `notes` is reported
         for the operator to confirm; one in any other field stops the run. */
      const mechanicalBody = migrateCardBody(ref, row.body, ontology);
      const mechanicalSource = migrateCardSource(ref, row.source, ontology);
      const viaSource = loadCard(mechanicalSource, { ontology, format: "yaml" }).card;
      if (viaSource === undefined) throw new Error(`${ref}: the mechanically transformed source does not load.`);
      for (const field of CARD_FIELDS) {
        const fromSource = canonicalJson(fieldOf(viaSource, field) ?? null);
        const fromBody = canonicalJson(fieldOf(mechanicalBody, field) ?? null);
        if (fromSource !== fromBody) {
          throw new Error(`${ref}: the two halves of the mechanical transform disagree on \`${String(field)}\`.`);
        }
      }
      for (const field of CARD_FIELDS) {
        if (canonicalJson(fieldOf(mechanicalBody, field) ?? null) === canonicalJson(fieldOf(newBody, field) ?? null)) continue;
        (field === "notes" ? notesDiverged : otherDiverged).push(`${ref}.${String(field)}`);
      }
    } else {
      /* ---- step 3b: a ref the archive has superseded or never carried ----
         Transformed in place from its own bytes: a stored release pins this exact version,
         so re-deriving from the archive's later version would change the card it names. */
      newSource = migrateCardSource(ref, row.source, ontology);
      const loaded = loadCard(newSource, { ontology, format: "yaml" });
      /* Zero diagnostics of ANY severity, not merely zero errors: a card with no archive
         file to be checked against has to clear the higher bar. */
      if (loaded.card === undefined || loaded.diagnostics.length > 0) {
        throw new Error(`${ref}: the migrated source did not load cleanly (${loaded.diagnostics.length} diagnostics).`);
      }
      newBody = loaded.card;
    }

    /* ---- step 5: nothing dropped ----
       Every digest and shape check below is satisfied equally by a transform that deleted
       the prose sentences and by one that moved them; this is the check that tells them
       apart, and it holds for every card whichever path produced it. */
    if (!prohibitionsConserved(row.body, newBody)) {
      throw new Error(`${ref}: the old \`cannot\` entries and the new \`cannot\` plus \`will_not\` entries are not the same set. Something was dropped or reworded.`);
    }

    /* ---- step 7: the writers' own guards, on the values about to be written ---- */
    const gaps = storedCardGaps(newBody);
    if (gaps.length > 0) throw new Error(`${ref}: the migrated body is not a readable card. ${gaps.join("; ")}`);
    const issue = findWellFormednessIssue(newSource, newBody);
    if (issue !== undefined) throw new Error(`${ref}: an unpaired UTF-16 surrogate at ${issue.path}; \`pg\` would rewrite it to U+FFFD.`);

    const newDigest = cardDigest(newBody);
    if (newDigest === row.digest) throw new Error(`${ref}: the migrated card hashes to the digest already stored. Nothing changed, which cannot be right for this corpus.`);

    cards.push({
      rowId: row.id,
      ref,
      cardId: row.cardId,
      version: row.version,
      oldSource: row.source,
      oldBody: row.body,
      oldDigest: row.digest,
      newSource,
      newBody,
      newDigest,
      origin,
    });
  }

  if (otherDiverged.length > 0) {
    throw new Error(
      [
        "The archive and the mechanical transform disagree outside `notes`:",
        ...otherDiverged.map((d) => `  ${d}`),
        "",
        "The migration re-derives from content/, so this says content/ carries an edit beyond the",
        "shape change. Establish what it is before writing it into the registry.",
      ].join("\n"),
    );
  }
  /* Printed with the plan and confirmed at the prompt: the shape change rewrote the notes
     of the cards whose prose described the retired fields as live, and an operator can tell
     that set from an unrelated edit; this script cannot. */
  const notesRefs = [...new Set(notesDiverged.map((d) => d.replace(/\.notes$/, "")))].sort();

  /* ---- step 6: the pinned values for the development registry's database-only card ---- */
  const smoke = cards.find((c) => c.ref === SMOKE_CHECKER_REF);
  if (smoke !== undefined) {
    if (smoke.newDigest !== SMOKE_CHECKER_EXPECTED.cardDigest) {
      throw new Error(`${SMOKE_CHECKER_REF}: migrated card digest is ${smoke.newDigest}, expected ${SMOKE_CHECKER_EXPECTED.cardDigest}.`);
    }
    if (smoke.newBody.cannot.length !== SMOKE_CHECKER_EXPECTED.cannotEntries || smoke.newBody.willNot.length !== SMOKE_CHECKER_EXPECTED.willNotEntries) {
      throw new Error(`${SMOKE_CHECKER_REF}: expected ${SMOKE_CHECKER_EXPECTED.cannotEntries} cannot / ${SMOKE_CHECKER_EXPECTED.willNotEntries} willNot entries.`);
    }
  }

  const newCardDigest = new Map(cards.map((c) => [c.ref, c.newDigest]));

  /* ---- Phase A, step 8: the release rows ---- */

  const releaseRows = await db.select().from(schema.release);
  const bundleRows = await db.select().from(schema.bundle);
  const accountRows = await db.select().from(schema.account);
  const slugOf = new Map(bundleRows.map((b) => [b.id, b.slug]));
  const handleOf = new Map(bundleRows.map((b) => [b.id, accountRows.find((a) => a.id === b.ownerId)?.handle ?? "?"]));
  console.log(`rows      ${releaseRows.length} release, ${bundleRows.length} bundle`);

  const releases: ReleasePlan[] = [];

  for (const row of releaseRows) {
    const slug = slugOf.get(row.bundleId) ?? "?";
    const handle = handleOf.get(row.bundleId) ?? "?";
    const label = `${handle}/${slug}@${row.version}`;

    const storedCardDigests = row.cardDigests as string[];
    const cardRefs = row.cardRefs as string[];
    if (cardRefs.length !== storedCardDigests.length) throw new Error(`${label}: card_refs and card_digests disagree in length.`);
    if (bundleDigest({ dot: row.dot, cardDigests: storedCardDigests }) !== row.digest) {
      throw new Error(`${label}: the stored release digest does not describe its own columns. Pre-existing drift; stop and look at it.`);
    }

    /* `dot` is already correct: all 15 archive-backed values are byte-identical to
       `content/blueprints/<slug>/topology.dot`, and this migration has no business
       rewriting a DOT source. Asserted rather than assumed. */
    const dotFile = join(process.cwd(), "content", "blueprints", slug, "topology.dot");
    if (existsSync(dotFile) && readFileSync(dotFile, "utf8") !== row.dot) {
      throw new Error(`${label}: release.dot differs from content/blueprints/${slug}/topology.dot. That is not this migration's to change.`);
    }

    /* Membership BEFORE the map. `bundleDigest` accepts an `undefined` hole without
       throwing: `Array.prototype.sort` moves it to the end without calling the comparator
       and `canonicalJson` nulls it inside an array, so a ref that failed to migrate would
       produce a plausible, self-consistent, wrong digest one step before the check that
       would have caught it. Measured, not feared. */
    const missing = cardRefs.filter((ref) => !newCardDigest.has(ref));
    if (missing.length > 0) throw new Error(`${label}: pins ${missing.length} card(s) with no migrated row: ${missing.join(", ")}`);
    /* Stored order, duplicates kept, nothing sorted and nothing deduplicated. `addRelease`
       sorts its own COPY for the identity computation, so the column's order does not
       affect the digest — but `buildExport` deduplicates `cardRefs` in stored order to
       gather the card documents, so re-sorting here would store a correct-looking digest
       over an array the engine never emitted. */
    const newCardDigests = cardRefs.map((ref) => newCardDigest.get(ref) as string);
    if (!newCardDigests.every((d) => /^sha256:[0-9a-f]{64}$/.test(d))) throw new Error(`${label}: a computed card digest is not a digest.`);

    const oldManifest = row.manifest as Record<string, unknown>;
    const newManifest = { ...oldManifest };
    /* D-93 removed `ontologyVersion` from `BundleManifest`, and only from there: the same
       name is CURRENT and load-bearing inside `release.autonomy` and `release.security`,
       where it records the vocabulary a stored scorecard was computed under. Targeted by
       name for that reason; a blanket sweep over every jsonb column would destroy it. */
    delete newManifest.ontologyVersion;
    delete newManifest.ontology_version;

    /* `local_vocabulary.text` is the third copy of the card shape, after `body` and
       `source`, and it is guarded by nothing: `exportBundle` writes it into the download
       VERBATIM. Measured: all 15 stored `terms` match the archive's, and 0 of 15 `text`
       values do — the stored header paragraph still documents the D-92-retired
       `ontology_version` as live. The key is moving anyway, so the folder is re-frozen from
       the row, and a row left alone would put a stale document into every future download. */
    const storedVocabulary = parseStoredVocabulary(row.localVocabulary ?? undefined, `release ${label}`);
    let newVocabulary: unknown = row.localVocabulary ?? null;
    if (storedVocabulary !== undefined) {
      if (archiveVocabulary === undefined) throw new Error(`${label}: carries a local vocabulary and content/ has none to check it against.`);
      if (canonicalJson(storedVocabulary.terms) !== canonicalJson(archiveVocabulary.terms)) {
        throw new Error(`${label}: local_vocabulary.terms differs from content/ontology/extensions.yaml. Only the prose header was expected to differ.`);
      }
      newVocabulary = { text: archiveVocabulary.text, terms: storedVocabulary.terms };
    }

    const newDigest = bundleDigest({ dot: row.dot, cardDigests: newCardDigests });

    /* ---- step 10: the release must resolve from its own migrated bytes ---- */
    const vocabularyForView = parseStoredVocabulary(newVocabulary ?? undefined, `release ${label}`);
    const view = openView(vocabularyForView?.terms);
    const cardFiles: Record<string, string> = {};
    for (const ref of cardRefs) {
      const card = cards.find((c) => c.ref === ref) as CardPlan;
      cardFiles[cardFilePath(ref as CardRef)] = card.newSource;
    }
    const loaded = loadBundle({ manifest: newManifest as unknown as BundleManifest, dot: row.dot, cardFiles }, { ontology: view });
    if (loaded.blueprint === undefined || loaded.analysis === undefined) throw new Error(`${label}: does not resolve after migration.`);
    if (!isReleasable(loaded.diagnostics)) {
      throw new Error(`${label}: resolves but is not releasable. ${errorsIn(loaded.diagnostics).map((d) => d.code).join(", ")}`);
    }
    /* Internal consistency only. It is FALSE if `source` and `body` came apart, and it is
       equally true of a transform that deleted the prose instead of moving it, which is why
       the archive-derived digests below and the entry counts in the report are the checks
       that actually decide correctness. */
    if (loaded.blueprint.digest !== newDigest) throw new Error(`${label}: the engine's digest and the computed digest disagree.`);

    releases.push({
      rowId: row.id,
      slug,
      handle,
      oldDigest: row.digest,
      oldManifest,
      oldCardDigests: storedCardDigests,
      oldVocabulary: row.localVocabulary ?? null,
      oldAnalysis: { autonomy: row.autonomy ?? null, security: row.security ?? null, phaseCoverage: row.phaseCoverage ?? null },
      dot: row.dot,
      cardRefs,
      newManifest,
      newCardDigests,
      newVocabulary,
      newDigest,
      newAnalysis: {
        autonomy: loaded.analysis.autonomy,
        security: loaded.analysis.security,
        phaseCoverage: loaded.analysis.phaseCoverage,
      },
    });
  }

  /* ---- step 11: the digests the site already publishes ----
     The committed README is generated from `content/`, so it can only vouch for a release
     whose every pinned card is the archive's own; a release pinning a superseded card
     describes an older card set than the README and is reported, not compared. */
  const published = publishedDigests();
  const originOf = new Map(cards.map((c) => [c.ref, c.origin]));
  const comparable = (r: ReleasePlan): boolean => published.has(r.slug) && r.cardRefs.every((ref) => originOf.get(ref) === "archive");
  const wrong = releases.filter((r) => comparable(r) && published.get(r.slug) !== r.newDigest);
  if (wrong.length > 0) {
    throw new Error(
      [
        "A computed release digest disagrees with the digest its committed README already prints:",
        ...wrong.map((r) => `  ${r.handle}/${r.slug}  computed ${r.newDigest}  README ${published.get(r.slug)}`),
      ].join("\n"),
    );
  }
  const comparableSlugs = new Set(releases.filter(comparable).map((r) => r.slug));

  /* ---- the plan and the derived totals, printed ---- */
  const byOrigin = (origin: StoredRefOrigin): CardPlan[] => cards.filter((c) => c.origin === origin);
  const expected = expectedTotalsFrom(cards, releases.length);
  const controls = await controlsOf(db);
  console.log("");
  console.log(`plan      ${cards.length} card_version rows, ${releases.length} release rows`);
  console.log(`          ${byOrigin("archive").length} cards re-derived from content/`);
  const superseded = byOrigin("superseded");
  console.log(`          ${superseded.length} superseded by a later version under content/, transformed in place${superseded.length > 0 ? `: ${superseded.map((c) => c.ref).join(", ")}` : ""}`);
  const databaseOnly = byOrigin("database-only");
  console.log(`          ${databaseOnly.length} with no version under content/, transformed in place${databaseOnly.length > 0 ? `: ${databaseOnly.map((c) => c.ref).join(", ")}` : ""}`);
  console.log(`          notes differing from the archive (confirm these are the shape change's rewrites): ${notesRefs.join(", ") || "(none)"}`);
  console.log("");
  console.log("totals    derived from this target and the plan, held to after the write:");
  console.log(`          ${expected.cardVersions} card_version rows, ${expected.releases} release rows`);
  console.log(`          ${expected.cannotEntries} \`cannot\` entries and ${expected.willNotEntries} \`will_not\` entries across all cards`);
  console.log(`          controls that must not move: ${Object.entries(controls).map(([name, n]) => `${name} ${n}`).join(", ")}`);
  console.log("");
  for (const r of [...releases].sort((a, b) => (`${a.handle}/${a.slug}` < `${b.handle}/${b.slug}` ? -1 : 1))) {
    const mark = !published.has(r.slug)
      ? "(no published README)"
      : comparableSlugs.has(r.slug)
        ? "(matches README)"
        : "(README describes a newer card set; not compared)";
    console.log(`          ${`${r.handle}/${r.slug}`.padEnd(38)} ${shortOf(r.oldDigest)} -> ${shortOf(r.newDigest)}  ${mark}`);
  }

  console.log("");
  console.log("before:");
  report(await check(db, "before", expected, controls, comparableSlugs));

  if (write && !yes) await confirmOrAbort();

  /* ---- step 12: the rollback file ---- */
  if (write) {
    const path = rollbackPath as string;
    /* No --force, and a timestamped default is the operator's to pass. A second run against
       an already-migrated database would regenerate this file FROM THE POST-STATE, and
       applying it would then restore the migrated values — leaving the pre-migration bytes
       nowhere. Re-running is the single most likely thing a tired operator does. */
    if (existsSync(path)) throw new Error(`${path} already exists. Refusing to overwrite the only rollback there is.`);
    /* A warning rather than a refusal, because a dry run against a scratch copy is a
       legitimate reason to put one here. macOS sweeps `/private/tmp` periodically and a
       session scratchpad is deleted with the session, so a rollback found missing a week
       later is indistinguishable from one that was never taken. */
    if (path.startsWith("/tmp/") || path.startsWith("/private/tmp/") || path.startsWith("/var/folders/")) {
      console.log("");
      console.log(`WARNING   ${path} is under a temporary directory the operating system sweeps.`);
      console.log("          For a run you would ever need to undo, put the rollback somewhere durable.");
    }
    writeFileSync(path, rollbackSql(cards, releases, headSha, targetDb), "utf8");

    /* "Could write" is not "wrote completely": a full disk satisfies the first. Re-read from
       disk and count what is actually there before anything becomes unrecoverable. */
    const readBack = readFileSync(path, "utf8");
    const cardStatements = (readBack.match(/^UPDATE card_version /gm) ?? []).length;
    const releaseStatements = (readBack.match(/^UPDATE release /gm) ?? []).length;
    if (cardStatements !== cards.length || releaseStatements !== releases.length || !readBack.trimEnd().endsWith("COMMIT;")) {
      throw new Error(`${path} is incomplete: ${cardStatements}/${cards.length} card and ${releaseStatements}/${releases.length} release statements, COMMIT ${readBack.trimEnd().endsWith("COMMIT;") ? "present" : "MISSING"}.`);
    }
    /* The manifest of the PRE-migration bytes, written beside the rollback and before the
       transaction opens. Together they are the whole recovery kit: one restores, the other
       says whether the restore worked. The count above is the weaker half of the pair, and
       deliberately so — it proves the file is COMPLETE, never that it is CORRECT. Measured:
       replacing the dollar-quoting with naive `'…'` literals still produces a file with 58
       and 16 statements and a trailing COMMIT, and psql refuses it at the first source
       containing an apostrophe. Only the drill below can tell those apart. */
    const manifestPath = `${path}.manifest.tsv`;
    if (existsSync(manifestPath)) throw new Error(`${manifestPath} already exists. Refusing to overwrite the manifest of the pre-migration bytes.`);
    writeFileSync(manifestPath, await hashManifest(db), "utf8");
    const manifestRows = readFileSync(manifestPath, "utf8").split("\n").filter((l) => l !== "" && !l.startsWith("#")).length;
    if (manifestRows !== cards.length + releases.length) {
      throw new Error(`${manifestPath} is incomplete: ${manifestRows} rows, expected ${cards.length + releases.length}.`);
    }

    console.log("");
    console.log(`rollback  ${path}  (${readBack.length} bytes, ${cardStatements} + ${releaseStatements} statements)`);
    console.log(`          apply with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${path}`);
    console.log(`manifest  ${manifestPath}  (${manifestRows} rows, hashes of the bytes as they stand now)`);
    console.log("          This rollback is unproven until it has been applied to a TEMPLATE copy and");
    console.log("          the manifest read back green. On the copy, after applying the file:");
    console.log(`            npm run migrate:stored-cards -- --expect-db <copy> --check-manifest ${manifestPath}`);
  }

  if (!write) {
    console.log("");
    console.log("dry run: nothing written. Pass --write with --rollback-sql and one of --rescore-analysis / --keep-analysis.");
    return;
  }

  /* ---- Phase B: one transaction, every statement on `tx` ---- */

  await db.transaction(async (tx) => {
    for (const card of cards) {
      await tx
        .update(schema.cardVersion)
        .set({ body: card.newBody, source: card.newSource, digest: card.newDigest })
        .where(eq(schema.cardVersion.id, card.rowId));
    }
    for (const release of releases) {
      /* Keyed by `release.id`. Six digests are each held by TWO rows — a `darkprint`
         original and an `alessandro` copy of the same content — so a digest-keyed statement
         would rewrite two owners' rows at once. */
      const patch: Record<string, unknown> = {
        manifest: release.newManifest,
        cardDigests: release.newCardDigests,
        digest: release.newDigest,
        localVocabulary: release.newVocabulary,
      };
      if (rescore) {
        patch.autonomy = release.newAnalysis.autonomy;
        patch.security = release.newAnalysis.security;
        patch.phaseCoverage = release.newAnalysis.phaseCoverage;
      }
      await tx.update(schema.release).set(patch).where(eq(schema.release.id, release.rowId));
    }

    /* Re-read on `tx`, never on `db`. A read issued on `db` inside this callback takes a
       SECOND pooled connection which cannot see these uncommitted writes, would report the
       pre-migration values, and would conclude the write never happened — the hazard
       `lib/server/publish/publish.ts:262-266` hoists its own lineage read out of the
       transaction to avoid. A failure here throws and rolls the whole thing back. */
    const inside = await check(tx, "after", expected, controls, comparableSlugs);
    const failed = inside.filter((c) => !c.ok);
    if (failed.length > 0) {
      console.log("");
      console.log("inside the transaction, before commit:");
      report(inside);
      throw new Error(`${failed.length} invariant(s) failed inside the transaction. Rolled back; nothing was written.`);
    }
  });

  console.log("");
  console.log("committed.");

  /* ---- Phase C: verify the committed rows, from a fresh read ---- */

  console.log("");
  console.log("after:");
  const after = await check(db, "after", expected, controls, comparableSlugs);
  report(after);

  await reportFrozen(releases);

  const failed = after.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.log("");
    console.log(`${failed.length} invariant(s) FAILED after the commit. The rollback file is the way back:`);
    console.log(`  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${rollbackPath}`);
    process.exitCode = 1;
  }
}

/* --------------------- the acceptance battery --------------------- */

interface Reading {
  name: string;
  got: string;
  want: string;
  ok: boolean;
}

/** Row counts of the tables this migration never touches, read before the write so the battery can hold them still. */
type Controls = Record<string, number>;

async function controlsOf(db: Reader): Promise<Controls> {
  return {
    bundle: (await db.select({ id: schema.bundle.id }).from(schema.bundle)).length,
    account: (await db.select({ id: schema.account.id }).from(schema.account)).length,
    release_embedding: (await db.select({ id: schema.releaseEmbedding.releaseId }).from(schema.releaseEmbedding)).length,
    card_version_embedding: (await db.select({ id: schema.cardVersionEmbedding.cardVersionId }).from(schema.cardVersionEmbedding)).length,
    run_report: (await db.select({ id: schema.runReport.id }).from(schema.runReport)).length,
    notification_queue: (await db.select({ id: schema.notificationQueue.id }).from(schema.notificationQueue)).length,
  };
}

/** Stops the run unless the operator answers `y` at the terminal; a non-interactive run needs `--yes`. */
async function confirmOrAbort(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error("Refusing to write without confirmation: stdin is not a terminal. Re-run with --yes after reading the plan above.");
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await prompt.question("Write these rows with the totals above? [y/N] ")).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") throw new Error("Aborted at the prompt; nothing was written.");
  } finally {
    prompt.close();
  }
}

/**
 * Every invariant, read from the database rather than from the plan.
 *
 * Run three times: before the write (where most of them fail, which is the damage this
 * migration exists to repair), inside the transaction before the commit, and after it from
 * a fresh read. The two entry counts are the load-bearing ones: a migration that deleted the
 * prose sentences instead of moving them satisfies every shape check and every digest
 * check, and its digests are perfectly self-consistent. `expected` was derived from the plan
 * and printed before the write, and `controls` from the pre-state.
 */
async function check(db: Reader, phase: "before" | "after", expected: ExpectedTotals, controls: Controls, comparableSlugs: ReadonlySet<string>): Promise<Reading[]> {
  const cardRows = await db.select().from(schema.cardVersion);
  const releaseRows = await db.select().from(schema.release);
  const bundleRows = await db.select({ id: schema.bundle.id, slug: schema.bundle.slug, ownerId: schema.bundle.ownerId }).from(schema.bundle);
  const now = await controlsOf(db);

  const digestByRef = new Map(cardRows.map((r) => [refOf(r.cardId, r.version), r.digest]));
  const sourceByRef = new Map(cardRows.map((r) => [refOf(r.cardId, r.version), r.source]));
  const bodyOf = (row: { body: unknown }): Record<string, unknown> => (row.body ?? {}) as Record<string, unknown>;
  const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : []);
  const published = publishedDigests();
  const slugOf = new Map(bundleRows.map((b) => [b.id, b.slug]));

  const readings: Reading[] = [];
  const at = (name: string, got: number | string, want: number | string): void => {
    readings.push({ name, got: String(got), want: String(want), ok: String(got) === String(want) });
  };

  at("card_version rows", cardRows.length, expected.cardVersions);
  at("release rows", releaseRows.length, expected.releases);
  at("bodies carrying a retired key", cardRows.filter((r) => ["requiresHuman", "ontologyVersion", "requires_human", "ontology_version"].some((k) => Object.hasOwn(bodyOf(r), k))).length, 0);
  at("bodies without a `willNot` array", cardRows.filter((r) => !Array.isArray(bodyOf(r).willNot)).length, 0);
  at("prose entries left in `cannot`", cardRows.reduce((n, r) => n + listOf(bodyOf(r).cannot).filter((e) => e.includes(" ")).length, 0), 0);
  at("`cannot` entries, all rows", cardRows.reduce((n, r) => n + listOf(bodyOf(r).cannot).length, 0), expected.cannotEntries);
  at("`willNot` entries, all rows", cardRows.reduce((n, r) => n + listOf(bodyOf(r).willNot).length, 0), expected.willNotEntries);
  at("bodies `storedCard` refuses", cardRows.filter((r) => storedCardGaps(r.body).length > 0).length, 0);
  at("digests not describing their own body", cardRows.filter((r) => digestOfStored(r.body) !== r.digest).length, 0);
  at("sources with a retired key line", cardRows.filter((r) => /^(requires_human|ontology_version|requiresHuman|ontologyVersion):/m.test(r.source)).length, 0);
  at("sources `loadCard` refuses", cardRows.filter((r) => loadCard(r.source, { ontology: contentOntology(), format: "yaml" }).card === undefined).length, 0);
  at("manifests carrying `ontologyVersion`", releaseRows.filter((r) => Object.hasOwn((r.manifest ?? {}) as object, "ontologyVersion") || Object.hasOwn((r.manifest ?? {}) as object, "ontology_version")).length, 0);
  at("release digests not describing their own columns", releaseRows.filter((r) => bundleDigest({ dot: r.dot, cardDigests: r.cardDigests as string[] }) !== r.digest).length, 0);
  at("card_refs / card_digests length disagreements", releaseRows.filter((r) => (r.cardRefs as string[]).length !== (r.cardDigests as string[]).length).length, 0);
  at(
    "card_digests[i] not matching card_refs[i]",
    releaseRows.reduce((n, r) => n + (r.cardRefs as string[]).filter((ref, i) => digestByRef.get(ref) !== (r.cardDigests as string[])[i]).length, 0),
    0,
  );
  at("card_refs entries resolving to no row", releaseRows.reduce((n, r) => n + (r.cardRefs as string[]).filter((ref) => !digestByRef.has(ref)).length, 0), 0);

  let unresolvable = 0;
  let vocabularyStale = 0;
  const archiveVocabularyText = contentVocabulary()?.text;
  for (const row of releaseRows) {
    const stored = safeVocabulary(row.localVocabulary);
    if (stored !== undefined && archiveVocabularyText !== undefined && stored.text !== archiveVocabularyText) vocabularyStale++;
    const view = openView(stored?.terms);
    const cardFiles: Record<string, string> = {};
    let complete = true;
    for (const ref of row.cardRefs as string[]) {
      const text = sourceByRef.get(ref);
      if (text === undefined) complete = false;
      else cardFiles[cardFilePath(ref as CardRef)] = text;
    }
    if (!complete) {
      unresolvable++;
      continue;
    }
    const loaded = loadBundle({ manifest: row.manifest as BundleManifest, dot: row.dot, cardFiles }, { ontology: view });
    if (loaded.blueprint === undefined || !isReleasable(loaded.diagnostics) || loaded.blueprint.digest !== row.digest) unresolvable++;
  }
  at("releases that do not resolve from their own rows", unresolvable, 0);
  at("local_vocabulary.text differing from the archive", vocabularyStale, 0);

  at(
    "archive-backed slugs whose stored digest differs from their committed README",
    releaseRows.filter((r) => {
      const slug = slugOf.get(r.bundleId);
      return slug !== undefined && comparableSlugs.has(slug) && published.get(slug) !== r.digest;
    }).length,
    0,
  );

  /* Gate 1's reading, reported in both directions. Under `--keep-analysis` a non-zero here
     is the accepted, recorded cost rather than a defect, so it is named as such. */
  const autonomyLabels = publishedAutonomy();
  const autonomyDisagreements = releaseRows.filter((r) => {
    const slug = slugOf.get(r.bundleId);
    if (slug === undefined || !autonomyLabels.has(slug)) return false;
    const stored = (r.autonomy ?? {}) as { label?: unknown };
    return typeof stored.label === "string" && stored.label !== autonomyLabels.get(slug);
  }).length;
  readings.push({
    name: "releases whose stored autonomy label differs from their README",
    got: String(autonomyDisagreements),
    want: phase === "after" && keepAnalysis ? `${autonomyDisagreements} (accepted: --keep-analysis)` : "0",
    ok: phase === "after" && keepAnalysis ? true : autonomyDisagreements === 0,
  });

  /* Controls. None of these may move from the pre-state; each is a table this migration does not touch. */
  for (const [table, before] of Object.entries(controls)) {
    at(`${table} rows (control)`, now[table] ?? "absent", before);
  }

  return readings;
}

function report(readings: readonly Reading[]): void {
  const width = Math.max(...readings.map((r) => r.name.length));
  for (const reading of readings) {
    const mark = reading.ok ? "ok  " : "FAIL";
    console.log(`  ${mark} ${reading.name.padEnd(width)}  ${reading.got.padStart(6)}   want ${reading.want}`);
  }
}

/* --------------------- the frozen store --------------------- */

/**
 * What the object store holds at the digests that just became live, and why it matters.
 *
 * `lib/server/export/serve-file.ts` reads the frozen object FIRST and only reaches
 * `buildExport` on a miss. MinIO already holds objects at nine of the ten post-migration
 * digests, written by earlier scratch-test publishes into a bucket shared by every worktree
 * on this host. So every `/api/files/…` download answers 200 with correct-looking bytes the
 * moment `release.digest` flips, whether the rows underneath are right, wrong, or untouched.
 *
 * Deleting them is opt-in (`--purge-frozen`) and never a default: the key carries no
 * repository, worktree or database component, deletion in a content-addressed store with no
 * `list` verb is unrecoverable except by reproducing the bytes from a database, and the
 * hosted bucket named in `.env.local` belongs to a different Supabase project from the one
 * that file's `DATABASE_URL` names. Left alone, the trap is at least NAMED here.
 */
async function reportFrozen(releases: readonly ReleasePlan[]): Promise<void> {
  const digests = [...new Set(releases.map((r) => r.newDigest))].sort();
  let storage: ReturnType<typeof createObjectStorage>;
  try {
    storage = createObjectStorage(objectStorageConfigFromEnv());
  } catch (err) {
    console.log("");
    console.log(`frozen    not checked: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const present: string[] = [];
  for (const digest of digests) {
    if ((await storage.get(digest)) !== undefined) present.push(digest);
  }

  console.log("");
  console.log(`frozen    ${present.length} of ${digests.length} new release digests already have an object in ${process.env.S3_BUCKET}`);
  if (present.length === 0) return;

  if (!purgeFrozen) {
    console.log("          `serveFile` answers from a frozen object before it builds one, so every");
    console.log("          /api/files download at these digests will serve bytes this run did not write:");
    for (const digest of present) console.log(`            ${digest}`);
    console.log("          Re-run with --purge-frozen to delete them and force a re-freeze from the migrated rows.");
    return;
  }

  for (const digest of present) {
    await storage.delete(digest);
    console.log(`          deleted ${digest}`);
  }
  console.log("          the next read of each release re-freezes it from the rows this run wrote.");
}

/* --------------------- the rollback file --------------------- */

/**
 * 74 `UPDATE` statements restoring the exact prior bytes, keyed by primary key.
 *
 * It cannot cascade, cannot change a row id, and cannot lose a `created_at` or an embedding,
 * because it is the inverse of the same update. Every literal is DOLLAR-QUOTED: 40 of the 58
 * stored sources contain a single quote and one contains a backslash, and hand-doubling
 * quotes is the classic way to write a rollback that applies cleanly and restores different
 * bytes. `card_version.source` is the one migrated column with no derived oracle — `digest`
 * is computed from `body` alone — so nothing downstream could ever notice.
 *
 * This is the operative rollback. A `pg_dump -t`-scoped dump is NOT a substitute: measured,
 * `pg_restore --clean --data-only` refuses to run at all, a plain `--data-only` restore into
 * populated tables fails both COPYs on duplicate keys and still exits 0, and the only route
 * that works truncates `card_version` and `release` CASCADE, taking 49 embedding rows with
 * it that a table-scoped dump does not contain. Take a WHOLE-database `pg_dump -Fc` as the
 * belt, restore it into a FRESH database if it is ever needed, and use this file as the
 * braces.
 */
function rollbackSql(cards: readonly CardPlan[], releases: readonly ReleasePlan[], sha: string, database: string): string {
  const lines: string[] = [
    "-- DarkPrint: rollback for scripts/migrate-stored-cards.ts",
    `-- database ${database}, tree ${sha}, written ${new Date().toISOString()}`,
    "--",
    "-- Restores card_version.body/source/digest and release.manifest/card_digests/digest/",
    "-- local_vocabulary" + (rescore ? "/autonomy/security/phase_coverage" : "") + " to the values held before that script ran.",
    "-- Apply with: psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -f <this file>",
    "",
    "\\set ON_ERROR_STOP on",
    "BEGIN;",
    "",
  ];

  for (const card of cards) {
    lines.push(`-- ${card.ref}`);
    lines.push(
      `UPDATE card_version SET body = ${jsonbLiteral(card.oldBody)}, source = ${dollarQuoted(card.oldSource)}, digest = ${dollarQuoted(card.oldDigest)} WHERE id = ${dollarQuoted(card.rowId)};`,
    );
  }
  lines.push("");

  for (const release of releases) {
    lines.push(`-- ${release.handle}/${release.slug}`);
    const sets = [
      `manifest = ${jsonbLiteral(release.oldManifest)}`,
      `card_digests = ${textArrayLiteral(release.oldCardDigests)}`,
      `digest = ${dollarQuoted(release.oldDigest)}`,
      `local_vocabulary = ${jsonbLiteral(release.oldVocabulary)}`,
    ];
    if (rescore) {
      sets.push(`autonomy = ${jsonbLiteral(release.oldAnalysis.autonomy)}`);
      sets.push(`security = ${jsonbLiteral(release.oldAnalysis.security)}`);
      sets.push(`phase_coverage = ${jsonbLiteral(release.oldAnalysis.phaseCoverage)}`);
    }
    lines.push(`UPDATE release SET ${sets.join(", ")} WHERE id = ${dollarQuoted(release.rowId)};`);
  }

  lines.push("");
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

/* --------------------- the hash manifest --------------------- */

/**
 * One line per migrated row, hashing every column this script rewrites.
 *
 * It exists for exactly one job: proving that a rollback restored the PRIOR BYTES rather
 * than merely applying cleanly. Row counts cannot do that, and neither can the acceptance
 * battery — its pre-migration reading is "every source is broken", which a mangled,
 * truncated or cross-assigned `source` also produces. `card_version.source` is the one
 * migrated column with no derived oracle at all: `digest` is `cardDigest(body)`, over `body`
 * alone, so a corrupted `source` beside a correctly restored `body` is invisible everywhere
 * else in this file.
 *
 * Hashed over `canonicalJson` rather than over Postgres's own `jsonb` text, so the value
 * cannot depend on which side of the wire it was serialised on, and so re-running this on a
 * database restored from a dump answers the same thing.
 */
async function hashManifest(db: Reader): Promise<string> {
  const cardRows = (await db.select().from(schema.cardVersion)).sort((a, b) => (refOf(a.cardId, a.version) < refOf(b.cardId, b.version) ? -1 : 1));
  const releaseRows = (await db.select().from(schema.release)).sort((a, b) => (a.id < b.id ? -1 : 1));
  const md5 = (value: string): string => createHash("md5").update(value, "utf8").digest("hex");

  const lines: string[] = [
    "# DarkPrint stored-card migration — column hashes, one row per line.",
    "# card    <ref>          <md5 source>  <md5 canonical body>  <digest>",
    "# release <release.id>   <md5 manifest>  <md5 card_digests>  <md5 local_vocabulary>  <digest>",
  ];
  for (const row of cardRows) {
    lines.push(`card\t${refOf(row.cardId, row.version)}\t${md5(row.source)}\t${md5(canonicalJson(row.body))}\t${row.digest}`);
  }
  for (const row of releaseRows) {
    lines.push(
      `release\t${row.id}\t${md5(canonicalJson(row.manifest))}\t${md5(canonicalJson(row.cardDigests))}\t${md5(canonicalJson(row.localVocabulary ?? null))}\t${row.digest}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Compare a manifest written before a run against the database as it stands now.
 *
 * The rollback drill is: take the manifest, migrate, apply the rollback file, run this. A
 * green answer is the only evidence that the way back actually goes all the way back.
 */
async function checkManifest(db: Reader, path: string): Promise<void> {
  const expected = readFileSync(path, "utf8").split("\n").filter((l) => l !== "" && !l.startsWith("#"));
  const actual = (await hashManifest(db)).split("\n").filter((l) => l !== "" && !l.startsWith("#"));
  const byKey = new Map(actual.map((l) => [l.split("\t").slice(0, 2).join("\t"), l]));

  const differences: string[] = [];
  for (const line of expected) {
    const key = line.split("\t").slice(0, 2).join("\t");
    const found = byKey.get(key);
    if (found === undefined) differences.push(`missing  ${key.replace("\t", " ")}`);
    else if (found !== line) differences.push(`differs  ${key.replace("\t", " ")}`);
    byKey.delete(key);
  }
  for (const key of byKey.keys()) differences.push(`unexpected  ${key.replace("\t", " ")}`);

  console.log(`manifest  ${path}`);
  console.log(`          ${expected.length} rows expected, ${actual.length} present, ${differences.length} differing`);
  for (const difference of differences) console.log(`          ${difference}`);
  if (differences.length > 0) {
    console.log("");
    console.log("The database does not hold the bytes this manifest names. If this was a rollback drill,");
    console.log("the rollback did not restore what it claimed to and the pre-migration bytes are at risk.");
    process.exitCode = 1;
  }
}

/* --------------------- small readers --------------------- */

/**
 * `cardDigest` spreads its argument and deletes `author`/`provenance`; it reads no other
 * field. So handing it a stored body computes exactly the value that was stored for that
 * body, whatever shape the body is in, and the cast asserts nothing beyond that. Every use
 * is immediately compared against the column, which is what makes it checkable rather than
 * assumed — the difference `lib/server/cards/stored-card.ts` was written about.
 */
function digestOfStored(body: unknown): string {
  return cardDigest(body as NodeCard);
}

function fieldOf(card: unknown, field: keyof NodeCard): unknown {
  return (card as Record<string, unknown>)[field];
}

function shortOf(digest: string): string {
  return digest.slice(0, "sha256:".length + 8);
}

/** `parseStoredVocabulary`, softened to a value for the read-only battery. */
function safeVocabulary(value: unknown): { text: string; terms: readonly OntologyTerm[] } | undefined {
  try {
    return parseStoredVocabulary(value ?? undefined, "verify");
  } catch {
    return undefined;
  }
}

/**
 * The digest each committed `public/bundles/<slug>/README.md` prints.
 *
 * An independent oracle for nine of the ten new release digests: those files are generated
 * from `content/` by `prebuild` and are committed, so they were computed by a different run
 * of the engine from a different input path than this script's. The tenth,
 * `alessandro/smoke-checker`, is database-only and has no published expectation, which is
 * why its digest is pinned as a literal in `stored-card-migration.ts` instead.
 */
function publishedDigests(): Map<string, string> {
  const out = new Map<string, string>();
  for (const bundle of archive) {
    const readme = join(process.cwd(), "public", "bundles", bundle.slug, "README.md");
    if (!existsSync(readme)) continue;
    const found = /sha256:[0-9a-f]{64}/.exec(readFileSync(readme, "utf8"));
    if (found !== null) out.set(bundle.slug, found[0]);
  }
  return out;
}

/** The autonomy label each committed README prints, for Gate 1's reading. */
function publishedAutonomy(): Map<string, string> {
  const out = new Map<string, string>();
  for (const bundle of archive) {
    const readme = join(process.cwd(), "public", "bundles", bundle.slug, "README.md");
    if (!existsSync(readme)) continue;
    const found = /^Autonomy: ([^.]+)\./m.exec(readFileSync(readme, "utf8"));
    if (found !== null) out.set(bundle.slug, found[1] as string);
  }
  return out;
}
