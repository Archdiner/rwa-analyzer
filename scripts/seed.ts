// ---------------------------------------------------------------------------
// Seed script — ingest + store all flagship assets.
// Usage: npm run seed   (reads .env.local for RPC/OpenAI/Supabase keys)
// ---------------------------------------------------------------------------

import "dotenv/config";
import { allSeeds } from "../lib/seed/assets";
import { ingest } from "../lib/ingestion";
import { saveAsset } from "../lib/store";

async function main() {
    const seeds = allSeeds();
    console.log(`Seeding ${seeds.length} flagship assets...`);

    for (const { assetId, seed } of seeds) {
        try {
            const record = await ingest(assetId, {
                identifiers: seed.identifiers,
                seedFields: seed.seedFields,
                disclosureUrl: seed.disclosureUrl,
            });
            const assessment = await saveAsset(record);
            console.log(
                `  ✓ ${seed.identifiers.symbol.padEnd(6)} ${assetId}  → ${assessment.overall_confidence}`,
            );
        } catch (err) {
            console.error(`  ✗ ${seed.identifiers.symbol} (${assetId}):`, err);
        }
    }

    console.log("Done.");
}

main().then(() => process.exit(0));
