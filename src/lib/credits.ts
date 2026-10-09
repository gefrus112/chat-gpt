/**
 * ChatUltra credits — metered AI usage with a Stripe connector.
 *
 * Free public models (Luna 1, Dreamina 4, Seedance 1 Pro, Kling Omni) cost
 * zero credits for both text and video generation. Paid flagship models burn
 * credits per request; credits are topped up through Stripe Checkout
 * (server mode via the backend/ folder, or demo mode when static).
 */

import { useSettings } from "@/lib/store";
import { BUILT_IN_MODELS } from "@/lib/models";

export interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price: number;
  tag?: string;
  perks: string[];
}

export const CREDIT_PLANS: CreditPlan[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 500,
    price: 5,
    perks: ["500 credits", "All text models", "Standard video queue"],
  },
  {
    id: "pro",
    name: "Pro",
    credits: 2500,
    price: 20,
    tag: "Most popular",
    perks: ["2,500 credits", "Priority video queue", "Ultra effort unlocked"],
  },
  {
    id: "ultra",
    name: "Ultra",
    credits: 8000,
    price: 50,
    perks: ["8,000 credits", "Fastest video renders", "Agent + API access"],
  },
];

/** Credits burned per request, by model kind. Free public models are 0. */
export function creditCost(modelId: string, kind: "text" | "video" = "text"): number {
  const m = BUILT_IN_MODELS.find((x) => x.id === modelId);
  if (m?.free) return 0;
  if (kind === "video") return 40;
  return 5;
}

export interface CheckoutResult {
  ok: boolean;
  mode: "stripe" | "demo";
  message: string;
}

/**
 * Buy a credit plan. When the ChatUltra backend (backend/server.js) is
 * configured it creates a real Stripe Checkout session and opens it;
 * otherwise demo mode grants the credits locally so the flow stays usable.
 */
export async function buyPlan(plan: CreditPlan): Promise<CheckoutResult> {
  const { backendUrl, backendKey } = useSettings.getState().connections;

  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/credits/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(backendKey ? { Authorization: `Bearer ${backendKey}` } : {}),
        },
        body: JSON.stringify({ plan: plan.id, credits: plan.credits, amount: plan.price }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { url?: string; error?: string };
      if (j.url) {
        window.open(j.url, "_blank", "noopener");
        return { ok: true, mode: "stripe", message: `Stripe Checkout opened for the ${plan.name} plan.` };
      }
      throw new Error(j.error || "no checkout url returned");
    } catch (err) {
      return {
        ok: false,
        mode: "stripe",
        message: `Stripe checkout failed (${err instanceof Error ? err.message : "network"}) — check the backend URL in Settings > Connections.`,
      };
    }
  }

  // demo mode — no backend configured
  useSettings.getState().grantCredits(plan.credits);
  return {
    ok: true,
    mode: "demo",
    message: `Demo mode: ${plan.credits.toLocaleString()} credits added instantly. Connect the ChatUltra backend for real Stripe payments.`,
  };
}

/** Spend credits for a paid model request. Returns false when balance is short. */
export function charge(modelId: string, kind: "text" | "video" = "text"): { charged: number; ok: boolean } {
  const cost = creditCost(modelId, kind);
  if (cost === 0) return { charged: 0, ok: true };
  return { charged: cost, ok: useSettings.getState().spendCredits(cost) };
}
