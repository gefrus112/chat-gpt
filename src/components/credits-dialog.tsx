"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/store";
import { CREDIT_PLANS, buyPlan, creditCost, type CreditPlan } from "@/lib/credits";
import { BUILT_IN_MODELS } from "@/lib/models";
import { StripeIcon, SupabaseIcon, CloudflareIcon } from "@/components/brand-icons";
import { Loader2, CheckCircle2, XCircle, Zap, Clapperboard, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CreditsDialog({ open, onOpenChange }: CreditsDialogProps) {
  const credits = useSettings((s) => s.credits);
  const connections = useSettings((s) => s.connections);
  const [buying, setBuying] = useState<string | null>(null);
  const [result, setResult] = useState<{ plan: string; ok: boolean; msg: string } | null>(null);

  const buy = async (plan: CreditPlan) => {
    setBuying(plan.id);
    setResult(null);
    const r = await buyPlan(plan);
    setBuying(null);
    setResult({ plan: plan.name, ok: r.ok, msg: r.message });
    if (r.ok) {
      toast({ title: `${plan.name} plan — ${r.mode === "stripe" ? "Stripe" : "demo"} flow`, description: r.message });
    }
  };

  const paidText = BUILT_IN_MODELS.filter((m) => !m.free && m.kind !== "video");
  const paidVideo = BUILT_IN_MODELS.filter((m) => m.kind === "video");
  const freeModels = BUILT_IN_MODELS.filter((m) => m.free);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden border-white/10 bg-[#0c101c] p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px] text-white">
            <Zap className="h-4 w-4 text-amber-300" /> Credits &amp; billing
          </DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            Metered AI usage — free public models for text and video, credits for flagships, Stripe checkout.
          </DialogDescription>
        </DialogHeader>

        <div className="chatultra-scroll max-h-[calc(85vh-90px)] overflow-y-auto px-5 py-4">
          {/* balance */}
          <div className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-widest text-amber-300/80">Balance</div>
              <div className="text-2xl font-bold text-amber-200 tabular-nums">{credits.balance.toLocaleString()}</div>
            </div>
            <div className="text-right text-[11px] text-zinc-500">
              <div>bought · {credits.totalBought.toLocaleString()}</div>
              <div>spent · {credits.totalSpent.toLocaleString()}</div>
            </div>
          </div>

          {/* plans */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {CREDIT_PLANS.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-xl border p-3.5 transition",
                  p.tag ? "border-cyan-400/30 bg-cyan-400/[0.05]" : "border-white/10 bg-white/[0.02] hover:border-white/20"
                )}
              >
                {p.tag && (
                  <span className="absolute -top-2 left-3 rounded-full border border-cyan-400/40 bg-[#0c101c] px-2 py-px text-[9px] font-semibold uppercase tracking-wide text-cyan-300">
                    {p.tag}
                  </span>
                )}
                <div className="text-[13px] font-semibold text-zinc-100">{p.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">${p.price}</span>
                  <span className="text-[11px] text-zinc-500">/ {p.credits.toLocaleString()} credits</span>
                </div>
                <ul className="mt-2.5 flex-1 space-y-1 text-[11px] text-zinc-400">
                  {p.perks.map((x) => (
                    <li key={x} className="flex items-start gap-1.5">
                      <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-400" /> {x}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => buy(p)}
                  disabled={buying !== null}
                  className="mt-3 h-8 w-full gap-1.5 bg-[#635bff] text-[12px] font-medium text-white hover:bg-[#7a6fff]"
                >
                  {buying === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <StripeIcon className="h-3.5 w-3.5" />}
                  Pay with Stripe
                </Button>
              </div>
            ))}
          </div>

          {result && (
            <div
              className={cn(
                "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]",
                result.ok ? "border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-200" : "border-rose-400/20 bg-rose-400/[0.05] text-rose-200"
              )}
            >
              {result.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>
                <span className="font-medium">{result.plan}:</span> {result.msg}
              </span>
            </div>
          )}

          {/* pricing */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <MessageSquare className="h-3.5 w-3.5" /> Text requests
              </div>
              <div className="mt-1.5 text-[12px] text-zinc-300">Free models · <span className="text-emerald-300">0 credits</span></div>
              <div className="text-[12px] text-zinc-300">Flagships · <span className="text-amber-300">5 credits</span></div>
              <div className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">{paidText.map((m) => m.name).join(", ")}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                <Clapperboard className="h-3.5 w-3.5" /> Video generation
              </div>
              <div className="mt-1.5 text-[12px] text-zinc-300">Public video models · <span className="text-emerald-300">0 credits</span></div>
              <div className="text-[12px] text-zinc-300">Priority queue · <span className="text-amber-300">40 credits</span></div>
              <div className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">{paidVideo.map((m) => m.name).join(", ")} — free for everyone</div>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Free public models</div>
              <div className="mt-1.5 text-[12px] text-zinc-300">{freeModels.map((m) => m.name).join(", ")}</div>
              <div className="mt-1.5 text-[10.5px] leading-relaxed text-zinc-500">
                Text and video generation on these public models is free — no credits ever.
              </div>
            </div>
          </div>

          {/* connector status */}
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-zinc-400">
            <div className="flex items-center gap-2">
              <StripeIcon className="h-3.5 w-3.5 text-[#7a6fff]" />
              <span className="text-zinc-200">Stripe connector:</span>
              {connections.backendUrl ? (
                <span className="text-emerald-300">live — checkout sessions created by your backend</span>
              ) : (
                <span className="text-amber-300">demo mode — add the ChatUltra backend URL in Settings &gt; Connections for real payments</span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <SupabaseIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-zinc-200">Supabase:</span>
              {connections.supabaseUrl ? <span className="text-emerald-300">configured — account cloud sync active</span> : <span className="text-zinc-500">not configured (accounts stay on this device)</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <CloudflareIcon className="h-3.5 w-3.5 text-orange-400" />
              <span className="text-zinc-200">Cloudflare Turnstile:</span>
              {connections.turnstileSiteKey ? <span className="text-emerald-300">protecting account signup</span> : <span className="text-zinc-500">not configured</span>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
