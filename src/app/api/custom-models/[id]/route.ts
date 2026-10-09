import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.customModel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, string> = {};
  for (const k of ["name", "systemPrompt", "accent", "tagline", "baseModel"]) {
    if (typeof body[k] === "string") data[k] = body[k];
  }
  if (typeof body.avatar === "string") data.avatar = body.avatar;
  const model = await db.customModel.update({ where: { id }, data });
  return NextResponse.json({ model });
}
