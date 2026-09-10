"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { prettyDate } from "@/lib/format";
import { deleteJson, errorMessage, getJson, postJson } from "./live";

/* ============================================================
   DarkPrint frontend — settings, the API keys section
   `GET`/`POST /api/account/keys` and `DELETE
   /api/account/keys/[keyId]` serve it. Nothing here reads
   `AccountForm`'s state and nothing it does marks that form dirty,
   which is the sense in which this section sits outside the
   Save/Discard flow above it.

   ── the record shape below is NOT `ApiKeyRecord` ──
   `lib/server/limits`'s `ApiKeyRecord` types `createdAt`/`revokedAt`
   as `Date`, which is right for a value read in-process and wrong
   for one that crossed `JSON.stringify`: what lands in
   `response.json()` is the ISO string `Date.prototype.toJSON`
   produced. Casting the parsed JSON to the server's own type would
   let `record.createdAt.toISOString()` compile and throw the moment
   it ran. `KeyRow` names what this file really receives.

   ── `MAX_LABEL_LENGTH` and the scopes are literals, not imports ──
   This is a client component, and `@/lib/server/limits` reaches
   `@/lib/db`. The server is the authority either way: `issueKey`
   refuses a label over 100 characters regardless of what this file
   sends, and every sentence rendered about a minted key is chosen
   from the scope the server answered with rather than the one that
   was asked for.
   ============================================================ */

const MAX_LABEL_LENGTH = 100;

type Scope = "read" | "write";

interface KeyRow {
  keyId: string;
  label: string;
  scope: Scope;
  createdAt: string;
  revokedAt: string | null;
}

/**
 * The publish call a write key unlocks, as the holder will paste it. `publish.json` is the
 * same JSON the upload page sends: `ownerHandle`, `slug`, `version`, `manifest`, `dot` and
 * `cardFiles` (filename to YAML text). Exported so the test reads the string the page shows.
 */
export const PUBLISH_CURL = [
  "curl -X POST https://www.darkprint.io/api/bundles \\",
  '  -H "Authorization: Bearer $DARKPRINT_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  "  --data @publish.json",
].join("\n");

/**
 * What each scope means, in the words its holder gets at the one moment they read anything.
 * A key is shown once, when it is minted, so a holder cannot be told later; each sentence
 * has to describe what the routes do today. Exported so the test reads the same strings.
 */
export const SCOPE_COPY: Record<Scope, { name: string; blurb: string }> = {
  read: {
    name: "Read",
    blurb:
      "It raises the rate ceiling for reads over the MCP endpoints and authorises no write. " +
      "Anything that changes your account or your bundles needs a write key or your session.",
  },
  write: {
    name: "Write",
    blurb:
      "It acts as your account on the write routes: publishing a release with " +
      "POST /api/bundles or a card with POST /api/cards, and posting a run report with " +
      "POST /api/blueprints/{owner}/{slug}/runs. " +
      "Send it as a bearer token from a terminal or an agent; no browser session is needed. " +
      "Revoking it is the only way to take that back.",
  },
};

/** `"2026-08-25T12:00:00.000Z"` -> `"Aug 25, 2026"`. `prettyDate` wants a date-only string;
    the wire value is a full timestamp, and the settings surface has never shown finer than a
    day anywhere else on this page (`monthYear` for the account's own join date, one section
    up). */
function friendly(iso: string): string {
  return prettyDate(iso.slice(0, 10));
}

/** The curl a write key is for, shown wherever the write sentence is. */
function PublishExample() {
  return (
    <pre className="overflow-x-auto rounded-md border border-line bg-void px-3 py-2 font-mono text-[12px] leading-relaxed text-fg">
      <code>{PUBLISH_CURL}</code>
    </pre>
  );
}

function KeyList({
  keys,
  revokingId,
  onRevoke,
}: {
  keys: readonly KeyRow[];
  revokingId: string | undefined;
  onRevoke: (keyId: string) => void;
}) {
  if (keys.length === 0) {
    return <p className="font-mono text-[11px] text-dim">No keys yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
      {keys.map((key) => {
        const revoked = key.revokedAt !== null;
        return (
          <li key={key.keyId} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-sm text-fg">{key.label}</span>
              <span className="font-mono text-[11px] text-dim">
                {/* The scope comes off the record the server answered with, so a row reports
                    what the key IS rather than what the form asked for. Every key minted
                    before the column existed reads `read` here, which is the promise it was
                    issued under showing up where its holder looks for it. */}
                {key.scope} · created {friendly(key.createdAt)}
                {revoked && ` · revoked ${friendly(key.revokedAt as string)}`}
              </span>
            </span>
            {revoked ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-dim">
                revoked
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-signal/50! text-signal!"
                disabled={revokingId === key.keyId}
                onClick={() => onRevoke(key.keyId)}
              >
                {revokingId === key.keyId ? "Revoking…" : "Revoke"}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ApiKeys() {
  const [keys, setKeys] = useState<readonly KeyRow[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<Scope>("read");
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | undefined>(undefined);
  /* The one place the secret ever lives on this page — `record` carries no field for it and
     never will (`lib/server/limits/types.ts`'s own guarantee), so this is a plain `useState`
     that a "Done" press throws away rather than a value derived from `keys`. */
  const [minted, setMinted] = useState<
    { label: string; secret: string; scope: Scope; asked: Scope } | undefined
  >(undefined);

  const [revokingId, setRevokingId] = useState<string | undefined>(undefined);
  const [revokeError, setRevokeError] = useState<string | undefined>(undefined);

  useEffect(() => {
    getJson<{ keys: readonly KeyRow[] }>("/api/account/keys")
      .then(({ keys: fetched }) => setKeys(fetched))
      .catch((cause: unknown) => setLoadError(errorMessage(cause)));
  }, []);

  const mint = () => {
    const trimmed = label.trim();
    if (trimmed === "") return;
    setMinting(true);
    setMintError(undefined);
    postJson<{ record: KeyRow; secret: string }>("/api/account/keys", { label: trimmed, scope })
      .then(({ record, secret }) => {
        setKeys((rows) => [record, ...(rows ?? [])]);
        /* `record.scope` and not `scope`. The panel below tells the holder what this key can
           do, at the one moment they will read it, so the sentence has to come from the
           server's answer. The requested value is kept beside it only to say when the two
           disagreed — which is what a route that has not learned to read `scope` yet looks
           like from here, and it must be visible rather than silently flattering. */
        setMinted({ label: record.label, secret, scope: record.scope, asked: scope });
        setLabel("");
      })
      .catch((cause: unknown) => setMintError(errorMessage(cause)))
      .finally(() => setMinting(false));
  };

  const revoke = (keyId: string) => {
    setRevokingId(keyId);
    setRevokeError(undefined);
    deleteJson<{ keys: readonly KeyRow[] }>(`/api/account/keys/${keyId}`)
      .then(({ keys: fresh }) => setKeys(fresh))
      .catch((cause: unknown) => setRevokeError(errorMessage(cause)))
      .finally(() => setRevokingId(undefined));
  };

  return (
    <div className="flex flex-col gap-4">
      {/* What is true of EVERY key stays here. What depends on the scope moved next to the
          picker, because it is no longer one sentence: the read sentence is the promise
          existing keys were issued under and it is reproduced verbatim in `SCOPE_COPY`. */}
      <p className="text-[13px] leading-relaxed text-muted">
        A key raises the rate ceiling for an agent reading the registry over the MCP
        endpoints. What else it may do is its scope, which you choose when you mint it and
        cannot change afterwards. The key is shown to you once, at that moment. DarkPrint
        never stores it. If you lose it, revoke it and mint a new one.
      </p>

      {minted !== undefined && (
        <div className="flex flex-col gap-2 rounded-md border border-cyan/40 bg-cyan/[0.06] p-4">
          <span className="text-sm text-fg">
            &ldquo;{minted.label}&rdquo; is ready, with {minted.scope} scope. Copy it now.
            This is the only time it is shown.
          </span>
          <span className="text-[13px] leading-relaxed text-muted">
            {SCOPE_COPY[minted.scope].blurb}
          </span>
          {minted.scope === "write" && <PublishExample />}
          {minted.asked !== minted.scope && (
            /* Not decoration and not an error state. The scope is decided by the server, and
               a mismatch means the request for one was not honoured. Saying so is the only
               thing that keeps the sentence above from reading as a description of the key
               the holder asked for rather than of the key they got. */
            <span role="alert" className="text-[13px] leading-relaxed text-signal">
              You asked for {minted.asked} scope and this key was minted with{" "}
              {minted.scope} scope. Revoke it and try again, or use it as a {minted.scope}{" "}
              key.
            </span>
          )}
          <code className="overflow-x-auto rounded-md border border-line bg-void px-3 py-2 font-mono text-[13px] text-fg">
            {minted.secret}
          </code>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(minted.secret);
              }}
            >
              Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMinted(undefined)}>
              Done, I&rsquo;ve saved it
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2">
          <span className="label">Label</span>
          <input
            type="text"
            value={label}
            maxLength={MAX_LABEL_LENGTH}
            placeholder="CI, laptop, the crawler…"
            onChange={(event) => setLabel(event.target.value)}
            className="h-10 w-64 rounded-md border border-line bg-void px-3 text-sm text-fg transition-colors focus:border-cyan"
          />
        </label>
        {/* A native select inside its own `label`, matching the field beside it. A custom
            control here would owe keyboard handling and a listbox role for a two-item choice
            the platform already renders accessibly. `read` is first and is the default, so
            the affordance agrees with the column: a holder who chooses nothing gets the
            scope every existing key has. */}
        <label className="flex flex-col gap-2">
          <span className="label">Scope</span>
          <select
            value={scope}
            /* The paragraph below is what the choice actually MEANS, and a select announces
               only its option label. Without this, a screen reader hears "Write" and never
               the sentence saying what a write key can do today. */
            aria-describedby="api-key-scope-blurb"
            onChange={(event) => setScope(event.target.value as Scope)}
            className="h-10 w-40 rounded-md border border-line bg-void px-3 text-sm text-fg transition-colors focus:border-cyan"
          >
            <option value="read">{SCOPE_COPY.read.name}</option>
            <option value="write">{SCOPE_COPY.write.name}</option>
          </select>
        </label>
        <Button disabled={label.trim() === "" || minting} onClick={mint}>
          {minting ? "Minting…" : "Create key"}
        </Button>
      </div>
      {/* Under the picker rather than inside the option list, because it is a paragraph and
          an `<option>` renders one line of plain text. It changes as the choice changes, so
          the sentence a holder reads before minting is the sentence about the key they are
          about to get. */}
      <div id="api-key-scope-blurb" className="flex flex-col gap-2">
        <p className="text-[13px] leading-relaxed text-muted">{SCOPE_COPY[scope].blurb}</p>
        {scope === "write" && <PublishExample />}
      </div>
      {mintError !== undefined && (
        <p role="alert" className="text-[13px] text-signal">
          {mintError}
        </p>
      )}

      {loadError !== undefined && (
        <p role="alert" className="text-[13px] text-signal">
          {loadError}
        </p>
      )}
      {revokeError !== undefined && (
        <p role="alert" className="text-[13px] text-signal">
          {revokeError}
        </p>
      )}
      {keys === undefined && loadError === undefined ? (
        <p className="font-mono text-[11px] text-dim">Loading…</p>
      ) : (
        <KeyList keys={keys ?? []} revokingId={revokingId} onRevoke={revoke} />
      )}
    </div>
  );
}
