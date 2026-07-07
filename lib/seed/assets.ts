// ---------------------------------------------------------------------------
// Seed registry — flagship, human-checked assets
// ---------------------------------------------------------------------------
// So the tool is never empty and its Verified tier is real. Seeded qualitative
// facts are publicly documented and carried at `verified` confidence (method:
// manual). Yields move daily, so they are carried at `auto` (approximate, "verify
// yourself") with an as-of date — never dressed up as verified.
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
    TokenizationMode,
} from "@/lib/contracts";
import { formatAssetId } from "@/lib/chains";

export interface SeedAsset {
    identifiers: Pick<AssetIdentifiers, "name" | "symbol" | "chain_id" | "contract_address"> &
        Partial<Pick<AssetIdentifiers, "issuer_name">>;
    /** Known disclosure URL (skips web-search discovery on ingest). */
    disclosureUrl?: string;
    /** Where a user actually deposits — the decision tool hands off here. */
    providerUrl?: string;
    /** Human-verified fields (qualitative + reference), carried as verified. */
    seedFields?: FieldMap;
    /** Whether the on-chain token is the whole fund or a slice of one. */
    tokenizationMode?: TokenizationMode;
    /** Curated DeFiLlama pool id — this asset's yield is a live pool APY, not a
     *  stated fund rate. Set for DeFi assets; MMFs keep their stated rate. */
    defillamaPool?: string;
}

const YIELD_AS_OF = "2026-07-01T00:00:00Z";

/** A verified, manually-curated field object. */
function v<T extends FieldValue>(value: T): FieldObject<T> {
    return { value, source: "seed", method: "manual", confidence: "verified", as_of: "2026-07-01T00:00:00Z", citation: null };
}

/** An approximate, human-entered yield — `auto` (verify yourself), dated. */
function approxYield(apy: number): FieldObject<number> {
    return { value: apy, source: "seed (approx)", method: "manual", confidence: "auto", as_of: YIELD_AS_OF, citation: null };
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
        providerUrl: "https://securitize.io/",
        tokenizationMode: "fully_tokenized",
        seedFields: {
            ...fields({
                wrapper_type: "private_fund",
                redemption_speed: "instant_capped",
                jurisdiction: "us_qualified_purchaser",
                custodian: "Bank of New York Mellon",
                issuer_domicile: "British Virgin Islands",
                min_investment_usd: 5_000_000,
                yield_source: "tbill",
            }),
            yield_apy: approxYield(4.3),
        },
    },
    {
        identifiers: {
            name: "Ondo Short-Term US Government Treasuries",
            symbol: "OUSG",
            chain_id: 1,
            contract_address: "0x1b19c19393e2d034d8ff31ff34c81252fcbbee92",
            issuer_name: "Ondo Finance",
        },
        providerUrl: "https://ondo.finance/ousg",
        tokenizationMode: "fully_tokenized",
        seedFields: {
            ...fields({
                wrapper_type: "private_fund",
                redemption_speed: "instant_capped",
                jurisdiction: "us_qualified_purchaser",
                yield_source: "tbill",
            }),
            yield_apy: approxYield(4.2),
        },
    },
    {
        identifiers: {
            name: "Ondo US Dollar Yield",
            symbol: "USDY",
            chain_id: 1,
            contract_address: "0x96f6ef951840721adbf46ac996b59e0235cb985c",
            issuer_name: "Ondo Finance",
        },
        providerUrl: "https://ondo.finance/usdy",
        tokenizationMode: "fully_tokenized",
        seedFields: {
            ...fields({
                wrapper_type: "spv",
                redemption_speed: "t_plus_n",
                jurisdiction: "non_us_only",
                yield_source: "tbill",
            }),
            yield_apy: approxYield(4.65),
        },
    },
    {
        identifiers: {
            name: "Franklin OnChain US Government Money Fund",
            symbol: "BENJI",
            chain_id: 1,
            contract_address: "0x3ddc84940ab509c11b20b76b466933f40b750dc9",
            issuer_name: "Franklin Templeton",
        },
        providerUrl: "https://digitalassets.franklintempleton.com/",
        // On-chain BENJI is a SLICE of the ~$750M+ FOBXX registered fund; total
        // reserves != on-chain supply x NAV, so EDGAR confers green via
        // regulated structure + NAV integrity, not total-pool reconciliation.
        tokenizationMode: "tranche_of_registered_fund",
        seedFields: {
            ...fields({
                wrapper_type: "registered_fund_40act",
                redemption_speed: "daily",
                jurisdiction: "us_retail",
                yield_source: "mmf",
            }),
            yield_apy: approxYield(4.15),
        },
    },
    {
        identifiers: {
            name: "Hashnote US Yield Coin",
            symbol: "USYC",
            chain_id: 1,
            contract_address: "0x136471a34f6ef19fe571effc1ca711fdb8e49f2b",
            issuer_name: "Hashnote / Circle",
        },
        providerUrl: "https://www.hashnote.com/",
        tokenizationMode: "fully_tokenized",
        seedFields: {
            ...fields({
                wrapper_type: "private_fund",
                redemption_speed: "instant_capped",
                jurisdiction: "us_qualified_purchaser",
                yield_source: "tbill",
            }),
            yield_apy: approxYield(4.3),
        },
    },
    {
        // A permissionless DeFi contrast: anyone can hold it, no KYC, any amount.
        // Its backing is a protocol's on-chain collateral, not a regulator-filed
        // or independently-attested reserve, so our engine reads it as an honest
        // `unknown`. Yield is a LIVE pool APY (Sky Savings Rate), not a stated
        // fund rate — the source of the number is part of the number.
        identifiers: {
            name: "Savings DAI",
            symbol: "sDAI",
            chain_id: 1,
            contract_address: "0x83f20f44975d03b1b09e64809b757c47f942beea",
            issuer_name: "Sky (formerly MakerDAO)",
        },
        providerUrl: "https://sky.money/",
        tokenizationMode: "fully_tokenized",
        defillamaPool: "c8a24fee-ec00-4f38-86c0-9f6daebc4225", // sky-lending SDAI
        seedFields: fields({
            redemption_speed: "instant",
            jurisdiction: "permissionless",
            yield_source: "active_strategy",
        }),
    },
    {
        // The sharp foil for "yield is the price of risk": private credit. syrupUSDC
        // is Maple's yield-bearing token — the yield exists because institutions
        // borrow against it and are trusted to repay. No reserve to read on-chain,
        // no regulator filing; backing reads honest `unknown`, and exit is not
        // instant (a notice period, not a redeem button). Higher yield sits next
        // to visibly lower verifiable safety and slower exit — the whole lesson in
        // one row. Yield is a LIVE pool APY, not a stated rate.
        identifiers: {
            name: "Syrup USDC",
            symbol: "syrupUSDC",
            chain_id: 1,
            contract_address: "0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b",
            issuer_name: "Maple Finance",
        },
        providerUrl: "https://syrup.fi/",
        tokenizationMode: "fully_tokenized",
        defillamaPool: "43641cf5-a92e-416b-bce9-27113d3c0db6", // maple USDC
        seedFields: fields({
            redemption_speed: "t_plus_n",
            jurisdiction: "permissionless",
            yield_source: "private_credit",
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
