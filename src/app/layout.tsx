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
  title: "ChatUltra — AI Chat, Games & GitHub",
  description:
    "Codex-grade AI workspace: chat with GPT-5.2, Claude Sonnet 4.5, Gemini 3 Pro & Luna, set reasoning effort from Low to Ultra, preview HTML live, build games in the playground and push projects to GitHub.",
  keywords: ["ChatUltra", "AI chat", "ChatGPT", "Claude", "Gemini", "Codex", "game playground", "GitHub"],
  authors: [{ name: "ChatUltra" }],
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`,
  },
  openGraph: {
    title: "ChatUltra",
    description: "AI chat, model picker, game playground, terminal & GitHub push — all in one dark studio.",
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
