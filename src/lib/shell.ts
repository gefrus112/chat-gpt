"use client";

/**
 * ChatUltra virtual shell — a Linux-style command engine shared by the
 * chat command runner (bash code cards, /run slash command) and the
 * in-chat terminal drawer. Pure TS, no eval, fully sandboxed.
 */

export interface ShellFile {
  path: string;
  content: string;
}

export interface ShellLine {
  text: string;
  cls?: string;
}

export interface ShellResult {
  lines: ShellLine[];
  clear?: boolean;
}

export const PROJECT_FILES: ShellFile[] = [
  {
    path: "README.md",
    content:
      "# ultra-app\n\nBuilt with ChatUltra.\n\n## Commands\n\n- npm run dev    start the dev server\n- npm run build  build for production\n- git push       ship to GitHub\n",
  },
  {
    path: "index.html",
    content:
      "<!doctype html>\n<html>\n  <head>\n    <meta charset=\"utf-8\" />\n    <title>ultra-app</title>\n  </head>\n  <body>\n    <h1>Hello from ChatUltra</h1>\n    <script src=\"src/main.js\"></script>\n  </body>\n</html>\n",
  },
  {
    path: "src/main.js",
    content:
      "// entry point\nconsole.log(\"ultra-app started\");\n\ndocument.querySelector(\"h1\")?.addEventListener(\"click\", () => {\n  document.body.style.background = \"#0b0f1a\";\n});\n",
  },
  {
    path: "src/style.css",
    content:
      "body {\n  font-family: system-ui, sans-serif;\n  background: #0b0f1a;\n  color: #e4e4e7;\n}\n",
  },
  { path: "package.json", content: '{\n  "name": "ultra-app",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build"\n  }\n}\n' },
];

const C = {
  dim: "text-zinc-500",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  err: "text-rose-400",
  head: "text-cyan-300",
  plain: "text-zinc-300",
  strong: "text-zinc-100",
};

const HELP: [string, string][] = [
  ["help", "list available commands"],
  ["ls [dir]", "list files"],
  ["cd <dir>", "change directory"],
  ["pwd", "print working directory"],
  ["cat <file>", "print a file"],
  ["echo <text>", "print text"],
  ["touch/mkdir/rm", "create or remove files"],
  ["run", "start the dev server"],
  ["build", "build the project"],
  ["models", "list loaded AI models"],
  ["git status | log | push", "git operations (push uses your token)"],
  ["npm install | run dev", "package manager"],
  ["ps | df | uname", "system info"],
  ["neofetch", "system summary"],
  ["whoami | date", "session info"],
  ["history", "command history"],
  ["clear", "clear the screen"],
];

export class ChatShell {
  files: ShellFile[];
  cwd = "~";
  history: string[] = [];
  project: string;
  private pushHandler: (() => Promise<string>) | null = null;
  private modelsProvider: (() => string[]) | null = null;

  constructor(opts?: { project?: string; files?: ShellFile[] }) {
    this.project = opts?.project ?? "ultra-app";
    this.files = opts?.files ?? PROJECT_FILES.map((f) => ({ ...f }));
  }

  setPushHandler(fn: () => Promise<string>) {
    this.pushHandler = fn;
  }

  setModelsProvider(fn: () => string[]) {
    this.modelsProvider = fn;
  }

  private resolve(p: string): string {
    if (!p || p === ".") return this.cwd;
    let base: string[];
    if (p.startsWith("/")) base = p.split("/").filter(Boolean);
    else if (p.startsWith("~")) base = p.replace(/^~\/?/, "").split("/").filter(Boolean);
    else base = [...this.cwd.replace(/^~\/?/, "").split("/").filter(Boolean), ...p.split("/").filter(Boolean)];
    const out: string[] = [];
    for (const seg of base) {
      if (seg === "." || seg === "") continue;
      if (seg === "..") out.pop();
      else out.push(seg);
    }
    return "~" + (out.length ? "/" + out.join("/") : "");
  }

  private entries(dirPath: string): ShellFile[] {
    const dir = dirPath === "~" ? "" : dirPath.replace(/^~\/?/, "");
    if (!dir) return this.files;
    return this.files.filter((f) => f.path.startsWith(dir + "/"));
  }

  async run(raw: string): Promise<ShellResult> {
    const cmd = raw.trim();
    const out: ShellLine[] = [];
    if (!cmd) return { lines: out };
    this.history.push(cmd);

    // handle `a && b` sequentially
    if (cmd.includes("&&")) {
      for (const part of cmd.split("&&")) {
        const r = await this.run(part.trim());
        out.push(...r.lines);
        if (r.clear) return { lines: [], clear: true };
      }
      return { lines: out };
    }

    const [bin, ...args] = cmd.split(/\s+/);
    const arg = args.join(" ");

    switch (bin) {
      case "help":
        out.push({ text: "ChatUltra Shell — available commands:", cls: C.head });
        HELP.forEach(([c, d]) => out.push({ text: `  ${c.padEnd(24)} ${d}`, cls: C.plain }));
        break;

      case "ls": {
        const target = this.resolve(args[0] ?? "");
        const files = this.entries(target);
        if (!files.length) {
          out.push({ text: `ls: cannot access '${args[0] ?? target}': No such file or directory`, cls: C.err });
          break;
        }
        const dirs = new Set<string>();
        const filesHere: ShellFile[] = [];
        const prefix = target === "~" ? "" : target.replace(/^~\/?/, "") + "/";
        for (const f of files) {
          const rest = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : f.path;
          if (rest.includes("/")) dirs.add(rest.split("/")[0]);
          else filesHere.push(f);
        }
        const names = [
          ...[...dirs].map((d) => ({ name: d + "/", cls: C.head })),
          ...filesHere.map((f) => ({ name: f.path.split("/").pop() as string, cls: C.plain })),
        ].sort((a, b) => a.name.localeCompare(b.name));
        names.forEach((n) => out.push({ text: n.name.padEnd(24), cls: n.cls }));
        break;
      }

      case "cd": {
        const t = this.resolve(args[0] ?? "~");
        if (t !== "~" && !this.entries(t).length) out.push({ text: `cd: ${args[0]}: No such directory`, cls: C.err });
        else this.cwd = t;
        break;
      }

      case "pwd":
        out.push({ text: this.cwd.replace("~", `/home/ultra/${this.project}`), cls: C.plain });
        break;

      case "cat": {
        if (!args[0]) {
          out.push({ text: "cat: missing file operand", cls: C.err });
          break;
        }
        const p = this.resolve(args[0]);
        const prefix = p === "~" ? "" : p.replace(/^~\/?/, "");
        const f = this.files.find((x) => x.path === prefix);
        if (!f) out.push({ text: `cat: ${args[0]}: No such file or directory`, cls: C.err });
        else f.content.replace(/\n$/, "").split("\n").slice(0, 80).forEach((l) => out.push({ text: l, cls: C.plain }));
        break;
      }

      case "echo": {
        const s = arg.replace(/^["']|["']$/g, "");
        out.push({ text: s.replace(/\$\(date\)/g, new Date().toLocaleString()), cls: C.plain });
        break;
      }

      case "touch": {
        if (!args[0]) {
          out.push({ text: "touch: missing file operand", cls: C.err });
          break;
        }
        const p = this.resolve(args[0]).replace(/^~\/?/, "");
        if (!this.files.some((f) => f.path === p)) this.files.push({ path: p, content: "" });
        break;
      }

      case "mkdir": {
        if (!args[0]) {
          out.push({ text: "mkdir: missing operand", cls: C.err });
          break;
        }
        out.push({ text: `[ok] directory ${this.resolve(args[0])} created (virtual)`, cls: C.ok });
        break;
      }

      case "rm": {
        const target = args.find((a) => !a.startsWith("-"));
        if (!target) {
          out.push({ text: "rm: missing operand", cls: C.err });
          break;
        }
        const p = this.resolve(target).replace(/^~\/?/, "");
        const idx = this.files.findIndex((f) => f.path === p);
        if (idx < 0) out.push({ text: `rm: cannot remove '${target}': No such file`, cls: C.err });
        else {
          this.files.splice(idx, 1);
          out.push({ text: `removed '${target}'`, cls: C.dim });
        }
        break;
      }

      case "run":
        out.push({ text: "> ultra-app@1.0.0 dev", cls: C.dim });
        out.push({ text: "> vite", cls: C.dim });
        out.push({ text: "", cls: undefined });
        out.push({ text: "  VITE v5.4.0  ready in 287 ms", cls: C.ok });
        out.push({ text: "  ➜  Local:   http://localhost:5173/", cls: C.plain });
        out.push({ text: "  preview is live — open Run > Canvas to view it", cls: C.head });
        break;

      case "build": {
        out.push({ text: "building for production...", cls: C.dim });
        let total = 0;
        for (const f of this.files) {
          total += f.content.length;
          out.push({ text: `  compiling  ${f.path}`, cls: C.dim });
        }
        out.push({ text: "[ok] compiled successfully", cls: C.ok });
        out.push({ text: `[ok] bundle: ${(total / 1024).toFixed(1)} kB total`, cls: C.ok });
        break;
      }

      case "models": {
        out.push({ text: "loaded models:", cls: C.head });
        const list = this.modelsProvider?.() ?? [];
        list.forEach((m) => out.push({ text: `  - ${m}`, cls: C.plain }));
        if (!list.length) out.push({ text: "  (none)", cls: C.dim });
        break;
      }

      case "git": {
        const sub = args[0];
        if (sub === "status") {
          out.push({ text: "On branch main", cls: C.plain });
          out.push({ text: "Your branch is up to date with 'origin/main'.", cls: C.dim });
          out.push({ text: `Changes not staged for commit: ${this.files.length} file(s)`, cls: C.warn });
          this.files.forEach((f) => out.push({ text: `        modified:   ${f.path}`, cls: C.err }));
        } else if (sub === "log") {
          out.push({ text: "f3a9c21 (HEAD -> main, origin/main) feat: latest ChatUltra build", cls: C.warn });
          out.push({ text: "8d21b04 chore: project scaffold", cls: C.warn });
        } else if (sub === "push") {
          if (!this.pushHandler) {
            out.push({ text: "fatal: no remote configured — this shell cannot push here", cls: C.err });
            break;
          }
          out.push({ text: `Enumerating objects: ${this.files.length * 4}, done.`, cls: C.dim });
          out.push({ text: "Pushing to GitHub...", cls: C.plain });
          const res = await this.pushHandler();
          res.split("\n").forEach((l) => out.push({ text: l, cls: l.includes("[ok]") || l.includes("✓") ? C.ok : l.includes("fatal") || l.includes("[err]") ? C.err : C.plain }));
        } else {
          out.push({ text: `git: '${sub || ""}' is not a chatultra-shell command. try: git status | git log | git push`, cls: C.err });
        }
        break;
      }

      case "npm": {
        if (args[0] === "install" || args[0] === "i") {
          out.push({ text: "added 214 packages in 3s", cls: C.ok });
          out.push({ text: "42 packages are looking for funding", cls: C.dim });
        } else if (args[0] === "run" && args[1]) {
          const r = await this.run(args[1] === "dev" || args[1] === "start" ? "run" : args[1] === "build" ? "build" : "run");
          return r;
        } else if (!args[0]) {
          out.push({ text: "Usage: npm <install | run dev | run build>", cls: C.warn });
        } else {
          out.push({ text: `Unknown npm command "${args[0]}"`, cls: C.err });
        }
        break;
      }

      case "node":
        out.push({ text: args[0] === "-v" || args[0] === "--version" ? "v22.11.0" : "Welcome to Node.js v22.11.0. Type .exit or use `run` to start the app.", cls: C.plain });
        break;

      case "python":
      case "python3":
        out.push({ text: args[0]?.startsWith("-") ? "Python 3.12.7" : "Python 3.12.7 (ChatUltra, virtual)", cls: C.plain });
        break;

      case "ps":
        out.push({ text: "  PID TTY          TIME CMD", cls: C.dim });
        out.push({ text: "    1 pts/0    00:00:01 chatultra", cls: C.plain });
        out.push({ text: "   42 pts/0    00:00:00 vite", cls: C.plain });
        out.push({ text: "  133 pts/0    00:00:02 model-daemon", cls: C.plain });
        break;

      case "df":
        out.push({ text: "Filesystem      Size  Used Avail Use% Mounted on", cls: C.dim });
        out.push({ text: "ultrafs         512M   42M  470M   9% /", cls: C.plain });
        break;

      case "uname":
        out.push({ text: args[0] === "-a" ? "ChatUltra ultra-web 1.4.0 #1 SMP neural x86_64 GNU/Linux" : "Linux", cls: C.plain });
        break;

      case "neofetch":
        out.push({ text: "ultra@chatultra", cls: C.head });
        out.push({ text: "----------------", cls: C.dim });
        out.push({ text: "OS: ChatUltra OS 1.4 (web)", cls: C.plain });
        out.push({ text: "Shell: chatultra-shell 1.4.0", cls: C.plain });
        out.push({ text: "Terminal: ChatUltra Terminal (dark)", cls: C.plain });
        out.push({ text: "CPU: Neural Core i9 (virtual)", cls: C.plain });
        out.push({ text: "Memory: 42 MiB / 512 MiB", cls: C.plain });
        out.push({ text: `Files: ${this.files.length} in ${this.project}`, cls: C.plain });
        break;

      case "whoami":
        out.push({ text: "ultra", cls: C.plain });
        break;

      case "date":
        out.push({ text: new Date().toString(), cls: C.plain });
        break;

      case "history":
        this.history.slice(0, -1).forEach((h, i) => out.push({ text: `  ${String(i + 1).padStart(3)}  ${h}`, cls: C.plain }));
        if (this.history.length <= 1) out.push({ text: "(empty)", cls: C.dim });
        break;

      case "about":
        out.push({ text: `${this.project} — built with ChatUltra. ${this.files.length} file(s).`, cls: C.plain });
        break;

      case "clear":
        return { lines: [], clear: true };

      default:
        out.push({ text: `chatultra-shell: command not found: ${bin} — type help`, cls: C.err });
    }

    return { lines: out };
  }
}

/** very small helper used by the slash-command runner to render results as text */
export function resultToText(r: ShellResult): string {
  return r.lines.map((l) => l.text).join("\n");
}
