"use client";

import { useState } from "react";
import CodeBlock from "@/components/marketing/CodeBlock";
import {
    MCP_CONFIG,
    CURSOR_MCP_HINT,
    CLI_EXAMPLES,
    HTTP_EXAMPLES,
    AGENT_GUARD_EXAMPLE,
    REPO_CLONE,
} from "@/lib/integrations";
import { GITHUB_URL } from "@/lib/site";

const TABS = [
    { id: "mcp", label: "MCP" },
    { id: "cli", label: "CLI" },
    { id: "api", label: "HTTP API" },
    { id: "guard", label: "Pre-deposit guard" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function IntegrationGuide() {
    const [tab, setTab] = useState<TabId>("mcp");

    return (
        <div>
            <div className="flex flex-wrap gap-2 border-b border-border pb-4">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                            tab === t.id
                                ? "bg-primary text-primary-contrast"
                                : "text-text-muted hover:bg-bg-elev-2 hover:text-text"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="mt-6">
                {tab === "mcp" && (
                    <div className="space-y-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            Add the stdio MCP server to Cursor, Claude Desktop, or any MCP host. Two tools:{" "}
                            <code className="font-mono text-text">check_asset_backing</code> and{" "}
                            <code className="font-mono text-text">list_verified_assets</code>. Returns structured{" "}
                            <code className="font-mono text-text">AgentVerdict</code> JSON - no boolean safe flag.
                        </p>
                        <CodeBlock code={MCP_CONFIG} language="mcp config" />
                        <p className="text-xs text-text-faint">{CURSOR_MCP_HINT}</p>
                        <p className="text-xs text-text-faint">
                            Or clone and run locally:{" "}
                            <a href={GITHUB_URL} className="text-primary hover:underline">
                                {GITHUB_URL}
                            </a>
                        </p>
                        <CodeBlock code={REPO_CLONE} language="shell" />
                    </div>
                )}

                {tab === "cli" && (
                    <div className="space-y-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            Same verdict contract, for scripts and CI. Exit code does not encode tier - parse the printed
                            verdict and gate on <code className="font-mono text-text">backing.tier</code> +{" "}
                            <code className="font-mono text-text">caveats</code>.
                        </p>
                        <CodeBlock code={CLI_EXAMPLES} language="shell" />
                    </div>
                )}

                {tab === "api" && (
                    <div className="space-y-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            <code className="font-mono text-text">GET /api/verify?asset=</code> returns the same{" "}
                            <code className="font-mono text-text">AgentVerdict</code> as MCP and the CLI. Rate-limited;
                            no API key required for the public verifier.
                        </p>
                        <CodeBlock code={HTTP_EXAMPLES} language="shell" />
                    </div>
                )}

                {tab === "guard" && (
                    <div className="space-y-4">
                        <p className="text-sm leading-relaxed text-text-muted">
                            Typical integration for wallets with an Earn tab or treasury bots: call verify before routing
                            a deposit. Surface <code className="font-mono text-text">trust_boundary</code> and{" "}
                            <code className="font-mono text-text">caveats</code> to the user - never collapse to
                            safe/unsafe.
                        </p>
                        <CodeBlock code={AGENT_GUARD_EXAMPLE} language="typescript" />
                    </div>
                )}
            </div>
        </div>
    );
}
