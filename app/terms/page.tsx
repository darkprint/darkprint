import type { Metadata } from "next";
import Link from "next/link";

import { PanelHeading, SectionHeading } from "@/components/ui/SectionHeading";
import { SITE_NAME, SITE_ORIGIN } from "@/lib/site";

/* ============================================================
   /terms: what you may do here, and what this site promises back

   The one clause that is not boilerplate is the scoring one. DarkPrint computes
   an autonomy class, a security level and a phase coverage for every release
   and prints them beside somebody's work, so the terms have to say plainly what
   that reading is and is not. `lib/core/gate.ts` already rules that an inference
   may never refuse anybody's work; this page is where a reader is told the same
   thing in words they did not have to read the engine for.
   ============================================================ */

const UPDATED = "11 September 2026";

export const metadata: Metadata = {
  title: "Terms of use",
  description: `What you may do on ${SITE_NAME}, what you keep, and what the site does and does not promise.`,
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

export default function TermsPage() {
  return (
    <div className="container-page flex flex-col gap-10 py-16 sm:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Legal"
        title="Terms of use"
        lead={`What you may do on ${SITE_NAME}, what stays yours, and what this site promises in return. Short, because the site does little on your behalf.`}
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-dim">
        Last updated {UPDATED}
      </p>

      <Section title="What this site is">
        <p className={P}>
          A registry of blueprints. A blueprint is a folder describing an agent pipeline as a
          typed graph, which you fetch and run on your own machine.{" "}
          <strong className="text-fg">Nothing here runs a blueprint</strong>, runs a node, or
          calls a model on your behalf. What happens when you run one is yours.
        </p>
      </Section>

      <Section title="What you publish stays yours">
        <p className={P}>
          You keep every right you had in what you publish. By publishing something publicly you
          give others permission to fetch it, read it, fork it and build on it, which is the
          point of a registry, and you give DarkPrint permission to store it, serve it and show
          it in search. Set a blueprint or a card private and it is served to you alone.
        </p>
        <p className={P}>
          Publish only what you are entitled to publish. A card carries an{" "}
          <code className="font-mono text-[13px] text-fg">author</code> line and that line is a
          claim about authorship you are making.
        </p>
      </Section>

      <Section title="What the scores mean, and what they do not">
        <p className={P}>
          DarkPrint computes an autonomy class, a security level and a phase coverage for every
          release, and prints them beside the work. Those are readings of the shape you wrote:
          they are derived from your own graph and your own cards, by walking them. They are not
          an audit, not a safety certification, and not a judgement of quality.
        </p>
        <p className={P}>
          A reading is never a refusal. A release may carry a poor score and still publish,
          because a score is DarkPrint&rsquo;s opinion about work that is yours. Check a blueprint
          yourself before you run it.
        </p>
      </Section>

      <Section title="What you may not do">
        <p className={P}>
          Publish someone else&rsquo;s work as your own, publish anything unlawful, attack the
          service or the people using it, or use the registry to distribute malware. Automated
          reading is fine and rate limits apply; share an API key with nobody, since it acts as
          your account.
        </p>
      </Section>

      <Section title="Accounts">
        <p className={P}>
          One person, one account, through GitHub or Google. You are responsible for what happens
          under yours. Delete it whenever you like from{" "}
          <Link href="/settings" className={LINK}>
            Settings
          </Link>
          , and read{" "}
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>{" "}
          first: a handle is reserved permanently once released, so the name cannot be reused by
          anyone, including you.
        </p>
      </Section>

      <Section title="No warranty">
        <p className={P}>
          The site is provided as it is, with no warranty. It may be unavailable, it may lose
          data, and a blueprint you fetch may be wrong. To the extent the law allows, DarkPrint is
          not liable for what follows from using it, and that includes what a pipeline does when
          you run it on your own machine.
        </p>
      </Section>

      <Section title="Ending it">
        <p className={P}>
          You may stop using the site at any time. DarkPrint may remove content that breaks these
          terms, or suspend an account doing so, and will say why when it does.
        </p>
      </Section>

      <Section title="Changes">
        <p className={P}>
          These terms are versioned with the site, so their history sits in the repository. The
          date at the top is the day they last changed. Continuing to use the site after a change
          is how you accept it.
        </p>
      </Section>

      <p className="text-sm leading-relaxed text-dim">
        Questions to{" "}
        <a href="mailto:dev@darkprint.io" className={LINK}>
          dev@darkprint.io
        </a>
        . The canonical address for this page is{" "}
        <code className="font-mono text-[13px] text-blueprint-ink">{SITE_ORIGIN}/terms</code>.
      </p>
    </div>
  );
}
