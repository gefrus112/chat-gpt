"use client";

import { useEffect, useRef, useState } from "react";
import { Minimize2, Trash2 } from "lucide-react";
import { ChatShell, type ShellLine } from "@/lib/shell";
import { useSettings, normalizeRepo } from "@/lib/store";
import { ghPushFiles } from "@/lib/gh-direct";
import { cn } from "@/lib/utils";

interface ChatTerminalProps {
  shell: ChatShell;
  open: boolean;
  onClose: () => void;
  /** external command to execute once after opening (e.g. from a slash command) */
  runToken: { cmd: string; n: number } | null;
}

const BANNER = "ChatUltra Shell v1.4.0 — type `help` for available commands.";

export function ChatTerminal({ shell, open, onClose, runToken }: ChatTerminalProps) {
  const [lines, setLines] = useState<ShellLine[]>([]);
  const [input, setInput] = useState("");
  const [histIdx, setHistIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bootRef = useRef(false);
  const gh = useSettings((s) => s.gh);

  const push = (text: string, cls?: string) => setLines((prev) => [...prev.slice(-500), { text, cls }]);

  // wire the GitHub push handler (Settings token, prefilled repo)
  useEffect(() => {
    shell.setPushHandler(async () => {
      const repo = normalizeRepo(gh.repo || "gefrus112/chat-gpt");
      if (!gh.token) return "fatal: no GitHub token — open Settings > GitHub, paste your token, then retry";
      if (!repo) return "fatal: invalid repo — check Settings > GitHub";
      try {
        const res = await ghPushFiles({
          token: gh.token,
          repo: repo.owner + "/" + repo.name,
          branch: gh.branch || "main",
          message: "chore: push from ChatUltra terminal",
          files: shell.files.map((f) => ({ path: f.path, content: f.content })),
        });
        return res.ok ? "[ok] pushed to https://github.com/" + repo.owner + "/" + repo.name : "[err] " + (res.error || "push failed");
      } catch (e) {
        return "[err] " + (e instanceof Error ? e.message : "push failed");
      }
    });
  }, [shell, gh.token, gh.repo, gh.branch]);

  // boot banner
  useEffect(() => {
    if (!open || bootRef.current) return;
    bootRef.current = true;
    push(BANNER, "text-zinc-500");
    push("");
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, busy]);

  // run external command when requested
  useEffect(() => {
    if (!open || !runToken) return;
    (async () => {
      await execute(runToken.cmd);
    })();
  }, [runToken?.n]);

  const prompt = "ultra@chatultra:~/ultra-app$";

  const execute = async (raw: string) => {
    const cmd = raw.trim();
    push(`${prompt} ${cmd}`, "text-zinc-100");
    if (!cmd) return;
    setBusy(true);
    try {
      const res = await shell.run(cmd);
      if (res.clear) setLines([]);
      else res.lines.forEach((l) => push(l.text, l.cls));
    } finally {
      setBusy(false);
    }
  };

  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !busy) {
      const val = input;
      setInput("");
      setHistIdx(-1);
      await execute(val);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!shell.history.length) return;
      const i = histIdx < 0 ? shell.history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(i);
      setInput(shell.history[i]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const i = histIdx + 1;
      if (i >= shell.history.length) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(i);
        setInput(shell.history[i]);
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  };

  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden border-t border-white/10 bg-[#05070d] transition-all duration-200",
        open ? "h-[260px]" : "h-0"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-white/10 bg-[#0a0e18] px-3 py-1.5">
          <span className="flex gap-1.5">
            <i className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <i className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <i className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </span>
          <span className="font-mono text-[11px] text-zinc-500">chatultra-shell — ultra-app</span>
          {busy && <span className="ml-auto animate-pulse font-mono text-[10px] text-amber-400">busy</span>}
          <button
            onClick={() => setLines([])}
            title="Clear terminal"
            className="ml-auto rounded p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} title="Hide terminal" className="rounded p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200">
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div ref={scrollRef} className="chatultra-scroll min-h-0 flex-1 cursor-text overflow-y-auto p-3 font-mono text-[12px] leading-[1.55]" onClick={() => inputRef.current?.focus()}>
          {lines.map((l, i) => (
            <div key={i} className={cn("whitespace-pre-wrap break-words", l.cls ?? "text-zinc-300")}>
              {l.text || "\u00A0"}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-emerald-400">{prompt}</span>
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
    </div>
  );
}
