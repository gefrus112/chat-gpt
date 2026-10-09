"use client";

import { useEffect, useRef, useState } from "react";
import { Clapperboard, Download, Loader2, Pause, Play, ExternalLink, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Frame {
  index: number;
  base64: string;
}

const STYLES = [
  { id: "cinematic", label: "Cinematic" },
  { id: "anime", label: "Anime" },
  { id: "neon", label: "Neon Punk" },
  { id: "nature", label: "Nature" },
  { id: "retro", label: "Retro Wave" },
  { id: "space", label: "Deep Space" },
];

const IDEAS = [
  "A lone astronaut walking through a glowing alien jungle",
  "A neon-lit street race through future Tokyo at night",
  "A hummingbird made of light flying over a crystal desert",
  "A viking longship sailing into a storm of auroras",
];

export function VideoView() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cinematic");
  const [frameCount, setFrameCount] = useState(4);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (playing && frames.length > 1) {
      timerRef.current = setInterval(() => setIdx((i) => (i + 1) % frames.length), 900);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, frames.length]);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setFrames([]);
    setIdx(0);
    setPlaying(false);
    const est = frameCount * 15;
    setProgressText(`Rendering ${frameCount} frames… (~${est}s)`);
    try {
      const res = await fetch("/api/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, frames: frameCount, style }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "generation failed");
      setFrames(j.frames ?? []);
      setProgressText(`Done — ${j.frames.length} frames`);
      setPlaying(true);
      toast({ title: "AI video ready 🎬", description: `${j.frames.length} frames · ${style}` });
    } catch (err) {
      setProgressText("");
      toast({ title: "Video generation failed", description: err instanceof Error ? err.message : "try again" });
    } finally {
      setLoading(false);
    }
  };

  const openPlayerWindow = () => {
    if (!frames.length) return;
    const payload = JSON.stringify(frames.map((f) => `data:image/png;base64,${f.base64}`));
    const w = window.open("", "_blank", "noopener,width=1200,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>ChatUltra AI Video</title><style>body{margin:0;background:#05070d;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:monospace;color:#22d3ee}img{max-width:92%;max-height:82%;border-radius:12px;box-shadow:0 0 60px rgba(34,211,238,.25)}button{margin-top:14px;background:#22d3ee22;border:1px solid #22d3ee55;color:#a5f3fc;padding:8px 20px;border-radius:8px;cursor:pointer}</style></head><body><img id="f"><button id="b">⏸ Pause</button><script>var fr=${payload};var i=0;var on=true;setInterval(function(){if(on){document.getElementById('f').src=fr[i];i=(i+1)%fr.length}},900);document.getElementById('b').onclick=function(){on=!on;this.textContent=on?'⏸ Pause':'▶ Play'};document.getElementById('f').src=fr[0]</script></body></html>`);
    w.document.close();
  };

  const downloadFrames = () => {
    frames.forEach((f, i) => {
      const a = document.createElement("a");
      a.href = `data:image/png;base64,${f.base64}`;
      a.download = `chatultra-video-frame-${i + 1}.png`;
      a.click();
    });
  };

  return (
    <div className="chatultra-scroll h-full min-h-0 overflow-y-auto p-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10">
            <Clapperboard className="h-5 w-5 text-fuchsia-300" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">AI Video Studio</h2>
            <p className="text-[12px] text-zinc-500">Describe a scene — ChatUltra renders a keyframe sequence you can play & export.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0c101c] p-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            placeholder="Describe your video scene…"
            className="w-full resize-none bg-transparent px-2 py-1 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] transition",
                    style === s.id ? "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200" : "border-white/10 text-zinc-400 hover:bg-white/5"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11.5px] text-zinc-500">frames</span>
              <Slider value={[frameCount]} min={2} max={6} step={1} onValueChange={([v]) => setFrameCount(v)} className="w-24" />
              <span className="w-4 font-mono text-[12px] text-zinc-300">{frameCount}</span>
            </div>
            <Button
              onClick={generate}
              disabled={loading || !prompt.trim()}
              className="h-8 gap-1.5 bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-[12.5px] font-medium text-black hover:brightness-110"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
              {loading ? "Rendering…" : "Generate video"}
            </Button>
          </div>
        </div>

        {!prompt && !loading && (
          <div className="mt-4 flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => setPrompt(idea)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-zinc-400 transition hover:border-fuchsia-400/30 hover:text-fuchsia-200"
              >
                {idea}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-6 flex flex-col items-center gap-2 text-[13px] text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-fuchsia-300" />
            {progressText}
          </div>
        )}

        {frames.length > 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0a0e18] p-3">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
              <img
                src={`data:image/png;base64,${frames[idx]?.base64 ?? ""}`}
                alt={`frame ${idx + 1}`}
                className="max-h-[420px] w-full object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-all"
                    style={{ width: `${((idx + 1) / frames.length) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-zinc-300">
                  {idx + 1}/{frames.length} · 1.1 fps
                </span>
              </div>
            </div>
            <div className="chatultra-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
              {frames.map((f, i) => (
                <button
                  key={f.index}
                  onClick={() => {
                    setIdx(i);
                    setPlaying(false);
                  }}
                  className={cn(
                    "relative h-14 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition",
                    i === idx ? "border-fuchsia-400" : "border-white/10 opacity-60 hover:opacity-100"
                  )}
                >
                  <img src={`data:image/png;base64,${f.base64}`} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex justify-end gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-zinc-300" onClick={downloadFrames}>
                <Download className="h-3 w-3" /> Frames
              </Button>
              <Button size="sm" className="h-7 gap-1 bg-fuchsia-500/20 text-[12px] text-fuchsia-200 hover:bg-fuchsia-500/30" onClick={openPlayerWindow}>
                <ExternalLink className="h-3 w-3" /> Play in new window
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
