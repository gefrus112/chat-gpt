import { NextRequest, NextResponse } from "next/server";

function normalizeRepo(repo: string): { owner: string; name: string } | null {
  if (!repo) return null;
  const cleaned = repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
}

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
  "User-Agent": "ChatUltra",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = (body.token ?? "").toString().trim();
    const repoRaw = (body.repo ?? "").toString();
    const branch = (body.branch ?? "").toString().trim() || null;
    const message = ((body.message ?? "Push from ChatUltra").toString() || "Push from ChatUltra").slice(0, 200);
    const files: { path: string; content: string }[] = Array.isArray(body.files) ? body.files : [];

    if (!token) return NextResponse.json({ error: "GitHub token missing. Add one in Settings > GitHub." }, { status: 400 });
    const repo = normalizeRepo(repoRaw);
    if (!repo) return NextResponse.json({ error: `Invalid repository: "${repoRaw}"` }, { status: 400 });
    if (!files.length) return NextResponse.json({ error: "No files to push" }, { status: 400 });

    // verify repo access + default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
      headers: ghHeaders(token),
    });
    if (repoRes.status === 401) {
      return NextResponse.json({ error: "Bad credentials — check your GitHub token." }, { status: 401 });
    }
    if (repoRes.status === 404) {
      return NextResponse.json({ error: `Repository ${repo.owner}/${repo.name} not found (or token has no access to it).` }, { status: 404 });
    }
    if (!repoRes.ok) {
      const t = await repoRes.text();
      return NextResponse.json({ error: `GitHub API error ${repoRes.status}: ${t.slice(0, 200)}` }, { status: 502 });
    }
    const repoJson = await repoRes.json();
    const branchName = branch || repoJson.default_branch || "main";
    const permissions = repoJson.permissions ?? {};
    if (permissions.push === false) {
      return NextResponse.json({ error: "Token does not have push permission to this repository." }, { status: 403 });
    }

    const results: { path: string; ok: boolean; url?: string; error?: string }[] = [];
    for (const file of files) {
      const path = file.path.replace(/^\/+/, "");
      if (!path) continue;
      try {
        // check for existing file to get sha
        let sha: string | undefined;
        const getRes = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branchName)}`,
          { headers: ghHeaders(token) }
        );
        if (getRes.ok) {
          const j = await getRes.json();
          if (j && typeof j.sha === "string") sha = j.sha;
        }
        const putRes = await fetch(
          `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${encodeURIComponent(path)}`,
          {
            method: "PUT",
            headers: ghHeaders(token),
            body: JSON.stringify({
              message,
              content: Buffer.from(file.content, "utf-8").toString("base64"),
              branch: branchName,
              ...(sha ? { sha } : {}),
            }),
          }
        );
        if (putRes.ok) {
          const j = await putRes.json();
          results.push({ path, ok: true, url: j?.content?.html_url });
        } else {
          const t = await putRes.text();
          results.push({ path, ok: false, error: `${putRes.status}: ${t.slice(0, 160)}` });
        }
      } catch (e) {
        results.push({ path, ok: false, error: e instanceof Error ? e.message : "upload failed" });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: okCount === results.length,
      pushed: okCount,
      total: results.length,
      branch: branchName,
      repo: `${repo.owner}/${repo.name}`,
      commitUrl: repoJson.html_url ? `${repoJson.html_url}/tree/${branchName}` : null,
      results,
    });
  } catch (err) {
    console.error("[github push]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "push failed" }, { status: 500 });
  }
}
