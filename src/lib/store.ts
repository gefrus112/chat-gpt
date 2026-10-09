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

interface SettingsState {
  gh: GitHubSettings;
  appearance: AppearanceSettings;
  setGh: (g: Partial<GitHubSettings>) => void;
  setAppearance: (a: Partial<AppearanceSettings>) => void;
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
      setGh: (g) => set((s) => ({ gh: { ...s.gh, ...g } })),
      setAppearance: (a) => set((s) => ({ appearance: { ...s.appearance, ...a } })),
    }),
    { name: "nexus-settings" }
  )
);

export function normalizeRepo(repo: string): { owner: string; name: string } | null {
  if (!repo) return null;
  const cleaned = repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
}
