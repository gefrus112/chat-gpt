"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  MessageSquarePlus,
  MessageSquare,
  Boxes,
  Bot,
  Clapperboard,
  Settings,
  Trash2,
  X,
  Pin,
  CircleUserRound,
  History,
  SquareTerminal,
  Menu,
} from "lucide-react";
import { GitHubIcon } from "@/components/brand-icons";
import { useSettings } from "@/lib/store";
import { useAccount } from "@/lib/account";
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

interface RailProps {
  view: View;
  onView: (v: View) => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  onOpenTerminal?: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
}

/** Slim desktop icon rail — Codex/Jan style vertical toolbar. */
export function IconRail({ view, onView, onNewChat, onToggleHistory, historyOpen, onOpenTerminal, onOpenSettings, onOpenAccount }: RailProps) {
  const account = useAccount((s) => s.account);

  const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "chat", label: "Chat", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
    { id: "playground", label: "Playground", icon: <Boxes className="h-[18px] w-[18px]" /> },
    { id: "agent", label: "Agent", icon: <Bot className="h-[18px] w-[18px]" /> },
    { id: "video", label: "AI Video", icon: <Clapperboard className="h-[18px] w-[18px]" /> },
  ];

  const railBtn = (active: boolean) =>
    cn(
      "relative flex h-9 w-9 items-center justify-center rounded-xl transition",
      active ? "bg-white/[0.09] text-cyan-300" : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
    );

  return (
    <aside className="flex w-[54px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.07] bg-[#080b13] py-3">
      {/* logo */}
      <button onClick={onNewChat} title="ChatUltra — new chat" className="group relative">
        <Image
          src={asset("/logo.png")}
          alt="ChatUltra"
          width={32}
          height={32}
          className="rounded-xl border border-white/10 shadow-lg shadow-cyan-500/10 transition group-hover:scale-105"
          priority
          unoptimized
        />
      </button>

      <button onClick={onNewChat} title="New chat" className={railBtn(false) + " mt-1"}>
        <MessageSquarePlus className="h-[18px] w-[18px]" />
      </button>

      <div className="my-1 h-px w-6 bg-white/[0.08]" />

      {NAV.map((n) => (
        <button key={n.id} onClick={() => onView(n.id)} title={n.label} className={railBtn(view === n.id)}>
          {n.icon}
          {view === n.id && <span className="absolute -left-[7px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-cyan-300" />}
        </button>
      ))}

      <button onClick={onToggleHistory} title="History" className={railBtn(historyOpen)}>
        <History className="h-[18px] w-[18px]" />
        {historyOpen && <span className="absolute -left-[7px] top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-cyan-300" />}
      </button>

      {onOpenTerminal && (
        <button onClick={onOpenTerminal} title="Terminal — run commands" className={railBtn(false)}>
          <SquareTerminal className="h-[18px] w-[18px]" />
        </button>
      )}

      <div className="flex-1" />

      {/* account + settings */}
      <button onClick={onOpenAccount} title={account ? account.username : "Create account"} className={railBtn(false)}>
        {account?.avatar ? (
          <Image src={account.avatar} alt={account.username} width={22} height={22} className="h-[22px] w-[22px] rounded-lg border border-white/10 object-cover" unoptimized />
        ) : (
          <CircleUserRound className="h-[18px] w-[18px]" />
        )}
      </button>
      <button onClick={onOpenSettings} title="Settings" className={railBtn(false)}>
        <Settings className="h-[18px] w-[18px]" />
      </button>
    </aside>
  );
}

/** History flyout panel that opens next to the rail. */
export function HistoryFlyout({
  open,
  onClose,
  conversationId,
  onSelectConversation,
  refreshKey,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  refreshKey: number;
}) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const gh = useSettings((s) => s.gh);

  useEffect(() => {
    if (!open) return;
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => setConversations([]));
  }, [open, refreshKey]);

  if (!open) return null;

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === conversationId) onSelectConversation(null);
    setConversations((cs) => cs.filter((c) => c.id !== id));
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-3 left-[60px] top-3 z-40 flex w-[264px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e19] shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-3.5 pb-2 pt-3">
          <span className="text-[13px] font-semibold text-zinc-100">History</span>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200" title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="chatultra-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-zinc-600">No chats yet</div>}
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelectConversation(c.id);
                onClose();
              }}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] transition",
                c.id === conversationId ? "bg-white/[0.07] text-zinc-100" : "text-zinc-400 hover:bg-white/[0.04]"
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
        <div className="border-t border-white/[0.07] px-3.5 py-2 text-[10px] text-zinc-600">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            All systems operational
            <span className="ml-auto flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-500">
              <GitHubIcon className="h-2.5 w-2.5" />
              {gh.connected ? "linked" : "token"}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}

interface SidebarProps {
  view: View;
  onView: (v: View) => void;
  conversationId: string | null;
  onSelectConversation: (id: string | null) => void;
  refreshKey: number;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onOpenTerminal?: () => void;
  onClose?: () => void;
}

/** Full sidebar panel — used in the mobile drawer. */
export function Sidebar({ view, onView, conversationId, onSelectConversation, refreshKey, onOpenSettings, onOpenAccount, onOpenTerminal, onClose }: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const gh = useSettings((s) => s.gh);
  const account = useAccount((s) => s.account);

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
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-white/[0.07] bg-[#080b13]">
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
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-lg p-1.5 text-zinc-400 hover:bg-white/5" title="Close menu">
            <X className="h-4 w-4" />
          </button>
        )}
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
        {onOpenTerminal && (
          <button
            onClick={onOpenTerminal}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-zinc-400 transition hover:bg-white/[0.04] hover:text-zinc-200"
          >
            <SquareTerminal className="h-4 w-4" />
            Terminal
          </button>
        )}
      </nav>

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

      <div className="space-y-0.5 border-t border-white/[0.07] p-3">
        <button
          onClick={onOpenAccount}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-zinc-200 transition hover:bg-white/[0.05]"
        >
          {account?.avatar ? (
            <Image src={account.avatar} alt={account.username} width={26} height={26} className="h-[26px] w-[26px] rounded-lg border border-white/10 object-cover" unoptimized />
          ) : (
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-white/10 bg-white/[0.05]">
              <CircleUserRound className="h-4 w-4 text-zinc-400" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-left">{account ? account.username : "Create account"}</span>
          <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-500">{account ? "profile" : "new"}</span>
        </button>
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
        <Menu className="h-4 w-4" />
      </button>
      <span className="text-[13px] font-medium text-zinc-200">{title}</span>
      <span className="ml-auto font-mono text-[10px] uppercase text-zinc-600">{view}</span>
    </div>
  );
}
