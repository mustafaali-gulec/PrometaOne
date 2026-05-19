/**
 * Claude AI Proxy Route
 * ----------------------
 * Frontend'in AI asistanı için backend proxy.
 * 
 * Neden bu var:
 *  - Tarayıcı doğrudan api.anthropic.com çağırırsa CORS engeli
 *  - API key güvenli şekilde sunucuda saklanır
 *  - Rate limiting backend'de yapılabilir
 * 
 * Frontend → POST /v1/ai/chat → bu route → Anthropic API → response
 */
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const aiProxy = new Hono();

// Anthropic API endpoint
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

aiProxy.post(
  "/chat",
  zValidator("json", z.object({
    model: z.string().default("claude-sonnet-4-20250514"),
    max_tokens: z.number().min(1).max(4096).default(1000),
    system: z.string().optional(),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })).min(1),
  })),
  async (c) => {
    const body = c.req.valid("json");
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.warn("[AI Proxy] ANTHROPIC_API_KEY tanımlı değil");
      throw new HTTPException(503, {
        message: "AI servisi yapılandırılmamış. Backend .env dosyasında ANTHROPIC_API_KEY tanımlayın.",
      });
    }

    try {
      const upstreamResponse = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      const rawText = await upstreamResponse.text();

      if (!upstreamResponse.ok) {
        console.error(`[AI Proxy] Anthropic ${upstreamResponse.status}:`, rawText.slice(0, 500));
        let errMsg = `Anthropic API hatası (${upstreamResponse.status})`;
        try {
          const errJson = JSON.parse(rawText);
          errMsg = errJson?.error?.message || errMsg;
        } catch {}
        throw new HTTPException(upstreamResponse.status as any, { message: errMsg });
      }

      // Pass-through: Anthropic'in cevabını aynen frontend'e ilet
      const result = JSON.parse(rawText);
      return c.json(result);
    } catch (err: any) {
      if (err instanceof HTTPException) throw err;
      console.error("[AI Proxy] Beklenmedik hata:", err);
      throw new HTTPException(500, {
        message: `AI proxy hatası: ${err.message || "bilinmiyor"}`,
      });
    }
  }
);

// Health check
aiProxy.get("/status", (c) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return c.json({
    available: hasKey,
    model: "claude-sonnet-4",
    message: hasKey
      ? "AI servisi aktif"
      : "ANTHROPIC_API_KEY backend .env dosyasında tanımlı değil",
  });
});

export default aiProxy;
