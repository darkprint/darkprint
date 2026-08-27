import { AccountForm } from "darkprint";

/**
 * The whole settings page's own composition — `account`, `counts` and `children` are one
 * component's state (see the source header: one `Save changes` writes all five sections),
 * so a narrower slice would render a form that cannot save anything. `children` stands in
 * for §05, §06 and §07, which are never this component's own state — reproduced here as the
 * same numbered section shell the real page repeats three more times, rather than pulled in
 * from `darkprint`, since `SettingsSection` is not this batch's component.
 */
export const FullPage = () => (
  <AccountForm
    account={{
      accountId: "acct_orin",
      author: {
        handle: "orin",
        displayName: "Orin Vale",
        avatarHue: 210,
        validator: true,
        bio: "Builds unattended pipelines and reads the ones other people ship.",
      },
      email: "orin@example.com",
      joinedAt: new Date("2026-02-14"),
      validatorSince: new Date("2026-05-01"),
      validatorWeight: 2,
      defaultVisibility: "private",
    }}
    notifications={{ repin: true, fork: true, deprecation: true, digest: false }}
    counts={
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
        <span className="label">Authored under this handle</span>
        <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
          <span>4 blueprints</span>
          <span>7 node cards</span>
          <span>2 vocabulary terms</span>
        </div>
        <p className="text-[13px] leading-relaxed text-muted">
          Counted from the registry when this page was asked for. A published card carries
          the handle inside its own bytes, which is why the old one stays reserved.
        </p>
      </div>
    }
  >
    <div className="scroll-mt-24 flex flex-col gap-4 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-fg">
          <span className="text-dim">05</span> Validator status
        </h3>
        <span className="font-mono text-[11px] text-amber">◐ read-only here</span>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan">
          ✦ Validator
        </span>
        <span className="font-mono text-[11px] text-dim">
          granted May 2026 · weight ×2 on community metrics
        </span>
      </div>
    </div>
  </AccountForm>
);
