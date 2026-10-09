"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, Plus, Sparkles, Check, Search, ExternalLink, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BUILT_IN_MODELS, EFFORTS, PROVIDER_LABEL, PROVIDER_URL, type EffortDef, type ModelDef } from "@/lib/models";
import { ClaudeIcon, GeminiIcon, LunaIcon, OpenAIIcon } from "@/components/brand-icons";
import { listCustomModels } from "@/lib/custom-models-client";
import { cn } from "@/lib/utils";

export function ModelIcon({ model, className, size = 28 }: { model: ModelDef; className?: string; size?: number }) {
  const cls = cn("shrink-0", className);
  const s = { width: size, height: size };
  if (model.provider === "custom" && (model as ModelDef & { avatar?: string | null }).avatar) {
    return (
      <Image
        src={(model as ModelDef & { avatar?: string | null }).avatar as string}
        alt={model.name}
        width={size}
        height={size}
        className={cn(cls, "rounded-lg object-cover")}
        style={s}
        unoptimized
      />
    );
  }
  const inner = { width: size * 0.62, height: size * 0.62 };
  switch (model.provider) {
    case "openai":
      return (
        <span className={cn(cls, "flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]")} style={s}>
          <OpenAIIcon style={inner} className="text-zinc-100" />
        </span>
      );
    case "anthropic":
      return (
        <span className={cn(cls, "flex items-center justify-center rounded-lg border border-orange-400/20 bg-orange-950/40")} style={s}>
          <ClaudeIcon style={inner} className="text-[#D97757]" />
        </span>
      );
    case "google":
      return (
        <span className={cn(cls, "flex items-center justify-center rounded-lg border border-violet-400/20 bg-violet-950/40")} style={s}>
          <GeminiIcon style={inner} className="text-violet-300" />
        </span>
      );
    case "luna":
      return (
        <span className={cn(cls, "flex items-center justify-center rounded-lg border border-fuchsia-400/20 bg-fuchsia-950/40")} style={s}>
          <LunaIcon style={inner} />
        </span>
      );
    case "local":
      return (
        <span
          className={cn(cls, "flex items-center justify-center rounded-lg border font-bold", model.tile ?? "bg-white/[0.06] text-zinc-300 border-white/10")}
          style={s}
        >
          <span style={{ fontSize: size * 0.42 }}>{model.name.slice(0, 1)}</span>
        </span>
      );
    default:
      return (
        <span className={cn(cls, "flex items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-950/40 text-cyan-300 font-bold")} style={s}>
          {model.name.slice(0, 1).toUpperCase()}
        </span>
      );
  }
}

export function EffortBars({ effort, className }: { effort: EffortDef; className?: string }) {
  return (
    <span className={cn("flex items-end gap-[2px]", className)} aria-label={`effort ${effort.label}`}>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <i
          key={n}
          className={cn("w-[3px] rounded-sm transition-all", n <= effort.bars ? "bg-current" : "bg-current opacity-20")}
          style={{ height: 3 + n * 1.6 }}
        />
      ))}
    </span>
  );
}

interface ModelPickerProps {
  models: ModelDef[];
  value: string;
  effort: string;
  onSelect: (id: string) => void;
  onEffort: (id: EffortDef["id"]) => void;
  onCreateCustom: () => void;
  onEditCustom?: () => void;
}

export function ModelPicker({ models, value, effort, onSelect, onEffort, onCreateCustom, onEditCustom }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = models.find((m) => m.id === value) ?? models[0];
  const eff = EFFORTS.find((e) => e.id === effort) ?? EFFORTS[2];

  // group models by provider preserving order
  const groups = useMemo(() => {
    const gs: { provider: string; models: ModelDef[] }[] = [];
    const q = query.trim().toLowerCase();
    for (const m of models) {
      if (q && !(`${m.name} ${m.tagline} ${m.provider}`.toLowerCase().includes(q))) continue;
      const g = gs.find((x) => x.provider === m.provider);
      if (g) g.models.push(m);
      else gs.push({ provider: m.provider, models: [m] });
    }
    return gs;
  }, [models, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(() => setQuery(""), 150);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex max-w-[280px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-left transition",
            "hover:border-white/20 hover:bg-white/[0.08]"
          )}
        >
          <ModelIcon model={current} size={22} className="rounded-md" />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium text-zinc-100">{current?.name}</span>
          </span>
          <span className="hidden items-center gap-1.5 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-300 sm:flex">
            <EffortBars effort={eff} />
            {eff.label}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[380px] border-white/10 bg-[#0c101c] p-0 shadow-2xl shadow-black/60">
        {/* search models */}
        <div className="border-b border-white/[0.07] p-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-1.5 chatultra-scroll">
          {groups.length === 0 && <div className="px-3 py-6 text-center text-[12.5px] text-zinc-500">No models match &quot;{query}&quot;</div>}
          {groups.map((g) => (
            <div key={g.provider} className="mb-1">
              <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {PROVIDER_LABEL[g.provider as keyof typeof PROVIDER_LABEL] ?? g.provider}
              </div>
              {g.models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelect(m.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    m.id === value ? "bg-cyan-400/10" : "hover:bg-white/[0.06]"
                  )}
                >
                  <ModelIcon model={m} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-zinc-100">{m.name}</span>
                      {m.badge && (
                        <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-cyan-300">
                          {m.badge}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">{m.tagline}</span>
                  </span>
                  {/* hover actions — provider link / edit custom model */}
                  <span className="hidden shrink-0 items-center gap-1 group-hover:flex">
                    {m.provider === "custom" ? (
                      <span
                        role="button"
                        tabIndex={0}
                        title="More Options — edit your model"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          onEditCustom?.();
                        }}
                        onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), setOpen(false), onEditCustom?.())}
                        className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                    {PROVIDER_URL[m.provider as keyof typeof PROVIDER_URL] && (
                      <a
                        href={PROVIDER_URL[m.provider as keyof typeof PROVIDER_URL]}
                        target="_blank"
                        rel="noreferrer"
                        title="Provider options"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </span>
                  {m.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-cyan-300 group-hover:hidden" />}
                </button>
              ))}
            </div>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onCreateCustom();
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[13px] text-zinc-300 transition hover:bg-white/[0.06] hover:text-cyan-200"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.05]">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <span>Add New Models Provider...</span>
          </button>
        </div>
        <div className="border-t border-white/10 p-2">
          <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Reasoning effort</div>
          <div className="grid grid-cols-3 gap-1">
            {EFFORTS.map((e) => (
              <button
                key={e.id}
                onClick={() => onEffort(e.id)}
                title={e.hint}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition",
                  e.id === effort
                    ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                    : "border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                )}
              >
                <EffortBars effort={e} />
                <span className="text-[11px] font-medium">{e.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ModelBadge({ model }: { model: ModelDef }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-zinc-300">
      <ModelIcon model={model} size={16} className="rounded-[5px]" />
      {model.name}
      <Sparkles className="h-3 w-3 text-zinc-500" />
    </span>
  );
}

/** helper hook to load custom models (server API with localStorage fallback) */
export function useCustomModels(refreshKey: number) {
  const [models, setModels] = useState<(ModelDef & { avatar?: string | null })[]>([]);
  useEffect(() => {
    let alive = true;
    listCustomModels()
      .then((list) => {
        if (!alive) return;
        setModels(
          list.map((m) => ({
            id: `custom:${m.id}`,
            name: m.name,
            provider: "custom" as const,
            tagline: m.tagline || `Custom · base ${m.baseModel}`,
            badge: "Custom",
            avatar: m.avatar,
            flavor: m.systemPrompt || "",
          }))
        );
      })
      .catch(() => setModels([]));
    return () => {
      alive = false;
    };
  }, [refreshKey]);
  return models;
}
