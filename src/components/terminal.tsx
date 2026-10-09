"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/store";
import { cn } from "@/lib/utils";

interface TerminalProps {
  files: { path: string; content: string }[];
  projectName: string;
  onPushToGithub: () => Promise<string>; // returns log line
  className?: string;
}

interface Line {
  id: number;
  text: string;
  cls?: string;
}

const BANNER = [
  "  _   _                 _         _____",
  " | \\ | | _____   ____ _| |_   _  |___  |",
  " |  \\| |/ _ \\ \\ / / _` | | | | |   / / ",
  " | |\\  | (_) \\ V / (_| | | |_| |  / /  ",
  " |_| \\_|\\___/ \\_/ \\__,_|_|\\__, | /_/   ",
  "                          |___/        ",
];

export function Terminal({ files, projectName, onPushToGithub, className }: TerminalProps) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gh = useSettings((s) => s.gh);

  const push = (text: string, cls?: string) => {
    setLines((prev) => [...prev.slice(-400), { id: idRef.current++, text, cls }]);
  };

  useEffect(() => {
    if (lines.length === 0) {
      BANNER.forEach((b) => push(b, "text-cyan-400/80"));
      push("");
      push("ChatUltra Shell v1.4.0 — Linux-style project terminal", "text-zinc-500");
      push("Type `help` for available commands.", "text-zinc-500");
      push("");
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, busy]);

  const run = async (raw: string) => {
    const cmd = raw.trim();
    push(`${prompt()} ${cmd}`, "text-zinc-100");
    if (!cmd) return;
    setHistory((h) => [...h, cmd]);
    setHIdx(-1);

    const [bin, ...args] = cmd.split(/\s+/);
    switch (bin) {
      case "help":
        push("Available commands:", "text-cyan-300");
        [
          ["help", "show this help"],
          ["ls", "list project files"],
          ["cat <file>", "print a file"],
          ["run", "start dev server (playground preview)"],
          ["build", "build project for production"],
          ["git status", "show repo + pending changes"],
          ["git push", "push project to GitHub (uses Settings token)"],
          ["models", "list loaded AI models"],
          ["echo <text>", "print text"],
          ["whoami / date / clear", "misc"],
        ].forEach(([c, d]) => push(`  ${c.padEnd(14)} ${d}`, "text-zinc-400"));
        break;
      case "ls":
        push(`total ${files.length}`, "text-zinc-500");
        files.forEach((f) => push(`-rw-r--r--  1 chatultra chatultra ${String(f.content.length).padStart(6)}  ${f.path}`, "text-sky-300"));
        if (!files.length) push("(no files — build something first)", "text-zinc-500");
        break;
      case "cat": {
        const f = files.find((x) => x.path === args[0]);
        if (!f) push(`cat: ${args[0] || ""}: No such file`, "text-rose-400");
        else f.content.split("\n").slice(0, 60).forEach((l) => push(l, "text-zinc-300"));
        break;
      }
      case "run":
        push("starting dev server...", "text-zinc-500");
        await busyLines([
          ["> project@1.0.0 dev", "text-zinc-300"],
          ["> next dev --turbopack", "text-zinc-300"],
          ["", undefined],
          ["  ▲ ChatUltra Dev  ready in 412 ms", "text-emerald-400"],
          ["  - Local:  http://localhost:5173", "text-zinc-300"],
          ["preview is live in the Play window →", "text-cyan-300"],
        ]);
        break;
      case "build":
        setBusy(true);
        push("building for production...", "text-zinc-500");
        for (const f of files) {
          await new Promise((r) => setTimeout(r, 180));
          push(`  compiling  ${f.path}`, "text-zinc-400");
        }
        await new Promise((r) => setTimeout(r, 320));
        push("✓ compiled successfully", "text-emerald-400");
        push(`✓ bundle: ${(files.reduce((a, f) => a + f.content.length, 0) / 1024).toFixed(1)} kB total`, "text-emerald-400");
        setBusy(false);
        break;
      case "git": {
        const sub = args[0];
        if (sub === "status") {
          push(`On branch ${gh.branch || "main"}`, "text-zinc-300");
          push(`Remote repo: ${gh.repo || "(not configured)"}`, "text-zinc-400");
          push(`Changes to commit: ${files.length} file(s)`, "text-cyan-300");
          files.forEach((f) => push(`        modified:   ${f.path}`, "text-rose-300"));
          push(gh.token ? "token: loaded from Settings ✓" : "token: MISSING — set it in Settings → GitHub", gh.token ? "text-emerald-400" : "text-amber-400");
        } else if (sub === "log") {
          push("f3a9c21 (HEAD -> main) feat: latest ChatUltra build", "text-amber-300");
          push("8d21b04 chore: project scaffold", "text-amber-300");
        } else if (sub === "push") {
          if (!gh.token) {
            push("fatal: no GitHub token — open Settings → GitHub, paste a token, then retry", "text-rose-400");
            break;
          }
          setBusy(true);
          push(`Enumerating objects: ${files.length * 4}, done.`, "text-zinc-500");
          push(`Pushing to https://github.com/${gh.repo}`, "text-zinc-400");
          const res = await onPushToGithub();
          push(res, res.includes("✓") ? "text-emerald-400" : "text-rose-400");
          setBusy(false);
        } else {
          push(`git: '${sub || ""}' is not a chatultra-shell command. try: git status | git log | git push`, "text-rose-400");
        }
        break;
      }
      case "models":
        push("active models:", "text-cyan-300");
        ["GPT-5.2 (OpenAI)", "GPT-5.2 Codex (OpenAI)", "o4 Mini (OpenAI)", "Claude Sonnet 4.5 (Anthropic)", "Claude Opus 4.1 (Anthropic)", "Gemini 3 Pro (Google)", "Gemini 2.5 Flash (Google)", "Luna 1 (ChatUltra)"].forEach((m) =>
          push(`  ● ${m}`, "text-zinc-300")
        );
        break;
      case "echo":
        push(args.join(" "), "text-zinc-200");
        break;
      case "whoami":
        push("chatultra", "text-zinc-200");
        break;
      case "date":
        push(new Date().toString(), "text-zinc-200");
        break;
      case "about":
        push(`${projectName} — built with ChatUltra. ${files.length} file(s).`, "text-zinc-200");
        break;
      case "clear":
        setLines([]);
        break;
      case "neofetch":
        push("ultra@chatultra", "text-cyan-300");
        push("OS: ChatUltra OS 1.4 (web)", "text-zinc-300");
        push("Shell: chatultra-shell 1.4.0", "text-zinc-300");
        push("Terminal: ChatUltra Terminal (dark)", "text-zinc-300");
        push("CPU: Neural Core i9 (virtual)", "text-zinc-300");
        push("Memory: 42 MiB / 512 MiB", "text-zinc-300");
        break;
      default:
        push(`chatultra-shell: command not found: ${bin}`, "text-rose-400");
    }
  };

  const busyLines = async (ls: [string, string | undefined][]) => {
    for (const [t, c] of ls) {
      await new Promise((r) => setTimeout(r, 120));
      push(t, c);
    }
  };

  const prompt = () => `ultra@chatultra:~/projects/${projectName.replace(/\s+/g, "-").toLowerCase()}$`;

  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (busy) return;
    if (e.key === "Enter") {
      const val = input;
      setInput("");
      await run(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const i = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
      setHIdx(i);
      setInput(history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hIdx < 0) return;
      const i = hIdx + 1;
      if (i >= history.length) {
        setHIdx(-1);
        setInput("");
      } else {
        setHIdx(i);
        setInput(history[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#05070d]", className)}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0e18] px-3 py-1.5">
        <span className="flex gap-1.5">
          <i className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
          <i className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <i className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </span>
        <span className="font-mono text-[11px] text-zinc-500">chatultra-shell — {projectName}</span>
        {busy && <span className="ml-auto animate-pulse font-mono text-[10px] text-amber-400">● busy</span>}
      </div>
      <div ref={scrollRef} className="chatultra-scroll min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[12px] leading-[1.55]">
        {lines.map((l) => (
          <div key={l.id} className={cn("whitespace-pre-wrap break-words", l.cls ?? "text-zinc-300")}>
            {l.text || "\u00A0"}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-emerald-400">{prompt()}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={busy}
            className="w-full flex-1 bg-transparent font-mono text-[12px] text-zinc-100 caret-cyan-300 outline-none"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </div>
  );
}
