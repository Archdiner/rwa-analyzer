"use client";

// Global error boundary — the last line of defense, replacing the entire
// document (including the layout) if a root-level render throws. Must render its
// own <html>/<body>. Kept dependency-free and inline-styled for that reason.

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[app] global error:", error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    margin: 0,
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "1rem",
                    padding: "2rem",
                    textAlign: "center",
                    background: "#0a0a0b",
                    color: "#f5f4f2",
                    fontFamily: "system-ui, sans-serif",
                }}
            >
                <h1 style={{ fontSize: "1.5rem" }}>Something went wrong.</h1>
                <p style={{ maxWidth: "34rem", color: "rgba(245,244,242,0.62)" }}>
                    The app hit an unexpected error and could not render. Please try again.
                </p>
                <button
                    onClick={reset}
                    style={{
                        marginTop: "0.5rem",
                        padding: "0.6rem 1.2rem",
                        borderRadius: "14px",
                        border: "1px solid rgba(255,255,255,0.13)",
                        background: "rgba(232,226,214,0.1)",
                        color: "#f5f4f2",
                        cursor: "pointer",
                    }}
                >
                    Try again
                </button>
            </body>
        </html>
    );
}
