/**
 * Direct-from-browser GitHub REST helpers.
 * Used as a fallback when ChatUltra runs as a static website (no server-side
 * /api/github/* proxy) — api.github.com supports CORS with a personal token.
 */

export interface GhFile {
  path: string;
  content: string;
}

export interface GhTestResult {
  ok: boolean;
  login?: string;
  full_name?: string;
  default_branch?: string;
  canPush?: boolean;
  error?: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** Verify a token + repo pair, mirroring the server /api/github/test contract. */
export async function ghTestConnection(token: string, repo: string): Promise<GhTestResult> {
  try {
    const [meRes, repoRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers: authHeaders(token) }),
      fetch(`https://api.github.com/repos/${repo}`, { headers: authHeaders(token) }),
    ]);
    if (!meRes.ok) {
      return { ok: false, error: meRes.status === 401 ? "invalid token" : `GitHub API ${meRes.status}` };
    }
    const me = await meRes.json();
    if (!repoRes.ok) {
      return { ok: false, error: repoRes.status === 404 ? `repo ${repo} not found (or no access)` : `GitHub API ${repoRes.status}` };
    }
    const r = await repoRes.json();
    return {
      ok: true,
      login: me.login,
      full_name: r.full_name,
      default_branch: r.default_branch ?? "main",
      canPush: Boolean(r.permissions?.push),
    };
  } catch {
    return { ok: false, error: "network error — is api.github.com reachable?" };
  }
}

export interface GhPushArgs {
  token: string;
  repo: string;
  branch: string;
  message: string;
  files: GhFile[];
}

export interface GhPushResult {
  ok: boolean;
  url?: string;
  error?: string;
}

async function putFile(token: string, repo: string, branch: string, path: string, content: string, message: string): Promise<GhPushResult> {
  // existing file sha (needed for updates)
  let sha: string | undefined;
  const head = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`, {
    headers: authHeaders(token),
  });
  if (head.ok) {
    sha = ((await head.json()) as { sha?: string }).sha;
  } else if (head.status !== 404) {
    return { ok: false, error: `GitHub API ${head.status} on ${path}` };
  }
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), branch, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: j.message || `GitHub API ${res.status} on ${path}` };
  }
  const j = (await res.json()) as { commit?: { html_url?: string } };
  return { ok: true, url: j.commit?.html_url };
}

/** Push one or more files to a repo/branch from the browser. */
export async function ghPushFiles({ token, repo, branch, message, files }: GhPushArgs): Promise<GhPushResult> {
  try {
    let url: string | undefined;
    for (const f of files) {
      const r = await putFile(token, repo, branch || "main", f.path, f.content, message);
      if (!r.ok) return r;
      url = r.url;
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: "network error while pushing to api.github.com" };
  }
}
