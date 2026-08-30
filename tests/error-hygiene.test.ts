/* ============================================================
   D-13's hygiene clause, quantified over every published error
   class rather than over the one a module's own author remembered.

   Why it is a guard and not a convention: T090's blind test author
   measured the clause against *four* merged error classes and found
   `ArchiveConflictError` violating it — `Object.keys` gave
   `["name","kind"]` and `JSON.stringify` gave a populated object,
   because both were assigned in the constructor. Neither value was
   caller or driver data, so nothing leaked; the clause was still
   false, in a task that had merged and been tagged, and the
   adversary that reviewed that task had accepted the shape.

   Two things about how it was found are the reason this file exists.

   The clause was satisfied by three modules and violated by one, so
   nothing in any single module's own suite could see it — each was
   locally correct. It took a reader measuring *across* modules, and
   that reader is not guaranteed to exist next time.

   And the four it measured were half the set. There are eight
   published error classes, not four; the other four were never in
   the sample, and their compliance was assumed rather than
   observed. A sample that happens to contain the defect is luck.

   So the domain here is built by **construction** — every directory
   under `lib/server`, every barrel that exists, every export whose
   `prototype instanceof Error`. Nothing is listed by name, so a
   module added later is covered on the day it is added rather than
   on the day someone remembers this file.

   Fails CLOSED in three places, because each is a way the check
   could pass while measuring nothing: a barrel that will not import
   is an error rather than a skipped module, a class that cannot be
   constructed is an error rather than an untested class, and a run
   that discovers no classes at all is an error rather than a
   vacuous green.
   ============================================================ */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SERVER_DIR = fileURLToPath(new URL("../lib/server", import.meta.url));

/** `prototype instanceof Error` — the language's own answer, so no name pattern decides membership. */
function isErrorClass(value: unknown): value is new (...args: never[]) => Error {
  return (
    typeof value === "function" &&
    (value as { prototype?: unknown }).prototype instanceof Error
  );
}

interface Published {
  barrel: string;
  name: string;
  ctor: new (...args: never[]) => Error;
  /** On `backend`, so it counts. Absent means present locally and not yet merged: hygiene only. */
  shipped: boolean;
}

async function publishedErrorClasses(): Promise<{ classes: readonly Published[]; domainSha: string }> {
  /*
   * The domain is what has SHIPPED, not what is in this checkout, and the count below is a property
   * of the shipped tree — so reading `readdirSync` here made the two describe different sets by
   * construction.
   *
   * Measured cost of that: with the floor replaced by an equality, T040's worktree discovered 20
   * (base's 18 plus `engine/LimitExceededError` and `engine/CircularReferenceError`) and reported
   * `expected 20 to be 18`. **There is no value of that constant correct in both trees while the
   * domain is the working tree**: raising it to 20 reds on base until T040 merges. The floor it
   * replaced was too weak; the equality was not too strong, it was counting a different set from the
   * one it was measuring.
   *
   * This is the third file with this shape and I fixed the other two. `architecture-current` had a
   * working-tree domain that made it red in every implementer worktree and unfixable by the session
   * hitting it — `tests/**` is in no task's `Owns`. `store-modules-seal-their-faults` had a `backend`
   * domain read through the working filesystem. Here I made it STRICTER without checking the axis
   * both of those had already been charged on. Found by T040's implementer, one file over from where
   * it was fixed.
   *
   * The import still comes from the working tree, because a class must be CONSTRUCTED to be measured
   * and `git show` yields text. That is sound as long as every shipped barrel exists locally, which
   * is why the missing case below is an error rather than a skip: a worktree behind base gets a
   * message naming the merge, not an ENOENT.
   */
  /*
   * `backend` is resolved ONCE, to a sha, and the walk enumerates against that sha rather than
   * against the name.
   *
   * Every worktree in this run shares one `.git` — one object store, one ref namespace — so
   * `backend` is not a per-worktree fact. It is a **mutable global that this guard dereferences at
   * run time**. Any session committing to base **changes this guard's domain in every worktree at
   * once, including one mid-run**, and nothing in the output would say so: a green would be against
   * a domain that no longer exists, and two sessions running this file simultaneously would be
   * measuring the same moving target rather than their own trees.
   *
   * Resolving once makes a single run internally consistent whatever the ref does under it, and
   * reporting the sha makes a disagreement between two runs legible as *the ref moved* instead of
   * invisible. **A stamp rather than a lock** — locking a ref across worktrees would serialise
   * committing on running, which is a far larger cost than the ambiguity it removes.
   *
   * Reported by T130's adversary, from a worktree three commits behind base, immediately after
   * quoting a minutes-old ref as a stamp in its own report and being corrected for it.
   */
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const domainSha = execFileSync("git", ["rev-parse", "backend"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();

  const shipped = execFileSync("git", ["ls-tree", "-d", "--name-only", domainSha, "lib/server/"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .flatMap((line) => {
      const m = /^lib\/server\/([^/]+)\/?$/.exec(line.trim());
      return m ? [m[1]!] : [];
    })
    .sort();

  const present = new Set(
    readdirSync(SERVER_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );
  const absent = shipped.filter((name) => !present.has(name));
  if (absent.length > 0) {
    throw new Error(
      `These modules are on \`backend\` and absent from this checkout: ${absent.join(", ")}. ` +
        `This guard measures what has shipped, so it cannot run against a tree that is behind base. ` +
        `Merge \`backend\` and re-run.`,
    );
  }
  /*
   * The domain for the COUNT stays `shipped`. The domain for the HYGIENE does not, and that gap was
   * the guard's blind direction.
   *
   * `absent` above catches shipped-but-missing. **Present-but-unshipped was silently uncounted** —
   * a module sitting in an implementer's worktree and not yet on `backend` never entered `barrels`,
   * so its classes were never constructed and D-13's four-part clause was never checked against
   * them. That is unenforced on **exactly the code somebody is actively writing**, which is the code
   * most likely to have got it wrong. Same shape as `rulings-bind`'s `\d{2}`: green over a region
   * because the region is outside the domain.
   *
   * Found by T130's adversary while deriving its own expected value: `lib/server/profiles` is in its
   * tree, is not on `backend`, and `ProfileStoreError` had therefore never been checked by this file
   * and would not be until merge.
   *
   * So the two questions are separated. The count is a claim about what has SHIPPED and stays an
   * equality against `backend`, reproducible at a merge. Hygiene is a claim about what EXISTS and
   * runs over both sets. An unshipped barrel cannot move the number and cannot escape the clause.
   *
   * `unshipped` being empty is the NORMAL state on base and is not an error — unlike every other
   * empty domain in this file. It is non-empty exactly in the worktrees that need it.
   */
  const unshipped = [...present].filter((name) => !shipped.includes(name)).sort();
  const barrels = [...shipped, ...unshipped];

  const found: Published[] = [];
  for (const barrel of barrels) {
    let namespace: Record<string, unknown>;
    try {
      namespace = (await import(`../lib/server/${barrel}/index.ts`)) as Record<string, unknown>;
    } catch (cause) {
      /* Not `continue`. A module whose barrel does not import is a module this check silently
         stopped covering, which is the shape of every defect in this file's history. */
      throw new Error(
        `lib/server/${barrel} has no importable barrel, so its error classes are unmeasured. ` +
          `Give it an index.ts, or this guard's domain is smaller than it claims.`,
        { cause },
      );
    }
    for (const [name, value] of Object.entries(namespace)) {
      if (isErrorClass(value))
        found.push({ barrel, name, ctor: value, shipped: shipped.includes(barrel) });
    }
  }
  return { classes: found, domainSha };
}

/**
 * Two call shapes, because the own-property set can differ between them: an `Error` `cause` is
 * only installed when the option is passed, and a constructor that assigns a field conditionally
 * would satisfy the clause under one shape and violate it under the other.
 */
const SHAPES: readonly (readonly unknown[])[] = [
  ["probe detail"],
  ["probe detail", { code: "23505", constraint: "probe_constraint" }],
];

describe("every published error class satisfies D-13's four-part hygiene clause", () => {
  it("each renders as {} and keeps its stack, at every arity", async () => {
    const { classes, domainSha } = await publishedErrorClasses();

    /* A zero here has three causes and only one of them is good news. This rules out the two bad
       ones: if the walk found nothing, the assertions below would all pass over an empty set. */
    /*
     * EXACT, not a floor, and the change is the point.
     *
     * This was `toBeGreaterThanOrEqual(8)` with a comment saying "if one was added, raise it" —
     * and nothing reds when the raise is skipped, which is the whole defect of a hand-maintained
     * number. Measured at `d7ee3ca`: the walk discovers **17**. Raised to **18** at T081's merge, then to **21** at T040's (`ad44537`) with `engine/{LimitExceededError,CircularReferenceError,UnserializableValueError}` — **and the equality RED at each, which is why it is an equality** (`752721d`), which added `registry/RegistryStoreError` — and the raise happened because the equality RED, which is the whole reason it is an equality. So the floor sat at 8 across
     * T070's three naming classes, T030's six ontology classes and T050's four accounts classes,
     * detecting none of them, and it would no longer have detected any of those nine going
     * missing either. It was written to catch a class the walk stops reaching; after three merges
     * it could only have caught nine disappearing at once.
     *
     * An equality reds in BOTH directions, so a merge that adds a class cannot land without
     * somebody looking at this line, and a class that quietly stops being exported reds
     * immediately rather than being absorbed. The maintenance cost is identical — one number —
     * and the difference is that skipping it is now impossible instead of invisible.
     */
    /*
     * `.filter(shipped)`, because the count is a claim about `backend` and the hygiene loop below is
     * not. Without this an implementer's unmerged class would red the equality in its own worktree —
     * demanding a number that only the merge commit may set, from a session that may not set it,
     * which is the defect `architecture-current` and `store-modules-seal-their-faults` both had to
     * have fixed. The two domains are now different on purpose and each says which it is.
     */
    const shippedClasses = classes.filter((c) => c.shipped);

    expect(
      shippedClasses.length,
      "The number of published error classes changed. This is an EQUALITY rather than a floor, " +
        "deliberately: a floor absorbs additions silently and then stops detecting removals, " +
        "which is what happened here across three merges. If a class was added, raise this number " +
        "in the same commit and say which. If one was removed, lower it and say why — a class " +
        "that stopped being exported is exactly what this walk exists to notice. This counts only " +
        "barrels on `backend`: a module in your worktree that has not merged is checked for HYGIENE " +
        "below and deliberately does not move this number, so a merge commit remains the only place " +
        "it changes. Domain resolved from `backend` at " +
        `${domainSha} — if this number disagrees with another run's, compare that sha first: the ` +
        "ref is shared by every worktree and moves under a running suite.",
    /* 30 -> 32 at T110's merge: `lib/server/lineage` publishes `ForkRefusedError` (the four
       ruled refusal sentences) and `LineageStoreError` (D-13 over the direct `schema.bundle`
       read `archive` publishes no reader for). Derived by this walk against its own domain
       sha, not carried from a worktree -- T110 and T240 EACH computed 30 -> 32 from base 30,
       independently and correctly, because neither tree can see the other's module.

       T240 landed second and took it 32 -> 34: `lib/server/observability` publishes
       `AuditStoreError` and `NotPermittedError`. T091 merged alongside and added NOTHING --
       it reuses the existing eighth message form rather than inventing a ninth, which its
       implementer reported at the time and this number now confirms independently.

       T240's adversary REFUSED my figure of 34 for ITS tree and was right to: the domain is
       `git ls-tree -d backend lib/server/`, the REF, so an unmerged module is hygiene-checked
       and deliberately not counted. Its tree read 32 and its merge moved nothing. The 34 is
       real only here, in the merge commit, which is the whole content of the rule. */
    /* 34 -> 37 at T170's merge: `lib/server/notes` publishes `NoteStoreError`, `NoteBodyError`
       and `InvalidCursorError`. The third exists because D-WAVE-13 ruled that answering a
       malformed cursor with an empty page is a SILENT read truncation -- byte-identical to
       "no notes" and to "you may not read this" -- and a client mid-walk is told the list
       ended. Derived by this walk at the merge, never carried: its implementer enumerated
       three off its own barrel by `prototype instanceof Error` and predicted 37, and this
       is that number measured. */
    /* 37 -> 39 at T150's merge: `lib/server/counters` publishes `CounterStoreError` and
       `NotSignedInError`. Derived by this walk, and the second name is the interesting one --
       both halves reached it independently, and the second axis is not the string but that
       both REJECTED THE SAME TWO CANDIDATES ON THE SAME GROUNDS: `NotAccountOwnerError` is an
       ownership sentence and `toggleStar` has no `accountId` to compare against, and
       `NotPermittedError` hardcodes `listAudit:` into its message. Agreeing on why the
       alternatives fail survives the name coming out differently. */
    /* 39 -> 40 at T200's merge: `lib/server/search` publishes `SearchStoreError` and nothing else.
       ONE class, and the count is the evidence for a claim its author made and I checked — that the
       module authors no refusal of its own beyond the store fault, because every rejection its inputs
       produce belongs to a merged module and leaves unaltered under D-50-08. Derived HERE, at the merge
       commit, against the domain this guard resolves from `backend`: the figure in the handback was a
       report until this run, and a carried number is somebody else's measurement of a different tree. */
    /* 40 -> 44 at the T160+T180 double merge: `lib/server/ballot` publishes BallotRefusedError
       and BallotStoreError, `lib/server/runs` publishes RunReportRefusedError and RunsStoreError.
       Two each, both adversary-verified with the walk re-falsified per module (an enumerable own
       field reds both arities naming the barrel). Derived at THIS merge against the tree landed in;
       both sessions computed 42 from the same base of 40 and were told the second merge would face
       a different figure -- this is that figure. */
    /* 44 -> 45 at T210's merge: `lib/server/terms` publishes TermStoreError and nothing
       else. Derived here; T120 lands next from the same base and faces 47 -> 48 arithmetic
       of its own, derived at ITS merge. */
    /* 45 -> 48 at T120's merge: lifecycle publishes DeletionRefusedError,
       LifecycleStoreError and TransferRefusedError -- exactly three, pinned by its own
       surface cell so a re-export cannot double-count. Derived here. */
    /* 48 -> 50 at T220's merge: lib/server/mcp publishes McpRefusedError and McpStoreError
       (D-220-06), exactly two, ExportError wrapped at the boundary so the surface refuses
       with one voice. Derived here. */
    /* 50 -> 51 at T131's merge (`ProfileRefusedError`, D-131-12's round) — derived at the merge
       commit by the walk, the first class added to an ALREADY-SHIPPED barrel (the guard's
       protection gates the enumeration of barrels, not the classes inside them — measured by
       T131's implementer, which predicted this exact red). */
    /* 51 -> 53 at T190's merge: lib/server/notifications publishes NotificationStoreError and
       UnsubscribeInvalidError, exactly two — the base NotificationError stays off the barrel
       on purpose, so the walk counts leaves and not the family. The carried prediction said
       52; the derived count at 7735db9 said 53, and the derived number is the one this
       equality records. */
    /* 53 -> 47 at the removal of the ontology version registry: `lib/server/ontology` stops
       publishing SIX classes, and the barrel itself stops being a rejection surface at all.
       They were `OntologyStoreError` and its five descendants — `MalformedContentError`,
       `InvalidVocabularyError`, `DuplicateOntologyVersionError`, `VersionBumpTooSmallError`,
       `UnknownOntologyVersionError`. Every one of them was a way for the vocabulary-version
       STORE to refuse a write or for `openView` to refuse a version nobody had published;
       there is no store, no version to publish and no write, so each names a condition that
       cannot occur. This is the first time this number has gone DOWN, which is exactly what
       the message below says the equality exists to notice: a floor would have absorbed the
       removal in silence. Derived here by the walk against the tree the removal landed in,
       not carried from a prediction. */
    ).toBe(47);

    const rendered: string[] = [];
    const traceless: string[] = [];
    const chained: string[] = [];
    for (const { barrel, name, ctor } of classes) {
      for (const args of SHAPES) {
        let instance: Error;
        try {
          instance = new ctor(...(args as never[]));
        } catch (cause) {
          /* Also not a skip: an unconstructible class is one this guard did not measure. */
          throw new Error(
            `${barrel}/${name} could not be constructed with ${args.length} argument(s), so its ` +
              `hygiene is unmeasured. Give the probe a shape it accepts.`,
            { cause },
          );
        }

        const keys = Object.keys(instance);
        const json = JSON.stringify(instance);
        if (keys.length > 0 || json !== "{}") {
          rendered.push(
            `${barrel}/${name} with ${args.length} arg(s): Object.keys=${JSON.stringify(keys)}, ` +
              `JSON.stringify=${json}`,
          );
        }

        /* `Object.keys` and `JSON.stringify` read OWN properties. `for...in` walks the prototype
           chain, and every one of these classes puts `name` on its prototype via `defineProperty`
           with `enumerable: false` — a flag the two readings above cannot see either way. So until
           this loop existed, that flag was decorative: flipping it to `true` changed observable
           behaviour (`for-in` yields `["name"]`) and redded nothing here.

           Found by T240's implementer, which mutated the flag in its own module, scored zero, and
           checked the second axis instead of accepting the zero as inertness. It is the inverse of
           the leak this file already knows: there a non-enumerable property evaded a walker, here
           an own-only walker missed an inherited one. Same seam, opposite direction.

           `name` is EXCLUDED, and the exclusion is the whole calibration. Two patterns coexist in
           this repo — `defineProperty` (non-enumerable) and plain `X.prototype.name = "..."`
           (enumerable) — and 20 merged classes use the second. A walker that flagged them would
           red the whole guard over a class name, which is public API and is what `err.name` is FOR.
           What D-13 protects is `cause`, a driver statement, a credential: anything else reaching
           the prototype enumerably is invisible to both readings above and is what this catches. */
        const inherited: string[] = [];
        for (const key in instance) if (key !== "name") inherited.push(key);
        if (inherited.length > 0) {
          chained.push(
            `${barrel}/${name} with ${args.length} arg(s): for-in=${JSON.stringify(inherited)} ` +
              `(inherited and enumerable — invisible to Object.keys and JSON.stringify)`,
          );
        }

        /* The clause's fourth part, and the only one that is not a statement about enumerability.
           The first three are satisfiable by deleting `stack` — which is precisely how the
           *previous* wording of this clause ("own properties exactly [message, cause]") could be
           satisfied at all, at the cost of every real failure's trace. So the one shape the
           amendment exists to prevent is the one shape the other three assertions cannot see: a
           class that drops `stack` renders as `{}` and passes them all.

           Found by T070's blind author, which falsified this guard four ways against its own module
           rather than trusting its green, and reported the one mutation that survived. */
        if (typeof instance.stack !== "string" || instance.stack === "") {
          traceless.push(
            `${barrel}/${name} with ${args.length} arg(s): stack is ` +
              `${instance.stack === undefined ? "absent" : JSON.stringify(instance.stack)}, ` +
              `not a non-empty string`,
          );
        }
      }
    }

    /* Named in both messages below, because a reader has to know which classes were covered — and
       an unshipped barrel appearing here is a class nobody else's gate can see yet. */
    const covered =
      `Domain from \`backend\` at ${domainSha}. ` +
      `Checked ${classes.length} class(es) across ${new Set(classes.map((c) => c.barrel)).size} ` +
      `barrel(s); unmerged barrels covered for hygiene only: ` +
      `${classes.filter((c) => !c.shipped).map((c) => `${c.barrel}/${c.name}`).join(", ") || "(none)"}. `;

    expect(
      rendered,
      covered +
        "A published error class has an enumerable own property, so anything that renders it — a " +
        "log line, a JSON body, a spread into a response — carries that property with it. Assign " +
        "on the prototype (`X.prototype.name = ...`) or with `Object.defineProperty(this, ..., " +
        "{ enumerable: false })`; a plain `this.x =` in a constructor is always enumerable. The " +
        "field stays readable and `instanceof` is unaffected: only its appearance in a rendering " +
        "changes, which is the entire point of the clause.",
    ).toEqual([]);

    /* The THIRD list, and it is separate for the reason the paragraph below already gives about the
       second. While this shared `rendered`'s assertion, an inherited enumerable property printed
       under a message saying "enumerable OWN property" — which it is not — and advising "assign on
       the prototype", **which is exactly what causes it**. A reader following that remedy makes the
       red worse. Found by T240's adversary, reading the message against the clause rather than
       against the code.

       The remedy really is the opposite one, and the asymmetry is the whole point: an OWN property
       is fixed by moving it to the prototype, an INHERITED one by making the prototype write
       non-enumerable. One message cannot carry both without pointing half its readers the wrong way. */
    expect(
      chained,
      "A published error class has an enumerable property on its PROTOTYPE CHAIN — not an own " +
        "property, so `Object.keys` and `JSON.stringify` cannot see it and the two assertions " +
        "above pass. `for...in` walks the chain, and so does anything that copies an object by " +
        "iterating it. Do NOT 'assign on the prototype' to fix this: a plain " +
        "`X.prototype.foo = ...` IS enumerable and is how this red is usually produced. Use " +
        "`Object.defineProperty(X.prototype, 'foo', { value })`, which defaults to " +
        "`enumerable: false`. `name` is excluded from this walk deliberately — 20 merged classes " +
        "set it by plain assignment and a class name is public API, which is what `err.name` is for.",
    ).toEqual([]);

    /* Reported separately, and not because two lists are tidier. While these shared one assertion,
       a missing `stack` printed under a name saying "enumerable own property" and advice saying to
       use `enumerable: false` — a defect the author does not have and a remedy that does nothing
       for the one they do. The reader of a failure message is by construction someone who has just
       made a mistake, and pointing them at a different one costs more than saying nothing.

       Found by T090's implementer, falsifying the new assertion against its own class: the
       assertion was widened and the surface that reports it was not. */
    expect(
      traceless,
      "A published error class has no usable `stack`, so every real failure it names loses its " +
        "trace. This is NOT an enumerability problem and `enumerable: false` does not address it: " +
        "something is deleting or overwriting `stack`. Note why the clause names it at all — the " +
        "previous wording of D-13 (own properties exactly [message, cause]) could be satisfied " +
        "ONLY by deleting `stack`, so this is the precise shape the amendment exists to prevent, " +
        "and the other three parts of the clause cannot see it: a class with no `stack` still " +
        "renders as {}.",
    ).toEqual([]);
  });
});
