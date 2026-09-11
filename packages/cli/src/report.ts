/* ============================================================
   darkprint CLI — `report`
   `POST /api/blueprints/{owner}/{slug}/runs` has been live since
   T280 and nothing has ever walked through it. Attractor writes a
   run directory with a fixed layout (spec §5.6), a person who has
   just run a blueprint has one on disk, and until now the only way
   to submit what it says was to hand-write JSON and find a session
   cookie. This is that path, and the whole design problem is which
   figures the directory really carries.

   ── the run directory, and exactly what it holds ──
   Spec §5.6:

       {logs_root}/
           checkpoint.json       serialized checkpoint after each node
           manifest.json         pipeline metadata (name, goal, start time)
           {node_id}/
               status.json       node execution outcome
               prompt.md         rendered prompt
               response.md       LLM response
           artifacts/
               {artifact_id}.json

   `checkpoint.json`'s fields ARE specified (§5.3): `timestamp`,
   `current_node`, `completed_nodes`, `node_retries`, `context`,
   `logs`. `status.json`'s fields ARE specified (Appendix C):
   `outcome`, `preferred_label`, `suggested_next_ids`,
   `context_updates`, `notes`. **`manifest.json`'s are NOT** — the
   spec describes it in five words and names no key — so this reads
   it tolerantly, over a list of plausible spellings, and PRINTS
   which key it believed. A guess stated is different from a guess
   made.

   ── the hole, and why it is a refusal rather than a zero ──
   **No file in that layout records token usage, spend or a model
   price.** Appendix C's five fields are routing and prose; nothing
   in §5 counts a token. So `costUnits` cannot come from the
   directory, and it is the one figure that lands in a published
   aggregate: `reportedCost` takes the MEDIAN of the modal model
   group and `lib/content/view.ts:199` puts it on the bar the
   scorecard draws. **A zero submitted for "we did not measure it"
   is not a missing value in that median, it is a cheap run**, and
   enough of them move the number for everybody reading the page.
   So `--cost` is required, it is the one field no manifest key may
   supply however the runner spelled it, and a run with no cost is
   refused before anything is sent.

   ── the hole is WIDER than cost, and that is reported too ──
   `RunReport` also requires `provider`, `hardware`, `harnessVersion`
   and `inputSize`, and Attractor's layout records none of them
   either. Those take the same shape — a flag, or a manifest key if
   the runner happened to write one — because unlike cost they are
   labels rather than quantities: a wrong `hardware` mislabels one
   report, where a wrong cost moves everybody's median. `hardware`
   is NOT read off the machine running this command. That machine
   may not be the machine that ran the pipeline, and the platform
   never observes a run (`lib/types.ts:27-36`).

   ── the credential ──
   The route is `withSession`. No write route in this product
   accepts an API key (D-270-01 C4), so this sends a session cookie
   from `DARKPRINT_SESSION` and refuses offline when there is none.
   See `resolveSession` in `./registry` for why that is a limit
   rather than a design.
   ============================================================ */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import type { ReportedCostUnits } from "../../../lib/server/runs";
import { CliError } from "./errors";
import { postRunReport, resolveOptions, resolveSession, type RegistryOverrides } from "./registry";

/** §5.6's names, spelled once. */
export const RUN_MANIFEST = "manifest.json";
export const RUN_CHECKPOINT = "checkpoint.json";
export const RUN_STATUS = "status.json";
export const RUN_ARTIFACTS = "artifacts";

/**
 * The keys a `manifest.json` might carry the start instant under.
 *
 * The spec says "pipeline metadata (name, goal, start time)" and stops, so there is no
 * canonical spelling to bind. Ordered most-explicit first, and the one that matched is
 * printed, because a reader has to be able to see which field this believed. Adding a
 * spelling here is cheap; guessing silently between two that are both present is not, so
 * the FIRST match wins and the order is the decision.
 */
const STARTED_KEYS = [
  "started_at",
  "startedAt",
  "start_time",
  "startTime",
  "started",
  "start",
  "created_at",
  "createdAt",
] as const;

/** The same treatment for the four labels the layout does not record either. */
const MODEL_KEYS = ["model", "llm_model", "llmModel", "default_model"] as const;
const PROVIDER_KEYS = ["provider", "llm_provider", "llmProvider"] as const;
const HARDWARE_KEYS = ["hardware", "machine", "host"] as const;
const HARNESS_KEYS = ["harness_version", "harnessVersion", "version", "attractor_version"] as const;
const INPUT_SIZE_KEYS = ["input_size", "inputSize"] as const;

/** One node's own directory, as far as Appendix C describes it. */
export interface RunNode {
  id: string;
  /** Appendix C's enum: `success | retry | fail | partial_success`. Absent if unwritten. */
  outcome?: string;
  notes?: string;
}

/** A run directory, read. Nothing here is interpreted yet. */
export interface RunDirectory {
  root: string;
  manifest: Record<string, unknown>;
  /** The key `startedAt` was read from, so a caller can print it. */
  startedFrom?: string;
  startedAt?: Date;
  /** §5.3's `timestamp`, the instant of the last checkpoint. */
  checkpointAt?: Date;
  nodes: readonly RunNode[];
  artifacts: number;
}

/** What `report` sends and what came back. Returned rather than printed (D-270-03(2)). */
export interface ReportResult {
  owner: string;
  slug: string;
  /** Exactly the body that was posted, so a caller can show what was claimed. */
  sent: Record<string, unknown>;
  /** Which manifest key the start instant was read from, if it came from the manifest. */
  startedFrom?: string;
  /** Outcomes seen in the run directory, for context. Never sent: the route has no field. */
  outcomes: Readonly<Record<string, number>>;
  /** The aggregate the route answers with, at this digest's modal model group. */
  reported?: ReportedCostUnits;
}

export interface ReportOptions extends RegistryOverrides {
  /** `<owner>/<slug>`. Required, and refused offline when absent. */
  target?: string;
  /** The one figure no manifest key may supply. Required. */
  cost?: number;
  model?: string;
  provider?: string;
  hardware?: string;
  harnessVersion?: string;
  inputSize?: number;
  /** Omitted means the bundle's CURRENT release, resolved by the route (D-180-01). */
  digest?: string;
  /** Overrides `DARKPRINT_SESSION`, for a caller that has one in hand. */
  session?: string;
}

/* --------------------- reading the directory --------------------- */

function readJson(path: string, what: string): Record<string, unknown> {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new CliError(`report: ${what} has no ${path.split("/").pop() ?? path}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    /* The parser's own message and not the file's bytes: a checkpoint carries the whole run
       context, and echoing it into a terminal is how a prompt or a secret ends up in a
       scrollback. `cause` keeps it for anything that wants it (D-13). */
    throw new CliError(`report: ${path} is not readable JSON.`, { cause });
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliError(`report: ${path} is not a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

/** A key's value if it is present, a non-empty string and its OWN property. */
function ownString(source: Record<string, unknown>, key: string): string | undefined {
  if (!Object.hasOwn(source, key)) return undefined;
  const value = source[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** The first of `keys` this object carries, and which one it was. */
function firstOf(
  source: Record<string, unknown>,
  keys: readonly string[],
): { key: string; value: string } | undefined {
  for (const key of keys) {
    const value = ownString(source, key);
    if (value !== undefined) return { key, value };
  }
  return undefined;
}

/**
 * An instant, or `undefined`.
 *
 * Accepts an ISO string and a unix epoch in seconds or milliseconds, because §5.3 calls the
 * field a `Timestamp` and does not say which. The seconds/milliseconds split is taken at
 * the year 3000 in milliseconds, which is 33 millennia away in seconds — no real run lands
 * between them in either reading, so the guess is never close.
 */
function instant(value: unknown): Date | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const at = new Date(value < 32_503_680_000 ? value * 1000 : value);
    return Number.isNaN(at.getTime()) ? undefined : at;
  }
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const at = new Date(value.trim());
  return Number.isNaN(at.getTime()) ? undefined : at;
}

/**
 * The run directory as §5.6 lays it out.
 *
 * Missing pieces are absent members rather than throws, except for the directory itself and
 * `manifest.json`: without those there is nothing to read and no useful report to build. A
 * node with no `status.json` is a node that has not run, which is an ordinary state for a
 * pipeline that stopped early and not an error in the file.
 */
export function readRunDirectory(dir: string): RunDirectory {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch (cause) {
    throw new CliError(`report: ${dir} is not a directory this can read.`, { cause });
  }

  const manifest = readJson(join(dir, RUN_MANIFEST), `${dir}`);
  const started = firstOf(manifest, STARTED_KEYS);
  const startedAt = started === undefined ? undefined : instant(started.value);

  let checkpointAt: Date | undefined;
  if (entries.includes(RUN_CHECKPOINT)) {
    /* §5.3 names this key, so exactly one spelling is read. The tolerance above is for
       `manifest.json`, whose fields the spec never names, and widening it to a field that IS
       specified would make the two indistinguishable to a reader of this file. */
    checkpointAt = instant(readJson(join(dir, RUN_CHECKPOINT), `${dir}`).timestamp);
  }

  const nodes: RunNode[] = [];
  for (const entry of entries.sort()) {
    if (entry === RUN_ARTIFACTS) continue;
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    const statusPath = join(full, RUN_STATUS);
    let status: Record<string, unknown> | undefined;
    try {
      status = JSON.parse(readFileSync(statusPath, "utf8")) as Record<string, unknown>;
    } catch {
      status = undefined;
    }
    const node: RunNode = { id: entry };
    const outcome = status === undefined ? undefined : ownString(status, "outcome");
    if (outcome !== undefined) node.outcome = outcome;
    const notes = status === undefined ? undefined : ownString(status, "notes");
    if (notes !== undefined) node.notes = notes;
    nodes.push(node);
  }

  let artifacts = 0;
  try {
    artifacts = readdirSync(join(dir, RUN_ARTIFACTS)).length;
  } catch {
    artifacts = 0;
  }

  return {
    root: dir,
    manifest,
    ...(started === undefined ? {} : { startedFrom: started.key }),
    ...(startedAt === undefined ? {} : { startedAt }),
    ...(checkpointAt === undefined ? {} : { checkpointAt }),
    nodes,
    artifacts,
  };
}

/* --------------------- the verb --------------------- */

/** `<owner>/<slug>`, refused offline. `bump`'s own rule, and the same sentence shape. */
function splitTarget(target: string | undefined): { owner: string; slug: string } {
  if (target === undefined || target === "") {
    throw new CliError("report: give --target <owner>/<slug>.");
  }
  const parts = target.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new CliError("report: --target must be <owner>/<slug>.");
  }
  return { owner: parts[0], slug: parts[1] };
}

/**
 * Submit what a run directory says about one run.
 *
 * Every refusal below happens BEFORE the network, and every one of them names the field and
 * why the directory could not supply it. That order is the difference between a person
 * being told which flag to add and a person being told `runs: the report is malformed.` by
 * a server four fields later.
 */
export async function report(
  dir: string,
  options: ReportOptions | undefined = undefined,
): Promise<ReportResult> {
  const { owner, slug } = splitTarget(options?.target);
  const run = readRunDirectory(dir);

  /* Cost first, and alone, because it is the only field here whose wrongness is somebody
     else's problem. Checked for finiteness and sign the same way `lib/server/runs`'
     `wellFormed` checks it, so a refusal happens here with a reason rather than there
     without one. */
  const cost = options?.cost;
  if (cost === undefined) {
    throw new CliError(
      "report: give --cost <units>. Attractor's run directory records no token usage. " +
        `${RUN_STATUS} carries an outcome, a label, suggested next ids, context updates and ` +
        "notes, and nothing in the layout counts a token or a price. Sending 0 for an " +
        "unmeasured run would not read as missing: the registry takes the MEDIAN of the " +
        "reports at a release, so a zero is a cheap run and it moves the figure everybody " +
        "else reads.",
    );
  }
  if (!Number.isFinite(cost) || cost < 0) {
    throw new CliError("report: --cost must be a number that is not negative.");
  }

  if (run.startedAt === undefined) {
    throw new CliError(
      `report: ${join(dir, RUN_MANIFEST)} carries no start time this could read. The ` +
        "Attractor spec describes that file as \"pipeline metadata (name, goal, start " +
        `time)\" and names no field, so this looked for ${STARTED_KEYS.join(", ")} and ` +
        "found none of them holding a readable instant.",
    );
  }
  if (run.checkpointAt === undefined) {
    throw new CliError(
      `report: ${join(dir, RUN_CHECKPOINT)} carries no \`timestamp\`, so there is no end ` +
        "instant and the duration cannot be derived. Attractor writes that file after each " +
        "node, so a run that finished a node has one.",
    );
  }

  /* The whole run's wall clock, from two instants the runner itself recorded: the start in
     the manifest and the last checkpoint. It is NOT the sum of the nodes' own durations,
     which no file in the layout carries — a pipeline that waited an hour at a `hexagon` for
     a person reports that hour, correctly, because that is how long the run took. */
  const durationMs = Math.round(run.checkpointAt.getTime() - run.startedAt.getTime());
  if (durationMs < 0) {
    throw new CliError(
      `report: the last checkpoint in ${dir} is BEFORE the start time in ${RUN_MANIFEST}, ` +
        "so the two files describe no run this can report.",
    );
  }

  /* The four labels and the model: a flag, then a manifest key if the runner wrote one,
     then a refusal naming every one that is still missing. Named TOGETHER rather than one
     per run, because finding out about four required flags four commands apart is the
     failure this whole block exists to avoid. */
  const fromManifest = (keys: readonly string[]) => firstOf(run.manifest, keys)?.value;
  /* An empty string reads as ABSENT, not as a value. `parseFlags` gives a flag written with
     no value after it the empty string, so `darkprint report ./run --model --provider x`
     would otherwise send `model: ""` and be refused by `wellFormed` on the server with a
     sentence that names no field. */
  const given = (value: string | undefined) =>
    value === undefined || value.trim() === "" ? undefined : value.trim();
  const model = given(options?.model) ?? fromManifest(MODEL_KEYS);
  const provider = given(options?.provider) ?? fromManifest(PROVIDER_KEYS);
  const hardware = given(options?.hardware) ?? fromManifest(HARDWARE_KEYS);
  const harnessVersion = given(options?.harnessVersion) ?? fromManifest(HARNESS_KEYS);
  const inputSize =
    options?.inputSize ??
    (() => {
      const text = fromManifest(INPUT_SIZE_KEYS);
      const n = text === undefined ? Number.NaN : Number(text);
      return Number.isInteger(n) && n >= 0 ? n : undefined;
    })();
  /* Checked HERE as well as at the flag, because a programmatic caller reaches this without
     going through `run.ts`. `wellFormed` requires a non-negative integer, so a `2.5` sent
     from here comes back as `runs: the report is malformed.` and names nothing. */
  if (inputSize !== undefined && (!Number.isInteger(inputSize) || inputSize < 0)) {
    throw new CliError("report: --input-size must be a whole number that is not negative.");
  }

  const missing: string[] = [];
  if (model === undefined) missing.push("--model <name>");
  if (provider === undefined) missing.push("--provider <name>");
  if (hardware === undefined) missing.push("--hardware <description>");
  if (harnessVersion === undefined) missing.push("--harness <version>");
  if (inputSize === undefined) missing.push("--input-size <count>");
  if (missing.length > 0) {
    throw new CliError(
      `report: give ${missing.join(", ")}. A run report carries these and Attractor's run ` +
        "directory records none of them, so they are yours to state. `--hardware` is not " +
        "read off this machine: the machine reporting a run need not be the machine that " +
        "ran it, and the registry never observes a run.",
    );
  }

  /* The credential, checked offline. The route is `withSession` and no write route in this
     product accepts an API key, so an absent session is a refusal here rather than a 401
     four hundred milliseconds later that says nothing about what to do next. */
  const session = resolveSession(options?.session);
  if (session === undefined) {
    throw new CliError(
      "report: set DARKPRINT_SESSION to a signed-in session cookie. A run report is " +
        "recorded against an account, and the route that takes one reads a session. No " +
        "write route in DarkPrint accepts an API key, so DARKPRINT_API_KEY cannot stand in.",
    );
  }

  const sent: Record<string, unknown> = {
    model,
    provider,
    hardware,
    inputSize,
    harnessVersion,
    costUnits: cost,
    durationMs,
    /* An ISO string: JSON has no `Date`, and the route converts exactly this back
       (`new Date(body.occurredAt)`). A number would become an `Invalid Date` there and be
       refused as malformed with no hint about which field. */
    occurredAt: run.startedAt.toISOString(),
    ...(options?.digest === undefined ? {} : { releaseDigest: options.digest }),
  };

  const body: unknown = JSON.parse(
    await postRunReport(resolveOptions(options), session, owner, slug, sent),
  );
  const reported = (body as { reported?: unknown }).reported;

  const outcomes: Record<string, number> = {};
  for (const node of run.nodes) {
    const key = node.outcome ?? "no status.json";
    outcomes[key] = (outcomes[key] ?? 0) + 1;
  }

  return {
    owner,
    slug,
    sent,
    ...(run.startedFrom === undefined ? {} : { startedFrom: run.startedFrom }),
    outcomes,
    ...(typeof reported === "object" && reported !== null
      ? { reported: reported as ReportedCostUnits }
      : {}),
  };
}
