"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Boxes, Wand2, Save, Download, ExternalLink, CloudUpload, Loader2, FolderOpen, Trash2,
} from "lucide-react";
import { GAME_TEMPLATES } from "@/lib/game-templates";
import { Terminal } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { useSettings, normalizeRepo } from "@/lib/store";
import { demoReply } from "@/lib/demo-ai";
import { ghPushFiles } from "@/lib/gh-direct";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LS_KEY = "chatultra-playground-project";

export function extractHtml(md: string): string | null {
  const fence = /```(?:html|htm)?\s*\n([\s\S]*?)```/i.exec(md);
  if (fence?.[1]?.trim()) return fence[1].trim();
  if (/<html[\s>]/i.test(md)) {
    const m = /<!DOCTYPE[\s\S]*<\/html>|<html[\s\S]*<\/html>/i.exec(md);
    if (m) return m[0];
  }
  return null;
}

function buildPopoutDoc(code: string): string {
  const seed = JSON.stringify(code).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ChatUltra — External Game Editor</title><style>
  body{margin:0;height:100vh;display:flex;flex-direction:column;background:#070a12;color:#e2e8f0;font-family:ui-monospace,monospace}
  header{display:flex;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid #1e293b;background:#0c101c}
  header b{color:#22d3ee;letter-spacing:2px}
  header .spacer{flex:1}
  button{background:#22d3ee22;border:1px solid #22d3ee55;color:#a5f3fc;padding:6px 14px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:12px}
  button:hover{background:#22d3ee33}
  main{flex:1;display:flex;min-height:0}
  textarea{flex:1;background:#080b13;color:#d1e5f4;border:none;border-right:1px solid #1e293b;resize:none;padding:12px;font-family:inherit;font-size:12.5px;line-height:1.5;outline:none}
  iframe{flex:1;border:none;background:#05070d}
  .col{display:flex;flex-direction:column;flex:1;min-width:0}
  .label{padding:5px 12px;font-size:10px;letter-spacing:2px;color:#64748b;background:#0a0e18;border-bottom:1px solid #1e293b}
  </style></head><body>
  <header><b>ChatUltra</b> external game editor <span class="spacer"></span><span style="font-size:11px;color:#64748b">edits here sync back to the studio</span><button id="sync">Send changes to Studio</button><button id="run">Run</button></header>
  <main>
    <div class="col"><div class="label">EDITOR</div><textarea id="ed" spellcheck="false"></textarea></div>
    <div class="col"><div class="label">LIVE PREVIEW</div><iframe id="pv" sandbox="allow-scripts allow-modals allow-pointer-lock"></iframe></div>
  </main>
  <script>
  var seed=${seed};
  var ed=document.getElementById('ed'),pv=document.getElementById('pv');
  ed.value=seed;pv.srcdoc=seed;
  document.getElementById('run').onclick=function(){pv.srcdoc=ed.value};
  document.getElementById('sync').onclick=function(){
    try{window.opener.postMessage({type:'chatultra-code-sync',code:ed.value},'*');this.textContent='sent';var b=this;setTimeout(function(){b.textContent='Send changes to Studio'},1200)}catch(e){alert('lost connection to studio')}
  };
  </script></body></html>`;
}

export function Playground({ refreshKey }: { refreshKey: number }) {
  const [code, setCode] = useState<string>(GAME_TEMPLATES[0].code);
  const [projectName, setProjectName] = useState("Neon Pong");
  const [previewNonce, setPreviewNonce] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [building, setBuilding] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState("pong");
  const gh = useSettings((s) => s.gh);
  const popoutRef = useRef<Window | null>(null);

  // load saved project
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p?.code) {
          setCode(p.code);
          setProjectName(p.name || "My Project");
        }
      }
    } catch {
      /* ignore */
    }
  }, [refreshKey]);

  // listen for sync from popout
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "chatultra-code-sync" && typeof e.data.code === "string") {
        setCode(e.data.code);
        setPreviewNonce((n) => n + 1);
        toast({ title: "Game synced", description: "Changes from the external editor were merged in." });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const saveLocal = useCallback(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ code, name: projectName }));
    toast({ title: "Project saved", description: "Stored in your browser." });
  }, [code, projectName]);

  const openPopout = () => {
    saveLocal();
    const w = window.open("", "_blank", "width=1280,height=800,noopener");
    if (!w) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups for this site to use the external editor." });
      return;
    }
    popoutRef.current = w;
    w.document.write(buildPopoutDoc(code));
    w.document.close();
  };

  const buildWithAI = async () => {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Build a complete, polished, single-file HTML5 game. Requirements: ${prompt}. Dark neon aesthetic on #05070d, canvas-based, keyboard/touch controls, score display, game over + restart. Return ONLY the HTML file in one \`\`\`html code fence.`,
          model: "gpt-5.2-codex",
          effort: "max",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let md = text;
      try {
        // ndjson stream, collect deltas
        md = text
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            try {
              const j = JSON.parse(l);
              return j.type === "delta" ? j.text : "";
            } catch {
              return l;
            }
          })
          .join("");
      } catch {
        /* fall back to raw */
      }
      const html = extractHtml(md);
      if (html) {
        setCode(html);
        setProjectName(prompt.slice(0, 30) || "AI Game");
        setActiveTemplate("ai");
        setPreviewNonce((n) => n + 1);
        toast({ title: "Game built", description: "Your AI-generated game is live in the preview." });
      } else {
        toast({ title: "Could not parse game HTML", description: "Try rephrasing the prompt." });
      }
    } catch {
      // static hosting (e.g. GitHub Pages), fall back to the built-in demo brain
      const demo = demoReply(`Build a game: ${prompt}`);
      const demoHtml = extractHtml(demo);
      if (demoHtml) {
        setCode(demoHtml);
        setProjectName(prompt.slice(0, 30) || "AI Game");
        setActiveTemplate("ai");
        setPreviewNonce((n) => n + 1);
        toast({ title: "Demo game loaded", description: "Static demo mode — replace via the full ChatUltra server." });
      } else {
        toast({ title: "Build failed", description: "The AI service did not respond. Try again." });
      }
    } finally {
      setBuilding(false);
    }
  };

  const pushToGithub = async (): Promise<string> => {
    if (!gh.token) return "[err] no token — open Settings > GitHub";
    const repo = normalizeRepo(gh.repo);
    if (!repo) return "[err] invalid repo in Settings";
    setPushing(true);
    const payload = {
      token: gh.token,
      repo: gh.repo,
      branch: gh.branch || "main",
      message: `ChatUltra Playground: ${projectName}`,
      files: [
        { path: "index.html", content: code },
        { path: "README.md", content: `# ${projectName}\n\nBuilt with ChatUltra playground.\n` },
      ],
    };
    try {
      let j: { ok?: boolean; error?: string; repo?: string; branch?: string; pushed?: number; total?: number } | null = null;
      try {
        const res = await fetch("/api/github/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status !== 404) j = await res.json();
      } catch {
        j = null; // no server (static hosting)
      }
      if (!j) {
        // push straight from the browser via the GitHub REST API
        const r = await ghPushFiles(payload);
        if (r.ok) {
          toast({ title: "Pushed to GitHub", description: `${payload.repo} · ${payload.branch} · ${payload.files.length} files` });
          return `[ok] pushed ${payload.files.length} files to ${payload.repo}@${payload.branch}`;
        }
        toast({ title: "Push failed", description: r.error ?? "unknown error" });
        return `[err] ${r.error ?? "push failed"}`;
      }
      if (j.ok) {
        toast({ title: "Pushed to GitHub", description: `${j.repo} · ${j.branch} · ${j.pushed}/${j.total} files` });
        return `[ok] pushed ${j.pushed}/${j.total} files to ${j.repo}@${j.branch}`;
      }
      toast({ title: "Push failed", description: j.error ?? "unknown error" });
      return `[err] ${j.error ?? "push failed"}`;
    } catch {
      toast({ title: "Push failed", description: "Network error" });
      return "[err] network error";
    } finally {
      setPushing(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "-").toLowerCase() || "game"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const files = [{ path: "index.html", content: code }, { path: "README.md", content: `# ${projectName}` }];

  return (
    <div className="flex h-full min-h-0 gap-3 p-3">
      {/* left rail: templates + AI builder */}
      <div className="chatultra-scroll hidden w-56 shrink-0 flex-col gap-2 overflow-y-auto lg:flex">
        <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          <Boxes className="h-3.5 w-3.5" /> Game templates
        </div>
        {GAME_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTemplate(t.id);
              setProjectName(t.name);
              setCode(t.code);
              setPreviewNonce((n) => n + 1);
            }}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition",
              activeTemplate === t.id
                ? "border-cyan-400/40 bg-cyan-400/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
            )}
          >
            <div className="text-[12.5px] font-medium text-zinc-100">{t.name}</div>
            <div className="text-[10.5px] text-zinc-500">{t.desc}</div>
          </button>
        ))}

        <div className="mt-2 rounded-lg border border-violet-400/20 bg-violet-500/[0.06] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-violet-300">
            <Wand2 className="h-3.5 w-3.5" /> Build with AI
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. zombie survival arena with WASD, waves, powerups…"
            rows={3}
            className="chatultra-scroll w-full resize-none rounded-md border border-white/10 bg-black/30 p-2 text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/40"
          />
          <Button
            size="sm"
            disabled={building || !prompt.trim()}
            onClick={buildWithAI}
            className="mt-1.5 w-full bg-violet-500/20 text-[12px] text-violet-200 hover:bg-violet-500/30"
          >
            {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {building ? "Building…" : "Generate game"}
          </Button>
        </div>
      </div>

      {/* center: editor + terminal */}
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0e18]">
          <div className="flex items-center gap-2 border-b border-white/10 bg-[#0c101c] px-3 py-2">
            <FolderOpen className="h-3.5 w-3.5 text-amber-300" />
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-40 rounded bg-transparent text-[12.5px] font-medium text-zinc-100 outline-none focus:bg-white/5 focus:px-1"
              aria-label="Project name"
            />
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">index.html</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11.5px] text-zinc-300" onClick={saveLocal}>
                <Save className="h-3 w-3" /> Save
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11.5px] text-zinc-300" onClick={download}>
                <Download className="h-3 w-3" /> .html
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11.5px] text-zinc-300" onClick={openPopout} title="Edit the game in a separate window">
                <ExternalLink className="h-3 w-3" /> Edit in window
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[11.5px] text-emerald-300 hover:text-emerald-200"
                onClick={pushToGithub}
                disabled={pushing}
              >
                {pushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudUpload className="h-3 w-3" />} Push to GitHub
              </Button>
              <Button
                size="sm"
                className="h-7 gap-1 bg-cyan-500/15 text-[11.5px] text-cyan-200 hover:bg-cyan-500/25"
                onClick={() => setPreviewNonce((n) => n + 1)}
              >
                Run
              </Button>
            </div>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
            className="chatultra-scroll min-h-0 flex-1 resize-none bg-[#080b13] p-3 font-mono text-[12px] leading-relaxed text-zinc-200 outline-none"
          />
        </div>
        <Terminal files={files} projectName={projectName} onPushToGithub={pushToGithub} className="h-52 shrink-0" />
      </div>

      {/* right: live preview */}
      <div className="hidden min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0e18] xl:flex">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0c101c] px-3 py-2">
          <span className="text-[12.5px] font-medium text-zinc-200">Play — live preview</span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400"
              title="Open game in its own window"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
                window.open(url, "_blank", "noopener,width=1000,height=720");
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-zinc-400"
              title="Clear editor"
              onClick={() => {
                setCode(GAME_TEMPLATES[GAME_TEMPLATES.length - 1].code);
                setPreviewNonce((n) => n + 1);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <iframe
          key={previewNonce}
          title="playground preview"
          srcDoc={code}
          sandbox="allow-scripts allow-modals allow-pointer-lock allow-forms"
          className="min-h-0 flex-1 bg-[#05070d]"
        />
      </div>
    </div>
  );
}
