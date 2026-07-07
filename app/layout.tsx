import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
    title: {
        default: "RWA Reliability Analyzer",
        template: "%s | RWA Reliability Analyzer",
    },
    description:
        "A transparent, per-dimension reliability read on tokenized real-world assets. Every claim shows its source and its confidence. We rate assets, not decisions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
            <body className="min-h-full flex flex-col bg-bg text-text">
                <header className="border-b border-border">
                    <div className="mx-auto max-w-4xl px-5 py-4 flex items-center justify-between">
                        <Link href="/" className="font-mono text-sm tracking-tight text-text">
                            RWA<span className="text-verified">/</span>Reliability
                        </Link>
                        <span className="text-xs text-text-faint">Research on public facts · not financial advice</span>
                    </div>
                </header>
                <main className="flex-1">{children}</main>
                <footer className="border-t border-border">
                    <div className="mx-auto max-w-4xl px-5 py-4 text-xs text-text-faint">
                        Information, not financial advice. We rate assets, not decisions.
                    </div>
                </footer>
            </body>
        </html>
    );
}
