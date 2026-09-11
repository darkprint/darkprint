"use client";

import { cx } from "@/lib/format";

/* ============================================================
   The chrome `/settings` is built out of.

   Seven numbered panels, each with the same head (a `.label-lead`
   title on the left, one mono note on the right) and the same
   20px body. The head is where a section says what kind of thing
   it is — "visible to everyone", "identity", "◐ no mail sends" —
   so it is a required prop rather than an optional one: a settings
   panel that does not say where its values go is the panel this
   whole surface exists to avoid.

   ── The controls are live now, and the rule that decides which ──
   There is an account behind this page (T050), so a control that
   has a route is enabled and writes; a control whose only effect
   would be to save something nothing stores is still disabled, and
   says which of the two it is.

   **A control is never both enabled and inert, or disabled and
   functional** — that is the criterion, and both directions fail it
   (T262 AC2). Enabling everything passes a naive "nothing is
   disabled" check and fails this one.

   T280 moves the line again: the four notification switches, the
   danger zone's two actions and the API keys section were the
   three surfaces still carrying a reason rather than a route, and
   T280 wires all three — `Switch` gains a live `onToggle` shape
   for the first, `components/settings/DangerZone.tsx` and
   `ApiKeys.tsx` are new client components for the other two. What
   is now on the page and genuinely does nothing has become the
   exception rather than the rule, which is the direction D-78
   always pointed this component in.

   `readOnly` is gone from the text fields, but the reason it was
   there survives in what replaced it: an editable input keeps its
   contrast, its focus ring and its selection, which is what a
   reader needs to tab to a handle and copy it. The switches stay
   `aria-disabled` rather than `disabled` for the same reason they
   always did — it keeps them in the tab order, so a screen-reader
   reader meets the row and its explanation at all.
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

/**
 * A one-line value. `mono` for anything that is an identifier rather than a name.
 *
 * `onChange` is required rather than optional, and that is the AC2 rule expressed as a
 * type: a field with no handler is a field that discards what a reader types, and making
 * it impossible to build one is cheaper than remembering not to.
 */
export function TextField({
  id,
  value,
  onChange,
  mono = false,
  type = "text",
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  mono?: boolean;
  type?: "text" | "email";
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
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
  onChange,
  label,
  placeholder,
  maxLength,
}: {
  id: string;
  prefix: string;
  value: string;
  onChange: (next: string) => void;
  label: string;
  /** What an account with no handle yet sees in the empty field (T050 AC1). */
  placeholder?: string;
  /**
   * Optional, and the omission is meaningful rather than a convenience: a field with no
   * product bound must render an `<input>` with no `maxLength`, not one capped at some
   * default this component picked. Passed through to the intrinsic element so the browser
   * enforces it on typing and on paste.
   */
  maxLength?: number;
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
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`${label}, at ${prefix}`}
        className="h-full min-w-0 flex-1 bg-transparent pl-1 pr-3 font-mono text-sm text-fg placeholder:text-dim"
      />
    </span>
  );
}

/**
 * A switch. Two shapes, on one union, and which one a call site gets depends on which prop
 * it passes rather than on a mode flag — a caller cannot pass both `reason` and `onToggle`,
 * and TypeScript is what enforces that rather than a runtime check.
 *
 * **`reason`: permanently inert, and says why.** `role="switch"` with `aria-checked` rather
 * than a styled checkbox — the state is the whole content of the control — and
 * `aria-disabled` (not `disabled`) keeps it in the tab order so a screen-reader reader meets
 * the row at all. Nothing is bound to it: there is no `onClick`, so a press does nothing and
 * `reason` names what is actually missing. The wording used to be a literal inside this
 * component — "Nothing is stored yet, so this cannot be changed" — true only while every
 * control on the page was inert; a disabled control explaining itself with the page's old
 * blanket reason is the D-78 failure in miniature, which is why the sentence comes from the
 * call site.
 *
 * **`onToggle`: live.** The switch flips its LOCAL value on press and leaves persistence to
 * the caller — T280 wires the four notification switches through `AccountForm`'s shared Save
 * button rather than one PATCH per press, so this component never calls `fetch` itself.
 * `busy` disables the control only while a request that will settle it is in flight, and it
 * is passed as `disabled={busy}` — an EXPRESSION, never a bare `disabled` — because a switch
 * that works and is briefly waiting on its own network round trip is ordinary UI, not a
 * claim that the feature is unbuilt (T262 AC2's "a `disabled={expr}` is not a static
 * refusal").
 *
 * **Two overload signatures, one implementation.** `tests/server/t262/ac2-controls.test.ts`
 * derives which wrappers are "parked" (permanently off, never counted as inert) by reading
 * THIS FILE's function declarations: a wrapper whose body mentions `disabled`/`aria-disabled`
 * and whose PARAMETER LIST names no `on*` prop is parked. A single implementation destructured
 * from a union parameter (`function Switch(props: SwitchProps)`) hides `onToggle` from that
 * scan — the name never appears in `props: SwitchProps`'s own text — and every live switch on
 * the page reads as parked, which is `offStatically`, alongside a real `onToggle`. That is
 * "disabled and functional" by the scanner's own definition, on a control that is neither: it
 * is exactly the false positive the header of that file calls out for `controls.tsx` itself and
 * exempts by NOT scanning this file's call sites — a trap this function's own SHAPE was setting
 * for its callers. The two signatures below keep the exhaustive, one-of-two-shapes type at every
 * call site; the implementation destructures `onToggle` in its own parameter list, which is what
 * the scanner reads.
 */
export function Switch(props: {
  on: boolean;
  label: string;
  reason: string;
  onToggle?: undefined;
  busy?: undefined;
}): React.JSX.Element;
export function Switch(props: {
  on: boolean;
  label: string;
  reason?: undefined;
  onToggle: () => void;
  busy?: boolean;
}): React.JSX.Element;
export function Switch({
  on,
  label,
  reason,
  onToggle,
  busy = false,
}: {
  on: boolean;
  label: string;
  reason?: string;
  onToggle?: () => void;
  busy?: boolean;
}): React.JSX.Element {
  if (onToggle === undefined) {
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
          title={reason}
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

  return (
    <span className="flex flex-none items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        {on ? "on" : "off"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={busy}
        disabled={busy}
        aria-label={label}
        onClick={onToggle}
        className={cx(
          "relative h-[22px] w-10 shrink-0 rounded-full border transition-colors disabled:cursor-wait disabled:opacity-70",
          on ? "border-cyan/60 bg-cyan/25" : "border-line-bright bg-surface-3",
        )}
      >
        {/* Live, so the knob DOES travel: a caller can flip this switch and see it move. */}
        <span
          aria-hidden
          className={cx(
            "absolute top-[2px] h-4 w-4 rounded-full transition-[left] duration-[120ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
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
 * A radio input inside its own label, so the card is announced as one option of a group
 * rather than as a paragraph with a dot next to it. The selected one carries the cyan edge
 * the rest of the site uses for "this is the current choice".
 *
 * `checked` and not `defaultChecked`: the value lives in the form above, which is what
 * lets Save send it and Discard put it back. A `defaultChecked` radio holds its own state
 * and would drift from the thing that gets written.
 */
export function ChoiceCard({
  name,
  id,
  title,
  selected,
  onSelect,
  aside,
  children,
}: {
  name: string;
  id: string;
  title: string;
  selected: boolean;
  onSelect: () => void;
  /** A word at the card's right end — "recommended", and nothing else so far. */
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex cursor-pointer flex-col gap-2 rounded-md border p-4 transition-colors",
        selected ? "border-cyan/50 bg-cyan/[0.06]" : "border-line hoverable:hover:border-line-bright",
      )}
    >
      <span className="flex items-center gap-2.5">
        <input
          id={id}
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
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
