import { validateSuggestion, MAX_LEN } from "@/lib/features/validation";

describe("validateSuggestion", () => {
    it("accepts a normal suggestion", () => {
        expect(validateSuggestion("add coverage for tokenized T-bills").ok).toBe(true);
    });

    it("accepts a large, ambitious idea up to the bound (no ceiling on ambition)", () => {
        expect(validateSuggestion("x".repeat(MAX_LEN)).ok).toBe(true);
    });

    it("rejects empty, whitespace, and non-strings", () => {
        expect(validateSuggestion("").ok).toBe(false);
        expect(validateSuggestion("   ").ok).toBe(false);
        expect(validateSuggestion(undefined).ok).toBe(false);
        expect(validateSuggestion(42).ok).toBe(false);
    });

    it("rejects text past the abuse bound", () => {
        const res = validateSuggestion("x".repeat(MAX_LEN + 1));
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/under/);
    });
});
