import Link from "next/link";
import { CodePanel, GuideStepHeading, guideStyles as guide } from "@/components/ui/Guide";
import { More } from "@/components/ui/More";
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
   `/skill`: install the DarkPrint skill, describe a task, then keep or publish its folder.

   Three numbered steps give the page its order. The install instructions and resulting files
   remain visible; the full interview checklist sits in a native disclosure.

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
  { label: "the outcome", text: "the result you need" },
  { label: "the check", text: "a command that fails when the result is wrong" },
  {
    label: "the registry",
    text: "existing blueprints or cards that cover part of the task",
  },
  {
    label: "the nodes",
    text: "the agent, command, check or person responsible for each step",
  },
  { label: "the boundaries", text: "what has to reach each node, and what must never reach it" },
  {
    label: "the loop",
    text: "retry limits and the conditions for each branch",
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
  return <CodePanel title={label} text={command} ariaLabel={ariaLabel} />;
}

/** A step's ordinal and its title as one heading, so the outline a screen reader walks carries the sequence. */
function StepHeading({ index, title }: { index: number; title: string }) {
  return <GuideStepHeading index={index} title={title} />;
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

const LINK = "text-cyan underline decoration-cyan/40 underline-offset-4 transition-colors hoverable:hover:decoration-cyan";

export function SkillSetup({ className }: { className?: string }) {
  return (
    <ol className={cx("flex flex-col gap-11", className)}>
      {/* ---------- 01 · install ---------- */}
      <li className={`${guide.panel} flex min-w-0 flex-col gap-4`}>
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
            <p className="text-base leading-relaxed text-muted">
              Both commands have npx fetch the{" "}
              <code className="font-mono text-[13px] text-fg">{SKILL_PACKAGE}</code> package
              from npm. The DarkPrint skill is copied to{" "}
              <code className="font-mono text-[13px] text-fg">{SKILL_ARCHIVE_ROOT}</code> under
              the agent folder:{" "}
              <code className="font-mono text-[13px] text-fg">{CLAUDE_CODE_SKILLS_PARENT}</code>{" "}
              for Claude Code, or{" "}
              <code className="font-mono text-[13px] text-fg">{CODEX_SKILLS_PARENT}</code> for
              Codex. Nothing else is installed and no account is created. When you ask it to, the DarkPrint skill can post your draft to a live
              page on this site while it interviews you, and it does nothing of the kind
              otherwise.
            </p>
            <p className="text-base leading-relaxed text-muted">
              Inspect the files:{" "}
              <a href={`${SKILL_TREE_PATH}/SKILL.md`} className={LINK}>
                SKILL.md
              </a>{" "}
              and the{" "}
              <a href={SKILL_MANIFEST_PATH} className={LINK}>
                manifest
              </a>{" "}
              of checksums. Run the command again to replace the installed copy.
            </p>
          </div>
        </div>
      </li>

      {/* ---------- 02 · describe and adapt ---------- */}
      <li className={`${guide.panel} flex min-w-0 flex-col gap-4`}>
        <StepHeading index={2} title="Describe the task" />

        <div className="flex min-w-0 flex-col gap-4">
          <p className="text-base leading-relaxed text-muted">
            The DarkPrint skill searches for public blueprints and cards.
            Public reads need no sign-in. Review the graph and its pinned cards, with the scorecard and provenance.
            Search matches are not quality judgments. A reused card stays unchanged; edits need
            a new version and identity.
          </p>

          <CodePanel title="Try a task" text="Use the DarkPrint skill to design a workflow that reviews pull requests. Search for reusable blueprints and cards, then show me the graph. Do not run it." ariaLabel="Copy the Assisted Design example prompt" prose />
          <More summary="See what the interview covers" bare>
            <p className="text-base leading-relaxed text-muted">
              The interview covers the work and how to check it.
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
                  <span className="min-w-0 text-base leading-relaxed text-muted">
                    {question.text}
                  </span>
                </li>
              ))}
            </ul>

            <p className="text-base leading-relaxed text-muted">
              It can decline a full workflow. Without a way to check the result, it offers a two-node prototype first.
            </p>
          </More>
        </div>
      </li>

      {/* ---------- 03 · the folder ---------- */}
      <li className={`${guide.panel} flex min-w-0 flex-col gap-4`}>
        <StepHeading index={3} title="Keep or publish the folder" />

        {/* The only box in the tutorial, drawn like the command's frame one step up, so the
            two things a reader takes away from this page are drawn the same way. The mark
            is `aria-hidden`: the list beside it says everything it says, and it is the one
            place on the site where the logo is also a diagram, a folder holding a graph. */}
        <div className={`${guide.diagram} ${guide.copper} p-5 sm:p-6`}>
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <span className="label">Your blueprint folder</span>
            {/* The names come from `bundle-export.ts`, which writes them into every folder
                under `public/bundles/`, so the figure and the disk cannot disagree. */}
            <FileListing
              lines={[
                [TOPOLOGY_DOT, "nodes, connections and branch conditions"],
                [`${BUNDLE_CARDS_DIR}/<node>.yaml`, "one version-pinned card per node"],
                ["blueprint.yaml", "registry title, slug and summary"],
                [BUNDLE_README, "setup and runner instructions"],
              ]}
            />

            <p className="text-base leading-relaxed text-muted">
              The DarkPrint skill validates locally with the CLI, or through the API with your
              permission, and reports warnings. Keep the folder locally or upload it at{" "}
              <Link href="/upload" className={LINK}>
                Publish
              </Link>
              . To publish from your terminal, use a write-scoped API key from{" "}
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
