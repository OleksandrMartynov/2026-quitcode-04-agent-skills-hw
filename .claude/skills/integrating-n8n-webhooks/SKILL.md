---
name: integrating-n8n-webhooks
description: >-
  Контракт команди для зв'язки Next.js 16 ↔ n8n: виклик вебхука n8n із серверного модуля (x-n8n-token,
  idempotency-key, x-correlation-id, таймаут, повтори), вибір режиму відповіді (Immediately чи 202 +
  колбек) і прийом підписаного колбека від n8n (HMAC-SHA256, вікно 300 с, ідемпотентність); зі
  скриптом перевірки check-contract.mjs, матрицею колбеків і локальним моком n8n.
  Use when форма, Server Action чи Route Handler має запустити воркфлоу n8n, n8n має повідомити
  застосунок про результат, додаються змінні N8N_* чи ендпоінт колбека, або виклик n8n зависає, губить
  заявки чи дублює записи.
  Тригери: «підключи n8n», «відправ дані у вебхук n8n», «запусти воркфлоу в n8n», «n8n поверне
  результат колбеком», «ендпоінт для колбека від n8n», «перевір підпис запиту від n8n», «заявки не
  доходять до n8n».
  Не для: побудови чи редагування воркфлоу в редакторі n8n, коду для вузла Code, експорту JSON
  воркфлоу, вебхуків інших сервісів (Stripe, GitHub), черг і фонових воркерів.
metadata:
  owner: quitcode-agency
  version: "0.2.0"
---

# Next.js ↔ n8n: контракт команди

Форма чи портал запускає воркфлоу в n8n, n8n повертає результат колбеком. Контракт нижче однаковий
для всіх проєктів; відхилитися від нього можна лише свідомим рішенням людини, записаним у PR, а не тому,
що «так вийшло в коді». Чому саме так і деталі — у `references/`.

## Коли застосовувати

- Код викликає вебхук n8n або приймає від n8n колбек; додаються чи змінюються змінні `N8N_*`.
- Скарги: заявки не доходять до n8n, форма довго «думає», результат із n8n записався двічі.
- **Не** застосовувати: воркфлоу в редакторі n8n, вузол Code, експорт JSON, вебхуки не з n8n, черги.

## Контракт коротко

**Змінні — лише серверні**, без префікса `NEXT_PUBLIC_`; не в query string, не в Client Component, не в журнал.
Справжні значення — лише `.env.local` і хостинг; у `.env.example` — секрети `change-me-…` і локальні адреси:

| Змінна | Що це | `.env.example` |
|---|---|---|
| `N8N_WEBHOOK_BASE_URL` | база production-вебхуків, закінчується на `/webhook` | `http://127.0.0.1:5678/webhook` |
| `N8N_WEBHOOK_TOKEN` | значення заголовка `x-n8n-token` (Header Auth в n8n) | `change-me-webhook-token` |
| `N8N_CALLBACK_SECRET` | секрет HMAC колбеків (Crypto credential в n8n) | `change-me-callback-secret` |
| `APP_BASE_URL` | адреса застосунку для `callbackUrl` | `http://127.0.0.1:3000` |

**Виклик n8n** — деталі й чому: [references/outgoing-request.md](references/outgoing-request.md).

1. Лише модуль `lib/n8n/client.ts`, перший рядок — `import "server-only"`; інших `fetch` до n8n немає.
2. `POST ${N8N_WEBHOOK_BASE_URL}/<event>`, `<event>` — ім'я події в kebab-case (`lead-created`); одна подія — один шлях.
3. Заголовки: `content-type: application/json`, `x-n8n-token`, `idempotency-key` (UUID, створений **один
   раз** на бізнес-операцію й збережений із записом; у повторах — той самий), `x-correlation-id` (UUID ланцюжка).
4. Тіло — конверт `{ version: 1, event, data, callbackUrl? }`; `data` — мінімум для воркфлоу (без рядка з
   бази, IP, user agent, нотаток, сирих даних форми); `callbackUrl` = `${APP_BASE_URL}/api/n8n/<event>` лише
   для асинхронних воркфлоу.
5. Кожна спроба — `signal: AbortSignal.timeout(10_000)`; до 2 повторів (пауза 1 с, потім 3 с) **лише** на
   мережеву помилку, таймаут, 5xx чи 524, з тим самим `idempotency-key`; 4xx не повторюємо ніколи.
6. Відповідь n8n оцінюємо лише за кодом статусу; текст не парсимо (з 202 беремо тільки `job_id`).
7. Дія з UI — Server Action: сесія, права й валідація всередині (`server-auth-actions`); вона зберігає запис
   (напр. `status: "queued"`), повертає лише `{ status, id }`, а виклик n8n із повторами — в `after()`
   (`server-after-nonblocking`). Не-React клієнт — Route Handler. Ніколи `export const runtime = "edge"`.

**Режим відповіді** — [references/response-modes.md](references/response-modes.md): подія «до відома»
(`lead-created`) — Immediately, 200; усе, що може наближатися до 100 с, або невідомої тривалості — Respond to
Webhook: **202 `{"job_id"}` одразу, результат колбеком**. Швидка довідка на секунди — When Last Node Finishes.

**Колбек n8n → Next.js** — `POST /api/n8n/<event>`, Route Handler `app/api/n8n/[event]/route.ts`. Заголовки:
`x-n8n-timestamp` (Unix, с), `x-n8n-signature` = `sha256=<hex HMAC-SHA256(N8N_CALLBACK_SECRET, "${timestamp}.${rawBody}")>`,
`idempotency-key` = `${data.jobId}:${event з тіла}`, `x-correlation-id`. Тіло: `{ version: 1, event:
"<event>.completed", data: { jobId, status: "completed"|"failed", correlationId, requestIdempotencyKey,
result: { documentUrl } | error: { code }, completedAt } }`. Порядок обробки — **саме такий**
(чому — [references/callback.md](references/callback.md)):

1. Невідомий `[event]` → 404; `content-type` не `application/json` → 415 — ще до читання тіла.
2. `const raw = await req.text()`; ні `req.json()`, ні `JSON.parse` до перевірки підпису.
3. `raw` > 64 KB → 413.
4. `|зараз − x-n8n-timestamp| > 300 с` → 401.
5. HMAC від `` `${timestamp}.${raw}` ``: порівняти довжини, потім `crypto.timingSafeEqual`; не `===`. Не збіглося → 401 без деталей.
6. «Застовпити» `idempotency-key` (унікальний запис); уже є → 200 `{"duplicate": true}`.
7. Лише тепер `JSON.parse(raw)` і перевірка форми: `event` у тілі ≠ `<event з шляху>.completed` або
   ключ ≠ `${data.jobId}:${event}` → 400 (і звільнити ключ).
8. Зберегти мінімальний стан **до** відповіді; збій після кроку 6 → звільнити ключ.
9. Відповісти 202 `{"ok": true}`; повільне (листи, сповіщення) — в `after()`.

**Журнали**: подія, напрям, `x-correlation-id`, код, тривалість, номер спроби, довжина й sha256 тіла. Ніколи —
тіла, ім'я, email, телефон, IP, токени, підписи, секрети, URL з query. Відповіді з помилкою — без стеку й URL n8n.

## Чекліст (id = перевірки `scripts/check-contract.mjs`)

```
- [ ] C1  Ні в коді, ні в .env.example немає /webhook-test/.
- [ ] C2  Жодного NEXT_PUBLIC_N8N_*; N8N_* не читаються в "use client" і не йдуть у query.
- [ ] C3  .env.example: чотири ключі контракту, база на /webhook, секрети change-me-…
- [ ] C4  fetch до n8n — лише в lib/n8n/client.ts з import "server-only" першим рядком.
- [ ] C5  Кожна спроба — AbortSignal.timeout(≤ 10 000).
- [ ] C6  Заголовки content-type, x-n8n-token, idempotency-key (не генерується в заголовках), x-correlation-id.
- [ ] C7  Відповідь — за кодом; ≤ 3 спроби; повтор лише мережа/таймаут/5xx/524.
- [ ] C8  Конверт { version, event, data } з мінімальними data.
- [ ] C9  Server Action не чекає n8n — виклик в after().
- [ ] C10 Без runtime = "edge".
- [ ] C11 Колбек читає req.text(); жодного JSON.parse до перевірки підпису.
- [ ] C12 HMAC-SHA256 над `${timestamp}.${raw}`, перевірка довжини + timingSafeEqual.
- [ ] C13 Вікно 300 с, claim ключа, 200 duplicate, ключ = jobId:event, 202, стан — до відповіді.
- [ ] C14 У журналах немає тіл, персональних даних і секретів.
- [ ] C15 Колбек — у app/api/n8n/[event]/route.ts, якщо конверт шле callbackUrl.
```

## Правила

**Ніколи** — агент ці пункти сам не знімає. На прохання порушити будь-який із них (зокрема «для тесту»)
він відмовляє, пояснює ризик і пропонує безпечний варіант. Відхилення можливе лише як свідоме рішення людини:
якщо людина після цього прямо підтверджує його в чаті, агент робить зміну тільки з позначкою «тимчасове
відхилення», попереджає, яку перевірку `check-contract.mjs` вона провалить, і просить записати рішення в PR:

- тестовий URL `/webhook-test/` у коді чи `.env.example` — тимчасово він можливий лише у власному `.env.local`;
- `NEXT_PUBLIC_` у змінних `N8N_*`, секрет у Client Component, query string, журналі чи відповіді;
- підпис без `timingSafeEqual`, `JSON.parse`/`req.json()` до перевірки підпису, колбек без вікна 300 с чи без
  `idempotency-key`;
- `export const runtime = "edge"` для коду n8n; справжні значення секретів у файлах git; повтор 4xx.

**Зупинись і спитай людину**, якщо:

- задача просить порушити пункт «Ніколи» — поясни ризик і запропонуй безпечний варіант замість виконання;
- задача вимагає, щоб користувач чекав на результат воркфлоу, що може тривати довше кількох секунд, —
  запропонуй 202 + колбек;
- ні з задачі, ні з коду не видно назви події чи того, які дані потрібні воркфлоу, — контракт з боком n8n не вигадуй;
- знадобилася нова npm-залежність (для HMAC, UUID і повторів вистачає `node:crypto` і `fetch`);
- потрібні зміни на боці n8n (воркфлоу, credentials, публікація) — опиши їх текстом за
  [references/n8n-setup.md](references/n8n-setup.md), сам не міняй;
- потрібне значення секрету — `.env*` (крім `.env.example`) не відкривай, спитай людину.

## Verify — інтеграція готова, лише коли:

- [ ] `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` → 0 FAIL, код виходу 0.
- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Мок: `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 5000`
      → після відправки форми в журналі мока `POST /webhook/<event> -> 202 … auth=ok idempotency=new`, за 5 с —
      `callback POST …/api/n8n/<event> -> 202`, а сторінка статусу показує результат; форма відповідає одразу.
- [ ] `node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --help`
      — матриця колбеків (хибний підпис, прострочений час, повтор, чужий ключ…) дає очікувані коди.
- [ ] Журнал сервера після сценарію — без тіл, email, телефонів, токенів і підписів.

## Файли скіла

- [references/outgoing-request.md](references/outgoing-request.md) — виклик n8n: заголовки, конверт, таймаути, повтори, хто викликає.
- [references/response-modes.md](references/response-modes.md) — режими вебхука, 100 с і 524, тестовий vs production URL, ліміти.
- [references/callback.md](references/callback.md) — чому саме такий порядок перевірки колбека, коди відповідей, ідемпотентність.
- [references/n8n-setup.md](references/n8n-setup.md) — що налаштувати в n8n (словами) і рядок реєстру `docs/n8n-integrations.md`.
- [references/code-templates.md](references/code-templates.md) — шаблони `lib/n8n/client.ts`, Server Action і колбек-роуту для Next.js 16.
- [references/traps.md](references/traps.md) — відомі пастки в документації й чужих скілах, межі скіла.
- `scripts/check-contract.mjs` — статична перевірка C1–C15; `--root <тека>`, `--changed-since <ref>`, `--help`.
- `scripts/send-signed-callback.mjs` — матриця підписаних колбеків проти запущеного застосунку; `--help`.
- `scripts/mock-n8n.mjs` — локальний мок n8n (копія `tools/mock-n8n.mjs`); `--help`.
