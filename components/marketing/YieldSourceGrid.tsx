import { CircuitTraces, NodeFlow, ConcentricVault, EmissionSteps } from "./Blueprints";

type Status = "live" | "researching" | "planned";

interface SourceCard {
    label: string;
    title: string;
    desc: string;
    status: Status;
    art: React.ReactNode;
}

// Build state as a small roadmap meter (filled bars = how far along), not a
// colored status pill. Monochrome, so color still only ever means verdict.
const BUILD_STATE: Record<Status, { text: string; filled: number }> = {
    live: { text: "Live", filled: 3 },
    researching: { text: "In development", filled: 2 },
    planned: { text: "Planned", filled: 1 },
};

const CARDS: SourceCard[] = [
    {
        label: "RWA backing",
        title: "Tokenized funds and treasuries",
        desc: "The hardest case, built first. Reconcile on-chain supply against a fund's filed NAV, or name the auditor when a regulator is not in the loop.",
        status: "live",
        art: <CircuitTraces className="h-full w-full" />,
    },
    {
        label: "Lending markets",
        title: "Aave, Morpho and money markets",
        desc: "Read the reserve on-chain. Split organic borrow interest from reward emissions, then grade utilization, bad debt and the oracle it leans on.",
        status: "researching",
        art: <NodeFlow className="h-full w-full" />,
    },
    {
        label: "Staking and LSTs",
        title: "Liquid staking derivatives",
        desc: "Pooled ETH against token supply is fully on-chain, so the backing is arithmetic. The forward risk is slashing and validator exposure, named not hidden.",
        status: "planned",
        art: <ConcentricVault className="h-full w-full" />,
    },
    {
        label: "Emissions and points",
        title: "Incentive-driven yield",
        desc: "The part of a headline APY that ends when the program does. I separate the emission schedule from real yield and stamp when it runs dry.",
        status: "planned",
        art: <EmissionSteps className="h-full w-full" />,
    },
];

function BuildMeter({ status }: { status: Status }) {
    const { text, filled } = BUILD_STATE[status];
    return (
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-faint">
            <span className="flex items-end gap-[3px]">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className={`w-[3px] ${i < filled ? "bg-text-muted" : "bg-border-strong"}`}
                        style={{ height: 6 + i * 3 }}
                    />
                ))}
            </span>
            {text}
        </span>
    );
}

function Card({ card }: { card: SourceCard }) {
    const dim = card.status !== "live";
    return (
        <article className="card flex flex-col overflow-hidden p-6">
            <div className="flex items-start justify-between">
                <span className="pill">{card.label}</span>
                <BuildMeter status={card.status} />
            </div>

            <div className={`relative my-6 h-40 w-full transition-opacity ${dim ? "opacity-35" : ""}`}>
                <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_100%)]">
                    {card.art}
                </div>
            </div>

            <h3 className="text-lg font-medium text-text">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{card.desc}</p>
        </article>
    );
}

export default function YieldSourceGrid() {
    return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((c) => (
                <Card key={c.label} card={c} />
            ))}
        </div>
    );
}
