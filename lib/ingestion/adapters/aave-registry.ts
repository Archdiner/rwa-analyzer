// ---------------------------------------------------------------------------
// Aave v3 market registry (human-gated)
// ---------------------------------------------------------------------------
// Maps an on-chain asset to the Aave v3 market whose reserve state we read. The
// adapter NEVER guesses addresses: an asset is read only if it has a verified
// entry here, exactly the discipline used by edgar-registry.ts.
//
// A wrong `poolAddressesProvider` or `underlying` is the false-green surface for
// this whole feature (we would confidently misread another reserve), so every
// row is verified before it ships and records HOW it was verified. Empty by
// default: no unverified entry ever lands.
//
// Both the underlying token AND its aToken map to the same reserve, because a
// caller may look up either (aEthUSDC and USDC are the same market).
//
// PROVENANCE: all rows below were resolved on-chain from the canonical Aave v3
// Ethereum PoolAddressesProvider (0x2f39…4E9e) via
// getPoolDataProvider().getReserveTokensAddresses(underlying) at mainnet
// (USDC/WETH block 25489702; DAI/USDT/wstETH block 25491010), and cross-checked
// against the Aave v3 address book (github.com/bgd-labs/aave-address-book).
// See scripts/verify-aave-addresses.ts.
// ---------------------------------------------------------------------------

export interface AaveMarketEntry {
    /** EVM chain id of the deployment (1 = Ethereum). */
    chainId: number;
    /** Aave v3 PoolAddressesProvider - the root the adapter resolves Pool +
     *  ProtocolDataProvider + Oracle from. Checksummed. */
    poolAddressesProvider: string;
    /** The reserve's underlying ERC-20 (e.g. USDC). Checksummed. */
    underlying: string;
    /** The reserve's aToken (e.g. aEthUSDC). Checksummed. */
    aToken: string;
    /** Human label for provenance. */
    label: string;
    /** ISO date this entry was verified. */
    verified_at: string;
    /** How the addresses were confirmed (URL / on-chain read). */
    verified_against: string;
}

const VERIFIED_AGAINST =
    "on-chain via Aave v3 PoolAddressesProvider.getPoolDataProvider()." +
    "getReserveTokensAddresses() at Ethereum mainnet (USDC/WETH block 25489702; " +
    "DAI/USDT/wstETH block 25491010); cross-checked with the Aave v3 address book " +
    "(github.com/bgd-labs/aave-address-book). See scripts/verify-aave-addresses.ts";

const AAVE_V3_ETH_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";

/** One reserve, its verified addresses, and the keys that resolve to it. */
interface Reserve {
    underlying: string;
    aToken: string;
    label: string;
}

const ETH_RESERVES: Reserve[] = [
    {
        underlying: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        aToken: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c", // aEthUSDC
        label: "Aave v3 Ethereum USDC",
    },
    {
        underlying: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
        aToken: "0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8", // aEthWETH
        label: "Aave v3 Ethereum WETH",
    },
    {
        underlying: "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
        aToken: "0x018008bfb33d285247A21d44E50697654f754e63", // aEthDAI
        label: "Aave v3 Ethereum DAI",
    },
    {
        underlying: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        aToken: "0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a", // aEthUSDT
        label: "Aave v3 Ethereum USDT",
    },
    {
        underlying: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", // wstETH
        aToken: "0x0B925eD163218f6662a35e0f0371Ac234f9E9371", // aEthwstETH
        label: "Aave v3 Ethereum wstETH",
    },
];

/** Builds the asset_id-keyed registry. Both the underlying and the aToken key
 *  the SAME reserve entry, so a lookup of either resolves the market. */
function buildRegistry(): Record<string, AaveMarketEntry> {
    const out: Record<string, AaveMarketEntry> = {};
    for (const r of ETH_RESERVES) {
        const entry: AaveMarketEntry = {
            chainId: 1,
            poolAddressesProvider: AAVE_V3_ETH_PROVIDER,
            underlying: r.underlying,
            aToken: r.aToken,
            label: r.label,
            verified_at: "2026-07-08",
            verified_against: VERIFIED_AGAINST,
        };
        out[`1:${r.underlying.toLowerCase()}`] = entry;
        out[`1:${r.aToken.toLowerCase()}`] = entry;
    }
    return out;
}

/** Keyed by canonical asset_id ("{chainId}:{address}", lowercased). */
export const AAVE_MARKETS: Record<string, AaveMarketEntry> = buildRegistry();

export function lookupAaveMarket(assetId: string): AaveMarketEntry | undefined {
    return AAVE_MARKETS[assetId.toLowerCase()];
}
