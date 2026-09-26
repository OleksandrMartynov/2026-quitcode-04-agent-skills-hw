# Що налаштувати на боці n8n

Повернутися до [SKILL.md](../SKILL.md). Воркфлоу — власність клієнта: JSON не експортуємо й не
імпортуємо, налаштування передаємо текстом. Сам агент на боці n8n нічого не змінює.

1. **Webhook** — Method `POST`, Path = ім'я події (`<event>`), Authentication **Header Auth** (credential:
   Name `x-n8n-token`, Value = `N8N_WEBHOOK_TOKEN`). Respond: `Using 'Respond to Webhook' Node` для довгих
   задач, `Immediately` — для подій «до відома». Фіксовані IP хостингу — Options → IP(s) Allowlist (за
   reverse proxy — `N8N_PROXY_HOPS`). У наступних вузлах тіло — `$json.body`, заголовки — `$json.headers`
   (імена в нижньому регістрі).
2. **Remove Duplicates** — «Remove Items Processed in Previous Executions», ключ
   `{{ $json.headers['idempotency-key'] }}`.
3. **Respond to Webhook** — JSON, код `202`, тіло `{"job_id": "{{ $execution.id }}"}`.
4. …робота воркфлоу…
5. **Edit Fields** — `ts` = `{{ Math.floor($now.toSeconds()) }}`, `body` = `{{ JSON.stringify({ version: 1,
   event: '<event>.completed', data: { jobId: $execution.id, … } }) }}`. Той самий рядок і підписуємо, і відправляємо.
6. **Crypto** (v2) — `Hmac`, `SHA256`, `HEX`, значення `{{ $json.ts + '.' + $json.body }}`, credential Crypto
   з Hmac Secret = `N8N_CALLBACK_SECRET`.
7. **HTTP Request** — `POST` на `{{ $('Webhook').item.json.body.callbackUrl }}`; заголовки `x-n8n-timestamp`,
   `x-n8n-signature` (`sha256=` + результат Crypto), `idempotency-key` (`{{ $execution.id }}:<event>.completed`),
   `x-correlation-id` (із вхідних заголовків); Body Content Type **Raw**, `application/json`, тіло — поле
   `body`; Timeout `10000`; Retry On Fail: 3 спроби, 1000 мс. n8n у Docker, застосунок на хості —
   `host.docker.internal`, не `localhost`.
8. **Save** і **Publish**; після кожної зміни — Publish знову.

Чому Raw, а не «JSON → поля»: n8n не гарантує, що серіалізація полів дасть ті самі байти, які підписано.

## Реєстр інтеграцій проєкту

Кожна інтеграція — рядок у `docs/n8n-integrations.md` проєкту (перше, що шукає колега):

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `<event>` | Next.js → n8n (→ колбек) | `/webhook/<event>` | Immediately 200 / Respond to Webhook 202 + колбек | <хто відповідає> |
