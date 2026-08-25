"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { prettyDate } from "@/lib/format";
import { deleteJson, errorMessage, getJson, postJson } from "./live";

/* ============================================================
   DarkPrint frontend — §06 API keys, new at T280
   `GET`/`POST /api/account/keys` and `DELETE
   /api/account/keys/[keyId]` (T230) predate this page's wiring by a
   wave and are unrelated to the Save/Discard flow above — nothing
   here reads `AccountForm`'s state and nothing it does marks that
   form dirty, which is the sense in which this section sits
   "outside" it.

   ── the two record shapes below are NOT `ApiKeyRecord` ──
   `lib/server/limits`'s `ApiKeyRecord` types `createdAt`/`revokedAt`
   as `Date`, which is exactly right for a value read in-process and
   exactly wrong for one that crossed `JSON.stringify` — `Date` has
   no wire form, and what actually lands in `response.json()` is the
   ISO string `Date.prototype.toJSON` produced. Casting the parsed
   JSON to the server's own type would let `record.createdAt.toISOString()`
   compile and throw the moment it ran, on a value that was a string
   all along. `KeyRow` names what this file really receives.

   ── `MAX_LABEL_LENGTH` is a literal, not an import ──
   `PrefixedField`'s reason, in `controls.tsx`: this is a client
   component, and `@/lib/server/limits` reaches `@/lib/db`. The
   number is a client cap and not enforcement either way — `issueKey`
   refuses a label over 100 characters regardless of what this file
   sends, which is `isValidLabel`'s job and not this one's.
   ============================================================ */

const MAX_LABEL_LENGTH = 100;

interface KeyRow {
  keyId: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
}

/** `"2026-08-25T12:00:00.000Z"` -> `"Aug 25, 2026"`. `prettyDate` wants a date-only string;
    the wire value is a full timestamp, and the settings surface has never shown finer than a
    day anywhere else on this page (`monthYear` for the account's own join date, one section
    up). */
function friendly(iso: string): string {
  return prettyDate(iso.slice(0, 10));
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
                created {friendly(key.createdAt)}
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
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | undefined>(undefined);
  /* The one place the secret ever lives on this page — `record` carries no field for it and
     never will (`lib/server/limits/types.ts`'s own guarantee), so this is a plain `useState`
     that a "Done" press throws away rather than a value derived from `keys`. */
  const [minted, setMinted] = useState<{ label: string; secret: string } | undefined>(undefined);

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
    postJson<{ record: KeyRow; secret: string }>("/api/account/keys", { label: trimmed })
      .then(({ record, secret }) => {
        setKeys((rows) => [record, ...(rows ?? [])]);
        setMinted({ label: record.label, secret });
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
      <p className="text-[13px] leading-relaxed text-muted">
        A key raises the rate ceiling for an agent reading the registry over the MCP
        endpoints; it carries no identity, so it signs nothing in and authorizes no write.
        Anything that changes your account or your bundles still needs your session. It is
        shown to you once, at the moment you mint it: DarkPrint never stores it and cannot
        show it to you again, so a key you lose is a key you revoke and mint again.
      </p>

      {minted !== undefined && (
        <div className="flex flex-col gap-2 rounded-md border border-cyan/40 bg-cyan/[0.06] p-4">
          <span className="text-sm text-fg">
            &ldquo;{minted.label}&rdquo; is ready. Copy it now; this is the only time it is
            shown.
          </span>
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
        <Button disabled={label.trim() === "" || minting} onClick={mint}>
          {minting ? "Minting…" : "Create key"}
        </Button>
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
