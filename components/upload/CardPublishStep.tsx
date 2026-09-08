"use client";

/* ============================================================
   The Card kind's last step: the registry entry it becomes.

   Its own component rather than a branch of `UploadFlow`, for the
   reason `AttractorOffer` is one: the wizard is stateful and step
   four is unreachable from a static render, so the sentences this
   step owes a reader are testable only if the step can be mounted
   on its own with the state handed in.

   A card has no `/new` step and no Details form to carry a
   visibility, so the choice is made here, beside the button that
   spends it. Everything else on the screen is read off the
   validator's answer and the session; the step reads neither
   itself.
   ============================================================ */

import Link from "next/link";
import type { Diagnostic } from "@/lib/core";
import { summarize } from "@/lib/core";
import { cx } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KindBadge } from "@/components/ui/Badge";
import type { CardPublishOutcome } from "./publish-client";
import { SIGN_IN_HREF, type UploadSession } from "./session";
import { VisibilityChoice, type Visibility } from "./VisibilityChoice";

/** The three fields of a validated card this step names before the press. */
export interface CardIdentity {
  id: string;
  version: string;
  name: string;
}

/**
 * What the validator answered about the dropped document. `checking` stays distinct from
 * `idle` so a reader is never shown a verdict for the frame before its own request has
 * landed, and `failed` is a fact about the network rather than about the document.
 */
export type SingleCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "done"; diagnostics: Diagnostic[]; ok: boolean; card?: CardIdentity }
  | { state: "failed"; detail: string };

/** The un-namespaced half of a card id. `CARD_ID` admits one separator, so this is total. */
export function cardName(id: string): string {
  const slash = id.lastIndexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
}

/** The id the registry will store the card under: the publisher's handle over the card's own name. */
function targetId(handle: string | undefined, card: CardIdentity): string {
  return `${handle ?? "you"}/${cardName(card.id)}`;
}

const DOOR =
  "text-fg underline decoration-line-bright underline-offset-4 transition-colors hover:text-cyan";

export function CardPublishStep({
  title,
  check,
  session,
  visibility,
  onVisibility,
  publishing,
  onPublish,
  outcome,
  onBack,
  onAnother,
  onReset,
}: {
  /** What the reader typed on the Details step, if anything. */
  title: string;
  check: SingleCheck;
  session: UploadSession;
  visibility: Visibility;
  onVisibility: (next: Visibility) => void;
  publishing: boolean;
  onPublish: () => void;
  /** What the registry said, once asked. Absent while the reader is on the form. */
  outcome: CardPublishOutcome | undefined;
  /** Back to the form with the document kept, after a refusal. */
  onBack: () => void;
  /** A fresh document, the rest of the form kept. */
  onAnother: () => void;
  /** The blank sheet. */
  onReset: () => void;
}) {
  if (outcome !== undefined) {
    return (
      <CardOutcome outcome={outcome} onBack={onBack} onAnother={onAnother} onReset={onReset} />
    );
  }

  const card = check.state === "done" ? check.card : undefined;
  const handle = session.state === "ready" ? session.handle : undefined;
  const resolves = check.state === "done" && check.ok && card !== undefined;
  const canPublish = resolves && session.state === "ready" && !publishing;
  const errors = check.state === "done" ? summarize(check.diagnostics).error : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="panel flex flex-col gap-4 bg-surface-2/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <KindBadge kind="node" />
          {card !== undefined && (
            <span className="font-mono text-[11px] text-dim">
              {targetId(handle, card)}@{card.version}
            </span>
          )}
        </div>
        <h3 className="font-display text-xl font-semibold leading-snug text-fg">
          {title || card?.name || "Untitled node card"}
        </h3>
        <p className="text-sm leading-relaxed text-muted">
          {check.state === "done" && check.ok && "This node card resolves."}
          {check.state === "done" &&
            !check.ok &&
            `The validator reported ${errors} error${errors === 1 ? "" : "s"}.`}
          {check.state === "checking" && "Checking…"}
          {check.state === "failed" && check.detail}
          {check.state === "idle" && "Nothing dropped yet. Go back to the first step."}
        </p>
        {card !== undefined && (
          <p className="border-t border-line pt-4 text-xs leading-relaxed text-muted">
            A card publishes under your handle, so this one is stored as{" "}
            <span className="font-mono text-cyan">{targetId(handle, card)}</span>. The
            document&rsquo;s <span className="font-mono">id</span> is rewritten to match, and
            nothing else in it moves.
          </p>
        )}
      </div>

      <VisibilityChoice
        value={visibility}
        onChange={onVisibility}
        note="Private is the starting choice. You can publish a private card and keep working. Other people see only what you make public."
      />

      <div>
        <Button
          size="lg"
          onClick={onPublish}
          disabled={!canPublish}
          aria-describedby="card-publish-note"
        >
          {publishing ? "Publishing…" : "Publish node card"}
        </Button>
        <p id="card-publish-note" className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
          {/* The document's own state is asked first, then the session: a card that does
              not resolve should read that before being asked to sign in. */}
          {check.state === "idle" ? (
            <>
              <span className="font-mono text-signal">blocked</span>: there is no card to
              publish yet.
            </>
          ) : check.state === "checking" ? (
            <>Checking the card&hellip;</>
          ) : check.state === "failed" ? (
            <>
              <span className="font-mono text-signal">could not be checked</span>:{" "}
              {check.detail}
            </>
          ) : !check.ok || card === undefined ? (
            <>
              <span className="font-mono text-signal">blocked</span>: the validator reported{" "}
              {errors} error{errors === 1 ? "" : "s"}. The registry does not accept a card it
              cannot resolve; fix them and drop the document again.
            </>
          ) : session.state === "loading" ? (
            <>Checking whether you are signed in&hellip;</>
          ) : session.state === "anonymous" ? (
            <>
              <span className="font-mono text-amber">sign in to publish</span>: a card belongs
              to an account.{" "}
              <a href={SIGN_IN_HREF} className={DOOR}>
                Sign in with GitHub
              </a>{" "}
              and come back. The card stays where it is.
            </>
          ) : session.state === "no-handle" ? (
            <>
              <span className="font-mono text-amber">no handle yet</span>: your account has
              not chosen the name a card is published under. Nothing on this page can set
              one.
            </>
          ) : session.state === "unreachable" ? (
            <>
              <span className="font-mono text-signal">cannot tell</span>: {session.detail}{" "}
              Reload the page before publishing, so this does not fail halfway.
            </>
          ) : publishing ? (
            <>Sending the card to the registry. This can take a moment.</>
          ) : (
            <>
              This sends the card to the registry and stores{" "}
              <span className="font-mono text-cyan">
                {targetId(handle, card)}@{card.version}
              </span>
              , {visibility === "public" ? "public" : "private"}. The registry runs the same
              check on its side, and its reading is the one that decides.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** What became of the card, on every ending. */
function CardOutcome({
  outcome,
  onBack,
  onAnother,
  onReset,
}: {
  outcome: CardPublishOutcome;
  onBack: () => void;
  onAnother: () => void;
  onReset: () => void;
}) {
  const published = outcome.state === "published";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        <span
          className={cx(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl",
            published
              ? "border-emerald/40 bg-emerald/10 text-emerald"
              : outcome.state === "refused"
                ? "border-warn/40 bg-warn/10 text-warn"
                : "border-signal/40 bg-signal/10 text-signal",
          )}
          aria-hidden
        >
          {published ? "✓" : "!"}
        </span>
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="font-display text-xl font-semibold text-fg">
            {published
              ? "Published. The registry holds it."
              : outcome.state === "refused"
                ? "Not published. The registry declined it."
                : "Not published."}
          </h3>
          <p className="prose-lane text-sm leading-relaxed text-muted">
            {outcome.state === "published" ? (
              <>
                Stored as{" "}
                <span className="font-mono text-cyan">
                  {outcome.card.cardId}@{outcome.card.version}
                </span>
                , {outcome.card.visibility === "public" ? "public" : "private"}. Any blueprint
                can pin it by that id, and it is listed under your handle.
              </>
            ) : outcome.state === "refused" ? (
              <>
                <span className="font-mono text-signal">{outcome.kind}</span>: {outcome.detail}
              </>
            ) : (
              <>
                {outcome.state === "rejected" ? outcome.title : "The registry could not be reached"}
                : {outcome.detail} Your card is still here.
              </>
            )}
          </p>
          {/* The validator's own list, when the registry sent one back: it is the whole of
              what the author can act on, so it is printed rather than counted. */}
          {outcome.state === "refused" && outcome.diagnostics.length > 0 && (
            <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted">
              {outcome.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`} className="flex gap-2">
                  <span
                    className={cx(
                      "font-mono shrink-0",
                      diagnostic.severity === "error" ? "text-signal" : "text-warn",
                    )}
                  >
                    {diagnostic.severity}
                  </span>
                  <span>
                    <span className="font-mono text-dim">{diagnostic.code}</span>{" "}
                    {diagnostic.message}
                    {diagnostic.hint !== undefined && (
                      <span className="text-dim"> {diagnostic.hint}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {outcome.state === "published" && (
          <ButtonLink href={outcome.card.path}>Open the card&rsquo;s page</ButtonLink>
        )}
        {outcome.state !== "published" && <Button onClick={onBack}>Back to the card</Button>}
        <Button variant="outline" onClick={onAnother}>
          {published ? "Publish another card" : "Validate another card"}
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-dim">
        <button
          type="button"
          onClick={onReset}
          className="underline-offset-4 transition-colors hoverable:hover:text-fg hoverable:hover:underline"
        >
          start over with an empty form
        </button>
        <Link
          href="/nodes"
          className="underline-offset-4 transition-colors hoverable:hover:text-cyan hoverable:hover:underline"
        >
          browse the cards →
        </Link>
      </p>
    </div>
  );
}
