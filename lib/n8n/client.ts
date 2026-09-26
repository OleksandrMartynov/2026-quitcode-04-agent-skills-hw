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
  if (!base || !token || (options.callback && !process.env.APP_BASE_URL)) {
    console.error("n8n.out", { event, error: "not_configured" }); // no throw: the caller marks the record failed
    return { ok: false, status: null };
  }
  const callbackUrl = options.callback
    ? new URL(`/api/n8n/${event}`, process.env.APP_BASE_URL).toString()
    : undefined;
  const body = JSON.stringify({ version: 1, event, data, ...(callbackUrl ? { callbackUrl } : {}) });

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(`${base}/${event}`, {
        method: "POST",
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
      if (res.ok) {
        const jobId = res.status === 202 ? ((await res.json().catch(() => null))?.job_id ?? null) : null;
        return { ok: true, status, jobId: typeof jobId === "string" ? jobId : null };
      }
      if (res.status < 500) return { ok: false, status }; // 4xx: fix the request, retrying will not help
    } catch {
      logCall(event, ids.correlationId, null, started, attempt, body); // network error or TimeoutError
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) return { ok: false, status };
    await new Promise((resolve) => setTimeout(resolve, delay)); // 5xx, 524, network, timeout
  }
  return { ok: false, status: null };
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
