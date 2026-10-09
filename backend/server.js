/**
 * ChatUltra — real backend server
 * ===============================
 * A small, dependency-light Express API that powers the ChatUltra web app
 * when you run it (the static GitHub Pages site connects to it from
 * Settings > Connections > ChatUltra Backend).
 *
 *   node server.js          (or: npm start)
 *
 * Endpoints
 * ---------
 *  GET  /api/health             -> status + which providers are configured
 *  GET  /api/models             -> public models (free: text + video)
 *  POST /api/chat               -> text generation (OpenAI / Anthropic / Google / free engine)
 *  POST /api/video              -> video generation (Dreamina 4 / Seedance 1 Pro / Kling Omni)
 *  POST /api/credits/checkout   -> Stripe Checkout session for a credit plan
 *  POST /api/account/sync       -> upsert profile to Supabase (+ Turnstile verify)
 *
 * Design rules
 * ------------
 *  - Every provider key in .env is OPTIONAL. Missing keys never crash the
 *    server; those routes fall back to the built-in free engine.
 *  - The four public models (luna-1, dreamina-4, seedance-1-pro, kling-omni)
 *    are FREE for text and video generation — they never require a key.
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

const PORT = process.env.PORT || 8787;
const BACKEND_KEY = process.env.CHATULTRA_BACKEND_KEY || "";
const VERSION = "2.0.0";

/* ------------------------- auth (soft) ------------------------- */
function auth(req, res, next) {
  if (!BACKEND_KEY) return next(); // open mode when no key is set
  const header = req.get("authorization") || "";
  if (header === `Bearer ${BACKEND_KEY}`) return next();
  return res.status(401).json({ error: "invalid backend key (Authorization: Bearer ...)" });
}

/* ------------------------- provider registry ------------------------- */
const FREE_TEXT_MODELS = ["luna-1"];
const FREE_VIDEO_MODELS = ["dreamina-4", "seedance-1-pro", "kling-omni"];

const providers = {
  openai: Boolean(process.env.OPENAI_API_KEY),
  anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  google: Boolean(process.env.GOOGLE_API_KEY),
  fal: Boolean(process.env.FAL_KEY),
  kling: Boolean(process.env.KLING_API_KEY && process.env.KLING_API_ID),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
  turnstile: Boolean(process.env.CLOUDFLARE_TURNSTILE_SECRET),
};

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    providers,
    freeModels: [...FREE_TEXT_MODELS, ...FREE_VIDEO_MODELS],
    paidModels: ["gpt-5.2", "claude-opus-5-1", "claude-opus-5", "claude-sonnet-4.5", "gemini-3-pro"],
    stripe: providers.stripe,
    supabase: providers.supabase,
  });
});

app.get("/api/models", (req, res) => {
  res.json({
    free: [
      { id: "luna-1", name: "Luna 1", kind: "text", cost: 0 },
      { id: "dreamina-4", name: "Dreamina 4", kind: "video", cost: 0 },
      { id: "seedance-1-pro", name: "Seedance 1 Pro", kind: "video", cost: 0 },
      { id: "kling-omni", name: "Kling Omni", kind: "video", cost: 0 },
    ],
    paid: [
      { id: "gpt-5.2", name: "GPT-5.2", kind: "text", cost: 5 },
      { id: "claude-opus-5-1", name: "Claude Opus 5.1", kind: "text", cost: 5 },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", kind: "text", cost: 5 },
      { id: "gemini-3-pro", name: "Gemini 3 Pro", kind: "text", cost: 5 },
    ],
  });
});

/* ------------------------- text generation ------------------------- */
const MODEL_ROUTES = {
  "gpt-5.2": { provider: "openai", id: "gpt-5.2" },
  "gpt-5.2-codex": { provider: "openai", id: "gpt-5.2-codex" },
  "claude-opus-5-1": { provider: "anthropic", id: "claude-opus-5-1" },
  "claude-opus-5": { provider: "anthropic", id: "claude-opus-5" },
  "claude-sonnet-4.5": { provider: "anthropic", id: "claude-sonnet-4-5" },
  "gemini-3-pro": { provider: "google", id: "gemini-3-pro" },
  "luna-1": { provider: "free", id: "luna-1" },
};

async function callOpenAI(messages, modelId) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096 }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `OpenAI ${r.status}`);
  return j.choices?.[0]?.message?.content || "";
}

async function callAnthropic(messages, modelId, system) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: modelId, max_tokens: 4096, system: system || undefined, messages }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Anthropic ${r.status}`);
  return (j.content || []).map((c) => c.text || "").join("");
}

async function callGoogle(messages, modelId) {
  const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || `Google ${r.status}`);
  return j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
}

/** Free engine — always available, powers Luna 1 (public model, zero credits). */
function freeEngine(messages) {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  return (
    `**Luna 1 (free public model)**\n\nYou said: _"${last.slice(0, 240)}"_\n\n` +
    "I am ChatUltra's in-house public model running on the free tier — text generation costs 0 credits. " +
    "For deeper flagship reasoning connect OPENAI_API_KEY or ANTHROPIC_API_KEY in backend/.env, " +
    "and the paid models answer with their real brains."
  );
}

app.post("/api/chat", auth, async (req, res) => {
  const { model = "luna-1", messages = [], system = "" } = req.body || {};
  const route = MODEL_ROUTES[model] || MODEL_ROUTES["luna-1"];
  try {
    let text = "";
    if (route.provider === "openai" && providers.openai) text = await callOpenAI(messages, route.id);
    else if (route.provider === "anthropic" && providers.anthropic) text = await callAnthropic(messages, route.id, system);
    else if (route.provider === "google" && providers.google) text = await callGoogle(messages, route.id);
    else text = freeEngine(messages);
    res.json({ ok: true, model, text });
  } catch (err) {
    // never hard-fail the UX — degrade to the free engine
    res.json({ ok: true, model, text: freeEngine(messages), notice: `provider fallback: ${err.message}` });
  }
});

/* ------------------------- video generation ------------------------- */
const VIDEO_HINTS = {
  "dreamina-4": { engine: "fal", model: "bytedance/dreamina/v4", look: "dreamy cinematic motion" },
  "seedance-1-pro": { engine: "fal", model: "bytedance/seedance-1-pro", look: "stable multi-shot cinematic sequence" },
  "kling-omni": { engine: "kling", model: "kling-v2-omni", look: "vivid physics-aware motion" },
};

async function callFal(prompt, falModel) {
  const r = await fetch(`https://fal.run/${falModel}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${process.env.FAL_KEY}` },
    body: JSON.stringify({ prompt, duration: "5s", aspect_ratio: "16:9" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.detail?.[0]?.msg || `fal ${r.status}`);
  const url = j.video?.url || j.videos?.[0]?.url || j.output?.[0];
  if (!url) throw new Error("no video url in fal response");
  return url;
}

async function callKling(prompt) {
  const auth = Buffer.from(`${process.env.KLING_API_ID}:${process.env.KLING_API_KEY}`).toString("base64");
  const base = "https://api.klingai.com/v1/videos/text2video";
  const create = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` },
    body: JSON.stringify({ model_name: "kling-v2", prompt, duration: 5, aspect_ratio: "16:9" }),
  });
  const cj = await create.json();
  const taskId = cj?.data?.task_id;
  if (!taskId) throw new Error(cj?.message || `Kling ${create.status}`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(`${base}/${taskId}`, { headers: { Authorization: `Bearer ${auth}` } });
    const pj = await poll.json();
    const status = pj?.data?.task_status;
    if (status === "succeed") return pj.data.task_result.videos[0].url;
    if (status === "failed") throw new Error("Kling render failed");
  }
  throw new Error("Kling render timed out");
}

/** Demo render — used when no video provider key is configured (still free). */
function demoVideo(prompt, model) {
  const seed = encodeURIComponent(prompt.slice(0, 64));
  const poster = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c1022"/><stop offset="1" stop-color="#1b1039"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="320" cy="180" r="90" fill="none" stroke="#22d3ee" stroke-opacity="0.6" stroke-width="2"/><text x="320" y="170" fill="#e2e8f0" font-family="monospace" font-size="20" text-anchor="middle">${model}</text><text x="320" y="205" fill="#94a3b8" font-family="monospace" font-size="13" text-anchor="middle">demo render - add FAL_KEY for real video</text></svg>`
  )}`;
  return {
    ok: true,
    model,
    demo: true,
    poster,
    storyboard: [
      `Shot 1 — wide establishing frame: ${seed}`,
      "Shot 2 — slow push-in, subject stays centered, light wraps from the left",
      "Shot 3 — close-up detail, shallow depth of field, film grain",
      "Shot 4 — final drift up and out, scene resolves",
    ],
    note: "Free public render (0 credits). Add FAL_KEY / KLING_API_KEY to backend/.env for real video output.",
  };
}

app.post("/api/video", auth, async (req, res) => {
  const { model = "kling-omni", prompt = "" } = req.body || {};
  if (!prompt.trim()) return res.status(400).json({ error: "prompt is required" });
  const hint = VIDEO_HINTS[model] || VIDEO_MODELS_DEFAULT(model);
  try {
    let url = null;
    if (hint.engine === "fal" && providers.fal) url = await callFal(prompt, hint.model);
    else if (hint.engine === "kling" && providers.kling) url = await callKling(prompt);
    if (url) return res.json({ ok: true, model, demo: false, videoUrl: url });
    return res.json(demoVideo(prompt, model));
  } catch (err) {
    return res.json({ ...demoVideo(prompt, model), notice: `provider fallback: ${err.message}` });
  }
});

function VIDEO_MODELS_DEFAULT(model) {
  return { engine: "fal", model: "bytedance/seedance-1-pro", look: "cinematic" };
}

/* ------------------------- Stripe credits ------------------------- */
app.post("/api/credits/checkout", auth, async (req, res) => {
  const { plan = "starter", credits = 500, amount = 5 } = req.body || {};
  if (!providers.stripe) {
    return res.status(400).json({ error: "STRIPE_SECRET_KEY not configured in backend/.env" });
  }
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(amount * 100),
            product_data: { name: `ChatUltra ${plan} plan — ${credits} credits` },
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL || "https://example.com/success",
      cancel_url: process.env.STRIPE_CANCEL_URL || "https://example.com/cancel",
      metadata: { plan, credits: String(credits) },
    });
    res.json({ ok: true, url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ------------------------- Supabase account sync + Turnstile ------------------------- */
async function verifyTurnstile(token) {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  if (!secret) return { skipped: true, ok: true };
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token || "" }),
    });
    const j = await r.json();
    return { ok: Boolean(j.success), skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}

app.post("/api/account/sync", auth, async (req, res) => {
  const { account, turnstileToken } = req.body || {};
  if (!account?.username) return res.status(400).json({ error: "account.username is required" });
  const ts = await verifyTurnstile(turnstileToken);
  if (!ts.ok) return res.status(403).json({ error: "Turnstile verification failed" });
  if (!providers.supabase) {
    return res.json({ ok: true, stored: false, note: "SUPABASE_URL / SUPABASE_SERVICE_KEY not configured — accepted but not stored." });
  }
  try {
    const { createClient } = require("@supabase/supabase-js");
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { error } = await db.from("accounts").upsert(
      {
        username: account.username,
        bio: account.bio || "",
        website: account.website || "",
        avatar: account.avatar || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username" }
    );
    if (error) throw error;
    res.json({ ok: true, stored: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`ChatUltra backend v${VERSION} on http://localhost:${PORT}`);
  console.log(`providers: ${Object.entries(providers).filter(([, v]) => v).map(([k]) => k).join(", ") || "none — free public models only"}`);
});
