// ---------------------------------------------------------------------------
// Markdown rendering of an AgentVerdict
// ---------------------------------------------------------------------------
// Served when an agent requests text/markdown for an asset page (content
// negotiation). Caveat-first, mirroring the MCP server's renderVerdict so the
// three surfaces read consistently. Pure so it is unit-testable.
// ---------------------------------------------------------------------------

import type { AgentVerdict } from "@/lib/agent/verdict";

export function renderVerdictMarkdown(v: AgentVerdict): string {
    const b = v.backing;
    const lines: string[] = [
        `# ${v.asset.symbol} - backing verdict`,
        ``,
        `**${v.asset.name}**${v.asset.issuer_name ? ` - ${v.asset.issuer_name}` : ""}`,
        ``,
        `| axis | value |`,
        `| --- | --- |`,
        `| tier | ${b.tier} |`,
        `| confidence | ${b.confidence} |`,
        `| freshness | ${b.freshness ?? "n/a"} |`,
        ``,
        `**Meaning:** ${b.meaning}`,
    ];

    if (b.trust_boundary) lines.push(``, `**Trust boundary:** ${b.trust_boundary}`);

    if (b.caveats.length) {
        lines.push(``, `## Caveats (do not ignore)`);
        for (const c of b.caveats) lines.push(`- ${c}`);
    }

    if (v.evidence.length) {
        lines.push(``, `## Evidence`);
        for (const e of v.evidence) {
            lines.push(
                `- **${e.source_label}** - independence ${e.independence}/5 (${e.independence_label}), ` +
                    `${e.extraction}, ${e.confidence}, as of ${e.as_of.slice(0, 10)}`,
            );
        }
    }

    lines.push(``, `---`, ``, `_${v.disclaimer}_`, ``, `As of ${v.as_of.slice(0, 10)}.`);
    return lines.join("\n");
}
