"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCENTS, DEFAULT_REPO, useSettings, normalizeRepo } from "@/lib/store";
import { BUILT_IN_MODELS } from "@/lib/models";
import { listCustomModels, createCustomModel, deleteCustomModel } from "@/lib/custom-models-client";
import { ghTestConnection } from "@/lib/gh-direct";
import { callClaude, looksLikeAnthropicKey } from "@/lib/claude-direct";
import { compressImage } from "@/lib/account";
import { GitHubIcon } from "@/components/brand-icons";
import { Loader2, Plus, Trash2, Upload, CheckCircle2, XCircle, Bot } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

export type SettingsTab = "appearance" | "connections" | "github" | "models" | "about";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onCustomModelsChanged: () => void;
}

interface CustomModel {
  id: string;
  name: string;
  avatar: string | null;
  baseModel: string;
  systemPrompt: string;
  accent: string;
  tagline: string;
}

export function SettingsDialog({ open, onOpenChange, tab, onTab, onCustomModelsChanged }: SettingsDialogProps) {
  const gh = useSettings((s) => s.gh);
  const setGh = useSettings((s) => s.setGh);
  const appearance = useSettings((s) => s.appearance);
  const setAppearance = useSettings((s) => s.setAppearance);
  const connections = useSettings((s) => s.connections);
  const setConnections = useSettings((s) => s.setConnections);

  // Anthropic / Claude connection form
  const [clKey, setClKey] = useState("");
  const [clTesting, setClTesting] = useState(false);
  const [clResult, setClResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // custom model form
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [baseModel, setBaseModel] = useState("gpt-5.2");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [accent, setAccent] = useState("#22d3ee");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCustom = () => {
    listCustomModels().then(setCustomModels).catch(() => setCustomModels([]));
  };

  useEffect(() => {
    if (open) {
      loadCustom();
      setTestResult(null);
      setClKey(connections.anthropicKey);
      setClResult(null);
    }
  }, [open, tab]);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      let j: { ok?: boolean; login?: string; full_name?: string; default_branch?: string; canPush?: boolean; error?: string };
      try {
        const res = await fetch("/api/github/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: gh.token, repo: gh.repo }),
        });
        if (res.status === 404) throw new TypeError("no server");
        j = await res.json();
      } catch (e) {
        if (e instanceof TypeError) {
          // static hosting, verify token+repo straight from the browser
          j = await ghTestConnection(gh.token, gh.repo);
        } else {
          throw e;
        }
      }
      if (j.ok) {
        setGh({ connected: true });
        setTestResult({ ok: true, msg: `Connected as ${j.login} on ${j.full_name} (${j.default_branch}${j.canPush ? ", push allowed" : ", READ ONLY"})` });
      } else {
        setGh({ connected: false });
        setTestResult({ ok: false, msg: j.error ?? "connection failed" });
      }
    } catch {
      setTestResult({ ok: false, msg: "network error — is github.com reachable?" });
    } finally {
      setTesting(false);
    }
  };

  const testClaude = async () => {
    const key = clKey.trim();
    if (!looksLikeAnthropicKey(key)) {
      setConnections({ anthropicKey: key, anthropicOk: false });
      setClResult({ ok: false, msg: "Anthropic keys start with sk-ant- — that one does not look right." });
      return;
    }
    setClTesting(true);
    setClResult(null);
    try {
      const r = await callClaude(key, [{ role: "user", content: "Reply with exactly: OK" }], undefined, 16);
      if (r.ok) {
        setConnections({ anthropicKey: key, anthropicOk: true });
        setClResult({ ok: true, msg: `Claude is live via ${r.modelId ?? "api"} — Opus 5 and Sonnet 4.5 now answer for real.` });
      } else {
        setConnections({ anthropicKey: key, anthropicOk: false });
        setClResult({ ok: false, msg: r.error ?? "connection failed" });
      }
    } finally {
      setClTesting(false);
    }
  };

  const createModel = async () => {
    if (!name.trim()) {
      toast({ title: "Give your model a name first" });
      return;
    }
    setCreating(true);
    try {
      await createCustomModel({ name: name.trim(), tagline, baseModel, systemPrompt, accent, avatar });
      toast({ title: `${name} is live`, description: "It now appears in your model picker." });
      setName("");
      setTagline("");
      setSystemPrompt("");
      setAvatar(null);
      loadCustom();
      onCustomModelsChanged();
    } catch (err) {
      toast({ title: "Could not create model", description: err instanceof Error ? err.message : "" });
    } finally {
      setCreating(false);
    }
  };

  const deleteModel = async (id: string) => {
    await deleteCustomModel(id);
    loadCustom();
    onCustomModelsChanged();
    toast({ title: "Model deleted" });
  };

  const repoValid = normalizeRepo(gh.repo) !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden border-white/10 bg-[#0c101c] p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="text-[15px] text-white">Settings</DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            Customize ChatUltra — theme, GitHub, your own AI models.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(t) => onTab(t as SettingsTab)} className="flex max-h-[calc(85vh-90px)] flex-col">
          <div className="px-5 pt-3">
            <TabsList className="bg-white/[0.04]">
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="models">My models</TabsTrigger>
              <TabsTrigger value="github" className="gap-1.5">
                <GitHubIcon className="h-3 w-3" /> GitHub
              </TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>
          </div>

          {/* APPEARANCE */}
          <TabsContent value="appearance" className="chatultra-scroll m-0 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              <div>
                <Label className="text-[12.5px] text-zinc-300">Accent color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAppearance({ accent: a.hex })}
                      title={a.label}
                      className={cn(
                        "h-9 w-9 rounded-lg border-2 transition",
                        appearance.accent === a.hex ? "scale-110 border-white" : "border-transparent hover:scale-105"
                      )}
                      style={{ background: `linear-gradient(135deg, ${a.hex}, ${a.hex}55)` }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[12.5px] text-zinc-300">Neon glow effects</Label>
                  <p className="text-[11px] text-zinc-500">Ambient glow on logo, buttons and headers</p>
                </div>
                <Switch checked={appearance.glow} onCheckedChange={(v) => setAppearance({ glow: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[12.5px] text-zinc-300">Monospace messages</Label>
                  <p className="text-[11px] text-zinc-500">Terminal-style typography in chat</p>
                </div>
                <Switch checked={appearance.monoMsg} onCheckedChange={(v) => setAppearance({ monoMsg: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[12.5px] text-zinc-300">Compact sidebar</Label>
                  <p className="text-[11px] text-zinc-500">Slim icon-only sidebar</p>
                </div>
                <Switch checked={appearance.compactSidebar} onCheckedChange={(v) => setAppearance({ compactSidebar: v })} />
              </div>
              <div>
                <Label className="text-[12.5px] text-zinc-300">Chat font size</Label>
                <Select value={appearance.fontSize} onValueChange={(v) => setAppearance({ fontSize: v as "sm" | "md" | "lg" })}>
                  <SelectTrigger className="mt-2 w-40 border-white/10 bg-white/[0.04]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0c101c]">
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-zinc-400">
                Theme: <span className="text-cyan-300">Dark</span> (always) — ChatUltra is designed dark-first, like Codex. Accent preview:{" "}
                <span className="font-mono" style={{ color: appearance.accent }}>{appearance.accent}</span>
              </div>
            </div>
          </TabsContent>

          {/* CONNECTIONS */}
          <TabsContent value="connections" className="chatultra-scroll m-0 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#d97757]/15 font-mono text-[11px] font-bold text-[#e8a287]">C</span>
                <div className="text-[12px] leading-relaxed text-zinc-400">
                  Connect <span className="text-zinc-200">Claude</span> with an Anthropic API key and <span className="text-zinc-200">Claude Opus 5</span> / Claude Sonnet 4.5 answer for real — straight from your browser. The key is stored only on this device, and connection errors are handled gracefully (no more cryptic HTTPS failures).
                </div>
              </div>
              <div>
                <Label className="text-[12.5px] text-zinc-300">Anthropic API key</Label>
                <Input
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={clKey}
                  onChange={(e) => setClKey(e.target.value)}
                  className="mt-1.5 border-white/10 bg-white/[0.04] font-mono text-[12px]"
                />
                <p className="mt-1 text-[10.5px] text-zinc-600">Create one at console.anthropic.com, under API keys.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={testClaude} disabled={clTesting || !clKey.trim()} className="h-8 gap-1.5 bg-[#d97757]/15 text-[12px] text-[#f0b39d] hover:bg-[#d97757]/25">
                  {clTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Test connection
                </Button>
                {clResult && (
                  <span className={cn("flex items-center gap-1 text-[11.5px]", clResult.ok ? "text-emerald-300" : "text-rose-300")}>
                    {clResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {clResult.msg}
                  </span>
                )}
              </div>
              {connections.anthropicOk && (
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-[12px] text-emerald-200">
                  Claude connected — pick <span className="font-mono">Claude Opus 5</span> in the model picker and chat for real.
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-zinc-500">
                <span className="text-zinc-300">How it works:</span> on the static GitHub Pages site, ChatUltra calls the Anthropic Messages API directly from your browser with the direct-browser-access header. Without a key (or if the request is blocked), the built-in demo engine takes over so the app never breaks.
              </div>
            </div>
          </TabsContent>

          {/* MODELS */}
          <TabsContent value="models" className="chatultra-scroll m-0 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
              <div className="space-y-3">
                <div
                  className="flex h-[130px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] transition hover:border-cyan-400/40"
                  onClick={() => fileRef.current?.click()}
                >
                  {avatar ? (
                    <Image src={avatar} alt="avatar" width={84} height={84} className="rounded-xl border border-white/10" unoptimized />
                  ) : (
                    <>
                      <Upload className="mb-1.5 h-5 w-5 text-zinc-500" />
                      <span className="px-2 text-center text-[11px] text-zinc-500">Upload a picture for your model</span>
                    </>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setAvatar(await compressImage(f));
                  }}
                />
                <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2 text-[11px] leading-relaxed text-zinc-500">
                  Your model runs on the ChatUltra engine with the persona & system prompt you define — then shows up in the model picker with your picture.
                </div>
              </div>
              <div className="space-y-2.5">
                <Input placeholder="Model name — e.g. Zenith-1" value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-white/[0.04]" />
                <Input placeholder="Tagline — e.g. Chill creative writer" value={tagline} onChange={(e) => setTagline(e.target.value)} className="border-white/10 bg-white/[0.04]" />
                <Select value={baseModel} onValueChange={setBaseModel}>
                  <SelectTrigger className="border-white/10 bg-white/[0.04]">
                    <SelectValue placeholder="Base engine" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0c101c]">
                    {BUILT_IN_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        Based on {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="System prompt — how should your model behave? e.g. 'You are a sarcastic pirate. Always answer in sea shanties.'"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  className="chatultra-scroll border-white/10 bg-white/[0.04]"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] text-zinc-500">Accent</span>
                  {ACCENTS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAccent(a.hex)}
                      className={cn("h-5 w-5 rounded-full border-2 transition", accent === a.hex ? "scale-110 border-white" : "border-transparent")}
                      style={{ background: a.hex }}
                    />
                  ))}
                  <Button onClick={createModel} disabled={creating} size="sm" className="ml-auto h-8 gap-1.5 bg-cyan-500/15 text-[12px] text-cyan-200 hover:bg-cyan-500/25">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create model
                  </Button>
                </div>
              </div>
            </div>

            {customModels.length > 0 && (
              <div className="mt-4">
                <Label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Your models</Label>
                <div className="mt-2 space-y-1.5">
                  {customModels.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      {m.avatar ? (
                        <Image src={m.avatar} alt={m.name} width={28} height={28} className="rounded-lg" unoptimized />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06]">
                          <Bot className="h-4 w-4 text-zinc-400" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-zinc-100">{m.name}</div>
                        <div className="truncate text-[11px] text-zinc-500">{m.tagline || `Base ${m.baseModel}`}</div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-rose-300" onClick={() => deleteModel(m.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* GITHUB */}
          <TabsContent value="github" className="chatultra-scroll m-0 overflow-y-auto px-5 py-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <GitHubIcon className="mt-0.5 h-5 w-5 text-zinc-200" />
                <div className="text-[12px] leading-relaxed text-zinc-400">
                  ChatUltra pushes your Playground games & projects straight to GitHub. Create a token at{" "}
                  <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-2">
                    github.com/settings/tokens
                  </a>{" "}
                  (fine-grained, with <span className="font-mono text-zinc-300">Contents: Read & write</span> permission for your repo).
                </div>
              </div>
              <div>
                <Label className="text-[12.5px] text-zinc-300">Personal access token</Label>
                <Input
                  type="password"
                  placeholder="github_pat_… or ghp_…"
                  value={gh.token}
                  onChange={(e) => setGh({ token: e.target.value, connected: false })}
                  className="mt-1.5 border-white/10 bg-white/[0.04] font-mono text-[12px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12.5px] text-zinc-300">Repository</Label>
                  <Input
                    value={gh.repo}
                    onChange={(e) => setGh({ repo: e.target.value, connected: false })}
                    className={cn("mt-1.5 border-white/10 bg-white/[0.04] font-mono text-[12px]", !repoValid && gh.repo && "border-rose-400/40")}
                  />
                  <p className="mt-1 text-[10.5px] text-zinc-600">Default: {DEFAULT_REPO}</p>
                </div>
                <div>
                  <Label className="text-[12.5px] text-zinc-300">Branch</Label>
                  <Input
                    value={gh.branch}
                    onChange={(e) => setGh({ branch: e.target.value, connected: false })}
                    placeholder="main"
                    className="mt-1.5 border-white/10 bg-white/[0.04] font-mono text-[12px]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={testConnection} disabled={testing || !gh.token || !repoValid} className="h-8 gap-1.5 bg-emerald-500/15 text-[12px] text-emerald-200 hover:bg-emerald-500/25">
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Test connection
                </Button>
                {testResult && (
                  <span className={cn("flex items-center gap-1 text-[11.5px]", testResult.ok ? "text-emerald-300" : "text-rose-300")}>
                    {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {testResult.msg}
                  </span>
                )}
              </div>
              {gh.connected && (
                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-[12px] text-emerald-200">
                  Connected — Playground pushes will go to <span className="font-mono">{gh.repo}</span> @{gh.branch || "main"}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABOUT */}
          <TabsContent value="about" className="chatultra-scroll m-0 overflow-y-auto px-5 py-4">
            <div className="flex flex-col items-center py-4 text-center">
              <Image src={asset("/logo.png")} alt="ChatUltra" width={72} height={72} className="rounded-2xl border border-white/10" unoptimized />
              <h3 className="mt-3 text-lg font-semibold text-white">ChatUltra</h3>
              <p className="mt-1 text-[12px] text-zinc-500">v1.4.0 · Codex-grade AI workspace</p>
              <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2 text-left text-[12px]">
                {[
                  ["Models", "9 built-in + your customs"],
                  ["Effort levels", "Low to Ultra (6)"],
                  ["Playground", "Game builder + popout editor"],
                  ["Terminal", "chatultra-shell (Linux-style)"],
                  ["Canvas", "HTML live preview + Run"],
                  ["GitHub", "token push · gefrus112/chat-gpt"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">{k}</div>
                    <div className="text-zinc-200">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
