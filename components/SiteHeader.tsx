"use client";

import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { GITHUB_URL } from "@/lib/site";

export default function SiteHeader() {
    const pathname = usePathname();
    const onHome = pathname === "/";
    const light = onHome;

    return (
        <header
            className={
                onHome
                    ? "absolute inset-x-0 top-0 z-50 border-b border-white/10 bg-transparent"
                    : "border-b border-border bg-bg"
            }
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-5 sm:py-4">
                <BrandLogo />
                <nav className="flex items-center gap-3 sm:gap-6">
                    <a
                        href={onHome ? "#integrate" : "/#integrate"}
                        className={`font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${light ? "text-white/70 hover:text-white" : "text-text-muted hover:text-text"}`}
                    >
                        Integrate
                    </a>
                    <a
                        href={onHome ? "#explore" : "/#explore"}
                        className={`font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${light ? "text-white/70 hover:text-white" : "text-text-muted hover:text-text"}`}
                    >
                        Explore
                    </a>
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${light ? "text-white/70 hover:text-white" : "text-text-muted hover:text-text"}`}
                    >
                        GitHub
                    </a>
                </nav>
            </div>
        </header>
    );
}
