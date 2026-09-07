import { ImageResponse } from "next/og";
import { WORDMARK_LETTER_PATHS } from "@/components/hero/wordmark-paths";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Copies of the theme tokens in `app/globals.css`. An image is rendered with no stylesheet
 * behind it, so a `var()` resolves to nothing here; each hex names the token it copies.
 */
const VOID = "#05060d"; // --color-void
const LINE = "#222739"; // --color-line
const FG = "#e9ebf5"; // --color-fg
const MUTED = "#9aa1ba"; // --color-muted
const CYAN = "#7dd3fc"; // --color-cyan-bright
const BLUEPRINT_LINE = "#74b4ff"; // --color-blueprint-line

/** The same split `components/hero/Wordmark.tsx` draws: "Dark" in the foreground, "Print" in cyan. */
const TONE_SPLIT = 4;

/**
 * Letter offsets in the 100-unit em box the paths were generated in, tightened by the
 * 3.5 units of tracking the hero applies so the word sets as it does on the landing.
 */
const LAYOUT = (() => {
  let x = 0;
  const offsets = WORDMARK_LETTER_PATHS.map((letter) => {
    const at = x;
    x += letter.advance - 3.5;
    return at;
  });
  return { offsets, width: x };
})();

/** Ink bounds: the glyphs sit on a baseline at y=0 with ascenders in negative y. */
const INK = (() => {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const letter of WORDMARK_LETTER_PATHS) {
    const numbers = letter.d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    for (let i = 1; i < numbers.length; i += 2) {
      const y = numbers[i] as number;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { top: minY, height: maxY - minY };
})();

const WORDMARK_WIDTH = 760;
const WORDMARK_HEIGHT = Math.round((WORDMARK_WIDTH * INK.height) / LAYOUT.width);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          position: "relative",
          background: VOID,
          padding: "0 96px 88px",
        }}
      >
        {/* Blueprint grid paper. Repeating gradients, because the renderer ignores `backgroundSize` on a plain gradient. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: size.width,
            height: size.height,
            backgroundImage: `repeating-linear-gradient(90deg, ${LINE} 0px, ${LINE} 1px, transparent 1px, transparent 48px), repeating-linear-gradient(0deg, ${LINE} 0px, ${LINE} 1px, transparent 1px, transparent 48px)`,
            opacity: 0.7,
          }}
        />
        <svg
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          viewBox={`0 ${INK.top} ${LAYOUT.width} ${INK.height}`}
          style={{ display: "flex" }}
        >
          {WORDMARK_LETTER_PATHS.map((letter, i) => (
            <path
              key={`${letter.char}-${i}`}
              d={letter.d}
              fill={i < TONE_SPLIT ? FG : CYAN}
              transform={`translate(${LAYOUT.offsets[i]}, 0)`}
            />
          ))}
        </svg>
        <div
          style={{
            display: "flex",
            width: 220,
            height: 4,
            marginTop: 40,
            background: BLUEPRINT_LINE,
          }}
        />
        <div style={{ display: "flex", marginTop: 32, fontSize: 40, color: MUTED, letterSpacing: -0.5 }}>
          {SITE_TAGLINE}
        </div>
      </div>
    ),
    size,
  );
}
