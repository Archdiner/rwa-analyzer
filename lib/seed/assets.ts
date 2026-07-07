// ---------------------------------------------------------------------------
// Seed registry — flagship, human-checked assets
// ---------------------------------------------------------------------------
// So the tool is never empty and its Verified tier is real. Seeded qualitative
// facts are publicly documented and carried at `verified` confidence (method:
// manual). Everything else about a seeded asset is still pulled live.
//
// INTEGRITY: every contract address and qualitative fact here must be verified
// against a primary source (issuer site / block explorer) before shipping. A
// wrong address or a wrong "fully backed" is the worst-case failure.
// ---------------------------------------------------------------------------

import type {
    AssetIdentifiers,
    FieldMap,
    FieldName,
    FieldObject,
    FieldValue,
} from "@/lib/contracts";
import { formatAssetId } from "@/lib/chains";

export interface SeedAsset {
    identifiers: Pick<AssetIdentifiers, "name" | "symbol" | "chain_id" | "contract_address"> &
        Partial<Pick<AssetIdentifiers, "issuer_name">>;
    /** Known disclosure URL (skips web-search discovery on ingest). */
    disclosureUrl?: string;
    /** Human-verified fields (qualitative + reference), carried as verified. */
    seedFields?: FieldMap;
}

/** Builds a verified, manually-curated field object. */
function v<T extends FieldValue>(value: T): FieldObject<T> {
    return {
        value,
        source: "seed",
        method: "manual",
        confidence: "verified",
        as_of: "2026-07-01T00:00:00Z",
        citation: null,
    };
}

/** Convenience to declare a set of verified seed fields concisely. */
function fields(spec: Partial<Record<FieldName, FieldValue>>): FieldMap {
    const out: FieldMap = {};
    for (const [k, val] of Object.entries(spec)) {
        if (val !== undefined) out[k as FieldName] = v(val);
    }
    return out;
}

// ── The registry (keyed by canonical asset_id) ───────────────────────────────
// Addresses taken from public sources; verify before production use.

const RAW: SeedAsset[] = [
    {
        identifiers: {
            name: "BlackRock USD Institutional Digital Liquidity Fund",
            symbol: "BUIDL",
            chain_id: 1,
            contract_address: "0x7712c34205737192402172409a8f7ccef8aa2aec",
            issuer_name: "BlackRock / Securitize",
        },
        seedFields: fields({
            wrapper_type: "private_fund",
            redemption_speed: "instant_capped",
            jurisdiction: "us_qualified_purchaser",
            custodian: "Bank of New York Mellon",
            issuer_domicile: "British Virgin Islands",
            min_investment_usd: 5_000_000,
            yield_source: "tbill",
        }),
    },
    {
        identifiers: {
            name: "Ondo Short-Term US Government Treasuries",
            symbol: "OUSG",
            chain_id: 1,
            contract_address: "0x1b19c19393e2d034d8ff31ff34c81252fcbbee92",
            issuer_name: "Ondo Finance",
        },
        seedFields: fields({
            wrapper_type: "private_fund",
            jurisdiction: "us_qualified_purchaser",
            yield_source: "tbill",
        }),
    },
    {
        identifiers: {
            name: "Ondo US Dollar Yield",
            symbol: "USDY",
            chain_id: 1,
            contract_address: "0x96f6ef951840721adbf46ac996b59e0235cb985c",
            issuer_name: "Ondo Finance",
        },
        seedFields: fields({
            wrapper_type: "spv",
            jurisdiction: "non_us_only",
            yield_source: "tbill",
        }),
    },
    {
        identifiers: {
            name: "Franklin OnChain US Government Money Fund",
            symbol: "BENJI",
            chain_id: 1,
            contract_address: "0x3ddc84940ab509c11b20b76b466933f40b750dc9",
            issuer_name: "Franklin Templeton",
        },
        seedFields: fields({
            wrapper_type: "registered_fund_40act",
            redemption_speed: "daily",
            jurisdiction: "us_retail",
            yield_source: "mmf",
        }),
    },
    {
        identifiers: {
            name: "Hashnote US Yield Coin",
            symbol: "USYC",
            chain_id: 1,
            contract_address: "0x136471a34f6ef19fe571effc1ca711fdb8e49f2b",
            issuer_name: "Hashnote / Circle",
        },
        seedFields: fields({
            wrapper_type: "private_fund",
            jurisdiction: "us_qualified_purchaser",
            yield_source: "tbill",
        }),
    },
];

const SEED: Record<string, SeedAsset> = Object.fromEntries(
    RAW.map((a) => [
        formatAssetId(a.identifiers.chain_id, a.identifiers.contract_address),
        a,
    ]),
);

export function getSeed(assetId: string): SeedAsset | undefined {
    return SEED[assetId.toLowerCase()];
}

export function allSeeds(): { assetId: string; seed: SeedAsset }[] {
    return Object.entries(SEED).map(([assetId, seed]) => ({ assetId, seed }));
}
