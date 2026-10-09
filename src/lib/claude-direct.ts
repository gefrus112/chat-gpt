/**
 * Direct-from-browser Anthropic Claude API client.
 *
 * Fixes the old "https error": api.anthropic.com rejects plain browser calls
 * unless the explicit `anthropic-dangerous-direct-browser-access` header is
 * sent. All failures are mapped to short, friendly messages — raw network /
 * HTTPS stack traces never reach the UI.
 */

const API_BASE = "https://api.anthropic.com/v1/messages";

/** Real API model ids tried in order (Opus 5 first, then known fallbacks). */
const MODEL_IDS = [
  "claude-opus-5",
  "claude-opus-5-20251101",
  "claude-opus-4-1-20250805",
  "claude-sonnet-4-5-20250929",
];

export interface ClaudeTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeResult {
  ok: boolean;
  text?: string;
  modelId?: string;
  error?: string;
}

function friendly(status: number, detail?: string): string {
  switch (status) {
    case 401:
      return "Anthropic rejected the key (401). Double-check it in Settings > Connections.";
    case 403:
      return "This key is not allowed to use Claude (403). Check its permissions.";
    case 404:
      return "Model id not available on this key (404).";
    case 429:
      return "Rate limit reached (429) — wait a moment and try again.";
    case 500:
    case 502:
    case 503:
    case 529:
      return "Claude is overloaded right now, try again shortly.";
    default:
      return detail ? `Anthropic API ${status}: ${detail}` : `Anthropic API ${status}`;
  }
}

/** True when the string looks like an Anthropic key. */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_\-]{16,}$/.test(key.trim());
}

/**
 * Call Claude with a short conversation. Returns { ok, text } or { ok:false, error }
 * with a friendly, human-readable error — never a raw fetch/HTTPS exception.
 */
export async function callClaude(
  apiKey: string,
  turns: ClaudeTurn[],
  system?: string,
  maxTokens = 2048
): Promise<ClaudeResult> {
  const key = apiKey.trim();
  if (!looksLikeAnthropicKey(key)) {
    return { ok: false, error: "That does not look like an Anthropic key. Keys start with sk-ant-." };
  }

  let lastError = "Claude request failed.";
  for (const modelId of MODEL_IDS) {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          // required for direct browser access — without it the API call dies pre-flight
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: modelId,
          max_tokens: maxTokens,
          ...(system ? { system } : {}),
          messages: turns.map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          content?: { type: string; text?: string }[];
          model?: string;
        };
        const text = (data.content ?? [])
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("\n")
          .trim();
        return { ok: true, text, modelId: data.model ?? modelId };
      }

      if (res.status === 404) {
        lastError = friendly(res.status);
        continue; // unknown model id, try the next one
      }

      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: friendly(res.status, body.error?.message) };
    } catch {
      // TypeError / network / mixed-content — translated, never surfaced raw
      return {
        ok: false,
        error: "Could not reach api.anthropic.com from this browser (network or extension blocked the request). ChatUltra fell back to the local engine.",
      };
    }
  }
  return { ok: false, error: lastError };
}
