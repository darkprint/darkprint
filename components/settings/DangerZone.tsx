"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { DeletionPlan, TransferPlan } from "@/lib/server/lifecycle";
import { errorMessage, getJson, postJson } from "./live";

/* ============================================================
   DarkPrint frontend — §07 Danger zone, live
   Both routes behind this file (T120) predate T280 by a wave —
   they were already merged and already worked when this page still
   showed them switched off with "no route ... yet". What T280 adds
   is the wiring, not the backend.

   ── the two actions share a shape, and the shape is not decoration ──
   AC3 in T120's own contract is "refused before anything moves",
   which is a claim about a PREVIEW existing, and a control with no
   preview step has nowhere to show a caller what "before" means. So
   both actions expand into: preview (a GET that writes nothing),
   confirm, act. `GET /api/account/delete/plan` and `GET
   /api/transfer/plan` are exactly that surface (D-120-18).

   Two independent state trees rather than one shared "danger zone"
   state, because the two actions do not share a confirmation, a
   request or a failure — a delete's error must never leave the
   transfer form blocked, or the reverse.
   ============================================================ */

/**
 * One of the caller's own bundles, resolved server-side into the shape the Transfer picker
 * needs.
 *
 * `lib/server/registry`'s `ownedBundles` serves the profile shelf and is keyed by slug alone
 * — it never needed a bundle id, because nothing on that shelf addresses one by id. Transfer
 * does (`POST /api/transfer` takes `bundleId`, a UUID), so `app/settings/page.tsx` joins each
 * owned row against `getBundle(db, accountId, slug)` once, server-side, before this component
 * ever mounts — a client component may not reach `@/lib/server/archive` itself.
 */
export interface TransferableBundle {
  bundleId: string;
  slug: string;
  title?: string;
  visibility: "public" | "private";
}

function DeletePlanFigures({ plan }: { plan: DeletionPlan }) {
  /* Four figures, not a total: `DeletionPlan` partitions the account's holdings by OUTCOME
     (D-120-09), and a reader reviewing an irreversible action needs to see what dies
     separately from what survives, not a sum that hides the split. */
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-signal/25 bg-signal/[0.04] p-4 font-mono text-[13px] sm:grid-cols-4">
      <div className="flex flex-col gap-1">
        <dt className="text-[11px] uppercase tracking-[0.1em] text-dim">destroyed</dt>
        <dd className="text-fg">
          {plan.privateBundles} private blueprint{plan.privateBundles === 1 ? "" : "s"}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-[11px] uppercase tracking-[0.1em] text-dim">destroyed</dt>
        <dd className="text-fg">
          {plan.privateCards} private card{plan.privateCards === 1 ? "" : "s"}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-[11px] uppercase tracking-[0.1em] text-dim">stays published</dt>
        <dd className="text-fg">
          {plan.publishedBundles} blueprint{plan.publishedBundles === 1 ? "" : "s"}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-[11px] uppercase tracking-[0.1em] text-dim">stays published</dt>
        <dd className="text-fg">
          {plan.publishedCards} card{plan.publishedCards === 1 ? "" : "s"}
        </dd>
      </div>
    </dl>
  );
}

function DeleteAccount({ handle }: { handle: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [plan, setPlan] = useState<DeletionPlan | undefined>(undefined);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | undefined>(undefined);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);
  const logoutForm = useRef<HTMLFormElement>(null);

  /* A handle-less account (T050 AC1) has nothing to type back, so it confirms against a
     fixed phrase instead — the gate's job is "type something you could not have pasted by
     accident", not specifically a handle. */
  const confirmWord = handle ?? "delete my account";

  const review = () => {
    setExpanded(true);
    if (plan !== undefined || loadingPlan) return;
    setLoadingPlan(true);
    setPlanError(undefined);
    getJson<{ plan: DeletionPlan }>("/api/account/delete/plan")
      .then(({ plan: fetched }) => setPlan(fetched))
      .catch((cause: unknown) => setPlanError(errorMessage(cause)))
      .finally(() => setLoadingPlan(false));
  };

  const confirmDelete = () => {
    setDeleting(true);
    setDeleteError(undefined);
    postJson("/api/account/delete")
      .then(() => {
        setDone(true);
        /* A real form submission, not `fetch`: `/api/auth/logout` answers a 303, and
           following a POST's redirect onto a fresh page is what a browser does with a form
           submit and never does with a background request. This is the brief's
           "form-follow" — it lands the reader on the site, signed out, rather than on a
           blank response to a request nothing ever showed them. */
        logoutForm.current?.submit();
      })
      .catch((cause: unknown) => {
        setDeleteError(errorMessage(cause));
        setDeleting(false);
      });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      {/* `hidden`, never rendered for a reader to see or tab to: it exists to be submitted
          once, imperatively, after the delete itself has already succeeded. */}
      <form ref={logoutForm} action="/api/auth/logout" method="post" hidden />
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <span className="text-sm text-fg">Delete account</span>
          <span className="text-[13px] leading-relaxed text-muted">
            Your handle is retired and nobody can claim it. Your private blueprints and
            cards are deleted, unless a public release still uses the card. Everything you
            published stays: a public release is permanent, and a card version another
            blueprint uses cannot be withdrawn. Review the exact figures before you
            confirm.
          </span>
        </div>
        {!expanded && (
          <Button variant="outline" className="border-signal/50! text-signal!" onClick={review}>
            Review what deleting removes
          </Button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          {loadingPlan && <p className="font-mono text-[11px] text-dim">Loading…</p>}
          {planError !== undefined && (
            <p role="alert" className="text-[13px] text-signal">
              {planError}
            </p>
          )}
          {plan !== undefined && !done && (
            <>
              <DeletePlanFigures plan={plan} />
              <label htmlFor="delete-confirm" className="label">
                Type <span className="font-mono text-fg">{confirmWord}</span> to confirm
              </label>
              <input
                id="delete-confirm"
                type="text"
                value={confirmText}
                disabled={deleting}
                onChange={(event) => setConfirmText(event.target.value)}
                className="h-10 w-full max-w-[24rem] rounded-md border border-line bg-void px-3 font-mono text-sm text-fg transition-colors focus:border-signal"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="border-signal/50! text-signal!"
                  disabled={confirmText !== confirmWord || deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? "Deleting…" : "Delete account"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={deleting}
                  onClick={() => {
                    setExpanded(false);
                    setConfirmText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              {deleteError !== undefined && (
                <p role="alert" className="text-[13px] text-signal">
                  {deleteError}
                </p>
              )}
            </>
          )}
          {done && (
            <p role="status" className="font-mono text-[11px] text-emerald">
              Account deleted. Signing you out…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TransferBundle({ initial }: { initial: readonly TransferableBundle[] }) {
  const [available, setAvailable] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [bundleId, setBundleId] = useState(available[0]?.bundleId ?? "");
  const [toHandle, setToHandle] = useState("");
  const [plan, setPlan] = useState<TransferPlan | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | undefined>(undefined);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<{ slug: string; toHandle: string; self: boolean } | undefined>(
    undefined,
  );

  const selected = available.find((row) => row.bundleId === bundleId);

  const clearPreview = () => {
    setPlan(undefined);
    setPreviewError(undefined);
  };

  const preview = () => {
    if (bundleId === "" || toHandle.trim() === "") return;
    setPreviewing(true);
    setPreviewError(undefined);
    getJson<{ plan: TransferPlan }>(
      `/api/transfer/plan?bundleId=${encodeURIComponent(bundleId)}&toHandle=${encodeURIComponent(toHandle.trim())}`,
    )
      .then(({ plan: fetched }) => setPlan(fetched))
      .catch((cause: unknown) => setPreviewError(errorMessage(cause)))
      .finally(() => setPreviewing(false));
  };

  const confirmTransfer = () => {
    if (plan === undefined) return;
    setTransferring(true);
    setTransferError(undefined);
    postJson("/api/transfer", { bundleId, toHandle: toHandle.trim() })
      .then(() => {
        /* D-120-12 J: a self-transfer is a no-op SUCCESS, and the bundle never left the
           caller's namespace — removing it from the picker here would show a blueprint as
           gone that the account still owns. */
        const self = plan.fromAccountId === plan.toAccountId;
        setResult({ slug: plan.slug, toHandle: toHandle.trim(), self });
        if (!self) {
          /* Re-point the picker at whatever is left, rather than at `""`: a controlled
             `<select>` whose value matches no `<option>` falls back to the browser's own
             pick (its first option) while React keeps asserting the empty string, which is
             the one state a form control should never visibly disagree with its own props. */
          const remaining = available.filter((row) => row.bundleId !== bundleId);
          setAvailable(remaining);
          setBundleId(remaining[0]?.bundleId ?? "");
        }
        setToHandle("");
        clearPreview();
      })
      .catch((cause: unknown) => setTransferError(errorMessage(cause)))
      .finally(() => setTransferring(false));
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex min-w-[280px] flex-1 flex-col gap-1">
          <span className="text-sm text-fg">Transfer a blueprint</span>
          <span className="text-[13px] leading-relaxed text-muted">
            Hand a blueprint to another account. Its files and release digests stay
            exactly as they are; only the owner changes, and its address moves with it.
          </span>
        </div>
        {!expanded && available.length > 0 && (
          <Button variant="outline" onClick={() => setExpanded(true)}>
            Transfer a blueprint
          </Button>
        )}
      </div>

      {available.length === 0 && (
        <p className="font-mono text-[11px] text-dim">
          You don&rsquo;t own a blueprint to transfer{result !== undefined ? " anymore" : " yet"}.
        </p>
      )}

      {expanded && available.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="label">Blueprint</span>
              <select
                value={bundleId}
                onChange={(event) => {
                  setBundleId(event.target.value);
                  clearPreview();
                }}
                className="h-10 rounded-md border border-line bg-void px-3 text-sm text-fg transition-colors focus:border-cyan"
              >
                {available.map((row) => (
                  <option key={row.bundleId} value={row.bundleId}>
                    {row.title ?? row.slug} · {row.visibility}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2">
              <span className="label">To handle</span>
              <input
                type="text"
                value={toHandle}
                onChange={(event) => {
                  setToHandle(event.target.value);
                  clearPreview();
                }}
                placeholder="their handle"
                className="h-10 rounded-md border border-line bg-void px-3 font-mono text-sm text-fg transition-colors focus:border-cyan"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={bundleId === "" || toHandle.trim() === "" || previewing}
              onClick={preview}
            >
              {previewing ? "Checking…" : "Preview"}
            </Button>
            {plan !== undefined && !plan.collides && (
              <Button disabled={transferring} onClick={confirmTransfer}>
                {transferring ? "Transferring…" : `Move ${selected?.slug ?? plan.slug} to @${toHandle.trim()}`}
              </Button>
            )}
          </div>

          {previewError !== undefined && (
            <p role="alert" className="text-[13px] text-signal">
              {previewError}
            </p>
          )}
          {plan !== undefined && (
            <p className="font-mono text-[11px] text-dim">
              {plan.collides
                ? `@${toHandle.trim()} already holds a blueprint at "${plan.slug}", so this is refused before anything moves.`
                : `Ready: "${plan.slug}" will move to @${toHandle.trim()}.`}
            </p>
          )}
          {transferError !== undefined && (
            <p role="alert" className="text-[13px] text-signal">
              {transferError}
            </p>
          )}
        </div>
      )}

      {result !== undefined && (
        <p role="status" className="font-mono text-[11px] text-emerald">
          {result.self
            ? `@${result.toHandle} already owns "${result.slug}": nothing moved.`
            : `"${result.slug}" now belongs to @${result.toHandle}.`}
        </p>
      )}
    </div>
  );
}

export function DangerZone({
  handle,
  transferable,
}: {
  handle: string | null;
  transferable: readonly TransferableBundle[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <DeleteAccount handle={handle} />
      <TransferBundle initial={transferable} />
    </div>
  );
}
