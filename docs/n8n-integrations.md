# Інтеграції з n8n

Контракт — `.claude/skills/integrating-n8n-webhooks/SKILL.md`. Виклики n8n — лише `lib/n8n/client.ts`,
колбеки — `app/api/n8n/[event]/route.ts`.

| event | напрям | шлях n8n | режим | власник |
|---|---|---|---|---|
| `quote-request` | Next.js → n8n → колбек `/api/n8n/quote-request` | `/webhook/quote-request` | Respond to Webhook 202 `{"job_id"}` + колбек `quote-request.completed` | уточнити |
| `lead-created` | Next.js → n8n | `/webhook-test/lead-created` (`N8N_WEBHOOK_URL`) | — | уточнити; ще не за контрактом, див. нижче |

## `quote-request`

- Запускає: Server Action `requestQuote` (`app/quotes/actions.ts`) з форми `/quotes/new`, виклик — в `after()`.
- `data`: `quoteId`, `company`, `email`, `description`, `budget` (число або `null`).
- Воркфлоу працює 40–90 с, тому відповідь — 202 одразу, результат — підписаним колбеком:
  `data.status = "completed"` з `result.documentUrl` (лише `https:`) або `"failed"` з `error.code`.
- Статус: `/quotes/[id]` (`queued` → `processing` → `ready` | `failed`), сторінка оновлюється кожні 5 с.

## `lead-created` — борг

`submitLead` (`app/actions.ts`) шле в n8n весь запис ліда (IP, user agent, `rawPayload`) на тестовий URL
без токена, таймауту й повторів і чекає n8n у Server Action. Перехід на `lib/n8n/client.ts` змінить формат
тіла, тож його треба узгодити з власником воркфлоу `lead-created`.
