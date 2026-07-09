import {
    slotToAddress,
    classifyProxy,
    classifyAdmin,
    resolveAdmin,
    buildGovernanceData,
    type RawGovernanceReads,
} from "@/lib/ingestion/governance";

const ZERO = "0x" + "0".repeat(64);
const ADDR_WORD = "0x000000000000000000000000" + "20ca56f1215c3376b25bba1f2f9d3701c5def4c5";

function raw(overrides: Partial<RawGovernanceReads> = {}): RawGovernanceReads {
    return {
        impl: null,
        adminSlot: null,
        beacon: null,
        implCall: null,
        adminCall: null,
        owner: null,
        adminIsContract: null,
        safeThreshold: null,
        safeOwnerCount: null,
        timelockDelaySeconds: null,
        pausePower: null,
        asOf: new Date().toISOString(),
        ...overrides,
    };
}

describe("governance pure shaping", () => {
    describe("slotToAddress", () => {
        it("a zero word is null", () => expect(slotToAddress(ZERO)).toBeNull());
        it("empty/undefined is null", () => {
            expect(slotToAddress(null)).toBeNull();
            expect(slotToAddress("0x")).toBeNull();
        });
        it("extracts the trailing 20-byte address", () => {
            expect(slotToAddress(ADDR_WORD)).toBe("0x20ca56f1215c3376b25bba1f2f9d3701c5def4c5");
        });
    });

    describe("classifyProxy", () => {
        it("beacon slot -> beacon, upgradeable", () => {
            expect(classifyProxy(raw({ beacon: "0xabc" }))).toEqual({ pattern: "beacon", isUpgradeable: true });
        });
        it("impl + admin slot -> transparent, upgradeable", () => {
            expect(classifyProxy(raw({ impl: "0xi", adminSlot: "0xa" }))).toEqual({ pattern: "transparent", isUpgradeable: true });
        });
        it("impl only -> uups, upgradeable", () => {
            expect(classifyProxy(raw({ impl: "0xi" }))).toEqual({ pattern: "uups", isUpgradeable: true });
        });
        it("a live implementation() call without EIP-1967 slots -> unknown pattern, upgradeable (USDC-class)", () => {
            expect(classifyProxy(raw({ implCall: "0ximpl" }))).toEqual({ pattern: "unknown", isUpgradeable: true });
        });
        it("NO markers and no implementation() response -> upgradeability UNKNOWN (never false) — anti-false-green", () => {
            // BUIDL-class: a bespoke proxy with no EIP-1967 slots and no live
            // implementation() response must NOT be classified immutable.
            expect(classifyProxy(raw())).toEqual({ pattern: "unknown", isUpgradeable: null });
        });
    });

    describe("classifyAdmin", () => {
        it("EOA admin (no code) -> eoa", () => {
            expect(classifyAdmin(raw({ adminSlot: "0xeoa", adminIsContract: false })).adminType).toBe("eoa");
        });
        it("timelock admin -> timelock with delay", () => {
            const c = classifyAdmin(raw({ owner: "0xtl", adminIsContract: true, timelockDelaySeconds: 172800 }));
            expect(c.adminType).toBe("timelock");
            expect(c.delay).toBe(172800);
        });
        it("safe admin -> multisig with threshold/owners", () => {
            const c = classifyAdmin(raw({ owner: "0xsafe", adminIsContract: true, safeThreshold: 3, safeOwnerCount: 5 }));
            expect(c.adminType).toBe("multisig");
            expect(c.threshold).toBe(3);
            expect(c.ownerCount).toBe(5);
        });
        it("contract admin that is neither Safe nor Timelock -> contract_unknown", () => {
            expect(classifyAdmin(raw({ owner: "0xc", adminIsContract: true })).adminType).toBe("contract_unknown");
        });
        it("no resolvable admin -> unknown", () => {
            expect(classifyAdmin(raw()).adminType).toBe("unknown");
        });
        it("classifies via successful probes even when getCode was inconclusive (isContract null)", () => {
            // Fix: a failed getCode must not skip the probes — a successful
            // getMinDelay still identifies a timelock.
            expect(classifyAdmin(raw({ owner: "0xtl", adminIsContract: null, timelockDelaySeconds: 172800 })).adminType).toBe("timelock");
        });
        it("a contract answering BOTH timelock and Safe interfaces -> contract_unknown (never a strong-control green)", () => {
            expect(classifyAdmin(raw({ owner: "0xc", adminIsContract: true, timelockDelaySeconds: 172800, safeThreshold: 3, safeOwnerCount: 5 })).adminType).toBe("contract_unknown");
        });
        it("resolveAdmin prefers slot > admin() call > owner()", () => {
            expect(resolveAdmin(raw({ adminSlot: "0xslot", adminCall: "0xcall", owner: "0xowner" }))).toBe("0xslot");
            expect(resolveAdmin(raw({ adminCall: "0xcall", owner: "0xowner" }))).toBe("0xcall");
            expect(resolveAdmin(raw({ owner: "0xowner" }))).toBe("0xowner");
        });
    });

    describe("buildGovernanceData", () => {
        it("transparent proxy + EOA admin -> upgradeable/verified, admin_type eoa", () => {
            const g = buildGovernanceData(raw({ impl: "0xi", adminSlot: "0xeoa", adminIsContract: false }));
            expect(g.is_upgradeable.value).toBe(true);
            expect(g.is_upgradeable.confidence).toBe("verified");
            expect(g.admin_type.value).toBe("eoa");
            expect(g.proxy_pattern.value).toBe("transparent");
        });
        it("no markers (BUIDL-class) -> is_upgradeable null, admin_type unknown (never immutable/benign)", () => {
            const g = buildGovernanceData(raw({ owner: "0xsomeowner", adminIsContract: true }));
            expect(g.is_upgradeable.value).toBeNull();
            expect(g.admin_type.value).toBe("unknown"); // suppressed: upgradeability unconfirmed
        });
        it("uups with roles-based auth (owner() reverts) -> upgradeable but admin unknown", () => {
            const g = buildGovernanceData(raw({ impl: "0xi", owner: null }));
            expect(g.is_upgradeable.value).toBe(true);
            expect(g.admin_type.value).toBe("unknown");
        });
        it("carries an optional admin_label and underlying ceiling when provided", () => {
            const g = buildGovernanceData(raw({ impl: "0xi", adminSlot: "0xa", adminIsContract: true, timelockDelaySeconds: 86400 }), { adminLabel: "Gov Timelock", underlyingCeiling: "amber" });
            expect(g.admin_label).toBe("Gov Timelock");
            expect(g.underlying_ceiling).toBe("amber");
        });
    });
});
