// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------
// Merges partial field-maps from many adapters into one record. On a genuine
// disagreement between sources it does NOT silently pick a winner: it records
// the conflict and DEMOTES the surviving field's confidence one step (a
// supply-vs-reserves-style mismatch is itself a risk signal Module 2 reads).
// Reconciliation only ever demotes confidence — never promotes.
// ---------------------------------------------------------------------------

import {
    CONFIDENCE_RANK,
    demoteConfidence,
    type AssetIdentifiers,
    type FieldConflict,
    type FieldMap,
    type FieldName,
    type FieldObject,
    type FieldValue,
    type NormalizedAssetRecord,
} from "@/lib/contracts";

export interface Contribution {
    fields: FieldMap;
    identifiers?: Partial<AssetIdentifiers>;
}

const NUMERIC_TOLERANCE = 0.005; // 0.5% — same-field values this close "agree"

function valuesAgree(a: FieldValue, b: FieldValue): boolean {
    if (typeof a === "number" && typeof b === "number") {
        if (a === b) return true;
        const denom = Math.max(Math.abs(a), Math.abs(b)) || 1;
        return Math.abs(a - b) / denom <= NUMERIC_TOLERANCE;
    }
    return a === b;
}

/** Highest-confidence field wins ties by keeping the earliest contributor. */
function mostConfident(fields: FieldObject[]): FieldObject {
    return fields.reduce((best, f) =>
        CONFIDENCE_RANK[f.confidence] > CONFIDENCE_RANK[best.confidence] ? f : best,
    );
}

function allFieldNames(contributions: Contribution[]): FieldName[] {
    const names = new Set<FieldName>();
    for (const c of contributions) {
        for (const k of Object.keys(c.fields) as FieldName[]) names.add(k);
    }
    return [...names];
}

/**
 * Merges contributions into a reconciled field map + conflict list. Later
 * contributions do not overwrite earlier ones except by confidence; identical
 * values from multiple sources simply keep the most-confident copy.
 */
export function reconcileFields(contributions: Contribution[]): {
    fields: FieldMap;
    conflicts: FieldConflict[];
} {
    const fields: FieldMap = {};
    const conflicts: FieldConflict[] = [];

    for (const name of allFieldNames(contributions)) {
        const contributed: FieldObject[] = [];
        for (const c of contributions) {
            const f = c.fields[name];
            if (f) contributed.push(f);
        }
        if (contributed.length === 0) continue;

        if (contributed.length === 1) {
            fields[name] = contributed[0];
            continue;
        }

        const first = contributed[0];
        const disagreement = contributed.some((f) => !valuesAgree(f.value, first.value));

        const winner = mostConfident(contributed);

        if (disagreement) {
            conflicts.push({
                field: name,
                values: contributed.map((f) => f.value),
                sources: contributed.map((f) => f.source),
            });
            // Demote the surviving field — a source disagreement is a real signal.
            fields[name] = { ...winner, confidence: demoteConfidence(winner.confidence) };
        } else {
            fields[name] = winner;
        }
    }

    return { fields, conflicts };
}

function mergeIdentifiers(
    assetId: string,
    fallback: { chainId: number; address: string },
    contributions: Contribution[],
): AssetIdentifiers {
    const id: AssetIdentifiers = {
        name: "",
        symbol: "",
        chain_id: fallback.chainId,
        contract_address: fallback.address,
    };
    for (const c of contributions) {
        const ci = c.identifiers;
        if (!ci) continue;
        if (!id.name && ci.name) id.name = ci.name;
        if (!id.symbol && ci.symbol) id.symbol = ci.symbol;
        if (!id.issuer_name && ci.issuer_name) id.issuer_name = ci.issuer_name;
    }
    // Honest fallbacks so a record is never nameless.
    if (!id.symbol) id.symbol = fallback.address.slice(0, 8);
    if (!id.name) id.name = id.symbol;
    return id;
}

/** Assembles a full Contract A record from adapter contributions. */
export function reconcile(
    assetId: string,
    fallback: { chainId: number; address: string },
    contributions: Contribution[],
): NormalizedAssetRecord {
    const { fields, conflicts } = reconcileFields(contributions);
    return {
        asset_id: assetId,
        identifiers: mergeIdentifiers(assetId, fallback, contributions),
        fields,
        conflicts,
        ingested_at: new Date().toISOString(),
    };
}
