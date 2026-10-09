"use client";

import { createContext, useCallback, useContext, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy, Play, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StudioActions {
  openPreview: (code: string, title?: string) => void;
}

export const StudioContext = createContext<StudioActions>({ openPreview: () => {} });

export function useStudio() {
  return useContext(StudioContext);
}

function extractText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in (node as Record<string, unknown>)) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return "";
}

function CodeCard({ code, lang }: { code: string; lang: string }) {
  const { openPreview } = useStudio();
  const [copied, setCopied] = useState(false);
  const runnable = ["html", "htm", "xhtml", "svg"].includes(lang.toLowerCase());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="group/code my-3 overflow-hidden rounded-lg border border-white/10 bg-[#0a0d16]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <i className="h-2 w-2 rounded-full bg-rose-500/70" />
            <i className="h-2 w-2 rounded-full bg-amber-500/70" />
            <i className="h-2 w-2 rounded-full bg-emerald-500/70" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{lang || "code"}</span>
        </div>
        <div className="flex items-center gap-1">
          {runnable && (
            <>
              <button
                onClick={() => openPreview(code, "Preview")}
                className="flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-1 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-500/25"
              >
                <Play className="h-3 w-3" /> Run
              </button>
              <button
                onClick={() => openPreview(code, "Canvas")}
                className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10"
              >
                <PanelRight className="h-3 w-3" /> Canvas
              </button>
            </>
          )}
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-white/10"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="max-h-[420px] overflow-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono text-zinc-200">{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("min-w-0 break-words text-[14.5px] leading-relaxed text-zinc-100", className)}>
      <ReactMarkdown
        components={{
          h1: (p) => <h1 className="mb-3 mt-4 text-xl font-semibold text-white" {...p} />,
          h2: (p) => <h2 className="mb-2.5 mt-4 text-lg font-semibold text-white" {...p} />,
          h3: (p) => <h3 className="mb-2 mt-3 text-[15px] font-semibold text-zinc-100" {...p} />,
          p: (p) => <p className="my-2.5 leading-7 text-zinc-200" {...p} />,
          ul: (p) => <ul className="my-2.5 list-disc space-y-1 pl-5 text-zinc-200" {...p} />,
          ol: (p) => <ol className="my-2.5 list-decimal space-y-1 pl-5 text-zinc-200" {...p} />,
          li: (p) => <li className="leading-7" {...p} />,
          strong: (p) => <strong className="font-semibold text-white" {...p} />,
          a: (p) => <a className="text-cyan-300 underline decoration-cyan-300/40 underline-offset-2 hover:decoration-cyan-300" target="_blank" rel="noreferrer" {...p} />,
          blockquote: (p) => <blockquote className="my-3 border-l-2 border-cyan-400/40 pl-3 text-zinc-300 italic" {...p} />,
          hr: () => <hr className="my-4 border-white/10" />,
          table: (p) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full text-left text-[13px]" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-white/5 text-zinc-200" {...p} />,
          th: (p) => <th className="border-b border-white/10 px-3 py-2 font-medium" {...p} />,
          td: (p) => <td className="border-b border-white/5 px-3 py-2 text-zinc-300" {...p} />,
          code: (props) => {
            const { className, children } = props as { className?: string; children?: unknown };
            const match = /language-(\w+)/.exec(className || "");
            const raw = extractText(children);
            const isBlock = className?.includes("language-") || raw.includes("\n");
            if (isBlock) {
              return <CodeCard code={raw.replace(/\n$/, "")} lang={match?.[1] ?? "text"} />;
            }
            return (
              <code className="rounded-[5px] border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12.5px] text-cyan-200">
                {raw}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
