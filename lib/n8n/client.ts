import "server-only";
import { createHash } from "node:crypto";

// The only module that calls n8n webhooks (team contract: .claude/skills/integrating-n8n-webhooks).

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 retries = 3 attempts

export type TriggerResult =
  | { ok: true; status: number; jobId: string | null }
  | { ok: false; status: number | null };

export async function triggerWorkflow(
  event: string,
  data: Record<string, unknown>,
  ids: { idempotencyKey: string; correlationId: string },
  options: { callback?: boolean } = {},
): Promise<TriggerResult> {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const url = webhookUrl(base, event);
  let callbackUrl: string | undefined;
  try {
    if (options.callback) callbackUrl = new URL(`/api/n8n/${event}`, process.env.APP_BASE_URL).toString();
  } catch {} // a missing or malformed APP_BASE_URL leaves callbackUrl undefined and is reported below
  if (!url || !token || (options.callback && !callbackUrl)) {
    console.error("n8n.out", { event, error: "not_configured" }); // no throw: the caller marks the record failed
    return { ok: false, status: null };
  }
  const body = JSON.stringify({ version: 1, event, data, ...(callbackUrl ? { callbackUrl } : {}) });

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual", // never follow: a redirect would carry the body and x-n8n-token to another address
        headers: {
          "content-type": "application/json",
          "x-n8n-token": token,
          "idempotency-key": ids.idempotencyKey,
          "x-correlation-id": ids.correlationId,
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS), // a fresh signal for every attempt
      });
      status = res.status;
      logCall(event, ids.correlationId, status, started, attempt, body);
      if (res.status === 202) {
        const jobId = (await res.json().catch(() => null))?.job_id;
        if (typeof jobId === "string" && jobId) return { ok: true, status, jobId };
        if (!options.callback) return { ok: true, status, jobId: null };
        return { ok: false, status }; // a callback workflow must answer 202 with its job_id
      }
      await res.body?.cancel(); // the body is not needed: free the connection
      // A callback workflow answers 202; a plain 200 means it never reached Respond to Webhook.
      if (res.ok) return options.callback ? { ok: false, status } : { ok: true, status, jobId: null };
      if (res.status < 500) return { ok: false, status }; // 3xx/4xx: fix the configuration, retrying will not help
    } catch {
      logCall(event, ids.correlationId, null, started, attempt, body); // network error or TimeoutError
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) return { ok: false, status };
    await new Promise((resolve) => setTimeout(resolve, delay)); // 5xx, 524, network, timeout
  }
  return { ok: false, status: null };
}

// The token goes only over https; plain http only to this machine (local n8n or the mock).
function webhookUrl(base: string | undefined, event: string) {
  try {
    const url = new URL(`${base}/${event}`);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && local) ? url : null;
  } catch {
    return null;
  }
}

function logCall(event: string, correlationId: string, status: number | null, started: number, attempt: number, body: string) {
  console.info("n8n.out", {
    event,
    correlationId,
    status,
    ms: Date.now() - started,
    attempt,
    bytes: Buffer.byteLength(body),
    sha256: createHash("sha256").update(body).digest("hex"),
  });
}
