"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* An agent asks before it moves money. The engine returns a verdict; the gate
   to the protocol only opens on verifiable proof. Blueprint schematic, calm. */

type State = "idle" | "evaluating" | "approved" | "blocked";

/** Signal trace between two nodes; carries current when live, green when passed. */
function Link({ live, passed }: { live: boolean; passed?: boolean }) {
    return (
        <svg viewBox="0 0 120 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden>
            <line x1="0" y1="12" x2="120" y2="12" stroke="rgba(245,244,242,0.12)" strokeWidth="1" />
            {live && (
                <line
                    x1="0"
                    y1="12"
                    x2="120"
                    y2="12"
                    stroke={passed ? "var(--green)" : "var(--primary)"}
                    strokeWidth="1.5"
                    strokeDasharray="4 10"
                    className="current"
                />
            )}
        </svg>
    );
}

function Node({
    label,
    children,
    accent,
}: {
    label: string;
    children: React.ReactNode;
    accent: "idle" | "primary" | "green" | "amber";
}) {
    const ring =
        accent === "green"
            ? "border-green"
            : accent === "amber"
              ? "border-amber"
              : accent === "primary"
                ? "border-border-strong"
                : "border-border";
    return (
        <div className={`w-full rounded-2xl border ${ring} bg-white/[0.02] p-5 transition-colors duration-500`}>
            <span className="pill">{label}</span>
            <div className="mt-4">{children}</div>
        </div>
    );
}

export default function AgentRouter() {
    const [state, setState] = useState<State>("idle");
    const [asset, setAsset] = useState<"BENJI" | "OUSG">("BENJI");

    useEffect(() => {
        let cancelled = false;
        const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
        const run = async () => {
            while (!cancelled) {
                setAsset("BENJI");
                setState("evaluating");
                await wait(2200);
                if (cancelled) return;
                setState("approved");
                await wait(3200);
                if (cancelled) return;
                setState("idle");
                await wait(700);
                setAsset("OUSG");
                setState("evaluating");
                await wait(2200);
                if (cancelled) return;
                setState("blocked");
                await wait(3200);
                if (cancelled) return;
                setState("idle");
                await wait(700);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, []);

    const evaluating = state === "evaluating";
    const approved = state === "approved";
    const blocked = state === "blocked";

    return (
        <div className="panel relative mx-auto w-full max-w-4xl overflow-hidden p-8 sm:p-10">
            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
                {/* Agent */}
                <div className="flex-1">
                    <Node label="Agent" accent="idle">
                        <div className="text-sm font-medium text-text">Intent: deposit</div>
                        <div className="mt-1 font-mono text-[12px] text-text-faint">target: {asset}</div>
                    </Node>
                </div>

                <div className="hidden w-14 shrink-0 md:block">
                    <Link live={state !== "idle"} />
                </div>

                {/* Engine */}
                <div className="flex-[1.2]">
                    <Node
                        label="Engine"
                        accent={evaluating ? "primary" : approved ? "green" : blocked ? "amber" : "idle"}
                    >
                        <div className="h-6 text-sm font-medium">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={state + asset}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {state === "idle" && <span className="text-text-faint">awaiting request</span>}
                                    {evaluating && <span className="text-text-muted">verifying…</span>}
                                    {approved && <span className="text-green">verified_backed</span>}
                                    {blocked && <span className="text-amber">unverifiable</span>}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div className="mt-3 space-y-1 font-mono text-[11px] text-text-faint">
                            <div className="flex justify-between">
                                <span>market_risk</span>
                                <span className="text-text-muted">{blocked ? "unknown" : "ok"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>caveats</span>
                                <span className="text-text-muted">{approved ? "0" : blocked ? "1" : "—"}</span>
                            </div>
                        </div>
                    </Node>
                </div>

                {/* gate link */}
                <div className="relative hidden w-14 shrink-0 md:block">
                    <Link live={approved} passed={approved} />
                    {blocked && (
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-sm text-amber">
                            ×
                        </span>
                    )}
                </div>

                {/* Protocol */}
                <div className="flex-1">
                    <Node label="Protocol" accent={approved ? "green" : "idle"}>
                        <div className="h-6 text-sm font-medium">
                            {approved && <span className="text-green">deposit executed</span>}
                            {blocked && <span className="text-amber">deposit held back</span>}
                            {(state === "idle" || evaluating) && <span className="text-text-faint">standing by</span>}
                        </div>
                    </Node>
                </div>
            </div>

            {/* one-line explanation of the current outcome */}
            <div className="mt-8 border-t border-border pt-5">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={state + asset}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[13px] leading-relaxed text-text-muted"
                    >
                        {state === "idle" && "Every deposit is checked before it routes."}
                        {evaluating && `Reading backing and market risk for ${asset}…`}
                        {approved &&
                            "Backing reconciles against a regulator filing, so I let the deposit through with its trust boundary attached."}
                        {blocked &&
                            "I cannot verify the reserves independently, so I hold the deposit and hand back the reason instead of a silent failure."}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
}
