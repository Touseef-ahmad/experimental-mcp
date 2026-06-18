/// <reference types="node" />

export type ModelProvider = "openai";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
}

/**
 * Get model configuration from environment.
 * OpenAI Agents SDK primarily supports OpenAI models.
 */
export function getModelConfig(): ModelConfig {
  return {
    provider: "openai",
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}
