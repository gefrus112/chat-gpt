"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone, Code2, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewPanelProps {
  code: string;
  onCodeChange?: (code: string) => void;
  title?: string;
  onClose?: () => void;
  className?: string;
}

export function PreviewPanel({ code, onCodeChange, title = "Canvas", onClose, className }: PreviewPanelProps) {
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [nonce, setNonce] = useState(0);
  const [draft, setDraft] = useState(code);
  const [prevCode, setPrevCode] = useState(code);
  if (prevCode !== code) {
    // sync local draft when a new code payload arrives (React-recommended pattern)
    setPrevCode(code);
    setDraft(code);
  }

  const blobUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      return URL.createObjectURL(new Blob([code], { type: "text/html" }));
    } catch {
      return "";
    }
  }, [code, nonce]);

  const openExternal = () => {
    try {
      const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
      window.open(url, "_blank", "noopener,width=1100,height=800");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden border-l border-white/10 bg-[#0a0e18]", className)}>
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0c101c] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-3.5 w-3.5 text-cyan-300" />
          <span className="text-[12.5px] font-medium text-zinc-200">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="mr-1 flex rounded-md border border-white/10 p-0.5">
            <button
              onClick={() => setTab("preview")}
              className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[11px]", tab === "preview" ? "bg-cyan-400/15 text-cyan-200" : "text-zinc-400 hover:text-zinc-200")}
            >
              <Play className="h-3 w-3" /> Preview
            </button>
            <button
              onClick={() => setTab("edit")}
              className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[11px]", tab === "edit" ? "bg-cyan-400/15 text-cyan-200" : "text-zinc-400 hover:text-zinc-200")}
            >
              <Code2 className="h-3 w-3" /> Code
            </button>
          </div>
          {tab === "preview" && (
            <>
              <div className="mr-1 flex rounded-md border border-white/10 p-0.5">
                <button
                  onClick={() => setDevice("desktop")}
                  className={cn("rounded p-1", device === "desktop" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300")}
                  title="Desktop width"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDevice("mobile")}
                  className={cn("rounded p-1", device === "mobile" ? "bg-white/10 text-zinc-100" : "text-zinc-500 hover:text-zinc-300")}
                  title="Mobile width"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100" onClick={() => setNonce((n) => n + 1)} title="Reload preview">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100" onClick={openExternal} title="Open in new window">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-zinc-100" onClick={onClose} title="Close panel">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {tab === "preview" ? (
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[#070a12] p-3">
          <iframe
            key={`${nonce}-${device}`}
            title="preview"
            srcDoc={code || "<p style='color:#666;font-family:sans-serif'>Nothing to preview yet — ask the AI to build something, or paste HTML and hit Run.</p>"}
            sandbox="allow-scripts allow-modals allow-forms allow-popups allow-pointer-lock"
            className={cn(
              "h-full min-h-[400px] rounded-lg border border-white/10 bg-white shadow-2xl shadow-black/50",
              device === "mobile" ? "w-[390px] max-w-full" : "w-full"
            )}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="chatultra-scroll min-h-0 flex-1 resize-none bg-[#080b13] p-3 font-mono text-[12.5px] leading-relaxed text-zinc-200 outline-none"
          />
          {onCodeChange && (
            <div className="flex items-center justify-between border-t border-white/10 bg-[#0c101c] px-3 py-2">
              <span className="text-[11px] text-zinc-500">{draft.length.toLocaleString()} chars · editable</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 text-[12px] text-zinc-300" onClick={() => setDraft(code)}>
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="h-7 bg-cyan-500/15 text-[12px] text-cyan-200 hover:bg-cyan-500/25"
                  onClick={() => {
                    onCodeChange(draft);
                    setNonce((n) => n + 1);
                    setTab("preview");
                  }}
                >
                  Apply & Run
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
