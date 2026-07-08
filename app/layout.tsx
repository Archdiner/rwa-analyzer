import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { GITHUB_URL } from "@/lib/site";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: {
        default: "RWA Reliability Analyzer",
        template: "%s | RWA Reliability Analyzer",
    },
    description:
        "See what's independently provable about tokenized real-world assets — and where you're trusting the issuer. Every claim shows its source and its confidence.",
};

function Wordmark() {
    return (
        <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="grid h-5 w-5 place-items-center bg-primary text-[11px] font-bold text-white">R</span>
            <span className="text-sm font-semibold tracking-tight text-text">
                RWA Reliability
            </span>
        </Link>
    );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col bg-bg text-text">
                <header className="border-b border-border">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
                        <Wordmark />
                        <nav className="flex items-center gap-6">
                            <span className="eyebrow hidden sm:inline">Public facts · not advice</span>
                            <a
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-text-muted transition-colors hover:text-text"
                            >
                                GitHub
                            </a>
                        </nav>
                    </div>
                </header>

                <main className="flex-1">{children}</main>

                <footer className="mt-24 border-t border-border-strong bg-bg-elev">
                    <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
                        <p className="max-w-md text-xs leading-relaxed text-text-faint">
                            Information on public facts, not financial advice. We rate assets, not decisions, and never
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
