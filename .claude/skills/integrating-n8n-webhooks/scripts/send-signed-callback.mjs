#!/usr/bin/env node
// Signed-callback matrix against a running callback route (contract: SKILL.md, references/callback.md).
// Node built-ins only. Reads N8N_CALLBACK_SECRET from the environment and never prints it, the
// signatures or the request bodies — only case names and HTTP status codes.

import { createHmac, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const HELP = `send-signed-callback.mjs — матриця підписаних колбеків n8n проти запущеного застосунку

Використання (секрет — зі змінної середовища, напр. з .env.local):
  node --env-file=.env.local send-signed-callback.mjs --url <callback-url> --job-id <jobId> [опції]

  --url <url>            ендпоінт колбека, напр. http://127.0.0.1:3000/api/n8n/<event>
  --job-id <id>          jobId справжньої задачі, яку застосунок чекає (з рядка мока
                         «workflow <jobId> running …» або з відповіді 202 { job_id })
  --request-key <key>    idempotency-key вихідного запиту (data.requestIdempotencyKey), якщо відомий
  --correlation-id <id>  x-correlation-id (за замовчуванням — новий UUID)
  -h, --help             ця довідка

Випадки й очікувані коди (порядок важливий — валідний колбек іде після негативних):
  невідома подія → 404 · не-json → 415 · тіло > 64 KB → 413
  тіло > 64 KB частинами, без content-length → 413 (ліміт — під час читання)
  без заголовків підпису → 401
  прострочений (−305 с) і майбутній (+305 с) час → 401 · хибний підпис → 401
  тіло переформатоване після підпису → 401
  дві одночасні доставки валідного колбека → 202 і 409 (друга приходить, поки перша ще зберігає)
  той самий повтор після цього → 200 { duplicate }
  ключ ≠ jobId:event → 400 · той самий запит ще раз → 400 (ключ звільнено, не duplicate)
  подія в тілі ≠ шлях → 400
«202, 200» на одночасних доставках — НЕВИЗНАЧЕНО, а не розбіжність: або роут відповідає duplicate ключу в
обробці (порушення — його ловить і check-contract C13), або збереження швидше за розкид двох запитів.
Код виходу: 0 — усі коди збіглися; 1 — є розбіжності; 2 — помилка аргументів або з'єднання.
`;

let args;
try {
  args = parseArgs({
    options: {
      url: { type: "string" },
      "job-id": { type: "string" },
      "request-key": { type: "string" },
      "correlation-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  }).values;
} catch (error) {
  console.error(`send-signed-callback: ${error.message}\nДовідка: --help`);
  process.exit(2);
}
if (args.help) { process.stdout.write(HELP); process.exit(0); }
const secret = process.env.N8N_CALLBACK_SECRET;
if (!args.url || !args["job-id"]) { console.error("send-signed-callback: потрібні --url і --job-id (див. --help)"); process.exit(2); }
if (!secret) { console.error("send-signed-callback: немає N8N_CALLBACK_SECRET (запускайте з --env-file=.env.local)"); process.exit(2); }

let url;
try {
  url = new URL(args.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
} catch {
  console.error("send-signed-callback: --url має бути http(s)-адресою, напр. http://127.0.0.1:3000/api/n8n/<event> (див. --help)");
  process.exit(2);
}
const pathEvent = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() ?? "");
const jobId = args["job-id"];
const correlationId = args["correlation-id"] ?? randomUUID();
const now = () => Math.floor(Date.now() / 1000);

function body({ event = `${pathEvent}.completed`, pad = 0 } = {}) {
  return JSON.stringify({
    version: 1,
    event,
    data: {
      jobId,
      status: "completed",
      correlationId,
      requestIdempotencyKey: args["request-key"] ?? null,
      result: { documentUrl: `https://files.example.test/n8n/${jobId}.pdf` },
      completedAt: new Date().toISOString(),
      ...(pad ? { padding: "x".repeat(pad) } : {}),
    },
  });
}
const sign = (ts, raw, key = secret) => `sha256=${createHmac("sha256", key).update(`${ts}.${raw}`).digest("hex")}`;

async function send({ target = url, raw, ts = now(), key, signature, contentType = "application/json", omitAuth = false, sendRaw, stream }) {
  const headers = { "content-type": contentType, "x-correlation-id": correlationId };
  if (!omitAuth) {
    headers["x-n8n-timestamp"] = String(ts);
    headers["x-n8n-signature"] = signature ?? sign(ts, raw);
  }
  if (key) headers["idempotency-key"] = key;
  const init = { method: "POST", headers, body: sendRaw ?? raw, signal: AbortSignal.timeout(10_000) };
  if (stream) Object.assign(init, { body: stream, duplex: "half" }); // chunked: no content-length
  const res = await fetch(target, init);
  await res.arrayBuffer();
  return res.status;
}

// the body as a stream of 16 KB chunks, so fetch sends it without content-length
function chunks(raw) {
  const bytes = new TextEncoder().encode(raw);
  let at = 0;
  return new ReadableStream({
    pull(controller) {
      if (at >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(at, at + 16 * 1024));
      at += 16 * 1024;
    },
  });
}

const validRaw = body();
const validKey = `${jobId}:${pathEvent}.completed`;
const otherPath = new URL(url); otherPath.pathname = url.pathname.replace(/[^/]+\/?$/, "unknown-event-ws");
const mismatchKey = `${randomUUID()}:${pathEvent}.completed`;
const wrongEventRaw = body({ event: `${pathEvent}-other.completed` });

const cases = [
  ["невідома подія в шляху", 404, () => send({ target: otherPath, raw: validRaw, key: validKey })],
  ["content-type не json", 415, () => send({ raw: validRaw, key: validKey, contentType: "text/plain" })],
  ["тіло > 64 KB", 413, () => { const raw = body({ pad: 70 * 1024 }); return send({ raw, key: validKey }); }],
  ["тіло > 64 KB частинами, без content-length", 413, () => { const raw = body({ pad: 70 * 1024 }); return send({ raw, key: validKey, stream: chunks(raw) }); }],
  ["без x-n8n-timestamp і x-n8n-signature", 401, () => send({ raw: validRaw, key: validKey, omitAuth: true })],
  // ±305, not ±301: now() is floored to whole seconds, so +301 can land 300.x s ahead — inside the window
  ["час −305 с", 401, () => { const ts = now() - 305; return send({ raw: validRaw, ts, key: validKey }); }],
  ["час +305 с", 401, () => { const ts = now() + 305; return send({ raw: validRaw, ts, key: validKey }); }],
  ["хибний підпис (інший секрет)", 401, () => { const ts = now(); return send({ raw: validRaw, ts, key: validKey, signature: sign(ts, validRaw, `${secret}-wrong`) }); }],
  ["тіло переформатоване після підпису", 401, () => { const ts = now(); return send({ raw: validRaw, ts, key: validKey, sendRaw: JSON.stringify(JSON.parse(validRaw), null, 2) }); }],
  ["дві одночасні доставки валідного колбека", "202, 409", async () => {
    const codes = await Promise.all([send({ raw: validRaw, key: validKey }), send({ raw: validRaw, key: validKey })]);
    return codes.sort().join(", ");
  }],
  ["повтор того самого ключа", 200, () => send({ raw: validRaw, key: validKey })],
  ["ключ ≠ jobId:event з тіла", 400, () => send({ raw: validRaw, key: mismatchKey })],
  ["той самий невідповідний ключ ще раз (ключ звільнено)", 400, () => send({ raw: validRaw, key: mismatchKey })],
  ["подія в тілі ≠ шлях", 400, () => send({ raw: wrongEventRaw, key: `${jobId}:${pathEvent}-other.completed` })],
];

console.log(`send-signed-callback → ${url.origin}${url.pathname} (подія «${pathEvent}», jobId ${jobId})`);
let mismatches = 0;
for (const [name, expected, run] of cases) {
  let got;
  try { got = await run(); } catch (error) {
    console.error(`send-signed-callback: немає з'єднання з ${url.origin}: ${error.cause?.code ?? error.name}`);
    process.exit(2);
  }
  const ok = got === expected;
  const undecided = !ok && expected === "202, 409" && got === "200, 202"; // see --help
  if (!ok && !undecided) mismatches++;
  console.log(`${ok ? "OK      " : undecided ? "НЕВИЗНАЧ" : "MISMATCH"}  ${name.padEnd(52)} очікувано ${expected}, отримано ${got}`);
}
console.log(`Підсумок: ${cases.length - mismatches}/${cases.length} збіглися → exit ${mismatches ? 1 : 0}`);
process.exitCode = mismatches ? 1 : 0;
