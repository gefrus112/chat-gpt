"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp, Loader2, Square, Wrench, Gamepad2, Globe, Brain, Joystick } from "lucide-react";
import { Markdown, StudioContext } from "@/components/markdown";
import { ModelPicker, ModelIcon } from "@/components/model-picker";
import { PreviewPanel } from "@/components/preview-panel";
import type { SettingsTab } from "@/components/settings-dialog";
import { findEffort, type EffortDef, type ModelDef } from "@/lib/models";
import { demoReply, streamDemoReply } from "@/lib/demo-ai";
import { callClaude } from "@/lib/claude-direct";
import { useSettings } from "@/lib/store";
import { asset } from "@/lib/asset";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  effort?: string;
  streaming?: boolean;
}

interface ChatViewProps {
  models: ModelDef[];
  model: string;
  effort: string;
  conversationId: string | null;
  onModel: (id: string) => void;
  onEffort: (id: EffortDef["id"]) => void;
  onConversationCreated: (id: string) => void;
  onOpenSettings: (tab?: SettingsTab) => void;
}

const SUGGESTIONS: { icon: React.ReactNode; title: string; prompt: string }[] = [
  { icon: <Gamepad2 className="h-4 w-4 text-cyan-300" />, title: "Build a game", prompt: "Build a complete playable neon arcade game — a wave-based space shooter with powerups, score and restart. Give me the full single-file HTML." },
  { icon: <Globe className="h-4 w-4 text-violet-300" />, title: "Create a website", prompt: "Create a stunning dark-themed portfolio website for a game developer, single-file HTML with smooth animations and a hero section." },
  { icon: <Brain className="h-4 w-4 text-amber-300" />, title: "Explain anything", prompt: "Explain how neural networks learn, with a small interactive HTML visualization I can play with." },
  { icon: <Joystick className="h-4 w-4 text-rose-300" />, title: "Remix a classic", prompt: "Build a complete single-file HTML snake game with neon glow, wrap-around walls, increasing speed and a high-score counter." },
];

export function ChatView({ models, model, effort, conversationId, onModel, onEffort, onConversationCreated, onOpenSettings }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ code: string; title: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(conversationId);

  useEffect(() => {
    convRef.current = conversationId;
  }, [conversationId]);

  const currentModel = models.find((m) => m.id === model) ?? models[0];
  const eff = findEffort(effort);

  const openPreview = useCallback((code: string, title?: string) => {
    setPreview({ code, title: title ?? "Canvas" });
  }, []);

  // load conversation when switching
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let alive = true;
    fetch(`/api/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.conversation) return;
        setMessages(
          d.conversation.messages.map((m: { id: string; role: string; content: string; model?: string; effort?: string }) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            model: m.model,
            effort: m.effort,
          }))
        );
        if (d.conversation.model) onModel(d.conversation.model);
      })
      .catch(() => setMessages([]));
    return () => {
      alive = false;
    };
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput("");
    setBusy(true);

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg };
    const aiId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: aiId, role: "assistant", content: "", model, effort, streaming: true }]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let gotDelta = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, model, effort, conversationId: convRef.current }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.type === "meta" && evt.conversationId) {
              if (!convRef.current) {
                convRef.current = evt.conversationId;
                onConversationCreated(evt.conversationId);
              }
            } else if (evt.type === "delta") {
              gotDelta = true;
              setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, content: x.content + evt.text } : x)));
            } else if (evt.type === "error") {
              throw new Error(evt.error);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
              if (e.message.startsWith("HTTP") || e.message.includes("failed")) throw e;
            }
          }
        }
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (!aborted && !gotDelta) {
        // static hosting (e.g. GitHub Pages) has no backend — pick the best brain:
        // 1) real Claude via the Anthropic API when the model + key are available
        // 2) built-in demo brain otherwise
        const provider = currentModel?.provider;
        const anthropicKey = useSettings.getState().connections.anthropicKey;
        if (provider === "anthropic" && anthropicKey) {
          const sys =
            `You are ${currentModel?.name ?? "Claude"}, running inside ChatUltra, a dark Codex-style AI studio. ` +
            "Answer in Markdown, always wrap code in fenced blocks with a language tag, and for any web page, game or UI request " +
            "produce a COMPLETE single-file HTML document (inline CSS/JS) inside one ```html block. " +
            `Effort level: ${eff.label}. ${eff.directive}`;
          const turns = [
            ...messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: msg },
          ];
          const r = await callClaude(anthropicKey, turns, sys, 4096);
          if (r.ok && r.text) {
            await streamDemoReply(
              r.text,
              (text) => setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, content: text } : x))),
              ctrl.signal
            );
          } else {
            toast({ title: "Claude call failed — switched to the local engine", description: r.error });
            const reply = demoReply(msg);
            await streamDemoReply(
              reply,
              (text) => setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, content: text } : x))),
              ctrl.signal
            );
          }
        } else {
          if (provider === "anthropic" && !anthropicKey) {
            toast({
              title: "Demo engine",
              description: `Paste an Anthropic API key in Settings > Connections to chat with ${currentModel?.name} for real.`,
            });
          }
          const reply = demoReply(msg);
          await streamDemoReply(
            reply,
            (text) => setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, content: text } : x))),
            ctrl.signal
          );
        }
      } else {
        setMessages((m) =>
          m.map((x) =>
            x.id === aiId
              ? { ...x, content: x.content || (aborted ? "_stopped._" : `Error: ${err instanceof Error ? err.message : "Something went wrong — try again."}`) }
              : x
          )
        );
      }
    } finally {
      setMessages((m) => m.map((x) => (x.id === aiId ? { ...x, streaming: false } : x)));
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const onTaKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const fontCls = eff.id === "ultra" ? "text-zinc-300" : "";

  return (
    <StudioContext.Provider value={{ openPreview }}>
      <div className="flex h-full min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {messages.length === 0 ? (
            /* ---------- welcome ---------- */
            <div className="flex flex-1 flex-col items-center justify-center px-4">
              <div className={cn("relative mb-5", "animate-[nxPulse_4s_ease-in-out_infinite]")}>
                <Image
                  src={asset("/logo.png")}
                  alt="ChatUltra AI"
                  width={110}
                  height={110}
                  className="rounded-3xl border border-white/10 shadow-2xl shadow-cyan-500/20"
                  priority
                  unoptimized
                />
              </div>
              <h1 className="bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                ChatUltra
              </h1>
              <p className="mt-2 text-[13.5px] text-zinc-400">
                Chat · Build games · Ship to GitHub — your Codex-grade AI workspace
              </p>
              <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => send(s.prompt)}
                    className="group rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-left transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06]"
                  >
                    <div className="text-[13px] font-medium text-zinc-100">
                      <span className="mr-1.5">{s.icon}</span>
                      {s.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                      {s.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ---------- messages ---------- */
            <div ref={scrollRef} className="chatultra-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                    {m.role === "assistant" && (
                      <Image src={asset("/logo.png")} alt="ChatUltra" width={30} height={30} className="mt-0.5 h-[30px] w-[30px] rounded-xl border border-white/10" unoptimized />
                    )}
                    <div className={cn("min-w-0", m.role === "user" ? "max-w-[85%]" : "max-w-full flex-1")}>
                      {m.role === "user" ? (
                        <div className="rounded-2xl rounded-tr-md border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-2.5 text-[14px] leading-relaxed text-zinc-100 whitespace-pre-wrap">
                          {m.content}
                        </div>
                      ) : (
                        <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.02] px-4 py-2">
                          {m.content ? (
                            <Markdown content={m.content} className={fontCls} />
                          ) : (
                            <div className="flex items-center gap-2 py-1 text-[13px] text-zinc-400">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                              <span className="font-mono text-[12px]">{currentModel?.name} is thinking ({eff.label} effort)…</span>
                            </div>
                          )}
                          {!m.streaming && m.content && (
                            <div className="mt-1.5 flex items-center gap-2 border-t border-white/5 pt-1.5 text-[10.5px] text-zinc-600">
                              {m.model && <span className="font-mono">{m.model}</span>}
                              {m.effort && <span>· effort {m.effort}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {m.role === "user" && (
                      <div className="mt-0.5 flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-zinc-300">
                        You
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---------- composer ---------- */}
          <div className="shrink-0 px-4 pb-4">
            <div className="mx-auto max-w-3xl">
              <div className="rounded-2xl border border-white/10 bg-[#0c101c] p-2 shadow-xl shadow-black/40 transition focus-within:border-cyan-400/30">
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onTaKey}
                  rows={1}
                  placeholder="Ask ChatUltra to build, explain or ship anything…"
                  className="chatultra-scroll max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-500"
                  style={{ height: "auto" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 160) + "px";
                  }}
                />
                <div className="flex items-center gap-2 px-1 pb-0.5 pt-1">
                  <ModelPicker
                    models={models}
                    value={model}
                    effort={effort}
                    onSelect={onModel}
                    onEffort={onEffort}
                    onCreateCustom={() => onOpenSettings("models")}
                  />
                  <button
                    onClick={() => onOpenSettings("models")}
                    className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12px] text-zinc-300 transition hover:bg-white/[0.08] sm:flex"
                    title="Agent, Canvas & Video tools"
                  >
                    <Wrench className="h-3.5 w-3.5" /> Tools
                  </button>
                  <div className="ml-auto flex items-center gap-1.5">
                    {busy ? (
                      <button
                        onClick={stop}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                        title="Stop generating"
                      >
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => send()}
                        disabled={!input.trim()}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-xl transition",
                          input.trim()
                            ? "bg-gradient-to-br from-cyan-400 to-violet-500 text-black shadow-lg shadow-cyan-500/25 hover:brightness-110"
                            : "border border-white/10 bg-white/[0.04] text-zinc-600"
                        )}
                        title="Send"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-center text-[10.5px] text-zinc-600">
                ChatUltra can build games, preview HTML and push to GitHub · Effort: <span className="text-zinc-400">{eff.label}</span>
              </div>
            </div>
          </div>
        </div>

        {/* canvas / preview panel */}
        {preview && (
          <div className="hidden w-[46%] max-w-[720px] min-w-[380px] md:block">
            <PreviewPanel
              code={preview.code}
              onCodeChange={(c) => setPreview((p) => (p ? { ...p, code: c } : p))}
              title={preview.title}
              onClose={() => setPreview(null)}
            />
          </div>
        )}
      </div>
    </StudioContext.Provider>
  );
}
