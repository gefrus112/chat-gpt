/**
 * ChatUltra cloud connectors — ChatUltra backend, Supabase account sync and
 * Cloudflare Turnstile. All calls are browser-safe and fail soft: when a
 * connector is not configured (or the network blocks it) the app keeps
 * working locally.
 */

import { useSettings } from "@/lib/store";
import type { Account } from "@/lib/account";

/* ---------------- ChatUltra backend (backend/server.js) ---------------- */

export interface BackendHealth {
  ok: boolean;
  version?: string;
  freeModels?: string[];
  paidModels?: string[];
  stripe?: boolean;
  supabase?: boolean;
  error?: string;
}

export async function backendHealth(): Promise<BackendHealth> {
  const { backendUrl, backendKey } = useSettings.getState().connections;
  if (!backendUrl) return { ok: false, error: "no backend url" };
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/health`, {
      headers: backendKey ? { Authorization: `Bearer ${backendKey}` } : {},
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const j = await res.json();
    return { ok: true, ...j };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/** Push a real generation request through the backend (text or video). */
export async function backendGenerate(
  kind: "chat" | "video",
  payload: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { backendUrl, backendKey } = useSettings.getState().connections;
  if (!backendUrl) return { ok: false, error: "no backend url" };
  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/${kind}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(backendKey ? { Authorization: `Bearer ${backendKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) return { ok: false, error: j.error || `HTTP ${res.status}` };
    return { ok: true, data: j };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/* ---------------- Supabase (account cloud sync) ---------------- */

export interface SupabaseTest {
  ok: boolean;
  message: string;
}

export function supabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = useSettings.getState().connections;
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Upsert the local account profile into the Supabase `accounts` table. */
export async function supabaseSyncAccount(account: Account): Promise<SupabaseTest> {
  const { supabaseUrl, supabaseAnonKey } = useSettings.getState().connections;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, message: "Add your Supabase project URL + anon key first." };
  }
  const base = supabaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/rest/v1/accounts?on_conflict=username`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
          username: account.username,
          bio: account.bio,
          website: account.website,
          avatar: account.avatar,
          created_at: account.createdAt,
          updated_at: new Date().toISOString(),
        },
      ]),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, message: `Supabase said ${res.status} — check the URL/anon key and that the accounts table exists (see backend/supabase/schema.sql).` + (t ? ` ${t.slice(0, 140)}` : "") };
    }
    return { ok: true, message: `Profile synced to Supabase (${account.username}).` };
  } catch {
    return { ok: false, message: "Could not reach Supabase — check the project URL and your network." };
  }
}

export async function testSupabase(): Promise<SupabaseTest> {
  const { supabaseUrl, supabaseAnonKey } = useSettings.getState().connections;
  if (!supabaseUrl || !supabaseAnonKey) return { ok: false, message: "Enter the project URL and anon key first." };
  const base = supabaseUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/rest/v1/accounts?select=username&limit=1`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    });
    if (res.ok) return { ok: true, message: "Supabase reachable — accounts table is live." };
    if (res.status === 404) return { ok: false, message: "Connected, but the accounts table is missing — run backend/supabase/schema.sql." };
    return { ok: false, message: `Supabase said ${res.status} — verify the anon key.` };
  } catch {
    return { ok: false, message: "Could not reach Supabase — check the URL." };
  }
}

/* ---------------- Cloudflare Turnstile (signup protection) ---------------- */

/** Load the Turnstile widget script once. Returns false when offline/blocked. */
export function loadTurnstile(siteKey: string): boolean {
  if (!siteKey) return false;
  const w = window as unknown as { turnstile?: unknown };
  if (w.turnstile) return true;
  try {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort Turnstile check. When the widget is unavailable (static demo,
 * blocked network) the signup still proceeds — Turnstile hardens the flow
 * on the real backend, where the server verifies the token again.
 */
export async function turnstileToken(siteKey: string, container: HTMLElement): Promise<string | null> {
  const w = window as unknown as {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; getResponse?: (id: string) => string };
  };
  if (!siteKey || !w.turnstile) return null;
  return new Promise((resolve) => {
    try {
      const id = w.turnstile!.render(container, {
        sitekey: siteKey,
        callback: (t: string) => resolve(t),
        "error-callback": () => resolve(null),
        "expired-callback": () => resolve(null),
      });
      setTimeout(() => resolve(w.turnstile?.getResponse?.(id) ?? null), 8000);
    } catch {
      resolve(null);
    }
  });
}
