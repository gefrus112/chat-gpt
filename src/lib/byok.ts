/**
 * ChatUltra BYOK — real backend through your own API keys.
 *
 * Paste an OpenAI / Anthropic / Google key in Settings > Connections and the
 * matching models answer for real, straight from the browser, with true
 * token-by-token streaming (SSE). Keys never leave this device except to the
 * provider's own API endpoint.
 *
 * Every provider gets a fallback chain of real model ids: flagship ids that do
 * not exist yet on a given key gracefully degrade to the closest real model,
 * exactly like claude-direct.ts already does for Claude.
 */

export type ByokProvider = "openai" | "anthropic" | "google";

export interface ByokTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ByokStreamArgs {
  apiKey: string;
  /** ChatUltra model id (e.g. "gpt-5.2") — mapped to real ids internally */
  model: string;
  turns: ByokTurn[];
  system?: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export interface ByokResult {
  ok: boolean;
  text?: string;
  /** the real provider model id that actually answered */
  modelId?: string;
  error?: string;
}

/* ---------------- real model id chains ---------------- */

const OPENAI_CHAINS: Record<string, string[]> = {
  "gpt-5.2": ["gpt-5.2", "gpt-5", "gpt-4.1", "gpt-4o"],
  "gpt-5.2-codex": ["gpt-5.2-codex", "gpt-5-codex", "gpt-4.1", "gpt-4o"],
  "o4-mini": ["o4-mini", "gpt-4.1-mini", "gpt-4o-mini"],
};

const ANTHROPIC_CHAINS: Record<string, string[]> = {
  "claude-opus-5-1": ["claude-opus-5-1", "claude-opus-5", "claude-opus-4-1-20250805", "claude-sonnet-4-5-20250929"],
  "claude-opus-5": ["claude-opus-5", "claude-opus-4-1-20250805", "claude-sonnet-4-5-20250929"],
  "claude-sonnet-4.5": ["claude-sonnet-4.5", "claude-sonnet-4-5-20250929", "claude-3-7-sonnet-20250219"],
};

const GOOGLE_CHAINS: Record<string, string[]> = {
  "gemini-3-pro": ["gemini-3-pro", "gemini-2.5-pro", "gemini-2.0-flash"],
  "gemini-2.5-flash": ["gemini-2.5-flash", "gemini-2.0-flash"],
};

function chainFor(provider: ByokProvider, model: string): string[] {
  const chains = provider === "openai" ? OPENAI_CHAINS : provider === "anthropic" ? ANTHROPIC_CHAINS : GOOGLE_CHAINS;
  return chains[model] ?? (provider === "openai" ? ["gpt-4o"] : provider === "anthropic" ? ["claude-sonnet-4-5-20250929"] : ["gemini-2.0-flash"]);
}

/* ---------------- friendly errors ---------------- */

function friendly(provider: ByokProvider, status: number, detail?: string): string {
  const who = provider === "openai" ? "OpenAI" : provider === "anthropic" ? "Anthropic" : "Google";
  switch (status) {
    case 401:
      return `${who} rejected the key (401). Double-check it in Settings > Connections.`;
    case 403:
      return `This key is not allowed to use ${who} (403). Check its permissions/region.`;
    case 404:
      return `No compatible ${who} model on this key (404).`;
    case 429:
      return `Rate limit or quota reached (429) — check billing on the ${who} console.`;
    case 500:
    case 502:
    case 503:
      return `${who} is overloaded right now, try again shortly.`;
    default:
      return detail ? `${who} API ${status}: ${detail}` : `${who} API ${status}`;
  }
}

function networkError(provider: ByokProvider): string {
  const who = provider === "openai" ? "api.openai.com" : provider === "anthropic" ? "api.anthropic.com" : "generativelanguage.googleapis.com";
  return `Could not reach ${who} from this browser (network, CORS or an extension blocked the request).`;
}

/* ---------------- SSE reader helper ---------------- */

async function readSSE(
  res: Response,
  extract: (evt: Record<string, unknown>) => string | null,
  onDelta: (t: string) => void
): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const piece = extract(JSON.parse(payload));
        if (piece) {
          full += piece;
          onDelta(piece);
        }
      } catch {
        /* partial json — ignore */
      }
    }
  }
  return full;
}

/* ---------------- OpenAI ---------------- */

async function streamOpenAI(args: ByokStreamArgs): Promise<ByokResult> {
  const { apiKey, turns, system, signal, onDelta } = args;
  for (const modelId of chainFor("openai", args.model)) {
    let res: Response;
    try {
      res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: modelId,
          stream: true,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...turns.map((t) => ({ role: t.role, content: t.content })),
          ],
        }),
        signal,
      });
    } catch {
      return { ok: false, error: networkError("openai") };
    }
    if (res.status === 404) continue; // unknown id on this key — try next
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: friendly("openai", res.status, body.error?.message) };
    }
    const text = await readSSE(
      res,
      (evt) => {
        const choices = evt.choices as { delta?: { content?: string } }[] | undefined;
        const piece = choices?.[0]?.delta?.content;
        return piece ?? null;
      },
      onDelta
    );
    return { ok: true, text: text.trim(), modelId };
  }
  return { ok: false, error: "No compatible OpenAI model found on this key." };
}

/* ---------------- Anthropic ---------------- */

async function streamAnthropic(args: ByokStreamArgs): Promise<ByokResult> {
  const { apiKey, turns, system, signal, onDelta } = args;
  for (const modelId of chainFor("anthropic", args.model)) {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          // required for direct browser access
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: 8192,
          stream: true,
          ...(system ? { system } : {}),
          messages: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
        signal,
      });
    } catch {
      return { ok: false, error: networkError("anthropic") };
    }
    if (res.status === 404) continue;
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: friendly("anthropic", res.status, body.error?.message) };
    }
    const text = await readSSE(
      res,
      (evt) => {
        if (evt.type !== "content_block_delta") return null;
        const delta = evt.delta as { type?: string; text?: string } | undefined;
        return delta?.type === "text_delta" && delta.text ? delta.text : null;
      },
      onDelta
    );
    return { ok: true, text: text.trim(), modelId };
  }
  return { ok: false, error: "No compatible Anthropic model found on this key." };
}

/* ---------------- Google Gemini ---------------- */

async function streamGoogle(args: ByokStreamArgs): Promise<ByokResult> {
  const { apiKey, turns, system, signal, onDelta } = args;
  const contents = turns.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.content }],
  }));
  for (const modelId of chainFor("google", args.model)) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey.trim())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          }),
          signal,
        }
      );
    } catch {
      return { ok: false, error: networkError("google") };
    }
    if (res.status === 404) continue;
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: friendly("google", res.status, body.error?.message) };
    }
    const text = await readSSE(
      res,
      (evt) => {
        const candidates = evt.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined;
        const parts = candidates?.[0]?.content?.parts;
        if (!parts) return null;
        return parts.map((p) => p.text ?? "").join("") || null;
      },
      onDelta
    );
    return { ok: true, text: text.trim(), modelId };
  }
  return { ok: false, error: "No compatible Google model found on this key." };
}

/* ---------------- dispatcher ---------------- */

export function byokProviderFor(modelProvider: string): ByokProvider | null {
  if (modelProvider === "openai") return "openai";
  if (modelProvider === "anthropic") return "anthropic";
  if (modelProvider === "google") return "google";
  return null;
}

/** Stream a real completion with the provider key the user saved locally. */
export async function streamByok(provider: ByokProvider, args: ByokStreamArgs): Promise<ByokResult> {
  try {
    if (provider === "openai") return await streamOpenAI(args);
    if (provider === "anthropic") return await streamAnthropic(args);
    return await streamGoogle(args);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "BYOK request failed" };
  }
}

/* ---------------- key validators (used by Settings > Connections) ---------------- */

export function looksLikeOpenAIKey(key: string): boolean {
  return /^sk-[A-Za-z0-9_\-]{20,}$/.test(key.trim());
}

export function looksLikeGoogleKey(key: string): boolean {
  return /^AIza[A-Za-z0-9_\-]{30,}$/.test(key.trim());
}

/** Validate an OpenAI key by listing models (cheap, key-scoped). */
export async function testOpenAIKey(key: string): Promise<{ ok: boolean; msg: string }> {
  if (!looksLikeOpenAIKey(key)) return { ok: false, msg: "OpenAI keys start with sk- — that one does not look right." };
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key.trim()}` } });
    if (res.ok) {
      const j = (await res.json()) as { data?: { id: string }[] };
      const n = j.data?.length ?? 0;
      return { ok: true, msg: `Connected — key can see ${n} OpenAI models. GPT models now answer live.` };
    }
    return { ok: false, msg: friendly("openai", res.status) };
  } catch {
    return { ok: false, msg: networkError("openai") };
  }
}

/** Validate an Anthropic key with a tiny 1-token message. */
export async function testAnthropicKey(key: string): Promise<{ ok: boolean; msg: string }> {
  if (!key.trim().startsWith("sk-ant-")) return { ok: false, msg: "Anthropic keys start with sk-ant- — that one does not look right." };
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key.trim(),
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-5-20250929", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    });
    if (res.ok) return { ok: true, msg: "Connected — Claude models now answer live from your browser." };
    if (res.status === 404) return { ok: true, msg: "Key is valid. (Test model id not on this key, but Claude calls will use fallbacks.)" };
    return { ok: false, msg: friendly("anthropic", res.status) };
  } catch {
    return { ok: false, msg: networkError("anthropic") };
  }
}

/** Validate a Google key by listing models. */
export async function testGoogleKey(key: string): Promise<{ ok: boolean; msg: string }> {
  if (!looksLikeGoogleKey(key)) return { ok: false, msg: "Google AI keys start with AIza — that one does not look right." };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}`);
    if (res.ok) {
      const j = (await res.json()) as { models?: unknown[] };
      return { ok: true, msg: `Connected — key can see ${j.models?.length ?? 0} Gemini models. Gemini now answers live.` };
    }
    return { ok: false, msg: friendly("google", res.status) };
  } catch {
    return { ok: false, msg: networkError("google") };
  }
}
