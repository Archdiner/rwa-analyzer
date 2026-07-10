// Shared client/server validation for the open suggestion box. No size ceiling
// on ideas - only a raw length bound for abuse. Kept pure + framework-free so
// both the submit endpoint (U7) and the form (U9) enforce the same rules.

export const MIN_LEN = 3;
export const MAX_LEN = 8000;

export interface Validation {
    ok: boolean;
    error?: string;
}

export function validateSuggestion(raw: unknown): Validation {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (text.length < MIN_LEN) return { ok: false, error: "Provide a suggestion." };
    if (text.length > MAX_LEN) return { ok: false, error: `Keep it under ${MAX_LEN} characters.` };
    return { ok: true };
}
