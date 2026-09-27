#!/usr/bin/env node
// Static check of a Next.js project against the team's Next.js <-> n8n contract (SKILL.md).
// Node built-ins only. Never prints env values, request bodies or string literals from the code.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

const HELP = `check-contract.mjs — статична перевірка коду на контракт Next.js <-> n8n

Використання:
  node check-contract.mjs [--root <тека>] [--changed-since <git-ref>]

  --root <тека>             що перевіряти (за замовчуванням — поточна тека)
  --changed-since <ref>     лише файли, змінені після <ref> (разом з новими, ще не доданими в git),
                            а в наявних файлах — лише знахідки на змінених рядках (git diff -U0 <ref>;
                            знахідка до виклику рахується, якщо змінено будь-який його рядок;
                            знахідка «чого бракує у файлі» — якщо файл змінено)
  -h, --help                ця довідка

Перевірки (деталі — SKILL.md і references/ цього скіла):
  C1  тестовий URL /webhook-test у коді чи .env.example
  C2  змінні N8N_* лише на сервері (NEXT_PUBLIC_, "use client", next.config env, секрет у query коду n8n,
      фолбек секрету, токен x-n8n-token літералом)
  C3  .env.example: ключі контракту, база на /webhook, секрети change-me-…, змінні з коду оголошено
  C4  виклики n8n лише з lib/n8n/client.* з import "server-only" першим рядком
  C5  кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000), сигнал створено в циклі повторів
  C6  заголовки content-type, x-n8n-token, idempotency-key, x-correlation-id; ключ не генерується
      в клієнті на кожен виклик і не збігається з correlation-id; x-n8n-token не з N8N_CALLBACK_SECRET
  C7  відповідь n8n оцінюється за кодом; ≤ 3 спроби; пауза між спробами; повтор лише для
      мережі/таймауту/5xx/524, не для 4xx: відповідь < 500 виходить із циклу (return/break/throw)
      і не виключає окремих 4xx; повтор через continue, рекурсію чи throw у try, який ковтає catch;
      цикл — навколо fetch або в обгортці з того ж файлу, напр. withRetry(() => fetch(…)))
  C8  тіло — JSON.stringify({ version, event, data }); data без усієї форми, цілих записів,
      IP, user agent, заголовків, сирих даних, секретів
  C9  Server Action (файл чи функція з "use server") не чекає n8n: виклик лише в after()
      (зокрема через функції того ж файлу й модулі, що імпортують клієнт n8n)
  C10 жодного runtime = "edge"
  C11 колбек читає сире тіло (.text()) і не парсить JSON (JSON.parse, req.json(), req.clone().json(),
      парсер із локального модуля) до timingSafeEqual (чи функції, що його викликає)
  C12 колбек: createHmac("sha256") з .update(\`\${timestamp}.\${raw}\`) саме в такому порядку; довжина тих
      самих буферів (чи рядків у Buffer.from), що йдуть у timingSafeEqual; без ===/!== на підписі чи
      digest; результат перевірки відхиляє запит (if (!…) return)
  C13 колбек: 404/415/413, вікно Math.abs(зараз − timestamp) ≤ 300 с (чи 300 000 мс), ключ лише із
      заголовка, claim ключа після перевірки підпису й до JSON.parse, звільнення ключа на шляху кожної
      відповіді 4xx/5xx після claim (у тому ж блоці, у finally чи в хелпері, через який повертають),
      duplicate з кодом 200, звірка ключа з jobId:event, 202, запис стану (db.<метод>, save/update/
      finish…) до відповіді: не лише в after() і не без await (void, .then/.catch)
      (ці пункти шукаються у файлі роуту, не в хелперах)
  C14 журнали без тіл (і їхніх частин: raw.slice, body.data, \${raw} у шаблоні), усіх заголовків
      запиту, персональних даних і секретів (err.message / err.name, Boolean(sig) — дозволено)
  C15 колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl

Як скрипт знаходить код n8n (евристики, не розбір TypeScript):
  - вихідний виклик — fetch, у чиєму URL є змінна середовища з N8N/WEBHOOK/WORKFLOW у назві або
    зі значенням у .env.example, що містить /webhook чи :5678, літерал з /webhook чи :5678, або
    const з файлу, що бере їх (один крок); інші HTTP-клієнти (axios, ky) не розпізнаються —
    тоді C4 падає, якщо в коді є інші ознаки n8n (lib/n8n/, x-n8n-token, callbackUrl);
  - URL, склеєний з частин ("…/webhook" + "-test"), і змінні NEXT_PUBLIC_* без N8N/WEBHOOK/
    CALLBACK_SECRET/WORKFLOW у назві скрипт не бачить;
  - модулі n8n — файли з таким fetch і ті, що імпортують їх (транзитивно); виклик імпортованої
    звідти функції — запуск воркфлоу;
  - URL у fetch може прийти параметром: тоді дивимось, що передають місця виклику функції;
  - колбек — POST у app/**/route.*, де шлях чи код згадує n8n, webhook, workflow, job(s), jobId,
    x-…-signature, x-…-timestamp, idempotency-key, createHmac чи timingSafeEqual, або на шлях якого
    вказує callbackUrl, зібраний у коді ("/api/…/\${id}/callback");
  - теки tools/, materials/, docs/, build/, out/, coverage/, fixtures/ пропускаються лише в корені.
  Скрипт не замінює рев'ю: він ловить типові порушення, а не доводить відповідність.

Результат: рядок на перевірку (PASS / FAIL / N/A), для FAIL — файл:рядок і причина. N/A — у коді немає
того, що перевіряє пункт (напр. колбек-роуту), з причиною; N/A не рахується як FAIL.
Код виходу: 0 — немає FAIL; 1 — є FAIL; 2 — помилка аргументів чи git.
`;

let args;
try {
  args = parseArgs({
    options: {
      root: { type: "string" },
      "changed-since": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
    allowPositionals: false,
  }).values;
} catch (error) {
  console.error(`check-contract: ${error.message}\nДовідка: node check-contract.mjs --help`);
  process.exit(2);
}
if (args.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

const ROOT = resolve(args.root ?? process.cwd());
if (!existsSync(ROOT) || !statSync(ROOT).isDirectory()) {
  console.error(`check-contract: тека не існує: ${ROOT}`);
  process.exit(2);
}

// ---------------------------------------------------------------- files

// skipped at any depth / only in the project root (e.g. app/tools/ is still checked)
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".claude", ".agents", ".cursor", ".codex", ".vercel", "__tests__", "__fixtures__"]);
const SKIP_ROOT_DIRS = new Set(["out", "build", "coverage", "tools", "materials", "docs", "fixtures"]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !(dir === ROOT && SKIP_ROOT_DIRS.has(entry.name))) walk(join(dir, entry.name), out);
    } else if (entry.isFile() && CODE_EXT.test(entry.name) && !entry.name.endsWith(".d.ts")
      && !/\.(test|spec)\.[a-z]+$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

const rel = (abs) => relative(ROOT, abs).split(sep).join("/");

// Two views of every file, same length and line breaks as the source:
//   code  — comments blanked, strings kept
//   blank — comments and string/template text blanked (the delimiters and ${…} expressions kept)
function views(src) {
  const code = src.split("");
  const blank = src.split("");
  const n = src.length;
  let i = 0;
  let lastSig = "";
  const templateStack = [];
  const space = (arr, from, to) => { for (let k = from; k < to; k++) if (arr[k] !== "\n") arr[k] = " "; };
  const regexAllowed = () => lastSig === "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(lastSig)
    || /\b(return|typeof|case|do|else|in|of|void|yield|await)$/.test(lastSig);
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "/") {
      let j = i; while (j < n && src[j] !== "\n") j++;
      space(code, i, j); space(blank, i, j); i = j; continue;
    }
    if (c === "/" && next === "*") {
      let j = src.indexOf("*/", i + 2); j = j === -1 ? n : j + 2;
      space(code, i, j); space(blank, i, j); i = j; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      space(blank, i + 1, Math.min(j, n)); i = Math.min(j + 1, n); lastSig = "x"; continue;
    }
    if (c === "`" || (c === "}" && templateStack.length && templateStack[templateStack.length - 1] === 0)) {
      if (c === "}") templateStack.pop();
      let j = i + 1;
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "`") break;
        if (src[j] === "$" && src[j + 1] === "{") break;
        j++;
      }
      space(blank, i + 1, Math.min(j, n));
      if (src[j] === "$") { templateStack.push(0); i = j + 2; lastSig = "{"; }
      else { i = Math.min(j + 1, n); lastSig = "x"; }
      continue;
    }
    if (c === "{" && templateStack.length) templateStack[templateStack.length - 1]++;
    if (c === "}" && templateStack.length && templateStack[templateStack.length - 1] > 0) templateStack[templateStack.length - 1]--;
    if (c === "/" && regexAllowed()) {
      let j = i + 1; let inClass = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === "[") inClass = true; else if (src[j] === "]") inClass = false;
        else if (src[j] === "/" && !inClass) break;
        j++;
      }
      space(blank, i + 1, Math.min(j, n)); i = Math.min(j + 1, n); lastSig = "x"; continue;
    }
    if (!/\s/.test(c)) {
      if (/[A-Za-z0-9_$]/.test(c)) {
        let j = i; while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
        lastSig = src.slice(i, j); i = j; continue;
      }
      lastSig = c;
    }
    i++;
  }
  return { code: code.join(""), blank: blank.join("") };
}

function loadFile(abs) {
  const src = readFileSync(abs, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const { code, blank } = views(src);
  const lineStarts = [0];
  for (let k = 0; k < src.length; k++) if (src[k] === "\n") lineStarts.push(k + 1);
  const lineOf = (idx) => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1; }
    return lo + 1;
  };
  return { abs, path: rel(abs), src, code, blank, lineOf };
}

// index of the bracket that closes the one at `open` (in the blank view)
function closeOf(text, open) {
  const pairs = { "(": ")", "{": "}", "[": "]" };
  const want = pairs[text[open]];
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const ch = text[k];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") { depth--; if (depth === 0) return ch === want ? k : -1; }
  }
  return -1;
}

// top-level argument spans of a call whose "(" is at `open`
function argSpans(text, open) {
  const close = closeOf(text, open);
  if (close === -1) return [];
  const spans = []; let depth = 0; let start = open + 1;
  for (let k = open + 1; k < close; k++) {
    const ch = text[k];
    if ("({[".includes(ch)) depth++;
    else if (")}]".includes(ch)) depth--;
    else if (ch === "," && depth === 0) { spans.push([start, k]); start = k + 1; }
  }
  if (text.slice(start, close).trim()) spans.push([start, close]);
  return spans;
}

function callsOf(file, nameRe) {
  const out = [];
  const re = new RegExp(`(?<![\\w$.])(?:${nameRe})\\s*\\(`, "g");
  for (const m of file.blank.matchAll(re)) {
    if (/function\s*\*?\s*$/.test(file.blank.slice(Math.max(0, m.index - 12), m.index))) continue; // a definition, not a call
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, open, close: closeOf(file.blank, open), args: argSpans(file.blank, open) });
  }
  return out;
}

function firstStatement(file) {
  const m = file.code.match(/^\s*(["'])(use (?:client|server))\1/);
  return m ? m[2] : null;
}

// end of the expression that starts at `from` (a statement end: `;`, or a line break at depth 0
// that does not continue the expression)
function exprEnd(text, from) {
  let depth = 0;
  for (let k = from; k < text.length; k++) {
    const ch = text[k];
    if ("({[".includes(ch)) depth++;
    else if (")}]".includes(ch)) { if (depth === 0) return k; depth--; }
    else if (depth === 0 && (ch === ";" || ch === ",")) return k;
    else if (depth === 0 && ch === "\n") {
      const before = text.slice(from, k).trimEnd();
      const after = text.slice(k + 1).trimStart();
      if (!/[=+\-*/%&|?:,(<>!]$/.test(before) && !/^[.?:+\-*/%&|]/.test(after)) return k;
    }
  }
  return text.length;
}

// initialiser of `const|let|var NAME (: Type)? = …` in a file (the last one before `beforeIdx`, if given)
function definitionOf(file, name, beforeIdx = Infinity) {
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return null;
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, "\\$")}\\s*(?::[^=;\\n]+)?=(?!=|>)\\s*`, "g");
  let found = null;
  for (const m of file.blank.matchAll(re)) {
    if (m.index > beforeIdx) break;
    const start = m.index + m[0].length;
    found = { start, end: exprEnd(file.blank, start), declIdx: m.index };
  }
  if (!found) return null;
  return { ...found, text: file.code.slice(found.start, found.end).trim() };
}

// body span of a function called NAME in the file (declaration or const arrow / function expression)
function functionBody(file, name) {
  const decl = new RegExp(`function\\s+${name}\\s*\\(`).exec(file.blank);
  if (decl) {
    const headClose = closeOf(file.blank, decl.index + decl[0].length - 1);
    const brace = file.blank.indexOf("{", headClose);
    if (brace !== -1) return { start: brace, end: closeOf(file.blank, brace) };
  }
  const def = definitionOf(file, name);
  if (def) {
    const arrow = file.blank.slice(def.start, def.end).search(/=>\s*\{|function\s*\([^)]*\)\s*\{/);
    if (arrow !== -1) {
      const brace = file.blank.indexOf("{", def.start + arrow);
      return { start: brace, end: closeOf(file.blank, brace) };
    }
    return { start: def.start, end: def.end }; // expression-bodied arrow
  }
  return null;
}

// numeric value of an expression: literals with _, + - * /, parentheses, const names, ARR.length
function evalNum(file, expr, depth = 0) {
  if (depth > 4 || expr == null) return null;
  let text = String(expr).trim().replace(/\s+as\s+const$/, "").replace(/(\d)_(?=\d)/g, "$1");
  if (!text) return null;
  text = text.replace(/(?<![\w$.])[A-Za-z_$][\w$]*(\.length)?/g, (id, len) => {
    if (len) { const n = arrayLength(file, id.slice(0, -len.length), depth + 1); return n === null ? "NaN" : String(n); }
    let def = definitionOf(file, id), home = file;
    if (!def) { // a const imported from a local module
      const imp = importClauses(file).find((i) => i.target && i.names.includes(id));
      if (imp) { def = definitionOf(imp.target, id); home = imp.target; }
    }
    const v = def ? evalNum(home, def.text, depth + 1) : null;
    return v === null ? "NaN" : String(v);
  });
  if (!/^[\d\s+\-*/().]+$/.test(text) || /NaN/.test(text)) return null;
  return arithmetic(text);
}

// + - * / and parentheses over plain numbers; null if the text is anything else
function arithmetic(text) {
  const tokens = text.match(/\d+(?:\.\d+)?|[-+*/()]/g) ?? [];
  if (tokens.join("") !== text.replace(/\s+/g, "")) return null;
  let pos = 0;
  const primary = () => {
    const t = tokens[pos++];
    if (t === "(") { const v = sum(); return tokens[pos++] === ")" ? v : NaN; }
    if (t === "-") return -primary();
    return t !== undefined && /^\d/.test(t) ? Number(t) : NaN;
  };
  const product = () => { let v = primary(); while (tokens[pos] === "*" || tokens[pos] === "/") v = tokens[pos++] === "*" ? v * primary() : v / primary(); return v; };
  const sum = () => { let v = product(); while (tokens[pos] === "+" || tokens[pos] === "-") v = tokens[pos++] === "+" ? v + product() : v - product(); return v; };
  const value = sum();
  return pos === tokens.length && Number.isFinite(value) ? value : null;
}

// value text of the first `name:` property (or `name` shorthand -> the name itself) in an object text
function propValue(text, name) {
  const m = new RegExp(`(?<![\\w$.])${name}\\s*:\\s*`).exec(text);
  if (m) { const start = m.index + m[0].length; return text.slice(start, exprEnd(text, start)).trim(); }
  return new RegExp(`(?<![\\w$.:])${name}\\s*[,}]`).test(text) ? name : null;
}

function arrayLength(file, exprOrName, depth = 0) {
  const text = String(exprOrName).trim();
  if (text.startsWith("[")) {
    const close = closeOf(text, 0);
    if (close === -1) return null;
    return text.slice(1, close).split(",").filter((x) => x.trim()).length;
  }
  const def = definitionOf(file, text);
  return def && depth < 4 ? arrayLength(file, def.text, depth + 1) : null;
}

const files = walk(ROOT).map(loadFile);
const byPath = new Map(files.map((f) => [f.path, f]));
const envExamplePath = join(ROOT, ".env.example");
const envExample = existsSync(envExamplePath)
  ? readFileSync(envExamplePath, "utf8").replace(/\r\n/g, "\n").split("\n")
  : null;
const envValues = new Map();
envExample?.forEach((l) => {
  const m = l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) envValues.set(m[1], m[2].trim().replace(/^["']|["']$/g, ""));
});

// ---------------------------------------------------------------- facts

const ENV_RE = /process\.env(?:\.([A-Z0-9_]+)|\[\s*["'`]([A-Z0-9_]+)["'`]\s*\])/g;
const N8N_ENV = /N8N|WEBHOOK|WORKFLOW/;
const envLooksN8n = (name) => N8N_ENV.test(name) || /\/webhook|:5678/.test(envValues.get(name) ?? "");
const N8N_LITERAL = /\/webhook(-test)?\b|:5678|n8n/i;

function envReads(file) {
  const out = [];
  for (const m of file.code.matchAll(ENV_RE)) out.push({ name: m[1] ?? m[2], index: m.index });
  return out;
}

function mentionsN8n(file, text, depth = 0) {
  if (N8N_LITERAL.test(text)) return true;
  for (const m of text.matchAll(ENV_RE)) if (envLooksN8n(m[1] ?? m[2])) return true;
  if (depth >= 2) return false;
  for (const id of new Set(text.replace(/(["'])(?:\\.|(?!\1).)*\1/g, "").match(/(?<![\w$.])[A-Za-z_$][\w$]*/g) ?? [])) {
    const def = definitionOf(file, id);
    if (def && mentionsN8n(file, def.text, depth + 1)) return true;
  }
  return false;
}

// outgoing n8n fetch calls (see HELP: "Як скрипт знаходить код n8n")
function n8nFetches(file) {
  const readsN8n = envReads(file).some((r) => envLooksN8n(r.name));
  return callsOf(file, "fetch").filter((call) => {
    if (!call.args.length) return false;
    const firstCode = file.code.slice(...call.args[0]);
    if (mentionsN8n(file, firstCode)) return true;
    const literalRelative = /^\s*["'`]\//.test(firstCode);
    if (readsN8n && !literalRelative) return true;
    return urlFromCallers(file, call, firstCode);
  });
}

// fetch(url) where url is a parameter (or its property): look at what the callers pass —
// e.g. dispatch(record, { webhookUrl }) with webhookUrl = process.env.N8N_<EVENT>_WEBHOOK_URL in the caller
function urlFromCallers(file, call, firstCode) {
  const root = firstCode.trim().match(/^([A-Za-z_$][\w$]*)(?:\.[\w$]+)*$/)?.[1];
  if (!root || definitionOf(file, root, call.start)) return false;
  const fn = enclosingFunctionStart(file, call.start);
  if (!fn?.name) return false;
  return files.some((caller) => callsOf(caller, fn.name).some((c) => {
    if (caller === file && c.start > fn.brace && c.start < fn.end) return false;
    return c.args.some(([a, b]) => mentionsN8n(caller, caller.code.slice(a, b)));
  }));
}

const fetchSites = files.flatMap((f) => n8nFetches(f).map((call) => ({ file: f, call })));
const clientFiles = [...new Set(fetchSites.map((s) => s.file))];

function resolveImport(file, spec) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = relative(ROOT, resolve(dirname(file.abs), spec)).split(sep).join("/");
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`]) {
    if (byPath.has(cand)) return byPath.get(cand);
  }
  return null;
}

function importClauses(file) {
  const out = [];
  for (const m of file.code.matchAll(/import\s+(?!type\b)([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    const clause = m[1];
    const names = [];
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) for (const part of braces[1].split(",")) {
      const p = part.trim();
      if (!p || p.startsWith("type ")) continue;
      const alias = p.split(/\s+as\s+/);
      names.push((alias[1] ?? alias[0]).trim());
    }
    const def = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, " ").trim().split(/\s+/)[0];
    if (def && def !== "*" && !def.startsWith("{")) names.push(def);
    const ns = clause.match(/\*\s+as\s+(\w+)/);
    if (ns) names.push(`${ns[1]}\\.\\w+`);
    out.push({ spec: m[2], target: resolveImport(file, m[2]), names: names.filter(Boolean), index: m.index });
  }
  return out;
}

// trigger functions: functions of a module whose body reaches the n8n fetch — directly, through another
// trigger of the same module, or through a trigger imported from another module (memoised, cycle-safe)
const triggerMemo = new Map();
function declaredFunctions(file) {
  const names = new Set();
  for (const m of file.blank.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of file.blank.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]+)?=>/g)) names.add(m[1]);
  return [...names];
}
function moduleTriggers(file) {
  if (triggerMemo.has(file)) return triggerMemo.get(file);
  const result = new Set();
  triggerMemo.set(file, result); // cycle guard
  const fetches = n8nFetches(file).map((c) => c.start);
  const imported = [];
  for (const imp of importClauses(file)) {
    if (!imp.names.length) continue;
    if (imp.target) { const t = moduleTriggers(imp.target); imported.push(...imp.names.filter((n) => t.has(n) || /\\\.\\w\+$/.test(n))); }
    else if (isN8nClientPath(imp.spec)) imported.push(...imp.names);
  }
  const importedCalls = imported.length ? callsOf(file, imported.join("|")).map((c) => c.start) : [];
  const fns = declaredFunctions(file).map((name) => ({ name, body: functionBody(file, name) })).filter((x) => x.body);
  for (let grew = true; grew;) {
    grew = false;
    const localCalls = result.size ? callsOf(file, [...result].join("|")).map((c) => c.start) : [];
    for (const { name, body } of fns) {
      if (result.has(name)) continue;
      const inside = (i) => i > body.start && i < body.end;
      if (fetches.some(inside) || importedCalls.some(inside) || localCalls.some(inside)) { result.add(name); grew = true; }
    }
  }
  return result;
}
const isN8nClientPath = (spec) => /n8n[/-]?client|webhook|workflow/i.test(spec);
// names imported into `file` that start an n8n workflow
function triggerImports(file) {
  const out = [];
  for (const imp of importClauses(file)) {
    if (!imp.names.length) continue;
    const names = imp.target ? imp.names.filter((n) => moduleTriggers(imp.target).has(n)) : (isN8nClientPath(imp.spec) ? imp.names : []);
    if (names.length) out.push({ ...imp, names });
  }
  return out;
}
// n8n modules: files with an n8n fetch, plus files that call a trigger function of another module
const n8nModules = new Set(clientFiles);
for (const f of files) {
  if (firstStatement(f) === "use client") continue;
  if (triggerImports(f).some((imp) => callsOf(f, imp.names.join("|")).length)) n8nModules.add(f);
}

function importsFromN8n(file) {
  return triggerImports(file);
}

// all n8n trigger sites: direct fetches + calls of trigger functions imported from other modules
// (kind "client" — the imported module itself fetches n8n, so its arguments are the data sent)
function triggerSites(file) {
  const sites = n8nFetches(file).map((call) => ({ call, kind: "fetch" }));
  for (const imp of importsFromN8n(file)) {
    const kind = !imp.target || clientFiles.includes(imp.target) ? "client" : "import";
    for (const call of callsOf(file, imp.names.join("|"))) sites.push({ call, kind });
  }
  return sites;
}

function isRouteFile(f) { return /(^|\/)app\/(.*\/)?route\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path); }
function exportsPost(f) {
  return /export\s+(async\s+)?function\s+POST\b|export\s+const\s+POST\b|export\s*\{[^}]*\bPOST\b[^}]*\}/.test(f.code);
}
const CALLBACK_HINT = /n8n|webhook|workflow|\bjobs?\b|jobId|job_id|x-[\w-]*signature|x-[\w-]*timestamp|idempotency-key|createHmac|timingSafeEqual/i;
// routes that a callbackUrl built next to the n8n call points at: "/api/<things>/${id}/callback" -> app/api/<things>/[id]/callback
const callbackPaths = files.filter((f) => /\bcallbackUrl\b/.test(f.code)).flatMap((f) =>
  [...f.code.matchAll(/["'\x60](\/api\/[^"'\x60\s]*)["'\x60]/g)].map((m) =>
    new RegExp(`(^|/)app${m[1].split(/\$\{[^}]*\}/).map((x) => x.replace(/[.*+?^()|[\]\\]/g, "\\$&")).join("[^/]+")}/route\\.[jt]sx?$`)));
const callbackRoutes = files.filter((f) => isRouteFile(f) && exportsPost(f)
  && (CALLBACK_HINT.test(f.path) || CALLBACK_HINT.test(f.code) || callbackPaths.some((re) => re.test(f.path.replace(/\/\([^)]*\)/g, "")))));

// route + its local imports (one hop) for checks that may live in helpers
function withHelpers(route) {
  const out = [route];
  for (const imp of importClauses(route)) if (imp.target && !out.includes(imp.target)) out.push(imp.target);
  return out;
}

// ---------------------------------------------------------------- findings

const results = [];
function check(id, title, fn) {
  const findings = [];
  const add = (file, line, reason, scope = "line", endLine = line) => findings.push({ file, line, reason, scope, endLine });
  const na = fn(add);
  results.push({ id, title, findings, na: typeof na === "string" ? na : null });
}

const callEnd = (file, call) => file.lineOf(call.close === -1 ? call.start : call.close);
const atCall = (add, file, call, reason) => add(file.path, file.lineOf(call.start), reason, "line", callEnd(file, call));

// C1
check("C1", "Тестовий URL /webhook-test відсутній у коді та .env.example", (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/\/webhook-test\b/g)) add(f.path, f.lineOf(m.index), "тестовий URL вебхука в коді");
  }
  envExample?.forEach((l, k) => {
    if (!l.trim().startsWith("#") && /webhook-test/.test(l)) add(".env.example", k + 1, `ключ ${l.split("=")[0].trim()} містить /webhook-test`);
  });
});

// C2
check("C2", "Змінні N8N_* лише на сервері", (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/NEXT_PUBLIC_\w*(?:N8N|WEBHOOK|CALLBACK_SECRET|WORKFLOW)\w*/g)) add(f.path, f.lineOf(m.index), "змінна NEXT_PUBLIC_* для n8n потрапить у клієнтський бандл");
    if (firstStatement(f) === "use client") {
      for (const r of envReads(f)) if (envLooksN8n(r.name)) add(f.path, f.lineOf(r.index), `"use client"-модуль читає process.env.${r.name}`);
      for (const imp of importClauses(f)) {
        if (imp.target && firstStatement(imp.target) === "use server") continue; // Server Action import is fine
        if (!imp.names.length) continue; // only `type` imports — erased at build time
        if (/(^|[/@])n8n(\/|$)/.test(imp.spec) || (imp.target && n8nModules.has(imp.target))) add(f.path, f.lineOf(imp.index), `"use client"-модуль імпортує ${imp.spec}`);
      }
    }
    if (/(^|\/)next\.config\.[a-z]+$/.test(f.path) && /\benv\s*:\s*\{[\s\S]*?N8N_/.test(f.code)) add(f.path, 1, "next.config env вбудовує N8N_* у клієнт");
    const n8nCode = n8nModules.has(f) || callbackRoutes.includes(f);
    for (const m of f.code.matchAll(/[?&](token|secret|signature|sig)=/gi)) {
      const line = f.code.slice(f.code.lastIndexOf("\n", m.index) + 1, f.code.indexOf("\n", m.index) >>> 0);
      if (n8nCode || /webhook|n8n/i.test(line)) add(f.path, f.lineOf(m.index), `секрет у query string (${m[1]}=)`);
    }
    for (const m of f.code.matchAll(/["']x-n8n-token["']\s*:\s*["'`]/gi)) add(f.path, f.lineOf(m.index), "токен x-n8n-token — літерал у коді (справжній секрет у git)");
    for (const m of f.code.matchAll(/process\.env\.(N8N_WEBHOOK_TOKEN|N8N_CALLBACK_SECRET)\s*(\?\?|\|\|)\s*(["'`])/g)) {
      add(f.path, f.lineOf(m.index), `літеральний фолбек для ${m[1]}`);
    }
  }
  envExample?.forEach((l, k) => { if (/^\s*(export\s+)?NEXT_PUBLIC_\w*(N8N|WEBHOOK|CALLBACK_SECRET|WORKFLOW)/.test(l)) add(".env.example", k + 1, "ключ NEXT_PUBLIC_* для n8n"); });
});

// C3
const CONTRACT_KEYS = ["N8N_WEBHOOK_BASE_URL", "N8N_WEBHOOK_TOKEN", "N8N_CALLBACK_SECRET", "APP_BASE_URL"];
check("C3", ".env.example: ключі контракту з безпечними значеннями", (add) => {
  if (!envExample) { add(".env.example", 1, "файлу .env.example немає", "file"); return; }
  const kv = new Map();
  envExample.forEach((l, k) => {
    const m = l.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) return;
    let value = m[2].trim();
    if (/^["'].*["']$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    kv.set(m[1], { value, line: k + 1 });
  });
  for (const key of CONTRACT_KEYS) if (!kv.has(key)) add(".env.example", 1, `немає ключа ${key}`, "file");
  const base = kv.get("N8N_WEBHOOK_BASE_URL");
  if (base && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/webhook$/.test(base.value)) add(".env.example", base.line, "N8N_WEBHOOK_BASE_URL має бути локальною адресою, що закінчується на /webhook");
  const app = kv.get("APP_BASE_URL");
  if (app && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(app.value)) add(".env.example", app.line, "APP_BASE_URL має бути локальним origin без шляху");
  for (const [key, { value, line }] of kv) {
    if (/(TOKEN|SECRET|PASSWORD|API_?KEY|PRIVATE)/.test(key) && !value.startsWith("change-me-")) add(".env.example", line, `значення ${key} не change-me-…`);
    if (/^N8N_/.test(key) && !CONTRACT_KEYS.includes(key)) add(".env.example", line, `ключ ${key} поза контрактом`);
  }
  const declared = new Set(kv.keys());
  for (const f of files) for (const r of envReads(f)) {
    if ((/^N8N_/.test(r.name) || r.name === "APP_BASE_URL") && !declared.has(r.name)) add(f.path, f.lineOf(r.index), `код читає ${r.name}, якого немає в .env.example`);
  }
});

// C4
check("C4", 'Виклики n8n лише з lib/n8n/client.* з import "server-only"', (add) => {
  if (!fetchSites.length) {
    const hint = files.find((f) => /(^|\/)lib\/n8n\//.test(f.path) || /x-n8n-token|\bcallbackUrl\b/i.test(f.code));
    if (hint) { add(hint.path, 1, "є ознаки інтеграції n8n, але виклику fetch до n8n не розпізнано — перевірте вручну (лише fetch, URL з N8N_WEBHOOK_BASE_URL)", "file"); return; }
    return "викликів n8n у коді не знайдено";
  }
  for (const { file, call } of fetchSites) {
    if (!/(^|\/)lib\/n8n\/client\.(ts|mts|js|mjs)$/.test(file.path)) atCall(add, file, call, "fetch до n8n поза lib/n8n/client.*");
  }
  for (const f of clientFiles) {
    if (!/^\s*import\s+(["'])server-only\1/.test(f.code)) add(f.path, 1, 'модуль, що викликає n8n, не починається з import "server-only"', "file");
  }
});

// options object of a fetch call: the literal, or the initialiser of the identifier passed as `init`
function fetchOptions(file, call) {
  if (!call.args[1]) return { text: "", start: call.start };
  const [a, b] = call.args[1];
  const text = file.code.slice(a, b).trim();
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    const def = definitionOf(file, text, call.start);
    if (def) return { text: def.text, start: def.start, viaIdent: true };
  }
  return { text, start: a };
}

// the loop around a call: for (…) / while (…) / do { } while (…), with a braced body
function enclosingLoop(file, idx) {
  let best = null;
  const consider = (loop) => { if (loop.bodyStart < idx && idx < loop.bodyEnd && (!best || loop.bodyStart > best.bodyStart)) best = loop; };
  for (const m of file.blank.matchAll(/\b(for|while)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const headClose = closeOf(file.blank, open);
    if (headClose === -1) continue;
    const bodyStart = file.blank.slice(headClose + 1).search(/\S/) + headClose + 1;
    if (file.blank[bodyStart] !== "{") continue;
    consider({ kind: m[1], head: file.code.slice(open + 1, headClose), start: m.index, bodyStart, bodyEnd: closeOf(file.blank, bodyStart) });
  }
  for (const m of file.blank.matchAll(/\bdo\s*\{/g)) {
    const bodyStart = m.index + m[0].length - 1;
    const bodyEnd = closeOf(file.blank, bodyStart);
    const tail = /^\s*while\s*\(/.exec(file.blank.slice(bodyEnd + 1));
    if (!tail) continue;
    const open = bodyEnd + 1 + tail[0].length - 1;
    consider({ kind: "while", head: file.code.slice(open + 1, closeOf(file.blank, open)), start: m.index, bodyStart, bodyEnd });
  }
  return best;
}

function enclosingFunctionStart(f, idx) {
  let best = null;
  for (const m of f.blank.matchAll(/function\s*\*?\s*([\w$]*)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const headClose = closeOf(f.blank, open);
    const brace = f.blank.indexOf("{", headClose);
    const end = closeOf(f.blank, brace);
    if (brace < idx && idx < end && (!best || brace > best.brace)) best = { name: m[1], brace, end };
  }
  for (const m of f.blank.matchAll(/(?:const|let|var)\s+([\w$]+)\s*(?::[^=;\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]+)?=>\s*\{/g)) {
    const brace = m.index + m[0].length - 1;
    const end = closeOf(f.blank, brace);
    if (brace < idx && idx < end && (!best || brace > best.brace)) best = { name: m[1], brace, end };
  }
  return best;
}

// C5
check("C5", "Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const opts = fetchOptions(file, call);
    let timeout = opts.text.match(/AbortSignal\.timeout\(\s*([^)]*)\)/);
    let signalDefIdx = null;
    if (!timeout) {
      const id = opts.text.match(/\bsignal\s*:\s*([A-Za-z_$][\w$]*)/) ?? (/\bsignal\b(?!\s*:)/.test(opts.text) ? [null, "signal"] : null);
      const def = id ? definitionOf(file, id[1], call.start) : null;
      if (def) {
        timeout = def.text.match(/AbortSignal\.timeout\(\s*([^)]*)\)/);
        signalDefIdx = def.declIdx;
      }
    }
    if (!timeout) { atCall(add, file, call, "fetch до n8n без signal: AbortSignal.timeout(...)"); continue; }
    const ms = evalNum(file, timeout[1]);
    if (ms === null) atCall(add, file, call, "значення таймауту не розпізнано (очікується число чи const ≤ 10 000)");
    else if (ms > 10_000) atCall(add, file, call, `таймаут ${ms} мс — понад 10 000`);
    if (signalDefIdx !== null || opts.viaIdent) {
      const loop = enclosingLoop(file, call.start);
      const defIdx = signalDefIdx ?? file.code.lastIndexOf("AbortSignal.timeout", call.start);
      if (loop && (defIdx < loop.bodyStart || defIdx > loop.bodyEnd)) add(file.path, file.lineOf(defIdx), "сигнал таймауту створено поза циклом повторів — наступні спроби без таймауту");
    }
  }
});

// C6
const HEADER_NAMES = ["content-type", "x-n8n-token", "idempotency-key", "x-correlation-id"];
const UUID_CALL = /\b(?:crypto\.)?(randomUUID|uuid|uuidv4|v4|nanoid)\s*\(|Date\.now\s*\(/;
check("C6", "Заголовки контракту у виклику n8n", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const opts = fetchOptions(file, call);
    let headersText = opts.text;
    const hid = propValue(opts.text, "headers");
    if (hid && /^[A-Za-z_$][\w$]*$/.test(hid)) headersText += definitionOf(file, hid, call.start)?.text ?? "";
    const hfn = hid?.match(/^([A-Za-z_$][\w$]*)\s*\(/);
    if (hfn) { const body = functionBody(file, hfn[1]); if (body) headersText += file.code.slice(body.start, body.end + 1); }
    const lower = headersText.toLowerCase();
    const missing = HEADER_NAMES.filter((h) => !lower.includes(`"${h}"`) && !lower.includes(`'${h}'`));
    if (missing.length) atCall(add, file, call, `немає заголовків: ${missing.join(", ")}`);
    const value = (h) => headersText.match(new RegExp(`["']${h}["']\\s*:\\s*([^,}\\n]+)`, "i"))?.[1].trim();
    const key = value("idempotency-key");
    const corr = value("x-correlation-id");
    if (key) {
      const fn = enclosingFunctionStart(file, call.start);
      const keyDef = /^[A-Za-z_$][\w$]*$/.test(key) ? definitionOf(file, key, call.start) : null;
      const generated = UUID_CALL.test(key) || (keyDef && UUID_CALL.test(keyDef.text) && (!fn || (keyDef.declIdx > fn.brace && keyDef.declIdx < fn.end)));
      if (generated) atCall(add, file, call, "idempotency-key генерується в клієнті на кожен виклик — має приходити з бізнес-операції (збережений із записом)");
      if (corr && corr === key) atCall(add, file, call, "x-correlation-id збігається з idempotency-key — це різні ідентифікатори");
    }
    const tok = value("x-n8n-token");
    const tokText = tok && /^[A-Za-z_$][\w$]*$/.test(tok) ? (definitionOf(file, tok, call.start)?.text ?? tok) : tok ?? "";
    if (/CALLBACK_SECRET/.test(tokText)) atCall(add, file, call, "x-n8n-token бере N8N_CALLBACK_SECRET — це різні секрети (токен — N8N_WEBHOOK_TOKEN)");
  }
});

// C7
function attemptsOf(file, loop) {
  const head = loop.head.trim();
  let m = head.match(/^(?:let|var)\s+([\w$]+)\s*=\s*([^;]+);\s*\1\s*(<=|<)\s*([^;]+);/);
  if (m) {
    const from = evalNum(file, m[2]); const to = evalNum(file, m[4]);
    return from === null || to === null ? null : (m[3] === "<=" ? to - from + 1 : to - from);
  }
  m = head.match(/^(?:const|let|var)\s+[\w$[\]{},\s]+\s+of\s+([\s\S]+)$/);
  if (m) return arrayLength(file, m[1].trim());
  m = head.match(/^(\+\+|--)?([\w$]+)(\+\+|--)?\s*(<=|<)\s*([\s\S]+)$/);
  if (m) {
    const def = definitionOf(file, m[2], loop.start);
    const from = def ? evalNum(file, def.text) : null; const to = evalNum(file, m[5]);
    if (from === null || to === null) return null;
    let n = m[4] === "<=" ? to - from + 1 : to - from;
    if (m[1] === "++") n -= 1;
    return n;
  }
  return null;
}

// `if (COND) STATEMENT` pairs inside [from, to)
function ifStatements(file, from, to) {
  const out = [];
  for (const m of file.blank.slice(from, to).matchAll(/\bif\s*\(/g)) {
    const open = from + m.index + m[0].length - 1;
    const close = closeOf(file.blank, open);
    if (close === -1) continue;
    const s = file.blank.slice(close + 1).search(/\S/) + close + 1;
    const end = file.blank[s] === "{" ? closeOf(file.blank, s) : exprEnd(file.blank, s);
    out.push({ at: from + m.index, end, cond: file.code.slice(open + 1, close), stmt: file.code.slice(s, end + 1) });
  }
  return out;
}

// attempts of a `while (true)` / unresolved loop from its guard: `ARR[attempt - 1] === undefined -> return`
// (array of pauses: length + 1 attempts) or `if (attempt >= N) return|break|throw`
function attemptsFromGuard(file, loop) {
  const body = file.code.slice(loop.bodyStart, loop.bodyEnd);
  const arr = body.match(/\b([A-Za-z_$][\w$]*)\s*\[\s*[\w$]+\s*(?:-\s*1\s*)?\]/g) ?? [];
  if (/===?\s*undefined/.test(body)) for (const a of arr) {
    const n = arrayLength(file, a.slice(0, a.indexOf("[")).trim());
    if (n !== null) return n + 1;
  }
  const g = body.match(/\b(\w*(?:attempt|retr|tries)\w*)\s*(>=|>)\s*([\w$.]+(?:\s*[+-]\s*\d+)?)/i);
  if (g) { const n = evalNum(file, g[3]); if (n !== null) return g[2] === ">=" ? n : n + 1; }
  return null;
}

// the name of the call whose argument contains idx (skipping arrow-function parentheses), e.g. withRetry(() => fetch(…))
function enclosingCallName(file, idx) {
  let depth = 0;
  for (let k = idx - 1; k >= 0; k--) {
    const ch = file.blank[k];
    if (")]}".includes(ch)) depth++;
    else if ("([{".includes(ch)) {
      if (depth > 0) { depth--; continue; }
      if (ch !== "(") return null;
      const name = file.blank.slice(0, k).match(/([A-Za-z_$][\w$]*)\s*$/);
      if (name && !/^(if|for|while|switch|return|await|function)$/.test(name[1])) return name[1];
      if (name?.[1] === "function") return null;
    }
  }
  return null;
}

check("C7", "Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    // the result is used if the call follows =>, =, return, (, ",", ?, :, && or || (after an optional await)
    const before = file.blank.slice(0, call.start).replace(/\s*\b(await|void)\s*$/, "").replace(/\s+$/, "");
    const used = /(=>|=|return|\(|,|\?|:|&&|\|\||\[)$/.test(before);
    if (!used && (before === "" || /[;{}]$/.test(before))) atCall(add, file, call, "результат fetch до n8n відкидається — код статусу не перевіряється");
    let loop = enclosingLoop(file, call.start);
    const fn = enclosingFunctionStart(file, call.start);
    let wrapper = null;
    if (!loop) {
      const name = enclosingCallName(file, call.start);
      const body = name ? functionBody(file, name) : null;
      const head = body ? /\b(for|while|do)\b\s*[({]/.exec(file.blank.slice(body.start, body.end)) : null;
      if (head) {
        const at = body.start + head.index + head[0].length - 1; // "(" of for/while, "{" of do
        const opener = head[1] === "do" ? at : file.blank.indexOf("{", closeOf(file.blank, at));
        const inner = enclosingLoop(file, opener + 1);
        if (inner && inner.bodyStart > body.start && inner.bodyEnd < body.end) { loop = inner; wrapper = name; }
      }
    }
    const recursive = !loop && fn?.name && callsOf({ ...file, blank: file.blank.slice(0, fn.end) }, fn.name).some((c) => c.start > fn.brace);
    if (!loop && !recursive) { atCall(add, file, call, "немає повторів для мережевих помилок, таймауту, 5xx і 524"); continue; }
    const [from, to] = loop ? [loop.bodyStart, loop.bodyEnd] : [fn.brace, fn.end];
    const body = file.code.slice(from, to);
    const at = wrapper ? file.lineOf(loop.start) : null;
    const report = (reason) => (wrapper ? add(file.path, at, `${reason} (обгортка ${wrapper})`) : atCall(add, file, call, reason));
    // retry predicates may live in helpers of the same file: isRetryable(res.status)
    const withPredicates = body + " " + [...new Set([...body.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]))].map((n) => { const b = functionBody(file, n); return b ? file.code.slice(b.start, b.end + 1) : ""; }).join(" ");
    if (!/(>=|<)\s*500\b|>\s*499\b|\b524\b|\.status\s*>=\s*5\d\d/.test(withPredicates)) report("повтори без перевірки на 5xx/524 — повторюватимуться й 4xx");
    for (const st of ifStatements(file, from, to)) {
      const retries = loop ? /\bcontinue\b/.test(st.stmt) : new RegExp(`\\b${fn.name}\\s*\\(`).test(st.stmt);
      if (!retries) continue;
      if (/\b4\d\d\b|>=\s*400\b|>\s*399\b/.test(st.cond)) add(file.path, file.lineOf(st.at), "повтор для 4xx — 4xx не повторюємо ніколи");
      else if (/!\s*[\w$.]*\.ok\b|\.status\s*!==?\s*20\d\b/.test(st.cond) && !/500|524|5\d\d/.test(st.cond)) add(file.path, file.lineOf(st.at), "повтор для будь-якого не-2xx — повторюються й 4xx");
    }
    // a non-5xx answer must leave the loop (return/break/throw), otherwise it falls through to the pause and is retried
    if (loop) {
      const expand = (cond) => cond + " " + [...cond.matchAll(/([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => { const b = functionBody(file, m[1]); return b ? file.code.slice(b.start, b.end + 1) : ""; }).join(" ");
      const exits = ifStatements(file, from, to).filter((st) => /\b(return|break|throw)\b/.test(st.stmt) && /<\s*500\b|>=\s*400\b|>\s*399\b|>=\s*500\b|>\s*499\b|\b524\b/.test(expand(st.cond)));
      const elseExit = /else\s*(\{[^}]*)?\b(return|break|throw)\b/.test(body) && /(>=|>)\s*(500|499)\b/.test(body);
      const continueOn5xx = ifStatements(file, from, to).some((st) => /\bcontinue\b/.test(st.stmt) && /(>=|>)\s*(500|499)\b|\b524\b/.test(expand(st.cond)));
      if (!exits.length && !elseExit && !continueOn5xx && !wrapper) atCall(add, file, call, "відповідь 4xx не виходить із циклу — дійде до паузи й повториться");
      for (const st of exits) {
        const carve = st.cond.match(/(!==?|!=)\s*(4\d\d)\b/);
        if (carve && /<\s*500|>=\s*400/.test(st.cond)) add(file.path, file.lineOf(st.at), `код ${carve[2]} виключено з виходу — повторюється як 5xx (4xx не повторюємо ніколи)`);
      }
    }
    // throw inside try whose catch swallows the error = retry of that status
    if (loop) for (const t of file.blank.slice(from, to).matchAll(/\btry\s*\{/g)) {
      const tryOpen = from + t.index + t[0].length - 1;
      const tryClose = closeOf(file.blank, tryOpen);
      const c = /^\s*catch\s*(\([^)]*\))?\s*\{/.exec(file.blank.slice(tryClose + 1));
      if (!c) continue;
      const catchOpen = tryClose + 1 + c[0].length - 1;
      const catchBody = file.code.slice(catchOpen, closeOf(file.blank, catchOpen));
      if (/\b(throw|return)\b/.test(catchBody)) continue;
      const tryBody = file.code.slice(tryOpen, tryClose);
      const guard = /if\s*\([^)]*\.status\s*<\s*500[^)]*\)\s*(\{[^}]*)?return\b/.test(tryBody);
      if (guard) continue;
      const guarded = ifStatements(file, tryOpen, tryClose).filter((st) => /\bthrow\b/.test(st.stmt) && /(>=|>)\s*(500|499)\b|\b524\b/.test(st.cond) && !/\b4\d\d\b/.test(st.cond));
      const throws = [...file.blank.slice(tryOpen, tryClose).matchAll(/\bthrow\b/g)].map((m) => tryOpen + m.index);
      const free = throws.filter((i) => !guarded.some((st) => i > st.at && i <= st.end));
      if (free.length) add(file.path, file.lineOf(free[0]), "throw у try, а catch повторює спробу — повторюються й 4xx");
    }
    if (!/setTimeout|\bsleep\s*\(|\bdelay\s*\(|\bwait\s*\(|\bpause\s*\(/.test(body)) report("повтори без паузи (контракт: 1 с, потім 3 с)");
    if (loop) {
      const attempts = attemptsOf(file, loop) ?? attemptsFromGuard(file, loop);
      if (attempts === null) add(file.path, file.lineOf(loop.start), "кількість спроб не розпізнано (очікується лічильник, масив пауз чи межа з числом або const)");
      else if (attempts > 3) add(file.path, file.lineOf(loop.start), `спроб більше трьох (${attempts})`);
    } else {
      const bound = body.match(/\b\w*(?:attempt|retr|tries)\w*\s*(<=|<)\s*([\w$.]+)/i);
      const n = bound ? evalNum(file, bound[2]) : null;
      if (n === null || n > 3) atCall(add, file, call, "рекурсивні повтори без межі ≤ 3");
    }
  }
  for (const f of clientFiles) for (const m of f.code.matchAll(/Workflow (was|got) started/g)) add(f.path, f.lineOf(m.index), "розбір тексту відповіді n8n замість коду статусу");
});

// C8
const FORBIDDEN_DATA = /\b(ip|ipAddress|clientIp|userAgent|ua|headers|rawPayload|rawBody|internalNotes|acceptLanguage|cookies?|password|secret|token)\b/;
const WHOLE_OBJECT = /^(formData|lead|row|record|input|values|fields|payload|body|req|request|submission|entry|user|customer)$/;
function wholeDataReason(file, text, beforeIdx) {
  const t = text.trim();
  if (/Object\.fromEntries\s*\(/.test(t)) return "у data для n8n — усі поля форми (Object.fromEntries)";
  if (/\bformData\b(?!\s*\.\s*(get|getAll|has)\b)/.test(t) && !/^\{/.test(t)) return "у data для n8n — уся форма (formData)";
  if (FORBIDDEN_DATA.test(t.replace(/(["'])(?:\\.|(?!\1).)*\1/g, ""))) return "у data для n8n — IP/user agent/заголовки/сирі дані/секрети";
  if (/^\{[\s\S]*\.\.\.\s*[A-Za-z_$]/.test(t)) return "у data для n8n розгортається цілий об'єкт (...spread)";
  if (WHOLE_OBJECT.test(t)) return `у n8n іде цілий об'єкт ${t}, а не мінімальні data`;
  if (/^[A-Za-z_$][\w$]*$/.test(t)) {
    const def = definitionOf(file, t, beforeIdx);
    if (def && !def.text.startsWith("{")) {
      if (/Object\.fromEntries\s*\(|^formData\b|^await\s+[\w$.]*(insert|create|get|find|load)/i.test(def.text)) return `у n8n іде цілий об'єкт ${t} (${/fromEntries/.test(def.text) ? "усі поля форми" : "запис з бази"})`;
    } else if (def) {
      return wholeDataReason(file, def.text, def.declIdx);
    }
  }
  return null;
}

check("C8", "Тіло — конверт { version, event, data } з мінімальними data", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const opts = fetchOptions(file, call);
    let expr = propValue(opts.text, "body");
    if (expr && /^[A-Za-z_$][\w$]*$/.test(expr)) expr = definitionOf(file, expr, call.start)?.text ?? null;
    const str = expr?.match(/^JSON\.stringify\s*\(([\s\S]*)\)\s*$/);
    let obj = str ? str[1].trim() : null;
    let objName = null;
    if (obj && /^[A-Za-z_$][\w$]*$/.test(obj)) { objName = obj; obj = definitionOf(file, obj, call.start)?.text ?? null; }
    const builder = obj?.match(/^([A-Za-z_$][\w$]*)\s*\(/);
    if (builder) { // envelope returned by a local function: use the object it returns
      const body = functionBody(file, builder[1]);
      const ret = body ? file.code.slice(body.start, body.end + 1).match(/return\s*(\{[\s\S]*\})\s*;?\s*\}?\s*$/) : null;
      const arrowObj = body && file.code[body.start] === "(" ? file.code.slice(body.start, body.end + 1).replace(/^\(\s*|\s*\)$/g, "") : null;
      obj = ret?.[1] ?? arrowObj ?? obj;
    }
    if (!obj || !obj.startsWith("{")) {
      atCall(add, file, call, objName ? `у n8n іде цілий об'єкт ${objName}, а не конверт { version, event, data }` : "тіло не розпізнано як JSON.stringify({ version, event, data })");
      continue;
    }
    if (!/\bversion\b/.test(obj) || !/\bevent\b/.test(obj) || !/\bdata\b/.test(obj)) atCall(add, file, call, "тіло не має конверта { version, event, data }");
    else {
      const dataVal = propValue(obj, "data");
      const reason = dataVal && dataVal !== "data" ? wholeDataReason(file, dataVal, call.start) : null;
      if (reason) atCall(add, file, call, reason);
      else if (FORBIDDEN_DATA.test(obj.replace(/(["'])(?:\\.|(?!\1).)*\1/g, ""))) atCall(add, file, call, "у тілі для n8n — IP/user agent/заголовки/сирі дані/секрети");
      else if (/\.\.\.\s*(?!\()[A-Za-z_$]/.test(obj)) atCall(add, file, call, "у тіло для n8n розгортається цілий об'єкт (...spread)");
    }
  }
  for (const f of files) for (const site of triggerSites(f).filter((s) => s.kind === "client")) {
    site.call.args.forEach(([a, b], index) => {
      const reason = wholeDataReason(f, f.code.slice(a, b), site.call.start);
      if (!reason) return;
      // a whole record passed to a client function that only reads fields of it is fine
      if (/цілий об'єкт|розгортається/.test(reason) && !calleeSendsWhole(f, site.call, index)) return;
      atCall(add, f, site.call, reason);
    });
  }
});

// does the called client function send its index-th parameter whole (JSON.stringify(p), ...p, data: p, { p })?
function calleeSendsWhole(file, call, index) {
  const name = file.blank.slice(call.start, call.open).trim();
  const imp = importClauses(file).find((i) => i.target && i.names.includes(name));
  const target = imp?.target ?? file;
  const decl = new RegExp(`function\\s+${name}\\s*\\(`).exec(target.blank);
  if (!decl) return true; // unknown callee: keep the finding
  const params = argSpans(target.blank, decl.index + decl[0].length - 1).map((sp) => target.code.slice(...sp).trim());
  const param = params[index]?.match(/^([A-Za-z_$][\w$]*)/)?.[1];
  if (!param) return false; // destructured parameter: only named fields are used
  const body = functionBody(target, name);
  const text = body ? target.code.slice(body.start, body.end + 1) : "";
  return new RegExp(`JSON\\.stringify\\(\\s*${param}\\s*[,)]|\\.\\.\\.\\s*${param}\\b|\\bdata\\s*:\\s*${param}\\b|[{,]\\s*${param}\\s*[,}]`).test(text);
}

// C9
function actionSpans(f) {
  if (firstStatement(f) === "use client") return [];
  if (firstStatement(f) === "use server") { // actions = exported functions of the module
    const spans = [];
    for (const m of f.blank.matchAll(/export\s+(?:default\s+)?(?:async\s+)?function\s*[\w$]*\s*\(/g)) {
      const headClose = closeOf(f.blank, m.index + m[0].length - 1);
      const brace = f.blank.indexOf("{", headClose);
      if (brace !== -1) spans.push([brace, closeOf(f.blank, brace)]);
    }
    for (const m of f.blank.matchAll(/export\s+const\s+[\w$]+\s*(?::[^=;\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]+)?=>\s*\{/g)) {
      const brace = m.index + m[0].length - 1;
      spans.push([brace, closeOf(f.blank, brace)]);
    }
    return spans.length ? spans : [[0, f.code.length]];
  }
  const spans = [];
  for (const m of f.blank.matchAll(/\{\s*(["'])\s*\1/g)) {
    const inner = f.code.slice(m.index, m.index + m[0].length + 14);
    if (!/^\{\s*(["'])use server\1/.test(inner)) continue;
    const end = closeOf(f.blank, m.index);
    if (end !== -1) spans.push([m.index, end]);
  }
  return spans;
}

check("C9", "Server Action не чекає n8n: виклик лише в after()", (add) => {
  let any = false;
  for (const f of files) {
    const spans = actionSpans(f);
    if (!spans.length) continue;
    const afterSpans = [];
    for (const c of callsOf(f, "after|unstable_after")) {
      afterSpans.push([c.open, c.close]);
      const arg = c.args[0] ? f.code.slice(...c.args[0]).trim() : "";
      if (/^[A-Za-z_$][\w$]*$/.test(arg)) { const body = functionBody(f, arg); if (body) afterSpans.push([body.start, body.end]); }
    }
    // same-file helper functions that (transitively) call n8n count as trigger sites too
    const sites = triggerSites(f);
    const helperNames = new Set();
    for (let grew = true; grew;) {
      grew = false;
      const known = [...sites, ...[...helperNames].flatMap((n) => callsOf(f, n).map((call) => ({ call })))];
      for (const s of known) {
        const fn = enclosingFunctionStart(f, s.call.start);
        if (fn?.name && !helperNames.has(fn.name) && !spans.some(([a, b]) => fn.brace === a || (fn.brace > a && fn.end <= b && b - a < f.code.length))) { helperNames.add(fn.name); grew = true; }
      }
    }
    for (const n of helperNames) for (const call of callsOf(f, n)) {
      const own = enclosingFunctionStart(f, call.start);
      if (own?.name !== n) sites.push({ call, kind: "helper" });
    }
    for (const site of sites) {
      if (!spans.some(([a, b]) => site.call.start >= a && site.call.start <= b)) continue;
      any = true;
      const inside = afterSpans.some(([a, b]) => site.call.start > a && site.call.start < b);
      if (!inside) atCall(add, f, site.call, 'Server Action чекає n8n — перенести виклик у after() з "next/server"');
    }
  }
  if (!any) return "Server Actions не викликають n8n";
});

// C10
check("C10", 'Без export const runtime = "edge"', (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/export\s+const\s+runtime\s*(?::[^=]+)?=\s*["'`](experimental-)?edge["'`]/g)) add(f.path, f.lineOf(m.index), 'runtime = "edge" (deprecated у Next.js 16, немає node:crypto)');
    for (const m of f.code.matchAll(/export\s+const\s+config\s*=\s*\{[^}]*runtime\s*:\s*["'`](experimental-)?edge/g)) add(f.path, f.lineOf(m.index), "config.runtime = edge");
  }
});

// names of functions (in the route and its helpers) that call timingSafeEqual
function verifierNames(group) {
  const names = new Set();
  for (const g of group) for (const m of g.code.matchAll(/timingSafeEqual\s*\(/g)) {
    const fn = enclosingFunctionStart(g, m.index);
    if (fn?.name && fn.name !== "POST") names.add(fn.name);
  }
  return names;
}

// first point in the route where the signature is actually compared: timingSafeEqual inside POST,
// or the first call of a function that contains it, or of verify*()
function verificationPoint(route) {
  const idx = [];
  const names = [...verifierNames(withHelpers(route))];
  for (const call of callsOf(route, ["verify\\w*", ...names].join("|"))) {
    const fn = enclosingFunctionStart(route, call.start);
    if (!fn || fn.name === "POST" || !names.includes(fn.name)) idx.push(call.start);
  }
  for (const m of route.code.matchAll(/timingSafeEqual\s*\(/g)) {
    const fn = enclosingFunctionStart(route, m.index);
    if (!fn || fn.name === "POST" || !fn.name) idx.push(m.index);
  }
  return idx.length ? Math.min(...idx) : -1;
}

// first index in the route where JSON is parsed: JSON.parse / .json() in POST, or the first call of a
// local function that parses
function parsePoints(route) {
  const points = [];
  const parsers = new Set();
  for (const m of route.code.matchAll(/JSON\.parse\s*\(/g)) {
    const fn = enclosingFunctionStart(route, m.index);
    if (fn?.name && fn.name !== "POST") parsers.add(fn.name);
    else points.push({ idx: m.index, via: "JSON.parse" });
  }
  // parsers imported from local helper modules
  for (const imp of importClauses(route)) {
    if (!imp.target) continue;
    for (const name of imp.names) {
      const body = functionBody(imp.target, name);
      if (body && /JSON\.parse\s*\(|\.json\s*\(\s*\)/.test(imp.target.code.slice(body.start, body.end))) parsers.add(name);
    }
  }
  if (parsers.size) for (const c of callsOf(route, [...parsers].join("|"))) {
    const fn = enclosingFunctionStart(route, c.start);
    if (!fn || !parsers.has(fn.name)) points.push({ idx: c.start, via: "JSON.parse" });
  }
  // .json() / .formData() on the request (also req.clone().json())
  const reqName = route.code.match(/function\s+POST\s*\(\s*([\w$]+)/)?.[1] ?? "req";
  for (const m of route.code.matchAll(new RegExp(`\\b(?:${reqName}|req|request)\\b[\\w$.()]*?\\.(json|formData)\\s*\\(\\s*\\)`, "g"))) points.push({ idx: m.index, via: m[1] });
  for (const m of route.code.matchAll(/new\s+(?:Response|Request)\s*\([^)]*\)\s*\.(json|formData)\s*\(\s*\)/g)) points.push({ idx: m.index, via: m[1] });
  return points;
}

// C11
check("C11", "Колбек читає сире тіло й не парсить JSON до перевірки підпису", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів не знайдено (евристика — див. --help)";
  for (const f of callbackRoutes) {
    for (const m of f.code.matchAll(/\.(json|formData)\s*\(\s*\)/g)) {
      const pre = f.code.slice(Math.max(0, m.index - 30), m.index);
      if (/\b(req|request|\w*[Rr]eq\w*)(\.clone\(\))?\s*$/.test(pre) || /await\s+\w+\s*$/.test(pre)) add(f.path, f.lineOf(m.index), `тіло читається через .${m[1]}() — підпис рахується від сирого тексту`);
    }
    if (!/\.(text|arrayBuffer)\s*\(\s*\)/.test(f.code)) add(f.path, 1, "тіло не читається як сирий текст (.text())", "file");
    const verifyIdx = verificationPoint(f);
    for (const p of parsePoints(f)) {
      if (verifyIdx === -1 || p.idx < verifyIdx) add(f.path, f.lineOf(p.idx), `${p.via === "JSON.parse" ? "JSON.parse" : `.${p.via}()`} до перевірки підпису (timingSafeEqual)`);
    }
  }
});

// C12
const NULLISH = /^(null|undefined|""|''|``|0|false|true)$/;
check("C12", "Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів не знайдено";
  for (const route of callbackRoutes) {
    const group = withHelpers(route);
    const at = (re) => { for (const g of group) { const i = g.code.search(re); if (i !== -1) return [g, i]; } return null; };
    const hmac = at(/createHmac\s*\(\s*["'`]sha256["'`]\s*,/);
    if (!hmac) add(route.path, 1, "немає createHmac(\"sha256\", секрет)", "file");
    else {
      const [g, i] = hmac;
      const argsText = g.code.slice(i, i + 200);
      if (/createHmac\s*\(\s*["'`]sha256["'`]\s*,\s*["'`]/.test(argsText)) add(g.path, g.lineOf(i), "ключ HMAC — літерал, а не N8N_CALLBACK_SECRET");
      // the argument of .update(…) on this createHmac chain (one const followed), must be `${timestamp}.${raw}`
      const upd = /\.update\s*\(/.exec(g.blank.slice(i));
      let updArg = "";
      if (upd) {
        const open = i + upd.index + upd[0].length - 1;
        const spans = argSpans(g.blank, open);
        updArg = spans[0] ? g.code.slice(...spans[0]).trim() : "";
        if (/^[A-Za-z_$][\w$]*$/.test(updArg)) updArg = definitionOf(g, updArg)?.text ?? updArg;
      }
      // `${A}.${B}` (or A + "." + B): B is the raw body, A is not — so the timestamp comes first
      const RAW = /(raw|body|payload|text)/i;
      const parts = updArg.match(/^\x60\$\{\s*([\w$.]+)\s*\}\.\$\{\s*([\w$.]+)\s*\}\x60$/) ?? updArg.match(/^([\w$.]+)\s*\+\s*["'\x60]\.["'\x60]\s*\+\s*([\w$.]+)$/);
      const ordered = Boolean(parts && RAW.test(parts[2]) && !RAW.test(parts[1]));
      if (!ordered) add(g.path, g.lineOf(i), "HMAC рахується не від `${timestamp}.${raw}` (аргумент .update(…))");
    }
    const tse = at(/timingSafeEqual\s*\(/);
    if (!tse) add(route.path, 1, "немає crypto.timingSafeEqual", "file");
    else {
      const [g, i] = tse;
      const fn = enclosingFunctionStart(g, i);
      const scope = fn ? g.code.slice(fn.brace, i) : g.code.slice(Math.max(0, i - 400), i);
      // the length check must compare the two buffers that are passed to timingSafeEqual
      const spans = argSpans(g.blank, i + g.blank.slice(i).indexOf("("));
      const [x, y] = spans.map((sp) => g.code.slice(...sp).trim().replace(/^Buffer\.from\(\s*([\w$]+)\s*(?:,[^)]*)?\)$/, "$1"));
      const ident = /^[A-Za-z_$][\w$]*$/;
      const esc = (v) => v.replace(/\$/g, "\\$");
      const tied = x && y && ident.test(x) && ident.test(y) && x !== y
        && new RegExp(`\\b(${esc(x)}|${esc(y)})\\.(byte)?[Ll]ength\\s*(!==|===|!=|==)\\s*(${esc(x)}|${esc(y)})\\.(byte)?[Ll]ength`).test(scope + g.code.slice(i, i + 5));
      if (!tied) add(g.path, g.lineOf(i), "немає перевірки довжини тих самих буферів, що йдуть у timingSafeEqual");
    }
    // the verification result must reject the request: `if (!verify(…)) return …` or `const ok = verify(…); if (!ok) return …`
    const vIdx = verificationPoint(route);
    if (vIdx !== -1) {
      const stmtStart = Math.max(route.blank.lastIndexOf(";", vIdx), route.blank.lastIndexOf("{", vIdx), route.blank.lastIndexOf("}", vIdx));
      const stmt = route.code.slice(stmtStart + 1, vIdx);
      const assigned = stmt.match(/(?:const|let|var)\s+([\w$]+)\s*=\s*(?:await\s+)?$/);
      const rejects = /\bif\s*\(/.test(stmt) || /\breturn\b/.test(stmt)
        || (assigned && new RegExp(`if\\s*\\([^)]*!\\s*${assigned[1]}\\b[^)]*\\)\\s*(\\{[^}]*)?\\breturn\\b`).test(route.code.slice(vIdx)));
      if (!rejects) add(route.path, route.lineOf(vIdx), "результат перевірки підпису не відхиляє запит (очікується if (!…) return 401)");
    }
    const OPERAND = String.raw`[\w$.\[\]"'\x60-]+(?:\([^()]*\))?(?:\.[\w$]+(?:\([^()]*\))?)*`;
    const cmp = new RegExp(`(${OPERAND})\\s*(===|!==|==|!=)\\s*(${OPERAND})`, "g");
    // variables that hold the header signature or a computed digest
    const sigVars = new Set();
    for (const g of group) for (const m of g.code.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*(?::[^=;\n]+)?=([^;\n]*)/g)) {
      if (/headers\.get\(\s*["'`]x-[\w-]*signature|\.digest\s*\(/i.test(m[2])) sigVars.add(m[1]);
    }
    for (const g of group) for (const m of g.code.matchAll(cmp)) {
      const [, left, op, right] = m;
      if (NULLISH.test(left) || NULLISH.test(right)) continue;
      const operand = (s) => (/sig|signature|hmac|digest/i.test(s) || sigVars.has(s)) && !/\.(byte)?length$/i.test(s);
      if ((operand(left) || operand(right)) && !/typeof\s*$/.test(g.code.slice(Math.max(0, m.index - 8), m.index))) add(g.path, g.lineOf(m.index), `підпис порівнюється через ${op}`);
    }
  }
});

// C13 helpers
// the "{" that opens the block around `idx` (-1 at top level)
function blockOpen(text, idx) {
  let depth = 0;
  for (let k = idx - 1; k >= 0; k--) {
    const ch = text[k];
    if (ch === "}") depth++;
    else if (ch === "{") { if (depth === 0) return k; depth--; }
  }
  return -1;
}
// `return …` statements with a 4xx/5xx status after `from`, inside the function that holds `from`
// (not the claim's own "already taken" answer: that key is not ours to free)
function rejectsAfter(file, from) {
  let top = blockOpen(file.blank, from);
  for (let up = top; up !== -1; up = blockOpen(file.blank, up)) top = up;
  const end = top === -1 ? file.blank.length : closeOf(file.blank, top);
  const out = [];
  for (const m of file.blank.slice(from, end).matchAll(/\breturn\b/g)) {
    const idx = from + m.index;
    if (!file.blank.slice(from, idx).includes(";")) continue;
    const stmt = file.blank.slice(idx, exprEnd(file.blank, idx + 6));
    const lit = stmt.match(/^return\s+(?:await\s+)?[\w$.]+\(\s*(\d{3})\b/) ?? stmt.match(/\bstatus\s*:\s*(\d{3})\b/);
    const named = lit ? null : stmt.match(/\bstatus\s*:\s*([A-Z_][A-Z0-9_]*)\b/) ?? stmt.match(/^return\s+(?:await\s+)?[\w$.]+\(\s*([A-Z_][A-Z0-9_]*)\s*,/);
    const status = lit ? Number(lit[1]) : named ? evalNum(file, named[1]) : null;
    if (status >= 400) out.push({ idx, stmt, status });
  }
  return out;
}
// the key is released before this return on its own path: in the statement, earlier in the same block
// (closed nested blocks excluded), in an enclosing finally, or inside the helper it returns through
function releasedOnPath(file, r, releaseRe) {
  if (releaseRe.test(r.stmt)) return true;
  const open = blockOpen(file.blank, r.idx);
  let before = file.blank.slice(open + 1, r.idx), prev;
  do { prev = before; before = before.replace(/\{[^{}]*\}/g, (b) => " ".repeat(b.length)); } while (before !== prev);
  if (releaseRe.test(before)) return true;
  for (const f of file.blank.matchAll(/\bfinally\s*\{/g)) {
    const o = f.index + f[0].length - 1;
    const tryOpen = blockOpen(file.blank, f.index);
    const tryStart = file.blank.lastIndexOf("try", f.index);
    if (tryStart !== -1 && tryStart > tryOpen && r.idx > tryStart && r.idx < o && releaseRe.test(file.blank.slice(o, closeOf(file.blank, o)))) return true;
  }
  const callee = r.stmt.match(/^return\s+(?:await\s+)?([\w$]+)\s*\(/)?.[1];
  const def = callee && file.blank.match(new RegExp(`(?:function\\s+${callee}\\s*\\(|(?:const|let|var)\\s+${callee}\\s*=)`));
  if (def) {
    const o = file.blank.indexOf("{", def.index);
    if (o !== -1 && releaseRe.test(file.blank.slice(o, closeOf(file.blank, o)))) return true;
  }
  return false;
}
const WRITE_VERB = /^(save|update|insert|set|persist|store|mark|complete|upsert|finish|record|write|commit)/i;
const READ_VERB = /^(get|find|list|read|load|fetch|has|count|select|query|claim|release|reserve|acquire|lock|unlock|free|forget|delete|del|remove)/i;
// state writes after `from`: a write-verb call, or any non-read method of a store object (db.finishJob)
function stateWrites(file, from) {
  const out = [];
  for (const m of file.blank.matchAll(/(?<![\w$.])(?:([\w$]+)\.)?([\w$]+)\s*\(/g)) {
    const [, obj, name] = m;
    if (m.index < from || /function\s+$/.test(file.blank.slice(Math.max(0, m.index - 10), m.index))) continue;
    const store = obj && /^(db|store|repo|repository|prisma|kv|redis|storage|dao)$/i.test(obj);
    if (READ_VERB.test(name) || !(WRITE_VERB.test(name) || store)) continue;
    const open = m.index + m[0].length - 1;
    const close = closeOf(file.blank, open);
    const lead = file.blank.slice(Math.max(0, m.index - 8), m.index);
    const detached = /\bvoid\s+$/.test(lead)
      || (!/\b(await|return|yield)\s+$/.test(lead) && close !== -1 && /^\s*\.\s*(then|catch|finally)\s*\(/.test(file.blank.slice(close + 1)));
    out.push({ idx: m.index, detached });
  }
  return out;
}

// C13
check("C13", "Колбек: 404/415/413, вікно 300 с, claim до парсингу, ключ = jobId:event, 202, стан до відповіді", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів не знайдено";
  for (const route of callbackRoutes) {
    const group = withHelpers(route);
    const all = group.map((g) => g.code).join("\n");
    const lower = all.toLowerCase();
    // a status code as a literal, a const (status: ACCEPTED) or a helper argument (reply(404, …))
    const hasStatus = (code) => new RegExp(`(status\\s*:\\s*|[(,]\\s*)${code}\\b`).test(route.code)
      || [...route.code.matchAll(/(?:status\s*:\s*|[(,]\s*)([A-Z_][A-Z0-9_]*)\b/g)].some((m) => evalNum(route, m[1]) === code);
    for (const [code, what] of [[404, "невідома подія → 404"], [415, "не-JSON → 415"], [413, "тіло > 64 KB → 413"]]) {
      if (!hasStatus(code)) add(route.path, 1, `немає відповіді ${what}`, "file");
    }
    if (!lower.includes("x-n8n-timestamp")) add(route.path, 1, "не читається x-n8n-timestamp", "file");
    const abs = [...route.blank.matchAll(/Math\.abs\s*\(/g)].find((m) => /Date\.now|\bnow\b|\bts\b|timestamp/i.test(route.code.slice(m.index, closeOf(route.blank, m.index + m[0].length - 1))));
    let windowS = null;
    if (abs) {
      const close = closeOf(route.blank, abs.index + abs[0].length - 1);
      let cmp = route.code.slice(close + 1).match(/^\s*(>=|>)\s*([^|&)?;\n]+)/);
      const held = route.code.slice(0, abs.index).match(/(?:const|let|var)\s+([\w$]+)\s*=\s*$/); // const skew = Math.abs(…)
      if (!cmp && held) cmp = route.code.slice(close).match(new RegExp(`\\b${held[1]}\\s*(>=|>)\\s*([^|&)?;\\n]+)`));
      windowS = cmp ? evalNum(route, cmp[2]) : null;
      const inner = route.code.slice(abs.index, close);
      const inMs = /Date\.now\(\)/.test(inner) && !/\/\s*1000/.test(inner); // Date.now() - ts * 1000 (ms)
      if (windowS === null) add(route.path, route.lineOf(abs.index), "межу вікна часу не розпізнано (очікується число чи const ≤ 300 с)");
      else if (inMs ? windowS > 300_000 : windowS > 300) add(route.path, route.lineOf(abs.index), `вікно часу ${inMs ? `${windowS} мс` : windowS} — понад 300 с`);
    } else add(route.path, 1, "немає двостороннього вікна часу (Math.abs(зараз − timestamp) > 300)", "file");
    const keyRead = route.code.match(/(?:const|let|var)\s+([\w$]+)\s*=\s*[\w$.]*headers\.get\(\s*["'`]idempotency-key["'`]\s*\)([^;\n]*)/i);
    // an alias like `const key = hdr ? hdr : <from body>` is a fallback too
    const alias = keyRead ? route.code.match(new RegExp(`(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*([^;\\n]*\\b${keyRead[1]}\\b[^;\\n]*)`)) : null;
    if (!lower.includes("idempotency-key")) add(route.path, 1, "не читається idempotency-key", "file");
    else if (keyRead && /\?\?|\|\|/.test(keyRead[2])) add(route.path, route.lineOf(route.code.indexOf(keyRead[0])), "idempotency-key має братися лише із заголовка — фолбек із тіла дозволяє підмінити ключ");
    else if (alias && /\?|\|\|/.test(alias[2])) add(route.path, route.lineOf(route.code.indexOf(alias[0])), "idempotency-key має братися лише із заголовка — фолбек із тіла дозволяє підмінити ключ");
    const dup = [...route.code.matchAll(/duplicate/g)];
    if (!/duplicate/.test(all)) add(route.path, 1, "повтор ключа не відповідає 200 { duplicate: true }", "file");
    for (const d of dup) { // the whole statement around "duplicate" (formatters split it over lines)
      const from = Math.max(route.blank.lastIndexOf(";", d.index), route.blank.lastIndexOf("{\n", d.index), route.blank.lastIndexOf("return", d.index) - 1);
      const to = route.blank.indexOf(";", d.index);
      const stmtText = route.code.slice(from + 1, to === -1 ? undefined : to);
      const st = stmtText.match(/status\s*:\s*(\d{3})/) ?? stmtText.match(/\(\s*(\d{3})\s*,/);
      if (st && st[1] !== "200") add(route.path, route.lineOf(d.index), `повтор ключа відповідає ${st[1]}, а не 200 — n8n повторюватиме колбек`);
    }
    const keyName = alias?.[1] ?? keyRead?.[1] ?? "key";
    const tmpl = String.raw`\x60[^\x60]*jobId\s*\}\s*:\s*\$\{[^\x60]*\x60|[\w$.]*jobId\s*\+\s*["'\x60]:["'\x60]\s*\+\s*[\w$.]+|\[[^\]]*jobId[^\]]*\]\s*\.join\(\s*["'\x60]:["'\x60]\s*\)`;
    const expectedVars = [...route.code.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*(?::[^=;\n]+)?=([^;\n]*)/g)].filter((m) => new RegExp(tmpl).test(m[2])).map((m) => m[1]);
    const other = [tmpl, ...expectedVars.map((v) => `\\b${v}\\b`)].join("|");
    if (!new RegExp(`\\b${keyName}\\s*(!==|===|!=|==)\\s*(${other})|(${other})\\s*(!==|===|!=|==)\\s*${keyName}\\b`).test(route.code)) {
      add(route.path, 1, "idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла", "file");
    }
    const claimRe = new RegExp(`(?<![\\w$])(?:[\\w$]+\\.)?([\\w$]*(?:[Cc]laim|[Rr]eserve|[Aa]cquire|[Ll]ock|[Ii]nsert)[\\w$]*|add|setnx|set)\\s*\\(\\s*${keyName}\\b`, "gi");
    const claims = [...route.blank.matchAll(claimRe)].map((m) => m.index);
    if (!claims.length) add(route.path, 1, `немає claim ключа (${keyName}) у сховищі до обробки`, "file");
    else {
      const claimIdx = Math.min(...claims);
      for (const p of parsePoints(route)) if (p.idx < claimIdx) add(route.path, route.lineOf(p.idx), "JSON.parse до claim idempotency-key — контракт: спершу claim, потім розбір тіла");
      const vIdx = verificationPoint(route);
      if (vIdx !== -1 && claimIdx < vIdx) add(route.path, route.lineOf(claimIdx), "claim ключа до перевірки підпису — непідписаний запит займе ключ");
      const releaseRe = new RegExp(`(?<![\\w$])(?:[\\w$]+\\.)?([\\w$]*(?:[Rr]elease|[Uu]nlock|[Rr]emove|[Ff]orget|[Ff]ree)[\\w$]*|delete|del)\\s*\\(\\s*${keyName}\\b`, "i");
      if (!releaseRe.test(route.blank)) add(route.path, route.lineOf(claimIdx), "після claim немає звільнення ключа при 400 чи збої — n8n не зможе повторити");
      else for (const r of rejectsAfter(route, claimIdx)) { // each 4xx/5xx path frees the key itself: a release on another branch does not count
        if (!releasedOnPath(route, r, releaseRe)) add(route.path, route.lineOf(r.idx), `відповідь ${r.status} після claim не звільняє ключ — n8n не зможе повторити колбек`);
      }
    }
    if (!hasStatus(202)) add(route.path, 1, "успіх не відповідає 202", "file");
    const afterSpans = callsOf(route, "after|unstable_after").map((c) => [c.open, c.close]);
    const inAfter = (i) => afterSpans.some(([a, b]) => i > a && i < b);
    const writes = stateWrites(route, claims.length ? Math.min(...claims) : 0);
    if (writes.length && writes.every((w) => inAfter(w.idx))) add(route.path, route.lineOf(afterSpans[0][0]), "стан зберігається лише в after() — n8n не повторить колбек після 2xx");
    else if (writes.length && writes.every((w) => inAfter(w.idx) || w.detached)) {
      const w = writes.find((x) => x.detached);
      add(route.path, route.lineOf(w.idx), "стан зберігається без await (void/.then) — 202 піде раніше за запис, а збій не звільнить ключ");
    }
  }
});

// C14
const BAD_ARG = /^(body|raw|rawBody|payload|envelope|formData|data|parsed|req|request|headers|lead|row|record|input|values|fields)$/;
const BODY_VAR = /^(body|raw|rawBody|payload|parsed|envelope|data|req|request)$/;
const PII_PROP = /\.(email|phone|fullName|firstName|lastName|ipAddress|userAgent|notes?)\b|\b(lead|user|customer|contact|person|client|body|data|payload|form|values|input|record|row|parsed)\.name\b/;
const SECRET_WORD = /\b(token|secret|signature|sig|hmac|authorization|cookie|password)\b/i;
// why a single logged expression leaks (null if it does not)
function logLeak(arg) {
  const wrapped = arg.match(/^(?:JSON\.stringify|String|inspect|util\.inspect)\s*\(\s*([\s\S]*?)\s*(?:,[\s\S]*)?\)$/);
  if (wrapped) arg = wrapped[1].trim();
  if (BAD_ARG.test(arg)) return `у журнал іде цілий об'єкт ${arg}`;
  const part = arg.match(/^([\w$]+)\.(slice|substring|substr|toString)\s*\(/);
  if (part && BAD_ARG.test(part[1])) return `у журнал іде частина тіла (${part[1]}.${part[2]})`;
  const member = arg.match(/^([\w$]+)\.(data|result|payload|fields|values|body|lead|record|input|error)$/);
  if (member && BODY_VAR.test(member[1])) return `у журнал іде частина тіла (${arg})`;
  if (/\b(req|request)\.headers\b(?!\.get)|Object\.fromEntries\s*\(\s*[\w$.]*headers\s*\)/.test(arg)) return "у журнал ідуть усі заголовки запиту (там підпис і токени)";
  if (/process\.env|N8N_/.test(arg)) return "у журнал ідуть змінні середовища";
  const idents = arg.replace(/\b(Buffer\.byteLength|createHash|sha256|Object\.keys|Boolean)\s*\([^)]*\)/g, "")
    .replace(/!!\s*[\w$.]+|typeof\s+[\w$.]+/g, "")
    .replace(/\(?\s*\b(err|error|e|cause)\b(\s+as\s+\w+)?\s*\)?\.(name|message|code|cause)\b/g, "");
  if (PII_PROP.test(idents)) return "у журнал ідуть персональні дані";
  if (SECRET_WORD.test(idents.replace(/\.length\b/g, ""))) return "у журнал ідуть токен, підпис чи секрет";
  return null;
}
check("C14", "Журнали без тіл, персональних даних і секретів", (add) => {
  for (const f of files) {
    for (const call of callsOf(f, "console\\.(?:log|info|warn|error|debug|trace)|logger\\.(?:log|info|warn|error|debug)")) {
      for (const [a, b] of call.args) {
        const arg = f.blank.slice(a, b).trim(); // strings blanked, ${…} kept
        const line = f.lineOf(a);
        // the argument itself, every ${…} inside a template literal, every value of an object literal
        const parts = [arg, ...[...arg.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((m) => m[1].trim())];
        const obj = arg.match(/^\{([\s\S]*)\}$/);
        if (obj) for (const part of obj[1].split(",")) {
          const pp = part.trim();
          parts.push(pp.includes(":") ? pp.slice(pp.indexOf(":") + 1).trim() : pp);
        }
        for (const part of parts) { const why = logLeak(part); if (why) { add(f.path, line, why); break; } }
      }
    }
  }
});

// C15
check("C15", "Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl", (add) => {
  // a client that builds callbackUrl only under an option counts as sending it only if some call asks for a callback
  const asksCallback = files.some((f) => /\bcallback\s*:\s*true\b/.test(f.code));
  const sendsCallback = files.filter((f) => /\bcallbackUrl\b/.test(f.code) && !isRouteFile(f)
    && (asksCallback || !/\b(options|opts)\??\.callback\b/.test(f.code)));
  if (!sendsCallback.length && !callbackRoutes.length) return "колбеків у коді немає";
  const contractRoute = files.find((f) => /(^|\/)app\/api\/n8n\/\[event\]\/route\.(ts|tsx|js|mjs)$/.test(f.path));
  if (sendsCallback.length && !contractRoute) {
    const f = sendsCallback[0];
    add(f.path, f.lineOf(f.code.search(/\bcallbackUrl\b/)), "конверт шле callbackUrl, але app/api/n8n/[event]/route.* немає");
  }
  for (const r of callbackRoutes) if (r !== contractRoute) add(r.path, 1, "колбек-роут не за шляхом app/api/n8n/[event]/route.*", "file");
});

// ---------------------------------------------------------------- --changed-since

let changed = null;
if (args["changed-since"]) {
  const git = (argv) => execFileSync("git", ["-C", ROOT, "-c", "core.quotePath=false", ...argv], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  try {
    git(["rev-parse", "--verify", `${args["changed-since"]}^{commit}`]);
    const diff = git(["diff", "-U0", "--no-color", "--no-ext-diff", "--relative", "--src-prefix=a/", "--dst-prefix=b/", args["changed-since"], "--"]);
    changed = new Map();
    let current = null;
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++ ")) {
        current = line === "+++ /dev/null" ? null : line.slice(6);
        if (current && !changed.has(current)) changed.set(current, new Set());
      } else if (line.startsWith("@@") && current) {
        const m = line.match(/\+(\d+)(?:,(\d+))?/);
        const start = Number(m[1]); const count = m[2] === undefined ? 1 : Number(m[2]);
        for (let k = 0; k < count; k++) changed.get(current).add(start + k);
      }
    }
    for (const p of git(["ls-files", "-z", "--others", "--exclude-standard"]).split("\0").filter(Boolean)) changed.set(p, "new");
  } catch (error) {
    console.error(`check-contract: git не зміг порівняти з ${args["changed-since"]}: ${String(error.message).split("\n")[0]}`);
    process.exit(2);
  }
}

function keep(fnd) {
  if (!changed) return true;
  const entry = changed.get(fnd.file);
  if (!entry) return false;
  if (entry === "new") return true;
  if (fnd.scope === "file") return true;
  for (let l = fnd.line; l <= (fnd.endLine ?? fnd.line); l++) if (entry.has(l)) return true;
  return false;
}

// ---------------------------------------------------------------- output

console.log(`check-contract — ${ROOT}${changed ? `  (лише зміни після ${args["changed-since"]})` : ""}`);
let fail = 0, pass = 0, na = 0;
for (const r of results) {
  if (r.na) { na++; console.log(`${r.id.padEnd(4)} N/A   ${r.title} — ${r.na}`); continue; }
  const kept = r.findings.filter(keep);
  const ignored = r.findings.length - kept.length;
  const note = ignored ? ` (проігноровано у незміненому коді: ${ignored})` : "";
  if (!kept.length) { pass++; console.log(`${r.id.padEnd(4)} PASS  ${r.title}${note}`); continue; }
  fail++;
  console.log(`${r.id.padEnd(4)} FAIL  ${r.title}${note}`);
  const seen = new Set();
  for (const f of kept) {
    const key = `${f.file}:${f.line}:${f.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`       ${f.file}:${f.line}  ${f.reason}`);
  }
}
console.log(`Підсумок: ${fail} FAIL, ${pass} PASS, ${na} N/A → exit ${fail ? 1 : 0}`);
process.exitCode = fail ? 1 : 0;
