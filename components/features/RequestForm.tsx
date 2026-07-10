"use client";

import { useState } from "react";
import { validateSuggestion } from "@/lib/features/validation";

type State =
    | { kind: "idle" }
    | { kind: "submitting" }
    | { kind: "ok"; id: string }
    | { kind: "error"; message: string };

export default function RequestForm() {
    const [text, setText] = useState("");
    const [state, setState] = useState<State>({ kind: "idle" });

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const check = validateSuggestion(text);
        if (!check.ok) {
            setState({ kind: "error", message: check.error ?? "Invalid suggestion." });
            return;
        }
        setState({ kind: "submitting" });
        try {
            const res = await fetch("/api/features/submit", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ text: text.trim() }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                setState({ kind: "error", message: json.error ?? `Failed (${res.status}).` });
                return;
            }
            setState({ kind: "ok", id: json.data.id as string });
            setText("");
        } catch {
            setState({ kind: "error", message: "Network error - try again." });
        }
    }

    return (
        <form onSubmit={submit} className="panel flex flex-col gap-3 p-5">
            <textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    if (state.kind !== "idle") setState({ kind: "idle" });
                }}
                rows={5}
                placeholder="Anything - a new asset to cover, a data source, a whole new capability. Big ideas welcome."
                className="w-full resize-y rounded-md border border-border-strong bg-bg px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-primary focus:outline-none"
            />
            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-faint">
                    {state.kind === "ok"
                        ? `Thanks - queued as ${state.id.slice(0, 8)}. It'll be triaged automatically.`
                        : state.kind === "error"
                          ? state.message
                          : "Anonymous. No account needed."}
                </p>
                <button
                    type="submit"
                    disabled={state.kind === "submitting"}
                    className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                    {state.kind === "submitting" ? "Sending..." : "Suggest"}
                </button>
            </div>
        </form>
    );
}
