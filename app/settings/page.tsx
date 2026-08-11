import Link from "next/link";
import type { Metadata } from "next";

import { ACCOUNT } from "@/lib/data/account";
import { allBlueprints, allNodeCards, getOntologyView } from "@/lib/content";
import { monthYear } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SideRail, type SideRailItem } from "@/components/ui/SideRail";
import {
  ChoiceCard,
  Field,
  PrefixedField,
  SectionNote,
  SettingsSection,
  Switch,
  TextField,
} from "@/components/settings/controls";
import { ProfileFields } from "@/components/settings/ProfileFields";

/* ============================================================
   /settings — what the registry knows about you.

   Seven sections on the documentation rail, in the register the
   Learn pages and the two detail pages already use.

   ── THE ONE THING TO UNDERSTAND BEFORE EDITING THIS FILE ──
   There is no account. `README.md` lists accounts under "Not built",
   `PROJECT.md` §2 says there is no backend at all, and nothing here
   changes that: every value is a row in `lib/data/account.ts`, every
   control is `readOnly` or `disabled`, and `Save changes` is off.

   That is stated in the open, above the first panel, and it is not
   decoration. Doc 2 §0.4 and this project's two HIGH findings are
   both about the same failure — a surface that looks like it works.
   A settings form is the worst possible place for it: a reader who
   types a new handle, presses Save and navigates away has been told
   something false by an interface that never said a word.

   So if a backend ever lands, the honesty strip and the `disabled`
   attributes come off in the SAME change that makes them false, and
   not before. PROJECT.md §3.5 is the entry describing what else moves
   with them.

   ── The one section that would not save even then ──
   §05 validator status needs a ballot, which is a different unbuilt
   thing from an account, and it wears `ComingSoonBadge` for it. It
   says so in its own head, which is why the strip at the top names
   it: a reader should not have to work out which half of a page is
   waiting on a database and which half is never going near one.

   An Appearance section stood at §06 and is deleted — see the note
   where it was. Nothing in it was a setting.
   ============================================================ */

export const metadata: Metadata = {
  title: "Settings",
  description:
    "What the registry knows about you, and what it will never keep. Not built yet: accounts, so every field here is seeded and nothing is stored.",
};

/**
 * The rail, matching the section list one for one.
 *
 * Every `href` and every `:target` mark is a literal, for the two reasons the node page's
 * rail records: `components/site/anchors.test.ts` reads `href: "#…"` out of a table like
 * this one, and Tailwind only compiles a class it can see spelled out. A mark built from
 * `href` would produce a highlight that never ships.
 *
 * No `active`. There is no scroll spy here, so the rail claims a position only once a
 * reader has chosen one — `:target` is exactly that fact, and it costs no JavaScript.
 */
const SETTINGS_SECTIONS: readonly SideRailItem[] = [
  {
    href: "#public-profile",
    label: "Public profile",
    step: "01",
  },
  {
    href: "#account-handle",
    label: "Account & handle",
    step: "02",
  },
  {
    href: "#notifications",
    label: "Email & notifications",
    step: "03",
  },
  {
    href: "#default-visibility",
    label: "Default visibility",
    step: "04",
  },
  {
    href: "#validator-status",
    label: "Validator status",
    step: "05",
  },
  {
    href: "#danger-zone",
    label: "Danger zone",
    step: "06",
    tone: "signal",
  },
];

/** One row of §07: a description, and the control that would carry it out. */
function DangerRow({
  title,
  children,
  action,
  why,
}: {
  title: string;
  children: React.ReactNode;
  action: string;
  /** Why the button is off. Printed rather than left in a `title` attribute. */
  why: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 rounded-md border border-line bg-surface p-4">
      <div className="flex min-w-[280px] flex-1 flex-col gap-1">
        <span className="text-sm text-fg">{title}</span>
        <span className="text-[13px] leading-relaxed text-muted">{children}</span>
      </div>
      <div className="flex flex-col items-end gap-2">
        {/* The `!` is load-bearing, not shorthand. `outline` carries
            `hoverable:hover:border-cyan hoverable:hover:text-cyan`, and `:hover` still
            matches a disabled button — so without `!important` this destructive control
            would turn the interactive colour under the pointer. */}
        <Button variant="outline" disabled className="border-signal/50! text-signal!">
          {action}
        </Button>
        <span className="font-mono text-[11px] text-dim">{why}</span>
      </div>
    </div>
  );
}

export default function Page() {
  const { author, email, validatorSince, validatorWeight, notifications } = ACCOUNT;

  /* Counted off `content/` at build time, not seeded, and marked `✓ counted` where it
     renders. What a handle has authored is an archive fact — `/u/[username]` already
     counts the same two figures the same way — and seeding a number the engine can count
     is how the two markers stop meaning anything.

     The vocabulary figure is the one worth saying out loud: a local term is namespaced
     with its author's handle (doc 3 §7, `lupo/pii-handling`), so ownership is read off the
     id rather than out of a field the term does not have. */
  /* Counted, not typed. The sentence in §07 used to say "nine bundles would stop
     resolving", which was true when it was written and is a number nothing holds to the
     archive — exactly the drift the `✓ counted` marker exists to make impossible. */
  const published = allBlueprints().length;
  const blueprints = allBlueprints().filter((b) => b.author.username === author.username);
  const cards = allNodeCards().filter((c) => c.card.author === author.username);
  const terms = getOntologyView().ontology.terms.filter((t) =>
    t.id.startsWith(`${author.username}/`),
  );

  return (
    <SideRail
      label="Settings"
      items={SETTINGS_SECTIONS}
      ariaLabel="Settings sections"
      /* The one caller that takes the compact list. Seven sections, no footer sequence, and
         below `xl` the rail is not drawn at all — see `SideRail`'s own note. */
      compact
      footer={
        <Link
          href={`/u/${author.username}`}
          className="font-mono text-[11px] text-dim transition-colors hoverable:hover:text-cyan"
        >
          ← Back to your profile
        </Link>
      }
    >
      <div className="container-page flex flex-col gap-10 py-10 lg:py-12">
        <SectionHeading
          as="h1"
          eyebrow="Account"
          title="Settings"
          lead="What the registry knows about you, and what it will never keep."
        />

        {/* The honesty strip. Two different claims, so two markers: the values are rows in
            `lib/data/`, and the thing that would write them back does not exist. It sits
            above the first field rather than beside the Save button, because a reader who
            only finds out at the bottom has already filled the form in. */}
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2/50 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="label">What saves</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-amber">
              ◐ seeded
            </span>
            <ComingSoonBadge />
          </div>
          <p className="text-[13px] leading-relaxed text-muted">
            Nothing on this page is stored, because there is no account behind it. Every
            value below is a row in{" "}
            <span className="font-mono text-fg">lib/data/account.ts</span>, and{" "}
            <span className="text-fg">Save changes</span> is switched off rather than
            quietly doing nothing. The three fields in{" "}
            <span className="text-fg">Public profile</span> do answer you, because their
            whole effect is the preview beside them; every other control is switched off,
            because its only effect would be to save. Two of these sections would not save
            even once accounts exist, and say so in their own head:{" "}
            <span className="text-fg">validator status</span>, which needs a ballot nobody
            has built, and <span className="text-fg">appearance</span>, which stays in this
            browser.
          </p>
        </div>

        {/* ---------- 01 ---------- */}
        <SettingsSection
          id="public-profile"
          className="scroll-mt-24"
          step="01"
          title="Public profile"
          tone="lead"
          note={<SectionNote>visible to everyone</SectionNote>}
        >
          {/* The one live part of this page, and the rule that lets it be live:
              a control works when its effect is local and immediate, and is switched off
              when its only effect would be persistence. A name, a bio and a hue produce a
              preview; the preview is the section. `components/settings/ProfileFields.tsx`
              carries the argument in full. */}
          <ProfileFields author={author} />
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
              <PrefixedField
                id="handle"
                prefix="darkprint.io/u/"
                value={author.username}
                label="Handle"
              />
            </Field>

            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="label">Authored under this handle</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald">
                  ✓ counted
                </span>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[13px] text-muted">
                <span>
                  {blueprints.length} blueprint{blueprints.length === 1 ? "" : "s"}
                </span>
                <span>
                  {cards.length} node card{cards.length === 1 ? "" : "s"}
                </span>
                <span>
                  {terms.length} vocabulary term{terms.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">
                Counted from the versioned archive at build time. A published card carries
                the handle inside its own bytes, which is why the old one stays reserved.
              </p>
            </div>
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
              <TextField id="email" value={email} mono />
            </Field>

            <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-center gap-4 px-4 py-3.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-sm text-fg">{n.title}</span>
                    <span className="text-xs leading-relaxed text-dim">{n.note}</span>
                  </span>
                  <Switch on={n.on} label={n.title} />
                </li>
              ))}
            </ul>
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
                selected={ACCOUNT.defaultVisibility === "private"}
              >
                A new bundle is yours until you decide otherwise. It is listed on your
                profile for you alone, and if you started it from somebody else&rsquo;s,
                that author is not told it exists.
              </ChoiceCard>
              <ChoiceCard
                name="default-visibility"
                id="visibility-public"
                title="Public"
                selected={ACCOUNT.defaultVisibility === "public"}
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

        {/* ---------- 05 ---------- */}
        <SettingsSection
          id="validator-status"
          className="scroll-mt-24"
          step="05"
          title="Validator status"
          tone="amber"
          note={<ComingSoonBadge />}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-5">
              <Badge
                color="var(--color-cyan)"
                className="border-cyan/40! bg-cyan/10! text-cyan!"
              >
                ✦ Validator
              </Badge>
              <span className="font-mono text-[11px] text-dim">
                {validatorSince === undefined
                  ? "not granted"
                  : `granted ${monthYear(validatorSince)}`}{" "}
                · weight ×{validatorWeight} on community metrics
              </span>
            </div>
            <p className="prose-lane text-[13px] leading-relaxed text-muted">
              The badge is a preview. Validator voting is not built, so the three community
              metrics on every scorecard are seeded and nothing here carries weight over
              anyone else&rsquo;s reading.
            </p>
          </div>
        </SettingsSection>

        {/* §06 Appearance stood here and is deleted on the author's instruction.
            ------------------------------------------------------------
            It drew three cards — the dark ground, the cyanotype register and reduced
            motion — and none of them was a setting. The site has one theme, the blueprint
            register is opted into per section by the pages that use it, and reduced motion
            is the browser's answer rather than this page's. So the panel was three
            statements about how the interface already behaves, sitting in a list of things
            a reader came here to change. Removed rather than reworded: a settings page is
            for settings.

            The two sentences it carried that were worth keeping are already elsewhere —
            `app/globals.css` documents both poles, and the reduced-motion rule is written
            where it is honoured. */}

        {/* ---------- 06 ---------- */}
        <SettingsSection
          id="danger-zone"
          className="scroll-mt-24"
          step="06"
          title="Danger zone"
          tone="signal"
          note={<SectionNote tone="signal">irreversible</SectionNote>}
        >
          <div className="flex flex-col gap-3">
            <DangerRow
              title="Delete account"
              action="Delete account"
              why="no account to delete"
            >
              Your handle is reserved, your private bundles are destroyed, and everything
              you published stays. A pinned card cannot be withdrawn: {published} bundles in
              the archive would stop resolving.
            </DangerRow>
            <DangerRow
              title="Transfer a blueprint"
              action="Transfer"
              why="no ownership to move"
            >
              Hand ownership to another handle. The digest does not change, because the
              bundle is the same bytes. Only the author line moves.
            </DangerRow>
          </div>
        </SettingsSection>

        {/* The footer, and the one control on this page a reader would expect to work.
            Disabled with a badge beside it, per the rule at the top of this file: a Save
            button that silently discards a form is the defect, not the absence of one. */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button
            disabled
            title="Nothing is stored yet: there is no account behind this page."
          >
            Save changes
          </Button>
          <Button variant="ghost" disabled>
            Discard
          </Button>
          <ComingSoonBadge />
          <span className="font-mono text-[11px] text-dim sm:ml-auto">
            As designed, a change here applies to your account and never to anything you
            have published.
          </span>
        </div>
      </div>
    </SideRail>
  );
}
