import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const conversations = await db.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, title: true, model: true, effort: true, pinned: true, updatedAt: true },
  });
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const conv = await db.conversation.create({
    data: {
      title: (body.title ?? "New Chat").toString().slice(0, 60),
      model: (body.model ?? "gpt-5.2").toString(),
      effort: (body.effort ?? "high").toString(),
    },
  });
  return NextResponse.json({ conversation: conv });
}
