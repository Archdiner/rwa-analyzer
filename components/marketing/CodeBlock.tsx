"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CodeBlock({ code, language = "json" }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [code]);

    return (
        <div className="group relative overflow-hidden rounded-md border border-border bg-[#0d0d0c]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{language}</span>
                <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3" /> Copied
                        </>
                    ) : (
                        <>
                            <Copy className="h-3 w-3" /> Copy
                        </>
                    )}
                </button>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-white/85">
                <code>{code}</code>
            </pre>
        </div>
    );
}
