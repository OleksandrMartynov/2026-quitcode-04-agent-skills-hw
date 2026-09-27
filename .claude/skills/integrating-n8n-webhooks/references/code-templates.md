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
  const token = process.env.N8N_WEBHOOK_TOKEN;
  const url = webhookUrl(process.env.N8N_WEBHOOK_BASE_URL, event);
  let callbackUrl: string | undefined;
  try {
    if (options.callback) callbackUrl = new URL(`/api/n8n/${event}`, process.env.APP_BASE_URL).toString();
  } catch {} // немає чи зламаний APP_BASE_URL — callbackUrl лишається undefined
  if (!url || !token || (options.callback && !callbackUrl)) {
    console.error("n8n.out", { event, error: "not_configured" }); // без throw: after() позначить запис failed
    return { ok: false, status: null };
  }
  const body = JSON.stringify({ version: 1, event, data, ...(callbackUrl ? { callbackUrl } : {}) });

  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt++) {
    const started = Date.now();
    let status: number | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        redirect: "manual", // не йти за редиректом: він переніс би тіло й x-n8n-token на іншу адресу
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
      if (res.status === 202) {
        const jobId = (await res.json().catch(() => null))?.job_id;
        if (typeof jobId === "string" && jobId) return { ok: true, status, jobId };
        if (!options.callback) return { ok: true, status, jobId: null };
        return { ok: false, status }; // воркфлоу з колбеком відповідає 202 з job_id
      }
      await res.body?.cancel(); // тіло не потрібне — звільнити з'єднання
      // 200 там, де чекаємо колбек, — воркфлоу не дійшов до Respond to Webhook: колбека не буде
      if (res.ok) return options.callback ? { ok: false, status } : { ok: true, status, jobId: null };
      if (res.status < 500) return { ok: false, status }; // 3xx/4xx: виправляти налаштування, не повторювати
    } catch {
      logCall(event, ids.correlationId, null, started, attempt, body); // мережа або TimeoutError
    }
    const delay = RETRY_DELAYS_MS[attempt - 1];
    if (delay === undefined) return { ok: false, status };
    await new Promise((resolve) => setTimeout(resolve, delay)); // 5xx, 524, мережа, таймаут
  }
  return { ok: false, status: null };
}

// токен — лише через https; http — тільки на цю машину (локальний n8n чи мок)
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
    ).catch(() => null); // after() ніхто не чекає: навіть неочікуваний виняток має закінчитись failed
    // колбек прийде лише після 202 з job_id; інакше запис чекав би вічно
    if (result?.ok && result.jobId) await db.updateJob(record.id, { status: "processing", jobId: result.jobId });
    else await db.failJobIfPending(record.id); // лише з queued/processing: результат колбека не перетираємо
  });

  return { status: "ok", id: record.id };
}
```

## `app/api/n8n/[event]/route.ts`

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { claimCallbackKey, completeCallbackKey, releaseCallbackKey, saveCallbackResult } from "@/lib/n8n/store";

const KNOWN_EVENTS = new Set(["<event>"]);
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_SECONDS = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/n8n/[event]">) {
  const { event } = await ctx.params;
  if (!KNOWN_EVENTS.has(event)) return Response.json({ error: "not_found" }, { status: 404 });
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const tooLarge = () => Response.json({ error: "too_large" }, { status: 413 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return tooLarge(); // заявлено забагато
  const raw = await readRawBody(req.body); // сире тіло: підпис рахується від цих байтів
  if (raw === TOO_LARGE) return tooLarge(); // chunked без content-length: ліміт — під час читання
  if (raw === null) return Response.json({ error: "bad_request" }, { status: 400 }); // тіло обірвалось

  const timestamp = req.headers.get("x-n8n-timestamp") ?? "";
  const ts = Number(timestamp);
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - ts) > WINDOW_SECONDS) return unauthorized();
  if (!verifySignature(timestamp, raw, req.headers.get("x-n8n-signature"))) return unauthorized();

  const key = req.headers.get("idempotency-key");
  if (!key) return Response.json({ error: "bad_request" }, { status: 400 });
  const claim = await claimCallbackKey(key);
  if (claim === "done") return Response.json({ duplicate: true }, { status: 200 });
  // інша доставка ще зберігає й може звільнити ключ: хай n8n повторить, а не вважає готовим
  if (claim === "processing") return Response.json({ error: "in_progress" }, { status: 409 });

  try {
    const body = parseCallback(raw);
    if (!body || body.event !== `${event}.completed` || key !== `${body.data.jobId}:${body.event}`) {
      await releaseCallbackKey(key);
      return Response.json({ error: "bad_request" }, { status: 400 });
    }
    await saveCallbackResult(body.data); // мінімальний стан — ДО відповіді
    await completeCallbackKey(key); // тепер повтор — дублікат
  } catch {
    await releaseCallbackKey(key);
    return Response.json({ error: "internal" }, { status: 500 });
  }

  after(() => {
    // повільне: листи, сповіщення
  });
  return Response.json({ ok: true }, { status: 202 });
}

const TOO_LARGE = Symbol("too_large");

// читає тіло як текст, але зупиняється на MAX_BODY_BYTES: непідписаний запит не змусить буферизувати більше
async function readRawBody(body: ReadableStream<Uint8Array> | null): Promise<string | typeof TOO_LARGE | null> {
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
    return bytes > MAX_BODY_BYTES ? TOO_LARGE : null; // null — потік обірвався з іншої причини
  }
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
    const data = body?.data;
    if (body?.version !== 1 || typeof body.event !== "string" || typeof data?.jobId !== "string") return null;
    if (data.status !== "completed" && data.status !== "failed") return null;
    // кожен статус несе свій результат: completed — посилання (лише https — воно потрапить на сторінку,
    // ніколи javascript: чи data:), failed — код помилки; неповна форма — 400, до збереження й до `done`
    if (data.status === "completed" && !isHttpsUrl(data.result?.documentUrl)) return null;
    if (data.status === "failed" && (typeof data.error?.code !== "string" || !data.error.code)) return null;
    return body;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: unknown) {
  try {
    return typeof value === "string" && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
```

`lib/n8n/store` повинен: `claimCallbackKey(key)` — атомарно вставити ключ зі станом `processing` і часом claim та
повернути `"claimed"`, а якщо ключ уже є — його стан (`"processing"` чи `"done"`); `processing`, старший за
~60 с (обробник упав, не завершивши й не звільнивши ключ), вважати простроченим і застовпити знову;
`completeCallbackKey(key)` — перевести в `done` після збереження результату; `releaseCallbackKey(key)` — видалити;
`saveCallbackResult(data)` — знайти запис за `data.jobId` або `data.requestIdempotencyKey` і зберегти статус та
`result.documentUrl`/`error.code`, не перетираючи `ready` пізнім `failed`; `failJobIfPending(id)` — позначити `failed`
лише запис у `queued`/`processing` (колбек міг завершити його раніше, ніж повернувся виклик n8n). Дублікат (200) — лише
ключ у стані `done`.
