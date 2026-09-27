import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Signed callbacks from n8n (team contract: .claude/skills/integrating-n8n-webhooks, references/callback.md).
// Anyone can POST here, so nothing in the request is trusted before the HMAC check,
// and the steps below keep the contract's order.

const KNOWN_EVENTS = new Set(["quote-request"]);
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const started = Date.now();
  const { event } = await ctx.params;
  let raw = "";
  // Every answer, rejections included, is logged without body or signature: a silent 401 is hard to debug.
  const reply = (status: number, payload: Record<string, unknown>) => {
    logCallback(event, req.headers.get("x-correlation-id"), status, started, raw);
    return Response.json(payload, { status });
  };

  if (!KNOWN_EVENTS.has(event)) return reply(404, { error: "not_found" });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply(415, { error: "unsupported_media_type" });
  }
  // Cheap early refusal of a declared oversized body; the streamed limit below covers chunked requests.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return reply(413, { error: "too_large" });

  const text = await readRawBody(req.body); // the raw body: the signature covers exactly these bytes
  if (text === null) return reply(413, { error: "too_large" });
  raw = text;

  const timestamp = req.headers.get("x-n8n-timestamp") ?? "";
  const ts = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - ts) > WINDOW_SECONDS) return reply(401, { error: "unauthorized" });
  if (!verifySignature(timestamp, raw, req.headers.get("x-n8n-signature"))) return reply(401, { error: "unauthorized" });

  const key = req.headers.get("idempotency-key");
  if (!key) return reply(400, { error: "bad_request" });
  const claim = await db.claimCallbackKey(key);
  if (claim === "done") return reply(200, { duplicate: true });
  // Another delivery holds the key and may still fail and release it: ask n8n to retry, not "done".
  if (claim === "processing") return reply(409, { error: "in_progress" });

  try {
    const body = parseCallback(raw);
    // The key header is not signed: it must match the signed body, or a replayed body could take a new key.
    if (!body || body.event !== `${event}.completed` || key !== `${body.jobId}:${body.event}`) {
      await db.releaseCallbackKey(key);
      return reply(400, { error: "bad_request" });
    }
    const quote = await db.findQuoteForCallback(body.jobId, body.requestIdempotencyKey);
    if (!quote) {
      await db.releaseCallbackKey(key);
      return reply(400, { error: "unknown_job" });
    }
    // Saved before the response: after a 2xx n8n will not send this callback again.
    await db.finishQuote(quote.id, body.outcome, body.jobId);
    await db.completeCallbackKey(key);
  } catch {
    await db.releaseCallbackKey(key);
    return reply(500, { error: "internal" });
  }

  return reply(202, { ok: true });
}

// Reads the body as text but stops at MAX_BODY_BYTES: an unauthenticated sender cannot make us buffer more.
async function readRawBody(body: ReadableStream<Uint8Array> | null): Promise<string | null> {
  if (!body) return "";
  let bytes = 0;
  const limited = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > MAX_BODY_BYTES) controller.error(new Error("too_large"));
        else controller.enqueue(chunk);
      },
    }),
  );
  try {
    return await new Response(limited).text();
  } catch {
    return null;
  }
}

function verifySignature(timestamp: string, raw: string, header: string | null) {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type Callback = {
  event: string;
  jobId: string;
  requestIdempotencyKey: string | null;
  outcome: { status: "ready"; documentUrl: string } | { status: "failed"; errorCode: string };
};

// Untrusted JSON (even when signed): every field used is checked here.
function parseCallback(raw: string): Callback | null {
  try {
    const body = JSON.parse(raw);
    const data = body?.data;
    if (body?.version !== 1 || typeof body.event !== "string" || typeof data?.jobId !== "string") return null;
    const requestIdempotencyKey = typeof data.requestIdempotencyKey === "string" ? data.requestIdempotencyKey : null;
    const base = { event: body.event, jobId: data.jobId, requestIdempotencyKey };

    if (data.status === "completed") {
      const documentUrl = data.result?.documentUrl;
      // The link is rendered on a public page: only https, never javascript: and the like.
      return isHttpsUrl(documentUrl) ? { ...base, outcome: { status: "ready", documentUrl } } : null;
    }
    if (data.status === "failed") {
      const code = data.error?.code;
      return typeof code === "string" && /^[\w.-]{1,64}$/.test(code)
        ? { ...base, outcome: { status: "failed", errorCode: code } }
        : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function logCallback(event: string, correlationId: string | null, status: number, started: number, raw: string) {
  console.info("n8n.in", {
    event,
    correlationId,
    status,
    ms: Date.now() - started,
    bytes: Buffer.byteLength(raw),
    sha256: createHash("sha256").update(raw).digest("hex"),
  });
}
