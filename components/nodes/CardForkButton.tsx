"use client";

import { useCallback, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cx } from "@/lib/format";
import { nodeHref } from "@/lib/href";

// POST /api/cards/{id}/fork copies one card version into the caller's own namespace and
// answers `{ card: CardRecord }`. It is a separate verb from the bundle fork: the two take
// different bodies, refuse for six different reasons and land on different addresses.

/**
 * What a caller hands over to make this control live. Absent, it draws switched off.
 *
 * Every field is read off `app/api/cards/[...ref]/route.ts` and `lib/server/lineage`'s
 * `forkCard` rather than agreed in advance, because the route shipped first and with its
 * own suite:
 *
 * * `api` is `/api/cards/<bare card id>/fork`. The id may be one segment or two
 *   (`planner`, `lupo/planner`) and the route is a catch-all for that reason; the last
 *   segment is the literal `fork` and everything before it is the id. A pinned ref never
 *   goes here, and neither does an `@version`.
 * * `version` travels in the body, because the URL has no room left for it, and it is
 *   required. `forkCard` refuses to fall back to the newest version on purpose: the
 *   fallback writes a true provenance about the wrong bytes.
 * * `signedIn` gates the control before the request is made. The route answers 401 either
 *   way; this is the same answer without the round trip.
 *
 * What is deliberately NOT here is where the fork lands. The namespace is the forker's own
 * handle and is not the caller's to choose (`fork-card.ts` argues that as a security
 * decision, not a naming one), so the address only exists once the route has answered, and
 * it comes back on the response as `card.cardId`.
 */
export interface CardFork {
  /** The POST route. Supplied by the caller so this file names no endpoint of its own. */
  api: string;
  /** The version this page is showing, forked as itself and never as "whatever is latest". */
  version: string;
  signedIn: boolean;
}

/**
 * The header's Fork control for a node card, in the two states the site's other action
 * pills already have: drawn-and-disabled without a route to call, live the moment a caller
 * passes `fork`.
 *
 * The owner asked (2026-09-05) for the card header to carry star, fork and download in that
 * order, and ruled a real card fork built rather than accepting a Star-and-download row.
 * `components/bundle/BundleHeader.tsx` holds the pattern this copies: an additive prop swaps
 * a switched-off control for a working one, so the page renders honestly both before the
 * route exists and after.
 */
export function CardForkButton({ fork }: { fork?: CardFork }) {
  /* The switched-off branch returns before a single hook is called, which is why this
     dispatcher holds none and `LiveCardFork` below holds all of them. `renderToStaticMarkup`
     is how this file is tested (`vitest.config.ts` is `environment: "node"`, no DOM), and
     `useRouter` outside an App Router tree throws there — so a component that reached for it
     on the way to drawing a disabled control would be untestable in one of its two states. */
  if (fork === undefined) {
    return (
      <ForkControl
        disabled
        title="This page was rendered without the card fork route, so this button has nothing to call."
      />
    );
  }

  return <LiveCardFork fork={fork} />;
}

/*
   ── why this control is not an `ActionPill` ──
   `ActionPill` is a label cell and a figure cell, and the figure is required: it always
   prints `count`. That is right for the Star beside this one, where `getSignals` reads a
   real `target.star_count` off the row. Nothing counts card forks. A card fork's lineage
   lives in the forked row's own `provenance` string (`CARD_FORK_PROVENANCE_PREFIX` in
   `@/lib/server/lineage`), which no column indexes and no reader aggregates, so the only
   figure this control could pass is a literal zero — true today and false the first time
   somebody clicks. A control with no number is honest at every moment.

   The register is `ActionPill`'s own: `h-9`, the outlined face, the hover and the
   120ms press with `scale` NAMED in the transition list, because Tailwind v4 compiles
   `scale-[0.97]` to the standalone `scale` property and a list naming only `transform` does
   not cover it. Spelled out rather than composed from `Button`, for the reason the node
   page's own save link spells its classes out: `Button`'s sizes are `h-8` and `h-10`, and a
   `h-9` passed beside one of them is two utilities writing the same property with the
   stylesheet deciding which lands. The height is left out of the base below for that exact
   reason, since the row's control is `h-9` and the retry button under it is `h-8`.

   `opacity-60` and no `pointer-events-none`, on `ActionPill`'s reasoning: the `disabled`
   attribute already blocks activation, and killing pointer events is what stops a
   switched-off control from showing the `title` that says why it is off.
*/
const CONTROL =
  "inline-flex select-none items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-sm transition-[transform,scale,color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)]";

/**
 * Enabled and disabled, as the two class lists every control below picks between.
 *
 * The hover is amber, not `ActionPill`'s cyan, since the owner ruled the card register on
 * 2026-09-06. This control only ever mounts on `/nodes/[...id]`, in a row of three whose
 * other two are already amber — a favourited star, and the download trigger next to it —
 * so a cyan hover here was the one place the blueprint's colour reached into a card's own
 * action row. #ffb020 on `--color-surface` reads 10.66:1 against cyan's 9.10:1.
 */
const LIVE = "hoverable:hover:border-amber hoverable:hover:text-amber hoverable:active:scale-[0.97]";
const OFF = "cursor-not-allowed opacity-60";

/** The face, shared so the retry button below cannot drift from the one above it. */
const FACE = "border-line-bright bg-transparent text-fg";

function ForkControl({
  label = "Fork",
  disabled = false,
  title,
  onClick,
}: {
  label?: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(CONTROL, "h-9", FACE, disabled ? OFF : LIVE)}
    >
      {label}
    </button>
  );
}

/**
 * One refusal, as the reader gets it: a sentence, and at most one thing to do about it.
 *
 * `go` is a link out of the page and `rename` opens the name field. No refusal carries
 * both, because each of the eight the route publishes has exactly one next step or none.
 */
export interface Refusal {
  say: string;
  go?: { href: string; label: string };
  rename?: true;
}

/**
 * The last segment of a `problem+json` `type` URL.
 *
 * Branching on `type` rather than on `status` is forced rather than preferred: the route
 * answers 409 for two unrelated things (a name already taken, and a stored card that
 * predates the schema) and 404 for two more (no such card, no such version of it), and
 * those four are four different sentences. Read as a suffix so `PROBLEM_TYPE_BASE` is not
 * retyped in a client bundle; `lib/server/http` is server code and does not travel here.
 */
export function refusalKind(type: unknown): string {
  if (typeof type !== "string") return "";
  const slash = type.lastIndexOf("/");
  return slash === -1 ? type : type.slice(slash + 1);
}

/**
 * A refusal's own sentence with the operation prefix taken off the front.
 *
 * Every message `lib/server/lineage` raises opens with the function that refused
 * (`forkCard: …`), which is right in a log and wrong under a button: a reader is not
 * looking at a function. Only that prefix is removed. The sentence after it belongs to
 * `lib/server/naming`, which derives the card-id grammar from the engine's own `CARD_ID`,
 * and re-wording it here would give one rule two authors that drift apart.
 */
function sentence(detail: unknown): string | undefined {
  if (typeof detail !== "string" || detail.trim() === "") return undefined;
  return detail.replace(/^[A-Za-z][A-Za-z0-9]*: /, "");
}

/**
 * Every refusal the fork route publishes, as something a reader can act on.
 *
 * The route's header lists them and they are eight different situations, so collapsing
 * them into one "something went wrong" would throw away the only part a reader needs: two
 * of them are fixed by the reader in one click, one is fixed by choosing another name, and
 * one is not fixable at all and says so instead of offering a retry.
 *
 * Exported for `card-header-controls.test.ts`, which holds it against the server's own
 * `STATUSES` table: a `kind` the route can raise and this table has no arm for falls
 * through to the last line, where a reader gets a sentence naming nothing they can do.
 * That is a drift a render cell cannot see, because `environment: "node"` has no DOM and
 * this component's live half is unrenderable without an App Router tree.
 */
export function refusalFor(kind: string, detail: unknown): Refusal {
  switch (kind) {
    /* 401. `withSession` answers before the handler runs, so this is the session expiring
       between the page render and the click rather than a state the control drew for. */
    case "unauthorized":
      return {
        say: "A fork is written onto an account, and there is no session on this browser.",
        go: { href: "/welcome", label: "Sign in" },
      };

    /* 403 and not 401, which is the whole reason it is a separate sentence: the reader IS
       signed in. A handle-less account is legal (T050 AC1) and `PublicAuthor.handle` is
       nullable for that reason, so this is a reachable state and not a defensive branch.
       Sending them to a sign-in page would answer a question they have already answered. */
    case "fork-no-handle":
      return {
        say: "A fork lands under your own handle, and this account has not chosen one yet.",
        go: { href: "/settings", label: "Choose a handle in Settings" },
      };

    /* 409, and the one refusal a reader can get past by asking differently. It is also the
       only reason the route's optional `name` exists, so this is where the field opens. */
    case "fork-card-id-taken":
      return {
        say: "Your namespace already holds a card at that name. Give the copy another name and fork again.",
        rename: true,
      };

    /* 409 as well, and the opposite kind of answer: the stored row predates the current
       card schema, so no copy of it can be written without inventing fields nobody wrote.
       Nothing the reader does changes that, and offering a retry would be a lie about it. */
    case "fork-unreadable-card":
      /* The route's own `detail` is deliberately NOT surfaced here, and it is the one place
         this file writes over a server sentence. That sentence says the stored card cannot
         be read under the current schema, which is true and leaves a reader with no idea
         whether to click again. The clause that has to survive is the one the route's
         status map argues and the message does not carry: nothing the reader does fixes
         this, so there is no retry to offer. */
      return {
        say: "This card was stored under an older schema, so there is nothing here that can be copied honestly. Clicking again will not change that.",
      };

    /* 404, and one answer for two states by design (B-03): a card nobody stored and a card
       private to somebody else are the same sentence, or the refusal becomes a way to
       learn which ids exist. So this sentence must not guess which of the two it is. */
    case "fork-no-such-card":
      return { say: "There is no card here to fork, or none this account may read." };

    /* 404 too, and the extra precision is given only to somebody who already knew the card
       exists: the route asks it after the read grant for exactly that reason. */
    case "fork-no-such-card-version":
      return {
        say: "The card is readable and this version is not. Pick a version from the history below and fork that one.",
      };

    /* 400. The sentence is the grammar's own, passed through, because the rule about what
       a card id may be has one author and it is not this file. */
    case "fork-card-id-invalid":
      return {
        say: sentence(detail) ?? "That name is not one a card id can carry.",
        rename: true,
      };

    /* 500. Nothing was written: the fork is a single insert and the fault arm re-reads the
       namespace before it gives up, so a store that failed left no half-made card. */
    case "store-failed":
      return { say: "The store failed while writing the fork, so nothing was copied. Try again in a moment." };

    default:
      return { say: sentence(detail) ?? "That fork was not accepted." };
  }
}

/** The live half: one POST, and the answer a reader is owed about it. */
function LiveCardFork({ fork }: { fork: CardFork }) {
  const router = useRouter();
  // A stable id across renders, so the label always names the field that exists rather than
  // a guess a second instance of this control on one page could collide with.
  const nameId = useId();
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | undefined>(undefined);
  const [done, setDone] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");

  const { api, version, signedIn } = fork;

  /* `name` is passed in rather than read out of state, so the retry sends the value the
     reader just typed instead of whatever the closure was built with. */
  const send = useCallback(
    (as?: string) => {
      if (!signedIn || pending) return;
      setPending(true);
      setRefusal(undefined);
      // A second attempt starts with the row empty, so an answer about the last one cannot
      // sit under a refusal about this one.
      setDone(undefined);
      void (async () => {
        try {
          const chosen = as?.trim() ?? "";
          const response = await fetch(api, {
            method: "POST",
            headers: { "content-type": "application/json" },
            /* `name` is omitted rather than sent empty when the reader has not chosen one:
               `forkCard` reads the upstream id's own last segment in that case, and a blank
               string here would be refused as an illegal card name. `visibility` is never
               sent at all, because an absent one takes the forker's own account default and
               a constant chosen by a button is exactly what D-110-09 refuses. */
            body: JSON.stringify(chosen === "" ? { version } : { version, name: chosen }),
          });

          if (!response.ok) {
            const problem = (await response.json().catch(() => undefined)) as
              | { type?: unknown; detail?: unknown }
              | undefined;
            /* A 5xx with no envelope in it is a real path rather than paranoia. A store
               fault inside `forkCard` arrives as `CardStoreError`, which `withLineageErrors`
               does not recognise and rethrows on purpose, so Next answers its own generic
               500 in HTML. Reading that as "not accepted" would put a plausible wrong cause
               on the reader's screen: their request was fine and the server was not. */
            setRefusal(
              problem === undefined && response.status >= 500
                ? {
                    say: "The server failed on the way to writing the fork and did not say why. Check your profile before trying again.",
                  }
                : refusalFor(refusalKind(problem?.type), problem?.detail),
            );
            setPending(false);
            return;
          }

          const body = (await response.json().catch(() => undefined)) as
            | { card?: { cardId?: unknown } }
            | undefined;
          const landed = body?.card?.cardId;
          if (typeof landed === "string" && landed !== "") {
            /* `/nodes/[...id]` addresses a card by its bare id, which is what the record
               carries: the fork kept the upstream's version, so the page it opens is the
               copy at the same version under the reader's own handle. */
            router.push(nodeHref(landed));
            return;
          }
          /* A 2xx with no card in it is not something the route can produce; it is what a
             proxy or a captive network answers instead. Saying the fork went through would
             be a claim this code cannot support, so it says only what it knows. */
          setDone("The fork was accepted. Open your profile to find the copy.");
          setPending(false);
        } catch {
          setRefusal({ say: "That fork did not send. Check your connection and try again." });
          setPending(false);
        }
      })();
    },
    [api, version, signedIn, pending, router],
  );

  return (
    <div className="flex flex-col items-start gap-1 lg:items-end">
      {/* No `aria-pressed`: forking is an act, not a state this button toggles back. */}
      <ForkControl
        label={pending ? "Forking…" : "Fork"}
        onClick={() => send(name)}
        disabled={!signedIn || pending}
        title={signedIn ? "Copy this card version into your own namespace." : "Sign in to fork this card."}
      />

      {refusal !== undefined && (
        <div role="alert" className="flex flex-col items-start gap-1 lg:items-end">
          <span className="text-[11px] text-signal lg:text-right">{refusal.say}</span>
          {refusal.go !== undefined && (
            /* Cyan, and left cyan by the card-register pass. Every `refusal.go` lands on
               account chrome — sign in, or the settings page that takes a handle — which is
               not a card, and painting an exit from the card in the card's own colour would
               say the reader is staying. */
            <Link
              href={refusal.go.href}
              className="text-[11px] text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan"
            >
              {refusal.go.label}
            </Link>
          )}
        </div>
      )}

      {/* The name field opens only where the route said a name would help. A permanent one
          beside the button would ask every reader to name a copy before they have any
          reason to, and the route already has an answer for the case they have none: the
          upstream id's own last segment. */}
      {refusal?.rename === true && (
        <div className="flex items-center gap-1.5">
          <label htmlFor={nameId} className="text-[11px] text-dim">
            Name
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-40 rounded-md border border-line bg-void px-2.5 font-mono text-sm text-fg transition-colors focus:border-cyan focus:outline-none"
            aria-label="A name for your copy of this card"
          />
          <button
            type="button"
            onClick={() => send(name)}
            disabled={pending || name.trim() === ""}
            className={cx(CONTROL, "h-8", FACE, pending || name.trim() === "" ? OFF : LIVE)}
          >
            Fork under this name
          </button>
        </div>
      )}

      {done !== undefined && (
        /* Amber: this sentence is about the card that was just forked. */
        <span role="status" className="text-[11px] text-amber lg:text-right">
          {done}
        </span>
      )}
    </div>
  );
}
