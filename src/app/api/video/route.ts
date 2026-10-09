import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const maxDuration = 600;

const STYLES: Record<string, string> = {
  cinematic: "cinematic film still, dramatic lighting, shallow depth of field",
  anime: "anime key visual, vibrant colors, detailed background art",
  neon: "neon cyberpunk aesthetic, glowing lights, dark moody atmosphere",
  nature: "photorealistic nature documentary shot, golden hour light",
  retro: "retro synthwave illustration, grain texture, 80s palette",
  space: "epic space scene, nebula, volumetric light, sci-fi realism",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.prompt ?? "").toString().trim();
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

    const frameCount = Math.min(Math.max(parseInt(body.frames, 10) || 4, 2), 6);
    const style = STYLES[(body.style ?? "cinematic").toString()] ?? STYLES.cinematic;

    const zai = await ZAI.create();
    const frames: { index: number; base64: string }[] = [];

    for (let i = 0; i < frameCount; i++) {
      const shotHints = [
        "wide establishing shot",
        "medium shot, slightly closer",
        "close-up detail shot",
        "dramatic low angle",
        "overhead top-down angle",
        "final dramatic push-in shot",
      ];
      const framePrompt = `${prompt}. ${shotHints[i % shotHints.length]}, ${style}, consistent scene, same characters and location across the sequence, high quality, detailed, 16:9 widescreen composition. Shot ${i + 1} of ${frameCount} in a continuous video sequence.`;
      const response = await zai.images.generations.create({ prompt: framePrompt, size: "1344x768" });
      if (!response.data?.[0]?.base64) {
        throw new Error(`frame ${i + 1} generation failed`);
      }
      frames.push({ index: i, base64: response.data[0].base64 });
    }

    return NextResponse.json({ frames, prompt, style: body.style ?? "cinematic" });
  } catch (err) {
    console.error("[video]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "video generation failed" }, { status: 500 });
  }
}
