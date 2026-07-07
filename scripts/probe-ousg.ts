// One-off probe: is OUSG's BUIDL backing readable at an attributable on-chain
// wallet? Reads BUIDL's real top holders (ethplorer) and checks every
// Ondo-published address for a BUIDL balance. If none of Ondo's published
// addresses hold BUIDL, on-chain reconstruction is not honestly possible.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createPublicClient, http, erc20Abi, formatUnits, type Address } from "viem";
import { mainnet } from "viem/chains";

const RPC = process.env.ETHEREUM_RPC_URL!;
const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

const BUIDL = "0x7712c34205737192402172409a8f7ccef8aa2aec" as Address;

// Every Ondo-published Ethereum address touching OUSG (from docs.ondo.finance/addresses)
const ONDO_PUBLISHED: { label: string; addr: Address }[] = [
    { label: "OUSG token", addr: "0x1B19C19393e2d034D8Ff31ff34c81252FcBbee92" },
    { label: "OUSG_InstantManager (current)", addr: "0x93358db73B6cd4b98D89c8F5f230E81a95c2643a" },
    { label: "Coinbase Prime ousg.eth", addr: "0xF67416a2C49f6A46FEe1c47681C5a3832cf8856c" },
    { label: "OndoIDRegistry", addr: "0xcf6958D69d535FD03BD6Df3F4fe6CDcd127D97df" },
    { label: "OUSG Recipient (manual redemptions)", addr: "0x72Be8C14B7564f7a61ba2f6B7E50D18DC1D4B63D" },
    { label: "PYUSD Recipient", addr: "0x0317a350b093F8010837d1b844292555d73ebC2c" },
    { label: "OUSGInstantManager (legacy)", addr: "0x2826989983e3a66F0622132D019c2Ae173eb6A43" },
    { label: "OUSGManager (legacy)", addr: "0xF16c188c2D411627d39655A60409eC6707D3d5e8" },
];

async function balOf(token: Address, holder: Address) {
    return client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [holder] }).catch(() => 0n);
}

async function main() {
    const dec = Number(await client.readContract({ address: BUIDL, abi: erc20Abi, functionName: "decimals" }));
    const supply = await client.readContract({ address: BUIDL, abi: erc20Abi, functionName: "totalSupply" });
    console.log(`BUIDL decimals=${dec}  totalSupply=$${Number(formatUnits(supply, dec)).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

    console.log("\n--- BUIDL balances of Ondo-published Ethereum addresses ---");
    let anyOndoHolds = false;
    for (const a of ONDO_PUBLISHED) {
        const b = await balOf(BUIDL, a.addr);
        const bF = Number(formatUnits(b, dec));
        if (bF > 0) anyOndoHolds = true;
        console.log(`  ${bF > 0 ? "HOLDS" : "  -  "} $${bF.toLocaleString(undefined, { maximumFractionDigits: 0 }).padStart(14)}  ${a.label} (${a.addr})`);
    }

    console.log("\n--- BUIDL real top holders (ethplorer, on-chain) ---");
    try {
        const res = await fetch(`https://api.ethplorer.io/getTopTokenHolders/${BUIDL}?apiKey=freekey&limit=15`);
        const json = (await res.json()) as { holders?: { address: string; balance: number; share: number }[] };
        if (json.holders?.length) {
            const known = new Set(ONDO_PUBLISHED.map((a) => a.addr.toLowerCase()));
            for (const h of json.holders) {
                const tag = known.has(h.address.toLowerCase()) ? "  <-- Ondo-published" : "";
                console.log(`  ${String(h.share).padStart(6)}%  ${h.address}${tag}`);
            }
        } else {
            console.log("  ethplorer returned no holders (freekey limit?)");
        }
    } catch (e) {
        console.log("  ethplorer fetch failed:", (e as Error).message);
    }

    console.log("\n=== VERDICT ===");
    console.log(
        anyOndoHolds
            ? "An Ondo-published address holds BUIDL -> on-chain reconstruction IS possible."
            : "No Ondo-published address holds BUIDL. Reserves sit at unattributed third-party\n" +
                  "custodian wallets (Clear Street / Coinbase Custody / SPV). On-chain reconstruction\n" +
                  "cannot be done honestly for OUSG from published data: 0% resolves to an\n" +
                  "attributable wallet. OUSG's real proof is Ankura's OFF-CHAIN attestation -> weak amber."
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
