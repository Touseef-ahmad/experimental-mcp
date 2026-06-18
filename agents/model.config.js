/// <reference types="node" />
/**
 * Get model configuration from environment.
 * OpenAI Agents SDK primarily supports OpenAI models.
 */
export function getModelConfig() {
    return {
        provider: "openai",
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
}
