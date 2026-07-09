import type { Metadata } from "next";
import { Bodoni_Moda, Bricolage_Grotesque, DM_Mono } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { GITHUB_URL } from "@/lib/site";

const bodoni = Bodoni_Moda({
    variable: "--font-bodoni",
    subsets: ["latin"],
    weight: ["400", "500"],
    style: ["normal", "italic"],
});

const bricolage = Bricolage_Grotesque({
    variable: "--font-bricolage",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const dmMono = DM_Mono({
    variable: "--font-dm-mono",
    subsets: ["latin"],
    weight: ["400", "500"],
});

export const metadata: Metadata = {
    title: {
        default: "RWA Reliability - backing verification for agents",
        template: "%s | RWA Reliability",
    },
    description:
        "Structured backing verdicts for tokenized assets - MCP, CLI, and HTTP API. Check where proof stops before your agent or wallet routes a deposit.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang="en"
            className={`${bricolage.variable} ${dmMono.variable} ${bodoni.variable} h-full antialiased`}
        >
            <body className="relative flex min-h-full flex-col bg-bg text-text">
                <SiteHeader />
                <main className="flex-1 relative z-10">{children}</main>
                <footer className="border-t border-border-strong bg-[#050505]/80 backdrop-blur-md relative z-10">
                    <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-md text-xs leading-relaxed text-text-faint">
                            Information on public facts, not financial advice. I rate assets, not decisions, and never
                            hold your money.
                        </p>
                        <a
                            href={GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="eyebrow transition-colors hover:text-primary"
                        >
                            Open source
                        </a>
                    </div>
                </footer>
            </body>
        </html>
    );
}
