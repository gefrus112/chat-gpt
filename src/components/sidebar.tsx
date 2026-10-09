"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MessageSquarePlus, MessageSquare, Boxes, Bot, Clapperboard, Settings, Trash2, X, Pin } from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { useSettings } from "@/lib/store";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

export type View = "chat" | "playground" | "agent" | "video";

interface ConversationMeta {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  updatedAt: string;
}

interface SidebarProps {
  view: View;
  onView: (v: View) => void;
  conversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  refreshKey: number;
  onOpenSettings: () => void;
}

export function Sidebar({ view, onView, conversationId, onSelectConversation, refreshKey, onOpenSettings }: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const gh = useSettings((s) => s.gh);

  const load = () => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => setConversations([]));
  };

  useEffect(load, [refreshKey]);

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) onSelectConversation(null);
    load();
  };

  const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
    { id: "playground", label: "Playground", icon: <Boxes className="h-4 w-4" /> },
    { id: "agent", label: "Agent", icon: <Bot className="h-4 w-4" /> },
    { id: "video", label: "AI Video", icon: <Clapperboard className="h-4 w-4" /> },
  ];

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-white/[0.07] bg-[#080b13]">
      {/* logo */}
      <div className="flex items-center gap-2.5 px-3.5 pb-2 pt-4">
        <Image
          src={asset("/logo.png")}
          alt="ChatUltra"
          width={34}
          height={34}
          className="rounded-xl border border-white/10 shadow-lg shadow-cyan-500/10"
          priority
          unoptimized
        />
        <div>
          <div className="text-[15px] font-bold tracking-wide text-white">ChatUltra</div>
          <div className="-mt-0.5 text-[9.5px] uppercase tracking-[0.18em] text-zinc-500">AI Studio</div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <button
          onClick={() => {
            onSelectConversation(null);
            onView("chat");
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-cyan-400/10 to-violet-500/10 px-3 py-2.5 text-[13px] font-medium text-zinc-100 transition hover:border-cyan-400/30 hover:from-cyan-400/20 hover:to-violet-500/20"
        >
          <MessageSquarePlus className="h-4 w-4 text-cyan-300" />
          New chat
        </button>
      </div>

      {/* nav */}
      <nav className="mt-3 space-y-0.5 px-3">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => onView(n.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition",
              view === n.id ? "bg-white/[0.07] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
            )}
          >
            <span className={view === n.id ? "text-cyan-300" : ""}>{n.icon}</span>
            {n.label}
            {view === n.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-300" />}
          </button>
        ))}
      </nav>

      {/* history */}
      <div className="mt-4 min-h-0 flex-1 overflow-hidden px-3">
        <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Recent</div>
        <div className="chatultra-scroll flex h-[calc(100%-28px)] flex-col gap-0.5 overflow-y-auto pb-2">
          {conversations.length === 0 && <div className="px-1 text-[11.5px] text-zinc-600">No chats yet</div>}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelectConversation(c.id);
                onView("chat");
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition",
                c.id === conversationId && view === "chat" ? "bg-white/[0.07] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.04]"
              )}
            >
              {c.pinned ? <Pin className="h-3 w-3 shrink-0 text-amber-300" /> : <MessageSquare className="h-3 w-3 shrink-0 text-zinc-600" />}
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              <button onClick={(e) => del(e, c.id)} className="hidden shrink-0 rounded p-0.5 text-zinc-500 hover:text-rose-300 group-hover:block" title="Delete chat">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* bottom */}
      <div className="space-y-0.5 border-t border-white/[0.07] p-3">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-zinc-300 transition hover:bg-white/[0.05]"
        >
          <Settings className="h-4 w-4 text-zinc-400" />
          Settings
          <span className="ml-auto flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-500">
            <GitHubIcon className="h-2.5 w-2.5" />
            {gh.connected ? "linked" : "token"}
          </span>
        </button>
        <div className="flex items-center gap-1.5 px-3 pt-1 text-[10px] text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          All systems operational
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar({ view, onMenu, title }: { view: View; onMenu: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#080b13] px-3 py-2 lg:hidden">
      <button onClick={onMenu} className="rounded-lg p-1.5 text-zinc-300 hover:bg-white/5" aria-label="Open menu">
        <X className="h-4 w-4" />
      </button>
      <span className="text-[13px] font-medium text-zinc-200">{title}</span>
      <span className="ml-auto font-mono text-[10px] uppercase text-zinc-600">{view}</span>
    </div>
  );
}
