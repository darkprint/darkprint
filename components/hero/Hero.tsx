"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { ButtonLink } from "@/components/ui/Button";

const FactoryScene = dynamic(() => import("./FactoryScene"), { ssr: false });
const BlueprintDrawing = dynamic(
  () => import("./BlueprintDrawing").then((m) => m.BlueprintDrawing),
  { ssr: false },
);

const WORD =
  "font-display font-semibold leading-none tracking-tight text-[clamp(3.25rem,13vw,11rem)]";

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end end"],
  });
  const [mode, setMode] = useState<"dark" | "blueprint">("dark");
  const reduce = useReducedMotion();
  const flipRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Scroll-driven morph (DarkPrint -> DarkFactory)
  // 3-stop with a flat tail: output is pinned to 0 for all progress >= the
  // second stop, independent of clamp behavior.
  const introOpacity = useTransform(scrollYProgress, [0, 0.14, 1], [1, 0, 0]);
  const printOpacity = useTransform(scrollYProgress, [0.02, 0.3, 1], [1, 0, 0]);
  const factoryOpacity = useTransform(scrollYProgress, [0.24, 0.56], [0, 1]);
  const factoryGlow = useTransform(
    scrollYProgress,
    [0.24, 0.56],
    ["0 0 0px rgba(255,176,32,0)", "0 0 60px rgba(255,176,32,0.45)"],
  );
  const sceneOpacity = useTransform(scrollYProgress, [0.04, 0.5], [0.18, 1]);
  const vignette = useTransform(scrollYProgress, [0, 0.6], [0.55, 0.15]);
  const copyOpacity = useTransform(scrollYProgress, [0.5, 0.78], [0, 1]);
  const copyY = useTransform(scrollYProgress, [0.5, 0.82], [40, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08, 1], [1, 0, 0]);

  // "Scroll up at the top" opens BluePrint (you can't scroll above the top).
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (mode === "dark" && window.scrollY <= 2 && e.deltaY < -12) {
        setMode("blueprint");
      }
    }
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [mode]);

  // While the BluePrint overlay is open: lock scroll, reset to top, move focus
  // into the dialog, close on Escape, and restore focus to the trigger on close.
  useEffect(() => {
    if (mode !== "blueprint") return;
    const trigger = flipRef.current;
    window.scrollTo(0, 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMode("dark");
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [mode]);

  // Trap Tab focus within the open dialog.
  function trapFocus(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !overlayRef.current) return;
    const focusables = overlayRef.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <section ref={heroRef} className="relative h-[280vh]">
      <div
        className="sticky top-0 h-screen overflow-hidden bg-void"
        inert={mode === "blueprint" ? true : undefined}
      >
        {/* 3D factory scene */}
        <motion.div className="absolute inset-0" style={{ opacity: sceneOpacity }}>
          <FactoryScene scroll={scrollYProgress} reduced={!!reduce} />
        </motion.div>

        {/* legibility overlays */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ opacity: vignette }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(5,6,13,0.85)_85%)]" />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-void to-transparent" />

        {/* flip-up control */}
        <button
          ref={flipRef}
          onClick={() => setMode("blueprint")}
          aria-label="Flip to the BluePrint view"
          className="group absolute left-1/2 top-6 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-dim transition-colors hover:text-blueprint-line"
        >
          <motion.span
            className="text-lg"
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
            }
          >
            ↑
          </motion.span>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Flip to BluePrint
          </span>
        </button>

        {/* content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          {/* wordmark: Dark (fixed) + suffix (Print -> Factory) */}
          <div className="flex items-baseline justify-center">
            <span className={`${WORD} text-fg`}>Dark</span>
            <span className="relative ml-[0.04em]">
              {/* Factory defines the width */}
              <motion.span
                className={`${WORD} block text-amber`}
                style={{ opacity: factoryOpacity, textShadow: factoryGlow }}
              >
                Factory
              </motion.span>
              {/* Print overlays, left-aligned */}
              <motion.span
                className={`${WORD} absolute left-0 top-0 text-cyan`}
                style={{
                  opacity: printOpacity,
                  textShadow: "0 0 40px rgba(56,189,248,0.35)",
                }}
              >
                Print
              </motion.span>
            </span>
          </div>

          {/* intro tagline (DarkPrint) */}
          <motion.div
            style={{ opacity: introOpacity }}
            className="mt-8 max-w-xl"
          >
            <p className="text-lg text-muted sm:text-xl">
              The blueprint registry for autonomous AI factories.
            </p>
            <p className="mt-1 font-mono text-sm text-dim">
              Autonomy you can read as a graph.
            </p>
          </motion.div>

          {/* factory explanation (DarkFactory) */}
          <motion.div
            style={{ opacity: copyOpacity, y: copyY }}
            className="pointer-events-none absolute bottom-28 max-w-2xl px-4"
          >
            <p className="text-balance text-lg leading-relaxed text-fg/90 sm:text-xl">
              A <span className="text-amber">dark factory</span> runs with the
              lights off — no operators, only agents that plan, execute, verify
              and ship on their own.
            </p>
            <p className="mt-3 font-mono text-sm text-dim">
              scroll on ↓ to see what we mean
            </p>
          </motion.div>
        </div>

        {/* scroll hint */}
        <motion.div
          style={{ opacity: hintOpacity }}
          className="absolute bottom-7 left-1/2 z-20 -translate-x-1/2 text-center"
        >
          <div className="mx-auto h-9 w-5 rounded-full border border-line-bright p-1">
            <motion.div
              className="h-2 w-full rounded-full bg-cyan"
              animate={reduce ? undefined : { y: [0, 12, 0], opacity: [1, 0.3, 1] }}
              transition={
                reduce
                  ? undefined
                  : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              }
            />
          </div>
          <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
            scroll
          </span>
        </motion.div>
      </div>

      {/* ---------- BluePrint overlay ---------- */}
      <AnimatePresence>
        {mode === "blueprint" && (
          <motion.div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label="BluePrint — share the plan"
            onKeyDown={trapFocus}
            className="fixed inset-0 z-[60] overflow-hidden bg-blueprint-deep text-blueprint-ink"
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -28, y: -30 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -20, y: -30 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
            }
            style={{ transformOrigin: "top center", perspective: 1200 }}
          >
            <div className="absolute inset-0 bp-grid opacity-70" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(116,180,255,0.14),transparent_60%)]" />

            {/* close / back */}
            <button
              ref={closeRef}
              onClick={() => setMode("dark")}
              className="absolute right-5 top-5 z-10 flex items-center gap-2 rounded-md border border-blueprint-line/40 px-3 py-1.5 font-mono text-xs text-blueprint-ink/80 transition-colors hover:border-blueprint-line hover:text-blueprint-ink"
            >
              ↓ back to DarkPrint
            </button>

            <div className="relative z-[1] mx-auto flex h-full max-w-6xl flex-col items-center gap-8 px-6 py-16 lg:flex-row lg:gap-12">
              {/* text */}
              <div className="w-full text-center lg:w-[50%] lg:text-left">
                <div className="mb-3 flex items-baseline justify-center lg:justify-start">
                  <span className={`${WORD} text-blueprint-line`}>Blue</span>
                  <span className={`${WORD} text-blueprint-ink`}>Print</span>
                </div>
                <p className="mx-auto max-w-md text-lg leading-relaxed text-blueprint-ink/85 lg:mx-0">
                  Every dark factory starts as a plan. Share the blueprint — the
                  graph, the node cards it pins, the ontology behind it — so
                  others can read it, see how it scores, and build on it.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <ButtonLink href="/blueprints" variant="primary">
                    Browse blueprints
                  </ButtonLink>
                  <ButtonLink href="/upload" variant="outline">
                    Share yours
                  </ButtonLink>
                </div>
              </div>

              {/* drawing — the blueprint in the foreground */}
              <div className="w-full min-w-0 lg:w-[50%]">
                <div className="tick-frame text-blueprint-line/60">
                  <BlueprintDrawing
                    reduced={!!reduce}
                    className="mx-auto w-full max-w-2xl drop-shadow-[0_0_40px_rgba(116,180,255,0.15)]"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
