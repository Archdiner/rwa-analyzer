"use client";

// Route-level error boundary. Catches render/data errors in the segment and
// shows a branded fallback with a retry, instead of Next's default error page.
// The underlying error is logged; we never surface stack traces to the user.

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[app] route error:", error);
    }, [error]);

    return (
        <main
            style={{
                minHeight: "60vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                padding: "2rem",
                textAlign: "center",
            }}
        >
            <h1 style={{ fontSize: "1.5rem", color: "var(--text)" }}>Something went wrong.</h1>
            <p style={{ maxWidth: "34rem", color: "var(--text-muted)" }}>
                A source we depend on (an on-chain RPC, a filing endpoint, or the store) may be
                temporarily unavailable. Your request was not a verdict — please try again.
            </p>
            {error.digest ? (
                <p style={{ color: "var(--text-faint)", fontFamily: "var(--font-dm-mono), monospace", fontSize: "0.8rem" }}>
                    ref: {error.digest}
                </p>
            ) : null}
            <button
                onClick={reset}
                style={{
                    marginTop: "0.5rem",
                    padding: "0.6rem 1.2rem",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border-strong)",
                    background: "var(--primary-bg)",
                    color: "var(--text)",
                    cursor: "pointer",
                }}
            >
                Try again
            </button>
        </main>
    );
}
