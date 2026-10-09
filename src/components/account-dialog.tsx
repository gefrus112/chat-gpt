"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount, compressImage, hashPassword, type Account } from "@/lib/account";
import { ImagePlus, Loader2, LogOut, CheckCircle2, UserRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AccountDialog({ open, onOpenChange }: AccountDialogProps) {
  const account = useAccount((s) => s.account);
  const signIn = useAccount((s) => s.signIn);
  const update = useAccount((s) => s.update);
  const setPassHash = useAccount((s) => s.setPassHash);
  const signOut = useAccount((s) => s.signOut);

  // create / sign-in form
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // profile edit form
  const [pUsername, setPUsername] = useState("");
  const [pBio, setPBio] = useState("");
  const [pWebsite, setPWebsite] = useState("");
  const [pAvatar, setPAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (open && account) {
      setPUsername(account.username);
      setPBio(account.bio);
      setPWebsite(account.website);
      setPAvatar(account.avatar);
    }
  }, [open, account]);

  const pickAvatar = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast({ title: "Please pick an image file" });
      return;
    }
    setAvatar(await compressImage(f));
  };

  const create = async () => {
    const name = username.trim();
    if (!name) return toast({ title: "Pick a username first" });
    if (name.length > 24) return toast({ title: "Username is too long (24 max)" });
    if (password.length < 4) return toast({ title: "Password needs at least 4 characters" });
    setWorking(true);
    try {
      const passHash = await hashPassword(password);
      const acc: Account & { passHash: string } = {
        username: name,
        bio: bio.trim(),
        website: website.trim(),
        avatar,
        createdAt: new Date().toISOString(),
        passHash,
      };
      signIn(acc);
      setPassHash(passHash);
      toast({ title: `Welcome, ${name}`, description: "Your ChatUltra profile is ready." });
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  const login = async () => {
    const name = username.trim();
    if (!name || !password) return toast({ title: "Enter your username and password" });
    setWorking(true);
    try {
      const raw = localStorage.getItem("chatultra-account");
      const stored = raw ? (JSON.parse(raw)?.state?.account as (Account & { passHash?: string }) | null) : null;
      if (!stored || stored.username.toLowerCase() !== name.toLowerCase()) {
        toast({ title: "No local account with that username", description: "Create one first — accounts live in this browser." });
        return;
      }
      const h = await hashPassword(password);
      if (stored.passHash && stored.passHash !== h) {
        toast({ title: "Wrong password" });
        return;
      }
      const { passHash: _drop, ...rest } = stored;
      signIn({ ...rest, passHash: stored.passHash });
      toast({ title: `Signed in as ${stored.username}` });
      onOpenChange(false);
    } finally {
      setWorking(false);
    }
  };

  const saveProfile = () => {
    const name = pUsername.trim();
    if (!name) return toast({ title: "Username cannot be empty" });
    update({ username: name, bio: pBio.trim(), website: pWebsite.trim(), avatar: pAvatar });
    toast({ title: "Profile saved" });
    onOpenChange(false);
  };

  const memberSince = account ? new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden border-white/10 bg-[#0c101c] p-0 sm:max-w-[480px]">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="text-[15px] text-white">{account ? "Your profile" : "Account"}</DialogTitle>
          <DialogDescription className="text-[12px] text-zinc-500">
            {account ? "Update your picture, bio and website link." : "Create a local ChatUltra account — it lives in your browser, nothing is sent to a server."}
          </DialogDescription>
        </DialogHeader>

        {!account ? (
          <Tabs value={mode} onValueChange={(m) => setMode(m as "create" | "signin")} className="px-5 py-4">
            <TabsList className="bg-white/[0.04]">
              <TabsTrigger value="create">Create account</TabsTrigger>
              <TabsTrigger value="signin">Sign in</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-4 space-y-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/[0.02] transition hover:border-cyan-400/40"
                  title="Upload a profile picture"
                >
                  {avatar ? (
                    <Image src={avatar} alt="avatar" width={76} height={76} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5 text-zinc-500" />
                      <span className="mt-1 text-[9.5px] text-zinc-500">upload</span>
                    </>
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <Input placeholder="Username — e.g. gefrus112" value={username} onChange={(e) => setUsername(e.target.value)} className="border-white/10 bg-white/[0.04]" />
                  <Input type="password" placeholder="Password (4+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} className="border-white/10 bg-white/[0.04]" />
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0])} />
              <Textarea placeholder="Bio — a line or two about you" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="border-white/10 bg-white/[0.04]" />
              <Input placeholder="Website link — https://yoursite.dev" value={website} onChange={(e) => setWebsite(e.target.value)} className="border-white/10 bg-white/[0.04]" />
              <Button onClick={create} disabled={working} className="h-9 w-full gap-1.5 bg-gradient-to-r from-cyan-400/20 to-violet-500/20 text-[13px] text-cyan-100 hover:from-cyan-400/30 hover:to-violet-500/30">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Create account
              </Button>
            </TabsContent>

            <TabsContent value="signin" className="mt-4 space-y-3">
              <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} className="border-white/10 bg-white/[0.04]" />
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border-white/10 bg-white/[0.04]" />
              <Button onClick={login} disabled={working} className="h-9 w-full gap-1.5 bg-cyan-500/15 text-[13px] text-cyan-100 hover:bg-cyan-500/25">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />} Sign in
              </Button>
              <p className="text-[11px] leading-relaxed text-zinc-600">
                Accounts are stored locally in this browser (password hashed). Clearing site data removes the profile.
              </p>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl border border-white/10 transition hover:border-cyan-400/40"
                title="Change profile picture"
              >
                {pAvatar ? (
                  <Image src={pAvatar} alt="avatar" width={76} height={76} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-white/[0.05]">
                    <UserRound className="h-7 w-7 text-zinc-500" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] text-zinc-300">change</span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-white">{account.username}</div>
                <div className="text-[11px] text-zinc-500">Member since {memberSince}</div>
                {account.website && (
                  <a href={account.website} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-[11.5px] text-cyan-300 underline underline-offset-2">
                    {account.website}
                  </a>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPAvatar(await compressImage(f));
              }}
            />
            <div>
              <Label className="text-[12px] text-zinc-300">Username</Label>
              <Input value={pUsername} onChange={(e) => setPUsername(e.target.value)} className="mt-1 border-white/10 bg-white/[0.04]" />
            </div>
            <div>
              <Label className="text-[12px] text-zinc-300">Bio</Label>
              <Textarea value={pBio} onChange={(e) => setPBio(e.target.value)} rows={2} placeholder="A line or two about you" className="mt-1 border-white/10 bg-white/[0.04]" />
            </div>
            <div>
              <Label className="text-[12px] text-zinc-300">Website link</Label>
              <Input value={pWebsite} onChange={(e) => setPWebsite(e.target.value)} placeholder="https://yoursite.dev" className="mt-1 border-white/10 bg-white/[0.04]" />
            </div>
            <div className={cn("flex items-center gap-2 pt-1")}>
              <Button onClick={saveProfile} className="h-9 gap-1.5 bg-cyan-500/15 text-[13px] text-cyan-100 hover:bg-cyan-500/25">
                <CheckCircle2 className="h-4 w-4" /> Save profile
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  signOut();
                  toast({ title: "Signed out" });
                }}
                className="h-9 gap-1.5 text-[13px] text-zinc-400 hover:bg-white/[0.05] hover:text-rose-300"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
