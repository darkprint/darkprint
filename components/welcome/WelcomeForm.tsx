"use client";

/* ============================================================
   First sign-in: the two fields sign-up cannot finish without.

   T050 AC1 makes a session with `handle: null` "signed in and
   INCOMPLETE", and the callback route's own header recorded the
   consequence as a known gap: "The redirect stays `/` … AC1 reads
   as though sign-in should land somewhere that asks for a handle."
   Nothing asked. A reader who signed in had to find `/settings`
   unaided and know that the field marked optional-looking was the
   one gating publishing. This page is that missing somewhere.

   ── Why the handle blocks and the display name does not ──
   They are not the same kind of field. The handle is an identifier
   the registry allocates once and reserves permanently (T070); it
   is in every published card's bytes (B-05), and until it exists
   `publish` cannot resolve an owner at all. The display name is a
   label a reader can change any afternoon and can leave empty
   forever. So the handle is required here and the display name is
   offered — asking for both and blocking on both would make the
   optional one look load-bearing, which is the same defect in the
   other direction.

   ── Availability is asked of the server, never guessed here ──
   `GET /api/names/handles/{handle}` is T070's own answer and
   carries its own `reason` and `suggestion`. Re-deriving the
   grammar in the browser would put a second author on one refusal
   (D-50-08's rule): the client would say "that looks wrong" where
   the server says which rule and what to use instead. The only
   check made locally is "is it empty", because an empty field is
   not a name the server needs to be asked about.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";

import { Field, PrefixedField, TextField } from "@/components/settings/controls";

/** T070's answer shape, transcribed rather than imported: the barrel reaches `pg`. */
interface Availability {
  available: boolean;
  reason?: "taken" | "reserved" | "illegal";
  suggestion?: string;
}

interface Problem {
  detail?: string;
  title?: string;
}

/** T071's bound, restated because the barrel holding it is server-only. */
const MAX_HANDLE_LENGTH = 32;

/**
 * What the field is showing about the handle right now.
 *
 * `checking` is distinct from `idle` for the reason the upload session's `loading` is
 * distinct from `anonymous`: a form that renders "available" for the frame before its own
 * request lands has told the reader something it does not know yet.
 */
type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "taken"; reason: string; suggestion?: string };

/**
 * Whether the submit is refused, as a pure function of the form's state.
 *
 * Exported and separated from the component because the claim it carries — that the HANDLE
 * gates publishing and the display name never does — is not observable in a static render:
 * the button is disabled either way while the handle is still empty, so an assertion on the
 * rendered attribute passes against an implementation that requires both. Measured: making
 * `displayName` required reddened 0 of 4 cells until this function existed.
 */
export function submitBlocked(state: {
  handle: string;
  saving: boolean;
  check: Check;
}): boolean {
  return state.handle.trim() === "" || state.saving || state.check.state === "taken";
}

function refusalSentence(reason: Availability["reason"]): string {
  if (reason === "reserved") return "That handle is reserved.";
  if (reason === "illegal") {
    return "Letters, digits and single hyphens, starting and ending with a letter or digit.";
  }
  return "That handle is taken.";
}

async function patch(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  /* The route's wording, passed through rather than re-rendered — `AccountForm`'s rule and
     D-50-08's: every refusal here already has an author in T070 or T050. */
  const problem = (await response.json().catch(() => ({}))) as Problem;
  throw new Error(problem.detail ?? problem.title ?? `Request failed (${response.status}).`);
}

export function WelcomeForm({ suggestedHandle }: { suggestedHandle: string }) {
  const [handle, setHandle] = useState(suggestedHandle);
  const [displayName, setDisplayName] = useState("");
  /* The verdict AND the string it was computed for, as one value. Deriving what to show
     from those two (below) rather than setting a "checking" state inside the effect means a
     verdict can never be displayed against a handle it was not about — the race the abort
     controller narrows, closed by construction rather than by timing. */
  const [answer, setAnswer] = useState<{ for: string; check: Check }>({
    for: "",
    check: { state: "idle" },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  /* The request in flight, so a keystroke abandons the previous answer rather than racing
     it: without this a slow reply for "ale" can land after a fast one for "alessandro" and
     label the longer name with the shorter one's verdict. */
  const inFlight = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    const trimmed = handle.trim();
    if (trimmed === "") return;
    /* Debounced, because this fires per keystroke and each one is a database read on the
       other end. 350ms is long enough that typing a whole handle costs one query. */
    const timer = setTimeout(() => {
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      void (async () => {
        try {
          const response = await fetch(`/api/names/handles/${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
          });
          if (!response.ok) {
            /* A failed availability read is not a verdict about the name. Saying nothing is
               the honest state: the submit below asks the server again anyway, and that
               answer is the one that decides. */
            setAnswer({ for: trimmed, check: { state: "idle" } });
            return;
          }
          const body = (await response.json()) as Availability;
          setAnswer({
            for: trimmed,
            check: body.available
              ? { state: "free" }
              : {
                  state: "taken",
                  reason: refusalSentence(body.reason),
                  ...(body.suggestion === undefined ? {} : { suggestion: body.suggestion }),
                },
          });
        } catch {
          /* Aborted by the next keystroke, or the network failed. Either way this answer is
             not about the name in the field now. */
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [handle]);

  const submit = useCallback(async () => {
    const trimmed = handle.trim();
    if (trimmed === "" || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      /* The handle FIRST, and the order is the same one `AccountForm` gives its reason for:
         it is the field that can be refused on grounds the reader has to act on, so failing
         here leaves the display name unsent rather than writing half a profile under a name
         that did not land.

         This call also RE-MINTS the session cookie (D-50-06) — `handle` lives inside the
         signed token and `withSession` never reads the database, so without that the account
         would keep `handle: null` for thirty days and stay refused by every route it just
         qualified for. */
      await patch("/api/account/handle", { handle: trimmed });

      const name = displayName.trim();
      if (name !== "") await patch("/api/account/profile", { displayName: name });

      /* A whole-document navigation rather than a router push: the cookie was just replaced
         and every server component downstream reads the session from it. A client-side
         transition would re-render this tree against the OLD one. */
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Try again.");
      setSaving(false);
    }
  }, [handle, displayName, saving]);

  /* Derived, not stored: an answer only speaks for the exact string it was asked about, so
     anything else in the field reads as still-checking. */
  const trimmedHandle = handle.trim();
  const check: Check =
    trimmedHandle === ""
      ? { state: "idle" }
      : answer.for === trimmedHandle
        ? answer.check
        : { state: "checking" };

  const blocked = submitBlocked({ handle, saving, check });

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field
        id="handle"
        label="Handle"
        hint="Your address on the registry, and the author line inside every card you publish. It is reserved to you permanently, so it cannot be handed to somebody else later."
      >
        <PrefixedField
          id="handle"
          prefix="darkprint.io/u/"
          value={handle}
          onChange={setHandle}
          label="Handle"
          placeholder="your-handle"
          maxLength={MAX_HANDLE_LENGTH}
        />
        {/* One line, and it says which of the four states the server is in. `aria-live` so a
            reader who cannot see the field hears the verdict rather than discovering it at
            submit. */}
        <p aria-live="polite" className="min-h-[1.25rem] text-[13px] leading-relaxed">
          {check.state === "checking" && <span className="text-dim">Checking…</span>}
          {check.state === "free" && <span className="text-emerald">Available.</span>}
          {check.state === "taken" && (
            <span className="text-amber">
              {check.reason}
              {check.suggestion !== undefined && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setHandle(check.suggestion!)}
                    className="underline decoration-amber/40 underline-offset-4 transition-colors hover:decoration-amber"
                  >
                    Use {check.suggestion}
                  </button>
                </>
              )}
            </span>
          )}
        </p>
      </Field>

      <Field
        id="display-name"
        label="Display name"
        hint="Shown on your profile and beside what you publish. Optional, and you can change it whenever you like."
      >
        <TextField id="display-name" value={displayName} onChange={setDisplayName} />
      </Field>

      {error !== undefined && (
        <p role="alert" className="text-[13px] leading-relaxed text-amber">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {/* Full width in the centred column, and the hint moves UNDER it rather than beside:
            at 26rem a button and a sentence on one row leaves the sentence in a two-word
            gutter. */}
        <button
          type="submit"
          disabled={blocked}
          className="w-full rounded-md bg-cyan px-5 py-2.5 text-sm font-medium text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Finish signing up"}
        </button>
        <span className="text-center text-[13px] leading-relaxed text-dim">
          The handle is the one thing publishing needs; everything else can wait.
        </span>
      </div>
    </form>
  );
}
