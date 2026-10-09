"use client";

import { useEffect, useMemo, useState } from "react";
import { IconRail, HistoryFlyout, Sidebar, MobileTopBar, type View } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";
import { Playground } from "@/components/playground";
import { AgentView } from "@/components/agent-view";
import { VideoView } from "@/components/video-view";
import { SettingsDialog, type SettingsTab } from "@/components/settings-dialog";
import { AccountDialog } from "@/components/account-dialog";
import { CreditsDialog } from "@/components/credits-dialog";
import { BUILT_IN_MODELS, customToModelDef, type EffortDef, type ModelDef } from "@/lib/models";
import { useSettings } from "@/lib/store";
import { useCustomModels } from "@/components/model-picker";
import { cn } from "@/lib/utils";

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [customKey, setCustomKey] = useState(0);
  const [model, setModel] = useState("claude-sonnet-4.5");
  const [effort, setEffort] = useState("high");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const [accountOpen, setAccountOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [railHistory, setRailHistory] = useState(false);
  const [terminalSignal, setTerminalSignal] = useState(0);

  const appearance = useSettings((s) => s.appearance);
  const customModels = useCustomModels(customKey);

  // apply accent + glow to document root
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--nx-accent", appearance.accent);
    document.body.classList.toggle("nx-glow-off", !appearance.glow);
  }, [appearance.accent, appearance.glow]);

  const models: (ModelDef & { avatar?: string | null })[] = useMemo(
    () => [...BUILT_IN_MODELS, ...customModels],
    [customModels]
  );

  const openSettings = (tab: SettingsTab = "appearance") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const newChat = () => {
    setConversationId(null);
    setView("chat");
  };

  const viewTitle: Record<View, string> = { chat: "ChatUltra Chat", playground: "Game Playground", agent: "ChatUltra Agent", video: "AI Video Studio" };

  return (
    <main
      className={cn(
        "relative flex h-screen overflow-hidden bg-[#070a12] text-zinc-100",
        appearance.monoMsg && "font-mono",
        `nx-fs-${appearance.fontSize}`
      )}
    >
      {/* icon rail (desktop) */}
      <div className="hidden lg:flex">
        <IconRail
          view={view}
          onView={setView}
          onNewChat={newChat}
          onToggleHistory={() => setRailHistory((h) => !h)}
          historyOpen={railHistory}
          onOpenTerminal={() => setTerminalSignal((n) => n + 1)}
          onOpenSettings={() => openSettings("appearance")}
          onOpenAccount={() => setAccountOpen(true)}
        />
      </div>

      {/* history flyout next to the rail */}
      <HistoryFlyout
        open={railHistory}
        onClose={() => setRailHistory(false)}
        conversationId={conversationId}
        onSelectConversation={(id) => {
          setConversationId(id);
          setView("chat");
        }}
        refreshKey={historyKey}
      />

      {/* sidebar (mobile drawer) */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", menuOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div
          className={cn("absolute inset-0 bg-black/60 transition-opacity", menuOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMenuOpen(false)}
        />
        <div className={cn("absolute left-0 top-0 h-full transition-transform duration-200", menuOpen ? "translate-x-0" : "-translate-x-full")}>
          <Sidebar
            view={view}
            onView={(v) => {
              setView(v);
              setMenuOpen(false);
            }}
            conversationId={conversationId}
            onSelectConversation={(id) => {
              setConversationId(id);
              setMenuOpen(false);
            }}
            refreshKey={historyKey}
            onOpenSettings={() => openSettings("appearance")}
            onOpenAccount={() => setAccountOpen(true)}
            onOpenTerminal={() => {
              setTerminalSignal((n) => n + 1);
              setView("chat");
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar
          view={view}
          onMenu={() => setMenuOpen(true)}
          title={viewTitle[view]}
        />
        {view === "chat" && (
          <ChatView
            models={models}
            model={model}
            effort={effort}
            conversationId={conversationId}
            terminalSignal={terminalSignal}
            onModel={setModel}
            onEffort={(e: EffortDef["id"]) => setEffort(e)}
            onConversationCreated={() => setHistoryKey((k) => k + 1)}
            onOpenSettings={openSettings}
            onOpenAccount={() => setAccountOpen(true)}
            onOpenCredits={() => setCreditsOpen(true)}
            onNewChat={newChat}
          />
        )}
        {view === "playground" && <Playground refreshKey={customKey} />}
        {view === "agent" && <AgentView />}
        {view === "video" && <VideoView />}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tab={settingsTab}
        onTab={setSettingsTab}
        onCustomModelsChanged={() => setCustomKey((k) => k + 1)}
      />

      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} />

      <CreditsDialog open={creditsOpen} onOpenChange={setCreditsOpen} />
    </main>
  );
}
