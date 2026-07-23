"use client";

import { motion } from "framer-motion";

const LINE = "var(--color-blueprint-line)";
const INK = "var(--color-blueprint-ink)";

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { delay: 0.15 + i * 0.08, duration: 1.1, ease: "easeInOut" as const },
      opacity: { delay: 0.15 + i * 0.08, duration: 0.2 },
    },
  }),
};

/** Animated technical elevation of a factory, cyanotype style. */
export function BlueprintDrawing({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 620 420"
      className={className}
      fill="none"
      initial="hidden"
      animate="show"
      role="img"
      aria-label="Technical blueprint of a factory"
    >
      <g stroke={LINE} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
        {/* ground line */}
        <motion.line x1="40" y1="330" x2="580" y2="330" custom={0} variants={draw} strokeWidth={1.8} />

        {/* hall body */}
        <motion.path d="M120 330 L120 210 L440 210 L440 330" custom={1} variants={draw} />

        {/* sawtooth roof */}
        <motion.path
          d="M120 210 L160 170 L160 210 M200 210 L240 170 L240 210 M280 210 L320 170 L320 210 M360 210 L400 170 L400 210 L440 210"
          custom={2}
          variants={draw}
        />
        <motion.path d="M120 210 L160 170 M200 210 L240 170 M280 210 L320 170 M360 210 L400 170" custom={3} variants={draw} />

        {/* north-light glazing hatches */}
        <motion.path
          d="M150 178 L150 205 M172 200 L172 208 M230 178 L230 205 M310 178 L310 205 M390 178 L390 205"
          custom={4}
          variants={draw}
          strokeWidth={0.9}
        />

        {/* smokestacks */}
        <motion.path d="M300 210 L300 120 L322 120 L322 210" custom={5} variants={draw} />
        <motion.path d="M296 120 L326 120" custom={5} variants={draw} strokeWidth={2} />

        {/* conveyor + product boxes */}
        <motion.line x1="130" y1="300" x2="470" y2="300" custom={6} variants={draw} />
        {[160, 220, 280, 340, 400].map((x, i) => (
          <motion.rect
            key={x}
            x={x}
            y={286}
            width={16}
            height={14}
            custom={6.5 + i * 0.1}
            variants={draw}
            strokeWidth={1}
          />
        ))}

        {/* robot arm schematic */}
        <motion.path d="M470 300 L470 262 L500 244 L520 258" custom={7} variants={draw} />
        <motion.circle cx="470" cy="300" r="5" custom={7} variants={draw} />

        {/* dimension line (width) */}
        <motion.path d="M120 360 L440 360 M120 354 L120 366 M440 354 L440 366" custom={8} variants={draw} strokeWidth={0.9} />
        {/* dimension line (height) */}
        <motion.path d="M470 210 L470 330 M464 210 L476 210 M464 330 L476 330" custom={8.4} variants={draw} strokeWidth={0.9} />

        {/* callout leaders */}
        <motion.path d="M240 190 L240 90 L360 90" custom={9} variants={draw} strokeWidth={0.9} strokeDasharray="4 4" />
        <motion.path d="M400 250 L520 250 L520 200" custom={9.4} variants={draw} strokeWidth={0.9} strokeDasharray="4 4" />
      </g>

      {/* annotations */}
      <g fill={INK} fontFamily="var(--font-mono), monospace">
        <motion.text x="270" y="374" fontSize="11" textAnchor="middle" custom={9} variants={draw} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.1 } }}>
          8 400
        </motion.text>
        <motion.text x="486" y="274" fontSize="11" custom={9} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.2 } }}>
          3 000
        </motion.text>
        <motion.text x="366" y="86" fontSize="11" fill={LINE} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.35 } }}>
          autonomy · A4 closed-loop
        </motion.text>
        <motion.text x="524" y="196" fontSize="11" fill={LINE} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.45 } }}>
          verifier node
        </motion.text>
      </g>

      {/* title block */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 1.5, duration: 0.4 } }}>
        <rect x="392" y="356" width="188" height="46" stroke={LINE} strokeWidth={1} fill="none" />
        <line x1="392" y1="374" x2="580" y2="374" stroke={LINE} strokeWidth={0.8} />
        <line x1="486" y1="374" x2="486" y2="402" stroke={LINE} strokeWidth={0.8} />
        <text x="400" y="369" fontSize="10" fill={INK} fontFamily="var(--font-mono), monospace">
          DARKPRINT · DRW-001
        </text>
        <text x="400" y="390" fontSize="9" fill={LINE} fontFamily="var(--font-mono), monospace">
          SCALE 1:50
        </text>
        <text x="494" y="390" fontSize="9" fill={LINE} fontFamily="var(--font-mono), monospace">
          SHEET 1/1
        </text>
      </motion.g>
    </motion.svg>
  );
}
