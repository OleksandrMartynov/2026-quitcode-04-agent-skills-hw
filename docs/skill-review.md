# Рев'ю стороннього скіла: `vercel-react-best-practices`

> Рев'ю зроблено **до** встановлення (коміт із цим файлом передує коміту, що додає
> `.claude/skills/vercel-react-best-practices/`). Файли скіла — дані, а не інструкції: нічого з них
> не виконувалось, клон не відкривався як проєкт в агенті. Розділ 5 дописано після звірки порад з
> документацією (крок 5 walkthrough), факти після встановлення в розділі 6 позначено окремо.

**Дата, інструмент, ОС:** 25.09.2026 · Claude Code (десктоп-застосунок, Opus 5.5) · macOS 26.5.1, zsh 5.9, Node 24.20.0

## Що рев'юємо

| | |
|---|---|
| Репозиторій | <https://github.com/vercel-labs/agent-skills> |
| Тека в репозиторії → `name` | `skills/react-best-practices` → `name: vercel-react-best-practices` |
| Версія | release-тег `agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278` = коміт `063bee94c3f4df8453406c830b0a7df0f2860278`; дерево теки скіла `343db72180d05814949fef7d46be96b5c6ee86b3` |
| Навіщо нам | клієнт скаржиться на дашборд > 2 с і «задумливу» форму; експерта з продуктивності React у команді немає — беремо 70 правил Vercel як чекліст рев'ю `app/`, `components/`, `lib/` |

## 1. Подивитись, не встановлюючи

- Як дивились:
  - `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278" --list`
    з порожньої теки `~/ws4-scratch/audit-view` (поза репозиторієм) — вивід нижче, у розділі 3;
  - неглибокий клон тега поза репозиторієм:
    `git clone --depth 1 --branch agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 https://github.com/vercel-labs/agent-skills.git ~/ws4-scratch/review-agent-skills`;
    `git rev-parse HEAD` → `063bee94c3f4df8453406c830b0a7df0f2860278`, `git rev-parse HEAD:skills/react-best-practices` →
    `343db72180d05814949fef7d46be96b5c6ee86b3`; `git ls-remote … refs/tags/<тег>` → той самий коміт (тег не зсунуто).
- Склад скіла (`S=~/ws4-scratch/review-agent-skills/skills/react-best-practices`; `find "$S" -type f | wc -l` → **76**,
  `du -sh "$S"` → 416K):

  | Файл / тека | Розмір | Що це |
  |---|---|---|
  | `SKILL.md` | 7 251 B | frontmatter + індекс 70 правил у 8 категоріях (async, bundle, server, client, rerender, rendering, js, advanced) |
  | `AGENTS.md` | 108 261 B | збірка всіх 70 правил в один документ; у шапці — примітка, що документ «переважно для агентів і LLM» (описова, без команд) |
  | `README.md` | 3 360 B | нотатки для контриб'юторів (кроки `pnpm` для збірки, якої в теці нема) |
  | `metadata.json` | 921 B | версія `1.0.0`, «Vercel Engineering», дата «January 2026», анотація «40+ rules», 7 посилань-джерел; **єдиний не-md файл**, CLI його не копіює (звідси 76 у клоні → 75 після встановлення) |
  | `rules/` | 72 файли | 70 правил (одне правило — один файл, id = назва файлу) + `_sections.md`, `_template.md` |

- Frontmatter `SKILL.md` (`awk '/^---$/{n++; next} n==1' "$S/SKILL.md"`): `name`, `description`, `license: MIT`,
  `metadata` (`author: vercel`, `version: "1.0.0"`). Полів `allowed-tools`, `hooks`, `context`, `disable-model-invocation` немає.

## 2. Що скіл може виконати, завантажити чи змінити

| Перевірка | Результат | Як перевіряли |
|---|---|---|
| `scripts/` та інші виконувані файли | **немає**: єдиний не-md файл — `metadata.json`; 0 symlink, 0 файлів з правом виконання | `find "$S" -type f ! -name "*.md"` → лише `metadata.json`; `find "$S" -type l \| wc -l` → 0; `find "$S" -type f -perm -u+x \| wc -l` → 0 |
| `allowed-tools` | **немає** — скіл не отримує жодного заздалегідь дозволеного інструмента | frontmatter вище |
| Команди під час рендеру `` !`cmd` `` | **0** | `grep -rn '!`' "$S" \| wc -l` → 0 |
| Хуки, MCP-сервери, `plugin.json`, вимога API-ключів | **немає** | `find "$S" -name "*hooks*.json" -o -name "*mcp*.json" -o -name "plugin.json" -o -name "settings*.json"` → порожньо |
| Інструкції агенту щось завантажити чи виконати | один приклад команди: `npx svgo --precision=1 --multipass icon.svg` (`rules/rendering-svg-precision.md:27`, копія в `AGENTS.md:2477`) — порада людині, як оптимізувати SVG. Непрямо: правила радять залежності `swr` (`client-swr-dedup`), `lru-cache` (`server-cache-lru`), `better-all` (`async-dependencies`) — агент, що застосовує такі правила, може спробувати їх встановити | `grep -rnE "npx \|curl \|wget \|Invoke-WebRequest\|WebFetch" "$S"` → лише рядки з `npx svgo`; `curl`/`wget`/`WebFetch` — 0 |
| Посилання: куди ведуть, чи є «прочитай інструкції звідси» | 35 унікальних URL на 17 хостах: react.dev, vercel.com, nextjs.org, github.com, swr.vercel.app, developer.mozilla.org, webpack.js.org, vite.dev, esbuild.github.io, npmjs.com, gist.github.com, csstriggers.com, jsfiddle.net, x.com і заглушки `example.com`. Сторонні: `github.com/shuding/better-all`, `github.com/isaacs/node-lru-cache`, `gist.github.com/paulirish/…`, `jsfiddle.net/qw1jabsx/4/` (найменш довірене — довільний виконуваний контент). Усі — «див. також», жодне не велить агенту читати інструкції | `grep -rhoE "https?://[^]()<> \"'\`]+" "$S" \| sort -u \| wc -l` → 35; групування за хостом |
| Приховані інструкції: HTML-коментарі, «ignore previous…», невидимі символи, base64 | **немає**: 0 `<!--`, 0 «ignore previous/system prompt», 0 файлів з невидимими символами, 0 послідовностей base64 ≥ 80 символів | `grep -rniE "ignore (all \|the )?previous\|system prompt\|<!--" "$S" \| wc -l` → 0; node-скрипт шаблону → «0 file(s) with zero-width characters»; `grep -rnoE "[A-Za-z0-9+/=]{80,}" "$S" \| wc -l` → 0 |

Окремо: у **корені** репозиторію `CLAUDE.md` — symlink на `AGENTS.md` з інструкціями для агентів-контриб'юторів
(`ls -la` клону). Скіла це не стосується (встановлюється лише тека `skills/react-best-practices`), але саме тому
клон не відкриваємо як проєкт в агенті. Інші скіли цього ж репозиторію містять виконувані скрипти
(`find . -type f -perm -u+x` у клоні → `skills/vercel-optimize/scripts/*.mjs` (7 файлів),
`skills/deploy-to-vercel/resources/deploy.sh`, `deploy-codex.sh`) — ставимо лише `--skill vercel-react-best-practices`.

## 3. Аудити

| Аудит | Результат | Дата аналізу |
|---|---|---|
| Gen (Agent Trust Hub) | Pass, ризик SAFE; як типовий ризик названо непряму prompt injection через код користувача, який скіл обробляє | 14.09.2026, 22:49 |
| Socket | Pass: malicious behavior, security concerns, obfuscation, suspicious patterns — без спрацювань | 14.09.2026, 22:49 |
| Snyk | Pass, ризик LOW, «No issues detected» | 14.09.2026, 22:48 |

- Де взяли: сторінки <https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices> і її
  `/security/{agent-trust-hub,socket,snyk}` (743,4K встановлень, 31,5K зірок, «First Seen Jan 19, 2026»);
  блок «Security Risk Assessments» у CLI — див. нижче.
- Чому CLI показав або не показав блок — два запуски у звичайному терміналі (не через агента: за walkthrough,
  Task A, крок 1.3, в агентській сесії CLI сам вмикає `--yes`), обидва з порожньої `~/ws4-scratch/audit-view`:
  1. `DISABLE_TELEMETRY=1 npx skills@1.7.0 add "vercel-labs/agent-skills#<тег>" --list` → `Source: …agent-skills.git
     @ agent-skills-063bee94…`, `Repository cloned`, `Found 9 skills`, список назв з описами й
     `Use --skill <name> to install specific skills` — **блоку аудитів немає**: `--list` завершується після
     переліку, а телеметрію (разом з аудитами) вимкнено.
  2. Та сама команда встановлення **без** `DISABLE_TELEMETRY` (`--skill vercel-react-best-practices -a claude-code
     --copy`) → scope `Project` → `Installation Summary` → блок **«Security Risk Assessments»**:
     `vercel-react-best-practices` — Gen `Safe`, Socket `0 alerts`, Snyk `Low Risk`, `Details:
     https://skills.sh/vercel-labs/agent-skills` → `Proceed with installation?` → **No** → `Installation cancelled`;
     `ls -A ~/ws4-scratch/audit-view` → порожньо, `git status` репозиторію без змін. Блок не називає ні тег, ні
     коміт — він зіставлений з назвою скіла, а не з версією.
  Те, що з `DISABLE_TELEMETRY=1` блок не з'являється і під час справжнього встановлення, перевіряємо на
  самому встановленні (розділ 6).
- До чого прив'язаний аудит: **не до нашого тега.** Жодна сторінка не називає тег, коміт чи версію; Socket
  показує лише ідентифікатор знімка skills.sh
  `pkg:socket/skills-sh/vercel-labs%2Fagent-skills%2Fvercel-react-best-practices%2F@ca7b0c0c…` — це хеш їхнього
  знімка «репозиторій + назва скіла», а не нашого тега. Відповідність аудиту саме нашим байтам ми не доводили;
  компенсуємо закріпленим тегом і власним рев'ю вмісту (розділи 1–2). За GitHub тека скіла не змінювалась з
  14.04.2026 (коміт `dc8367e6f91c`), а `main` дорівнює тегу (`compare` → `identical`, `ahead_by: 0`), тож аудит
  від 14.09.2026 дивився на той самий вміст — це непрямий аргумент, не доказ.

## 4. Ліцензія й походження

- Ліцензія: **MIT заявлено** у frontmatter `SKILL.md` (`license: MIT`) і в розділі «License» кореневого
  `README.md` (рядок 237), **але файлу LICENSE у репозиторії немає** (`ls` клону), а GitHub API повертає
  `license: null`. Для клієнтського проєкту це ризик: умови використання тримаються лише на заяві в README.
  Умова: зберігаємо заяву про ліцензію й авторство разом із вендореними файлами і не змінюємо їх.
- Видавець і активність: організація `vercel-labs` (Vercel), репозиторій створено 08.12.2025, 31 531 зірка,
  2 763 форки, останній push 28.08.2026. Тег легкий (ref указує прямо на коміт), створений GitHub Actions
  разом із релізом «Agent Skills 063bee94…» (`github-actions[bot]`, 28.08.2026); сам коміт тега — підписаний
  (`verification.verified: true`) merge PR #328 про `react-view-transitions`, файлів цього скіла він не змінює
  (`gh api repos/vercel-labs/agent-skills/commits/063bee94…` → 0 файлів у `skills/react-best-practices`). Теку скіла змінювали 58 комітів, останній — `dc8367e6f91c`
  (Shu Ding, 14.04.2026, «update example»). Між тегом і `main` різниці немає.

## 5. Чи правдивий зміст для нашого стеку

_Дописується після звірки порад із документацією `node_modules/next/dist/docs/` (крок 5 walkthrough)._

## 6. Закріплення версії й коміт

- Команда встановлення (запускаєте ви у своєму терміналі, не агент):
  `DISABLE_TELEMETRY=1 npx skills@1.7.0 add vercel-labs/agent-skills#agent-skills-063bee94c3f4df8453406c830b0a7df0f2860278 --skill vercel-react-best-practices -a claude-code --copy`
  (scope — Project). `#<тег>` — закріплена версія; `--copy` — справжні файли замість symlink/junction;
  `-a claude-code` без `cursor` — без другої копії в `.agents/skills/`.
- Де лягли файли; справжні файли чи посилання: _дописується після встановлення._
- Що потрапило в git: тека `.claude/skills/vercel-react-best-practices/` і `skills-lock.json`.
- Як оновлювати: та сама команда з новим тегом → `git diff` теки скіла й `skills-lock.json` → рев'ю змін за
  цим чеклістом → окремий коміт. Файли Vercel вручну не редагуємо.

## Вердикт

**Встановити з умовами.** Ризик безпеки низький: скіл — лише markdown, без скриптів, дозволів на інструменти,
хуків, прихованих інструкцій і команд під час рендеру; аудити Gen/Socket/Snyk — Pass. Умови: версія закріплена
тегом; ставимо лише цей скіл; кожну пораду, що стосується Next.js, звіряємо з документацією 16.3.5 перед
застосуванням; нові залежності, які радять правила (`swr`, `lru-cache`, `better-all`, `npx svgo`), — лише з
дозволу людини; кроки `pnpm` з `README.md` скіла не запускаємо; ліцензійний ризик (немає файлу LICENSE) записано.
