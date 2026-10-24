import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import styles from "./Guide.module.css";

export { default as guideStyles } from "./Guide.module.css";

export function GuidePanel({ children, tone = "blueprint", className }: {
  children: ReactNode;
  tone?: "blueprint" | "copper" | "human";
  className?: string;
}) {
  return <div className={cx(styles.panel, tone === "copper" && styles.copper, tone === "human" && styles.human, className)}>{children}</div>;
}

export function GuideStepHeading({ index, title, id }: { index: number; title: string; id?: string }) {
  return <h2 id={id} className={styles.stepHeading}><span className={styles.stepNumber}>{index}.</span><span>{title}</span></h2>;
}

export function CodePanel({ title, text, ariaLabel, prose = false, preProps }: {
  title: string;
  text: string;
  ariaLabel: string;
  prose?: boolean;
  preProps?: { "data-command"?: string; "data-client"?: string; "data-prompt"?: string };
}) {
  return (
    <div className={styles.command}>
      <div className={styles.commandHeader}><span>{title}</span><CopyButton text={text} ariaLabel={ariaLabel} /></div>
      <pre {...preProps} className={cx(styles.source, prose && styles.prompt)}><code className={prose ? "font-sans" : undefined}>{text}</code></pre>
    </div>
  );
}
