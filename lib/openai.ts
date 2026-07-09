// ---------------------------------------------------------------------------
// OpenAI wrapper - structured JSON extraction
// ---------------------------------------------------------------------------
// A single thin entry point used by the extractor. Enforces a JSON schema
// (strict structured output) so the model can only return enum-constrained
// values. Returns null on any failure - the caller degrades gracefully to
// `unverifiable` rather than trusting a malformed response.
// ---------------------------------------------------------------------------

import OpenAI from "openai";
import { openAiKey } from "@/lib/env";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
    const apiKey = openAiKey();
    if (!apiKey) return null;
    if (!client) client = new OpenAI({ apiKey });
    return client;
}

export function hasOpenAi(): boolean {
    return Boolean(openAiKey());
}

export interface ExtractArgs {
    system: string;
    user: string;
    /** JSON Schema object describing the expected output. */
    schema: Record<string, unknown>;
    schemaName: string;
}

/**
 * Runs a strict structured-output completion and returns the parsed object,
 * or null if OpenAI is unconfigured, the call fails, or parsing fails.
 */
export async function extractJson<T>({ system, user, schema, schemaName }: ExtractArgs): Promise<T | null> {
    const openai = getClient();
    if (!openai) return null;

    try {
        const completion = await openai.chat.completions.create({
            model: DEFAULT_MODEL,
            temperature: 0,
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: schemaName,
                    strict: true,
                    schema,
                },
            },
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) return null;

        return JSON.parse(content) as T;
    } catch (err) {
        console.error("[openai] extraction failed:", err);
        return null;
    }
}
