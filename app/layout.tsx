import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * The landing exports no metadata of its own, so this default is what the homepage
 * serves to a tab, a search result and a social card. It therefore has to carry the
 * same claim the hero does — the previous default still announced the positioning line
 * the landing retired, and the hero's `h1` was promoted to real text specifically so
 * that claim would be the indexable one.
 *
 * Doc 2 §2.5 applies here as much as to anything on screen: no em-dash standing in for
 * a pause, and no verb list padding out the description.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://darkprint.io"),
  title: {
    default: "DarkPrint · autonomy you can read as a graph",
    template: "%s · DarkPrint",
  },
  description:
    "A registry of dark-factory blueprints: the DOT graph of an agent pipeline, one versioned card per node, and autonomy and security scored off the drawing without running anything.",
  keywords: [
    "AI agents",
    "dark factory",
    "agent orchestration",
    "blueprints",
    "autonomous pipelines",
    "DOT graph",
  ],
  openGraph: {
    title: "DarkPrint",
    description:
      "Autonomy you can read as a graph. A registry of the graphs that make that work.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-fg">
        {/* WCAG 2.4.1. The landmarks below give a screen-reader user a bypass already, so
            this is for the reader who navigates by keyboard and does not run one: the
            header is ten links, and the luminous register then makes every node of the
            first figure a focus stop, so reaching the landing's doors was more than twenty
            tabs. Visually hidden until it takes focus, which is the whole convention: it
            is the first thing in the tab order and nothing else changes. */}
        <a
          href="#main"
          className="sr-only rounded-md border border-cyan bg-void px-4 py-2 font-mono text-sm text-cyan focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <SiteHeader />
        {/* `tabIndex={-1}` so the skip link's target actually takes focus in every engine:
            a fragment moves the scroll position everywhere and moves focus only where the
            target is focusable, and a reader whose focus stayed in the header would tab
            straight back into the nav. */}
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        {/*
          Page-view counting only, and only once deployed on Vercel — it no-ops
          locally. Distinct from the blueprint telemetry of doc 1 §8, which runs
          on the user's own machine (§0.1.3) and is not built.
        */}
        <Analytics />
      </body>
    </html>
  );
}
