"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface GitHubSettings {
  token: string;
  repo: string; // owner/name or full URL
  branch: string;
  connected: boolean;
  lastPush?: string;
}

export interface AppearanceSettings {
  accent: string; // hex
  fontSize: "sm" | "md" | "lg";
  glow: boolean;
  compactSidebar: boolean;
  monoMsg: boolean;
}

export interface ConnectionSettings {
  /** Anthropic API key (sk-ant-...) — enables real Claude models straight from the browser */
  anthropicKey: string;
  anthropicOk: boolean;
  /** OpenAI API key (sk-...) — real GPT models with live token streaming */
  openaiKey: string;
  openaiOk: boolean;
  /** Google AI API key (AIza...) — real Gemini models with live streaming */
  googleKey: string;
  googleOk: boolean;
  /** ChatUltra backend server (backend/ folder) — real generation with API keys */
  backendUrl: string;
  backendKey: string;
  backendOk: boolean;
  /** Supabase project — cloud account sync */
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseOk: boolean;
  /** Cloudflare Turnstile site key — protects account signup */
  turnstileSiteKey: string;
}

export interface CreditsState {
  balance: number;
  totalBought: number;
  totalSpent: number;
}

interface SettingsState {
  gh: GitHubSettings;
  appearance: AppearanceSettings;
  connections: ConnectionSettings;
  credits: CreditsState;
  setGh: (g: Partial<GitHubSettings>) => void;
  setAppearance: (a: Partial<AppearanceSettings>) => void;
  setConnections: (c: Partial<ConnectionSettings>) => void;
  setCredits: (c: Partial<CreditsState>) => void;
  grantCredits: (n: number) => void;
  spendCredits: (n: number) => boolean;
}

export const ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: "cyan", label: "Ion Cyan", hex: "#22d3ee" },
  { id: "violet", label: "Nebula Violet", hex: "#a78bfa" },
  { id: "emerald", label: "Terminal Green", hex: "#34d399" },
  { id: "amber", label: "Solar Amber", hex: "#fbbf24" },
  { id: "rose", label: "Pulse Rose", hex: "#fb7185" },
  { id: "sky", label: "Deep Sky", hex: "#38bdf8" },
];

export const DEFAULT_REPO = "gefrus112/chat-gpt";

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      gh: { token: "", repo: DEFAULT_REPO, branch: "main", connected: false },
      appearance: { accent: "#22d3ee", fontSize: "md", glow: true, compactSidebar: false, monoMsg: false },
      connections: {
        anthropicKey: "",
        anthropicOk: false,
        openaiKey: "",
        openaiOk: false,
        googleKey: "",
        googleOk: false,
        backendUrl: "",
        backendKey: "",
        backendOk: false,
        supabaseUrl: "",
        supabaseAnonKey: "",
        supabaseOk: false,
        turnstileSiteKey: "",
      },
      credits: { balance: 240, totalBought: 0, totalSpent: 0 },
      setGh: (g) => set((s) => ({ gh: { ...s.gh, ...g } })),
      setAppearance: (a) => set((s) => ({ appearance: { ...s.appearance, ...a } })),
      setConnections: (c) => set((s) => ({ connections: { ...s.connections, ...c } })),
      setCredits: (c) => set((s) => ({ credits: { ...s.credits, ...c } })),
      grantCredits: (n) =>
        set((s) => ({ credits: { ...s.credits, balance: s.credits.balance + n, totalBought: s.credits.totalBought + n } })),
      spendCredits: (n) => {
        const cur = useSettings.getState().credits;
        if (cur.balance < n) return false;
        set({ credits: { ...cur, balance: cur.balance - n, totalSpent: cur.totalSpent + n } });
        return true;
      },
    }),
    { name: "chatultra-settings" }
  )
);

export function normalizeRepo(repo: string): { owner: string; name: string } | null {
  if (!repo) return null;
  const cleaned = repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
}
