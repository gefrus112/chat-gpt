"use client";

import { useState } from "react";
import Image from "next/image";
import { Bot, Check, ChevronDown, CircleDot, Loader2, Play, Square, Image as ImageIcon } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Step {
  title: string;
  detail: string;
  output: string;
}

interface StepResult {
  title: string;
  output: string;
  result: string;
  image?: string; // data url
  running?: boolean;
  done?: boolean;
}

export function AgentView() {
  const [goal, setGoal] = useState("");
  const [planning, setPlanning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [results, setResults] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);
  const [stopFlag, setStopFlag] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const plan = async () => {
    if (!goal.trim() || planning) return;
    setPlanning(true);
    setSteps([]);
    setResults([]);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan", goal }),
      });
      const j = await res.json();
      setSteps(Array.isArray(j.steps) ? j.steps : []);
      setResults([]);
    } catch {
      setSteps([]);
    } finally {
      setPlanning(false);
    }
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    setStopFlag(false);
    const history: { step: number; title: string; result: string }[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (stopFlag) break;
      const step = steps[i];
      setResults((r) => {
        const next = [...r];
        next[i] = { title: step.title, output: step.output, result: "", running: true };
        return next;
      });
      setOpenIdx(i);
      try {
        if (step.output === "image") {
          const res = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: `${goal} — ${step.title}. ${step.detail}`, frames: 1, style: "neon" }),
          });
          const j = await res.json();
          const b64 = j?.frames?.[0]?.base64;
          setResults((r) => {
            const next = [...r];
            next[i] = {
              title: step.title,
              output: step.output,
              result: `Generated illustration for: ${step.detail}`,
              image: b64 ? `data:image/png;base64,${b64}` : undefined,
              done: true,
            };
            return next;
          });
          history.push({ step: i + 1, title: step.title, result: `[generated image] ${step.detail}` });
        } else {
          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "step", goal, steps, index: i, history }),
          });
          const j = await res.json();
          const result = j.result ?? "(no result)";
          setResults((r) => {
            const next = [...r];
            next[i] = { title: step.title, output: step.output, result, done: true };
            return next;
          });
          history.push({ step: i + 1, title: step.title, result });
        }
      } catch {
        setResults((r) => {
          const next = [...r];
          next[i] = { title: step.title, output: step.output, result: "⚠️ step failed — continuing", done: true };
          return next;
        });
      }
    }
    setRunning(false);
  };

  const doneCount = results.filter((r) => r.done).length;

  return (
    <div className="chatultra-scroll h-full min-h-0 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
            <Bot className="h-5.5 w-5.5 text-violet-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">ChatUltra Agent</h2>
            <p className="text-[12px] text-zinc-500">Give a goal — the agent plans the steps and executes them one by one.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c101c] p-3">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="e.g. Design and launch a landing page for my synthwave game, including assets and copy"
            className="w-full resize-none bg-transparent px-2 py-1 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <div className="mt-1 flex items-center gap-2">
            <Button
              onClick={plan}
              disabled={planning || !goal.trim() || running}
              className="h-8 gap-1.5 bg-violet-500/20 text-[12.5px] text-violet-100 hover:bg-violet-500/30"
            >
              {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CircleDot className="h-3.5 w-3.5" />}
              Plan
            </Button>
            {steps.length > 0 && !running && (
              <Button onClick={runAll} className="h-8 gap-1.5 bg-gradient-to-r from-cyan-400 to-violet-500 text-[12.5px] font-medium text-black hover:brightness-110">
                <Play className="h-3.5 w-3.5" /> Execute plan ({steps.length} steps)
              </Button>
            )}
            {running && (
              <Button onClick={() => setStopFlag(true)} variant="outline" className="h-8 gap-1.5 border-rose-400/30 text-[12.5px] text-rose-300">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            {results.length > 0 && (
              <span className="ml-auto font-mono text-[11px] text-zinc-500">
                {doneCount}/{steps.length} steps complete
              </span>
            )}
          </div>
        </div>

        {steps.length > 0 && (
          <div className="mt-3">
            <Progress value={(doneCount / steps.length) * 100} className="h-1.5 bg-white/5 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-violet-500" />
          </div>
        )}

        {/* plan checklist */}
        {steps.length > 0 && (
          <div className="mt-4 space-y-2">
            {steps.map((s, i) => {
              const r = results[i];
              return (
                <div
                  key={i}
                  className={cn(
                    "overflow-hidden rounded-xl border transition",
                    r?.running ? "border-cyan-400/40 bg-cyan-400/[0.05]" : r?.done ? "border-emerald-400/20 bg-emerald-400/[0.03]" : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <button
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                        r?.done ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : r?.running ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-300" : "border-white/15 text-zinc-500"
                      )}
                    >
                      {r?.done ? <Check className="h-3 w-3" /> : r?.running ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium text-zinc-100">{s.title}</span>
                      <span className="block truncate text-[11.5px] text-zinc-500">{s.detail}</span>
                    </span>
                    {s.output === "image" && <ImageIcon className="h-3.5 w-3.5 text-violet-300" />}
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-zinc-600 transition", openIdx === i && "rotate-180")} />
                  </button>
                  {openIdx === i && r?.result && (
                    <div className="border-t border-white/5 bg-black/20 px-4 py-2">
                      {r.image && <Image src={r.image} alt={s.title} width={672} height={384} className="mb-2 rounded-lg border border-white/10" unoptimized />}
                      <Markdown content={r.result} className="text-[13px]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {planning && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" /> Agent is planning…
          </div>
        )}
      </div>
    </div>
  );
}
