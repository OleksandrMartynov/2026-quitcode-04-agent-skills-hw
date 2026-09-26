# Шаблони коду (Next.js 16, App Router)

Повернутися до [SKILL.md](../SKILL.md). `<event>` — ім'я події в kebab-case; `lib/n8n/store` — сховище
проєкту (таблиця з унікальним ключем; пам'ять процесу — лише для демо). Шаблони скорочені: валідацію й
типи даних конкретної форми додає проєкт.

## `lib/n8n/client.ts`

```ts
import "server-only";
import { createHash } from "node:crypto";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 3_000]; // 2 повтори = 3 спроби

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
  if (!base || !token) {
    console.error("n8n.out", { event, error: "not_configured" }); // без throw: after() позначить запис failed
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
        signal: AbortSignal.timeout(TIMEOUT_MS), // новий сигнал на кожну спробу
      });
      status = res.status;
      logCall(event, ids.correlationId, status, started, attempt, body);
      if (res.ok) {
        const jobId = res.status === 202 ? ((await res.json().catch(() => null))?.job_id ?? null) : null;
        return { ok: true, status, jobId };
      }
      if (res.status < 500) return { ok: false, status }; // 4xx: виправляти, не повторювати
    } catch {
      logCall(event, ids.correlationId, null, started, attempt, body); // мережа або TimeoutError
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) return { ok: false, status };
    await new Promise((resolve) => setTimeout(resolve, delay)); // 5xx, 524, мережа, таймаут
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
```

## Server Action, що запускає довгий воркфлоу

```ts
"use server";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { triggerWorkflow } from "@/lib/n8n/client";

export async function requestSomething(_prev: FormState, formData: FormData): Promise<FormState> {
  // сесія / права / валідація — всередині дії (server-auth-actions)
  const parsed = parseForm(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const record = await db.createJob({
    ...parsed.data,
    status: "queued",
    idempotencyKey: randomUUID(), // один раз на бізнес-операцію, зберігається з записом
    correlationId: randomUUID(),
  });

  after(async () => {
    // server-after-nonblocking: користувач не чекає n8n
    const result = await triggerWorkflow(
      "<event>",
      { jobRef: record.id /* лише поля, потрібні воркфлоу */ },
      { idempotencyKey: record.idempotencyKey, correlationId: record.correlationId },
      { callback: true },
    );
    await db.updateJob(record.id, result.ok ? { status: "processing", jobId: result.jobId } : { status: "failed" });
  });

  return { status: "ok", id: record.id };
}
```

## `app/api/n8n/[event]/route.ts`

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { claimCallbackKey, releaseCallbackKey, saveCallbackResult } from "@/lib/n8n/store";

const KNOWN_EVENTS = new Set(["<event>"]);
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  if (!KNOWN_EVENTS.has(event)) return Response.json({ error: "not_found" }, { status: 404 });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const raw = await req.text(); // сире тіло: підпис рахується від цих байтів
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return Response.json({ error: "too_large" }, { status: 413 });

  const timestamp = req.headers.get("x-n8n-timestamp") ?? "";
  const ts = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - ts) > WINDOW_SECONDS) return unauthorized();
  if (!verifySignature(timestamp, raw, req.headers.get("x-n8n-signature"))) return unauthorized();

  const key = req.headers.get("idempotency-key");
  if (!key) return Response.json({ error: "bad_request" }, { status: 400 });
  if (!(await claimCallbackKey(key))) return Response.json({ duplicate: true }, { status: 200 });

  try {
    const body = parseCallback(raw);
    if (!body || body.event !== `${event}.completed` || key !== `${body.data.jobId}:${body.event}`) {
      await releaseCallbackKey(key);
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    await saveCallbackResult(body.data); // мінімальний стан — ДО відповіді
  } catch {
    await releaseCallbackKey(key);
    return Response.json({ error: "internal" }, { status: 500 });
  }

  after(() => {
    // повільне: листи, сповіщення
  });
  return Response.json({ ok: true }, { status: 202 });
}

function verifySignature(timestamp: string, raw: string, header: string | null) {
  const secret = process.env.N8N_CALLBACK_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

type Callback = {
  event: string;
  data: { jobId: string; status: "completed" | "failed"; requestIdempotencyKey: string | null; result?: { documentUrl: string }; error?: { code: string } };
};

function parseCallback(raw: string): Callback | null {
  try {
    const body = JSON.parse(raw);
    return body?.version === 1 && typeof body.event === "string" && typeof body.data?.jobId === "string" ? body : null;
  } catch {
    return null;
  }
}
```

`lib/n8n/store` повинен: `claimCallbackKey(key)` — атомарно вставити ключ, `false`, якщо вже є;
`releaseCallbackKey(key)` — видалити; `saveCallbackResult(data)` — знайти запис за `data.jobId` або
`data.requestIdempotencyKey` і зберегти статус та `result.documentUrl`/`error.code`.
