import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const models = await db.customModel.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ models });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = (body.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const avatar = typeof body.avatar === "string" ? body.avatar : null;
  if (avatar && avatar.length > 1_500_000) {
    return NextResponse.json({ error: "avatar image too large (max ~1MB)" }, { status: 413 });
  }

  const model = await db.customModel.create({
    data: {
      name: name.slice(0, 40),
      avatar,
      baseModel: (body.baseModel ?? "gpt-5.2").toString(),
      systemPrompt: (body.systemPrompt ?? "").toString().slice(0, 2000),
      accent: (body.accent ?? "#22d3ee").toString(),
      tagline: (body.tagline ?? "").toString().slice(0, 80),
    },
  });
  return NextResponse.json({ model });
}
