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
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
const EMBED_DIMS = 1536;

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

/** Embeds one or more texts (text-embedding-3-small @ 1536 dims). Null on failure/unconfigured. */
export async function embed(texts: string[]): Promise<number[][] | null> {
    const openai = getClient();
    if (!openai || texts.length === 0) return null;
    try {
        const res = await openai.embeddings.create({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIMS });
        return res.data.map((d) => d.embedding);
    } catch (err) {
        console.error("[openai] embed failed:", err);
        return null;
    }
}
