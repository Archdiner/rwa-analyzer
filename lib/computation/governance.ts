// ---------------------------------------------------------------------------
// governance dimension (v1.3) - "who can change or seize this?"
// ---------------------------------------------------------------------------
// Grades on-chain control honestly. A green rests only on POSITIVELY-detected
// safe control (a recognized proxy behind a timelock / healthy multisig, or a
// confirmed non-upgradeable contract). Because absence of proxy markers is not
// proof of immutability (the reader emits `is_upgradeable: null` there), an
// undetermined upgrade path is `unknown`, never a false green. A single EOA that
// can upgrade is the flagship red.
// ---------------------------------------------------------------------------

import {
    type DimensionAssessment,
    type DimensionRead,
    type FieldName,
    type Flag,
    type GovernanceData,
    type NormalizedAssetRecord,
} from "@/lib/contracts";
import { finalizeReadDimension, unknownDimension } from "@/lib/computation/dimension";

const INPUTS: FieldName[] = [];

// Timelock delay bands (seconds).
const TIMELOCK_STRONG_S = 48 * 3600; // >= 48h: users can exit before a change lands
const TIMELOCK_WEAK_S = 24 * 3600; // 24-48h: some friction
// Multisig: a single-signer multisig is no better than an EOA.
const MULTISIG_MIN_THRESHOLD = 2;

function label(read: DimensionRead<string>): string | null {
    return read.value ?? null;
}

/** Grades the upgrade-control structure. Returns the flag + a reason clause. */
function gradeControl(d: GovernanceData): { flag: Flag; reason: string } {
    const upgradeable = d.is_upgradeable.value;
    const boundary = " This reads control structure, not intent — it does not predict whether the admin will act.";

    if (upgradeable == null) {
        // Neither a recognized proxy nor a positive immutability proof.
        return {
            flag: "unknown",
            reason: `No recognized upgrade mechanism was detected on-chain, but immutability could not be positively confirmed, so control is not assessed.${boundary}`,
        };
    }
    if (upgradeable === false) {
        return { flag: "green", reason: `No upgrade path detected — the contract appears immutable.${boundary}` };
    }

    // Upgradeable: grade the authority.
    const admin = label(d.admin_type);
    const who = d.admin_label ?? (d.admin_address.value ? d.admin_address.value : "an unidentified authority");
    const pauseNote = d.pause_power.value ? " A pause/guardian power is also present." : "";

    switch (admin) {
        case "eoa":
            return { flag: "red", reason: `Upgradeable, and a single externally-owned key (${who}) can replace the implementation — no timelock, no multisig.${pauseNote}${boundary}` };
        case "timelock": {
            const delay = d.timelock_delay_seconds.value ?? 0;
            const h = Math.round(delay / 3600);
            if (delay >= TIMELOCK_STRONG_S) return { flag: "green", reason: `Upgradeable behind a timelock with a ~${h}h delay — changes are announced before they land.${pauseNote}${boundary}` };
            if (delay >= TIMELOCK_WEAK_S) return { flag: "amber", reason: `Upgradeable behind a timelock, but the ~${h}h delay is short.${pauseNote}${boundary}` };
            return { flag: "amber", reason: `Upgradeable behind a timelock with a very short (~${h}h) delay — little exit warning.${pauseNote}${boundary}` };
        }
        case "multisig": {
            const t = d.multisig_threshold.value ?? 0;
            const n = d.multisig_owner_count.value ?? 0;
            if (t >= MULTISIG_MIN_THRESHOLD) return { flag: "green", reason: `Upgradeable via a ${t}-of-${n} multisig — no single key can push a change.${pauseNote}${boundary}` };
            return { flag: "red", reason: `Upgradeable via a ${t}-of-${n} multisig — a single signer can push a change, no better than one key.${pauseNote}${boundary}` };
        }
        case "contract_unknown":
        case "unknown":
        default:
            return { flag: "amber", reason: `Upgradeable, but the upgrade authority (${who}) could not be classified on-chain — treat control as unverified, not safe.${pauseNote}${boundary}` };
    }
}

export function assessGovernance(record: NormalizedAssetRecord): DimensionAssessment {
    const data: GovernanceData | undefined = record.governance_data;
    if (!data) {
        return unknownDimension("No on-chain governance data for this asset; control is not assessed.");
    }

    const { flag, reason } = gradeControl(data);
    if (flag === "unknown") {
        // Undetermined upgradeability → no dateable freshness, honest unknown.
        return unknownDimension(reason);
    }

    // Confidence rests on the always-populated core signals; the conditionally-
    // null detail reads (delay/threshold) inform the reason, not the cap.
    const used = [data.is_upgradeable, data.admin_type];
    return finalizeReadDimension({
        flag,
        reason,
        used,
        asOf: data.is_upgradeable.as_of,
        inputs: INPUTS,
        ceiling: data.underlying_ceiling,
    });
}
