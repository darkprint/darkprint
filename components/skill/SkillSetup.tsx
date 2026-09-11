import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { CopyButton } from "@/components/ui/CopyButton";
import { PanelHeading } from "@/components/ui/SectionHeading";
import { cx } from "@/lib/format";
import {
  CLAUDE_CODE_SKILLS_PARENT,
  CODEX_SKILLS_PARENT,
  SKILL_ARCHIVE_ROOT,
  SKILL_INSTALL_COMMAND,
  SKILL_INSTALL_COMMAND_CODEX,
  SKILL_MANIFEST_PATH,
  SKILL_PACKAGE,
  SKILL_TREE_PATH,
} from "@/lib/skill";
import { BUNDLE_CARDS_DIR, BUNDLE_README, TOPOLOGY_DOT } from "@/lib/content/bundle-export";

/* ============================================================
   The tutorial on `/skill`: install it, answer its questions, keep the folder.

   The three steps carry an ordinal because the reader is meant to be at one of three
   places in a sequence, and nothing else on the page is numbered.

   ── The naming hazard, resolved in copy ──
   `skill` is already a word in this vocabulary and it means something narrower:
   `lib/core/card/schema.ts` defines `skill?: string` as the document defining one agent's
   behaviour, one level below the graph. What installs here writes the graph. So the phrase
   is never "the skill" on its own anywhere in this file; it is "the DarkPrint skill" or
   "the blueprint-writing skill", and `SkillSetup.test.ts` holds that.

   ── What this file may claim ──
   The skill's behaviour is a document an agent reads, and nothing in this repository's
   suite runs an interview. What is checkable here is what the page prints: the exact
   commands, the files the folder holds (read off the same constants the exporter writes
   them from), and where the folder goes next.
   ============================================================ */

/** The rows of step 2, one per phase of `skills/darkprint/SKILL.md`, in the order it asks. */
export interface SkillQuestion {
  readonly label: string;
  readonly text: string;
}

/**
 * Exported because `/capabilities` lists what the DarkPrint skill asks, and a second
 * hand-written list of the same rows would be two answers to one question on two routes.
 */
export const QUESTIONS: readonly SkillQuestion[] = [
  { label: "the outcome", text: "what exists at the end that does not exist now" },
  { label: "the check", text: "the command that exits non-zero when the work is wrong" },
  {
    label: "the registry",
    text: "whether a published blueprint or card already does part of the job, searched before you describe a node",
  },
  {
    label: "the nodes",
    text: "who does each part, and whether that is an agent, a command, a check or a person",
  },
  { label: "the boundaries", text: "what has to reach each node, and what must never reach it" },
  {
    label: "the loop",
    text: "where it closes, how many attempts it may take, and which way each fork goes",
  },
];

/**
 * A command and the control that copies it.
 *
 * Real text inside a `<pre>`, so it is readable, selectable and copyable by hand with no
 * JavaScript; the button is the convenience. Wrapped rather than scrolled: the string has
 * no newline, so the clipboard still receives one line, and at 390px a scroll would hide
 * the end of the one string this page exists to hand over.
 */
function CommandLine({
  label,
  command,
  ariaLabel,
}: {
  label: string;
  command: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="label">{label}</span>
      {/* `min-w-0` is load-bearing: a grid item's default min-width is its min-content
          width, which for this row is the whole command, and the page then overflows a
          phone viewport by the width nobody can scroll to. */}
      <div className="flex min-w-0 items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-2 px-3.5 py-3 font-mono text-xs leading-relaxed text-emerald">
          <code>{command}</code>
        </pre>
        <CopyButton text={command} ariaLabel={ariaLabel} />
      </div>
    </div>
  );
}

/** A step's ordinal and its title as one heading, so the outline a screen reader walks carries the sequence. */
function StepHeading({ index, title }: { index: number; title: string }) {
  return (
    <PanelHeading as="h2" size="2xl">
      {index}. {title}
    </PanelHeading>
  );
}

/** Two columns of mono: the path, and what is in it. Not truncated, because a reader is about to look for the path on their own disk. */
function FileListing({ lines }: { lines: readonly (readonly [string, string])[] }) {
  return (
    <ul className="flex min-w-0 flex-col gap-2.5">
      {lines.map(([path, what]) => (
        <li
          key={path}
          className="flex min-w-0 flex-col gap-0.5 font-mono text-xs leading-relaxed sm:flex-row sm:items-baseline sm:gap-4"
        >
          <span className="break-all text-fg sm:w-44 sm:shrink-0">{path}</span>
          <span className="min-w-0 text-muted">{what}</span>
        </li>
      ))}
    </ul>
  );
}

const LINK = "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hover:decoration-cyan";

export function SkillSetup({ className }: { className?: string }) {
  return (
    <ol className={cx("flex flex-col gap-11", className)}>
      {/* ---------- 01 · install ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        <StepHeading index={1} title="Install it" />

        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <CommandLine
              label="Claude Code"
              command={SKILL_INSTALL_COMMAND}
              ariaLabel="Copy the command that installs the DarkPrint skill for Claude Code"
            />
            <CommandLine
              label="Codex"
              command={SKILL_INSTALL_COMMAND_CODEX}
              ariaLabel="Copy the command that installs the DarkPrint skill for Codex"
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-relaxed text-muted">
              Either line has npx fetch the{" "}
              <code className="font-mono text-[13px] text-fg">{SKILL_PACKAGE}</code> package
              from npm and copy the DarkPrint skill it carries into{" "}
              <code className="font-mono text-[13px] text-fg">{SKILL_ARCHIVE_ROOT}</code> under
              that agent&rsquo;s folder,{" "}
              <code className="font-mono text-[13px] text-fg">{CLAUDE_CODE_SKILLS_PARENT}</code>{" "}
              for Claude Code and{" "}
              <code className="font-mono text-[13px] text-fg">{CODEX_SKILLS_PARENT}</code> for
              Codex, where the agent reads its skills. The first run downloads the package
              and npx keeps it in its own cache. Nothing else is installed and no account is
              created. When you ask it to, the DarkPrint skill can post your draft to a live
              page on this site while it interviews you, and it does nothing of the kind
              otherwise.
            </p>
            <p className="text-[15px] leading-relaxed text-muted">
              Read it before you run it if you like:{" "}
              <a href={`${SKILL_TREE_PATH}/SKILL.md`} className={LINK}>
                SKILL.md
              </a>{" "}
              and its references are served file by file, and a{" "}
              <a href={SKILL_MANIFEST_PATH} className={LINK}>
                manifest
              </a>{" "}
              lists every file with its checksum, so the copy npx installed can be checked
              against what this site serves. Running the line again replaces the copy with
              the version the package carries.
            </p>
          </div>
        </div>
      </li>

      {/* ---------- 02 · the interview ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        <StepHeading index={2} title="Answer its questions" />

        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-[15px] leading-relaxed text-muted">
            An interview, not a generator. Ask it for a blueprint and it asks you what the
            work is first, because a graph nobody described is a graph nobody can check.
            Six things, all of which you would have had to decide anyway, and one of them it
            looks up for you.
          </p>

          {/* A list that happens to be aligned, not a table: `QUESTIONS` has no second axis.
              The label and its sentence sit in one `<li>` so a screen reader takes them
              together; below `sm` the pair stacks. */}
          <ul className="flex min-w-0 flex-col border-t border-line">
            {QUESTIONS.map((question) => (
              <li
                key={question.label}
                className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 border-b border-line py-[13px] sm:grid-cols-[148px_minmax(0,1fr)] sm:gap-5"
              >
                <span className="font-mono text-[12px] leading-relaxed tracking-[0.06em] text-blueprint-ink">
                  {question.label}
                </span>
                <span className="min-w-0 text-[15px] leading-relaxed text-muted">
                  {question.text}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-[15px] leading-relaxed text-muted">
            It can decline. If nobody can name the command that fails when the work is
            wrong, it offers a two-node prototype to find one instead of drawing a graph
            that cannot be checked.
          </p>
        </div>
      </li>

      {/* ---------- 03 · the folder ---------- */}
      <li className="flex min-w-0 flex-col gap-4">
        <StepHeading index={3} title="Keep the folder" />

        {/* The only box in the tutorial, drawn like the command's frame one step up, so the
            two things a reader takes away from this page are drawn the same way. The mark
            is `aria-hidden`: the list beside it says everything it says, and it is the one
            place on the site where the logo is also a diagram, a folder holding a graph. */}
        <div className="flex flex-col items-center gap-8 rounded-xl border border-line bg-surface-2 px-6 py-7 sm:flex-row sm:items-center sm:px-8">
          <Logo size={192} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <span className="label">What it writes</span>
            {/* The names come from `bundle-export.ts`, which writes them into every folder
                under `public/bundles/`, so the figure and the disk cannot disagree. */}
            <FileListing
              lines={[
                [TOPOLOGY_DOT, "the graph: who is wired to whom, and the guard on every fork"],
                [`${BUNDLE_CARDS_DIR}/<node>.yaml`, "one card per node, reused cards byte for byte"],
                ["blueprint.yaml", "the slug, title and one-line summary the registry files it under"],
                [BUNDLE_README, "what it is, which validator checked it, and what it leaves to the runner"],
              ]}
            />

            <p className="text-[15px] leading-relaxed text-muted">
              Before you see the folder, the DarkPrint skill runs the registry&rsquo;s own
              validator over it, with the darkprint CLI when it is installed and through this
              site&rsquo;s API when you say yes, and reads every warning back to you. Drop the
              folder on{" "}
              <Link href="/upload" className={LINK}>
                Publish
              </Link>
              , or publish it from your terminal with a write-scoped API key from{" "}
              <Link href="/settings" className={LINK}>
                Settings
              </Link>
              .
            </p>
          </div>
        </div>
      </li>
    </ol>
  );
}
