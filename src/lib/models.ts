export type Provider = "openai" | "anthropic" | "google" | "luna" | "custom";

export interface ModelDef {
  id: string;
  name: string;
  provider: Provider;
  tagline: string;
  badge?: string;
  /** system prompt flavor injected for this model */
  flavor: string;
}

export interface EffortDef {
  id: "low" | "medium" | "high" | "extra" | "max" | "ultra";
  label: string;
  bars: number; // 1-6 signal bars
  hint: string;
  /** how the effort is reflected in the system prompt */
  directive: string;
}

export const EFFORTS: EffortDef[] = [
  { id: "low", label: "Low", bars: 1, hint: "Fastest, minimal reasoning", directive: "Answer as quickly and concisely as possible. Skip preamble, give short direct answers." },
  { id: "medium", label: "Medium", bars: 2, hint: "Balanced speed and depth", directive: "Balance speed and quality. Keep answers focused but complete." },
  { id: "high", label: "High", bars: 3, hint: "Thorough default", directive: "Think through the request carefully and give thorough, well-structured answers." },
  { id: "extra", label: "Extra", bars: 4, hint: "Deep reasoning pass", directive: "Reason deeply about edge cases, alternatives and trade-offs before answering. Provide extra context and detail." },
  { id: "max", label: "Max", bars: 5, hint: "Maximum capability", directive: "Use your maximum capability. Explore the problem exhaustively, consider multiple approaches, self-review your answer, and correct any mistakes before finalizing." },
  { id: "ultra", label: "Ultra", bars: 6, hint: "Slowest · expert chain-of-thought", directive: "Engage expert-level chain-of-thought. Break the problem into stages, draft, critique your own draft, refine it, and deliver a polished, production-grade answer with rigorous detail." },
];

export const BUILT_IN_MODELS: ModelDef[] = [
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    tagline: "Flagship ChatGPT model",
    badge: "New",
    flavor: "You behave like GPT-5.2, OpenAI's flagship model: versatile, precise, friendly.",
  },
  {
    id: "gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    provider: "openai",
    tagline: "Tuned for coding agents",
    badge: "Code",
    flavor: "You behave like GPT-5.2 Codex: a coding-specialized agent. Prefer complete, runnable code, use markdown code fences with language tags, and be pragmatic.",
  },
  {
    id: "o4-mini",
    name: "o4 Mini",
    provider: "openai",
    tagline: "Fast lightweight reasoning",
    flavor: "You behave like o4-mini: fast, lightweight, to the point.",
  },
  {
    id: "claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    tagline: "Best coding model",
    badge: "Popular",
    flavor: "You behave like Claude Sonnet 4.5 by Anthropic: thoughtful, articulate, exceptional at code and long-form reasoning. Use natural, warm prose.",
  },
  {
    id: "claude-opus-4.1",
    name: "Claude Opus 4.1",
    provider: "anthropic",
    tagline: "Most powerful Claude",
    flavor: "You behave like Claude Opus 4.1 by Anthropic: the most powerful, nuanced and careful Claude model, excellent for complex analysis.",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro",
    provider: "google",
    tagline: "Google's most intelligent model",
    badge: "New",
    flavor: "You behave like Gemini 3 Pro by Google: multimodal-minded, structured, great with facts and lists.",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    tagline: "Blazing fast responses",
    flavor: "You behave like Gemini 2.5 Flash by Google: extremely fast and efficient, concise answers.",
  },
  {
    id: "luna-1",
    name: "Luna 1",
    provider: "luna",
    tagline: "NEXUS in-house model",
    badge: "NEXUS",
    flavor: "You are Luna 1, NEXUS Studio's in-house model: creative, playful, imaginative, great for brainstorming and generative art.",
  },
];

export const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  luna: "NEXUS",
  custom: "Your models",
};

export function findEffort(id: string): EffortDef {
  return EFFORTS.find((e) => e.id === id) ?? EFFORTS[2];
}

export interface CustomModelRecord {
  id: string;
  name: string;
  avatar: string | null;
  baseModel: string;
  systemPrompt: string;
  accent: string;
  tagline: string;
}

export function customToModelDef(m: CustomModelRecord): ModelDef {
  return {
    id: `custom:${m.id}`,
    name: m.name,
    provider: "custom",
    tagline: m.tagline || `Custom model · base ${m.baseModel}`,
    badge: "Custom",
    flavor: m.systemPrompt
      ? `You are "${m.name}", a custom AI model created by the user. ${m.systemPrompt}`
      : `You are "${m.name}", a custom AI model created by the user in NEXUS Studio.`,
  };
}
