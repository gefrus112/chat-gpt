/**
 * Custom-models client: talks to the ChatUltra server when available and falls
 * back to localStorage when the app runs as a static website (GitHub Pages).
 */

export interface CustomModelRecord {
  id: string;
  name: string;
  avatar: string | null;
  baseModel: string;
  systemPrompt: string;
  accent: string;
  tagline: string;
}

const LS_KEY = "chatultra-custom-models";

function lsRead(): CustomModelRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as CustomModelRecord[]) : [];
  } catch {
    return [];
  }
}

function lsWrite(list: CustomModelRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* storage full / disabled — ignore */
  }
}

export async function listCustomModels(): Promise<CustomModelRecord[]> {
  try {
    const r = await fetch("/api/custom-models");
    if (!r.ok) return lsRead();
    const d = await r.json();
    return d.models ?? [];
  } catch {
    return lsRead();
  }
}

export async function createCustomModel(payload: Omit<CustomModelRecord, "id">): Promise<CustomModelRecord> {
  try {
    const res = await fetch("/api/custom-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "failed");
    return j.model as CustomModelRecord;
  } catch (err) {
    // static hosting → persist locally
    if (err instanceof TypeError || err instanceof SyntaxError) {
      const rec: CustomModelRecord = { id: `ls-${Date.now().toString(36)}`, ...payload };
      lsWrite([...lsRead(), rec]);
      return rec;
    }
    throw err;
  }
}

export async function deleteCustomModel(id: string): Promise<void> {
  try {
    const r = await fetch(`/api/custom-models/${id}`, { method: "DELETE" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return;
  } catch {
    lsWrite(lsRead().filter((m) => m.id !== id));
  }
}
