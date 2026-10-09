import { NextRequest, NextResponse } from "next/server";

function normalizeRepo(repo: string): { owner: string; name: string } | null {
  if (!repo) return null;
  const cleaned = repo.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  const parts = cleaned.split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], name: parts[1] };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = (body.token ?? "").toString().trim();
    const repo = normalizeRepo((body.repo ?? "").toString());
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
    if (!repo) return NextResponse.json({ error: "Invalid repository" }, { status: 400 });

    const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ChatUltra",
      },
    });
    if (res.status === 401) return NextResponse.json({ ok: false, error: "Bad credentials — check your token." }, { status: 200 });
    if (res.status === 404) return NextResponse.json({ ok: false, error: `Repository ${repo.owner}/${repo.name} not found or no access.` }, { status: 200 });
    if (!res.ok) return NextResponse.json({ ok: false, error: `GitHub API ${res.status}` }, { status: 200 });

    const j = await res.json();
    return NextResponse.json({
      ok: true,
      login: j?.owner?.login,
      full_name: j.full_name,
      default_branch: j.default_branch,
      private: j.private,
      canPush: j?.permissions?.push === true,
      html_url: j.html_url,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "test failed" }, { status: 200 });
  }
}
