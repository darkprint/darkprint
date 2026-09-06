#!/usr/bin/env node
/* ============================================================
   DarkPrint — bringing the registry rows onto the post-D-92 /
   D-93 / D-101 card shape, run from a terminal

   `npm run migrate:stored-cards -- --expect-db darkprint`

   ── the defect ──
   D-92 retired `requires_human`, D-93 removed `ontologyVersion`
   from `BundleManifest`, and D-101 split `cannot` into the
   enforced half (ontology `data-type` ids) and the stated half
   (`will_not`, free sentences). `content/` was migrated and
   `public/bundles/**` was regenerated from it. The registry rows
   were not. Measured on 2026-09-01 against the development
   database: 58 of 58 `card_version.body` values carry a retired
   key, 0 carry `willNot`, 85 of the 87 entries in their `cannot`
   lists are prose, 58 of 58 `card_version.source` values are
   REFUSED by `loadCard` at error severity (`card/unknown-term`),
   and 16 of 16 `release.manifest` values carry `ontologyVersion`.
   `storedCard` therefore returns `undefined` for every row, which
   empties `/blueprints` and `/nodes`, and `buildExport` throws for
   every release, which takes down every download and the whole
   `/api/mcp` fetch surface.

   ── why this is a script and not a numbered migration ──
   `lib/db/migrate.ts` reads `<id>.down.sql` unconditionally, and
   no SQL can invert this transform: reversing 85 sentences out of
   `will_not` back into `cannot` is not a function of the
   post-state. Worse, `lib/db/migrate.test.ts` runs migrations
   against an EMPTY database, so a data migration would be a green
   no-op there, and `tests/support/db.ts` would run it as a no-op
   against every scratch database in the suite. This is an
   operator action against one named database, so it is an
   operator script that says which database it is pointed at.

   ── why it writes UPDATEs instead of republishing ──
   There is no update path anywhere. `lib/server/cards` exports no
   updater and no deleter; `lib/server/archive` exports none for a
   release. `publish()` refuses at `version-not-higher` because
   every release is already 1.0.0, and `runImport` does not catch
   that kind, so a re-import aborts on the first bundle;
   `publishCard` compares stored `source` BYTES and raises
   `cardConflict`, whose kind IS `"conflict"` — the one `runImport`
   counts as `skipped`, so a re-import that refused every card
   reports "already done". `deleteBundle` refuses a public bundle
   holding a published release, and a delete-and-reinsert would
   change every row id, cascade away 42 `card_version_embedding`
   and 7 `release_embedding` rows, and enqueue repin notifications
   for 58 versions that already landed.

   Bypassing the writers means bypassing their guards, so the
   honest mitigation is to CALL those guards directly, on exactly
   the values about to be written, before the transaction opens:
   `loadCard`, `storedCardGaps`, `findWellFormednessIssue`,
   `parseStoredVocabulary`, `loadBundle` + `isReleasable`, and
   both digest functions. That is Phase A below.

   ── running TypeScript ──
   Node strips the types (22.18+, the floor `package.json`
   declares in `engines.node`). The `@/…` alias and the
   extensionless relative imports the engine uses are NOT resolved
   by Node's ESM resolver, so the hook below is installed first
   and every `lib/…` import in this file is dynamic: a static
   import is evaluated before any statement runs, and the hook has
   to be in place before that. Spelled out again rather than
   shared, for the reason `scripts/import-seed.ts` gives: nothing
   under `scripts/` can be imported before the hook that resolves
   imports exists.

   ── what it deliberately does not do ──
   It does not touch `ontology_version` / `ontology_term`, and by
   now it could not: they were written by nothing and read by
   nothing, and `0009_drop_ontology_versioning` dropped both. It
   does not touch `release.dot` or
   `release.card_refs`, both of which are already correct. It does
   not re-embed, does not enqueue notifications, and does not
   write object storage. And unless `--purge-frozen` is passed it
   deletes nothing from the frozen store, which is stated in the
   report rather than left implied, because MinIO already holds
   objects at the post-migration digests and `serveFile` answers
   from a frozen object BEFORE it calls `buildExport`.
   ============================================================ */

/* ============================================================
   RUNNING THIS AGAINST PRODUCTION
   Prepared 2026-09-01. NOT executed. www.darkprint.io is healthy
   at the time of writing for exactly one reason: its code and its
   data are BOTH pre-migration. Move either one on its own and it
   breaks. Everything below is written for the operator who has to
   move both.

   ── 1. the ordering, which is the whole problem ──
   Production serves `origin/backend`. Local `backend` is four
   commits ahead of it and nothing has been pushed, so the whole
   D-92 / D-93 / D-101 wave is unpushed: `git grep -c willNot
   origin/backend -- lib/core` matches nothing, and
   `requires_human` is live at `lib/core/card/validate.ts:212`
   there.

   DEPLOY FIRST is a total outage. `storedCard` (commit 752e25a,
   unpushed) declares `willNot` required and no unmigrated body
   carries one, so every unmigrated row is refused. That is what
   was measured on the development database on 2026-09-01, where
   all 58 rows were unmigrated: `/blueprints` rendered zero links,
   every blueprint and node page 404'd, and every download and the
   whole `/api/mcp` surface went with them.

   MIGRATE FIRST is a partial, quiet degradation, and it was
   measured against `origin/backend`'s own validator rather than
   guessed:
     * `will_not` is not in that tree's `CARD_KNOWN_KEYS`, and an
       unknown key there is `card/bad-type` at INFO severity
       (`validate.ts:250-258`). So the 85 stated-limit sentences
       load into nothing and vanish from every rendered card and
       every generated download. Those sentences are the cards'
       honesty disclosures.
     * two of the development corpus's 58 fail at ERROR severity.
       `confidence-escalation@1.0.0` and
       `maintainer-approval@1.0.0` are `type: human-gate`, and
       `validate.ts:223-237` raises `card/human-type-inconsistent`
       when a `human-in-the-loop` type carries no
       `requires_human: true`. This migration removes that key.
       Every release pinning either card stops resolving.

   So there is no safe order and no order without a window. THE
   TWO OPERATIONS HAVE TO BE ADJACENT. What follows is how to make
   the window seconds rather than minutes, and which side of it to
   be broken on.

   The deploy is a git push, and that is the trap. Production runs
   `origin/backend` while `main` is 1603 commits behind, which
   means Vercel's production branch for the `darkprint` project is
   `backend` and `git push origin backend` builds AND promotes in
   one action. THIS WAS INFERRED FROM WHAT PRODUCTION SERVES AND
   NOT CONFIRMED IN THE VERCEL DASHBOARD. Confirm it before
   touching git, because if it holds then the push is the deploy
   and cannot be staged afterwards.

   To collapse the window: build the deployment without promoting
   it (`vercel build && vercel deploy --prebuilt`, or push to a
   branch that is not the production branch), wait until it
   reports Ready, run the migration, then `vercel promote <url>`.
   The cutover becomes an alias swap of a few seconds instead of a
   full build.

   There is no build-time cache to hide behind. `origin/backend`
   already carries `export const dynamic = "force-dynamic"` on
   `/blueprints`, `/blueprints/[owner]`,
   `/blueprints/[owner]/[slug]`, `/nodes` and `/nodes/[...id]`, so
   every one of them reads Postgres per request and the migration
   is visible on the live site the instant it commits.

   A READ-ONLY PERIOD IS NEEDED, and it is narrow enough to be
   cheap. `card_version` is written in exactly one place,
   `lib/server/cards/add-card.ts:127`, reached only from
   `publish()` at `lib/server/publish/publish.ts:312`, reached
   only from `POST /api/bundles` at
   `app/api/bundles/route.ts:97`. Block that one route across the
   window. The old code publishing after the migration writes a
   body with `requiresHuman` and no `willNot`, which the new code
   refuses on sight, and the rollback file has never heard of that
   row. `release` has a second writer, `forkBundle` at
   `lib/server/lineage/fork.ts:128`, which copies an existing
   release's bytes unaltered and is therefore safe in either
   state; block it anyway so the digest census does not move
   underneath the preflight.

   MIGRATE, THEN PROMOTE. Beyond the two failures being different
   sizes, there is a second reason: while the code is still
   `origin/backend`, backing out is one `psql` run and needs no
   deploy at all. Reverse the order and a rollback means reverting
   a promotion as well.

   OWNER'S CALL, and it is not this script's to make. Even a short
   window with every card's stated limits invisible is an honesty
   regression on a public site. If that is not acceptable, put the
   site behind a maintenance page across both steps rather than
   serving cards whose `will_not` prose has silently gone missing.

   ── 2. which database, which nobody has established ──
   No one has determined which Supabase project production
   actually uses, and `.env.local` names TWO. `POSTGRES_HOST`,
   `POSTGRES_URL` and `SUPABASE_URL` name project
   `jwpgxvaqtexekixcbcdl`; `NEXT_PUBLIC_SUPABASE_URL` and
   `S3_ENDPOINT` name `gizoodymnyffuixwnmmk`. The database and the
   object store named in that one file belong to different
   projects, which is the same split `reportFrozen` reports below.
   DO NOT INFER THE TARGET FROM THAT FILE. Read the Production
   `DATABASE_URL` the deployed runtime actually holds, from
   `vercel env pull` against the Production environment or from
   the project's dashboard, and use that.

   `--expect-db` is nearly useless against a hosted target and the
   operator must not lean on it: every Supabase project's database
   is named `postgres`, so `--expect-db postgres` passes against
   any project in the account. The line that discriminates is the
   one this script prints before it does anything,
   `database  host=... port=... database=...`. READ THE HOST and
   match it against the project confirmed above.

   Keep the credential out of this repository, out of shell
   history and out of any file under version control. Put it in a
   file outside the tree and source that:

     set -a; . /path/outside/the/repo/prod.env; set +a
     npm run migrate:stored-cards -- --expect-db postgres

   Note what this repository's own idiom does here:
   `set -a; . ./.env.example; set +a` OVERWRITES `DATABASE_URL`
   and points the run at the local docker database. That is why
   `--expect-db` is required at all.

   If the confirmed URL is a pooler URL (`...pooler.supabase.com`,
   port 6543), take the direct connection instead
   (`db.<ref>.supabase.co:5432`). This script runs one transaction
   holding one UPDATE per migrated row, through node-postgres,
   which uses prepared statements, and the transaction pooler does
   not serve them.

   ── 3. preflight, before a single byte is written ──
   (a) THE TREE. Run from a checkout at exactly the commit being
   deployed. This script refuses a dirty `content/` or
   `public/bundles/` and prints the sha it read. The committed
   `public/bundles/<slug>/README.md` digests are the independent
   oracle for every release whose slug has one (nine of ten on
   development), so a different tree computes different
   expectations and the oracle stops being an oracle.

   (b) THE CENSUS, and whether the rows really are unmigrated:

     select (select count(*) from card_version)                              as cards,
            (select count(*) from card_version where body ? 'willNot')       as with_willnot,
            (select count(*) from card_version where body ? 'requiresHuman') as with_requireshuman,
            (select count(*) from release)                                   as releases,
            (select count(*) from release where manifest ? 'ontologyVersion') as manifests_with_ov,
            (select count(*) from bundle)                                    as bundles,
            (select count(*) from account)                                   as accounts,
            (select count(*) from release_embedding)                         as rel_emb,
            (select count(*) from card_version_embedding)                    as card_emb,
            (select count(*) from run_report)                                as run_reports,
            (select count(*) from notification_queue)                        as notifs;

   Unmigrated means `with_willnot` is 0 and `with_requireshuman`
   equals `cards`. Development answered
   `58|58|0|16|0|20|3|7|42|0|0` after its run; before it,
   `with_willnot` was 0 and `with_requireshuman` was 58.

   (c) THE REFUSAL TO EXPECT, and it is the important one.
   `EXPECTED_TOTALS` in `stored-card-migration.ts` and the six
   control readings in `check()` are the DEVELOPMENT census,
   written as literals: 58 cards, 16 releases, 20 bundles, 3
   accounts, 7 release embeddings, 42 card embeddings, 0 run
   reports, 0 queued notifications. Production is a live site with
   real sign-ups, so several of those will not hold. The battery
   inside the transaction throws on ANY failed reading and rolls
   the whole write back, so a production run with these constants
   unchanged writes nothing and tells you which ones disagree.
   That is the design working, and it is the discovery step.

   Re-derive them before the write, in a commit of their own:
     * `cardVersions`, `releases` and the six controls: from
       production's own PRE-state, using the query above.
     * `cannotEntries` and `willNotEntries`: from the ARCHIVE, and
       never from production's post-state. These two readings are
       the only thing separating "moved the 85 sentences into
       `willNot`" from "deleted them", and a number copied back
       out of the migration's own output makes them vacuous.
     * `SMOKE_CHECKER_REF` / `SMOKE_CHECKER_EXPECTED`: the
       development registry's one database-only card. If
       production holds rows with no counterpart under
       `content/cards/`, step 3b throws by name for each of them,
       and each needs what the smoke-checker got: a digest and
       entry counts pinned from a derivation done before the run.
       There is no ruled answer for a card this script has never
       seen, and inventing one at the keyboard is how the 85
       sentences get deleted quietly.

   (d) THE BACKUP, in the format that actually restores. Take a
   WHOLE-DATABASE plain-SQL dump. A table-scoped dump and a
   custom-format dump each fail here, for the reasons measured
   under it:

     pg_dump "$DATABASE_URL" --no-owner --no-privileges \
       -f darkprint-pre-migration.sql

   Measured on the development database: that file restored into a
   throwaway with zero errors and all 58 cards.
   `pg_restore --clean --data-only` refused to run at all; a plain
   `--data-only` restore into populated tables failed both COPYs
   on duplicate keys and still exited 0; and the only
   custom-format route that worked truncated `card_version` and
   `release` CASCADE, taking 49 embedding rows with it that a
   table-scoped dump does not even contain. That is
   `rollbackSql`'s own finding, repeated here because a backup
   nobody restored is a belief rather than a backup.

   PROVE IT before writing:

     createdb -T template0 darkprint_restore_drill
     psql darkprint_restore_drill -v ON_ERROR_STOP=1 \
       -f darkprint-pre-migration.sql
     psql darkprint_restore_drill -tAc "select count(*) from card_version"

   For a hosted target the throwaway can be a local Postgres. The
   question is whether the FILE restores, not where it lands.

   THEN PROVE IT IS THE *PRE* STATE, which the drill above does not
   ask. This step exists because the check above passed on the
   development run and proved nothing, and the failure is worth
   stating rather than summarising: the dump was taken AFTER the
   migration had already been applied, restored into a throwaway
   with zero errors and all 58 cards, and was reported as a working
   safety net. It was a snapshot of the migrated state. Restoring it
   would have reinstated exactly what the operator was trying to
   undo, and every property the drill measured — it restores, it is
   whole, the counts are right — was true of it.

   A backup is identified by its CONTENT, not by its filename or by
   the fact that it restores:

     grep -c requiresHuman darkprint-pre-migration.sql   # must be > 0
     grep -c willNot       darkprint-pre-migration.sql   # must be 0

   A pre-migration dump carries the retired keys and none of the new
   one. If those two numbers come back the other way round, the file
   is a post-migration snapshot, whatever it is called, and there is
   no rollback. Run the greps before the write, not after.

   The same test applies to `--rollback-sql`'s output, inverted: it
   RESTORES the pre state, so it must contain `requiresHuman` and no
   `willNot`. Proven on the development run by applying it to a
   migrated copy and watching the counts go from
   `willNot=58 requiresHuman=0` back to `willNot=0 requiresHuman=58`.

   Put the dump and the rollback somewhere durable. `/tmp`,
   `/private/tmp` and `/var/folders` are swept by the operating
   system, which is why this script warns when `--rollback-sql`
   points into one: a rollback found missing a week later is
   indistinguishable from one that was never taken.

   (e) THE DRY RUN, which writes nothing and is the real
   preflight:

     npm run migrate:stored-cards -- --expect-db postgres

   Read three things. The `database  host=` line names the project
   confirmed in section 2. The `before:` block shows the damage
   this migration repairs, with every control reading `ok`. The
   per-release list shows `old -> new`, with every archive-backed
   release marked `(matches README)` (nine of ten on development).

   (f) WHAT THE DRY RUN CANNOT TELL YOU. `reportFrozen` runs only
   after a commit, so the state of the object store at the new
   digests is invisible until it is too late to choose
   `--purge-frozen`, and this script refuses a second `--write`
   run (the rollback path already exists, and every card already
   hashes to its stored digest). Decide `--purge-frozen` before
   the run. Section 7 says how.

   ── 4. the run ──
     npm run migrate:stored-cards -- \
       --expect-db postgres \
       --write \
       --rollback-sql /durable/path/rb-darkprint-prod.sql \
       --rescore-analysis

   `--rescore-analysis` is the OWNER'S RULING (Gate 1, 2026-09-01)
   and it is deliberately not a default: `--write` refuses without
   exactly one of `--rescore-analysis` or `--keep-analysis`. The
   reason it exists is that `release.autonomy` disagreed with the
   archive's own scorer on `frontline-triage`,
   `incident-commander` and `guarded-merge-bot`. Those rows said
   Conditional / level 3 where the committed
   `public/bundles/<slug>/README.md` for the same content says
   Supervised / level 2, and after this migration ONE digest
   addresses both documents. `--rescore-analysis` writes
   `autonomy`, `security` and `phase_coverage` from the same
   `loadBundle` this script already runs, so the registry and the
   site agree. It changes no digest. Development landed Supervised
   / level 2 on all three, matching the READMEs.

   Two files are written beside the run and both are load-bearing:
   the rollback at `--rollback-sql`, and `<that path>.manifest.tsv`
   next to it. The manifest is the only thing that can prove a
   rollback restored the PRIOR BYTES rather than merely applying
   cleanly. Keep them together.

   ── 5. verification after ──
   The `after:` block reruns the whole battery from a fresh read
   and every reading must say `ok`. Then, on the live site, the
   same five checks the development run used to call itself
   recovered:
     * `/blueprints` renders its blueprint links instead of an
       empty shelf
     * `/blueprints/darkprint/starter-software-factory` returns 200
     * a node page returns 200
     * `/api/files/cards/spec-planner@1.0.0` no longer carries
       `requires_human` or `ontology_version`, its `cannot:` holds
       ontology ids, and the prose has moved under `will_not:`
     * the runtime log carries no
       `Cannot read properties of undefined`

   Two things this migration does not do, so verification must not
   expect them to move. `card_version_embedding` and
   `release_embedding` are keyed by row id and their vectors were
   computed from the PRE-migration text, so search results drift
   silently and re-embedding is a separate decision. Nothing here
   reaches `ontology_version` or `ontology_term`, which 0009
   dropped.

   One consequence to announce rather than let people discover:
   every release digest changes, so every
   `/blueprints/<owner>/<slug>/d/<digest>` address recorded before
   the run now 404s. That is inherent to the migration and happens
   in either ordering. `/mcp` calls a digest address load-bearing
   precisely because it does not move, which is what makes this
   worth saying out loud.

   ── 6. rollback ──
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
       -f /durable/path/rb-darkprint-prod.sql

   Then prove it went all the way back:

     npm run migrate:stored-cards -- --expect-db postgres \
       --check-manifest /durable/path/rb-darkprint-prod.sql.manifest.tsv

   A green answer there is the only evidence that exists. Row
   counts cannot give it and neither can the acceptance battery:
   its pre-migration reading is "every source is broken", which a
   mangled, truncated or cross-assigned `source` also produces.
   `card_version.source` is the one migrated column with no
   derived oracle at all.

   If the rows will not come back, the whole-database dump from
   step 3d is the second way, restored into a FRESH database
   rather than over the live one.

   While the code is still `origin/backend`, a rollback needs no
   deploy and the site returns to exactly the state it is in
   today. That property is the reason section 1 migrates before it
   promotes.

   TOO LATE TO ROLL BACK looks like any of these:
     * A publish landed after the run. `POST /api/bundles` was
       open, a `card_version` row now exists that the rollback
       file has never heard of, and `--check-manifest` reports it
       as `unexpected`. Restoring the old rows around it leaves a
       store in two card shapes at once. This is the failure the
       read-only window exists to prevent, and it is the one that
       cannot be undone by running anything.
     * An external client recorded a post-migration digest. `/mcp`
       addresses a release by digest and promises the answer does
       not move; a rollback 404s whatever they pinned. In practice
       this begins the moment the new deployment is live and
       reachable, which is why the keep-or-revert decision belongs
       inside the verification window and not the next morning.
     * The superseded objects were purged from the object store. A
       rollback restores the old digests, and if their frozen
       folders are gone the downloads regenerate from the restored
       rows. That is correct and no longer instant. Section 7 is
       explicit that purging the OLD objects forecloses the cheap
       half of the rollback.

   ── 7. the frozen object store ──
   VERIFIED FINDING: nothing enumerates the bucket, and no key can
   be constructed except from a digest a live `release` row
   returned. So the objects frozen under the superseded release
   digests become unreferenced garbage the moment this migration
   commits. They are unreachable rather than
   stale-and-served, and clearing them is optional hygiene, not a
   correctness requirement.

   Where that was established, so the next reader can re-check it
   instead of trusting this paragraph:
     * `lib/db/storage.ts:24-34`: `ObjectStorage` is `put`, `get`
       and `delete`, and nothing else. The file imports
       `DeleteObjectCommand`, `GetObjectCommand`,
       `PutObjectCommand` and `S3Client`. No list verb appears
       anywhere under `lib/`, `app/`, `scripts/` or `tests/`.
     * `lib/db/storage.ts:49-57`: `keyForDigest` is the one place
       a digest becomes a key, and it refuses anything that is not
       `sha256:` plus 64 lowercase hex digits. All three verbs
       inherit it, so no key of any other shape is expressible.
     * `lib/server/publish/artefacts.ts:59-65`: `persistArtefacts`
       is the only writer, keyed by the RELEASE digest. No card
       digest is ever a key.
     * `lib/server/export/persisted.ts:73-80`: `frozenFolder` is
       the only reader, and its digest argument comes from
       `release.digest` at
       `lib/server/export/serve-file.ts:133-136`.
     * `lib/server/export/lookup.ts:121-151` and
       `lib/server/archive/release.ts:281-292`: a caller-supplied
       digest reaches storage only after `getRelease` matched it
       against a live `release` row OF THAT BUNDLE. After this
       migration an old digest matches no row, so the request that
       would have reached the old object is refused one layer
       earlier.

   `--purge-frozen` does a DIFFERENT job and does not touch those.
   It deletes objects sitting at the NEW digests, so a download
   cannot answer with bytes this run did not write:
   `serveFile` reads the frozen object BEFORE it builds one
   (`lib/server/export/serve-file.ts:133-156`), so an object
   already parked at a new digest wins over the migrated rows. On
   development MinIO held nine of ten, written by earlier scratch
   publishes into a bucket every worktree on that host shares.
   Whether the production bucket holds any is unknown, and per 3f
   the dry run cannot say. If it cannot be established beforehand,
   PASS `--purge-frozen`: a re-freeze on the next read costs one
   `buildExport` per release, and serving a stale folder at a live
   address costs correctness.

   Clearing the OLD objects has no flag, because `--purge-frozen`
   only knows the new digests. The old ones are recoverable from
   the rollback file:

     grep '^UPDATE release ' <rollback>.sql \
       | grep -oE ' digest = \$dp\$sha256:[0-9a-f]{64}' \
       | grep -oE 'sha256:[0-9a-f]{64}' | sort -u

   Development produced ten unique values across sixteen rows,
   because six digests are each held by two rows, a `darkprint`
   original and an `alessandro` copy of the same content. Delete
   them last or not at all: section 6 explains why they are the
   cheap half of the rollback.

   One last thing the bucket will not tell you. `.env.local`'s
   `S3_ENDPOINT` names project `gizoodymnyffuixwnmmk` while its
   `POSTGRES_HOST` names `jwpgxvaqtexekixcbcdl`, so the object
   store and the database in that file are not the same project.
   Confirm the production bucket the way section 2 confirms the
   production database, from the deployed environment and not from
   that file.
   ============================================================ */

/* Type-only, so Node's type stripping erases them and no runtime import is evaluated ahead
   of the resolver hook below. `verbatimModuleSyntax` is off and `isolatedModules` is on, so
   the `type` keyword is what makes that erasure explicit rather than inferred. */
import type { BundleManifest, CardRef, Diagnostic, NodeCard, OntologyTerm } from "@/lib/core";
import type { Db } from "@/lib/db";

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, resolve } from "node:path";
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
  EXPECTED_TOTALS,
  NOTES_REWRITTEN_BY_THE_WAVE,
  SMOKE_CHECKER_EXPECTED,
  SMOKE_CHECKER_REF,
  CARD_FIELDS,
  dollarQuoted,
  jsonbLiteral,
  migrateCardBody,
  migrateCardSource,
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
 * Every flag this script accepts. An argument outside this set is a REFUSAL rather than
 * something ignored: a mistyped `--rescore-analyis` that silently fell through would
 * leave the run without the ruling Gate 1 requires, and the operator would never see it.
 */
const KNOWN_FLAGS = new Set([
  "--plan",
  "--write",
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
        "`release.autonomy` disagrees with the archive's own scorer on three slugs (six releases):",
        "the rows say Conditional / level 3 where the committed public/bundles README for the same",
        "content says Supervised / level 2. Those READMEs are stamped with the digest this migration",
        "is about to write, so after it lands ONE digest addresses TWO documents that disagree about",
        "the headline safety number, and no digest check can see it.",
        "",
        "  --rescore-analysis  write autonomy/security/phase_coverage from the same loadBundle this",
        "                      script already runs, so the registry and the site agree. Changes no",
        "                      digest. It rewrites published numbers that B-08 makes the release's own.",
        "  --keep-analysis     leave all three columns alone. The contradiction becomes permanent.",
        "",
        "This is an owner's ruling, not a default.",
      ].join("\n"),
    );
  }
} else if (rescore || keepAnalysis || purgeFrozen || rollbackPath !== undefined) {
  throw new Error("--rescore-analysis, --keep-analysis, --purge-frozen and --rollback-sql only apply to --write.");
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

/* Throws on any error-severity diagnostic anywhere under `content/`, and runs §4's bump
   rule over the whole card library on the way — which is why the four two-version chains
   (`schema-gate`, `acceptance-verifier`, `intent-router`, `bounded-retry`) arrive at the
   write already checked, and why nothing here needs `addCard`'s neighbour comparison. */
const archive = readContent();
const ontology = contentOntology();
const archiveVocabulary = contentVocabulary();
console.log(`archive   ${archive.length} blueprints, ontology ${ontology.ontology.title}`);

const CARDS_DIR = join(process.cwd(), "content", "cards");
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
  /** `content/cards/<ref>.yaml`, or `undefined` for the one database-only card. */
  from: string | undefined;
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

    const archiveFile = join(CARDS_DIR, `${ref}.yaml`);
    let newSource: string;
    let newBody: NodeCard;
    let from: string | undefined;

    if (existsSync(archiveFile)) {
      /* ---- step 3a: re-derive from the archive ---- */
      from = `content/cards/${ref}.yaml`;
      newSource = readFileSync(archiveFile, "utf8");
      const loaded = loadCard(newSource, { ontology, format: "yaml", file: from });
      if (loaded.card === undefined || errorsIn(loaded.diagnostics).length > 0) {
        throw new Error(`${from} does not load: ${errorsIn(loaded.diagnostics).map((d) => d.code).join(", ") || "no card"}`);
      }
      newBody = loaded.card;

      /* ---- step 4: the mechanical cross-check ----
         Re-derivation takes whatever `content/` holds, so on its own it is an unverified
         copy. The mechanical transform is the second, independent derivation: strip the two
         retired keys, split `cannot`. Where the two agree, the archive is provably the
         stored card brought forward and nothing else. Where they disagree, this says so and
         the run stops unless the disagreement is the one already ruled on. */
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
      /* ---- step 3b: the one database-only card ---- */
      if (ref !== SMOKE_CHECKER_REF) {
        throw new Error(`${ref} has no counterpart under content/cards/ and is not the one row this migration knows to be database-only.`);
      }
      newSource = migrateCardSource(ref, row.source, ontology);
      const loaded = loadCard(newSource, { ontology, format: "yaml" });
      /* Zero diagnostics of ANY severity, not merely zero errors: this is the one card with
         no archive to be checked against, so the bar it clears has to be the higher one. */
      if (loaded.card === undefined || loaded.diagnostics.length > 0) {
        throw new Error(`${ref}: the migrated source did not load cleanly (${loaded.diagnostics.length} diagnostics).`);
      }
      newBody = loaded.card;
    }

    /* ---- step 7: the writers' own guards, on the values about to be written ---- */
    const gaps = storedCardGaps(newBody);
    if (gaps.length > 0) throw new Error(`${ref}: the migrated body is not a readable card. ${gaps.join("; ")}`);
    const issue = findWellFormednessIssue(newSource, newBody);
    if (issue !== undefined) throw new Error(`${ref}: an unpaired UTF-16 surrogate at ${issue.path} (D-12); \`pg\` would rewrite it to U+FFFD.`);

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
      from,
    });
  }

  if (otherDiverged.length > 0) {
    throw new Error(
      [
        "The archive and the mechanical transform disagree outside `notes`:",
        ...otherDiverged.map((d) => `  ${d}`),
        "",
        "The migration re-derives from content/, so this says content/ carries an edit that is not",
        "the D-92/D-93/D-101 wave. Establish what it is before writing it into the registry.",
      ].join("\n"),
    );
  }
  const notesRefs = [...new Set(notesDiverged.map((d) => d.replace(/\.notes$/, "")))].sort();
  if (canonicalJson(notesRefs) !== canonicalJson([...NOTES_REWRITTEN_BY_THE_WAVE].sort())) {
    throw new Error(
      [
        "The set of cards whose `notes` differ from the stored prose is not the ruled set.",
        `  found:    ${notesRefs.join(", ") || "(none)"}`,
        `  expected: ${[...NOTES_REWRITTEN_BY_THE_WAVE].sort().join(", ")}`,
        "",
        "Those five had their notes rewritten by the same wave because the old prose described the",
        "retired fields as live. A sixth is an unrelated edit and is not this migration's to publish.",
      ].join("\n"),
    );
  }

  /* ---- step 6: the four literals for the card with no archive ---- */
  const smoke = cards.find((c) => c.ref === SMOKE_CHECKER_REF);
  if (smoke === undefined) throw new Error(`${SMOKE_CHECKER_REF} is not in this database; this script is pointed at a registry it does not describe.`);
  if (smoke.newDigest !== SMOKE_CHECKER_EXPECTED.cardDigest) {
    throw new Error(`${SMOKE_CHECKER_REF}: migrated card digest is ${smoke.newDigest}, expected ${SMOKE_CHECKER_EXPECTED.cardDigest}.`);
  }
  if (smoke.newBody.cannot.length !== SMOKE_CHECKER_EXPECTED.cannotEntries || smoke.newBody.willNot.length !== SMOKE_CHECKER_EXPECTED.willNotEntries) {
    throw new Error(`${SMOKE_CHECKER_REF}: expected ${SMOKE_CHECKER_EXPECTED.cannotEntries} cannot / ${SMOKE_CHECKER_EXPECTED.willNotEntries} willNot entries.`);
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

  /* ---- step 11: the nine digests the site already publishes ---- */
  const published = publishedDigests();
  const wrong = releases.filter((r) => published.has(r.slug) && published.get(r.slug) !== r.newDigest);
  if (wrong.length > 0) {
    throw new Error(
      [
        "A computed release digest disagrees with the digest its committed README already prints:",
        ...wrong.map((r) => `  ${r.handle}/${r.slug}  computed ${r.newDigest}  README ${published.get(r.slug)}`),
      ].join("\n"),
    );
  }

  /* ---- the plan, printed ---- */
  console.log("");
  console.log(`plan      ${cards.length} card_version rows, ${releases.length} release rows`);
  console.log(`          ${cards.filter((c) => c.from !== undefined).length} cards re-derived from content/, ${cards.filter((c) => c.from === undefined).length} transformed in place`);
  console.log(`          notes rewritten by the wave, as ruled: ${NOTES_REWRITTEN_BY_THE_WAVE.join(", ")}`);
  console.log("");
  for (const r of [...releases].sort((a, b) => (`${a.handle}/${a.slug}` < `${b.handle}/${b.slug}` ? -1 : 1))) {
    console.log(`          ${`${r.handle}/${r.slug}`.padEnd(38)} ${shortOf(r.oldDigest)} -> ${shortOf(r.newDigest)}${published.has(r.slug) ? "  (matches README)" : "  (no published README)"}`);
  }

  console.log("");
  console.log("before:");
  report(await check(db, "before"));

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
    const inside = await check(tx, "after");
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
  const after = await check(db, "after");
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

/**
 * Every invariant, read from the database rather than from the plan.
 *
 * Run three times: before the write (where most of them fail, which is the damage this
 * migration exists to repair), inside the transaction before the commit, and after it from
 * a fresh read. The two entry counts are the load-bearing ones — a migration that DELETED
 * the 85 prose sentences instead of moving them satisfies every shape check and every digest
 * check, and its digests are perfectly self-consistent. `EXPECTED_TOTALS` holds the archive's
 * census, computed before this run and never from its output.
 */
async function check(db: Reader, phase: "before" | "after"): Promise<Reading[]> {
  const cardRows = await db.select().from(schema.cardVersion);
  const releaseRows = await db.select().from(schema.release);
  const bundleRows = await db.select({ id: schema.bundle.id, slug: schema.bundle.slug, ownerId: schema.bundle.ownerId }).from(schema.bundle);
  const accountRows = await db.select({ id: schema.account.id, handle: schema.account.handle }).from(schema.account);
  const releaseVectors = await db.select({ id: schema.releaseEmbedding.releaseId }).from(schema.releaseEmbedding);
  const cardVectors = await db.select({ id: schema.cardVersionEmbedding.cardVersionId }).from(schema.cardVersionEmbedding);
  const runReports = await db.select({ id: schema.runReport.id }).from(schema.runReport);
  const notifications = await db.select({ id: schema.notificationQueue.id }).from(schema.notificationQueue);

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

  at("card_version rows", cardRows.length, EXPECTED_TOTALS.cardVersions);
  at("release rows", releaseRows.length, EXPECTED_TOTALS.releases);
  at("bodies carrying a retired key", cardRows.filter((r) => ["requiresHuman", "ontologyVersion", "requires_human", "ontology_version"].some((k) => Object.hasOwn(bodyOf(r), k))).length, 0);
  at("bodies without a `willNot` array", cardRows.filter((r) => !Array.isArray(bodyOf(r).willNot)).length, 0);
  at("prose entries left in `cannot`", cardRows.reduce((n, r) => n + listOf(bodyOf(r).cannot).filter((e) => e.includes(" ")).length, 0), 0);
  at("`cannot` entries, all rows", cardRows.reduce((n, r) => n + listOf(bodyOf(r).cannot).length, 0), EXPECTED_TOTALS.cannotEntries);
  at("`willNot` entries, all rows", cardRows.reduce((n, r) => n + listOf(bodyOf(r).willNot).length, 0), EXPECTED_TOTALS.willNotEntries);
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
    "slugs whose stored digest differs from their committed README",
    releaseRows.filter((r) => {
      const slug = slugOf.get(r.bundleId);
      return slug !== undefined && published.has(slug) && published.get(slug) !== r.digest;
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

  /* Controls. None of these may move; each is a table this migration does not touch. */
  at("bundle rows (control)", bundleRows.length, 20);
  at("account rows (control)", accountRows.length, 3);
  at("release_embedding rows (control)", releaseVectors.length, 7);
  at("card_version_embedding rows (control)", cardVectors.length, 42);
  at("run_report rows (control)", runReports.length, 0);
  at("notification_queue rows (control)", notifications.length, 0);

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
