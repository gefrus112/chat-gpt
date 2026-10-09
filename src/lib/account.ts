"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Account {
  username: string;
  bio: string;
  website: string;
  avatar: string | null; // data URL
  createdAt: string;
}

interface StoredAccount extends Account {
  passHash: string;
}

interface AccountState {
  account: (Account & { passHash?: string }) | null;
  signIn: (a: Account & { passHash?: string }) => void;
  update: (p: Partial<Account>) => void;
  setPassHash: (h: string) => void;
  signOut: () => void;
}

export const useAccount = create<AccountState>()(
  persist(
    (set) => ({
      account: null,
      signIn: (account) => set({ account }),
      update: (p) => set((s) => (s.account ? { account: { ...s.account, ...p } } : s)),
      setPassHash: (h) => set((s) => (s.account ? { account: { ...s.account, passHash: h } } : s)),
      signOut: () => set({ account: null }),
    }),
    { name: "chatultra-account" }
  )
);

/** Downscale + crop a picked image to a square data URL (avatars / profile pics). */
export function compressImage(file: File, size = 256): Promise<string> {
  const dataUrl = new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return dataUrl.then(
    (dataUrl) =>
      new Promise<string>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          const min = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      })
  );
}

/** Hash the password locally (never stored in plain text, never leaves the browser). */
export async function hashPassword(pw: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`chatultra:${pw}`));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `fallback:${pw.length}:${pw.charCodeAt(0) ?? 0}`;
  }
}
