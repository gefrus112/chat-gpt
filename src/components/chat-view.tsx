"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUp,
  Loader2,
  Square,
  Gamepad2,
  Globe,
  Brain,
  Joystick,
  SlidersHorizontal,
  SquareTerminal,
  Paperclip,
  MoreHorizontal,
  Mic,
  MessageSquarePlus,
  Download,
  FolderGit2,
  CircleUserRound,
  Settings,
  TerminalSquare,
  Clapperboard,
  Zap,
} from "lucide-react";
import { Markdown, StudioContext } from "@/components/markdown";
import { ModelPicker, EffortBars } from "@/components/model-picker";
import { PreviewPanel } from "@/components/preview-panel";
import { ChatTerminal } from "@/components/chat-terminal";
import { ChatShell, resultToText } from "@/lib/shell";
import type { SettingsTab } from "@/components/settings-dialog";
import { findEffort, EFFORTS, PROVIDER_LABEL, type EffortDef, type ModelDef } from "@/lib/models";
import { demoReply, streamDemoReply, demoVideoCard } from "@/lib/demo-ai";
import { callClaude } from "@/lib/claude-direct";
import { useSettings, ACCENTS } from "@/lib/store";
import { backendGenerate } from "@/lib/cloud";
import { charge } from "@/lib/credits";
import { asset } from "@/lib/asset";
import { toast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  effort?: string;
  streaming?: boolean;
  /** command execution card (slash commands / shell runs) */
  kind?: "command" | "video";
  cmd?: string;
  output?: string;
  ok?: boolean;
  /** video generation result card */
  video?: {
    model: string;
    videoUrl?: string;
    poster?: string;
    storyboard?: string[];
    demo: boolean;
    free: boolean;
  };
}

interface ChatViewProps {
  models: ModelDef[];
  model: string;
  effort: string;
  conversationId: string | null;
  terminalSignal: number;
  onModel: (id: string) => void;
  onEffort: (id: EffortDef["id"]) => void;
  onConversationCreated: (id: string) => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onOpenAccount: () => void;
  onOpenCredits: () => void;
  onNewChat: () => void;
}

const SUGGESTIONS: { icon: React.ReactNode; title: string; prompt: string }[] = [
  { icon: <Gamepad2 className="h-4 w-4 text-cyan-300" />, title: "Build a game", prompt: "Build a complete playable neon arcade game — a wave-based space shooter with powerups, score and restart. Give me the full single-file HTML." },
  { icon: <Clapperboard className="h-4 w-4 text-pink-300" />, title: "Generate a video", prompt: "Render a cinematic video: a neon jellyfish drifting through a deep ocean trench, volumetric light rays, slow motion" },
  { icon: <Globe className="h-4 w-4 text-violet-300" />, title: "Create a website", prompt: "Create a stunning dark-themed portfolio website for a game developer, single-file HTML with smooth animations and a hero section." },
  { icon: <Brain className="h-4 w-4 text-amber-300" />, title: "Explain anything", prompt: "Explain how neural networks learn, with a small interactive HTML visualization I can play with." },
];

const SLASH_COMMANDS: { name: string; desc: string }[] = [
  { name: "/help", desc: "Show all slash commands" },
  { name: "/models", desc: "List every loaded AI model" },
  { name: "/model <name>", desc: "Switch model — /model opus" },
  { name: "/effort <level>", desc: "low medium high extra max ultra" },
  { name: "/run <cmd>", desc: "Run a shell command — /run neofetch" },
  { name: "/terminal", desc: "Open the built-in terminal" },
  { name: "/ls", desc: "List project files" },
  { name: "/cat <file>", desc: "Print a project file" },
  { name: "/npm <args>", desc: "npm install, npm run dev..." },
  { name: "/git <sub>", desc: "git status, git log, git push" },
  { name: "/web", desc: "Toggle web access for replies" },
  { name: "/game <desc>", desc: "Build a playable game from a description" },
  { name: "/video <desc>", desc: "Generate a video with the picked video model" },
  { name: "/credits", desc: "Open credits and the Stripe connector" },
  { name: "/export", desc: "Download this chat as Markdown" },
  { name: "/push", desc: "Open GitHub push settings" },
  { name: "/account", desc: "Open your account profile" },
  { name: "/settings", desc: "Open settings" },
  { name: "/theme <accent>", desc: "cyan violet emerald amber rose sky" },
  { name: "/clear", desc: "Start a fresh chat" },
];

const ARGLESS = new Set(["/help", "/models", "/terminal", "/ls", "/web", "/export", "/push", "/account", "/settings", "/clear", "/credits"]);

export function ChatView({ models, model, effort, conversationId, terminalSignal, onModel, onEffort, onConversationCreated, onOpenSettings, onOpenAccount, onOpenCredits, onNewChat }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ code: string; title: string } | null>(null);
  const [termOpen, setTermOpen] = useState(false);
  const [webAccess, setWebAccess] = useState(false);
  const [listening, setListening] = useState(false);
  const [effortOpen, setEffortOpen] = useState(false);
  const [slashSel, setSlashSel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convRef = useRef<string | null>(conversationId);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  const shellRef = useRef<ChatShell | null>(null);
  if (!shellRef.current) shellRef.current = new ChatShell();
  const shell = shellRef.current;

  const gh = useSettings((s) => s.gh);
  const setAppearance = useSettings((s) => s.setAppearance);
  const appearance = useSettings((s) => s.appearance);
  const creditBalance = useSettings((s) => s.credits.balance);

  useEffect(() => {
    convRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    shell.setModelsProvider(() => models.map((m) => `${m.name} (${PROVIDER_LABEL[m.provider] ?? m.provider})`));
  }, [models, shell]);

  // rail / sidebar terminal button opens the drawer
  useEffect(() => {
    if (terminalSignal > 0) setTermOpen(true);
  }, [terminalSignal]);

  // Ctrl+` toggles the terminal drawer
  useEffect(() => {
    const onWin = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        setTermOpen((t) => !t);
      }
    };
    window.addEventListener("keydown", onWin);
    return () => window.removeEventListener("keydown", onWin);
  }, []);

  const currentModel = models.find((m) => m.id === model) ?? models[0];
  const eff = findEffort(effort);

  const openPreview = useCallback((code: string, title?: string) => {
    setPreview({ code, title: title ?? "Canvas" });
  }, []);

  const runCommand = useCallback(
    async (cmd: string): Promise<string> => resultToText(await shell.run(cmd)),
    [shell]
  );

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

  /* ---------------- slash commands ---------------- */

  const appendCommand = (cmd: string, output: string, ok = true) => {
    setMessages((m) => [...m, { id: `c-${Date.now()}`, role: "user", kind: "command", cmd, output, ok, content: "" }]);
  };

  const handleSlash = async (raw: string) => {
    const text = raw.trim();
    const [name, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ").trim();

    switch (name) {
      case "/help":
        appendCommand(
          name,
          "ChatUltra commands:\n" + SLASH_COMMANDS.map((c) => `  ${c.name.padEnd(18)} ${c.desc}`).join("\n") +
            "\n\nShell commands (use /run or the terminal): ls cd cat echo touch mkdir rm run build git npm node python ps df uname neofetch whoami date history"
        );
        return;
      case "/models":
        appendCommand(name, "loaded models:\n" + models.map((m) => `  - ${m.name} (${PROVIDER_LABEL[m.provider] ?? m.provider})${m.id === model ? "  [active]" : ""}`).join("\n"));
        return;
      case "/model": {
        const q = arg.toLowerCase();
        const hit = models.find((m) => m.id === arg || m.name.toLowerCase() === q) ?? models.find((m) => m.name.toLowerCase().includes(q) && q.length > 0);
        if (!hit) {
          appendCommand(text, `model not found: "${arg}"\navailable:\n` + models.map((m) => `  - ${m.name}`).join("\n"), false);
          return;
        }
        onModel(hit.id);
        appendCommand(text, `[ok] switched to ${hit.name}`);
        return;
      }
      case "/effort": {
        const e = EFFORTS.find((x) => x.id === arg.toLowerCase());
        if (!e) {
          appendCommand(text, `unknown effort "${arg}" — levels: ${EFFORTS.map((x) => x.id).join(", ")}`, false);
          return;
        }
        onEffort(e.id);
        appendCommand(text, `[ok] reasoning effort set to ${e.label}`);
        return;
      }
      case "/run":
        if (!arg) {
          appendCommand(name, "usage: /run <command> — try /run neofetch", false);
          return;
        }
        appendCommand(arg, resultToText(await shell.run(arg)));
        return;
      case "/ls":
        appendCommand(name, resultToText(await shell.run("ls")));
        return;
      case "/cat":
        if (!arg) {
          appendCommand(name, "usage: /cat <file> — try /cat README.md", false);
          return;
        }
        appendCommand(`${name} ${arg}`, resultToText(await shell.run(`cat ${arg}`)));
        return;
      case "/npm":
        appendCommand(text, resultToText(await shell.run(`npm ${arg || "--help"}`.trim())));
        return;
      case "/git":
        if (!arg) {
          appendCommand(name, "usage: /git <status|log|push>", false);
          return;
        }
        appendCommand(text, resultToText(await shell.run(`git ${arg}`)));
        return;
      case "/terminal":
        setTermOpen(true);
        appendCommand(name, "[ok] terminal opened — type `help` inside");
        return;
      case "/web":
        setWebAccess((w) => {
          appendCommand(name, `[ok] web access ${!w ? "enabled" : "disabled"}`);
          return !w;
        });
        return;
      case "/game":
        appendCommand(name, arg ? `[ok] building game: ${arg}` : "usage: /game <description> — try /game neon pong", Boolean(arg));
        if (arg) send(`Build a complete playable single-file HTML game: ${arg}. Full HTML in one code block.`);
        return;
      case "/video": {
        const vm = models.find((m) => m.kind === "video");
        if (!arg) {
          appendCommand(name, `usage: /video <description> — try /video neon jellyfish drifting${vm ? ` (current video model: ${vm.name})` : ""}`, false);
          return;
        }
        appendCommand(name, `[ok] queued video render on ${currentModel?.kind === "video" ? currentModel.name : vm?.name ?? "video engine"}: ${arg}`);
        await generateVideo(arg, currentModel?.kind === "video" ? model : vm?.id ?? "kling-omni");
        return;
      }
      case "/credits":
        onOpenCredits();
        appendCommand(name, "[ok] opening credits — free public models cost 0");
        return;
      case "/export": {
        const md =
          "# ChatUltra chat export\n\n" +
          messages
            .map((m) =>
              m.kind === "command"
                ? `\`\`\`console\n$ ${m.cmd}\n${m.output ?? ""}\n\`\`\``
                : `**${m.role === "user" ? "You" : m.model || "ChatUltra"}**\n\n${m.content}`
            )
            .join("\n\n---\n\n");
        try {
          const blob = new Blob([md], { type: "text/markdown" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "chatultra-chat.md";
          a.click();
          URL.revokeObjectURL(a.href);
          appendCommand(name, "[ok] exported chatultra-chat.md");
        } catch {
          appendCommand(name, "[err] export failed in this browser", false);
        }
        return;
      }
      case "/push":
        onOpenSettings("github");
        appendCommand(name, "[ok] opening GitHub settings — token + repo are prefilled");
        return;
      case "/account":
        onOpenAccount();
        appendCommand(name, "[ok] opening account profile");
        return;
      case "/settings":
        onOpenSettings("appearance");
        appendCommand(name, "[ok] opening settings");
        return;
      case "/theme": {
        const a = ACCENTS.find((x) => x.id === arg.toLowerCase());
        if (!a) {
          appendCommand(text, `unknown accent "${arg}" — options: ${ACCENTS.map((x) => x.id).join(", ")}`, false);
          return;
        }
        setAppearance({ accent: a.hex });
        appendCommand(text, `[ok] accent set to ${a.label} (${a.hex})`);
        return;
      }
      case "/clear":
        onNewChat();
        return;
      default:
        appendCommand(name, `unknown command: ${name} — type /help`, false);
    }
  };

  /* ---------------- send ---------------- */

  /* ---------------- video generation ---------------- */

  const generateVideo = async (prompt: string, videoModelId: string) => {
    const videoModel = models.find((m) => m.id === videoModelId);
    const videoId = `v-${Date.now()}`;
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: prompt },
      { id: videoId, role: "assistant", kind: "video", content: "", model: videoModelId, streaming: true, video: { model: videoModel?.name ?? videoModelId, demo: true, free: true, storyboard: [] } },
    ]);

    // credits: free public video models cost 0
    const c = charge(videoModelId, "video");
    if (!c.ok) {
      setMessages((m) =>
        m.map((x) =>
          x.id === videoId
            ? { ...x, streaming: false, content: `Not enough credits for **${videoModel?.name}** (${c.charged} needed). Free public video models — Dreamina 4, Seedance 1 Pro, Kling Omni — always render at 0 credits.` }
            : x
        )
      );
      setBusy(false);
      onOpenCredits();
      return;
    }

    let result: { model?: string; videoUrl?: string; poster?: string; storyboard?: string[]; demo?: boolean; note?: string } | null = null;
    try {
      // 1) dedicated backend (real video with API keys)
      const be = await backendGenerate("video", { model: videoModelId, prompt, effort });
      if (be.ok && be.data && typeof be.data === "object") {
        result = be.data as typeof result;
      } else {
        // 2) same-origin server route (bun dev)
        const res = await fetch("/api/video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, frames: 4, style: "cinematic" }),
        });
        if (res.ok) {
          const j = await res.json();
          if (Array.isArray(j.frames) && j.frames.length > 0) {
            result = {
              model: videoModel?.name ?? videoModelId,
              poster: `data:image/jpeg;base64,${j.frames[0].base64}`,
              storyboard: ["Server render via the ChatUltra video pipeline — 4 keyframes at 16:9."],
              demo: true,
            };
          }
        }
      }
    } catch {
      result = null;
    }

    if (!result) result = demoVideoCard(prompt, videoModel?.name ?? videoModelId);

    setMessages((m) =>
      m.map((x) =>
        x.id === videoId
          ? {
              ...x,
              streaming: false,
              video: {
                model: result?.model ?? videoModel?.name ?? videoModelId,
                videoUrl: result?.videoUrl,
                poster: result?.poster,
                storyboard: result?.storyboard ?? [],
                demo: Boolean(result?.demo),
                free: true,
              },
            }
          : x
      )
    );
    setBusy(false);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    if (msg.startsWith("/")) {
      setInput("");
      if (taRef.current) taRef.current.style.height = "auto";
      await handleSlash(msg);
      return;
    }
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);

    // video models (Dreamina 4 / Seedance 1 Pro / Kling Omni) take the video pipeline
    if (currentModel?.kind === "video") {
      await generateVideo(msg, model);
      return;
    }

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: msg };
    const aiId = `a-${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: aiId, role: "assistant", content: "", model, effort, streaming: true }]);

    // credits: paid flagships burn credits, free public models are 0
    const c = charge(model, "text");
    if (!c.ok) {
      setMessages((m) =>
        m.map((x) =>
          x.id === aiId
            ? { ...x, streaming: false, content: `Out of credits for **${currentModel?.name}** — this flagship costs ${c.charged} credits per message.\n\nFree options that never run out: **Luna 1** for text, **Dreamina 4 / Seedance 1 Pro / Kling Omni** for video.` }
            : x
        )
      );
      setBusy(false);
      onOpenCredits();
      return;
    }

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

  /* ---------------- voice input ---------------- */

  const startVoice = () => {
    type Rec = { start: () => void; stop: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; continuous: boolean; interimResults: boolean; lang: string };
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      toast({ title: "Voice input unavailable", description: "This browser does not support speech recognition — try Chrome or Edge." });
      return;
    }
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript ?? "";
      if (t) setInput((prev) => (prev ? prev + " " : "") + t);
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  /* ---------------- attach ---------------- */

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 80 * 1024) {
      toast({ title: "File too large", description: "Attach text files under 80 kB." });
      return;
    }
    const text = await f.text();
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "txt";
    const lang = ["html", "css", "js", "ts", "json", "md", "csv", "xml", "svg"].includes(ext) ? ext : "text";
    setInput((prev) => `${prev}${prev ? "\n" : ""}[Attached file: ${f.name}]\n\`\`\`${lang}\n${text}\n\`\`\``);
    taRef.current?.focus();
  };

  /* ---------------- slash autocomplete ---------------- */

  const slashQuery = useMemo(() => {
    const m = /^\/[a-z]*$/i.exec(input.trim());
    return m ? m[0].toLowerCase() : null;
  }, [input]);
  const slashFiltered = useMemo(
    () => (slashQuery === null ? [] : SLASH_COMMANDS.filter((c) => c.name.startsWith(slashQuery))),
    [slashQuery]
  );
  const slashOpen = slashFiltered.length > 0;

  useEffect(() => setSlashSel(0), [slashQuery]);

  const execFromMenu = (name: string) => {
    if (ARGLESS.has(name)) {
      handleSlash(name);
      setInput("");
      return;
    }
    setInput(name.split(" ")[0] + " ");
    taRef.current?.focus();
  };

  const onTaKey = (e: React.KeyboardEvent) => {
    if (slashOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSel((s) => (s + 1) % slashFiltered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSel((s) => (s - 1 + slashFiltered.length) % slashFiltered.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        execFromMenu(slashFiltered[slashSel].name);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        execFromMenu(slashFiltered[slashSel].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setInput("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const fontCls = eff.id === "ultra" ? "text-zinc-300" : "";
  const toolBtn = "flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.07] hover:text-zinc-100";
  const toolBtnActive = "flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300 transition hover:bg-cyan-400/25";

  return (
    <StudioContext.Provider value={{ openPreview, runCommand, openTerminal: () => setTermOpen(true) }}>
      <div className="flex h-full min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {messages.length === 0 ? (
            /* ---------- welcome ---------- */
            <div className="flex flex-1 flex-col items-center justify-center px-4">
              <div className="anim-float relative mb-5">
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
              <h1 className="anim-grad bg-gradient-to-r from-cyan-200 via-white to-violet-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
                ChatUltra
              </h1>
              <p className="mt-2 text-[13.5px] text-zinc-400">
                Chat · Build games · Run commands · Ship to GitHub — your Codex-grade AI workspace
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
              <div className="mt-5 flex items-center gap-2 text-[11.5px] text-zinc-600">
                <TerminalSquare className="h-3.5 w-3.5" />
                Type <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-cyan-300">/</code> for commands — try <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-cyan-300">/video neon city flythrough</code> or <code className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[11px] text-cyan-300">/run neofetch</code>
              </div>
            </div>
          ) : (
            /* ---------- messages ---------- */
            <div ref={scrollRef} className="chatultra-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-6">
                {messages.map((m) =>
                  m.kind === "command" ? (
                    /* ---------- command execution card ---------- */
                    <div key={m.id} className="anim-msg overflow-hidden rounded-xl border border-white/10 bg-[#05070d] font-mono">
                      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
                        <SquareTerminal className="h-3 w-3 text-emerald-400" />
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">chatultra-shell</span>
                        <span className={cn("ml-auto text-[10px]", m.ok ? "text-emerald-500" : "text-rose-500")}>{m.ok ? "exit 0" : "exit 1"}</span>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="flex gap-2">
                          <span className="shrink-0 text-emerald-400">$</span>
                          <span className="min-w-0 break-all text-zinc-100">{m.cmd}</span>
                        </div>
                        {m.output ? (
                          <pre className="chatultra-scroll mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-zinc-300">
                            {m.output}
                          </pre>
                        ) : (
                          <div className="mt-2 flex items-center gap-2 text-[11.5px] text-zinc-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> running…
                          </div>
                        )}
                      </div>
                    </div>
                  ) : m.kind === "video" ? (
                    /* ---------- video generation card ---------- */
                    <div key={m.id} className="anim-msg flex gap-3">
                      <Image src={asset("/logo.png")} alt="ChatUltra" width={30} height={30} className="mt-0.5 h-[30px] w-[30px] rounded-xl border border-white/10" unoptimized />
                      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl rounded-tl-md border border-pink-400/20 bg-gradient-to-br from-pink-400/[0.06] to-violet-400/[0.04] p-3">
                        <div className="flex items-center gap-2 text-[12px] text-zinc-200">
                          <Clapperboard className="h-4 w-4 text-pink-300" />
                          <span className="font-medium">{m.video?.model ?? "Video engine"}</span>
                          {m.video?.free && <span className="nx-free-pill rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-300">Free</span>}
                          {m.video?.demo && <span className="rounded-full border border-white/10 bg-white/[0.05] px-1.5 py-px text-[9px] uppercase tracking-wide text-zinc-400">demo render</span>}
                        </div>
                        {m.streaming ? (
                          <div className="relative mt-3 h-40 overflow-hidden rounded-xl border border-white/10 bg-[#0a0d18]">
                            <div className="nx-render-sweep" />
                            <div className="flex h-full flex-col items-center justify-center gap-2">
                              <Loader2 className="h-5 w-5 animate-spin text-pink-300" />
                              <span className="font-mono text-[11.5px] text-zinc-400">rendering frames · {eff.label} effort…</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {m.video?.videoUrl ? (
                              <video src={m.video.videoUrl} controls poster={m.video.poster} className="mt-3 w-full rounded-xl border border-white/10" />
                            ) : m.video?.poster ? (
                              <img src={m.video.poster} alt="video keyframe" className="mt-3 w-full rounded-xl border border-white/10" />
                            ) : null}
                            {m.video?.storyboard && m.video.storyboard.length > 0 && (
                              <div className="mt-2.5 space-y-1">
                                {m.video.storyboard.map((s, i) => (
                                  <div key={i} className="flex items-start gap-2 text-[11.5px] text-zinc-400">
                                    <span className="mt-px shrink-0 rounded bg-white/[0.06] px-1.5 py-px font-mono text-[10px] text-pink-300">{String(i + 1).padStart(2, "0")}</span>
                                    <span className="min-w-0">{s}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className={cn("anim-msg flex gap-3", m.role === "user" && "justify-end")}>
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
                              <div className={m.streaming ? "nx-caret" : ""}>
                                <Markdown content={m.content} className={fontCls} />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2.5 py-1.5 text-[13px] text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <i className="nx-dot" />
                                  <i className="nx-dot" />
                                  <i className="nx-dot" />
                                </span>
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
                  )
                )}
              </div>
            </div>
          )}

          {/* ---------- composer ---------- */}
          <div className="shrink-0 px-4 pb-4">
            <div className="mx-auto max-w-3xl">
              <div className="relative rounded-2xl border border-white/10 bg-[#0c101c] shadow-xl shadow-black/40 transition focus-within:border-cyan-400/30">
                {/* slash command popup */}
                {slashOpen && (
                  <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#0c101c] shadow-2xl shadow-black/60">
                    <div className="chatultra-scroll max-h-[264px] overflow-y-auto p-1.5">
                      {slashFiltered.map((c, i) => (
                        <button
                          key={c.name}
                          onMouseEnter={() => setSlashSel(i)}
                          onClick={() => execFromMenu(c.name)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                            i === slashSel ? "bg-cyan-400/10" : "hover:bg-white/[0.05]"
                          )}
                        >
                          <span className="w-32 shrink-0 font-mono text-[12.5px] font-medium text-cyan-300">{c.name}</span>
                          <span className="truncate text-[12px] text-zinc-400">{c.desc}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-white/[0.07] px-3 py-1.5 text-[10px] text-zinc-600">Tab to complete · Enter to run · Esc to dismiss</div>
                  </div>
                )}

                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onTaKey}
                  rows={1}
                  placeholder="Ask ChatUltra to build, explain or ship anything — or type / for commands"
                  className="chatultra-scroll max-h-40 w-full resize-none bg-transparent px-2.5 py-2 text-[14px] text-zinc-100 outline-none placeholder:text-zinc-500"
                  style={{ height: "auto" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = Math.min(t.scrollHeight, 160) + "px";
                  }}
                />
                <div className="flex items-center gap-1 px-1.5 pb-1.5 pt-0.5">
                  <ModelPicker
                    models={models}
                    value={model}
                    effort={effort}
                    onSelect={onModel}
                    onEffort={onEffort}
                    onCreateCustom={() => onOpenSettings("models")}
                    onEditCustom={() => onOpenSettings("models")}
                  />

                  {/* effort quick picker */}
                  <Popover open={effortOpen} onOpenChange={setEffortOpen}>
                    <PopoverTrigger asChild>
                      <button className={cn(effortOpen ? toolBtnActive : toolBtn)} title="Reasoning effort" aria-label="Reasoning effort">
                        <SlidersHorizontal className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="top" align="start" className="w-[300px] border-white/10 bg-[#0c101c] p-2 shadow-2xl shadow-black/60">
                      <div className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Reasoning effort</div>
                      <div className="grid grid-cols-3 gap-1">
                        {EFFORTS.map((e2) => (
                          <button
                            key={e2.id}
                            onClick={() => {
                              onEffort(e2.id);
                              setEffortOpen(false);
                            }}
                            title={e2.hint}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition",
                              e2.id === effort
                                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                                : "border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                            )}
                          >
                            <EffortBars effort={e2} />
                            <span className="text-[11px] font-medium">{e2.label}</span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* web access toggle */}
                  <button
                    onClick={() => setWebAccess((w) => !w)}
                    className={cn(webAccess ? toolBtnActive : toolBtn)}
                    title={webAccess ? "Web access: on — replies can cite links" : "Web access: off"}
                    aria-pressed={webAccess}
                  >
                    <Globe className="h-4 w-4" />
                  </button>

                  {/* terminal toggle */}
                  <button
                    onClick={() => setTermOpen((t) => !t)}
                    className={cn(termOpen ? toolBtnActive : toolBtn)}
                    title="Terminal — run commands (Ctrl+`)"
                    aria-pressed={termOpen}
                  >
                    <SquareTerminal className="h-4 w-4" />
                  </button>

                  {/* attach file */}
                  <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.html,.htm,.css,.js,.ts,.jsx,.tsx,.json,.csv,.xml,.svg" className="hidden" onChange={onFile} />
                  <button onClick={() => fileRef.current?.click()} className={toolBtn} title="Attach a text file">
                    <Paperclip className="h-4 w-4" />
                  </button>

                  {/* more menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={toolBtn} title="More options">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="border-white/10 bg-[#0c101c] text-zinc-200">
                      <DropdownMenuItem onClick={onNewChat} className="gap-2 text-[12.5px]">
                        <MessageSquarePlus className="h-3.5 w-3.5" /> New chat
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSlash("/export")} className="gap-2 text-[12.5px]">
                        <Download className="h-3.5 w-3.5" /> Export chat (.md)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSettings("github")} className="gap-2 text-[12.5px]">
                        <FolderGit2 className="h-3.5 w-3.5" /> Push to GitHub
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenCredits} className="gap-2 text-[12.5px]">
                        <Zap className="h-3.5 w-3.5" /> Credits &amp; billing
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onOpenAccount} className="gap-2 text-[12.5px]">
                        <CircleUserRound className="h-3.5 w-3.5" /> Account profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSettings("appearance")} className="gap-2 text-[12.5px]">
                        <Settings className="h-3.5 w-3.5" /> Settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <div className="ml-auto flex items-center gap-1.5">
                    {busy ? (
                      <button
                        onClick={stop}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                        title="Stop generating"
                      >
                        <Square className="h-4 w-4" />
                      </button>
                    ) : input.trim() ? (
                      <button
                        onClick={() => send()}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500"
                        title="Send"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={startVoice}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500",
                          listening && "animate-pulse bg-blue-500"
                        )}
                        title={listening ? "Listening... click to stop" : "Voice input"}
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10.5px] text-zinc-600">
                <button
                  onClick={onOpenCredits}
                  className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-2 py-0.5 font-mono text-[10.5px] text-amber-300 transition hover:border-amber-400/50 hover:bg-amber-400/15"
                  title="Credits & billing — free public models cost 0"
                >
                  <Zap className="h-3 w-3" /> {creditBalance.toLocaleString()} credits
                </button>
                <span>
                  Model: <span className="text-zinc-400">{currentModel?.name}</span>
                  {currentModel?.kind === "video" && <span className="ml-1 rounded-full border border-pink-400/30 bg-pink-400/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-pink-300">video</span>}
                  {currentModel?.free && <span className="ml-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-px text-[9px] uppercase tracking-wide text-emerald-300">free</span>}
                  · Effort: <span className="text-zinc-400">{eff.label}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ---------- built-in terminal drawer ---------- */}
          <ChatTerminal shell={shell} open={termOpen} onClose={() => setTermOpen(false)} runToken={null} />
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
