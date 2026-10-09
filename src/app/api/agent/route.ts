import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 300;

const AGENT_SYSTEM = `You are ChatUltra Agent, an autonomous task-running agent inside ChatUltra. You break goals into concrete steps and execute them one at a time.

When asked to PLAN: reply with ONLY a JSON array (no markdown fence, no commentary) of 3-6 step objects:
[{"title":"short step name","detail":"what exactly you will produce in this step","output":"text|code|image"}]
output = "image" only when the step genuinely needs an illustration/asset; "code" when it produces code; otherwise "text".

When asked to EXECUTE a step: produce the full deliverable for that single step as Markdown. If output is code, give a complete runnable fenced code block. Be concrete and finish the work — do not ask questions.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = (body.mode ?? "plan").toString();
    const goal = (body.goal ?? "").toString().trim();
    if (!goal) return NextResponse.json({ error: "goal is required" }, { status: 400 });

    const zai = await ZAI.create();

    if (mode === "plan") {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: AGENT_SYSTEM },
          { role: "user", content: `GOAL: ${goal}\n\nProduce the JSON plan array now.` },
        ],
        thinking: { type: "disabled" },
      });
      const raw = completion.choices[0]?.message?.content ?? "[]";
      let steps: unknown = [];
      try {
        // strip accidental fences
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");
        steps = JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        steps = [{ title: "Complete the goal", detail: goal, output: "text" }];
      }
      if (!Array.isArray(steps) || !steps.length) {
        steps = [{ title: "Complete the goal", detail: goal, output: "text" }];
      }
      return NextResponse.json({ steps: (steps as { title: string; detail: string; output: string }[]).slice(0, 6) });
    }

    if (mode === "step") {
      const steps = Array.isArray(body.steps) ? body.steps : [];
      const index = parseInt(body.index, 10) || 0;
      const history: { step: number; title: string; result: string }[] = Array.isArray(body.history) ? body.history : [];
      const context = history
        .slice(-3)
        .map((h) => `--- Result of step ${h.step} (${h.title}) ---\n${h.result.slice(0, 1500)}`)
        .join("\n");

      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: AGENT_SYSTEM },
          {
            role: "user",
            content: `GOAL: ${goal}\n\nFULL PLAN:\n${steps.map((s: { title: string; detail: string; output: string }, i: number) => `${i + 1}. [${s.output}] ${s.title} — ${s.detail}`).join("\n")}\n\n${context ? `PREVIOUS RESULTS:\n${context}\n\n` : ""}EXECUTE step ${index + 1} now. Deliver the full result.`,
          },
        ],
        thinking: { type: "disabled" },
      });
      const result = completion.choices[0]?.message?.content ?? "";
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  } catch (err) {
    console.error("[agent]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "agent failed" }, { status: 500 });
  }
}
