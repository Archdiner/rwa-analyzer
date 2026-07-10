import type { Metadata } from "next";
import RequestForm from "@/components/features/RequestForm";

export const metadata: Metadata = {
    title: "Suggest a feature",
    description: "Suggest anything - assets to cover, data sources, or whole new capabilities. Open box, no account.",
};

export default function FeatureRequestsPage() {
    return (
        <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
            <p className="eyebrow mb-2">Open suggestion box</p>
            <h1 className="mb-3 text-2xl font-medium text-text">Suggest anything</h1>
            <p className="mb-6 text-sm leading-relaxed text-text-muted">
                This is an open-source tool and the roadmap is open. Suggest an asset to cover, a data source, a new
                risk dimension - or a whole new direction. Every suggestion is read and triaged automatically; recurring
                themes surface as directions worth building. Nothing is too big.
            </p>
            <RequestForm />
        </div>
    );
}
