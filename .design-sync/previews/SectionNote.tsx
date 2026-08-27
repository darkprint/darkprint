import { Field, SectionNote, SettingsSection, TextField } from "darkprint";

/**
 * `SectionNote` is always the right-hand word of a settings section's head, beside the
 * step number and title — it is never seen bare on a real page, so each cell is the
 * section it actually labels. The three cells sweep the tone axis, ported from
 * `AccountForm`/`app/settings/page.tsx`'s own three uses of it.
 */
export const IdentityTone = () => (
  <SettingsSection
    id="account-handle"
    className=""
    step="02"
    title="Account & handle"
    note={<SectionNote>identity</SectionNote>}
  >
    <Field id="handle" label="Handle" className="max-w-[24rem]">
      <TextField id="handle" value="orin" onChange={() => undefined} mono />
    </Field>
  </SettingsSection>
);

export const AmberTone = () => (
  <SettingsSection
    id="notifications"
    className=""
    step="04"
    title="Notifications"
    note={<SectionNote tone="amber">◐ no mail sends</SectionNote>}
  >
    <p className="text-sm leading-relaxed text-muted">
      The four switches below record a preference. Nothing on this route sends mail yet.
    </p>
  </SettingsSection>
);

export const SignalTone = () => (
  <SettingsSection
    id="danger-zone"
    className=""
    step="07"
    title="Danger zone"
    tone="signal"
    note={<SectionNote tone="signal">irreversible</SectionNote>}
  >
    <p className="text-sm leading-relaxed text-muted">
      Deleting an account removes every blueprint and card it owns. There is no undo.
    </p>
  </SettingsSection>
);
