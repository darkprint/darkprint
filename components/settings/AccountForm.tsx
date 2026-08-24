"use client";

import { useState } from "react";

import type { AccountRecord } from "@/lib/server/accounts";
import { Button } from "@/components/ui/Button";
import {
  ChoiceCard,
  Field,
  PrefixedField,
  SectionNote,
  SettingsSection,
  Switch,
  TextField,
} from "./controls";
import { ProfileFields } from "./ProfileFields";

// Backend contract seams anchored in this file (see docs/architecture/seams.md):
// SEAM-44 LIVE: PATCH /api/account/profile
// SEAM-45 LIVE: PATCH /api/account/handle
// SEAM-46 LIVE: PATCH /api/account/email
// SEAM-48 LIVE: PATCH /api/account/default-visibility
// SEAM-47: PATCH /api/account/notifications EXISTS (T190) — this page is not wired to it, see §03 below.

/* ============================================================
   Sections 01 to 04, and the one Save that writes them.

   ── Why one component for four sections ──
   The page has one `Save changes` at the foot, which is the shape a reader expects and
   the shape it already had. That means one piece of state spanning four panels, so the
   four panels are one component. §05 and §06 have no editable value in them and stay
   server-rendered; they arrive here as `children` and are drawn above the footer, which
   keeps the numbered order on screen identical to the rail.

   ── Four routes, not one ──
   T050 publishes a route per field group rather than one account write, so Save fans out
   to whichever of the four actually changed. Nothing is sent for a field a reader did not
   touch: a `PATCH` that rewrites a handle to its current value still takes the handle
   through T070's grammar and still burns a rename, and `changeHandle` reserves the old
   one. **Comparing against the record it was given is what makes Save idempotent**, and it
   is the reason `saved` below holds a record rather than a boolean.

   ── What is deliberately NOT here ──
   No client-side validation of the handle beyond "it is not empty". T070 owns the grammar,
   `changeHandle` is the door that decides, and a guard here that refused something the
   registry accepts would be a refusal this page invented — the same objection D-263-12
   settled for T263's version check. The field sends what was typed and prints what came
   back.
   ============================================================ */

/** What `PATCH /api/account/*` answers with, or the problem it answers with instead. */
type Problem = { title?: string; detail?: string };

async function patch(path: string, body: unknown): Promise<AccountRecord> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return (await response.json()) as AccountRecord;

  /* The route's own wording, passed through rather than re-rendered. Every refusal on this
     surface already has an author — T070's grammar, T050's email and visibility checks —
     and a second wording here would be the drift D-50-08 forbids, arriving through the
     client instead of through a barrel. */
  const problem = (await response.json().catch(() => ({}))) as Problem;
  throw new Error(problem.detail ?? problem.title ?? `Request failed (${response.status}).`);
}

export function AccountForm({
  account,
  counts,
  children,
}: {
  account: AccountRecord;
  /** §02's "Authored under this handle" block. Server-rendered: it is a database read. */
  counts: React.ReactNode;
  /** §05 and §06, drawn between §04 and the footer so the numbered order matches the rail. */
  children: React.ReactNode;
}) {
  /* The saved record, not the initial one. Save replaces it, so a second Save compares
     against what the account now holds and sends nothing for a field already written. */
  const [saved, setSaved] = useState(account);

  const [handle, setHandle] = useState(account.author.handle ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const [displayName, setDisplayName] = useState(account.author.displayName ?? "");
  const [bio, setBio] = useState(account.author.bio ?? "");
  const [hue, setHue] = useState(account.author.avatarHue ?? 210);
  const [visibility, setVisibility] = useState(account.defaultVisibility);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  const discard = () => {
    setHandle(saved.author.handle ?? "");
    setEmail(saved.email ?? "");
    setDisplayName(saved.author.displayName ?? "");
    setBio(saved.author.bio ?? "");
    setHue(saved.author.avatarHue ?? 210);
    setVisibility(saved.defaultVisibility);
    setError(undefined);
    setDone(false);
  };

  const handleChanged = handle !== (saved.author.handle ?? "");
  const emailChanged = email !== (saved.email ?? "");
  const profileChanged =
    displayName !== (saved.author.displayName ?? "") ||
    bio !== (saved.author.bio ?? "") ||
    hue !== (saved.author.avatarHue ?? 210);
  const visibilityChanged = visibility !== saved.defaultVisibility;
  const dirty = handleChanged || emailChanged || profileChanged || visibilityChanged;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    setDone(false);
    try {
      let record = saved;
      /* Handle first. It is the only one of the four that can be refused on grounds a
         reader has to act on — taken, or outside T070's grammar — so failing here leaves
         the other three unsent and the account exactly as it was, rather than half
         written under a name that did not land. */
      if (handleChanged) record = await patch("/api/account/handle", { handle });
      if (emailChanged) {
        /* An emptied field is `null` and not `""`. `AccountRecord.email` is
           `string | null`, and `setEmail` treats the two differently: null clears the
           column, an empty string is a value that fails the address check. */
        record = await patch("/api/account/email", { email: email === "" ? null : email });
      }
      if (profileChanged) {
        record = await patch("/api/account/profile", {
          displayName: displayName === "" ? null : displayName,
          bio: bio === "" ? null : bio,
          avatarHue: hue,
        });
      }
      if (visibilityChanged) {
        record = await patch("/api/account/default-visibility", { visibility });
      }
      setSaved(record);
      setHandle(record.author.handle ?? "");
      setEmail(record.email ?? "");
      setDisplayName(record.author.displayName ?? "");
      setBio(record.author.bio ?? "");
      setHue(record.author.avatarHue ?? 210);
      setVisibility(record.defaultVisibility);
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ---------- 01 ---------- */}
      <SettingsSection
        id="public-profile"
        className="scroll-mt-24"
        step="01"
        title="Public profile"
        tone="lead"
        note={<SectionNote>visible to everyone</SectionNote>}
      >
        <ProfileFields
          displayName={displayName}
          bio={bio}
          hue={hue}
          handle={saved.author.handle}
          validator={saved.author.validator}
          onDisplayName={setDisplayName}
          onBio={setBio}
          onHue={setHue}
        />
      </SettingsSection>

      {/* ---------- 02 ---------- */}
      <SettingsSection
        id="account-handle"
        className="scroll-mt-24"
        step="02"
        title="Account & handle"
        note={<SectionNote>identity</SectionNote>}
      >
        <div className="flex flex-col gap-5">
          <Field
            id="handle"
            label="Handle"
            className="max-w-[36rem]"
            hint={
              <>
                Your handle is the author field on every card you publish. Changing it
                would leave every pinned{" "}
                <span className="text-copper-line">author:</span> line pointing at a name
                nobody owns, so a rename keeps the old handle reserved.
              </>
            }
          >
            {/* D-70-15's product bound, 32. Written as a literal and NOT imported from
                `@/lib/server/naming`: this is a client component, and that barrel reaches
                `lib/db` and pulls the driver into the browser bundle. The duplication is
                the safe direction anyway — AC4 requires the server to refuse 33 REGARDLESS
                of this attribute, because a client cap is a convenience and not
                enforcement. Anything that can send a PATCH can send 33 characters, and
                `allocateHandle` is what stops it. */}
            <PrefixedField
              id="handle"
              prefix="darkprint.io/u/"
              value={handle}
              onChange={setHandle}
              label="Handle"
              placeholder="choose one"
              maxLength={32}
            />
          </Field>

          {saved.author.handle === null && (
            <p className="rounded-md border border-cyan/30 bg-cyan/[0.06] px-4 py-3 text-[13px] leading-relaxed text-muted">
              This account does not have a handle yet, so it has no public profile. Choose
              one here and your profile appears at the address above.
            </p>
          )}

          {counts}
        </div>
      </SettingsSection>

      {/* ---------- 03 ---------- */}
      <SettingsSection
        id="notifications"
        className="scroll-mt-24"
        step="03"
        title="Email & notifications"
        note={<SectionNote tone="amber">◐ nothing sends</SectionNote>}
      >
        <div className="flex flex-col gap-4">
          <Field
            id="email"
            label="Email"
            className="max-w-[36rem]"
            hint="Never shown on your profile. It is the only field here a reader could not already see."
          >
            <TextField id="email" value={email} onChange={setEmail} type="email" mono />
          </Field>

          {/* The three rows below are COPY, not settings, and the difference is the point.
              The server side is real since T190 — stored preferences, GET/PATCH
              /api/account/notifications — but this page reads a static fixture and calls
              neither, so there is still no value here to read and nothing a switch could
              write. They stay on the page rather than being deleted because they describe
              what this section will offer, and each switch says what is actually missing
              instead of the page's old blanket reason (D-262-14 G1). */}
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {NOTIFICATIONS.map((notification) => (
              <li key={notification.id} className="flex items-center gap-4 px-4 py-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm text-fg">{notification.title}</span>
                  <span className="text-xs leading-relaxed text-dim">
                    {notification.note}
                  </span>
                </span>
                <Switch
                  on={notification.on}
                  label={notification.title}
                  reason="Nothing sends yet: this page is not wired to the preferences API, and no mail goes out."
                />
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-relaxed text-muted">
            Your email is stored and can be changed here. The three rows above are not
            settings yet: the server can store them now, but this page is not wired to it
            and no mail is sent, so the switches show what is planned rather than what is
            on.
          </p>
        </div>
      </SettingsSection>

      {/* ---------- 04 ---------- */}
      <SettingsSection
        id="default-visibility"
        className="scroll-mt-24"
        step="04"
        title="Default visibility for new blueprints"
        note={<SectionNote>per bundle, overridable</SectionNote>}
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="sr-only">Default visibility for new blueprints</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceCard
              name="default-visibility"
              id="visibility-private"
              title="Private"
              aside="recommended"
              selected={visibility === "private"}
              onSelect={() => setVisibility("private")}
            >
              A new bundle is yours until you decide otherwise. It is listed on your
              profile for you alone, and if you started it from somebody else&rsquo;s,
              that author is not told it exists.
            </ChoiceCard>
            <ChoiceCard
              name="default-visibility"
              id="visibility-public"
              title="Public"
              selected={visibility === "public"}
              onSelect={() => setVisibility("public")}
            >
              Every new bundle is listed on your profile the moment you make it, and if
              it came from somebody else&rsquo;s, on theirs too, with the lineage stated.
            </ChoiceCard>
          </div>
          {/* A fork is a fact about a bundle, not a kind of bundle, and this paragraph is
              where the page says so: the setting is about bundles, and lineage is one
              field recorded on one of them. */}
          <p className="text-xs leading-relaxed text-dim">
            Visibility is a property of every bundle, and a published one is a blueprint
            like any other: statically checked, scored from its own graph, and pinned to
            the card versions it actually carries. Whether it started as a copy is a fact
            recorded on it, not a different kind of thing.
          </p>
        </fieldset>
      </SettingsSection>

      {children}

      <SettingsFooter
        busy={busy}
        dirty={dirty}
        done={done}
        error={error}
        onSave={() => void save()}
        onDiscard={discard}
      />
    </>
  );
}

/**
 * The three notification rows, as copy.
 *
 * A constant here rather than a read, because there is nothing to read: this used to come
 * off `ACCOUNT.notifications` in `lib/data/account.ts`, a fixture with no column behind it.
 * Moving it here is not relocating data to satisfy a grep — the values are not data any
 * more, they are the section's own description of what it will hold, and the `on` flag is
 * the default each one would ship with rather than a state anybody set.
 */
const NOTIFICATIONS: readonly { id: string; title: string; note: string; on: boolean }[] = [
  {
    id: "repin",
    title: "A card you pinned publishes a new version",
    note: "The one notification a version-pinned registry genuinely needs.",
    on: true,
  },
  {
    id: "fork",
    title: "Somebody forks a blueprint you published",
    note: "Off by default: a public blueprint being copied is the point, not an event.",
    on: false,
  },
  {
    id: "digest",
    title: "A weekly digest of what changed in the registry",
    note: "Off by default. Nothing on this site is urgent enough to arrive uninvited.",
    on: false,
  },
];

/**
 * The footer, and the one control on this page a reader would expect to work.
 *
 * `Save changes` is enabled exactly when there is something to save, which is the AC2 rule
 * at its narrowest: a button that is on and does nothing is the failure this page was built
 * around, and an always-on Save over an unchanged form is precisely that.
 */
function SettingsFooter({
  busy,
  dirty,
  done,
  error,
  onSave,
  onDiscard,
}: {
  busy: boolean;
  dirty: boolean;
  done: boolean;
  error: string | undefined;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={onSave}
          disabled={!dirty || busy}
          title={dirty ? undefined : "Nothing has changed yet."}
        >
          {busy ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={onDiscard} disabled={!dirty || busy}>
          Discard
        </Button>
        <span className="font-mono text-[11px] text-dim sm:ml-auto">
          As designed, a change here applies to your account and never to anything you
          have published.
        </span>
      </div>
      {error !== undefined && (
        <p
          role="alert"
          className="rounded-md border border-signal/40 bg-signal/[0.06] px-4 py-3 text-[13px] leading-relaxed text-fg"
        >
          {error}
        </p>
      )}
      {done && error === undefined && (
        <p role="status" className="font-mono text-[11px] text-emerald">
          ✓ saved
        </p>
      )}
    </div>
  );
}
