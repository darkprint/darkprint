"use client";

import { useState } from "react";

import type { AccountRecord } from "@/lib/server/accounts";
import type { EventKind, Preferences } from "@/lib/server/notifications";
import { Button } from "@/components/ui/Button";
import { patchJson } from "./live";
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

/* ============================================================
   Sections 01 to 04, plus 03's four switches since T280, and the one Save that writes them.

   ── Why one component for five things ──
   The page has one `Save changes` at the foot, which is the shape a reader expects and
   the shape it already had. That means one piece of state spanning every field Save can
   write, so profile, handle, email, default visibility AND the four notification switches
   are one component's state. §05, §06 and §07 have no value this component's Save writes —
   §06 mints and revokes immediately, over its own routes, and §07's two actions are each
   their own confirm-and-act flow — so all three stay server-rendered and arrive here as
   `children`, drawn above the footer, which keeps the numbered order on screen identical
   to the rail.

   ── Five routes, not one ──
   T050 and T190 each publish a route per field group rather than one account write, so
   Save fans out to whichever of the five actually changed. Nothing is sent for a field a
   reader did not touch: a `PATCH` that rewrites a handle to its current value still takes
   the handle through T070's grammar and still burns a rename, and `changeHandle` reserves
   the old one. **Comparing against the record it was given is what makes Save idempotent**,
   and it is the reason `saved` below holds a record rather than a boolean — extended here
   to a second baseline, `savedPreferences`, because `AccountRecord` carries no preferences
   field (T050 explicitly does not own that column) and a second kind of value needs a
   second kind of baseline to compare against.

   ── What is deliberately NOT here ──
   No client-side validation of the handle beyond "it is not empty". T070 owns the grammar,
   `changeHandle` is the door that decides, and a guard here that refused something the
   registry accepts would be a refusal this page invented — the same objection D-263-12
   settled for T263's version check. The field sends what was typed and prints what came
   back.
   ============================================================ */

/** The four switches' fallback, reached only when a caller renders this component with no
    live `notifications` prop — production always passes the account's own, off
    `getPreferences`. Mirrors `DEFAULT_PREFERENCES` (`lib/server/notifications/defaults.ts`)
    as a literal rather than an import, for `PrefixedField`'s reason: this is a client
    component and that barrel reaches `@/lib/db`. */
const FALLBACK_PREFERENCES: Preferences = { repin: true, fork: true, deprecation: true, digest: false };

export function AccountForm({
  account,
  counts,
  notifications,
  children,
}: {
  account: AccountRecord;
  /** §02's "Authored under this handle" block. Server-rendered: it is a database read. */
  counts: React.ReactNode;
  /** The account's stored preferences (`getPreferences`, T190). Optional and defaulted so a
      caller that renders this component without a session behind it — as
      `tests/server/t071/client-cap.test.ts` does, to drive the handle field's rendered
      `maxLength` — still gets a legal five-field form rather than a missing prop. */
  notifications?: Preferences;
  /** §05, §06 and §07, drawn between §04 and the footer so the numbered order matches the
      rail. None of the three writes through this component's Save — see the header. */
  children: React.ReactNode;
}) {
  /* The saved record, not the initial one. Save replaces it, so a second Save compares
     against what the account now holds and sends nothing for a field already written. */
  const [saved, setSaved] = useState(account);
  /* The second baseline the header explains: `AccountRecord` has no preferences member, so
     the four switches compare against their OWN saved copy rather than a field on `saved`. */
  const [savedPreferences, setSavedPreferences] = useState(notifications ?? FALLBACK_PREFERENCES);

  const [handle, setHandle] = useState(account.author.handle ?? "");
  const [email, setEmail] = useState(account.email ?? "");
  const [displayName, setDisplayName] = useState(account.author.displayName ?? "");
  const [bio, setBio] = useState(account.author.bio ?? "");
  const [hue, setHue] = useState(account.author.avatarHue ?? 210);
  const [visibility, setVisibility] = useState(account.defaultVisibility);
  const [preferences, setPreferences] = useState(savedPreferences);

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
    setPreferences(savedPreferences);
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
  const preferencesChanged =
    preferences.repin !== savedPreferences.repin ||
    preferences.fork !== savedPreferences.fork ||
    preferences.deprecation !== savedPreferences.deprecation ||
    preferences.digest !== savedPreferences.digest;
  const dirty =
    handleChanged || emailChanged || profileChanged || visibilityChanged || preferencesChanged;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    setDone(false);
    try {
      let record = saved;
      /* Handle first. It is the only one of the five that can be refused on grounds a
         reader has to act on — taken, or outside T070's grammar — so failing here leaves
         the other four unsent and the account exactly as it was, rather than half
         written under a name that did not land. */
      if (handleChanged) record = await patchJson<AccountRecord>("/api/account/handle", { handle });
      if (emailChanged) {
        /* An emptied field is `null` and not `""`. `AccountRecord.email` is
           `string | null`, and `setEmail` treats the two differently: null clears the
           column, an empty string is a value that fails the address check. */
        record = await patchJson<AccountRecord>("/api/account/email", {
          email: email === "" ? null : email,
        });
      }
      if (profileChanged) {
        record = await patchJson<AccountRecord>("/api/account/profile", {
          displayName: displayName === "" ? null : displayName,
          bio: bio === "" ? null : bio,
          avatarHue: hue,
        });
      }
      if (visibilityChanged) {
        record = await patchJson<AccountRecord>("/api/account/default-visibility", { visibility });
      }
      let nextPreferences = savedPreferences;
      if (preferencesChanged) {
        /* All four keys, not a diff: `setPreferences` accepts `Partial<Preferences>` and
           writes exactly the keys it is offered, defaulting the rest to what is already
           stored — sending the full local state is simplest and correct either way, and
           matches how the other four fields already "send what was typed". */
        const { preferences: written } = await patchJson<{ preferences: Preferences }>(
          "/api/account/notifications",
          preferences,
        );
        nextPreferences = written;
      }
      setSaved(record);
      setSavedPreferences(nextPreferences);
      setHandle(record.author.handle ?? "");
      setEmail(record.email ?? "");
      setDisplayName(record.author.displayName ?? "");
      setBio(record.author.bio ?? "");
      setHue(record.author.avatarHue ?? 210);
      setVisibility(record.defaultVisibility);
      setPreferences(nextPreferences);
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
        note={<SectionNote>who you are on the registry</SectionNote>}
      >
        <div className="flex flex-col gap-5">
          <Field
            id="handle"
            label="Handle"
            className="max-w-[36rem]"
            hint="Your handle is written into every card you publish as its author. If you rename, the old handle stays reserved: nobody else can ever take it, and only you can claim it back."
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
        note={<SectionNote tone="amber">◐ no mail sends</SectionNote>}
      >
        <div className="flex flex-col gap-4">
          <Field
            id="email"
            label="Email"
            className="max-w-[36rem]"
            hint="Never shown on your profile or on anything you publish."
          >
            <TextField id="email" value={email} onChange={setEmail} type="email" mono />
          </Field>

          {/* Live since T280: each switch flips `preferences` locally and `Save changes`
              below fans the whole four-key object out to `PATCH /api/account/notifications`
              exactly as it already does for handle, email, profile and visibility — one
              button, one request per changed field group. What is NOT live is the mailer
              behind them: `NotificationDelivery` is a published interface with no
              implementation (`lib/server/notifications/types.ts`'s own header), so a
              preference genuinely saves and nothing is ever sent because of it yet. */}
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
                  on={preferences[notification.id]}
                  label={notification.title}
                  /* Without this, a flip made while Save's sequential PATCHes are in
                     flight is silently overwritten by the stale closure's echo and the
                     footer still says saved — the exact window `busy` exists to close. */
                  busy={busy}
                  onToggle={() =>
                    setPreferences((current) => ({
                      ...current,
                      [notification.id]: !current[notification.id],
                    }))
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-[13px] leading-relaxed text-muted">
            Your email and the four preferences above are stored on your account.{" "}
            <span className="text-fg">Save changes</span> writes both. The mailer itself is
            not built yet: no mail goes out for any of them, whatever you choose here.
          </p>
        </div>
      </SettingsSection>

      {/* ---------- 04 ---------- */}
      <SettingsSection
        id="default-visibility"
        className="scroll-mt-24"
        step="04"
        title="Default visibility for new blueprints"
        note={<SectionNote>per blueprint, changeable later</SectionNote>}
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
              A new blueprint is visible to you alone. It appears on your profile only
              while you are signed in, and if it is a fork of somebody else&rsquo;s, that
              author is not told.
            </ChoiceCard>
            <ChoiceCard
              name="default-visibility"
              id="visibility-public"
              title="Public"
              selected={visibility === "public"}
              onSelect={() => setVisibility("public")}
            >
              Every new blueprint appears on your public profile as soon as you create
              it, and a fork says which blueprint it came from.
            </ChoiceCard>
          </div>
          <p className="text-xs leading-relaxed text-dim">
            Visibility is set per blueprint and you can change it later from your profile.
            Public and private blueprints are checked the same way.
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
 * The four notification rows, as copy — labels for `lib/server/notifications`' own
 * `EventKind`s, in `EVENT_KINDS`' order, never a fixture.
 *
 * This used to come off `ACCOUNT.notifications` in `lib/data/account.ts`, a fixture holding
 * three of the four keys with no column behind any of them (the fourth, `deprecation`, was
 * simply missing — a row this page had no way to switch because the server had nothing
 * called that either). Both are gone: the state is `preferences` above, off `getPreferences`,
 * and this constant is only ever the section's own description of what each key means. The
 * three sentences quoted below are D-190-04's, the module's own account of each event's
 * rule, not paraphrased here a second time.
 */
const NOTIFICATIONS: readonly { id: EventKind; title: string; note: string }[] = [
  {
    id: "repin",
    title: "A card one of your blueprints uses publishes a new version",
    note: "The one notification a version-pinned registry needs.",
  },
  {
    id: "fork",
    title: "Somebody forks a blueprint you published",
    note: "Public forks only: a private fork is never announced to the author it was forked from.",
  },
  {
    id: "deprecation",
    title: "A vocabulary term you authored is deprecated",
    note: "Carries the successor term to it, when the registry has one.",
  },
  {
    id: "digest",
    title: "A weekly summary of what changed in the registry",
    note: "Off by default. Nothing on this site is urgent enough to arrive uninvited.",
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
          Changes here update your account. They never rewrite the files you have
          published.
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
