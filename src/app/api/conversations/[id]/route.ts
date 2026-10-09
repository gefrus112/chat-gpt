import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { title?: string; pinned?: boolean } = {};
  if (typeof body.title === "string") data.title = body.title.slice(0, 60);
  if (typeof body.pinned === "boolean") data.pinned = body.pinned;
  const conversation = await db.conversation.update({ where: { id }, data });
  return NextResponse.json({ conversation });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
