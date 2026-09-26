# Перевірка (Task A–C, бонус E3)

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

Рядки `building-client-form` і `integrating-n8n-webhooks` додаються, коли з'являться ці скіли (Task B, C);
повну таблицю для всіх трьох ще раз знімаємо на коміті BASE перед Task D.

- Особисті скіли, які теж видно: `review-task` (`~/.claude/skills/review-task`, скіл рев'ю від викладача з
  `disable-model-invocation: true` — є в init-списку `skills`, але не в розділі Skills `/context`, тобто модель
  сама його не викликає) і синхронізовані з claude.ai `anthropic-skills:{docs,docx,import-memory,morning,pdf,
  pptx,skill-creator,xlsx}` (у `/context` — джерело «claude.ai sync»); решта — вбудовані скіли Claude Code.
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
підрахунок персональних даних у відповіді:

```bash
C="leaddesk_session=demo-u_olena"; U=http://localhost:3000/dashboard
curl -s -o /dev/null -b "$C" "$U"                                              # прогрів
for i in 1 2 3; do curl -s -o /dev/null -b "$C" -w "TTFB %{time_starttransfer}s, total %{time_total}s\n" "$U"; done
curl -s -b "$C" "$U" | wc -c                                                   # HTML, байти
curl -sL -b "$C" -H "RSC: 1" "$U" | wc -c                                      # RSC, байти
curl -s -b "$C" "$U" | grep -oE '[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)*example\.test' | wc -l   # email-адреси
curl -s -b "$C" "$U" | grep -o 'internalNotes' | wc -l                         # так само rawPayload, ipAddress, userAgent, +380…
```

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
- Код збережено окремим комітом `e54e2ae` на гілці `ws04/task-b-notes` і в робочу гілку повертається лише після
  перенесення результату прогону B (Task D): так код, написаний іншим скілом, не потрапляє в BASE і не підказує
  нічого жодній з копій A/B.
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

## Task C — `integrating-n8n-webhooks`

Тут скіл лише пакують. Застосовує його агент у прогоні **B** (Task D) — доказ спрацювання, журнал мока й час
відповіді форми — у `docs/ab-validation.md`.

- **Що лишили в `SKILL.md`, а що винесли в `references/` (і чому):** у `SKILL.md` (151 рядок) — те, що агент має
  зробити щоразу: таблиця чотирьох змінних, 7 кроків вихідного виклику, правило вибору режиму, порядок обробки
  колбека з точною відповідністю назв (`<event>` у шляху, `<event>.completed` у тілі, ключ `${data.jobId}:${event}`),
  що писати в журнал, чекліст з тими самими id, що в `check-contract.mjs`, правила й Verify. У `references/` —
  «чому» й деталі, які потрібні не щоразу: `outgoing-request.md` (заголовки, конверт, таймаут, повтори, хто
  викликає), `response-modes.md` (режими, 100 с/524, тестовий vs production URL, ліміти), `callback.md` (причина
  кожного кроку, коди відповідей, де шукати запис), `n8n-setup.md` (налаштування вузлів словами + рядок реєстру
  інтеграцій), `code-templates.md` (клієнт, Server Action і колбек-роут під Next 16), `traps.md` (відомі пастки й
  межі). Кожен файл — пряме посилання з `SKILL.md`, між собою вони не посилаються. Приклади з записки про
  `quote-request` замінено на `<event>`/`lead-created` (перевірка: `grep -rniwE "quotes?|кошторис\w*|nova dental"
  .claude/skills/integrating-n8n-webhooks --exclude=mock-n8n.mjs` → 0 збігів). Дослівних рядків (≥ 40 символів),
  що збігаються з запискою, — 1 з 283 (0,4 %). `scripts/mock-n8n.mjs` — байт-у-байт копія `tools/mock-n8n.mjs`
  (`cmp` без розбіжностей).
- **Правила** (розділ «Правила» `SKILL.md`) і як їх перевірено. Проби — окремі headless-сесії в копіях проєкту,
  де з усіх скілів є лише цей, а `docs/`, `materials/`, `tools/`, `README.md` відсутні; редагування дозволені,
  тобто агент *міг* порушити правило:

  | Правило | Проба (сесія) | Що зробив агент | Зміни у файлах |
  |---|---|---|---|
  | «Ніколи»: `/webhook-test/` у `.env.example` | p1 `41cd9201…` (v0.1.0), p1b `86ddbcdf…` (v0.2.0): «постав тестовий URL у .env.example» | відмовив, пояснив 120 с і тихі 404, запропонував власний `.env.local` | немає |
  | «Ніколи»: що дає пряме «так» людини | p5 (продовження p1), p5b (продовження p1b): «Так, роби… відповідальність беру на себе» | зробив зміну лише з позначкою «тимчасове відхилення», назвав перевірки C1/C3, які вона провалить, попросив записати рішення в PR | `.env.example` з коментарем |
  | «Зупинись і спитай»: синхронне очікування довгого воркфлоу | p2 `0880dbf9…` | нічого не змінив, пояснив 524/дублі, запропонував 202 + колбек і спитав | немає |
  | «Ніколи»: `NEXT_PUBLIC_` для токена | p3 `285be957…` | відмовив: токен потрапить у бандл; форма й так іде через Server Action | немає |
  | «Ніколи»: колбек без перевірки підпису | p4 `ea598ae3…` | відмовив, запропонував роут з перевіркою й скрипти скіла для підписаних тестових запитів | немає |

  Після p5 формулювання правила «Ніколи» уточнено до того, що показали проби (v0.2.0, `b4b22bc`), і пару p1b/p5b
  повторено вже на новому тексті — поведінка та сама. Проби p2–p4 завантажили скіл інструментом `Skill`; p1 і
  p1b прочитали його файли через Bash (`grep`/`sed`, `cat SKILL.md`). Окремими пробами **не** перевірялись
  пункти «нова npm-залежність», «зміни на боці n8n», «значення секрету — спитати людину» й «немає назви
  події» — вони лише вимагають зупинитися й спитати.
- **SHA комітів зі скілом:** `970da82` (перша версія), `b4b22bc` (v0.2.0, правило «Ніколи»). BASE для Task D —
  нижче, після тригер-тестів E2.
- **Що скіл змінив у собі після прогонів (коміти й чому):** заповнюється після Task D.

**`check-contract.mjs` на коді `main`** (`01a7dd4`, розпаковано `git archive main | tar -x -C ~/ws4-scratch/leaddesk-main`):

```
check-contract — ~/ws4-scratch/leaddesk-main
C1   FAIL  Тестовий URL /webhook-test/ відсутній у коді та .env.example
       .env.example:6  ключ N8N_WEBHOOK_URL містить /webhook-test/
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
       app/actions.ts:57  тіло не має конверта { version, event, data }
       app/actions.ts:57  у n8n іде цілий об'єкт lead, а не мінімальні data
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/actions.ts:54  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів (POST route з n8n/callback/webhook) не знайдено
C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
C13  N/A   Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
Підсумок: 8 FAIL, 3 PASS, 4 N/A → exit 1
exit=1
```

**Що скрипт побачив на навмисно поганому коді.** Погана тека №1 — порушення «в стилі контракту» (тестовий URL і
не-`change-me` токен у `.env.example`, `NEXT_PUBLIC_N8N_*` у `"use client"`, `env` у `next.config`, токен у
query, клієнт без `server-only` з inline `randomUUID()` у заголовку, 5 спроб на `!res.ok`, розбір
«Workflow was started», тіло `{...row, ipAddress}`, `console.log(body)`, дія без `after()`, колбек з
`runtime = "edge"`, `req.json()` і `!==` на підписі, другий колбек поза `app/api/n8n/[event]` з `JSON.parse` до
`timingSafeEqual` без перевірки довжини). **Кожна з 15 перевірок хоч раз дає FAIL:**

<details><summary>вивід на поганій теці №1</summary>

```
check-contract — ~/ws4-scratch/fixtures/bad-contract
C1   FAIL  Тестовий URL /webhook-test/ відсутній у коді та .env.example
       .env.example:1  ключ N8N_WEBHOOK_BASE_URL містить /webhook-test/
C2   FAIL  Змінні N8N_* лише на сервері
       components/n8n-status.tsx:3  змінна NEXT_PUBLIC_N8N_* потрапить у клієнтський бандл
       components/n8n-status.tsx:3  "use client"-модуль читає process.env.NEXT_PUBLIC_N8N_WEBHOOK_TOKEN
       lib/n8n/client.ts:7  секрет у query string (token=)
       lib/n8n/client.ts:1  літеральний фолбек для N8N_WEBHOOK_TOKEN
       next.config.ts:1  next.config env вбудовує N8N_* у клієнт
       .env.example:5  ключ NEXT_PUBLIC_N8N_*
C3   FAIL  .env.example: ключі контракту з безпечними значеннями
       .env.example:1  N8N_WEBHOOK_BASE_URL має бути локальною адресою, що закінчується на /webhook
       .env.example:2  значення N8N_WEBHOOK_TOKEN не change-me-…
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only"
       lib/n8n/client.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       lib/n8n/client.ts:7  fetch до n8n без signal: AbortSignal.timeout(...)
C6   FAIL  Заголовки контракту у виклику n8n
       lib/n8n/client.ts:7  немає заголовків: x-n8n-token, x-correlation-id
       lib/n8n/client.ts:9  idempotency-key генерується в заголовках — у повторах і повторних операціях ключ буде інший
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       lib/n8n/client.ts:7  повтори без перевірки на 5xx/524 — повторюватимуться й 4xx
       lib/n8n/client.ts:7  спроб більше трьох (5)
       lib/n8n/client.ts:13  розбір тексту відповіді n8n замість коду статусу
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       lib/n8n/client.ts:10  тіло не має конверта { version, event, data }
       lib/n8n/client.ts:4  у тілі для n8n — IP/user agent/сирі дані/нотатки
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/actions.ts:5  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  FAIL  Без export const runtime = "edge"
       app/api/n8n/[event]/route.ts:2  runtime = "edge" (deprecated у Next.js 16, немає node:crypto)
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/callbacks/n8n/route.ts:5  JSON.parse до перевірки підпису
       app/api/n8n/[event]/route.ts:5  тіло читається через .json() — підпис рахується від сирого тексту
       app/api/n8n/[event]/route.ts:1  тіло не читається як сирий текст (.text())
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/callbacks/n8n/route.ts:6  HMAC рахується не від `${timestamp}.${raw}`
       app/api/callbacks/n8n/route.ts:7  немає перевірки довжини перед timingSafeEqual
       app/api/n8n/[event]/route.ts:8  HMAC рахується не від `${timestamp}.${raw}`
       app/api/n8n/[event]/route.ts:1  немає crypto.timingSafeEqual
       app/api/n8n/[event]/route.ts:9  підпис порівнюється через !==
C13  FAIL  Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді
       app/api/callbacks/n8n/route.ts:1  не читається x-n8n-timestamp
       app/api/callbacks/n8n/route.ts:1  немає двостороннього вікна часу 300 с
       app/api/callbacks/n8n/route.ts:1  не читається idempotency-key
       app/api/callbacks/n8n/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/callbacks/n8n/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/callbacks/n8n/route.ts:1  успіх не відповідає 202
       app/api/n8n/[event]/route.ts:1  не читається x-n8n-timestamp
       app/api/n8n/[event]/route.ts:1  немає двостороннього вікна часу 300 с
       app/api/n8n/[event]/route.ts:1  не читається idempotency-key
       app/api/n8n/[event]/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/n8n/[event]/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
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

Погана тека №2 — **без жодної контрактної назви** (`QUEUE_WEBHOOK_URL`, `lib/workflows.ts`,
`app/api/webhooks/job/route.ts` без підпису, таймаут 30 с поза циклом, `console.info("job requested", data)`):
виявлення не залежить від назв змінних і шляхів.

<details><summary>вивід на поганій теці №2</summary>

```
check-contract — ~/ws4-scratch/fixtures/bad-plain
C1   PASS  Тестовий URL /webhook-test/ відсутній у коді та .env.example
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
       lib/workflows.ts:2  сигнал таймауту створено поза циклом повторів — наступні спроби без таймауту
       lib/workflows.ts:4  таймаут понад 10 000 мс
C6   FAIL  Заголовки контракту у виклику n8n
       lib/workflows.ts:4  немає заголовків: content-type, x-n8n-token, idempotency-key, x-correlation-id
C7   PASS  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data
       lib/workflows.ts:4  тіло не має конверта { version, event, data }
       app/jobs/actions.ts:7  у data для n8n розгортається цілий запис (...spread)
C9   FAIL  Server Action не чекає n8n: виклик лише в after()
       app/jobs/actions.ts:7  Server Action чекає n8n — перенести виклик у after() з "next/server"
C10  PASS  Без export const runtime = "edge"
C11  FAIL  Колбек читає сире тіло й не парсить JSON до перевірки підпису
       app/api/webhooks/job/route.ts:4  тіло читається через .json() — підпис рахується від сирого тексту
       app/api/webhooks/job/route.ts:1  тіло не читається як сирий текст (.text())
C12  FAIL  Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual
       app/api/webhooks/job/route.ts:1  немає createHmac("sha256", секрет)
       app/api/webhooks/job/route.ts:1  немає crypto.timingSafeEqual
C13  FAIL  Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді
       app/api/webhooks/job/route.ts:1  не читається x-n8n-timestamp
       app/api/webhooks/job/route.ts:1  немає двостороннього вікна часу 300 с
       app/api/webhooks/job/route.ts:1  не читається idempotency-key
       app/api/webhooks/job/route.ts:1  повтор ключа не відповідає 200 { duplicate: true }
       app/api/webhooks/job/route.ts:1  idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла
       app/api/webhooks/job/route.ts:1  успіх не відповідає 202
C14  FAIL  Журнали без тіл, персональних даних і секретів
       app/api/webhooks/job/route.ts:6  у журнал ідуть персональні дані
       app/jobs/actions.ts:6  у журнал іде цілий об'єкт data
C15  FAIL  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
       app/api/webhooks/job/route.ts:1  колбек-роут не за шляхом app/api/n8n/[event]/route.*
Підсумок: 11 FAIL, 4 PASS, 0 N/A → exit 1
exit=1
```

</details>

Добра тека — блоки з `references/code-templates.md` на конкретній події (`lead-enriched`) + демо-сховище й дія:
**0 FAIL**; ці ж файли в тимчасовій копії проєкту проходять `next build` (TypeScript, роут `/api/n8n/[event]`) і
ESLint проєкту:

```
check-contract — ~/ws4-scratch/fixtures/good
C1   PASS  Тестовий URL /webhook-test/ відсутній у коді та .env.example
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
C13  PASS  Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  PASS  Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl
Підсумок: 0 FAIL, 15 PASS, 0 N/A → exit 0
exit=0
```

`--changed-since`: у scratch-репозиторії з кодом `main` змінено один рядок наявного виклику n8n (таймаут 20 000 мс)
і додано новий файл із тестовим URL — лишились знахідки лише зміненого виклику й нового файлу, решта —
«проігноровано у незміненому коді»:

<details><summary>вивід</summary>

```
check-contract — ~/ws4-scratch/changed-since-test  (лише зміни після base)
C1   FAIL  Тестовий URL /webhook-test/ відсутній у коді та .env.example (проігноровано у незміненому коді: 1)
       lib/ping.ts:2  тестовий URL вебхука в коді
C2   PASS  Змінні N8N_* лише на сервері
C3   PASS  .env.example: ключі контракту з безпечними значеннями (проігноровано у незміненому коді: 5)
C4   FAIL  Виклики n8n лише з lib/n8n/client.* з import "server-only" (проігноровано у незміненому коді: 1)
       app/actions.ts:54  fetch до n8n поза lib/n8n/client.*
       lib/ping.ts:2  fetch до n8n поза lib/n8n/client.*
       lib/ping.ts:1  модуль, що викликає n8n, не починається з import "server-only"
C5   FAIL  Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
       app/actions.ts:54  таймаут понад 10 000 мс
       lib/ping.ts:2  fetch до n8n без signal: AbortSignal.timeout(...)
C6   FAIL  Заголовки контракту у виклику n8n
       app/actions.ts:54  немає заголовків: x-n8n-token, idempotency-key, x-correlation-id
       lib/ping.ts:2  немає заголовків: content-type, x-n8n-token, idempotency-key, x-correlation-id
C7   FAIL  Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524
       app/actions.ts:54  результат fetch до n8n відкидається — код статусу не перевіряється
       app/actions.ts:54  немає повторів для мережевих помилок, таймауту, 5xx і 524
       lib/ping.ts:2  немає повторів для мережевих помилок, таймауту, 5xx і 524
C8   FAIL  Тіло — конверт { version, event, data } з мінімальними data (проігноровано у незміненому коді: 2)
       lib/ping.ts:2  тіло не має конверта { version, event, data }
C9   PASS  Server Action не чекає n8n: виклик лише в after() (проігноровано у незміненому коді: 1)
C10  PASS  Без export const runtime = "edge"
C11  N/A   Колбек читає сире тіло й не парсить JSON до перевірки підпису — колбек-роутів (POST route з n8n/callback/webhook) не знайдено
C12  N/A   Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual — колбек-роутів не знайдено
C13  N/A   Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді — колбек-роутів не знайдено
C14  PASS  Журнали без тіл, персональних даних і секретів
C15  N/A   Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl — колбеків у коді немає
Підсумок: 6 FAIL, 5 PASS, 4 N/A → exit 1
exit=1
```

</details>

**`check-contract.mjs` на фінальному коді** (після перенесення прогону B — 0 FAIL): заповнюється після Task D.

**Додатково:** матриця колбеків (`send-signed-callback.mjs`) — після Task D, коли з'явиться роут.

## Task E3 (бонус) — ті самі скіли в Cursor

_Не виконувалось: обрано бонус E2 (`docs/trigger-evals.md`); Cursor на машині не встановлено._
