import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatUltra — AI Chat, Video & GitHub",
  description:
    "Codex-grade AI workspace: chat with GPT-5.2, Claude Opus 5.1, Claude Sonnet 4.5, Gemini 3 Pro & Luna, generate videos with Dreamina 4, Seedance 1 Pro and Kling Omni for free, top up credits with Stripe, preview HTML live, build games in the playground and push projects to GitHub.",
  keywords: ["ChatUltra", "AI chat", "ChatGPT", "Claude", "Gemini", "Dreamina", "Seedance", "Kling Omni", "Stripe credits", "Supabase", "Codex", "game playground", "GitHub"],
  authors: [{ name: "ChatUltra" }],
  icons: {
    icon: [
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`, type: "image/svg+xml" },
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`, type: "image/png" },
    ],
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png`,
  },
  openGraph: {
    title: "ChatUltra",
    description: "AI chat, video models, credits with Stripe, game playground, terminal & GitHub push — all in one dark studio.",
    siteName: "ChatUltra",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#070a12] text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
