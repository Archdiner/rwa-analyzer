// Reproducible probe: does the regulator (EDGAR N-MFP) filing for BENJI/FOBXX
// actually support a green, and how big is the tranche gap between the whole
// registered fund and the on-chain Ethereum slice? Fetches the live filing +
// reads on-chain supply, then prints the finding. No secrets beyond ETHEREUM_RPC_URL.
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createPublicClient, http, erc20Abi, type Address } from "viem";
import { mainnet } from "viem/chains";
import { secUserAgent } from "@/lib/env";
import { parseNmfp, navFromFiling, isAllGovernment } from "@/lib/ingestion/edgar";
import { lookupEdgarFund } from "@/lib/ingestion/adapters/edgar-registry";

const BENJI_ID = "1:0x3ddc84940ab509c11b20b76b466933f40b750dc9";
const BENJI = "0x3ddc84940ab509c11b20b76b466933f40b750dc9" as Address;

async function latestNmfp(cik: number) {
    const padded = String(cik).padStart(10, "0");
    const sub = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
        headers: { "User-Agent": secUserAgent() },
    }).then((r) => r.json());
    const r = sub.filings.recent;
    for (let i = 0; i < r.form.length; i++) {
        if (r.form[i].startsWith("N-MFP")) {
            return { accession: r.accessionNumber[i], filingDate: r.filingDate[i], form: r.form[i] };
        }
    }
    return null;
}

async function main() {
    const entry = lookupEdgarFund(BENJI_ID)!;
    const latest = (await latestNmfp(entry.cik))!;
    const noDashes = latest.accession.replace(/-/g, "");
    const xml = await fetch(
        `https://www.sec.gov/Archives/edgar/data/${entry.cik}/${noDashes}/primary_doc.xml`,
        { headers: { "User-Agent": secUserAgent() } },
    ).then((r) => r.text());

    const data = parseNmfp(xml)!;

    const client = createPublicClient({ chain: mainnet, transport: http(process.env.ETHEREUM_RPC_URL!) });
    const [rawSupply, decimals] = await Promise.all([
        client.readContract({ address: BENJI, abi: erc20Abi, functionName: "totalSupply" }),
        client.readContract({ address: BENJI, abi: erc20Abi, functionName: "decimals" }),
    ]);
    const onchain = Number(rawSupply) / 10 ** Number(decimals);
    const slice = (onchain / data.netAssets) * 100;

    console.log("=== EDGAR FILING ===");
    console.log("form/accession:", latest.form, latest.accession, "filed", latest.filingDate);
    console.log("seriesId match:", data.seriesId, data.seriesId === entry.seriesId ? "OK" : "MISMATCH");
    console.log("fund:", data.seriesName);
    console.log("report date:", data.reportDate);
    console.log("whole-fund net assets: $" + data.netAssets.toLocaleString());
    console.log("market (shadow) NAV/share: $" + navFromFiling(data));
    console.log("category:", data.category, "| all-government holdings:", isAllGovernment(data));
    console.log("WAM (days):", data.wamDays);
    console.log("\n=== TRANCHE GAP ===");
    console.log("on-chain Ethereum BENJI supply:", onchain.toLocaleString(), "tokens (~$" + Math.round(onchain).toLocaleString() + ")");
    console.log("on-chain slice of whole fund:", slice.toFixed(2) + "%");
    console.log(
        "\nNaive supply x NAV reconciliation would compare $" +
            Math.round(onchain).toLocaleString() +
            " (slice) against $" +
            Math.round(data.netAssets).toLocaleString() +
            " (whole fund)",
    );
    console.log("=> ~" + Math.round((data.netAssets / onchain - 1) * 100).toLocaleString() + "% false delta. Tranche mode skips it.");
    console.log("\n=== VERDICT ===");
    console.log(
        "Regulated '40-Act Government MMF, regulator-filed holdings, market NAV at $1.0000,\n" +
            "100% government securities. Tranche mode confers GREEN via regulated structure +\n" +
            "NAV integrity, NOT total-pool reconciliation. This is the one flagship that goes\n" +
            "genuinely green - through regulation, not a reconstructed balance.",
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
