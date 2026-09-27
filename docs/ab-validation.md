# A/B-перевірка скіла `integrating-n8n-webhooks` (Task D)

Протокол — `materials/ab-task.md`, команди — `docs/walkthrough.md`, Task D. **A — без скіла, B — зі скілом.** Числа й
цитати — з сесій і журналів (`~/ws4-runs/`, поза репозиторієм); шлях `/Users/alexmart` у виводах замінено на `~`.

- **Інструмент і версія:** Claude Code 2.1.280 у режимі `claude -p` (headless; той самий лаунчер `~/ws4-runs/run.sh`,
  що й для проб Task C і E2: чисте оточення `env -i HOME PATH USER LANG`, запит — з файлу в stdin, журнал — stream-json).
- **Модель і рівень міркування (effort), однакові в обох прогонах:** `claude-opus-5-5`, effort `high` (з `args=` у
  `.meta` обох сесій і `model` у їхніх init-подіях).
- **Код:** BASE = `43acafd` (три скіли, виправлення Task A, E2; без `/quotes`, без змін у виклику n8n — перевірено:
  `git ls-tree` без `quotes`/`lib/n8n`/`api/n8n`, `git diff main 43acafd -- app/actions.ts` не зачіпає `fetch`/`N8N`) ·
  скіл `integrating-n8n-webhooks` для копії B — з `042942b` (v0.4.3; див. «Відхилення від walkthrough»).
- **Копії:** `~/ws4-ab/leaddesk-ab-a` (без жодного скіла, тег `base` = `ceb83ed`), `~/ws4-ab/leaddesk-ab-b` (лише
  `integrating-n8n-webhooks`, тег `base` = `ad2280b`); у кожній — один коміт `start` з тегом `base`, `npm ci`. Пізніше —
  контрольна копія `~/ws4-ab/leaddesk-ab-b2` (розділ «Контрольний прогін B2»).
- **Що видалено з обох копій:** `tools/`, `materials/`, `docs/`, `README.md`, `.coderabbit.yaml`, `.github/` і всі скіли (у B
  повернуто лише `integrating-n8n-webhooks`); `AGENTS.md` і `CLAUDE.md` лишились в обох. Перевірки з кроку 1
  (`~/ws4-runs/ab-isolation.txt`: вивід команд; рядки з `$` — сама команда, рядки в дужках — мої примітки, не вивід):

  ```
  $ find leaddesk-ab-a leaddesk-ab-b -name SKILL.md -not -path "*/node_modules/*"
  leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md
  $ ls -A leaddesk-ab-a leaddesk-ab-b | grep -xE ... || echo "no hints - ok"
  no hints - ok
  $ grep -rlE "x-n8n-token|timingSafeEqual|idempotency-key" leaddesk-ab-a --exclude-dir=node_modules || echo "no contract - ok"
  no contract - ok
  $ ls -A ~/ws4-ab
  leaddesk-ab-a
  leaddesk-ab-b
  $ ls ~/.claude/skills ~/.cursor/skills ~/.agents/skills ~/.codex/skills
  ls: ~/.agents/skills: No such file or directory
  ls: ~/.codex/skills: No such file or directory
  ~/.claude/skills:
  review-task
  synced
  
  ~/.cursor/skills:
  review-task
  $ ls ~/.claude/projects | grep ws4-ab
  (no project dirs for the copies yet — no memory)
  (after updating the skill in copy B to 042942b)
  leaddesk-ab-b/.claude/skills/integrating-n8n-webhooks/SKILL.md
  no hints - ok
  leaddesk-ab-a
  leaddesk-ab-b
  ```

  (`ls ~/.claude/projects | grep ws4-ab` порожній — у копій ще не було сесій, тож і пам'яті.) Обидві копії бачать код Task A
  (зокрема перевірку сесії й воркспейсу в `app/actions.ts`) і `skills-lock.json` — це частина BASE.
- **Особисті копії скіла:** немає — у `~/.claude/skills` лише `review-task` і `synced` (скіли claude.ai), у
  `~/.cursor/skills` — `review-task`; `~/.agents/skills` і `~/.codex/skills` не існують (вивід вище).
- **Запит:** `materials/ab-task.md`, рядки 14–18 між лініями, без змін → `~/ws4-runs/ab-prompt.txt`, sha256
  `498a125e1d02c54620123dc6d3f92b176c340a7d25b879c0f2e194ef4552c39c` (однаковий для обох сесій — `prompt_sha256` у `.meta`);
  нова сесія на кожен прогін (A `dde64fd0…`, B `1a2f8d60…`, `--session-id`, без `--resume`).
- **Відповідь на уточнення, однакова в обох:** агент не питав — жодного `--resume` не знадобилось (відповідь «Роби, як
  вважаєш правильним» лежала готова в `~/ws4-runs/ab-reply.txt`).
- **Дозволи й прапорці, однакові в обох** — дослівно `args=` з `.meta` (відрізняється лише `--session-id`):

  ```
  args=-p --model claude-opus-5-5 --effort high --strict-mcp-config --no-chrome --permission-mode acceptEdits --permission-prompts none --disallowedTools WebFetch\,WebSearch\,AskUserQuestion --output-format stream-json --verbose --allowedTools Bash\(npm\ run\ lint\)\,Bash\(npm\ run\ build\)\,Bash\(node\ .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs\) --session-id dde64fd0-53f3-4873-b7c1-7bce3fa2cc0b 
  args=-p --model claude-opus-5-5 --effort high --strict-mcp-config --no-chrome --permission-mode acceptEdits --permission-prompts none --disallowedTools WebFetch\,WebSearch\,AskUserQuestion --output-format stream-json --verbose --allowedTools Bash\(npm\ run\ lint\)\,Bash\(npm\ run\ build\)\,Bash\(node\ .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs\) --session-id 1a2f8d60-0072-4c93-9520-6ee8c26a1a05 
  ```

  Інші команди, крім читання в теці копії, відхилялись без запиту (`--permission-prompts none`); звернення поза теку копії —
  відхилено в обох (нижче). `AskUserQuestion` вимкнено в обох гілках (як у всіх headless-сесіях домашки): уточнення агент
  міг поставити лише текстом у фінальній відповіді — жоден цього не зробив.
- **Мок, однаковий для обох** (з робочого репозиторію, термінал у теці копії; копії лежать не поряд із репозиторієм,
  тому шлях до мока повний): `node --env-file=.env.local "$HOME/Work/Agentic Development Course/04/tools/mock-n8n.mjs"
  --mode respond-202 --delay 5000` — без `--callback-url`: обидва прогони передають `callbackUrl` у тілі.
- **`.env.local` у копіях** пише скрипт `~/ws4-runs/make-env-local.mjs` (друкує лише назви ключів): усі ключі з
  `.env.example` агента дослівно + `N8N_WEBHOOK_TOKEN` і `N8N_CALLBACK_SECRET` мока зі свіжими випадковими значеннями
  (у B — замість `change-me-…` у тих самих змінних агента).
- **Базова лінія `check-contract.mjs` на копії до прогону** (увесь код, без `--changed-since`; однакова для A і B —
  `diff` двох виводів розходиться лише в рядку з коренем копії): **8 FAIL** (C1, C3–C9 — старий виклик `lead-created` з форми ліда й `N8N_WEBHOOK_URL` з
  `/webhook-test/` у `.env.example`), 3 PASS (C2, C10, C14), 4 N/A (C11–C13, C15). Це старий код, в оцінку прогонів не йде.

## A — без скіла

- **Які скіли бачив агент** (окремий запуск `claude -p "/context"` у теці копії, сесія `aa26878a…`): у розділі Skills —
  жодного рядка `Project`; у списку `skills` init-події 28 назв (вбудовані й claude.ai, без `integrating-n8n-webhooks`).
- **Що зробив агент — своїми словами.** Форма `/quotes/new` → Server Action `requestQuote` створює запис `pending` з
  випадковим UUID і одноразовим токеном колбека (у пам'яті — лише його хеш), робить `redirect` на `/quotes/<id>`, а виклик
  n8n кладе в `after()`. Сам виклик — `fetch(N8N_QUOTE_WEBHOOK_URL)` у `lib/quotes.ts`: `content-type` без жодного токена,
  тіло — поля заявки + `callbackUrl` + `callbackToken`, таймаут 15 с, без повторів; помилку позначає `failed`, таймаут —
  чекає колбека. Колбек — `POST /api/quotes/[id]/callback` з `Authorization: Bearer <callbackToken>`: сире тіло, ліміт 10 000
  байт, `timingSafeEqual` хешів токена, `JSON.parse` після перевірки, 409 на інший результат; без HMAC, вікна часу й
  `idempotency-key`. `/quotes/[id]` показує статус, email і опис, оновлюється кожні 4 с до 5 хв.
- **Звідки агент узяв домовленості** (журнал сесії: 16 `Read`, 10 `Bash`, жодного `Skill`): наявний код (`app/actions.ts`,
  `lib/db.ts`, `lib/lead-form.ts`, `components/lead-form.tsx`, `proxy.ts`, `app/dashboard/leads/[id]/page.tsx`…),
  документація Next.js у `node_modules/next/dist/docs/` (`after.md`, `refresh.md`, розділ про динамічні сегменти й
  `RouteContext`) і загальні знання — схему «Bearer-токен на запит» агент придумав сам; контракту команди ніде не бачив
  (у копії його немає — «no contract - ok»). Поза дозволеним: `Write /tmp/quote-e2e.mjs` (поза копією) і запуск
  `next start` у копії з тестовим моком на `:3100` — обидва відхилені дозволами (усього 3 `permission_denials`; ще одна — довгий `cat`-цикл по файлах).
- **Запитання агента і фінальна відповідь:** запитань не було. Початок відповіді: «`npm run lint` і `npm run build`
  проходять. **Наскрізно я це не перевірив:** сесія не дала запустити локальний сервер із тестовою заглушкою n8n». Далі —
  що зробити людині: додати `N8N_QUOTE_WEBHOOK_URL` і `APP_URL`, у n8n — Respond: Immediately і HTTP Request на
  `callbackUrl` з токеном у заголовку. Повний текст — у `~/ws4-runs/ab-run-a.analysis.txt`.
- **Змінені файли** (`git diff --cached --stat base`): 11 файлів, +523/−1 — нові `app/api/quotes/[id]/callback/route.ts`,
  `app/quotes/{actions.ts,new/page.tsx,[id]/page.tsx}`, `components/quote-form.tsx`, `components/quote-status-poller.tsx`,
  `lib/quote-form.ts`, `lib/quotes.ts`; змінені `lib/db.ts`, `lib/types.ts`, `.env.example`. Діф: `docs/ab/a-without-skill.diff`.
- **Змінні середовища, які додав агент:** `N8N_QUOTE_WEBHOOK_URL=http://127.0.0.1:5678/webhook/quote-request`,
  `APP_URL=http://localhost:3000` (старий `N8N_WEBHOOK_URL` лишив).
- **`check-contract.mjs --root <копія> --changed-since base`** — лише код прогону (скрипт з робочого репозиторію, v0.4.3):

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-ab/leaddesk-ab-a --changed-since base
  check-contract — ~/ws4-ab/leaddesk-ab-a  (лише зміни після base)
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
  C2   PASS  Змінні N8N_* лише на сервері
  C3   FAIL  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 1)
         .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
         .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
         .env.example:1  немає ключа N8N_CALLBACK_SECRET
         .env.example:1  немає ключа APP_BASE_URL
         .env.example:10  ключ N8N_QUOTE_WEBHOOK_URL поза контрактом
  C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only" (проігноровано у незміненому коді: 2)
         lib/quotes.ts:40  fetch до n8n поза lib/n8n/client.*
         lib/quotes.ts:1  модуль, що викликає n8n, не починається з import "server-only"
  C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000) (проігноровано у незміненому коді: 1)
         lib/quotes.ts:40  таймаут 15000 мс — понад 10 000
  C6   FAIL  Заголовки контракту у виклику n8n (проігноровано у незміненому коді: 1)
         lib/quotes.ts:40  немає заголовків: x-n8n-token, idempotency-key, x-correlation-id
  C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524 (проігноровано у незміненому коді: 2)
         lib/quotes.ts:40  немає повторів для мережевих помилок, таймауту, 5xx і 524
  C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data (проігноровано у незміненому коді: 1)
         lib/quotes.ts:40  тіло не має конверта { version, event, data }
         app/quotes/actions.ts:39  у data для n8n — IP/user agent/заголовки/сирі дані/секрети
  C9   PASS  Server Action не чекає n8n: виклик лише в after() (проігноровано у незміненому коді: 1)
  C10  PASS  Без export const runtime = "edge"
  C11  PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
         app/api/quotes/[id]/callback/route.ts:1  немає createHmac("sha256", секрет)
         lib/quotes.ts:31  немає перевірки довжини тих самих буферів, що йдуть у timingSafeEqual
  C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
         app/api/quotes/[id]/callback/route.ts:1  немає відповіді невідома подія → 404
         app/api/quotes/[id]/callback/route.ts:1  немає відповіді не-JSON → 415
         app/api/quotes/[id]/callback/route.ts:1  не читається x-n8n-timestamp
         app/api/quotes/[id]/callback/route.ts:1  немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)
         app/api/quotes/[id]/callback/route.ts:1  не читається idempotency-key
         app/api/quotes/[id]/callback/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
         app/api/quotes/[id]/callback/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
         app/api/quotes/[id]/callback/route.ts:1  немає claim ключа (key) у сховищі до обробки
         app/api/quotes/[id]/callback/route.ts:1  успіх не відповідає 202
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  FAIL  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
         app/quotes/actions.ts:36  конверт шле callbackUrl, але app/api/n8n/[event]/route.* немає
         app/api/quotes/[id]/callback/route.ts:1  колбек-роут не за шляхом app/api/n8n/[event]/route.*
  Підсумок: 9 FAIL, 6 PASS, 0 N/A → exit 1
  exit=1
  ```

  Застереження: версія чекера з BASE (v0.4.2) на цьому ж коді давала лише 2 FAIL (C3, C15) — URL вебхука тут приходить у
  `fetch` параметром з іншого модуля, а колбек лежить у `app/api/quotes/[id]/callback` без слів-підказок, і стара евристика
  не бачила ні того, ні іншого. Це знайдено саме на прогоні A й виправлено у v0.4.3 (`042942b`) **до** прогону B; обидва
  прогони оцінено тією самою v0.4.3 (див. «Що скіл змінив у собі» в `docs/verification.md`).
- **Журнал мока** (форма → колбек → `/quotes/<id>`, `~/ws4-runs/ab-a-mock.log`):

  ```
  [mock-n8n] 2026-09-26T16:49:56.953Z POST /webhook/quote-request -> 403 in 3 ms auth=missing | headers: accept,accept-language,content-type,user-agent | body 448 B sha256=a71472e59f6d5f5b7887a47d7ac33d9e6dc409a73ec58275b866e5c9032a3eda
  [mock-n8n] 2026-09-26T16:50:35.963Z stopping (SIGTERM)
  ```

  URL — `/webhook/` (не `/webhook-test/`), але без `x-n8n-token`: мок, налаштований як n8n клієнта (Header Auth),
  відповів 403, воркфлоу не стартував, колбеку не було.
- **Час від «Надіслати» до відповіді форми:** 266 мс (POST `/quotes/new` за `performance.getEntriesByType("resource")`
  у вбудованому браузері; одразу після — перехід на `/quotes/f2157c3a…`). Сирі значення й тексти сторінок усіх сценаріїв —
  `~/ws4-runs/browser-measurements.txt` (скопійовано з результатів інструментів браузера під час сценаріїв).
- **Що показала `/quotes/<id>`:** «Не вдалося підготувати кошторис автоматично. Спробуйте ще раз трохи пізніше.» + email,
  бюджет і опис задачі (id — випадковий UUID, тож сторінку не вгадати перебором).
- **Журнал сервера** (`~/ws4-runs/ab-a-server.log`, 24 рядки): лише службові рядки `db:*`. Фрагмент сценарію (рядки 10–13):

  ```
  db:insertQuote: 1
  db:getQuote: 1
  db:completeQuote: 1
  db:getQuote: 2
  ```

  Сканер `~/ws4-runs/scan-log.mjs` (друкує лише кількості): email — 1 збіг, це назва пакета `…-hw@0.1.0` з рядка npm;
  телефонів, тексту форми, підписів і значень секретів — 0.
- **Додатково, поза протоколом** — як колбек A прийняв би підписаний колбек мока: той самий мок без `N8N_WEBHOOK_TOKEN`
  (`~/ws4-runs/ab-a-mock-noauth.log`):

  ```
  [mock-n8n] 2026-09-26T16:51:07.826Z POST /webhook/quote-request -> 202 in 5 ms auth=none idempotency=absent | headers: accept,accept-language,content-type,user-agent | body 414 B sha256=4784a0cb3f457b490498dea39690eb8bcdb906ae7f7201d28affc10f4fc1b567
  [mock-n8n] 2026-09-26T16:51:07.826Z workflow ffc2f0d8-9b4d-40aa-b33c-da267bc722c9 running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-26T16:51:12.851Z callback POST http://localhost:3000/api/quotes/609aac70-0970-44fe-b3c1-be5518cdb5d2/callback -> 401 in 23 ms (try 1/3) event=quote-request.completed body 314 B sha256=1693fbb3aa109355b09e76a026d531972d07140bb0dc058e7a46b7852a3becd0
  [mock-n8n] 2026-09-26T16:51:23.848Z stopping (SIGTERM)
  ```

  Застосунок A чекає свій Bearer-токен, тож колбек n8n за контрактом (HMAC у `x-n8n-signature`) отримує 401.

## B — зі скілом

- **Які скіли бачив агент** (окремий запуск `/context`, сесія `4cad7f7a…`): у розділі Skills один рядок `Project` —
  `integrating-n8n-webhooks | Project | ~350`; у списку `skills` init-події 29 назв.
- **Чи викликав агент скіл:** так — **перший** інструмент сесії `Skill` → `integrating-n8n-webhooks`; далі `Read` п'яти
  файлів `references/` (`code-templates.md`, `callback.md`, `outgoing-request.md`, `n8n-setup.md`, `traps.md`) і скриптів
  `check-contract.mjs` (двічі) і `send-signed-callback.mjs`.
- **Що зробив агент — своїми словами.** Майже дослівно за шаблонами скіла: `lib/n8n/client.ts` з `import "server-only"`
  (`POST ${N8N_WEBHOOK_BASE_URL}/quote-request`, `x-n8n-token`, `idempotency-key`, `x-correlation-id`, конверт
  `{ version, event, data, callbackUrl }`, 10 с на спробу, 2 повтори лише на мережу/5xx/524, журнал без тіла);
  `requestQuote` зберігає запис `queued` з ключами, повертає `{ status, id }`, виклик — в `after()`, результат виклику
  (`processing` з `jobId` або `failed`) пише в запис; колбек `app/api/n8n/[event]/route.ts` у порядку контракту (404/415 →
  `req.text()` → 413 → вікно 300 с → HMAC + `timingSafeEqual` → claim ключа → `JSON.parse` → 400 зі звільненням ключа →
  стан до відповіді → 202); `/quotes/[id]` без email; реєстр `docs/n8n-integrations.md`. Старий `lead-created` у
  `submitLead` не чіпав, але окремо назвав його порушенням контракту.
- **Запитання агента і фінальна відповідь:** запитань не було. Початок відповіді: «Код я нічим не запускав: у цій сесії
  заблоковано всі команди, яким потрібен дозвіл (`npm run lint`, `node …/check-contract.mjs`, навіть `git status`). Тож
  lint, build, перевірку контракту й прогін на моці ще треба зробити». Далі — які секрети згенерувати людині (команда з
  `randomBytes(32)`), що налаштувати в n8n словами і що підтвердити (публічна сторінка статусу; email у `data` — «Email я
  передаю, припускаючи, що воркфлоу надсилає PDF листом. Якщо не надсилає, його краще прибрати.»).
  Повний текст — `~/ws4-runs/ab-run-b.analysis.txt`.
- **Чому B нічого не запустив, хоча дозволи ті самі.** Агент писав команди в інших формах — `npm run lint --prefix <тека>`,
  абсолютний шлях до `check-contract.mjs`, `…; echo "exit=$?"` — і вони не збігались із дозволеними `Bash(npm run lint)` /
  `Bash(node .claude/skills/…/check-contract.mjs)`: 6 `permission_denials`, серед них і `git status`, `grep` у `node_modules`
  з абсолютним шляхом. A запускав `npm run lint`/`build` у дозволеній формі. Поза теку копії B не звертався (абсолютні
  шляхи — лише всередині `~/ws4-ab/leaddesk-ab-b`).
- **Змінені файли** (`git diff --cached --stat base`): 14 файлів, +661/−1 — нові `lib/n8n/client.ts`,
  `app/api/n8n/[event]/route.ts`, `app/quotes/{actions.ts,layout.tsx,new/page.tsx,[id]/page.tsx}`, `components/quote-form.tsx`,
  `components/quote-status-refresh.tsx`, `lib/quote-form.ts`, `docs/n8n-integrations.md`; змінені `lib/db.ts`, `lib/types.ts`,
  `.env.example`, `lib/lead-form.ts` (експорт `EMAIL_RE`). Діф: `docs/ab/b-with-skill.diff`.
- **Змінні середовища, які додав агент:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000` (старий `N8N_WEBHOOK_URL` лишив).
- **`check-contract.mjs --root <копія> --changed-since base`** — лише код прогону:

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-ab/leaddesk-ab-b --changed-since base
  check-contract — ~/ws4-ab/leaddesk-ab-b  (лише зміни після base)
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
  C2   PASS  Змінні N8N_* лише на сервері
  C3   PASS  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 1)
  C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only" (проігноровано у незміненому коді: 2)
  C5   PASS  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000) (проігноровано у незміненому коді: 1)
  C6   PASS  Заголовки контракту у виклику n8n (проігноровано у незміненому коді: 1)
  C7   PASS  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524 (проігноровано у незміненому коді: 2)
  C8   PASS  Тіло — конверт { version, event, data } з мінімальними data (проігноровано у незміненому коді: 1)
  C9   PASS  Server Action не чекає n8n: виклик лише в after() (проігноровано у незміненому коді: 1)
  C10  PASS  Без export const runtime = "edge"
  C11  PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C12  PASS  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
  C13  PASS  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
  Підсумок: 0 FAIL, 15 PASS, 0 N/A → exit 0
  exit=0
  ```

- **Журнал мока** (`~/ws4-runs/ab-b-mock.log`):

  ```
  [mock-n8n] 2026-09-26T16:56:35.137Z POST /webhook/quote-request -> 202 in 4 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 396 B sha256=2f366b28d4f59d9395a3a833672d2451ae133edf4579eaad6c71809317c420c0
  [mock-n8n] 2026-09-26T16:56:35.137Z workflow 730006e7-6da1-4894-8bbe-71c983b611d3 running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-26T16:56:40.351Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 211 ms (try 1/3) event=quote-request.completed body 382 B sha256=de442ec833477969a041b88e5753b3bd5d65ddacd4f17fbf6769dcc94eeeac4d
  [mock-n8n] 2026-09-26T16:57:30.172Z stopping (SIGTERM)
  ```

  URL — `/webhook/`, заголовки контракту на місці, `auth=ok`, `idempotency=new`; колбек прийнято з 202.
- **Час від «Надіслати» до відповіді форми:** 143 мс (POST `/quotes/new`), далі 111 мс — перехід на `/quotes/bffb4180…`.
- **Що показала `/quotes/<id>`:** одразу — «У черзі. Передаємо запит на підготовку кошторису»; через ~5 с після колбека —
  «Кошторис готовий. PDF можна завантажити за посиланням нижче» з посиланням
  `https://files.example.test/n8n/730006e7-6da1-4894-8bbe-71c983b611d3.pdf`. Email на сторінці немає.
- **Журнал сервера** (`~/ws4-runs/ab-b-server.log`, 35 рядків): `db:*` і два структуровані рядки `n8n.out`/`n8n.in` —
  подія, `correlationId`, код, тривалість, спроба, довжина й sha256 тіла. Фрагмент сценарію (рядки 10–35):

  ```
  db:insertQuote: 1
  db:getQuote: 1
  n8n.out {
    event: 'quote-request',
    correlationId: '74a537ab-1c18-4795-8088-83be1bcf1f29',
    status: 202,
    ms: 37,
    attempt: 1,
    bytes: 396,
    sha256: '2f366b28d4f59d9395a3a833672d2451ae133edf4579eaad6c71809317c420c0'
  }
  db:setQuoteJob: 1
  db:claimCallbackKey: 1
  db:findQuoteForCallback: 1
  db:getQuote: 2
  db:finishQuote: 1
  n8n.in {
    event: 'quote-request',
    correlationId: '74a537ab-1c18-4795-8088-83be1bcf1f29',
    status: 202,
    ms: 184,
    bytes: 382,
    sha256: 'de442ec833477969a041b88e5753b3bd5d65ddacd4f17fbf6769dcc94eeeac4d'
  }
  db:getQuote: 3
  db:getQuote: 4
  ```

  Сканер: email — 1 (та сама назва пакета npm), «телефон» — 2 (шматок UUID у `correlationId`), тексту форми, підписів і
  значень секретів — 0.

## Контрольний прогін B2 — B без назв із коду A

Навіщо: у копії B чекер v0.4.3 мав два коментарі з назвами з коду прогону A (див. «Відхилення від walkthrough»), і агент
B їх прочитав. Щоб перевірити, чи це вплинуло на результат, B повторено в окремій копії, де різниця з B — лише ці два
рядки коментарів (узагальнені, як у `b43f5b0`). Фіча в гілці лишається з першого B; B2 — лише доказ.

- **Копія:** `~/ws4-ab/leaddesk-ab-b2` = `git archive base` копії B (той самий BASE і скіл `042942b`), два рядки
  `check-contract.mjs` замінено; `node_modules` склоновано з копії B (`cp -Rc`, без встановлення); `git init`, коміт
  `start`, тег `base`. Перевірки (`~/ws4-runs/ab-isolation-b2.txt`; рядки з `$` — команда, у дужках — мої примітки):

  ```
  $ find leaddesk-ab-b2 -name SKILL.md -not -path "*/node_modules/*"
  leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/SKILL.md
  $ ls -A leaddesk-ab-b2 | grep -xE "tools|materials|docs|README.md|.coderabbit.yaml|.github" || echo "no hints - ok"
  no hints - ok
  $ grep -rnE "N8N_QUOTE|/api/quotes|dispatch\(quote" leaddesk-ab-b2 --exclude-dir=node_modules || echo "no run-A names - ok"
  no run-A names - ok
  $ diff -r (copy B at tag base) leaddesk-ab-b2, without node_modules and .git
  diff -r -x node_modules -x .git <тимчасова тека з git archive base копії B>/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs leaddesk-ab-b2/.claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs
  401c401
  < // e.g. dispatch(quote, { webhookUrl }) with webhookUrl = process.env.N8N_QUOTE_WEBHOOK_URL in the caller
  ---
  > // e.g. dispatch(record, { webhookUrl }) with webhookUrl = process.env.N8N_<EVENT>_WEBHOOK_URL in the caller
  519c519
  < // routes that a callbackUrl built next to the n8n call points at: "/api/quotes/${id}/callback" -> app/api/quotes/[id]/callback
  ---
  > // routes that a callbackUrl built next to the n8n call points at: "/api/<things>/${id}/callback" -> app/api/<things>/[id]/callback
  $ ls ~/.claude/projects | grep ws4-ab-b2
  (no project dir for b2 yet — no memory)
  $ ls -A ~/ws4-ab
  leaddesk-ab-a
  leaddesk-ab-b
  leaddesk-ab-b2
  ```

- **Запуск:** той самий лаунчер, запит (`prompt_sha256=498a125e…`) і прапорці, що в A і B; інший лише `--session-id`
  (`6604a94c-1a40-4f15-80b5-240275949675`). 2026-09-27 09:12:12–09:17:00 UTC, 288 с, exit 0 (`~/ws4-runs/ab-run-b2.meta`).
  Модель в init — `claude-opus-5-5`, 29 скілів, із проєктних — лише `integrating-n8n-webhooks`.
- **Що робив агент:** перший інструмент — `Skill` → `integrating-n8n-webhooks`; далі `Read` `references/code-templates.md`,
  `callback.md`, `n8n-setup.md` (виклики 3, 5, 6), код проєкту, документацію Next.js у `node_modules` (`server-only`,
  `after.md`); `check-contract.mjs` прочитав на викликах 19 і 24. Запустив `npm run lint` і `npm run build` (обидва
  пройшли); чекер спробував у формі `npx --no-install node …` — відхилено, як і в B (3 `permission_denials`: ще два
  складені `for`/`ls`-ланцюжки). Запитань не було; звернень до шляхів поза копією — 0 (розбір — `~/ws4-runs/ab-run-b2.jsonl`,
  фінальна відповідь — `ab-run-b2.result.txt`).
- **Змінені файли** (`git diff --cached --stat base`): 12 файлів, +671/−1 (у B — 14, +661/−1: B2 не додав
  `app/quotes/layout.tsx` і не чіпав `lib/lead-form.ts`). Діф: `docs/ab/b2-control.diff`.
- **Що збіглося з B:** змінні `.env.example` (`N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`, `N8N_WEBHOOK_TOKEN=
  change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`, `APP_BASE_URL=http://127.0.0.1:3000`); колбек
  `app/api/n8n/[event]/route.ts`; заголовки `x-n8n-token`, `idempotency-key`, `x-correlation-id`; `AbortSignal.timeout` і
  паузи `[1_000, 3_000]`; навіть `data` — `{ quoteId, company, email, description, budget }` з тим самим застереженням у
  відповіді («Я вважаю, що воркфлоу потрібні саме поля форми»). `N8N_QUOTE…` чи `/api/quotes/…` у коді B2 — 0 збігів.
- **`check-contract.mjs --changed-since base`** — той самий результат, що в B:

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-ab/leaddesk-ab-b2 --changed-since base   # run in the copy, checker from the working repo (v0.4.10)
  check-contract — ~/ws4-ab/leaddesk-ab-b2  (лише зміни після base)
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
  C2   PASS  Змінні N8N_* лише на сервері
  C3   PASS  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 1)
  C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only" (проігноровано у незміненому коді: 2)
  C5   PASS  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000) (проігноровано у незміненому коді: 1)
  C6   PASS  Заголовки контракту у виклику n8n (проігноровано у незміненому коді: 1)
  C7   PASS  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524 (проігноровано у незміненому коді: 2)
  C8   PASS  Тіло — конверт { version, event, data } з мінімальними data (проігноровано у незміненому коді: 1)
  C9   PASS  Server Action не чекає n8n: виклик лише в after() (проігноровано у незміненому коді: 1)
  C10  PASS  Без export const runtime = "edge"
  C11  PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C12  PASS  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
  C13  PASS  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
  Підсумок: 0 FAIL, 15 PASS, 0 N/A → exit 0
  exit=0
  ```

  (чекером копії, v0.4.3 з узагальненими коментарями, — теж `0 FAIL, 15 PASS, 0 N/A → exit 0`).
- **Висновок B2:** без назв із коду A агент зі скілом зробив ту саму контрактну реалізацію, тож витік у B на результат не
  вплинув. Межа — теж один прогін.

## Порівняння

| Що дивимось | A — без скіла | B — зі скілом |
|---|---|---|
| Скіл викликано | — (немає в копії) | так, першим інструментом; прочитано 5 `references/` |
| `check-contract.mjs --changed-since base`: FAIL (id) | **9 FAIL**: C3, C4, C5, C6, C7, C8, C12, C13, C15 | **0 FAIL** |
| URL вебхука: `/webhook/` чи `/webhook-test/` | `/webhook/quote-request` | `/webhook/quote-request` |
| `auth=` / `idempotency=` у журналі мока | `auth=missing` (403); з вимкненою перевіркою токена — `auth=none idempotency=absent` | `auth=ok idempotency=new` |
| Колбек дійшов; код відповіді застосунку | ні — воркфлоу не стартував (403); з вимкненою перевіркою токена — 401 (чекає Bearer, а не HMAC) | так, 202; `/quotes/<id>` — «Кошторис готовий» |
| Час відповіді форми | 266 мс | 143 мс |
| Тіла чи персональні дані в журналі сервера | немає | немає (структуровані `n8n.out`/`n8n.in` без тіла) |
| Змінених файлів | 11 (+523/−1) | 14 (+661/−1) |
| Запитання агента | немає | немає |
| Команди перевірки в сесії | `npm run lint`, `npm run build` — пройшли | усі відхилені (форма команд не збіглась з дозволами) |

## Перенесення прогону B у гілку (фіча)

- **Як переносили:** `git apply --3way docs/ab/b-with-skill.diff` у корені робочого репозиторію (гілка на BASE-коді +
  скіл v0.4.3); перед комітом індекс збігся зі збереженим діфом (`diff` без рядків `index` — порожній). Коміт `050a5bc`
  (`feat(quotes): carry over run B …`) без ручних правок; обидва діфи — у тому ж коміті. Потім повернуто код Task B з
  бічної гілки (`cherry-pick` → `719b6cc`, `b08b7d6`, без конфліктів).
- **Що довелось доробити руками** (кожне — окремий коміт) і чому скіл цього не дав:
  - `39be1a7` — прибрати з `.env.example` старий рядок `N8N_WEBHOOK_URL=…/webhook-test/lead-created` (C1, C3);
  - `66c046a` — перевести форму ліда (`submitLead`) з прямого `fetch` на `triggerWorkflow("lead-created", { leadId, source,
    company, budget }, ids)` в `after()` (C4–C9: без токена, ключа, таймауту й повторів, увесь лід з IP і `rawPayload`,
    очікування в Server Action);
  - `f777499` — рядок `lead-created` у `docs/n8n-integrations.md`;
  - `176dbaa` — коментар до `N8N_WEBHOOK_BASE_URL` у `.env.example` без буквального тестового шляху (агент B написав «(not
    /webhook-test)»; чекер коментарі пропускає, але рецензент, що шукає `/webhook-test/`, спіткнувся б);
  - `2398c61` — ключ ідемпотентності й `correlationId` події `lead-created` зберігаються разом із лідом (контракт: «створений
    один раз на бізнес-операцію й збережений разом із записом»);
  - `bdb7dbd` — форма кошторису з прогону B доведена до скіла `building-client-form` (його в копії B не було):
    `key` на `<select>` (бюджет більше не зникає після помилки), `aria-invalid`/`aria-describedby`, підсумок `role="alert"`,
    ліміти довжини — помилкою поля замість мовчазного обрізання, дія робить `redirect` на `/quotes/<id>` (працює й без JS);
  - `92a5226` — сторінка статусу перестає опитувати сервер, якщо колбека немає 5 хвилин, і каже, що кошторис запізнюється;
  - `07ec6d7` — колбек логує й відхилені запити (404/415/413/401/400/повтор), а не лише ті, що дійшли до розбору тіла, і
    відмовляє за `Content-Length` > 64 KB ще до читання тіла;
  - `ddf886f` — запис аудиту `lead.created` у `submitLead` — в `after()` (пункт 8 `building-client-form`);
  - `50d20ce` — з `data` події `quote-request` прибрано `email`: посилання на PDF приходить у колбеку й показується на
    `/quotes/[id]`, n8n клієнтові не пише, а контракт вимагає мінімальних `data`. Агент B сам лишив це питанням у фінальній
    відповіді: «Email я передаю, припускаючи, що воркфлоу надсилає PDF листом. Якщо не надсилає, його краще прибрати.»;
    чекер C8 такого не ловить — він шукає цілі записи, IP, заголовки й сирі дані, а не окреме поле, потрібність якого
    знає лише власник воркфлоу. У записі кошторису email лишився.

  Після рев'ю CodeRabbit на PR (9 зауважень, усі прийнято; скіл отримав ті самі зміни — `930f31c`, v0.4.9):
  - `d227c13` — `lib/n8n/client.ts`: токен іде лише на `https:` (http — тільки loopback), без редиректів
    (`redirect: "error"`), воркфлоу з колбеком вважається запущеним лише після 202 з `job_id`, непотрібне тіло відповіді
    звільняється, зламаний `APP_BASE_URL` дає `not_configured`, а не виняток;
  - `7350738` — `requestQuote`: кошторис чекає колбека лише після 202 з `jobId`; будь-яка інша відповідь чи виняток в
    `after()` — `failed`, а не вічне «Готуємо кошторис»;
  - `8fdf465` — колбек: ліміт 64 KB тримається під час читання потоку (chunked без `content-length` більше не
    буферизується повністю до підпису); ключ має стан «в обробці»/«завершено» — повтор, що прийшов, поки перша доставка
    ще пише, отримує 409, а не 200 `duplicate`;
  - `ae50666`, `961c2e0` — дії з лідом показують помилку, якщо сам запит упав, і відкочують статус; помилка нотатки зникає
    після редагування.

  Після фінального рев'ю (скіл — `58d23c6`, v0.4.10):
  - `6471b55` — `redirect: "manual"`: 3xx від n8n — помилка налаштування, без повторів (з `"error"` він повторювався як
    мережева помилка);
  - `838bfa4` — обірване тіло колбека → 400 (не 413); ключ «в обробці» старший за 60 с можна застовпити знову (обробник
    упав між claim і завершенням); пізній `failed` не перетирає `ready`.

  Після другого рев'ю CodeRabbit (на `4d06789`, 4 зауваження; скіл — `74a82fb`, v0.4.11):
  - `c9327f6` — помилка запуску (`trigger_failed`) змінює кошторис лише в `queued`/`processing` (`failQuoteTrigger`):
    якщо колбек уже записав `ready` чи `failed` зі своїм кодом, результат лишається (`838bfa4` захищав лише `ready`);
  - скіл: шаблон `parseCallback` вимагає `documentUrl` для `completed` і `error.code` для `failed`; виняток C13 для
    `if (claim …)` — лише коли умова означає «ключ не наш» (`claim === "claimed"` з 400 без звільнення тепер FAIL);
  - **не прийнято:** «перенести `quoteStore` і ключі колбеків у спільну БД/KV» (`lib/db.ts:288`). Сховище в пам'яті процесу —
    навмисна демо-архітектура проєкту: `AGENTS.md` — «Дані синтетичні, у пам'яті (`lib/db.ts`)», так само зберігаються
    ліди й користувачі з `main`. Для справжнього проєкту скіл уже вимагає таблицю з унікальним ключем і атомарний claim
    (`references/code-templates.md`, `lib/n8n/store`; `references/callback.md`), а коментар у `lib/db.ts` каже, що
    `callbackKeys` стоїть замість такої таблиці. Переписати сховище демо-застосунку на БД — окрема зміна поза задачею.

  Після третього рев'ю CodeRabbit (на `d209485`, 3 зауваження, усі прийнято; скіл — `7c0adad`, v0.4.12):
  - `9a912b3` — публічна форма кошторису: не більше 5 запитів з однієї адреси (`x-forwarded-for`; див. `b32013f` нижче) за 10 хвилин
    (`lib/rate-limit.ts`, фіксоване вікно в пам'яті процесу, як і решта демо-даних; готового обмежувача в проєкті не
    було); шостий отримує помилку форми зі збереженими значеннями, запис і виклик n8n не створюються;
  - `4d4acf3` — `updateLeadStatus`/`deleteLead`: якщо лід видалили між перевіркою й записом, дія відповідає `not_found`,
    а не `ok` (код виправлення Task A `server-auth-actions`);
  - `7c0adad` — Verify скіла чекає `14/14` (матриця має 14 кейсів з v0.4.10), а не `13/13`.

  Після четвертого рев'ю CodeRabbit (на `8066ef7`, 3 зауваження, усі прийнято):
  - `7cdb41c` (скіл v0.4.13) — `scripts/mock-n8n.mjs` скіла пише адресу колбека в журнал лише як origin + шлях (без query й
    `user:password`); через це копія в скілі тепер відрізняється від захищеного `tools/mock-n8n.mjs` у трьох місцях
    (`~/ws4-runs/mock-copy-diff.txt`), `tools/` не змінено. Прогін з `--callback-url "http://user:pass@…/x?token=abc123"` —
    у журналі `sent to http://127.0.0.1:3000/api/n8n/x`, збігів `abc123`/`user:pass` — 0 (`~/ws4-runs/mock-safe-url.txt`).
    `send-signed-callback.mjs`: некоректний чи не-http(s) `--url` — помилка аргументів, exit 2 (`send-signed-bad-url.txt`);
  - `3eb945a` — рядки таблиці дашборда проєктуються в сховищі (`db.getLeadRows`), а не вирізаються з повних клонів лідів
    (код виправлення Task A `server-serialization`); запит лишив назву `getLeads`, тож лічильники `db:*` Task A ті самі.

  Після п'ятого рев'ю CodeRabbit (`@coderabbitai full review` на `d571fe7`, 3 зауваження, усі прийнято):
  - `b32013f` — ліміт форми з `9a912b3` брав адресу з першого значення `x-forwarded-for`, яке клієнт підробляє, якщо проксі
    його не перезаписує, і не прибирав прострочені вікна. Тепер ключ на адресу — лише із заголовка, який проксі гарантовано
    перезаписує (необов'язковий `TRUSTED_CLIENT_IP_HEADER` у `.env.example`, напр. `x-real-ip` за nginx), 5 за 10 хв; і завжди —
    спільний ліміт форми 20 за 10 хв, який заголовками не обійти; прострочені вікна видаляються на кожному виклику;
  - `68f805a` — сторінка статусу `/quotes/[id]` (доступна за випадковим id без сесії) — `robots: noindex, nofollow`,
    `referrer: no-referrer`, заголовок (поля `Metadata` — за `node_modules/next/dist/docs/…/generate-metadata.md`);
  - `8696df3` (скіл v0.4.14) — приклад тіла колбека в `references/n8n-setup.md` містить `requestIdempotencyKey` і решту полів
    контракту: без нього колбек не знайде запис, якщо відповідь 202 загубилась.

  `39be1a7`, `66c046a`, `f777499`, `2398c61`, `ddf886f` — старий код з `main`, якого запит не стосувався (агент B сам назвав
  `lead-created` порушенням контракту, але в межах задачі про кошториси його не чіпав). `176dbaa`, `bdb7dbd`, `92a5226` —
  код прогону B, але не контракт n8n: вади форми (пункти чекліста `building-client-form`) і безкінечне опитування знайшло
  фінальне рев'ю PR. `ae50666` — `components/lead-actions.tsx` і `4d4acf3` — `app/actions.ts` з виправлення Task A (`9144df3`,
`5aa43a6`), `961c2e0` — форма нотатки з прогону Task B (`719b6cc`); `9a912b3` — дія кошторису з прогону B. `07ec6d7`, `50d20ce`, `d227c13`, `7350738`, `8fdf465` —
  n8n-частина коду B: журналювання відмов, поле `email` у `data`, а після CodeRabbit — вимоги до адреси й відповіді n8n,
  ліміт тіла під час читання та стани ключа, а після фінального рев'ю — `6471b55`, `838bfa4`. Заголовки, конверт `{ version, event, data, callbackUrl }`, повтори (2, лише
  мережа/5xx/524) і порядок кроків колбека з коду B лишились ті самі; правило про ліміт під час читання, 202 з `job_id` і
  стани ключа контракт скіла до v0.4.9 не містив — його додано й у скіл.
- **Ключі контракту в `.env.example`:** `N8N_WEBHOOK_BASE_URL=http://127.0.0.1:5678/webhook`,
  `N8N_WEBHOOK_TOKEN=change-me-webhook-token`, `N8N_CALLBACK_SECRET=change-me-callback-secret`,
  `APP_BASE_URL=http://127.0.0.1:3000`; `/webhook-test/` немає; з `b32013f` — ще необов'язковий порожній
  `TRUSTED_CLIENT_IP_HEADER` (не секрет: назва заголовка для ліміту форми). `.env.local` гілки створено тим самим скриптом (старий файл
  з етапу 0 не відкривали — перейменовано на `.env.local.pre-ws4d`, обидва ігноруються git).
- **`npm run lint`, `npm run build` на гілці:** exit 0, без попереджень — `~/ws4-runs/branch-lint-final10.log`,
  `branch-build-final10.log` на `8696df3` (фінальний код). Раніше: `-final9.log` на `3eb945a`, `-final8.log` на `7c0adad`, `-final7.log` на `74a82fb`, `-final6.log` на `58d23c6`, `branch-{lint,build}-final5.log` на `930f31c`,
  `-final4.log` на `6bf19e8`; `branch-build-final3.log` — збірка після `ddf886f` (у файлі немає рядка з SHA).
- **`check-contract.mjs` на фінальному коді** (0 FAIL, код виходу 0). Той самий вивід — у `~/ws4-runs/branch-check-final3.txt`
  (код `ddf886f`, чекер v0.4.7), `branch-check-final4.txt` (`6bf19e8`, v0.4.8), `branch-check-final5.txt` (`930f31c`, v0.4.9)
  `branch-check-final6.txt` (`58d23c6`, v0.4.10), `branch-check-final7.txt` (`74a82fb`, v0.4.11), `branch-check-final8.txt`
  (`7c0adad`, v0.4.12), `branch-check-final9.txt` (`3eb945a`, v0.4.13) і `branch-check-final10.txt` (`8696df3`, v0.4.14):

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs
  check-contract — ~/Work/Agentic Development Course/04
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
  C2   PASS  Змінні N8N_* лише на сервері
  C3   PASS  .env.example: ключі контракту з безпечними значеннями
  C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only"
  C5   PASS  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
  C6   PASS  Заголовки контракту у виклику n8n
  C7   PASS  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
  C8   PASS  Тіло — конверт { version, event, data } з мінімальними data
  C9   PASS  Server Action не чекає n8n: виклик лише в after()
  C10  PASS  Без export const runtime = "edge"
  C11  PASS  Колбек читає сире тіло й не парсить JSON до перевірки підпису
  C12  PASS  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
  C13  PASS  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
  Підсумок: 0 FAIL, 15 PASS, 0 N/A → exit 0
  exit=0
  ```

- **Сценарій «форма → колбек → `/quotes/<id>`» ще раз, уже на гілці** (`npm run build && npm start`, мок
  `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`): форма кошторису відповіла за 140 мс,
  через ~5 с `/quotes/<id>` — «Кошторис готовий» з посиланням на PDF; форма ліда на головній — 386 мс. Журнал мока
  (`~/ws4-runs/branch-mock.log`):

  ```
  [mock-n8n] 2026-09-26T17:00:13.527Z POST /webhook/quote-request -> 202 in 3 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 406 B sha256=afee3288b4b80b8f7cb3c303904eb737f31146cdd65839fd8b1b337df7edbebd
  [mock-n8n] 2026-09-26T17:00:13.527Z workflow 5da2e5e7-b115-42ad-b141-918a7bba07a1 running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-26T17:00:18.742Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 212 ms (try 1/3) event=quote-request.completed body 382 B sha256=204ed6c5ff74aa3e743b3a4645fe3e163cc8ccea854fb3ee84f9460d44535f09
  [mock-n8n] 2026-09-26T17:00:43.632Z POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 131 B sha256=334665f0da9058db69da5992e92776a302bb1c135fc89078d0bf92be5ac5357b
  [mock-n8n] 2026-09-26T17:01:03.355Z stopping (SIGTERM)
  ```

  Журнал сервера гілки (`~/ws4-runs/branch-server.log`, 102 рядки): `db:*` і рядки `n8n.out`/`n8n.in` без тіл; сканер — email 1 (назва пакета npm),
  «телефон» 3 (шматки UUID і sha256), тексту форм, номера з форми ліда, підписів і значень секретів — 0.
- **Той самий сценарій після доробок `bdb7dbd`, `92a5226`, `2398c61`** (нова збірка, мок `--delay 5000`):
  - без JavaScript (`~/ws4-runs/nojs-post.mjs`: приховані поля дії зі сторінки + POST `multipart/form-data`): порожня форма →
    HTTP 200 і `role="alert"` «Вкажіть компанію / Перевірте email / Опишіть задачу…»; опис на 2001 символ → «Опис задовгий:
    2001 із 2000 символів»; валідна → HTTP 303 на `/quotes/1131a531…`;
  - у браузері з JS: помилка валідації (порожня компанія й опис, email `not-an-email`) — бюджет «$1500–5000» і введений email
    лишились, у поля `aria-invalid="true"` і `aria-describedby="quote-email-error"`; валідна відправка — 253 мс (відповідь дії
    вже з редиректом), за ~5 с `/quotes/<id>` — «Кошторис готовий», бюджет «$1500–5000 / міс.»;
  - форма ліда (без JS) — `lead-created` з ключем, збереженим разом із лідом. Журнал мока (`~/ws4-runs/branch-mock2.log`):

  ```
  [mock-n8n] 2026-09-26T17:20:53.178Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 354 B sha256=ffd6845daba360313b671362da4c4c591d66eb50bb37615f187e9fbc11c0c0d3
  [mock-n8n] 2026-09-26T17:20:53.179Z workflow dc2a77d0-5733-4a56-90af-4ef08fc19325 running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-26T17:20:58.403Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 222 ms (try 1/3) event=quote-request.completed body 382 B sha256=4cb8dec0665395f5f9d7f5a5da4c9ef499d5c601815dcdde88c0c2335df4be1b
  [mock-n8n] 2026-09-26T17:21:39.808Z POST /webhook/quote-request -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 366 B sha256=cfe4d08c39e08cb4f3b12279871973e157a91fad59dcfeafc6fc066014a6b33c
  [mock-n8n] 2026-09-26T17:21:39.810Z workflow 7907d46e-d5c2-46a5-b661-8adba555f55d running for 5000 ms, then callback event=quote-request.completed
  [mock-n8n] 2026-09-26T17:21:45.005Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 194 ms (try 1/3) event=quote-request.completed body 382 B sha256=4fb9b31561a3e4cce73beb918a94bed339f8eea106e7817706eb95c8858ecf24
  [mock-n8n] 2026-09-26T17:22:03.615Z POST /webhook/lead-created -> 202 in 0 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 130 B sha256=daa2882f3c6c46a6a5894e339b5d47459d57990de7f0168d8873a5ac55fda3f4
  [mock-n8n] 2026-09-26T17:22:16.653Z stopping (SIGTERM)
  ```

  Фрагмент журналу сервера (`~/ws4-runs/branch-server2.log`, рядки 13–34 — кошторис без JS від запиту до колбека — і 61–71 — `lead-created`; 71 рядки, сканер — 0 тексту форм, номерів
  телефону, підписів і значень секретів; «телефонні» збіги — цифри всередині `correlationId` і sha256):

  ```
  db:insertQuote: 1
  n8n.out {
    event: 'quote-request',
    correlationId: '0350c39a-6d78-428e-abed-843159569447',
    status: 202,
    ms: 13,
    attempt: 1,
    bytes: 354,
    sha256: 'ffd6845daba360313b671362da4c4c591d66eb50bb37615f187e9fbc11c0c0d3'
  }
  db:setQuoteJob: 1
  db:claimCallbackKey: 1
  db:findQuoteForCallback: 1
  db:finishQuote: 1
  n8n.in {
    event: 'quote-request',
    correlationId: '0350c39a-6d78-428e-abed-843159569447',
    status: 202,
    ms: 186,
    bytes: 382,
    sha256: '4cb8dec0665395f5f9d7f5a5da4c9ef499d5c601815dcdde88c0c2335df4be1b'
  }
  …
  db:insertLead: 1
  db:insertAuditEntry: 1
  n8n.out {
    event: 'lead-created',
    correlationId: '45ac443b-0d41-49c6-bceb-f3c13b9b78f8',
    status: 202,
    ms: 4,
    attempt: 1,
    bytes: 130,
    sha256: 'daa2882f3c6c46a6a5894e339b5d47459d57990de7f0168d8873a5ac55fda3f4'
  }
  ```
- **Матриця підписаних колбеків** проти гілки на коді `ddf886f` (мок з `--delay 60000`, `jobId` — з рядка
  `workflow <jobId> running` після відправки форми; скрипт v0.4.7, ±305 с). Три прогони на трьох свіжих задачах — 13/13
  щоразу (`~/ws4-runs/branch-callback-matrix-v3.txt`; на `6bf19e8` і `930f31c` — теж 3×13/13, `-v4.txt`, `-v5.txt`; на
  `58d23c6`, `74a82fb`, `7c0adad`, `3eb945a` і фінальному `8696df3` — 3×14/14 скриптом v0.4.10, `-v6.txt` … `-v10.txt`),
  нижче перший:

  ```
  $ node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request --job-id 576e1e6f-a7be-463e-bfb8-683acf1b1c74
  send-signed-callback → http://127.0.0.1:3000/api/n8n/quote-request (подія «quote-request», jobId 576e1e6f-a7be-463e-bfb8-683acf1b1c74)
  OK        невідома подія в шляху                               очікувано 404, отримано 404
  OK        content-type не json                                 очікувано 415, отримано 415
  OK        тіло > 64 KB                                         очікувано 413, отримано 413
  OK        без x-n8n-timestamp і x-n8n-signature                очікувано 401, отримано 401
  OK        час −305 с                                           очікувано 401, отримано 401
  OK        час +305 с                                           очікувано 401, отримано 401
  OK        хибний підпис (інший секрет)                         очікувано 401, отримано 401
  OK        тіло переформатоване після підпису                   очікувано 401, отримано 401
  OK        валідний колбек                                      очікувано 202, отримано 202
  OK        повтор того самого ключа                             очікувано 200, отримано 200
  OK        ключ ≠ jobId:event з тіла                            очікувано 400, отримано 400
  OK        той самий невідповідний ключ ще раз (ключ звільнено) очікувано 400, отримано 400
  OK        подія в тілі ≠ шлях                                  очікувано 400, отримано 400
  Підсумок: 13/13 збіглися → exit 0
  exit=0
  ```

  Історія: перший прогін на гілці (код `66c046a`, скрипт з кейсами ±301 с) дав 13/13 — `~/ws4-runs/branch-callback-matrix.txt`;
  власний колбек мока тієї задачі прийшов через 60 с і отримав `200` як повтор
  (`2026-09-26T17:02:26.884Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 200 in 41…`). Повторний прогін на фінальному
  коді дав 11/13 (`~/ws4-runs/branch-final-checks.txt`): «+301 с» отримав 202, бо скрипт округлював час вниз до секунди й
  кейс стояв на самій межі вікна, а наступний «валідний» кейс уже натрапив на застовплений ключ (200). Роут поводився за
  контрактом; скрипт виправлено у v0.4.7 (`d986329`) — ±305 с.
- **Код після `07ec6d7` і `ddf886f`** (нова збірка, мок `--delay 60000`, `~/ws4-runs/branch-final-checks.txt`):
  кошторис без JS → HTTP 303 на `/quotes/<id>`; форма ліда без JS → `lead-created` з `auth=ok idempotency=new`
  (`~/ws4-runs/branch-mock3.log`); матриця — див. вище. У журналі сервера (`~/ws4-runs/branch-server3.log`, 535 рядків) тепер
  є і відхилені колбеки — 53 рядки `n8n.in`: 401 ×19, 400 ×12, 200 ×6, 404/413/415 ×4 кожен, 202 ×4. Приклад (рядки 46–53):

  ```
  n8n.in {
    event: 'quote-request',
    correlationId: 'da5a7ba0-ff83-4820-9a87-2a080ad5ab1d',
    status: 401,
    ms: 0,
    bytes: 348,
    sha256: '56b90ae2e80be47cb6e6e463a81bf3658b3f0109747ac589f97a428ae30b2c91'
  }
  ```

  Сканер (`~/ws4-runs/branch-server3-scan.txt`; для `branch-server2.log` — `branch-server2-scan.txt`): email — 1 (назва пакета
  npm), тексту форм, підписів і значень секретів — 0; 22 «телефонні» збіги — цифри всередині UUID і sha256.
- **Фінальний код, HEAD `8696df3`** (після п'ятого рев'ю CodeRabbit; від `3eb945a` змінились `lib/rate-limit.ts`,
  `app/quotes/actions.ts`, `app/quotes/[id]/page.tsx`, `.env.example` і `references/n8n-setup.md`) — два запуски `npm start`,
  мок зі скіла:
  - без `TRUSTED_CLIENT_IP_HEADER`, мок `--mode immediately`: 21 запит без JS, кожен з новим підробленим `x-forwarded-for` —
    перші 20 → HTTP 303, 21-й → HTTP 200 з «Забагато запитів за короткий час…»; викликів вебхука в журналі мока — 20
    (`~/ws4-runs/branch-rate-limit-global.txt`); сторінка статусу — `<meta name="robots" content="noindex, nofollow"/>`,
    `<meta name="referrer" content="no-referrer"/>`, `<title>Статус кошторису · LeadDesk</title>` (`branch-quote-meta.txt`);
  - `TRUSTED_CLIENT_IP_HEADER=x-real-ip npm start` (змінна лише в команді запуску), мок `--mode respond-202 --delay 60000`:
    матриця — 14/14 тричі (`~/ws4-runs/branch-callback-matrix-v10.txt`); з `x-real-ip: 203.0.113.7` запити 1–5 → 303, 6-й →
    200 з тим самим повідомленням, з `x-real-ip: 203.0.113.8` — знову 303; викликів вебхука — 9 (3 матриці + 6)
    (`branch-rate-limit-address.txt`);
  - журнали сервера (`branch-server10a.log` 491 рядок, `branch-server10b.log` 514 за `wc -l`), сканер
    (`branch-server10{a,b}-scan.txt`): тексту форм, адрес `example.test`, IP із запитів, підписів і значень секретів — 0.
- **Код `3eb945a`** (після четвертого рев'ю CodeRabbit; від `7c0adad` змінились `lib/db.ts`, `lib/data.ts`
  і скрипти скіла) — нова збірка, `npm start`, мок **зі скіла** `node --env-file=.env.local
  .claude/skills/integrating-n8n-webhooks/scripts/mock-n8n.mjs --mode respond-202 --delay 60000`:
  - матриця — 14/14 тричі на трьох свіжих кошторисах без JS (HTTP 303) (`~/ws4-runs/branch-callback-matrix-v9.txt`);
  - `/dashboard` (`~/ws4-runs/measure.sh`, `taskA-after-projection.txt`): TTFB 1,418 / 1,416 / 1,415 с, RSC 31 257 B (як на
    `e22e94c`), HTML 111 447 B (на `e22e94c` — 111 377 B; від того часу змінилась решта сторінки, рядки в RSC — ті самі),
    email, телефонів і PII-ключів — 0, лічильники `db:*` на запит — ті самі, що в Task A;
  - журнал сервера (`~/ws4-runs/branch-server9.log`, 504 рядки за `wc -l`), сканер (`branch-server9-scan.txt`): тексту форм
    («Synthetic»), адрес `example.test`, підписів і значень секретів — 0.
- **Код `7c0adad`** (після третього рев'ю CodeRabbit; від `74a82fb` змінились `app/actions.ts`,
  `app/quotes/actions.ts`, новий `lib/rate-limit.ts` і Verify у `SKILL.md`) — нова збірка, `npm start`, мок
  `--mode respond-202 --delay 60000`:
  - кошторис без JS → HTTP 303 на `/quotes/1f24bc8e…`; до колбека — «Готуємо кошторис», після валідного колбека з матриці —
    «Кошторис готовий» з PDF, адрес `@quotes.example.test` — 0 (`~/ws4-runs/branch-scenario8.txt`);
  - матриця — 14/14 тричі на трьох свіжих задачах (`~/ws4-runs/branch-callback-matrix-v8.txt`);
  - ліміт форми (`~/ws4-runs/branch-rate-limit.txt`): після трьох кошторисів з тієї ж адреси 4-й і 5-й запити — HTTP 303,
    6-й — HTTP 200 з `role="alert"` «Забагато запитів за короткий час. Спробуйте ще раз за кілька хвилин.»; викликів
    `POST /webhook/quote-request` у журналі мока — рівно 5;
  - `not_found` для ліда, видаленого між перевіркою й записом, прогоном не відтворювали — лише код (`app/actions.ts`);
  - журнал сервера (`~/ws4-runs/branch-server8.log`, 468 рядків за `wc -l`), сканер (`branch-server8-scan.txt`): email — 1
    (назва пакета npm), тексту форм («Synthetic»), адрес `example.test`, підписів і значень секретів — 0.
- **Код `74a82fb`** (після другого рев'ю CodeRabbit; від `58d23c6` змінились лише `lib/db.ts`,
  `app/quotes/actions.ts` і скіл) — нова збірка, `npm start`, мок `--mode respond-202 --delay 60000`:
  - кошторис без JS → HTTP 303 на `/quotes/a62f702e…`; до колбека сторінка — «Готуємо кошторис», після валідного
    колбека з матриці — «Кошторис готовий» з посиланням на PDF, адрес `@quotes.example.test` — 0 (`~/ws4-runs/branch-scenario7.txt`);
  - матриця v0.4.10 — 14/14 тричі на трьох свіжих задачах (`~/ws4-runs/branch-callback-matrix-v7.txt`);
  - мок `--mode immediately` (200 без `job_id`): кошторис одразу «Не вдалося підготувати кошторис», у журналі сервера —
    `db:failQuoteTrigger` (`~/ws4-runs/branch-trigger-200.txt`, `branch-server7.log`); випадок «колбек раніше за помилку
    запуску» прогоном не відтворювали — лише код (`failQuoteTrigger` змінює лише `queued`/`processing`);
  - журнал сервера (`~/ws4-runs/branch-server7.log`, 601 рядок за `wc -l`), сканер (`branch-server7-scan.txt`): email — 1
    (назва пакета npm), тексту форм («Synthetic»), адрес `example.test`, підписів і значень секретів — 0.
- **Код `58d23c6`** (після раунду CodeRabbit і фінального рев'ю; сценарій у браузері й журнали) — нова збірка, `npm start`, мок
  `node --env-file=.env.local tools/mock-n8n.mjs --mode respond-202 --delay 5000`, потім `--delay 60000` для матриці:
  - кошторис без JS (`~/ws4-runs/branch-scenario6.txt`) → HTTP 303 на `/quotes/3ac1801a…`; через ~5 с сторінка — «Кошторис
    готовий» з посиланням на PDF, адрес `@quotes.example.test` на ній немає;
  - у вбудованому браузері з JS (сирі результати — `~/ws4-runs/browser-measurements.txt`, блок «2026-09-27, HEAD 58d23c6»):
    POST дії `/quotes/new` — 230 мс, перехід на `/quotes/aa203404…` — 243 мс; сторінка сама дійшла до «Кошторис готовий»,
    email на ній — 0; форма ліда — POST 136 мс, «Дякуємо! Заявку отримано.»;
  - журнал мока — весь файл (`~/ws4-runs/branch-mock6.log`):

    ```
    [mock-n8n] 2026-09-27T09:16:24.084Z listening on http://127.0.0.1:5678  mode=respond-202  delay=5000 ms  cloud-timeout=off
    [mock-n8n] 2026-09-27T09:16:24.084Z production URLs: POST http://127.0.0.1:5678/webhook/<path>
    [mock-n8n] 2026-09-27T09:16:24.084Z test URLs: not registered (start with --listen to open them for 120 s)
    [mock-n8n] 2026-09-27T09:16:24.084Z header auth: x-n8n-token required (N8N_WEBHOOK_TOKEN is set)
    [mock-n8n] 2026-09-27T09:16:24.084Z callbacks: signed, sent to the request's callbackUrl after 5000 ms (async modes)
    [mock-n8n] 2026-09-27T09:16:32.619Z POST /webhook/quote-request -> 202 in 2 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 256 B sha256=dbc9b2e032beb3c052cb6b7849f441d3a1e751236d4fe84588ffedf8d0aee830
    [mock-n8n] 2026-09-27T09:16:32.619Z workflow 4186f291-2ce5-4741-b6f9-277a5dc60c0f running for 5000 ms, then callback event=quote-request.completed
    [mock-n8n] 2026-09-27T09:16:37.858Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 237 ms (try 1/3) event=quote-request.completed body 382 B sha256=fa2524ba05b45d350a17b918869c465ef87013c9aa1981151208c26574584c1b
    [mock-n8n] 2026-09-27T09:16:48.491Z POST /webhook/quote-request -> 202 in 0 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 281 B sha256=74c52b2971370c28addd4b4be29dc7544d969cc0fe6f1184bff49c78249be71f
    [mock-n8n] 2026-09-27T09:16:48.491Z workflow 69c02897-e881-4edd-a58a-0ac79f3ca6b3 running for 5000 ms, then callback event=quote-request.completed
    [mock-n8n] 2026-09-27T09:16:53.713Z callback POST http://127.0.0.1:3000/api/n8n/quote-request -> 202 in 220 ms (try 1/3) event=quote-request.completed body 382 B sha256=3ebc37675773f3743c214a70cd1318978ea6b1d377484d4792622698159d1bc1
    [mock-n8n] 2026-09-27T09:17:06.417Z POST /webhook/lead-created -> 202 in 1 ms auth=ok idempotency=new | headers: accept,accept-language,content-type,idempotency-key,user-agent,x-correlation-id,x-n8n-token | body 129 B sha256=6009eb78571370614c019a6d34abe80f66d7fdecef9f051057037b9ad5c3f31f
    [mock-n8n] 2026-09-27T09:17:15.348Z stopping (SIGTERM)
    ```

  - що тіло вебхука — конверт без `email`: `~/ws4-runs/body-proof6.mjs` збирає `{ version: 1, event, data: { quoteId, company,
    description, budget }, callbackUrl }` з тих самих полів, як `lib/n8n/client.ts`, і дає ті самі 256 B / `dbc9b2e0…` і
    281 B / `74c52b29…`, що в журналі мока (`~/ws4-runs/body-proof6.txt`);
  - фрагмент журналу сервера (`~/ws4-runs/branch-server6.log`, рядки 11–34 — кошторис без JS від запису до колбека):

    ```
    db:insertQuote: 1
    n8n.out {
      event: 'quote-request',
      correlationId: '9c80effe-e469-4a4b-a4b3-b298f38e921f',
      status: 202,
      ms: 13,
      attempt: 1,
      bytes: 256,
      sha256: 'dbc9b2e032beb3c052cb6b7849f441d3a1e751236d4fe84588ffedf8d0aee830'
    }
    db:setQuoteJob: 1
    db:claimCallbackKey: 1
    db:findQuoteForCallback: 1
    db:finishQuote: 1
    db:completeCallbackKey: 1
    n8n.in {
      event: 'quote-request',
      correlationId: '9c80effe-e469-4a4b-a4b3-b298f38e921f',
      status: 202,
      ms: 208,
      bytes: 382,
      sha256: 'fa2524ba05b45d350a17b918869c465ef87013c9aa1981151208c26574584c1b'
    }
    db:getQuote: 1
    ```

  - матриця підписаних колбеків v0.4.10 — 14/14 тричі на трьох свіжих задачах, зокрема тіло частинами без
    `content-length` → 413 і дві одночасні доставки → 202 і 409 (`~/ws4-runs/branch-callback-matrix-v6.txt`, перший прогін —
    у `docs/verification.md`, Task C);
  - журнал сервера цілком (503 рядки за `wc -l`): 47 рядків `n8n.in` — 401 ×15, 400 ×9, 413 ×6, 202 ×5, 200 ×3, 409 ×3,
    404/415 ×3 кожен — і 6 `n8n.out`; сканер (`~/ws4-runs/branch-server6-scan.txt`): email — 1 (назва пакета npm), тексту форм
    цього прогону («Synthetic»), адрес `example.test`, підписів і значень секретів — 0; 9 «телефонних» збігів — цифри
    всередині `correlationId` (UUID) і sha256;
  - схему `N8N_WEBHOOK_BASE_URL` (https або loopback) і заборону редиректів прогоном не перевіряли — лише код
    (`lib/n8n/client.ts`), бо локальний мок слухає саме loopback по http.

  На `930f31c` (раунд CodeRabbit, до фінального рев'ю) — той самий сценарій і 3 × 13/13 (`branch-mock5.log`,
  `body-proof5.txt`, `branch-callback-matrix-v5.txt`, `branch-server5.log`); там же перевірено в браузері форму нотатки й
  збій дії з лідом (блок «HEAD 930f31c» у `browser-measurements.txt`; `components/` після `930f31c` не змінювались):
  після порожньої відправки — «Напишіть текст нотатки», `aria-invalid="true"`, `aria-describedby="note-hint note-error"`,
  після введення тексту — помилки немає, `aria-invalid="false"`; зміна статусу з навмисно відхиленим запитом дії — статус
  лишився `qualified`, у `role="alert"` — «Не вдалося зберегти зміну. Перевірте з'єднання й спробуйте ще раз.». Проба
  `~/ws4-runs/probe-callback-v9.mjs` там дала chunked → 413, одночасні → 202 і 409, повтор → 200 (тепер це кейси матриці).
  На `6bf19e8` — `branch-mock4.log`, `body-proof4.txt`, `branch-callback-matrix-v4.txt`; час із браузера того прогону сирим
  не збережено, тому не наводимо.
- **Рядок у `docs/n8n-integrations.md`:** `quote-request` (з прогону B, без `email` у `data` після `50d20ce`) і
  `lead-created` (доробка `f777499`).

## Відхилення від walkthrough (і чому)

- Прогони — headless `claude -p` через один лаунчер, а не інтерактивні сесії: однакові прапорці, повний журнал
  інструментів (зокрема субагентів — їх не було) і `permission_denials`.
- Копії — у `~/ws4-ab/`, а не `../`; замість `rm -rf` — `git archive … ':(exclude)…'` (нічого не видаляємо); `npm ci`
  замість `npm install` (lockfile не змінюється).
- Скіл у копії B — з `042942b` (v0.4.3), а не з BASE `43acafd` (v0.4.2): після прогону A стало видно, що чекер не бачить
  n8n-коду A (див. застереження в розділі A); виправлення закомічено, скіл у копії B замінено до прогону B (коміт `start`
  переписано, тег `base` перевішено, перевірки кроку 1 і `/context` повторено — `~/ws4-runs/ab-isolation.txt`,
  `context-ab-b2.txt`). Код обох копій — той самий BASE; walkthrough і так бере скіл для B «з HEAD».
  Витік, який ця заміна внесла: два коментарі в чекері v0.4.3 мали за приклад назви з коду прогону A —
  `dispatch(quote, { webhookUrl })`, `process.env.N8N_QUOTE_WEBHOOK_URL`, `"/api/quotes/${id}/callback"`. Агент B прочитав
  `check-contract.mjs` (рядки 1–789 першим `Read`) — ці рядки є в результаті інструмента. На результат B це, найпевніше, не
  вплинуло: коментарі описують, як чекер розпізнає код **поза** контрактом, а B зробив саме контрактне — `N8N_WEBHOOK_BASE_URL`
  і колбек `app/api/n8n/[event]`, за `SKILL.md` і `references/code-templates.md`, які прочитав до чекера. У v0.4.6
  (`b43f5b0`) коментарі узагальнено. Контрольний прогін B2 без цих рядків дав той самий результат (розділ «Контрольний
  прогін B2»).
- Сценарій A з моком (16:49–16:51 UTC) ішов, поки ще працювала сесія B (16:48–16:55 UTC): так вийшло, бо скіл для B
  оновили одразу після A. Сесія B мережевих запитів не робила й до сервера копії A не зверталась, тож на неї це не впливало.
- Сценарій з моком проходив у вбудованому браузері застосунку (DevTools Network замінено на
  `performance.getEntriesByType("resource")`), з синтетичними даними `*.example.test`.

## Висновок

Скіл змінив результат по суті, а не за формою. Без скіла агент зробив акуратну фічу (`after()`, неперебірні id, власний
Bearer-токен на запит), але за власною схемою, тож у середовищі, налаштованому за контрактом, вона не працює: n8n
відхиляє виклик (403 без `x-n8n-token`), а контрактний колбек отримав би 401; `check-contract` — 9 FAIL. Домовленості A —
з наявного коду, документації Next.js у `node_modules` і загальних знань; контракту в копії не було. Агент зі скілом
першим кроком завантажив скіл, прочитав `references/` і відтворив контракт повністю: 0 FAIL, `auth=ok idempotency=new`,
колбек 202; матриця на гілці — 13/13 скриптом v0.4.7 (13 кейсів), а на фінальному коді — 14/14 скриптом v0.4.10
(додано тіло частинами → 413 і одночасні доставки → 202 і 409). Доробляли руками старий код поза задачею (`lead-created`, `.env.example`) і, вже
після фінального рев'ю, форму кошторису до скіла `building-client-form`, межу опитування сторінки статусу, журналювання
відмов у колбеку та зайвий `email` у `data` (агент B сам радив прибрати його, якщо воркфлоу не шле лист). Рев'ю CodeRabbit
знайшло те, чого не було ні в коді B, ні в самому скілі: https для токена, редиректи, 202 з `job_id`, ліміт тіла під час
читання, стан ключа «в обробці» — це виправлено і в коді, і в скілі (v0.4.9, доведено у v0.4.10 після фінального рев'ю).
Заголовки, конверт, повтори й порядок кроків колбека з коду B лишились без змін. Контрольний прогін B2 (скіл без назв із
коду A) дав ту саму реалізацію й 0 FAIL — витік коментарів чекера на результат B не вплинув. Між прогонами A і B у скілі змінили чекер (v0.4.3, `042942b`, — бачить виклики й колбеки
без «n8n» у назвах); після прогону B — Verify (v0.4.4, `708f97a`, — запускати команди саме в наведеному вигляді: B не
виконав жодної перевірки через форму команд; це правило потім перевірено окремою пробою r4 з тими самими дозволами — `docs/verification.md`, Task C).
Межа висновку — по одному прогону на гілку (плюс контрольний B2, який перевіряв лише вплив витоку; на відміну від B,
він запустив `npm run lint` і `npm run build` у дозволеній формі — тобто те, чи агент виконає перевірки, між
прогонами різниться, а сама реалізація — ні).
