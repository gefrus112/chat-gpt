import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { findEffort, BUILT_IN_MODELS } from "@/lib/models";

export const maxDuration = 300;

const BASE_PROMPT = `You are ChatUltra AI, the assistant inside "ChatUltra" — a dark, Codex-style AI development studio. You are capable, friendly and precise.

Formatting rules:
- Always answer in Markdown.
- ALWAYS wrap code in fenced code blocks with a language tag, e.g. \`\`\`html, \`\`\`tsx, \`\`\`python.
- For any request that involves a web page, game, animation or UI, produce a COMPLETE single-file HTML document (inline CSS/JS, no external imports except CDN links) inside one \`\`\`html block so the app can live-preview it.`;

function buildSystemPrompt(flavor: string, effortDirective: string) {
  return `${BASE_PROMPT}\n\nModel persona: ${flavor}\nEffort level directive: ${effortDirective}`;
}

function chunkText(text: string): string[] {
  const parts = text.split(/(\s+)/);
  const chunks: string[] = [];
  let buf = "";
  let count = 0;
  for (const p of parts) {
    buf += p;
    if (/\S/.test(p)) count++;
    if (count >= 3) {
      chunks.push(buf);
      buf = "";
      count = 0;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = (body.message ?? "").toString();
    if (!message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const modelId: string = (body.model ?? "gpt-5.2").toString();
    const effortId: string = (body.effort ?? "high").toString();
    const effort = findEffort(effortId);

    // resolve model flavor (built-in or custom)
    let flavor = "You are a helpful general-purpose AI model.";
    const builtin = BUILT_IN_MODELS.find((m) => m.id === modelId);
    if (builtin) {
      flavor = builtin.flavor;
    } else if (modelId.startsWith("custom:")) {
      const cm = await db.customModel.findUnique({ where: { id: modelId.slice(7) } });
      if (cm) {
        flavor = `You are "${cm.name}", a custom AI model created by the user in ChatUltra.${cm.systemPrompt ? " " + cm.systemPrompt : ""}${cm.tagline ? ` (About you: ${cm.tagline})` : ""}`;
      }
    }

    // find or create conversation
    let conversationId: string | null = body.conversationId ?? null;
    if (conversationId) {
      const exists = await db.conversation.findUnique({ where: { id: conversationId } });
      if (!exists) conversationId = null;
    }
    if (!conversationId) {
      const conv = await db.conversation.create({
        data: {
          title: message.trim().slice(0, 48) || "New Chat",
          model: modelId,
          effort: effortId,
        },
      });
      conversationId = conv.id;
    }

    const history = await db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 40,
    });

    await db.message.create({
      data: { conversationId, role: "user", content: message, model: modelId, effort: effortId },
    });

    const chatMessages = [
      { role: "assistant" as const, content: buildSystemPrompt(flavor, effort.directive) },
      ...history.map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: chatMessages,
      thinking: { type: "disabled" },
    });
    const full = completion.choices[0]?.message?.content ?? "(no response)";

    await db.message.create({
      data: { conversationId: conversationId!, role: "assistant", content: full, model: modelId, effort: effortId },
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        send({ type: "meta", conversationId, model: modelId, effort: effortId });
        const chunks = chunkText(full);
        for (const c of chunks) {
          send({ type: "delta", text: c });
          await sleep(12);
        }
        send({ type: "done" });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("[chat] error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "chat failed" }, { status: 500 });
  }
}
