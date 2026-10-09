"use client";

import { useEffect, useMemo, useState } from "react";
import { Sidebar, MobileTopBar, type View } from "@/components/sidebar";
import { ChatView } from "@/components/chat-view";
import { Playground } from "@/components/playground";
import { AgentView } from "@/components/agent-view";
import { VideoView } from "@/components/video-view";
import { SettingsDialog, type SettingsTab } from "@/components/settings-dialog";
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  const viewTitle: Record<View, string> = { chat: "NEXUS Chat", playground: "Game Playground", agent: "NEXUS Agent", video: "AI Video Studio" };

  return (
    <main
      className={cn(
        "flex h-screen overflow-hidden bg-[#070a12] text-zinc-100",
        appearance.monoMsg && "font-mono",
        `nx-fs-${appearance.fontSize}`
      )}
    >
      {/* sidebar (desktop) */}
      <div className="hidden lg:flex">
        <Sidebar
          view={view}
          onView={setView}
          conversationId={conversationId}
          onSelectConversation={setConversationId}
          refreshKey={historyKey}
          onOpenSettings={() => openSettings("appearance")}
        />
      </div>

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
            onModel={setModel}
            onEffort={(e: EffortDef["id"]) => setEffort(e)}
            onConversationCreated={() => setHistoryKey((k) => k + 1)}
            onOpenSettings={openSettings}
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
    </main>
  );
}
