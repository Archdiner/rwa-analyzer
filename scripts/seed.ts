// ---------------------------------------------------------------------------
// Seed script - ingest + store all flagship assets.
// Usage: npm run seed   (reads .env.local for RPC/OpenAI/Supabase keys)
// ---------------------------------------------------------------------------

// Keys live in .env.local (not .env). `dotenv/config` only loads .env, which
// does not exist here - so it would silently load nothing and saveAsset would
// no-op while still printing success. Load the file that actually holds them.
import { config } from "dotenv";
config({ path: ".env.local" });

import { allSeeds, seedIngestOptions } from "../lib/seed/assets";
import { ingest } from "../lib/ingestion";
import { saveAsset } from "../lib/store";

async function main() {
    const seeds = allSeeds();
    console.log(`Seeding ${seeds.length} flagship assets...`);

    for (const { assetId, seed } of seeds) {
        try {
            const record = await ingest(assetId, seedIngestOptions(seed));
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
