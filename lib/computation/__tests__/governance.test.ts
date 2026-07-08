import { assessGovernance } from "@/lib/computation/governance";
import type { Confidence, DimensionRead, GovernanceData, NormalizedAssetRecord } from "@/lib/contracts";
import { rec, daysAgo } from "./helpers";

function rd<T extends number | boolean | string>(value: T | null, confidence: Confidence = "verified", as_of = new Date().toISOString()): DimensionRead<T> {
    return { value, source: "onchain:governance", method: "onchain_read", confidence, as_of };
}

function gov(overrides: Partial<GovernanceData> = {}): GovernanceData {
    return {
        proxy_pattern: rd<string>("transparent"),
        is_upgradeable: rd<boolean>(true),
        admin_type: rd<string>("timelock"),
        admin_address: rd<string>("0x000000000000000000000000000000000000ad11"),
        multisig_threshold: rd<number>(null),
        multisig_owner_count: rd<number>(null),
        timelock_delay_seconds: rd<number>(172800), // 48h
        pause_power: rd<boolean>(false),
        ...overrides,
    };
}

function recWithGov(data: GovernanceData): NormalizedAssetRecord {
    return { ...rec(), governance_data: data };
}

describe("assessGovernance", () => {
    it("upgradeable behind a 48h timelock -> green/verified", () => {
        const r = assessGovernance(recWithGov(gov()));
        expect(r.flag).toBe("green");
        expect(r.confidence).toBe("verified");
        expect(r.reason).toMatch(/timelock/i);
    });

    it("EOA admin over an upgradeable proxy -> red (the flagship)", () => {
        const r = assessGovernance(recWithGov(gov({ admin_type: rd<string>("eoa"), timelock_delay_seconds: rd<number>(null), proxy_pattern: rd<string>("uups") })));
        expect(r.flag).toBe("red");
        expect(r.reason).toMatch(/single externally-owned key/i);
    });

    it("healthy multisig (3-of-5) -> green", () => {
        const r = assessGovernance(recWithGov(gov({ admin_type: rd<string>("multisig"), timelock_delay_seconds: rd<number>(null), multisig_threshold: rd<number>(3), multisig_owner_count: rd<number>(5) })));
        expect(r.flag).toBe("green");
        expect(r.reason).toMatch(/3-of-5 multisig/);
    });

    it("1-of-n multisig -> red (single signer can act)", () => {
        const r = assessGovernance(recWithGov(gov({ admin_type: rd<string>("multisig"), timelock_delay_seconds: rd<number>(null), multisig_threshold: rd<number>(1), multisig_owner_count: rd<number>(4) })));
        expect(r.flag).toBe("red");
    });

    it("short timelock delay -> amber", () => {
        const r = assessGovernance(recWithGov(gov({ timelock_delay_seconds: rd<number>(3600) }))); // 1h
        expect(r.flag).toBe("amber");
    });

    it("upgradeable but admin unclassifiable -> amber, treated as unverified (not green)", () => {
        const r = assessGovernance(recWithGov(gov({ admin_type: rd<string>("unknown"), admin_address: rd<string>(null), timelock_delay_seconds: rd<number>(null) })));
        expect(r.flag).toBe("amber");
        expect(r.reason).toMatch(/could not be classified/i);
    });

    it("upgradeability undetermined (no markers, e.g. BUIDL) -> unknown, NOT a false immutable green", () => {
        const r = assessGovernance(recWithGov(gov({ is_upgradeable: rd<boolean>(null), proxy_pattern: rd<string>("unknown"), admin_type: rd<string>("unknown") })));
        expect(r.flag).toBe("unknown");
        expect(r.reason).toMatch(/immutability could not be positively confirmed/i);
    });

    it("confirmed immutable (no upgrade path) -> green", () => {
        const r = assessGovernance(recWithGov(gov({ is_upgradeable: rd<boolean>(false), proxy_pattern: rd<string>("none"), admin_type: rd<string>("none") })));
        expect(r.flag).toBe("green");
        expect(r.reason).toMatch(/immutable/i);
    });

    it("no governance_data -> unknown", () => {
        const r = assessGovernance(rec());
        expect(r.flag).toBe("unknown");
        expect(r.confidence).toBe("unverifiable");
    });

    it("a pause power is surfaced as a caveat", () => {
        const r = assessGovernance(recWithGov(gov({ pause_power: rd<boolean>(true) })));
        expect(r.reason).toMatch(/pause\/guardian power/i);
    });

    it("stale read demotes a green one notch", () => {
        const r = assessGovernance(recWithGov(gov({ is_upgradeable: rd<boolean>(true, "verified", daysAgo(4)), admin_type: rd<string>("timelock", "verified", daysAgo(4)) })));
        expect(r.flag).not.toBe("green");
        expect(r.freshness).toBe("stale");
    });

    it("anti-laundering: an unverified underlying caps a would-be green", () => {
        const r = assessGovernance(recWithGov(gov({ underlying_ceiling: "amber" })));
        expect(r.flag).toBe("amber");
    });
});
