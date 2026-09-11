import type { Metadata } from "next";
import Link from "next/link";

import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
import { SITE_NAME, SITE_ORIGIN } from "@/lib/site";

/* ============================================================
   /privacy: what this site stores about a person, read off the schema

   Written against `lib/db/schema.ts` and the auth modules rather than from a
   template, because a policy that names a field the database does not have is
   worse than no policy: it is a claim about someone's data that nobody can
   check. Every column named below is a column that exists.

   Two things this page must keep saying, because both are unusual enough that a
   reader would otherwise assume the ordinary case: an API key is stored only as
   a hash and cannot be shown again, and deleting an account leaves a tombstone
   whose handle is reserved forever. Neither is a dark pattern and both surprise
   people who are not told.
   ============================================================ */

const UPDATED = "11 September 2026";

export const metadata: Metadata = {
  title: "Privacy",
  description: `What ${SITE_NAME} stores about you, why, where it is held, and how to get rid of it.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <PanelHeading as="h2">{title}</PanelHeading>
      {children}
    </section>
  );
}

const P = "text-[15px] leading-relaxed text-muted";
const LINK = "text-cyan underline underline-offset-4 hoverable:hover:text-cyan-bright";

export default function PrivacyPage() {
  return (
    <div className="container-page flex flex-col gap-10 py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Legal"
        title="Privacy"
        lead={`What ${SITE_NAME} stores about you, why it is stored, who else can see it, and how to remove it. Written against the database schema rather than from a template, so every field named here is a field that exists.`}
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        Last updated {UPDATED}
      </p>

      <Section title="You can read the whole site without an account">
        <p className={P}>
          Browsing blueprints, reading cards, searching, and validating a folder on{" "}
          <Link href="/upload" className={LINK}>
            Publish
          </Link>{" "}
          need no account and store nothing about you. The validator runs in your own tab.
        </p>
      </Section>

      <Section title="What signing in stores">
        <p className={P}>
          Signing in uses GitHub or Google. DarkPrint never sees your password. From GitHub it
          asks for <code className="font-mono text-[13px] text-fg">read:user user:email</code>,
          and from Google for{" "}
          <code className="font-mono text-[13px] text-fg">openid email profile</code>, which are
          the narrowest scopes each offers for identity. Nothing about your repositories, your
          Drive, your contacts or your calendar is requested.
        </p>
        <p className={P}>
          What is written to the database is your provider account id, the login name the
          provider asserts, the email address it asserts, and the display name and avatar it
          returns. If you link a second provider, that identity is stored beside the first with
          the address it asserted at the time, kept as the record of why the two were joined.
          Identities are matched on the provider&rsquo;s own stable id and never on an email
          address, because addresses move between people.
        </p>
        <p className={P}>
          A handle, a display name and a bio are yours to set, and are public when set. Your
          email address is not shown on any page.
        </p>
      </Section>

      <Section title="What using the site adds">
        <p className={P}>
          Blueprints and cards you publish, forks you cut, drafts you start, and the visibility
          you set on each. Saves, stars and notes you leave, which are public where they render.
          Run reports you submit, which carry what a run cost and never the run&rsquo;s content.
          An audit trail of account actions, which records what was done and to what, and
          deliberately never a credential, a query or a stack trace.
        </p>
      </Section>

      <Section title="Cookies">
        <p className={P}>
          One cookie, <code className="font-mono text-[13px] text-fg">darkprint_session</code>,
          set when you sign in and holding a signed session. It is{" "}
          <code className="font-mono text-[13px] text-fg">HttpOnly</code>, so scripts cannot read
          it, and it is sent only to this site. There is no advertising cookie and no
          cross-site tracker.
        </p>
      </Section>

      <Section title="API keys">
        <p className={P}>
          A key is shown to you once, at the moment you mint it, and only a hash of it is
          stored. DarkPrint cannot show it to you again and cannot recover it, which is also why
          nobody who reads the database can use your key. Revoking a key is the way to take it
          back, and revocation is immediate.
        </p>
      </Section>

      <Section title="Who else processes it">
        <p className={P}>
          The site runs on Vercel and the database and file storage are Supabase, in the
          European Union. Sign-in goes through GitHub and Google, who see that you signed in
          here.
        </p>
        <p className={P}>
          Vercel Web Analytics counts page views. It sets no cookie and does not follow you
          across sites. Where a page address contains a secret, which is true of a live tutorial
          page, the address is rewritten to its route before the count leaves your browser, so no
          token reaches the dashboard.
        </p>
        <p className={P}>
          Nothing is sold, and nothing is shared with anyone else. No mail is sent, because no
          sender is configured.
        </p>
      </Section>

      <Section title="Deleting your account, and the one thing that survives it">
        <p className={P}>
          You can delete your account from{" "}
          <Link href="/settings" className={LINK}>
            Settings
          </Link>
          . Your bundles and their releases go, and so do the files behind them.
        </p>
        <p className={P}>
          Two things outlive the deletion, and both are deliberate. A tombstone row remains, so
          that counts and references elsewhere do not silently change meaning. And your handle is
          reserved permanently: nobody can claim it afterwards, including you. That is there so a
          name someone linked to cannot later point at a different person. Tell us if you need the
          tombstone itself removed.
        </p>
      </Section>

      <Section title="Asking for a copy, or a correction">
        <p className={P}>
          Write to{" "}
          <a href="mailto:dev@darkprint.io" className={LINK}>
            dev@darkprint.io
          </a>{" "}
          for a copy of what is held about you, a correction, or a deletion that the Settings page
          does not cover. DarkPrint is a small project rather than a company; the answer comes
          from a person reading the same database this page describes.
        </p>
      </Section>

      <Section title="Changes">
        <p className={P}>
          This page is versioned with the site, so its history is in the repository beside the
          schema it describes. The date at the top is the day it last changed.
        </p>
      </Section>

      <p className="text-sm leading-relaxed text-dim">
        <Link href="/terms" className={LINK}>
          Terms of use
        </Link>{" "}
        covers what you may do here and what DarkPrint promises in return. The canonical address
        for this page is{" "}
        <code className="font-mono text-[13px] text-blueprint-ink">{SITE_ORIGIN}/privacy</code>.
      </p>
    </div>
  );
}
