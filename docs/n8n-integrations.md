# Інтеграції з n8n

Контракт — `.claude/skills/integrating-n8n-webhooks/SKILL.md`. Виклики n8n — лише `lib/n8n/client.ts`,
колбеки — `app/api/n8n/[event]/route.ts`.

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{"job_id"}` + колбек `quote-request.completed` | уточнити |
| `lead-created` | Next.js → n8n | `/webhook/lead-created` | Immediately, 200; без колбека | уточнити |

## `quote-request`

- Запускає: Server Action `requestQuote` (`app/quotes/actions.ts`) з форми `/quotes/new`, виклик — в `after()`.
- `data`: `quoteId`, `company`, `email`, `description`, `budget` (число або `null`).
- Воркфлоу працює 40–90 с, тому відповідь — 202 одразу, результат — підписаним колбеком:
  `data.status = "completed"` з `result.documentUrl` (лише `https:`) або `"failed"` з `error.code`.
- Статус: `/quotes/[id]` (`queued` → `processing` → `ready` | `failed`), сторінка оновлюється кожні 5 с; якщо колбека немає
  5 хвилин, опитування зупиняється й сторінка каже, що кошторис запізнюється (пізній колбек усе одно приймається).

## `lead-created`

- Запускає: Server Action `submitLead` (`app/actions.ts`) з публічної форми ліда, виклик — `triggerWorkflow` в `after()`.
- `data`: `leadId`, `source`, `company`, `budget` — без email, телефону, IP, user agent і сирих даних форми.
  Раніше в n8n ішов увесь запис ліда на `/webhook-test/`; новий формат тіла треба узгодити з власником воркфлоу
  (Webhook: шлях `lead-created`, Header Auth `x-n8n-token`, Immediately, дані — у `$json.body.data`).
