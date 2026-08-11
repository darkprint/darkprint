import { cx } from "@/lib/format";

/* ============================================================
   The chrome `/settings` is built out of.

   Seven numbered panels, each with the same head (a `.label-lead`
   title on the left, one mono note on the right) and the same
   20px body. The head is where a section says what kind of thing
   it is — "visible to everyone", "this browser only", "◐ nothing
   sends" — so it is a required prop rather than an optional one:
   a settings panel that does not say where its values go is the
   panel this whole surface exists to avoid.

   ── Everything here is inert, and that is the design ──
   Nothing on this site stores an account (`PROJECT.md` §2), so no
   control below takes a handler and every one of them is `readOnly`
   or `disabled`. A field a reader can type into and a switch they
   can flip, both discarded on navigation, would be four lies per
   screen; the page states the reason once, in the open, above the
   first panel, and the controls simply do not pretend.

   `readOnly` and not `disabled` for the text fields, on purpose: a
   read-only input keeps its contrast, its focus ring and its
   selection, so a reader can still tab to the handle and copy it. A
   disabled one is skipped by the keyboard and dimmed to the point
   where the value stops being the thing on screen. The switches and
   the radios go the other way — there is nothing to read out of them
   but their state, and the state is already printed as a word beside
   each one.
   ============================================================ */

/** The four grounds a settings panel can stand on. */
type Tone = "lead" | "plain" | "amber" | "signal";

/**
 * `lead` is spent once, on §01: `app/globals.css` allows at most one `.panel-lead` per
 * page, and the public profile is the section a reader opens this route to change.
 * `amber` carries the same contract it does everywhere else — a thing that is not built —
 * and `signal` marks the one section whose actions cannot be undone.
 */
const TONES: Record<Tone, { panel: string; rule: string; title: string }> = {
  lead: { panel: "panel panel-lead", rule: "border-line", title: "" },
  plain: { panel: "panel", rule: "border-line", title: "" },
  amber: {
    panel: "rounded-lg border border-amber/25 bg-amber/5",
    rule: "border-amber/20",
    title: "",
  },
  signal: {
    panel: "rounded-lg border border-signal/35 bg-signal/[0.04]",
    rule: "border-signal/25",
    /* No `!`. `.label-lead` sets its colour inside `@layer components` and this is a
       utility, so the layer order in `app/globals.css` already decides it. */
    title: "text-signal",
  },
};

/**
 * One numbered section of the page.
 *
 * ── Why the scroll offset is the caller's and not this component's ──
 * The header is `sticky top-0` over a 4rem row, so every one of these needs `scroll-mt-24`
 * or a rail row pointing at it scrolls its own heading underneath the header.
 * `components/site/anchors.test.ts` is the guard for that, and it reads SOURCE TEXT: it
 * finds `id="…"`, takes the tag it is written in, and fails unless that tag carries a
 * scroll margin. Setting the class in here would put the id in one file and the offset in
 * another, which does not fail the guard so much as make it unfalsifiable.
 *
 * So `className` is required rather than optional, and every call site spells it out. A
 * section added without one fails a named case instead of shipping an anchor that lands
 * 64px short.
 */
export function SettingsSection({
  id,
  step,
  title,
  note,
  tone = "plain",
  className,
  children,
}: {
  id: string;
  /** Two digits, matching the rail. */
  step: string;
  title: string;
  /** What this section's values are, in one phrase. Rendered at the head's right end. */
  note: React.ReactNode;
  tone?: Tone;
  /** The anchor's scroll offset, written at the call site beside the id. See above. */
  className: string;
  children: React.ReactNode;
}) {
  const shape = TONES[tone];
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx("p-5", shape.panel, className)}>
      <div className={cx("flex flex-wrap items-center justify-between gap-3 border-b pb-4", shape.rule)}>
        <h2 id={`${id}-title`} className={cx("label-lead", shape.title)}>
          {step} · {title}
        </h2>
        {note}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** The head's right-hand note: what kind of value this section holds. */
export function SectionNote({
  children,
  tone = "dim",
}: {
  children: React.ReactNode;
  tone?: "dim" | "amber" | "signal";
}) {
  return (
    <span
      className={cx(
        "font-mono text-[11px] uppercase tracking-[0.12em]",
        tone === "amber" && "text-amber",
        tone === "signal" && "text-signal",
        tone === "dim" && "text-dim",
      )}
    >
      {children}
    </span>
  );
}

/* The shell every field on the page shares. `bg-void` and not `bg-surface-2`: an input
   is a well cut into the panel, so it is darker than the panel rather than lighter, which
   is the one thing that distinguishes it from the read-only sub-panels beside it. No
   `outline-none` — the unlayered `:focus-visible` rule in `app/globals.css` is a
   guarantee, and a utility here would outrank it. */
const FIELD = "rounded-md border border-line bg-void text-fg transition-colors focus:border-cyan";

/** A labelled control with an optional line of explanation under it. */
export function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p className="font-mono text-[11px] leading-relaxed text-dim">{hint}</p>
      )}
    </div>
  );
}

/** A one-line value. `mono` for anything that is an identifier rather than a name. */
export function TextField({
  id,
  value,
  mono = false,
}: {
  id: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      readOnly
      className={cx(FIELD, "h-10 px-3 text-sm", mono ? "font-mono" : "font-sans")}
    />
  );
}

/**
 * The handle, with the URL it becomes printed inside the field.
 *
 * The prefix is `aria-hidden` and repeated in the input's `aria-label`, because a screen
 * reader reading "darkprint.io/u/" as a sibling of an unlabelled text box announces a
 * fragment of a URL and then a value with no name.
 */
export function PrefixedField({
  id,
  prefix,
  value,
  label,
}: {
  id: string;
  prefix: string;
  value: string;
  label: string;
}) {
  return (
    <span className={cx(FIELD, "flex h-10 items-center overflow-hidden")}>
      <span aria-hidden className="shrink-0 pl-3 font-mono text-sm text-dim">
        {prefix}
      </span>
      <input
        id={id}
        type="text"
        value={value}
        readOnly
        aria-label={`${label}, at ${prefix}`}
        className="h-full min-w-0 flex-1 bg-transparent pl-1 pr-3 font-mono text-sm text-fg"
      />
    </span>
  );
}

/**
 * A switch that shows a state and cannot change it.
 *
 * `role="switch"` with `aria-checked` rather than a styled checkbox: the state is the
 * whole content of the control, and `aria-disabled` (not `disabled`) keeps it in the tab
 * order so a screen-reader reader meets the row at all. Nothing is bound to it — there is
 * no `onClick`, so a press does nothing and the `title` says why.
 */
export function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex flex-none items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        {on ? "on" : "off"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled
        aria-label={label}
        title="Nothing is stored yet, so this cannot be changed."
        className={cx(
          "relative h-[22px] w-10 shrink-0 cursor-not-allowed rounded-full border",
          on ? "border-cyan/60 bg-cyan/25" : "border-line-bright bg-surface-3",
        )}
      >
        {/* No transition. The knob never travels: this switch has one state for the whole
            life of the page, and a duration on a property nothing changes is a promise
            that it might. */}
        <span
          aria-hidden
          className={cx(
            "absolute top-[2px] h-4 w-4 rounded-full",
            on ? "left-[20px] bg-cyan" : "left-[2px] bg-dim",
          )}
        />
      </button>
    </span>
  );
}

/**
 * One of §04's two visibility cards.
 *
 * A radio input, `disabled`, inside its own label, so the card is announced as one option
 * of a group rather than as a paragraph with a dot next to it. The selected one carries
 * the cyan edge the rest of the site uses for "this is the current choice".
 */
export function ChoiceCard({
  name,
  id,
  title,
  selected,
  aside,
  children,
}: {
  name: string;
  id: string;
  title: string;
  selected: boolean;
  /** A word at the card's right end — "recommended", and nothing else so far. */
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex cursor-not-allowed flex-col gap-2 rounded-md border p-4",
        selected ? "border-cyan/50 bg-cyan/[0.06]" : "border-line",
      )}
    >
      <span className="flex items-center gap-2.5">
        <input
          id={id}
          type="radio"
          name={name}
          defaultChecked={selected}
          disabled
          className="h-3.5 w-3.5 accent-cyan"
        />
        <span className="text-sm font-medium text-fg">{title}</span>
        {aside !== undefined && (
          <span className="ml-auto font-mono text-[11px] text-cyan">{aside}</span>
        )}
      </span>
      <span className="text-[13px] leading-relaxed text-muted">{children}</span>
    </label>
  );
}
