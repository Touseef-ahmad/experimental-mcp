/// <reference types="node" />
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export type ModelProvider = "openai" | "ollama";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
}

export function getModelConfig(provider?: ModelProvider): ModelConfig {
  const selected =
    provider ?? (process.env.MODEL_PROVIDER === "openai" ? "openai" : "ollama");

  if (selected === "openai") {
    return {
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  return {
    provider: "ollama",
    model: process.env.OLLAMA_MODEL ?? "qwen2.5:1.5b",
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  };
}

export function createModel(provider?: ModelProvider): BaseChatModel {
  const config = getModelConfig(provider);

  if (config.provider === "openai") {
    return new ChatOpenAI({
      model: config.model,
      temperature: 0,
    });
  }

  return new ChatOllama({
    model: config.model,
    baseUrl: config.baseUrl,
    temperature: 0,
  });
}
