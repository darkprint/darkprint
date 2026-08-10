"use client";

import Link from "next/link";
import { useState } from "react";

import { CopyButton } from "@/components/ui/CopyButton";
import { cx } from "@/lib/format";
import { SKILL_INSTALL_COMMAND } from "@/lib/skill";

function briefFor(goal: string): string {
  const subject = goal.trim() || "[describe the goal in one sentence]";
  return [
    `Create a DarkPrint blueprint for: ${subject}`,
    "",
    "Start by repeating the goal and asking before you guess.",
    "Define one job per node, the typed handoffs between them, every human checkpoint,",
    "the tools each node may reach, and what each node must never receive.",
    "Pin one versioned YAML card to every DOT node.",
    "Call out deliberate missing edges, bounded loops, and unresolved product choices.",
    "Finish by validating the bundle and explaining every warning or error.",
  ].join("\n");
}

/**
 * `className` so the caller owns the gap above it.
 *
 * It was mounted in a `<div className="mt-10">` on `/build`, which is the wrapper this
 * replaces. `/skill` stacks it between an `h1` and `SkillSetup`, and a component that
 * cannot be spaced by its caller forces every one of those into a wrapper div.
 */
export function CreateEntry({ className }: { className?: string }) {
  const [goal, setGoal] = useState("");
  const brief = briefFor(goal);

  return (
    <section
      aria-labelledby="create-entry-title"
      className={cx("grid gap-5 lg:grid-cols-2", className)}
    >
      <article className="panel flex flex-col p-5 sm:p-7">
        <p className="label">Primary path · assisted authoring</p>
        <h2
          id="create-entry-title"
          className="mt-3 scroll-mt-24 font-display text-2xl font-semibold text-fg"
        >
          Start with your goal
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          The DarkPrint authoring skill interviews you before it draws anything. It writes
          the graph and cards into your working directory, where you can inspect and validate
          them before publishing.
        </p>
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-emerald/35 bg-surface-2 p-3">
          <code className="min-w-0 flex-1 break-words font-mono text-xs text-emerald">
            {SKILL_INSTALL_COMMAND}
          </code>
          <CopyButton text={SKILL_INSTALL_COMMAND} ariaLabel="Copy the DarkPrint authoring skill install command" />
        </div>
        <Link
          href="/skill"
          className="mt-5 font-mono text-[13px] text-cyan underline decoration-cyan/40 underline-offset-4"
        >
          See the authoring workflow →
        </Link>
      </article>

      <article className="panel flex flex-col p-5 sm:p-7">
        <p className="label">Works in any agent client</p>
        <label htmlFor="blueprint-goal" className="mt-3 font-display text-2xl font-semibold text-fg">
          Give your agent a scoped brief
        </label>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Name the outcome, not the topology. The brief asks the agent to surface the graph
          decisions instead of silently inventing them.
        </p>
        <textarea
          id="blueprint-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={3}
          placeholder="Example: triage production incidents and stop for an incident commander before customer communication"
          className="mt-5 w-full resize-y rounded-lg border border-line bg-void px-3 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-dim focus:border-cyan focus:ring-2 focus:ring-cyan/20"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-dim">
            {goal.trim() === "" ? "Add a goal to personalize the brief" : "Brief ready"}
          </span>
          <CopyButton
            text={brief}
            label="copy brief"
            copiedLabel="brief copied ✓"
            ariaLabel="Copy the blueprint authoring brief"
            className="px-3 py-2"
          />
        </div>
      </article>
    </section>
  );
}

export { briefFor };
