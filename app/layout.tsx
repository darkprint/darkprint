import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://darkprint.io"),
  title: {
    default: "DarkPrint — the blueprint registry for autonomous AI factories",
    template: "%s · DarkPrint",
  },
  description:
    "DarkPrint is where builders share the blueprints of their AI dark factories — autonomous agent pipelines that plan, execute, verify and ship without a human in the loop.",
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
      "Share the blueprint of your AI dark factory. Autonomy you can read as a graph.",
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
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-void text-fg">
        <SiteHeader />
        <main className="flex-1">{children}</main>
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
