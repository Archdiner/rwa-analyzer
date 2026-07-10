import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { allSeeds } from "@/lib/seed/assets";

export default function sitemap(): MetadataRoute.Sitemap {
    const base = appUrl();

    // One entry per flagship asset page (/a/{canonical asset_id}), matching the
    // same encodeURIComponent link shape the app uses. lastModified is omitted:
    // a per-asset "as of" isn't available without a full ingest, and a fabricated
    // or build-time date would just churn the sitemap on every deploy.
    const assetPages: MetadataRoute.Sitemap = allSeeds().map(({ assetId }) => ({
        url: `${base}/a/${encodeURIComponent(assetId)}`,
        changeFrequency: "daily",
        priority: 0.7,
    }));

    return [{ url: base, changeFrequency: "weekly", priority: 1 }, ...assetPages];
}
