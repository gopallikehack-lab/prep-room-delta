import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ParticleBackground from "@/components/ParticleBackground";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrepRoom — Practise the interview before it counts",
  description:
    "Realistic AI interviews with honest, evidence-based feedback. Practice with tips or take a real test.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 relative">
        <ParticleBackground />
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
        <Script
  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
  strategy="afterInteractive"
/>
      </body>
    </html>
  );
}
