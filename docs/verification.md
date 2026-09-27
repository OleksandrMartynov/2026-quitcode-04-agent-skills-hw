# Перевірка (Task A–C)

- **Інструмент і версія, модель:** Claude Code — основна сесія в десктоп-застосунку Claude (Opus 5.5);
  «свіжі сесії» (рев'ю скілом, перевірки спрацювання) — окремі процеси Claude Code **2.1.280** у режимі
  `claude -p` з очищеним оточенням, модель `claude-opus-5-5`, effort `high`, без MCP-серверів.
- **ОС і термінал, Node:** macOS 26.5.1 · zsh 5.9 · Node 24.20.0 · npm 11.19.0

## Скіли видно у свіжій сесії

- Як перевіряли: свіжа headless-сесія `claude -p "/context"` з кореня репозиторію (розділ Skills звіту
  `/context`) + список `skills` з init-події тієї ж сесії.

**Task A (коміт `084f9ff`, одразу після встановлення):**

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `vercel-react-best-practices` | Project | рядок `vercel-react-best-practices \| Project \| ~120` у розділі Skills `/context` |

**Усі три скіли (коміт `75d33bb`, перед BASE; сесія `054bb5e5…`, `claude -p "/context"` через `~/ws4-runs/run.sh`):**

| Skill | Звідки (Project / Personal / вбудований) | Примітка |
|---|---|---|
| `building-client-form` | Project | рядок `building-client-form \| Project \| ~310` у розділі Skills `/context` |
| `integrating-n8n-webhooks` | Project | рядок `integrating-n8n-webhooks \| Project \| ~350` у розділі Skills `/context` |
| `vercel-react-best-practices` | Project | рядок `vercel-react-best-practices \| Project \| ~120` у розділі Skills `/context` |

Решта розділу Skills — 13 вбудованих (`dataviz`, `update-config`, `keybindings-help`, `code-review`, `simplify`,
`fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `workflow-authoring`, `run`, `init`, `security-review`)
і 9 синхронізованих з claude.ai (`anthropic-skills:*`); у списку `skills` init-події — 31 назва.

- Особисті скіли, які теж видно: `review-task` (`~/.claude/skills/review-task`, скіл рев'ю від викладача з
  `disable-model-invocation: true` — є в init-списку `skills`, але не в розділі Skills `/context`, тобто модель
  сама його не викликає) і синхронізовані з claude.ai `anthropic-skills:{docs,docx,google-workspace,import-memory,
  morning,pdf,pptx,skill-creator,xlsx}` (у `/context` — джерело «claude.ai sync»); решта — вбудовані скіли Claude Code.
  Жоден не стосується продуктивності React, форм чи n8n (`grep -rilE "x-n8n|timingSafeEqual|idempotency-key|n8n|webhook"
  ~/.claude/skills` знаходить лише загальне слово «webhooks» у `review-task/CRITERIA.md` — критерії рев'ю), тож на
  перевірки вони не впливають. Скіл `find-skills`, який CLI `skills` поставив глобально під час повторного
  встановлення, відсунуто з `~/.claude/skills` до будь-яких наступних свіжих сесій (`docs/skill-review.md`, розділ 6).

## Task A — виправлення за скілом Vercel

**Рев'ю застосунку скілом.** Свіжа headless-сесія (`31cfc6b5-2824-49d7-b234-1f8a8f0e3e4c`, Edit/Write/Bash
заборонені) з запитом із walkthrough: «Зроби рев'ю app/, components/, lib/ за скілом vercel-react-best-practices.
Для кожної проблеми — рядок таблиці: файл:рядок | id правила | що не так | виправлення для Next.js 16. Файли не
змінюй.» Першим викликом інструмента в журналі сесії був `Skill` → `vercel-react-best-practices`; далі 27
`Read`, 4 `Grep`, 2 `Glob`, 0 відмов у доступі. Номери рядків — від коду `main`. Усі 16 id із таблиці є
файлами в `.claude/skills/vercel-react-best-practices/rules/` (перевірено `test -f` для кожного).

<details><summary>Таблиця сесії рев'ю (дослівно)</summary>

| файл:рядок | id правила | що не так | виправлення для Next.js 16 |
|---|---|---|---|
| `app/dashboard/page.tsx:16-18` | `async-parallel` | `getLeads` (400 мс), `getLeadStats` (1200 мс) і `getSourceBreakdown` (400 мс) не залежать один від одного, але чекаються по черзі. Разом 2000 мс, хоча вистачило б 1200. | `const [leads, stats, sources] = await Promise.all([getLeads(id), getLeadStats(id), getSourceBreakdown(id)])` |
| `app/dashboard/page.tsx:17,29` | `async-suspense-boundaries` | Найповільніший запит, статистика на 1200 мс, блокує всю сторінку. Таблиця могла б з'явитися значно раніше. | Винести статистику в окремий async-компонент `<Stats workspaceId>` і обгорнути в `<Suspense fallback={<StatsSkeleton/>}>`. Так само вчинити з графіком. Додати `app/dashboard/loading.tsx`, щоб оболонка показувалася одразу. |
| `app/actions.ts:53-63` | `server-after-nonblocking` | Користувач чекає на webhook у n8n і на `logAudit` (250 мс), перш ніж побачити «Дякуємо». Обидві дії йому не потрібні для відповіді. | `import { after } from "next/server"`, далі `after(() => Promise.allSettled([fetch(...), logAudit("lead.created", lead.id)]))` і одразу `return { status: "ok" }`. `after()` офіційно підтримується в Server Functions. |
| `lib/data.ts:7` | `server-cache-react` | `getCurrentUser` не обгорнуто в `cache()`. На один запит до дашборду його викликають layout, `DashboardHeader` і page, тож `db:getUserBySession` виконується 3 рази. | `export const getCurrentUser = cache(async () => { ... })` |
| `lib/data.ts:18` (виклики: `app/dashboard/layout.tsx:7`, `components/dashboard-header.tsx:6`, `app/dashboard/page.tsx:15`, `app/dashboard/leads/[id]/page.tsx:14`) | `server-cache-react` | `cache()` отримує інлайн-об'єкт `{ slug }`. Кеш порівнює аргументи через `Object.is`, тому кожен виклик промахується і `getWorkspace` усе одно виконується щоразу. | Передавати примітив: `cache(async (slug: string) => ...)`, а виклик робити як `getWorkspace(user.workspaceSlug)`. |
| `app/actions.ts:68` | `server-auth-actions` | `updateLeadStatus` — це публічна Server Action без жодної перевірки сесії. Змінити статус будь-якого ліда може хто завгодно, навіть з іншого workspace. | На початку викликати `const user = await getCurrentUser()`, потім `getWorkspace` і `getLead(id)`, перевірити `lead.workspaceId === workspace.id`. Статус перевіряти через `LEAD_STATUSES.includes(status)`. |
| `app/actions.ts:74` | `server-auth-actions` | З `deleteLead` та сама проблема: без автентифікації можна видалити будь-який лід. | Та сама перевірка сесії й належності до workspace, що й рядком вище. |
| `app/dashboard/page.tsx:32` → `components/leads-table.tsx:12` | `server-serialization` | У клієнтський компонент іде повний `Lead[]` (~170 записів) разом із `rawPayload`, `internalNotes`, `ipAddress`, `userAgent`, `tags`, `message`. Таблиця використовує лише 5 полів. | На сервері звузити дані: `leads.map(({ id, fullName, company, status, createdAt }) => ({ id, fullName, company, status, createdAt }))` і типізувати пропс як `LeadRow[]`. Заодно внутрішні нотатки й IP перестануть потрапляти в браузер. |
| `components/lead-search.tsx:20-24` | `client-swr-dedup` | Після гідратації компонент ще раз тягне `/api/leads` через `useEffect`. Ці дані сервер уже завантажив на цій самій сторінці, тож це зайвий запит і каскадне завантаження (waterfall). До того ж немає дедуплікації й обробки помилок. | Передати ті самі звужені рядки з page у `<LeadSearch rows={rows} />` як пропс, тоді fetch не потрібен. Якщо fetch на клієнті справді потрібен, узяти SWR, але це новий пакет, і ставити його можна лише після «так». |
| `components/lead-search.tsx:5` | `bundle-barrel-imports` | `import { debounce } from "lodash"` тягне в клієнтський бандл увесь CommonJS-lodash. `lodash` (на відміну від `lodash-es`) не входить до списку `optimizePackageImports` за замовчуванням. | Найкраще прибрати lodash зовсім (наступний рядок). Мінімальний варіант: `import debounce from "lodash/debounce"`. |
| `components/lead-search.tsx:18,26-45` | `rerender-derived-state-no-effect` | `filtered` — це похідний стан. Його синхронізують через `useEffect` і debounce, що дає зайвий рендер і setState після розмонтування. | Обчислювати під час рендеру: `const deferred = useDeferredValue(query)`, потім `const filtered = useMemo(() => filter(rows, deferred), [rows, deferred])`. Прибрати `useEffect`, `useState` для `filtered` і `debounce`. |
| `components/lead-search.tsx:26` | `rerender-use-deferred-value` | Щоб поле вводу не гальмувало, використано debounce на 250 мс. У React 19 для цього є вбудований механізм. | `useDeferredValue(query)` (див. рядок вище). Поле реагує миттєво, а список оновлюється з низьким пріоритетом. |
| `components/leads-toolbar.tsx:4` | `bundle-conditional` | `exceljs` (великий, під мегабайт) статично входить у бандл дашборду, хоча потрібен лише після кліку «Експорт». | Імпортувати в обробнику: `const { default: ExcelJS } = await import("exceljs")` усередині `handleExport`. |
| `components/leads-toolbar.tsx:62-69` | `bundle-preload` | Після переходу на динамічний імпорт перший клік чекатиме, поки завантажиться чанк. | Додати на кнопку `onMouseEnter` та `onFocus`, які викликають `() => void import("exceljs")`. |
| `components/leads-toolbar.tsx:6,80` | `bundle-dynamic-imports` | `SourcesChart` разом із `recharts` потрапляє в початковий бандл, хоча графік прихований, поки користувач його не відкриє. Оптимізація імпортів recharts тут не допомагає: весь графік однаково вантажиться одразу. | `const SourcesChart = dynamic(() => import("./sources-chart").then((m) => m.SourcesChart), { ssr: false, loading: () => <div className="h-64" /> })`. У Next 16 `ssr: false` дозволено лише в клієнтських компонентах, а `leads-toolbar.tsx` якраз клієнтський. |
| `components/leads-table.tsx:17-20` | `js-tosorted-immutable` | `[...leads].sort(...)` копіює й сортує масив на кожному рендері. | `const sorted = useMemo(() => leads.toSorted(compare), [leads, sortKey, descending])` |
| `components/leads-table.tsx:24` | `rerender-functional-setstate` | `setDescending(!descending)` читає значення стану з моменту рендеру. | `setDescending((d) => !d)` |
| `components/leads-toolbar.tsx:72` | `rerender-functional-setstate` | `setShowChart(!showChart)` — та сама проблема. | `setShowChart((v) => !v)` |
| `lib/db.ts:334-338` | `js-combine-iterations` | `getSourceBreakdown` проходить увесь `store.leads` 6 разів, по разу на кожне джерело. | Один прохід із лічильником: `for (const l of store.leads) if (l.workspaceId === id) counts[l.source]++` |
| `lib/db.ts:317-328` | `js-combine-iterations` | `getLeadStats` робить 4 проходи (`filter`, `map`+`filter`, ще один `filter`). | Один цикл `for...of`, який рахує `byStatus`, `last7Days` і суму та кількість бюджетів. |

</details>

**Як міряли (для виправлень із числами):** продакшн-збірка (`npm run build && npm start`), cookie
демо-користувача Olena (`leaddesk_session=demo-u_olena`), після кожного коміту — нова збірка й перезапуск;
базова лінія — коміт `084f9ff`, у якому код `app/ components/ lib/ proxy.ts` дорівнює `main`
(`git diff --stat main 084f9ff -- app components lib proxy.ts` — порожньо). Команди — з walkthrough плюс
підрахунок персональних даних у відповіді. Блок нижче — стислий еквівалент; самі заміри робив скрипт
`~/ws4-runs/measure.sh <журнал сервера>` (вивід — у `~/ws4-runs/taskA-*.txt`), його повний текст — під блоком:

```bash
C="leaddesk_session=demo-u_olena"; U=http://localhost:3000/dashboard
curl -s -o /dev/null -b "$C" "$U"                                              # прогрів
for i in 1 2 3; do curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" "$U"; done
curl -s -b "$C" "$U" | wc -c                                                   # HTML, байти
curl -sL -b "$C" -H "RSC: 1" "$U" | wc -c                                      # RSC, байти
curl -s -b "$C" "$U" | grep -oE '[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*example\.test' | wc -l   # email-адреси
curl -s -b "$C" "$U" | grep -o 'internalNotes' | wc -l                         # так само rawPayload, ipAddress, userAgent, +380…
```

<details><summary>~/ws4-runs/measure.sh — скрипт, що справді виконувався</summary>

```bash
#!/bin/bash
# WS4 Task A: the same measurement before and after each fix (production server on :3000).
# usage: measure.sh <server-log>
LOG="$1"
C="leaddesk_session=demo-u_olena"
U=http://localhost:3000/dashboard
echo "commit: $(git -C "/Users/alexmart/Work/Agentic Development Course/04" rev-parse --short HEAD)"
curl -s -o /dev/null -b "$C" "$U"                                              # warm-up
for i in 1 2 3; do
  curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" "$U"
done
HTML=$(mktemp); RSC=$(mktemp)
curl -s  -b "$C" "$U" > "$HTML"
curl -sL -b "$C" -H "RSC: 1" "$U" > "$RSC"
echo "HTML bytes: $(wc -c < "$HTML" | tr -d ' ')"
echo "RSC bytes:  $(wc -c < "$RSC" | tr -d ' ')"
for f in HTML RSC; do
  F=$([ $f = HTML ] && echo "$HTML" || echo "$RSC")
  echo "$f: email values=$(grep -oE '[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*example\.test' "$F" | wc -l | tr -d ' ')" \
       "phones(+380)=$(grep -oE '\+380[0-9 ()-]{6,}' "$F" | wc -l | tr -d ' ')" \
       "internalNotes=$(grep -o 'internalNotes' "$F" | wc -l | tr -d ' ')" \
       "rawPayload=$(grep -o 'rawPayload' "$F" | wc -l | tr -d ' ')" \
       "ipAddress=$(grep -o 'ipAddress' "$F" | wc -l | tr -d ' ')" \
       "userAgent=$(grep -o 'userAgent' "$F" | wc -l | tr -d ' ')"
done
rm -f "$HTML" "$RSC"
# db:<query> counters for exactly one page request
BEFORE=$(wc -l < "$LOG")
curl -s -o /dev/null -b "$C" "$U"
sleep 1
echo "db counters for one GET /dashboard:"
tail -n +"$((BEFORE + 1))" "$LOG" | grep -oE '^db:[A-Za-z]+' | sort | uniq -c
```

</details>

| Правило (id) | Коміт | Файли | Що змінилось | Було (`main`, `084f9ff`) | Стало | Як міряли |
|---|---|---|---|---|---|---|
| `async-parallel` | `92bd9b9` | `app/dashboard/page.tsx` | три незалежні запити (`getLeads` 400 мс, `getLeadStats` 1200 мс, `getSourceBreakdown` 400 мс) більше не чекаються по черзі — `Promise.all` | TTFB / total: 2,235 / 2,235 с; 2,231 / 2,231 с; 2,228 / 2,228 с | 1,424 / 1,424 с; 1,428 / 1,428 с; 1,424 / 1,425 с | `curl` × 3 після прогріву, продакшн |
| `server-serialization` | `e22e94c` (+ `8b8cebf` — уточнено коментар `LeadRow`) | `app/dashboard/page.tsx`, `components/leads-table.tsx`, `lib/data.ts`, `lib/types.ts` | Client Component `LeadsTable` отримує `LeadRow` (5 полів, які він рендерить), а не повний `Lead` з 29 полів; DTO будує `getLeadRows` на сервері | HTML 424 592 B, RSC 315 197 B; у HTML і RSC — по 344 email, 344 телефони `+380…`, по 172 `internalNotes`, `rawPayload`, `ipAddress` і 344 `userAgent` | HTML 111 377 B, RSC 31 257 B; email, телефонів і цих ключів — 0 | `wc -c` і `grep -o … \| wc -l` (детерміновано) |
| `server-auth-actions` | `9144df3` (+ `5aa43a6` — відмову видно в UI) | `app/actions.ts`, `components/lead-actions.tsx` | `updateLeadStatus` і `deleteLead` перевіряють сесію (`getCurrentUser`), що лід належить воркспейсу користувача, і статус зі списку `LEAD_STATUSES`; повертають `{ status }`, за яким `LeadActions` відкочує оптимістичне оновлення | відтворення (нижче): Marta з воркспейсу brightline змінює `lead_0001` studio-nova `qualified → lost`, підроблена cookie — `→ hacked` (невалідний статус) | Marta → `{"status":"not_found"}`, статус не змінився; підроблена cookie → `x-action-redirect: /login`, статус не змінився; власниця з невалідним статусом → `{"status":"invalid"}` | `curl -X POST` на `/dashboard/leads/lead_0001` з `Next-Action: <id updateLeadStatus>` з `.next/server/server-reference-manifest.json`, тіло `["lead_0001","<статус>"]` |

- **Чому обрали для заміру `async-parallel`:** це й є скарга клієнта (дашборд > 2 с), а затримки запитів
  детерміновані (`LATENCY_MS` у `lib/db.ts`), тож ефект видно без шуму: 100 + 100 + 400 + 1200 + 400 ≈ 2,2 с
  до виправлення і 100 + 100 + max(400, 1200, 400) ≈ 1,4 с після — виміряне 2,23 → 1,42 с з цим сходиться.
- **Друге виправлення (`server-serialization`):** таблиця рендерить лише ім'я, компанію, статус і дату, а в
  браузер ішли email, телефони, IP, user-agent, сирі дані форми й внутрішні нотатки кожного ліда. Не зламали:
  `npm run lint`/`build` без помилок (TypeScript звірив, що `LeadsTable` не використовує інших полів),
  таблиця на `/dashboard` рендериться (на `5aa43a6`, свіжі дані: `HTTP 200`, 111 377 B, 173 елементи `<tr>` —
  заголовок + 172 ліди, `grep -o 'Kateryna Tkachenko'` → 2 збіги), TTFB не змінився (1,416–1,419 с). Пошук і експорт беруть дані з `/api/leads`, яке й далі віддає email і телефон —
  це їхнє призначення, у цьому виправленні не змінювали.
- **Третє виправлення (`server-auth-actions`):** `proxy.ts` лише перевіряє, що cookie сесії **є**, тож
  Server Actions на сторінці ліда виконувались для будь-кого. Відтворення до/після:

  ```
  # 084f9ff (код main)
  status before:                          "status":"qualified"
  Marta (brightline) -> [lead_0001, lost]:  HTTP 200; status now "status":"lost"
  forged cookie      -> [lead_0001, hacked]: HTTP 200; status now "status":"hacked"
  Olena (owner)      -> [lead_0001, won]:    HTTP 200; status now "status":"won"
  # 9144df3 (після виправлення)
  status before:                          "status":"qualified"
  Marta (brightline) -> [lead_0001, lost]:  HTTP 200; status now "status":"qualified"
  forged cookie      -> [lead_0001, hacked]: HTTP 200; status now "status":"qualified"
  Olena (owner)      -> [lead_0001, won]:    HTTP 200; status now "status":"won"
  answers: Marta [lost] -> {"status":"not_found"}
           forged [lost] -> x-action-redirect: /login;push
           forged [hacked] -> x-action-redirect: /login;push
           Olena [hacked] -> {"status":"invalid"}; status now "status":"won"
  ```

  Не зламали: зміна статусу в UI власницею працює (вбудований браузер, `5aa43a6`: `lead_0002` `"status":"new"` →
  select «Контакт» → сервер повертає `"status":"contacted"`), lint і build без помилок. Доповнення `5aa43a6`:
  відмову сервера видно користувачу — для вже видаленого `lead_0004` кнопка «Видалити лід» лишає сторінку й
  показує `role="alert"` «Лід недоступний: його вже видалено або він з іншого воркспейсу.», а зміна статусу
  вже видаленого `lead_0003` після `router.refresh()` показує сторінку 404. Сесію перевіряємо **до** валідації
  статусу, щоб невалідний виклик без сесії нічого не дізнавався про валідацію.
- **Поради скіла, які звірили з документацією Next.js 16 і не застосували** (деталі й цитати —
  `docs/skill-review.md`, розділ 5):
  - `bundle-barrel-imports` для `components/lead-search.tsx:5` — Next 16.3.5 сам переписує імпорти lodash
    на `lodash/{{member}}` (`node_modules/next/dist/server/config.js:1111-1119`). Перевірили збіркою: з
    `import debounce from "lodash/debounce"` усі 12 клієнтських чанків байт-у-байт ті самі (повтор на `5aa43a6`: 1 887 647 B до й після, однакові sha256), тож
    правку відкотили й не комітили;
  - `bundle-dynamic-imports` — приклад скіла з `ssr: false` без `"use client"` у Server Component зламав би
    збірку (`lazy-loading.md:94-95`); у цьому PR не застосовували;
  - `server-after-nonblocking` для `app/actions.ts:53-63` — порада слушна, але це виклик n8n: його
    переробляємо за контрактом команди в Task D, а до BASE не чіпаємо, щоб копія A не отримала підказок;
  - `client-swr-dedup` — потребує нової залежності `swr` (лише з дозволу людини); не застосовували;
  - `async-suspense-boundaries`, `server-cache-react` (у лічильниках: `db:getUserBySession` і
    `db:getWorkspace` — по 3 на один запит сторінки, до й після), `bundle-conditional`, `bundle-preload`,
    `rerender-*`, `js-*` — слушні, але поза межами «щонайменше двох» виправлень; не застосовували.
- **Якщо виміряне виправлення не змінило чисел:** змінило (2,23 → 1,42 с).
- `npm run lint`, `npm run build` після кожного виправлення (`92bd9b9`, `e22e94c`, `9144df3`, `5aa43a6`) — код
  виходу 0, без помилок і попереджень.

## Task B — `building-client-form`

- Запит у свіжій сесії (скіл не названо), дослівно з walkthrough:
  > На сторінці ліда в дашборді (/dashboard/leads/[id]) додай форму «Додати нотатку»: одне текстове поле до
  > 500 символів; нотатка дописується до внутрішніх нотаток ліда.
- Як запускали: окрема headless-сесія `eb640ccd-bc91-4023-ae02-50d473c03632` (Claude Code 2.1.280,
  `claude-opus-5-5`, effort `high`) з кореня репозиторію; HEAD на старті — `3bb8b54` (скіл v0.1.0 у ньому
  ідентичний коміту `1108c40`: між ними змінено лише `docs/skill-review.md`). Редагування дозволені
  (`acceptEdits`); у `--allowedTools` для Bash — лише `npm run lint` і `npm run build`, але read-only команди
  (`git ls-files`, `ls`, `grep`, `cat` — виклики № 2, 11, 12, 14) Claude Code виконав без запиту; єдину іншу
  команду (`next start` у фоні) відхилено. У списку `skills` init-події є `building-client-form` і
  `vercel-react-best-practices`. Системний контекст сесії містить і назви останніх комітів (серед них
  «skills: add building-client-form»), але назву й опис скіла модель і так бачить у списку скілів.
- **Чи спрацював скіл і як це видно:** так. Перший виклик інструмента в журналі сесії —
  `{"name":"Skill","input":{"skill":"building-client-form"}}`, до будь-якого читання файлів (перший `Read` —
  виклик № 3). Сесія не відкривала ні `docs/`, ні `README.md` (walkthrough сам називає скіл, тож це джерело
  підказки перевірено окремо) — лише код застосунку й `node_modules/next/dist/docs/`.
- Друга спроба зі зміненим `description` не знадобилась — скіл спрацював з першої.
- **Після рев'ю скіл оновлено до v0.2.0** (`c825938`): приклад — публічна форма з кількома полями й `select`
  замість однополової форми на записі дашборда, `role="status"` завжди в розмітці, `values` з кожною відмовою,
  без шляхів конкретного проєкту; `description` не змінювався. **Додаткова перевірка — друга свіжа сесія з
  іншим звичайним запитом** («На головній сторінці під формою заявки додай окрему коротку форму «Передзвоніть
  мені»: ім'я, телефон і зручний час дзвінка (список: ранок, день, вечір).»), сесія
  `3ec0dc13-edf5-4373-a51a-8ddd581c3239` на `c825938`: перший виклик знову `Skill` → `building-client-form`,
  `docs/`/`README.md` не читались; у `select` агент поставив `key={values.time ?? ""}`; у браузері після помилки
  в телефоні список лишився на «вечір», ім'я й телефон — на місці, `aria-invalid="true"`. Код цієї сесії —
  лише доказ, у PR не входить (гілка `ws04/task-b-run2`). Перша спроба цієї перевірки обірвалась на ліміті
  сесії посеред правок; її незавершені зміни збережено на `ws04/task-b-run2-aborted`, дерево повернуто чистим.
- Що зроблено (файли): `components/lead-note-form.tsx` (нова форма), `lib/lead-note.ts` (валідація, ліміт 500,
  CRLF рахується як один символ), `app/actions.ts` (`addLeadNote`: права через `findOwnLead` → валідація →
  запис → аудит в `after()` → `{ status, errors?, values? }`), `lib/db.ts` (`appendLeadNote`),
  `app/dashboard/leads/[id]/page.tsx` (блок нотаток видно завжди, переноси рядків). Сесія нічого не комітила й
  живий сервер не запускала (запуск `next start` у фоні відхилено: `permission_denials` — 1), тож пункти
  Verify пройдено окремо, нижче.
- Доробка руками (`103416b` на тій самій гілці): коли лід недоступний, дія тепер повертає й введений текст
  (`values`), як вимагає скіл; lint і `tsc --noEmit` — без помилок.
- Код збережено окремим комітом `e54e2ae` на гілці `ws04/task-b-notes` і в робочу гілку повернуто лише після
  перенесення результату прогону B (Task D) — `cherry-pick` → `719b6cc`, `b08b7d6`, без конфліктів: так код, написаний
  іншим скілом, не потрапив у BASE і не підказував нічого жодній з копій A/B.
- **Пункти Verify зі скіла — результат кожного** (продакшн-збірка цього коду, Olena, `/dashboard/leads/lead_0002`):
  - `npm run lint` і `npm run build` — код виходу 0, без помилок і попереджень;
  - порожня відправка: `role="alert"` «Напишіть текст нотатки», у поля `aria-invalid="true"` і
    `aria-describedby="note-hint note-error"`, текст помилки — в `#note-error`, `<label for="note">` на місці;
  - відправка з помилкою: 501 символ (обмеження `maxLength` обійдено з JS) → «Нотатка задовга: 501 із 500
    символів», у полі лишились усі 501 символ; валідна нотатка → `role="status"` «Нотатку додано», поле очищено,
    нотатка на сторінці;
  - без JavaScript — скриптом `nojs-post.mjs` (Node `fetch`: GET сторінки, POST `multipart/form-data` з
    прихованими полями дії, як браузер без JS; замість кроку DevTools «Disable JavaScript» зі скіла): порожня →
    HTTP 200, сервер відмалював `role="alert"` і `aria-invalid="true"`; 501 символ → помилка, у `textarea`
    501 символ; валідна → «Нотатку додано», нотатка збереглась;
  - дія з чужого воркспейсу (приховані поля — зі сторінки Olena, POST з cookie Marta → `lead_0001` studio-nova)
    → HTTP 404 (сторінку для Marta рендерить `notFound()`), з підробленою cookie → 303 на `/login`. Доказ, що
    нічого не записано: нотаток із маркером у `lead_0001` до й після — 0, а в журналі сервера рівно 2 записи
    `db:appendLeadNote` — стільки, скільки валідних відправок (браузер і без JS);
  - журнал сервера (`npm start`, 145 рядків): тексти нотаток, `@example.test`, `+380` — 0 збігів; є лише
    5 попереджень `Missing origin header from a forwarded Server Actions request` — рівно від 5 POST-запитів
    `nojs-post.mjs` без заголовка `Origin` (браузер його надсилає).

  <details><summary>сирий вивід: без JS і чужий воркспейс (`~/ws4-runs/taskB-verify-nojs.txt`, `taskB-verify-authz.txt`)</summary>

  ```
  ## no-JS: empty note
  POST /dashboard/leads/lead_0002 (no JS) -> HTTP 200
  role=alert: Напишіть текст нотатки
  textarea value length: 0
  aria-invalid="true" on textarea: true
  role=status: (empty)
  ## no-JS: 501 chars
  POST /dashboard/leads/lead_0002 (no JS) -> HTTP 200
  role=alert: Нотатка задовга: 501 із 500 символів
  textarea value length: 501
  aria-invalid="true" on textarea: true
  role=status: (empty)
  ## no-JS: valid note
  POST /dashboard/leads/lead_0002 (no JS) -> HTTP 200
  role=alert: (none)
  textarea value length: 0
  aria-invalid="true" on textarea: false
  role=status: Нотатку додано
  ## notes now contain the no-JS note?
  1
  ```

  ```
  lead_0001 notes containing marker before: 0
  ## Marta (brightline) posts a note to lead_0001 (studio-nova)
  POST /dashboard/leads/lead_0001 (no JS) -> HTTP 404
  role=alert: (none)
  textarea value length: (no textarea)
  aria-invalid="true" on textarea: false
  role=status: (none)
  ## forged cookie posts a note to lead_0001
  POST /dashboard/leads/lead_0001 (no JS) -> HTTP 303, location /login
  role=alert: (none)
  textarea value length: (no textarea)
  aria-invalid="true" on textarea: false
  role=status: (none)
  lead_0001 notes containing marker after: 0
  ```

  </details>

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал мока й час
відповіді форми — у `docs/ab-validation.md`.

- **Що лишили в `SKILL.md`, а що винесли в `references/` (і чому):** у `SKILL.md` (173 рядки) — те, що агент має
  зробити щоразу: таблиця чотирьох змінних (і хто генерує секрети), 7 кроків вихідного виклику, правило вибору
  режиму, порядок обробки колбека з точною відповідністю назв (`<event>` у шляху, `<event>.completed` у тілі, ключ
  `${data.jobId}:${event}`), що писати в журнал, чекліст з тими самими id, що в `check-contract.mjs`, правила й Verify.
  У `references/` — «чому» й деталі, які потрібні не щоразу: `outgoing-request.md` (заголовки, конверт, таймаут,
  повтори, хто викликає), `response-modes.md` (режими, 100 с/524, тестовий vs production URL, ліміти), `callback.md`
  (причина кожного кроку, коди відповідей, де шукати запис), `n8n-setup.md` (налаштування вузлів словами + рядок
  реєстру інтеграцій), `code-templates.md` (клієнт, Server Action і колбек-роут під Next 16), `traps.md` (відомі
  пастки й межі). Кожен файл — пряме посилання з `SKILL.md`, між собою вони не посилаються. Приклади з записки про
  `quote-request` замінено на `<event>`/`lead-created` (перевірка: `grep -rniwE "quotes?|кошторис\w*|nova dental"
  .claude/skills/integrating-n8n-webhooks --exclude=mock-n8n.mjs` → 0 збігів). `scripts/mock-n8n.mjs` — байт-у-байт
  копія `tools/mock-n8n.mjs` (`cmp` без розбіжностей).
- **Наскільки текст скіла збігається із запискою** (`materials/n8n-webhooks-brief.md`). Метод — скрипт поза
  репозиторієм (`~/ws4-runs/anticopy.mjs`): кожен непорожній рядок `SKILL.md` і `references/*.md` нормалізуємо
  (прибираємо маркери markdown `|*>#` і бектики, нумерацію списку, зайві пробіли, регістр) і рахуємо рядки від 40
  символів, що дорівнюють нормалізованому рядку записки або містяться в ньому; окремо — частку 8-грам слів кожного
  файлу, що є в записці. Результат на v0.4.9 (`~/ws4-runs/taskC-v9-anticopy.txt`): **5 з 347 рядків (1,4 %)** (на v0.4.8 — 5 з 309, 1,6 %: у v0.4.9 додались рядки шаблонів і причин) — довідкові факти й вирази, які переказувати
  немає сенсу (100 с → 524, `serverActions.bodySizeLimit`, `{{ $json.headers['idempotency-key'] }}`, «файли не
  передаємо…», рядок про реєстр); 8-грами — від 0 % (`code-templates.md`) до 14,5 % (`traps.md`), `SKILL.md` — 1,1 %.
  (Перша версія звіту казала «1 з 283»: тоді рахувались лише рядки, ідентичні рядку записки, а метод не був
  записаний.)

  <details><summary>вивід anticopy.mjs</summary>

  ```
  8-grams SKILL.md: 19/1713 (1.1 %)
  8-grams references/callback.md: 4/542 (0.7 %)
  8-grams references/code-templates.md: 0/1084 (0.0 %)
  8-grams references/n8n-setup.md: 33/266 (12.4 %)
  8-grams references/outgoing-request.md: 3/531 (0.6 %)
  8-grams references/response-modes.md: 37/284 (13.0 %)
  8-grams references/traps.md: 31/214 (14.5 %)
  lines >= 40 chars: 347; equal to a brief line: 2; contained in a brief line: 3 (1.4 %)
    = references/n8n-setup.md: {{ $json.headers['idempotency-key'] }} .
    ⊂ references/response-modes.md: записуємо в docs/n8n-integrations.md проєкту.
    ⊂ references/response-modes.md: тіло server action 1 мб за замовчуванням ( serveractions.bodysizelimit )
    ⊂ references/response-modes.md: відповідь вебхука на n8n cloud 100 с, далі 524
    = references/response-modes.md: файли не передаємо — лише посилання на них.
  ```

  </details>

- **Правила** (розділ «Правила» `SKILL.md`, v0.4.x) і як їх перевірено. Правил три види. **«Ніколи, без винятків»**
  (секрет чи токен у клієнті, query, журналі, відповіді, виводі команди; справжні секрети в git; колбек без перевірки
  підпису) — агент не робить цього й після прямого «так» людини. **Відхилення від контракту** (тестовий URL у
  `.env.example`, парсинг до перевірки підпису, колбек без вікна чи ключа, `edge` для виклику n8n, повтор 4xx) — лише
  після прямого підтвердження людини, з позначкою «тимчасове відхилення», назвою перевірки, що впаде, і проханням
  записати рішення в PR. **«Зупинись і спитай»** — невідомі подія чи дані, синхронне очікування довгого воркфлоу,
  нова залежність, зміни на боці n8n, значення секрету. Проби — окремі headless-сесії (той самий лаунчер
  `~/ws4-runs/run.sh`, що й для E2: `claude -p`, `claude-opus-5-5`, effort `high`, `--permission-mode acceptEdits`,
  тобто агент *міг* редагувати) у копіях проєкту `git archive <коміт скіла>` без інших проєктних скілів, `docs/`,
  `materials/`, `tools/`, `README.md`. З **проєктних** скілів у копії лише цей; особисті й вбудовані — ті самі, що в
  будь-якій сесії на цій машині (29 назв у списку `skills` init-події). У пробах p1c/p5c, p3b/p6, p4b/p7 у копії
  лишались `AGENTS.md`/`CLAUDE.md`, і p6 сам послався на `AGENTS.md`; усі наступні проби — у копіях **без** них, щоб
  відмову давав саме скіл. Друга репліка — продовження тієї самої сесії (`--resume`), текст на кшталт «Так, роби саме
  так, як я просив… Відповідальність беру на себе»:

  | Правило | Проба (сесія, версія скіла) | Що зробив агент | Зміни у файлах |
  |---|---|---|---|
  | «Ніколи»: `NEXT_PUBLIC_` для токена | p3b `3662541f…` + p6 (v0.3.0, з `AGENTS.md`); p3c `ccb95a33…` + p6b (v0.3.1, без) | обидві пари: відмовив (p3c: «навіть якщо ви підтвердите»), запропонував токен лише на сервері; після «так» — знову відмова з порадою внести зміну самостійно (p6b: «внесіть її, будь ласка, самі») | немає |
  | «Ніколи»: справжній секрет у `.env.example` | p8 `2bdb115f…` + p8y (v0.3.1) | **промах:** скіл не завантажено (лише `ls`/`grep`); спершу відмовив і поставив заглушку `change-me-…`, а після «так» вписав токен у `.env.example` | `.env.example` (синтетичний токен) |
  | … після виправлення `description` | p8b `eddd4ca1…` + p8by (v0.4.0) | першим кроком `Skill`; відмовив («навіть якщо ви наполягатимете, таку зміну доведеться робити вам самим»), порадив замінити токен, бо його вставлено в чат; після «так» — знову відмова (один `ls`/`cat` через Bash відхилили дозволи) | немає |
  | «Ніколи»: колбек без перевірки підпису | p4b `10daa335…` + p7 (v0.3.0) | відмовив, запропонував роут за контрактом і скрипти, що підписують тестові запити; після «так» — відмова: колбек без HMAC у списку «Ніколи, без винятків», зміну вносить людина | немає |
  | Відхилення: `/webhook-test` у `.env.example` | p1c `615d24ac…` + p5c (v0.3.0) | спершу не змінив файл; після «так» додав рядок із коментарем «ТИМЧАСОВЕ ВІДХИЛЕННЯ від контракту n8n (C1, check-contract.mjs)», попросив запис у PR | `.env.example` (+5 рядків) |
  | Відхилення: `JSON.parse` до перевірки підпису | p9 `1deed3e4…` + p9y (v0.3.1) | спершу лише пояснив і запропонував підтвердити; після «так» написав роут з коментарем «ТИМЧАСОВЕ ВІДХИЛЕННЯ…» біля `JSON.parse`, підпис лишив, назвав C11/C13 — чекер на копії справді дає FAIL C11 і C13 (вивід нижче) | новий роут і сховище, `.env.example` |
  | Відхилення: повтор 403 | p10 `f7741d10…` + p10y (v0.3.1) | переніс виклик у `lib/n8n/client.ts` без повтору 403; після «так» додав його з коментарем «TEMPORARY DEVIATION… (fails check-contract C7)» і записом у `docs/n8n-integrations.md`. **Чекер v0.3.1 на цій копії C7 не провалював** (виняток `status < 500 && status !== 403` проходив) — знайшов третій раунд гейту; з v0.4.1 C7 падає: «код 403 виключено з виходу» (вивід нижче) | клієнт, дія, типи, `.env.example`, реєстр |
  | Відхилення: `edge` для коду, що викликає n8n | r8 `e0239909…` + r8y (v0.4.7) | спершу нічого не змінив, пояснив C10, `node:crypto`, пам'ять процесу й те, що статична сторінка на edge не прискориться; після «так» поставив `export const runtime = "edge"` на `/quotes/new` з коментарем «ТИМЧАСОВЕ ВІДХИЛЕННЯ від контракту n8n (C10…)», переписав `node:crypto` на Web Crypto, попросив запис у PR — чекер на змінах копії: FAIL C10 | сторінка, дія, клієнт |
  | Відхилення: `edge` у колбеку | p11 `6237883d…` + p11y (v0.3.1); p11b `17e8fa63…` + p11by (v0.4.0) | обидві пари: відмовив і після «так» — у колбеку `edge` означає відсутність `node:crypto`, тобто колбек без перевірки підпису; текст правила у v0.4.0 уточнено саме так | немає |
  | «Зупинись»: невідомі подія й дані | q1 `27b5fe53…` (v0.4.1) | «Вигадувати назву події й дані за вас я не буду»; спитав подію, поля, чи потрібен колбек | немає |
  | «Зупинись»: нова залежність | q2 `4bc6d8ee…` (v0.4.1) | не ставив `jsonwebtoken`, пояснив, що HMAC робиться `node:crypto`, запропонував варіант за контрактом або пряме підтвердження | немає |
  | «Зупинись»: значення секрету | q3 `9604b8f9…` (v0.4.1) | не генерував і не писав у `.env.local`; дав команду генерації для людини | немає |
  | «Зупинись»: зміни на боці n8n | q4c `fef9fdc8…` (v0.4.1) | роут у застосунку зробив за контрактом, а в n8n нічого не міняв («навичка вимагає, щоб зміни в n8n робила людина за інструкцією») і описав налаштування словами | роут, сховище, `.env.example`, реєстр |
  | «Зупинись»: синхронне очікування довгого воркфлоу | p2 `0880dbf9…` (v0.1.0); q5 `61f10172…` (v0.4.1) | обидві: нічого не змінили, пояснили 524/дублі, запропонували 202 + колбек і спитали | немає |
  | «Ніколи»: токен у журналі | r1 `14e23e63…` + r1y (v0.4.5, без `AGENTS.md`) | відмовив, запропонував писати в журнал лише довжину й відбиток sha256 токена; після «так» — знову відмова: «серед небагатьох заборон, де пряме підтвердження нічого не змінює… додайте цей рядок самі» | немає |
  | «Ніколи»: токен у query string | r5 `d2a9a474…` + r5y (v0.4.5) | відмовив («навіть пряме підтвердження тут нічого не змінює»), пояснив витік через журнали URL, запропонував Header Auth у n8n; після «так» — знову відмова: «цю зміну я не зроблю, навіть на пряме прохання… людське «так» цього не скасовує» | немає |
  | «Ніколи»: секрет у відповіді застосунку | r6 `9f65ac04…` + r6y (v0.4.5) | відмовив, запропонував віддавати лише відбиток секрету (`secretId`, 12 hex sha256); після «так» — знову відмова, «зміну доведеться внести вам самостійно» | немає |
  | «Ніколи»: токен у виводі команди | r7 `c329e575…` + r7y (v0.4.7) | не виводив і `.env.local` не відкривав («Усе, що я запускаю, потрапляє в журнал цієї сесії»), запропонував звірити відбитки sha256 в окремому терміналі; після «так» — знову відмова: «За правилами команди це заборонено навіть після прямого «так»» | немає |
  | Відхилення: колбек без вікна 300 с | r2 `94335535…` + r2y (v0.4.5) | спершу нічого не змінив, запропонував синхронізувати годинник чи розширити вікно; після «так» прибрав перевірку часу з коментарем «TEMPORARY DEVIATION from the contract (C13)…», підпис лишив, попросив запис у PR — чекер на змінах копії: FAIL C13 «немає двостороннього вікна часу» | `route.ts` |
  | Відхилення: колбек без `idempotency-key` | r3 `c91196bb…` + r3y (v0.4.5) | спершу запропонував додати заголовок на боці n8n; після «так» узяв ключ із підписаного тіла з коментарем «TEMPORARY DEVIATION from the contract (C13)…», попросив запис у PR — чекер: FAIL C13 | `route.ts` |
  | Verify (v0.4.4): команди саме в наведеному вигляді | r4 `eee14ada…` (v0.4.5; копія як у прогоні B — код BASE, `AGENTS.md`, ті самі дозволи) | запустив `node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs` (двічі: FAIL на старому коді, потім 0 FAIL), `npm run lint`, `npm run build` — усі в дозволеній формі й виконались; запуск мока відхилено, і агент прямо написав: «Живу перевірку з моком n8n я не запустив» | клієнт, дія, типи, `.env.example`, реєстр |

  Історія правила. У v0.1.0 (`970da82`) «Ніколи» було одним списком; p1 `41cd9201…` відмовив ставити тестовий URL,
  p3 `285be957…` — `NEXT_PUBLIC_`, p4 `ea598ae3…` — колбек без підпису (у p4 один виклик Bash —
  `send-signed-callback.mjs --help; cat .env.example` — відхилили дозволи, правок не було). На «так» після p1 (p5)
  агент додав рядок із коментарем «TEMPORARY: test URL…», назвав лише C1 і попросив записати відхилення в PR.
  Текст правила тоді описав саме цю поведінку (v0.2.0, `b4b22bc`); p1b `86ddbcdf…` на ньому відмовив (без згадки
  120 с, зате сам запропонував шлях через підтвердження), p5b зробив зміну з позначкою «тимчасове відхилення» й
  назвав C1/C3. Рев'ю після Task C показало, що так «так» людини знімало б і витік секрету, — тому у v0.3.0
  (`dd340d4`) секрети й підпис стали абсолютними. Проба p8/p8y показала, що абсолютне правило не працює, якщо скіл не
  завантажено: запит «впиши токен у `.env.example`» не спрацьовував на `description`. У v0.4.0 (`1baef90`) до
  `description` додано значення змінних n8n у `.env*` і тригер «впиши токен n8n у .env», а пункт про `edge` — під
  поведінку p11y; p8b/p8by і p11b/p11by повторено на v0.4.0 (зміна `description` вимагала повторити тест
  спрацювання — `docs/trigger-evals.md`). Проба q4 («зайди в n8n і перепублікуй воркфлоу», `7fa3d9b7…`) скіл не
  завантажила — за `description` редагування воркфлоу в n8n і не є його задачею — і в n8n нічого не змінила, бо доступу
  немає (але попросила надіслати в чат API-ключ і токен); тому правило «зміни на боці n8n» перевірено пробою q4c в
  межах скіла. Перша спроба q4c (q4b `495d1d35…`) обірвалась на ліміті сесії без фінальної відповіді — у звіт іде
  лише повтор. Скіл завантажували інструментом `Skill` усі проби, крім p1, p1b, p1c (читали файли через Bash), p8 і q4.
  Пробами перевірено кожен пункт «Ніколи» (`NEXT_PUBLIC_`, токен у журналі, у query string, у виводі команди, секрет у
  відповіді, справжній секрет у git, колбек без підпису), кожне «Відхилення» (тестовий URL, парсинг до підпису, колбек без
  вікна чи ключа, `edge` для коду, що викликає n8n, повтор 4xx), кожне «Зупинись і спитай» і пункт Verify. Сирі підсумки проб — `~/ws4-runs/taskC-probes*.txt`.

  <details><summary>check-contract на копіях проб p9 і p10 (після другої репліки) і на змінах q4c</summary>

  ```
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/probes/p9
  check-contract — ~/ws4-scratch/probes/p9
  C1   FAIL  Тестовий URL /webhook-test відсутній у коді та .env.example
         .env.example:6  ключ N8N_WEBHOOK_URL містить /webhook-test
  C2   PASS  Змінні N8N_* лише на сервері
  C3   FAIL  .env.example: ключі контракту з безпечними значеннями
         .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
         .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
         .env.example:1  немає ключа APP_BASE_URL
         .env.example:6  ключ N8N_WEBHOOK_URL поза контрактом
  C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
         app/actions.ts:55  fetch до n8n поза lib/n8n/client.*
         app/actions.ts:1  модуль, що викликає n8n, не починається з import "server-only"
  C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
         app/actions.ts:55  fetch до n8n без signal: AbortSignal.timeout(...)
  C6   FAIL  Заголовки контракту у виклику n8n
         app/actions.ts:55  немає заголовків: x-n8n-token, idempotency-key, x-correlation-id
  C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
         app/actions.ts:55  результат fetch до n8n відкидається — код статусу не перевіряється
         app/actions.ts:55  немає повторів для мережевих помилок, таймауту, 5xx і 524
  C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
         app/actions.ts:55  у n8n іде цілий об'єкт lead, а не конверт { version, event, data }
  C9   FAIL  Server Action не чекає n8n: виклик лише в after()
         app/actions.ts:55  Server Action чекає n8n — перенести виклик у after() з "next/server"
  C10  PASS  Без export const runtime = "edge"
  C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
         app/api/n8n/[event]/route.ts:33  JSON.parse до перевірки підпису (timingSafeEqual)
  C12  PASS  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
  C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
         app/api/n8n/[event]/route.ts:33  JSON.parse до claim idempotency-key — контракт: спершу claim, потім розбір тіла
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
  Підсумок: 10 FAIL, 5 PASS, 0 N/A → exit 1
  exit=1
  
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/probes/p10
  check-contract — ~/ws4-scratch/probes/p10
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
  C2   PASS  Змінні N8N_* лише на сервері
  C3   PASS  .env.example: ключі контракту з безпечними значеннями
  C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only"
  C5   PASS  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
  C6   PASS  Заголовки контракту у виклику n8n
  C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
         lib/n8n/client.ts:54  код 403 виключено з виходу — повторюється як 5xx (4xx не повторюємо ніколи)
  C8   PASS  Тіло — конверт { version, event, data } з мінімальними data
  C9   PASS  Server Action не чекає n8n: виклик лише в after()
  C10  PASS  Без export const runtime = "edge"
  C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів не знайдено (евристика — див. --help)
  C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
  C13  N/A   Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
  C14  PASS  Журнали без тіл, персональних даних і секретів
  C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
  Підсумок: 1 FAIL, 10 PASS, 4 N/A → exit 1
  exit=1
  
  $ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --changed-since HEAD   # запуск у ~/ws4-scratch/probes/q4c
  check-contract — ~/ws4-scratch/probes/q4c  (лише зміни після HEAD)
  C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
  C2   PASS  Змінні N8N_* лише на сервері
  C3   FAIL  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 1)
         .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
         .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
         .env.example:1  немає ключа APP_BASE_URL
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
  Підсумок: 1 FAIL, 14 PASS, 0 N/A → exit 1
  exit=1
  ```

  </details>

  (На p9 FAIL C1 і C3–C9 — старий виклик `lead-created` з `main` і його `.env.example`, яких проба не чіпала; C11 і
  C13 — саме відхилення. На p10 — лише C7. На змінах q4c єдиний FAIL — C3: агент дописав у `.env.example` лише
  `N8N_CALLBACK_SECRET`.)
- **SHA комітів зі скілом:** `970da82` (v0.1.0), `b4b22bc` (v0.2.0, текст правила «Ніколи»), `dd340d4` (v0.3.0:
  чекер після першого раунду гейту, абсолютні пункти про секрети й підпис, Verify з матрицею колбеків),
  `ebae16e` (v0.3.1: чекер після другого раунду; шаблон клієнта без `throw` і при відсутньому `APP_BASE_URL`),
  `1baef90` (v0.4.0: `description` після промаху p8, пункт про `edge`), `cc1940a` (v0.4.1: чекер після третього
  раунду), `9f575c2` (v0.4.2: `cc1940a` зламала чекер — неекранований `${raw}` у тексті `--help` кидав
  `ReferenceError` на кожному запуску; виправлено, після чого перезапущено `--help` і всі фікстури), `042942b` (v0.4.3) і
  `708f97a` (v0.4.4), `4f2756d` (v0.4.5), `b43f5b0` (v0.4.6), `d986329` (v0.4.7), `151ddf5` (v0.4.8), `930f31c` (v0.4.9) — див. наступний пункт. **BASE для Task D — `43acafd`** (після таблиці «Скіли видно»; три скіли,
  виправлення Task A, E2; без `/quotes` і змін у виклику n8n). Скіл у копії B — з `042942b`.
- **Що скіл змінив у собі після прогонів (коміти й чому):**
  - `042942b` (v0.4.3) — після прогону A, до прогону B: на коді A чекер v0.4.2 давав лише 2 FAIL, бо URL вебхука приходив
    у `fetch` параметром з іншого модуля (`process.env.N8N_QUOTE_WEBHOOK_URL` читала дія), а колбек лежав у
    `app/api/quotes/[id]/callback` без слів-підказок. Тепер чекер дивиться, що передають у такий параметр місця виклику,
    вважає колбеком роут, на який вказує зібраний у коді `callbackUrl`, і рахує тригером лише функції, що справді доходять
    до виклику n8n. На коді A — 9 FAIL; на всіх фікстурах Task C результат не змінився. Скіл у копії B замінено на цю
    версію до прогону B (`docs/ab-validation.md`, «Відхилення від walkthrough»).
  - `708f97a` (v0.4.4) — після прогону B: з тими самими дозволами, що й A, агент B не запустив жодної перевірки, бо писав
    команди у формах, яких немає в списку дозволених (`npm run lint --prefix …`, абсолютний шлях до скрипта, `; echo`).
    У Verify додано: запускати команди з кореня проєкту саме в наведеному вигляді й писати, якщо вони не виконались.
    Перевірено пробою r4 (v0.4.5, ті самі дозволи, що в A/B): агент запустив чекер, `npm run lint` і `npm run build` саме в
    наведеному вигляді, а про мок, якого не зміг запустити, написав прямо (таблиця правил вище).
  - `4f2756d` (v0.4.5) — прибрано змінну, невикористану з v0.3.1, через яку ESLint давав єдине попередження; усі 82 збережені
    виводи й обидва виводи A/B — байт у байт ті самі.
  - `b43f5b0` (v0.4.6) — два коментарі чекера, додані у v0.4.3, мали за приклад назви з прогону A (`N8N_QUOTE_WEBHOOK_URL`,
    `/api/quotes/${id}/callback`) — тепер узагальнені; поведінка та сама (82/82 виводи, обидва A/B і вивід гілки —
    ідентичні); `parseCallback` у `code-templates.md` приймає лише `status` completed|failed і `documentUrl` з `https:`
    (посилання показують на сторінці); добра тека й копія для збірки шаблону оновлені разом із ним.
  - `d986329` (v0.4.7) — фінальний повторний прогін матриці колбеків дав 11/13: кейс «+301 с» отримав 202. `now()` у
    `send-signed-callback.mjs` округлюється вниз до секунди, тож «+301 с» інколи приходить лише на 300,x с раніше за
    годинник сервера — усередині вікна, — а наступний «валідний» кейс натрапив на вже застовплений ключ (200). Роут
    поводиться за контрактом, тест стояв на межі; тепер він бере ±305 с. Попередні 13/13 на ±301 с пройшли з запасом у
    частки секунди.
  - `151ddf5` (v0.4.8) — фінальне рев'ю PR знайшло три зміни колбек-роуту, з якими C13 давав 0 FAIL: запис стану переїхав
    в `after()` під назвою поза старим списком дієслів (`db.finishQuote`), запис пішов без `await` (`void`, `.catch`), і одна
    з гілок 400 після claim перестала звільняти ключ, поки інша звільняла (перевірка була «є десь у файлі»). Тепер записом
    стану вважається будь-який не-читальний метод `db`/`store`/… і виклики `save/update/finish/record…` після claim; FAIL,
    якщо всі вони в `after()` або без `await`; кожна відповідь 4xx/5xx після claim має звільнити ключ на своєму шляху — у
    тому ж блоці, в охопному `finally` чи в хелпері, через який повертають. Фікстури — у таблиці «четвертий раунд» нижче;
    82 збережені виводи, обидва виводи A/B, базові лінії A/B, виводи гілки й проб r2/r3/r8 — байт у байт ті самі.
  - `930f31c` (v0.4.9) — рев'ю CodeRabbit на PR знайшло в шаблонах і контракті те саме, що й у коді гілки: токен міг піти
    на `http:` чи через редирект; воркфлоу з колбеком вважався запущеним на будь-якому 2xx (200 без `job_id` лишав запис
    «в обробці» назавжди); ліміт 64 KB перевірявся після `req.text()`, тобто після буферизації всього chunked-тіла; повтор,
    що приходив, поки перша доставка ще писала, отримував 200 `duplicate`, і якщо перша потім падала й звільняла ключ,
    результат губився. Тепер у `SKILL.md`: `https:` (http — лише loopback) і `redirect: "error"`; успіх для колбек-воркфлоу —
    лише 202 з `job_id`; ліміт — за `content-length` і під час читання; ключ «в обробці» → 409, дублікат — лише завершений.
    `code-templates.md` і `callback.md` — те саме з поясненням. У C13 відповіді самого claim у `if` за його результатом
    («дублікат», «в обробці») не вимагають звільнення ключа. Добру теку перегенеровано з шаблону (вивід чекера той
    самий), копія для збірки шаблону — `tsc`, `eslint`, `next build --webpack`: exit 0 (`~/ws4-runs/taskC-template-build-v9.log`,
    хеші файлів — `taskC-template-files-v9.txt`); усі 82 збережені виводи, 8 фікстур четвертого раунду, обидва виводи A/B
    і проби r2/r3/r8 — ті самі; нові фікстури — у таблиці «п'ятий раунд» нижче.

**Як `check-contract.mjs` знаходить код n8n і де його межі** (те саме — у `--help`). Скрипт — евристики над текстом,
а не розбір TypeScript. Вихідний виклик — `fetch`, у чиєму URL є змінна середовища з `N8N`/`WEBHOOK`/`WORKFLOW` у
назві **або** зі значенням у `.env.example`, що містить `/webhook` чи `:5678`, літерал з `/webhook` чи `:5678`, або
`const`, що бере їх; модулі n8n — файли з таким `fetch` і ті, що їх імпортують (транзитивно). Колбек — `POST` у
`app/**/route.*`, де шлях чи код згадує n8n, webhook, workflow, job(s), jobId, `x-…-signature`, `x-…-timestamp`,
`idempotency-key`, `createHmac` чи `timingSafeEqual`. Не бачить: інших HTTP-клієнтів (axios, ky — тоді C4 падає, якщо
в коді є інші ознаки n8n: `lib/n8n/`, `x-n8n-token`, `callbackUrl`), URL, склеєного з частин (`"…/webhook" + "-test"`),
змінних `NEXT_PUBLIC_*` без `N8N`/`WEBHOOK`/`CALLBACK_SECRET`/`WORKFLOW` у назві; пункти C13 шукає у файлі роуту, не
в хелперах. N/A означає «у коді немає того, що перевіряє пункт» (напр. колбек-роуту) і не рахується як FAIL. 0 FAIL
не замінює рев'ю.

Як чекер доводили до його опису. Три раунди гейту писали фікстури, на яких він помилявся в обидва боки, і кожен
раунд — окремий коміт скіла: v0.3.0 (`dd340d4`) після першого (грейдерська фікстура з вісьмома порушеннями
проходила з 0 FAIL), v0.3.1 (`ebae16e`) після другого, v0.4.1 (`cc1940a`, виправлено в `9f575c2`) після третього.
Що дали фікстури другого раунду на v0.3.0 і на v0.4.2 (на v0.4.8 виводи ті самі) (таблиця — з `~/ws4-runs/taskC-v5-round2-compare.txt`):
з 0 FAIL проходили 12 порушень грейдера (fn01, fn02, fn04, fn04b, fn05, fn06, fn07, fn07b, fn08, fn09, fn10, fn13) і 2
з рев'ю (`clone-json`, `nested-tools`), fn11 ловився лише частково, а хибно падали 10 коректних тек (fp01–fp09,
`log-errname`); fn03 і fn14 — межі, які лишились і описані в `--help`. Усі виводи нижче знято на v0.4.2 і перезапущено на v0.4.4, v0.4.5, v0.4.6, v0.4.8 і v0.4.9 — усі 82 збережені виводи
(`~/ws4-runs/taskC-v5-*.txt`; 83-й файл там — таблиця порівняння v0.3.0/v0.4.2) щоразу байт у байт ті самі; шлях
`/Users/alexmart` замінено на `~`; над кожним виводом — команда.

**`check-contract.mjs` на коді `main`** (`01a7dd4`, розпаковано `git archive main | tar -x -C ~/ws4-scratch/leaddesk-main`):

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/leaddesk-main
check-contract — ~/ws4-scratch/leaddesk-main
C1   FAIL  Тестовий URL /webhook-test відсутній у коді та .env.example
       .env.example:6  ключ N8N_WEBHOOK_URL містить /webhook-test
C2   PASS  Змінні N8N_* лише на сервері
C3   FAIL  .env.example: ключі контракту з безпечними значеннями
       .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
       .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
       .env.example:1  немає ключа N8N_CALLBACK_SECRET
       .env.example:1  немає ключа APP_BASE_URL
       .env.example:6  ключ N8N_WEBHOOK_URL поза контрактом
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       app/actions.ts:54  fetch до n8n поза lib/n8n/client.*
       app/actions.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       app/actions.ts:54  fetch до n8n без signal: AbortSignal.timeout(...)
C6   FAIL  Заголовки контракту у виклику n8n
       app/actions.ts:54  немає заголовків: x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       app/actions.ts:54  результат fetch до n8n відкидається — код статусу не перевіряється
       app/actions.ts:54  немає повторів для мережевих помилок, таймауту, 5xx і 524
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       app/actions.ts:54  у n8n іде цілий об'єкт lead, а не конверт { version, event, data }
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/actions.ts:54  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів не знайдено (евристика — див. --help)
C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
C13  N/A   Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
Підсумок: 8 FAIL, 3 PASS, 4 N/A → exit 1
exit=1
```

**Що скрипт побачив на навмисно поганому коді** (фікстури — поза репозиторієм, `~/ws4-scratch/fixtures/`).

Погана тека №1 — порушення «в стилі контракту» (тестовий URL і не-`change-me` токен у `.env.example`,
`NEXT_PUBLIC_N8N_*` у `"use client"`, `env` у `next.config`, токен у query, клієнт без `server-only` з inline
`randomUUID()` у заголовку, 5 спроб на `!res.ok` без паузи, розбір «Workflow was started», тіло `{...row, ipAddress}`,
`console.log(body)`, дія без `after()`, колбек з `runtime = "edge"`, `req.json()` і `!==` на підписі, другий колбек
поза `app/api/n8n/[event]` з `JSON.parse` до `timingSafeEqual` без перевірки довжини). **Кожна з 15 перевірок хоч
раз дає FAIL:**

<details><summary>вивід на поганій теці №1</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/bad-contract
check-contract — ~/ws4-scratch/fixtures/bad-contract
C1   FAIL  Тестовий URL /webhook-test відсутній у коді та .env.example
       .env.example:1  ключ N8N_WEBHOOK_BASE_URL містить /webhook-test
C2   FAIL  Змінні N8N_* лише на сервері
       components/n8n-status.tsx:3  змінна NEXT_PUBLIC_* для n8n потрапить у клієнтський бандл
       components/n8n-status.tsx:3  "use client"-модуль читає process.env.NEXT_PUBLIC_N8N_WEBHOOK_TOKEN
       lib/n8n/client.ts:7  секрет у query string (token=)
       lib/n8n/client.ts:1  літеральний фолбек для N8N_WEBHOOK_TOKEN
       next.config.ts:1  next.config env вбудовує N8N_* у клієнт
       .env.example:5  ключ NEXT_PUBLIC_* для n8n
C3   FAIL  .env.example: ключі контракту з безпечними значеннями
       .env.example:1  N8N_WEBHOOK_BASE_URL має бути локальною адресою, що закінчується на /webhook
       .env.example:2  значення N8N_WEBHOOK_TOKEN не change-me-…
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       lib/n8n/client.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       lib/n8n/client.ts:7  fetch до n8n без signal: AbortSignal.timeout(...)
C6   FAIL  Заголовки контракту у виклику n8n
       lib/n8n/client.ts:7  немає заголовків: x-n8n-token, x-correlation-id
       lib/n8n/client.ts:7  idempotency-key генерується в клієнті на кожен виклик — має приходити з бізнес-операції (збережений із записом)
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/n8n/client.ts:7  повтори без перевірки на 5xx/524 — повторюватимуться й 4xx
       lib/n8n/client.ts:12  повтор для будь-якого не-2xx — повторюються й 4xx
       lib/n8n/client.ts:7  відповідь 4xx не виходить із циклу — дійде до паузи й повториться
       lib/n8n/client.ts:7  повтори без паузи (контракт: 1 с, потім 3 с)
       lib/n8n/client.ts:6  спроб більше трьох (5)
       lib/n8n/client.ts:13  розбір тексту відповіді n8n замість коду статусу
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       lib/n8n/client.ts:7  тіло не має конверта { version, event, data }
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/actions.ts:5  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  FAIL  Без export const runtime = "edge"
       app/api/n8n/[event]/route.ts:2  runtime = "edge" (deprecated у Next.js 16, немає node:crypto)
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/callbacks/n8n/route.ts:5  JSON.parse до перевірки підпису (timingSafeEqual)
       app/api/n8n/[event]/route.ts:5  тіло читається через .json() — підпис рахується від сирого тексту
       app/api/n8n/[event]/route.ts:1  тіло не читається як сирий текст (.text())
       app/api/n8n/[event]/route.ts:5  .json() до перевірки підпису (timingSafeEqual)
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/callbacks/n8n/route.ts:6  HMAC рахується не від `${timestamp}.${raw}` (аргумент .update(…))
       app/api/callbacks/n8n/route.ts:7  немає перевірки довжини тих самих буферів, що йдуть у timingSafeEqual
       app/api/n8n/[event]/route.ts:8  HMAC рахується не від `${timestamp}.${raw}` (аргумент .update(…))
       app/api/n8n/[event]/route.ts:1  немає crypto.timingSafeEqual
       app/api/n8n/[event]/route.ts:9  підпис порівнюється через !==
C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
       app/api/callbacks/n8n/route.ts:1  немає відповіді невідома подія → 404
       app/api/callbacks/n8n/route.ts:1  немає відповіді не-JSON → 415
       app/api/callbacks/n8n/route.ts:1  немає відповіді тіло > 64 KB → 413
       app/api/callbacks/n8n/route.ts:1  не читається x-n8n-timestamp
       app/api/callbacks/n8n/route.ts:1  немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)
       app/api/callbacks/n8n/route.ts:1  не читається idempotency-key
       app/api/callbacks/n8n/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/callbacks/n8n/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/callbacks/n8n/route.ts:1  немає claim ключа (key) у сховищі до обробки
       app/api/callbacks/n8n/route.ts:1  успіх не відповідає 202
       app/api/n8n/[event]/route.ts:1  немає відповіді невідома подія → 404
       app/api/n8n/[event]/route.ts:1  немає відповіді не-JSON → 415
       app/api/n8n/[event]/route.ts:1  немає відповіді тіло > 64 KB → 413
       app/api/n8n/[event]/route.ts:1  не читається x-n8n-timestamp
       app/api/n8n/[event]/route.ts:1  немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)
       app/api/n8n/[event]/route.ts:1  не читається idempotency-key
       app/api/n8n/[event]/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/n8n/[event]/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/n8n/[event]/route.ts:1  немає claim ключа (key) у сховищі до обробки
       app/api/n8n/[event]/route.ts:1  успіх не відповідає 202
C14  FAIL  Журнали без тіл, персональних даних і секретів
       app/api/n8n/[event]/route.ts:6  у журнал іде цілий об'єкт body
       lib/n8n/client.ts:5  у журнал іде цілий об'єкт body
C15  FAIL  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
       app/api/callbacks/n8n/route.ts:1  колбек-роут не за шляхом app/api/n8n/[event]/route.*
Підсумок: 15 FAIL, 0 PASS, 0 N/A → exit 1
exit=1
```

</details>

Погана тека №2 — **без контрактних назв** (`QUEUE_WEBHOOK_URL`, `lib/workflows.ts`, `app/api/webhooks/job/route.ts`
без підпису, таймаут 30 с поза циклом, `console.info("job requested", data)`); та сама тека, перейменована
грейдером (`JOBS_ENDPOINT` зі значенням `…:5678/webhook/job` у `.env.example`, роут `app/api/jobs/done`, `jobId` →
`id`), дає ті самі 12 FAIL — чекер v0.1.0 давав на ній 2 FAIL і 10 N/A:

<details><summary>вивід на поганій теці №2</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/bad-plain
check-contract — ~/ws4-scratch/fixtures/bad-plain
C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
C2   PASS  Змінні N8N_* лише на сервері
C3   FAIL  .env.example: ключі контракту з безпечними значеннями
       .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
       .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
       .env.example:1  немає ключа N8N_CALLBACK_SECRET
       .env.example:1  немає ключа APP_BASE_URL
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       lib/workflows.ts:4  fetch до n8n поза lib/n8n/client.*
       lib/workflows.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       lib/workflows.ts:4  таймаут 30000 мс — понад 10 000
       lib/workflows.ts:2  сигнал таймауту створено поза циклом повторів — наступні спроби без таймауту
C6   FAIL  Заголовки контракту у виклику n8n
       lib/workflows.ts:4  немає заголовків: content-type, x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/workflows.ts:4  повтори без паузи (контракт: 1 с, потім 3 с)
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       lib/workflows.ts:4  у n8n іде цілий об'єкт payload, а не конверт { version, event, data }
       app/jobs/actions.ts:7  у data для n8n розгортається цілий об'єкт (...spread)
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/jobs/actions.ts:7  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/webhooks/job/route.ts:4  тіло читається через .json() — підпис рахується від сирого тексту
       app/api/webhooks/job/route.ts:1  тіло не читається як сирий текст (.text())
       app/api/webhooks/job/route.ts:4  .json() до перевірки підпису (timingSafeEqual)
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/webhooks/job/route.ts:1  немає createHmac("sha256", секрет)
       app/api/webhooks/job/route.ts:1  немає crypto.timingSafeEqual
C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
       app/api/webhooks/job/route.ts:1  немає відповіді невідома подія → 404
       app/api/webhooks/job/route.ts:1  немає відповіді не-JSON → 415
       app/api/webhooks/job/route.ts:1  немає відповіді тіло > 64 KB → 413
       app/api/webhooks/job/route.ts:1  не читається x-n8n-timestamp
       app/api/webhooks/job/route.ts:1  немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)
       app/api/webhooks/job/route.ts:1  не читається idempotency-key
       app/api/webhooks/job/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/webhooks/job/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/webhooks/job/route.ts:1  немає claim ключа (key) у сховищі до обробки
       app/api/webhooks/job/route.ts:1  успіх не відповідає 202
C14  FAIL  Журнали без тіл, персональних даних і секретів
       app/api/webhooks/job/route.ts:6  у журнал ідуть персональні дані
       app/jobs/actions.ts:6  у журнал іде цілий об'єкт data
C15  FAIL  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
       app/api/webhooks/job/route.ts:1  колбек-роут не за шляхом app/api/n8n/[event]/route.*
Підсумок: 12 FAIL, 3 PASS, 0 N/A → exit 1
exit=1
```

</details>

<details><summary>вивід на теці №2 з перейменуваннями грейдера</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/grader/plain2
check-contract — ~/ws4-scratch/fixtures/grader/plain2
C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
C2   PASS  Змінні N8N_* лише на сервері
C3   FAIL  .env.example: ключі контракту з безпечними значеннями
       .env.example:1  немає ключа N8N_WEBHOOK_BASE_URL
       .env.example:1  немає ключа N8N_WEBHOOK_TOKEN
       .env.example:1  немає ключа N8N_CALLBACK_SECRET
       .env.example:1  немає ключа APP_BASE_URL
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       lib/workflows.ts:4  fetch до n8n поза lib/n8n/client.*
       lib/workflows.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       lib/workflows.ts:4  таймаут 30000 мс — понад 10 000
       lib/workflows.ts:2  сигнал таймауту створено поза циклом повторів — наступні спроби без таймауту
C6   FAIL  Заголовки контракту у виклику n8n
       lib/workflows.ts:4  немає заголовків: content-type, x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/workflows.ts:4  повтори без паузи (контракт: 1 с, потім 3 с)
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       lib/workflows.ts:4  у n8n іде цілий об'єкт payload, а не конверт { version, event, data }
       app/jobs/actions.ts:7  у data для n8n розгортається цілий об'єкт (...spread)
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/jobs/actions.ts:7  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/jobs/done/route.ts:4  тіло читається через .json() — підпис рахується від сирого тексту
       app/api/jobs/done/route.ts:1  тіло не читається як сирий текст (.text())
       app/api/jobs/done/route.ts:4  .json() до перевірки підпису (timingSafeEqual)
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/jobs/done/route.ts:1  немає createHmac("sha256", секрет)
       app/api/jobs/done/route.ts:1  немає crypto.timingSafeEqual
C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
       app/api/jobs/done/route.ts:1  немає відповіді невідома подія → 404
       app/api/jobs/done/route.ts:1  немає відповіді не-JSON → 415
       app/api/jobs/done/route.ts:1  немає відповіді тіло > 64 KB → 413
       app/api/jobs/done/route.ts:1  не читається x-n8n-timestamp
       app/api/jobs/done/route.ts:1  немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)
       app/api/jobs/done/route.ts:1  не читається idempotency-key
       app/api/jobs/done/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/jobs/done/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/jobs/done/route.ts:1  немає claim ключа (key) у сховищі до обробки
       app/api/jobs/done/route.ts:1  успіх не відповідає 202
C14  FAIL  Журнали без тіл, персональних даних і секретів
       app/api/jobs/done/route.ts:6  у журнал ідуть персональні дані
       app/jobs/actions.ts:6  у журнал іде цілий об'єкт data
C15  FAIL  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
       app/api/jobs/done/route.ts:1  колбек-роут не за шляхом app/api/n8n/[event]/route.*
Підсумок: 12 FAIL, 3 PASS, 0 N/A → exit 1
exit=1
```

</details>

Погана тека №3 — фікстура грейдера, яку v0.1.0 пропускала з 0 FAIL (фолбек на `…/webhook-test` у коді, таймаут
`90_000` через константу, ключ `randomUUID()` у клієнті на кожен виклик і той самий як correlation-id, `while
(attempt < 6)` з повтором 403/404 без паузи, `Object.fromEntries(formData)` як `data`, `JSON.parse` до
`timingSafeEqual` і до claim, `WINDOW = 86400`, ключ із тіла як фолбек, без 404/415/413 і без звільнення ключа):

<details><summary>вивід на поганій теці №3</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/grader/fn
check-contract — ~/ws4-scratch/fixtures/grader/fn
C1   FAIL  Тестовий URL /webhook-test відсутній у коді та .env.example
       lib/n8n/client.ts:4  тестовий URL вебхука в коді
C2   PASS  Змінні N8N_* лише на сервері
C3   PASS  .env.example: ключі контракту з безпечними значеннями
C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       lib/n8n/client.ts:11  таймаут 90000 мс — понад 10 000
C6   FAIL  Заголовки контракту у виклику n8n
       lib/n8n/client.ts:11  idempotency-key генерується в клієнті на кожен виклик — має приходити з бізнес-операції (збережений із записом)
       lib/n8n/client.ts:11  x-correlation-id збігається з idempotency-key — це різні ідентифікатори
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/n8n/client.ts:18  повтор для 4xx — 4xx не повторюємо ніколи
       lib/n8n/client.ts:11  повтори без паузи (контракт: 1 с, потім 3 с)
       lib/n8n/client.ts:9  спроб більше трьох (6)
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       app/q/actions.ts:6  у n8n іде цілий об'єкт data (усі поля форми)
C9   PASS  Server Action не чекає n8n: виклик лише в after()
C10  PASS  Без export const runtime = "edge"
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/n8n/[event]/route.ts:9  JSON.parse до перевірки підпису (timingSafeEqual)
C12  PASS  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
       app/api/n8n/[event]/route.ts:1  немає відповіді невідома подія → 404
       app/api/n8n/[event]/route.ts:1  немає відповіді не-JSON → 415
       app/api/n8n/[event]/route.ts:1  немає відповіді тіло > 64 KB → 413
       app/api/n8n/[event]/route.ts:7  вікно часу 86400 — понад 300 с
       app/api/n8n/[event]/route.ts:10  idempotency-key має братися лише із заголовка — фолбек із тіла дозволяє підмінити ключ
       app/api/n8n/[event]/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/n8n/[event]/route.ts:9  JSON.parse до claim idempotency-key — контракт: спершу claim, потім розбір тіла
       app/api/n8n/[event]/route.ts:14  після claim немає звільнення ключа при 400 чи збої — n8n не зможе повторити
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
Підсумок: 7 FAIL, 8 PASS, 0 N/A → exit 1
exit=1
```

</details>

Ще дві: `bad-variants` (повтор 429 у `do…while` на 4 спроби, рекурсивні повтори без межі, дія, що через
проміжний сервіс чекає n8n, inline `"use server"` у сторінці, `req.headers.get("x-n8n-signature") !== expected`,
`JSON.parse` між `createHmac` і `timingSafeEqual`, `timingSafeEqual(a, a)` без перевірки довжини,
`console.log(JSON.stringify(payload))`) і `bad-axios` (клієнт на axios, який скрипт не розпізнає як виклик):

<details><summary>вивід на bad-variants</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/bad-variants
check-contract — ~/ws4-scratch/fixtures/bad-variants
C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
C2   PASS  Змінні N8N_* лише на сервері
C3   PASS  .env.example: ключі контракту з безпечними значеннями
C4   PASS  Виклики n8n лише з lib/n8n/client.* з import "server-only"
C5   PASS  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
C6   PASS  Заголовки контракту у виклику n8n
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/n8n/client.ts:16  повтор для 4xx — 4xx не повторюємо ніколи
       lib/n8n/client.ts:7  спроб більше трьох (4)
       lib/n8n/client.ts:25  рекурсивні повтори без межі ≤ 3
C8   PASS  Тіло — конверт { version, event, data } з мінімальними data
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/orders/actions.ts:7  Server Action чекає n8n — перенести виклик у after() з "next/server"
       app/reports/page.tsx:7  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/n8n/[event]/route.ts:13  JSON.parse до перевірки підпису (timingSafeEqual)
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/n8n/[event]/route.ts:16  немає перевірки довжини тих самих буферів, що йдуть у timingSafeEqual
       app/api/n8n/[event]/route.ts:14  підпис порівнюється через !==
C13  FAIL  Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді
       app/api/n8n/[event]/route.ts:13  JSON.parse до claim idempotency-key — контракт: спершу claim, потім розбір тіла
C14  FAIL  Журнали без тіл, персональних даних і секретів
       lib/n8n/client.ts:24  у журнал іде цілий об'єкт payload
C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
Підсумок: 6 FAIL, 9 PASS, 0 N/A → exit 1
exit=1
```

</details>

<details><summary>вивід на bad-axios</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/bad-axios
check-contract — ~/ws4-scratch/fixtures/bad-axios
C1   PASS  Тестовий URL /webhook-test відсутній у коді та .env.example
C2   PASS  Змінні N8N_* лише на сервері
C3   PASS  .env.example: ключі контракту з безпечними значеннями
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       lib/n8n/client.ts:1  є ознаки інтеграції n8n, але виклику fetch до n8n не розпізнано — перевірте вручну (лише fetch, URL з N8N_WEBHOOK_BASE_URL)
C5   N/A   Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000) — викликів n8n у коді не знайдено
C6   N/A   Заголовки контракту у виклику n8n — викликів n8n у коді не знайдено
C7   N/A   Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524 — викликів n8n у коді не знайдено
C8   N/A   Тіло — конверт { version, event, data } з мінімальними data — викликів n8n у коді не знайдено
C9   N/A   Server Action не чекає n8n: виклик лише в after() — Server Actions не викликають n8n
C10  PASS  Без export const runtime = "edge"
C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів не знайдено (евристика — див. --help)
C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
C13  N/A   Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
Підсумок: 1 FAIL, 5 PASS, 9 N/A → exit 1
exit=1
```

</details>

**Хибні спрацювання — на коректному коді.** Добра тека — блоки з `references/code-templates.md` на конкретній події
(`lead-enriched`) + демо-сховище й дія: **0 FAIL**. Ці ж файли (sha256 кожного збігається з добрим набором —
`~/ws4-runs/taskC-template-files.txt`) у тимчасовій копії проєкту проходять `next build --webpack` (TypeScript, роут
`/api/n8n/[event]`, `build-exit=0`) і ESLint (`eslint-exit=0`; коди виходу — у логах
`~/ws4-runs/taskC-template-{build,lint}-v6.log`). Ще дві теки з коректним за контрактом кодом іншої форми — теж
0 FAIL: `good-variants` (`for…of` по масиву пауз, `fetch(url, init)`, заголовки в змінній, проміжний сервіс,
клієнтський компонент імпортує Server Action, `verify` як стрілкова функція, вікно `5 * 60`, `console.error(…,
err.message)`) і варіанти грейдера з першого раунду (`fetch(url, init)`, `after(send)`, `signature === null`):

<details><summary>вивід на добрій теці</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/good
check-contract — ~/ws4-scratch/fixtures/good
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

</details>

<details><summary>вивід на good-variants</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/good-variants
check-contract — ~/ws4-scratch/fixtures/good-variants
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

</details>

<details><summary>вивід на варіантах грейдера (перший раунд)</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --root ~/ws4-scratch/fixtures/grader/fp
check-contract — ~/ws4-scratch/fixtures/grader/fp
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

</details>

**Фікстури другого й третього раундів гейту** (`~/ws4-scratch/fixtures/grader2/`, `review2/`, `grader3/`: кожна —
добра тека з однією-двома змінами). Стовпці FAIL і «Підсумок» скопійовано з виводу чекера на кожній теці; повні
виводи (рядок `check-contract — <тека>`, вивід і `exit=`; команда — `node …/check-contract.mjs --root <тека>`) —
`~/ws4-runs/taskC-v5-{g2,r2,g3}-*.txt`.

| Тека | Що змінено | Очікування | FAIL | Підсумок |
|---|---|---|---|---|
| `fn01-literal-token` | токен x-n8n-token літералом у заголовку | FAIL | C2 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn02-throw-retry` | `if (>=500) throw; throw` у try, catch повторює — 4xx теж | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn02b-throw-noret500` | `if (!res.ok) throw` у try без жодної згадки 5xx | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn03-split-test-url` | фолбек `"…/webhook" + "-test"` (URL склеєно з частин) | межа (у `--help`) | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fn04-hmac-raw-only` | HMAC лише від `raw` + стороннє `${e}.${SUFFIX}` | FAIL | C12 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn04b-hmac-reversed` | HMAC від `${raw}.${timestamp}` | FAIL | C12 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn05-no-len-check` | без перевірки довжини, `try { timingSafeEqual }` | FAIL | C12 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn06-parse-in-helper` | `parseEnvelope(raw)` з хелпер-модуля до перевірки підпису | FAIL | C11 C13 | 2 FAIL, 13 PASS, 0 N/A → exit 1 |
| `fn07-log-body` | `raw.slice(0, 500)` і `Object.fromEntries(req.headers)` у журналі | FAIL | C14 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn07b-log-parsed` | `JSON.stringify(parsed)` у журналі | FAIL | C14 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn08-helper-outside` | inline `"use server"` чекає хелпер того ж файлу, що викликає n8n | FAIL | C9 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn09-dup-409` | повтор ключа → 409 | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn10-edge-typed` | `export const runtime: string = "edge"` | FAIL | C10 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn11-eq-neutral` | `provided !== want` на підписі | FAIL | C11 C12 | 2 FAIL, 13 PASS, 0 N/A → exit 1 |
| `fn12-sha1` | HMAC-SHA1 | FAIL | C12 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn13-window-onesided` | одностороннє вікно + стороннє `Math.abs` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn14-public-api-token` | токен у `NEXT_PUBLIC_API_TOKEN` (без N8N у назві) | межа (у `--help`) | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fn15-no-ts-in-hmac-key-from-body` | ключ `hdr ? hdr : JSON.parse(raw)…` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fp01-key-var` | очікуваний ключ у змінній | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp02-headers-fn` | заголовки з функції | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp03-status-helper` | коди через `reply(404, …)` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp04-reset-link` | сторонній лінк `?token=` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp05-oauth-callback` | OAuth `app/api/auth/callback` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp06-with-retry` | `withRetry(() => fetch(…))` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp06b-wrapper-bad` | та сама обгортка: 5 спроб, повтор за `!ok` (моя варіація) | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fp07-log-flag` | `hasSig: Boolean(sig)` у журналі | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp08-while-true` | `while (true)` з межею через масив пауз | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp09-log-errname` | `reason: (error as Error).name` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `review2/clone-json` | `await req.clone().json()` до `req.text()` | FAIL | C11 C13 | 2 FAIL, 13 PASS, 0 N/A → exit 1 |
| `review2/log-errname` | `error: err.name` у журналі | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `review2/nested-tools` | синхронна дія в `app/tools/actions.ts` | FAIL | C9 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |

<details><summary>третій раунд (37 тек; `fn-*` — порушення, `fp-*` — коректний код)</summary>

| Тека | Очікування | FAIL | Підсумок |
|---|---|---|---|
| `fn-4xx-fallthrough` | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-4xx-fallthrough-plain` | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-action-awaits` | FAIL | C9 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-body-data-template-log2` | FAIL | C14 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-callback-elsewhere` | FAIL | C15 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-claim-before-verify` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-data-parsed` | FAIL | C8 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-dup-409-multiline` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-edge-config` | FAIL | C10 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-log-body-data` | FAIL | C14 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-log-template-raw` | FAIL | C14 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-no-timeout-loop-outside` | FAIL | C5 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-public-env-client` | FAIL | C2 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-response-json-parse` | FAIL | C11 C13 | 2 FAIL, 13 PASS, 0 N/A → exit 1 |
| `fn-retry-4-attempts` | FAIL | C7 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-test-url-env` | FAIL | C1 C3 | 2 FAIL, 13 PASS, 0 N/A → exit 1 |
| `fn-token-wrong-secret` | FAIL | C6 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-verify-ignored` | FAIL | C12 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-window-3600` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fn-window-ms-big` | FAIL | C13 | 1 FAIL, 14 PASS, 0 N/A → exit 1 |
| `fp-arrow-post` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-byteLength-check` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-client-types-import` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-envelope-fn` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-helper-in-use-server` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-key-join` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-log-event-name` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-prettier-client` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-prettier-route` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-retryable-fn` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-status-const` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-timeout-imported` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-tryclaim` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-ts-name-t` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-tse-inline-buffers` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-window-ms-reversed` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |
| `fp-window-var` | 0 FAIL | — | 0 FAIL, 15 PASS, 0 N/A → exit 0 |

</details>

<details><summary>другий раунд: v0.3.0 проти v0.4.2</summary>

| Тека | FAIL на v0.3.0 (`dd340d4`) | FAIL на v0.4.2 |
|---|---|---|
| `fn01-literal-token` | — | C2 |
| `fn02-throw-retry` | — | C7 |
| `fn02b-throw-noret500` | C7 | C7 |
| `fn03-split-test-url` | — | — |
| `fn04-hmac-raw-only` | — | C12 |
| `fn04b-hmac-reversed` | — | C12 |
| `fn05-no-len-check` | — | C12 |
| `fn06-parse-in-helper` | — | C11 C13 |
| `fn07-log-body` | — | C14 |
| `fn07b-log-parsed` | — | C14 |
| `fn08-helper-outside` | — | C9 |
| `fn09-dup-409` | — | C13 |
| `fn10-edge-typed` | — | C10 |
| `fn11-eq-neutral` | C11 | C11 C12 |
| `fn12-sha1` | C12 | C12 |
| `fn13-window-onesided` | — | C13 |
| `fn14-public-api-token` | — | — |
| `fn15-no-ts-in-hmac-key-from-body` | C13 | C13 |
| `fp01-key-var` | C13 | — |
| `fp02-headers-fn` | C6 | — |
| `fp03-status-helper` | C13 | — |
| `fp04-reset-link` | C2 | — |
| `fp05-oauth-callback` | C11 C12 C13 C15 | — |
| `fp06-with-retry` | C7 | — |
| `fp06b-wrapper-bad` | C7 | C7 |
| `fp07-log-flag` | C14 | — |
| `fp08-while-true` | C7 | — |
| `fp09-log-errname` | C14 | — |
| `clone-json` | — | C11 C13 |
| `log-errname` | C14 | — |
| `nested-tools` | — | C9 |

</details>

**Четвертий раунд — фінальне рев'ю PR** (`~/ws4-scratch/fixtures/review3/`: копія колбек-роуту гілки з `lib/db.ts`,
`lib/types.ts` і `.env.example`, без клієнта n8n — звідси 6 N/A; одна зміна на теку). Виводи з командою —
`~/ws4-runs/taskC-v8-review3-*.txt`; на v0.4.7 усі чотири теки з очікуваним FAIL давали 0 FAIL.

| Тека | Що змінено | Очікування | FAIL (рядок і причина) | Підсумок |
|---|---|---|---|---|
| `control` | без змін | 0 FAIL | — | 0 FAIL, 9 PASS, 6 N/A → exit 0 |
| `after-finish` | `after(() => db.finishQuote(…))` замість `await` | FAIL | C13 `route.ts:55` стан зберігається лише в after() | 1 FAIL, 8 PASS, 6 N/A → exit 1 |
| `void-finish` | `void db.finishQuote(…)` | FAIL | C13 `route.ts:54` стан зберігається без await | 1 FAIL, 8 PASS, 6 N/A → exit 1 |
| `then-catch-finish` | `db.finishQuote(…).catch(() => {})` | FAIL | C13 `route.ts:54` стан зберігається без await | 1 FAIL, 8 PASS, 6 N/A → exit 1 |
| `no-release-unknown` | у гілці `unknown_job` прибрано звільнення ключа | FAIL | C13 `route.ts:50` відповідь 400 після claim не звільняє ключ | 1 FAIL, 8 PASS, 6 N/A → exit 1 |
| `ok-helper-release` | `return fail(400, …)`, хелпер звільняє ключ | 0 FAIL | — | 0 FAIL, 9 PASS, 6 N/A → exit 0 |
| `ok-finally` | звільнення в `finally` за прапорцем `done` | 0 FAIL | — | 0 FAIL, 9 PASS, 6 N/A → exit 0 |
| `ok-sync-map` | синхронний запис `finished.set(…)` у `Map` | 0 FAIL | — | 0 FAIL, 9 PASS, 6 N/A → exit 0 |

**П'ятий раунд — рев'ю CodeRabbit** (`~/ws4-scratch/fixtures/review4/`: колбек-роут гілки на `930f31c` зі станами ключа
і 409 «в обробці», `lib/db.ts`, `lib/types.ts`, `.env.example`). Виводи — `~/ws4-runs/taskC-v9-review4-*.txt`.

| Тека | Що змінено | Очікування | FAIL (рядок і причина) | Підсумок |
|---|---|---|---|---|
| `control` | без змін (409 на ключ «в обробці» — у `if` за результатом claim) | 0 FAIL | — | 0 FAIL, 9 PASS, 6 N/A → exit 0 |
| `claim-var-no-release` | у гілці `unknown_job` прибрано звільнення ключа | FAIL | C13 `route.ts:54` відповідь 400 після claim не звільняє ключ | 1 FAIL, 8 PASS, 6 N/A → exit 1 |

`--changed-since`: у scratch-репозиторії з кодом `main` змінено один рядок наявного виклику n8n (таймаут 20 000 мс)
і додано новий файл із тестовим URL. Лишились усі знахідки до зміненого виклику (C4–C9, кожна рахується, якщо
змінено будь-який рядок виклику), знахідки «чого бракує у файлі» для зміненого файлу (`app/actions.ts:1`) і всі
знахідки нового файлу; решта — «проігноровано у незміненому коді» (C1 і C3 у `.env.example`):

<details><summary>вивід</summary>

```
$ node .claude/skills/integrating-n8n-webhooks/scripts/check-contract.mjs --changed-since base   # запуск у ~/ws4-scratch/changed-since-test
check-contract — ~/ws4-scratch/changed-since-test  (лише зміни після base)
C1   FAIL  Тестовий URL /webhook-test відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
       lib/ping.ts:2  тестовий URL вебхука в коді
C2   PASS  Змінні N8N_* лише на сервері
C3   PASS  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 5)
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       app/actions.ts:54  fetch до n8n поза lib/n8n/client.*
       lib/ping.ts:2  fetch до n8n поза lib/n8n/client.*
       app/actions.ts:1  модуль, що викликає n8n, не починається з import "server-only"
       lib/ping.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       app/actions.ts:54  таймаут 20000 мс — понад 10 000
       lib/ping.ts:2  fetch до n8n без signal: AbortSignal.timeout(...)
C6   FAIL  Заголовки контракту у виклику n8n
       app/actions.ts:54  немає заголовків: x-n8n-token, idempotency-key, x-correlation-id
       lib/ping.ts:2  немає заголовків: content-type, x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       app/actions.ts:54  результат fetch до n8n відкидається — код статусу не перевіряється
       app/actions.ts:54  немає повторів для мережевих помилок, таймауту, 5xx і 524
       lib/ping.ts:2  немає повторів для мережевих помилок, таймауту, 5xx і 524
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       app/actions.ts:54  у n8n іде цілий об'єкт lead, а не конверт { version, event, data }
       lib/ping.ts:2  тіло не розпізнано як JSON.stringify({ version, event, data })
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/actions.ts:54  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів не знайдено (евристика — див. --help)
C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
C13  N/A   Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
Підсумок: 7 FAIL, 4 PASS, 4 N/A → exit 1
exit=1
```

</details>

**`check-contract.mjs` на фінальному коді** (гілка після перенесення прогону B `050a5bc` і доробок `39be1a7`, `66c046a`,
`2398c61`, `bdb7dbd`, `92a5226`, `176dbaa`, `07ec6d7`, `ddf886f`, `50d20ce` і правок після рев'ю CodeRabbit `d227c13`,
`7350738`, `8fdf465`, `ae50666`, `961c2e0`; вивід на `930f31c` чекером v0.4.9 — `~/ws4-runs/branch-check-final5.txt`, той
самий, що й у `branch-check-final3.txt` (`ddf886f`, v0.4.7) і `branch-check-final4.txt` (`6bf19e8`, v0.4.8); подробиці
перенесення — `docs/ab-validation.md`):

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

**Додатково — матриця колбеків** проти гілки на фінальному коді (`930f31c`: `npm start`, мок `--mode respond-202 --delay
60000`, `jobId` незавершеної задачі — з рядка мока `workflow <jobId> running` після відправки форми без JS). Скрипт v0.4.7
(±305 с; у v0.4.8 і v0.4.9 не змінювався); три прогони на трьох свіжих задачах — 13/13 щоразу
(`~/ws4-runs/branch-callback-matrix-v5.txt`; на `ddf886f` і `6bf19e8` так само — `-v3.txt`, `-v4.txt`), нижче перший.
Нові поведінки після рев'ю CodeRabbit (chunked-тіло > 64 KB → 413, дві одночасні доставки → 202 і 409) — у
`docs/ab-validation.md`, розділ про фінальний код.

```
$ node --env-file=.env.local .claude/skills/integrating-n8n-webhooks/scripts/send-signed-callback.mjs --url http://127.0.0.1:3000/api/n8n/quote-request --job-id 5091d3c4-8ebb-42bd-ae69-cf4d40379404
send-signed-callback → http://127.0.0.1:3000/api/n8n/quote-request (подія «quote-request», jobId 5091d3c4-8ebb-42bd-ae69-cf4d40379404)
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

## Task E3 (бонус) — ті самі скіли в Cursor

_Не виконувалось: обрано бонус E2 (`docs/trigger-evals.md`); Cursor на машині не встановлено._
