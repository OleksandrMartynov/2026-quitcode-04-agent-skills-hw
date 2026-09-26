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
                            знахідка до виклику fetch рахується, якщо змінено будь-який його рядок;
                            знахідка «чого бракує у файлі» — якщо файл змінено)
  -h, --help                ця довідка

Перевірки (деталі — SKILL.md і references/ цього скіла):
  C1  тестовий URL /webhook-test/ у коді чи .env.example
  C2  змінні N8N_* лише на сервері (NEXT_PUBLIC_, "use client", next.config env, секрет у query, фолбек секрету)
  C3  .env.example: ключі контракту, база на /webhook, секрети change-me-…, змінні з коду оголошено
  C4  виклики n8n лише з lib/n8n/client.* з import "server-only" першим рядком
  C5  кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)
  C6  заголовки content-type, x-n8n-token, idempotency-key (не генерується в заголовках), x-correlation-id
  C7  відповідь n8n оцінюється за кодом; ≤ 3 спроби; повтор лише для мережі/таймауту/5xx/524
  C8  тіло — конверт { version, event, data } без зайвих персональних і технічних полів
  C9  Server Action не чекає n8n: виклик лише в after()
  C10 жодного runtime = "edge"
  C11 колбек читає сире тіло (.text()) і не парсить JSON до перевірки підпису
  C12 колбек перевіряє HMAC-SHA256 над \${timestamp}.\${raw}: довжина + timingSafeEqual, без ===
  C13 колбек: вікно 300 с, claim idempotency-key, 200 duplicate, ключ = jobId:event, 202, стан до відповіді
  C14 журнали без тіл, персональних даних і секретів
  C15 колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl

Результат: рядок на перевірку (PASS / FAIL / N/A), для FAIL — файл:рядок і причина.
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

const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", ".claude", ".agents", ".cursor", ".codex", "out", "build",
  "coverage", ".vercel", "tools", "materials", "docs", "__tests__", "__fixtures__", "fixtures",
]);
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), out);
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
  const src = readFileSync(abs, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
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
    const open = m.index + m[0].length - 1;
    out.push({ start: m.index, open, close: closeOf(file.blank, open), args: argSpans(file.blank, open) });
  }
  return out;
}

function firstStatement(file) {
  const m = file.code.match(/^\s*(["'])(use (?:client|server))\1/);
  return m ? m[2] : null;
}

const files = walk(ROOT).map(loadFile);
const byPath = new Map(files.map((f) => [f.path, f]));
const envExamplePath = join(ROOT, ".env.example");
const envExample = existsSync(envExamplePath)
  ? readFileSync(envExamplePath, "utf8").replace(/\r\n/g, "\n").split("\n")
  : null;

// ---------------------------------------------------------------- facts

const ENV_RE = /process\.env(?:\.([A-Z0-9_]+)|\[\s*["'`]([A-Z0-9_]+)["'`]\s*\])/g;
const N8N_ENV = /N8N|WEBHOOK|WORKFLOW/;

function envReads(file) {
  const out = [];
  for (const m of file.code.matchAll(ENV_RE)) out.push({ name: m[1] ?? m[2], index: m.index });
  return out;
}

// outgoing n8n fetch calls, independent of names: URL from an N8N/WEBHOOK/WORKFLOW env var,
// a literal with /webhook or :5678, or a file that reads such a variable and fetches a non-relative URL
function n8nFetches(file) {
  const readsN8n = envReads(file).some((r) => N8N_ENV.test(r.name));
  return callsOf(file, "fetch").filter((call) => {
    if (!call.args.length) return false;
    const [a, b] = call.args[0];
    const firstCode = file.code.slice(a, b);
    if (/N8N_|n8n|\/webhook(-test)?\b|:5678/i.test(firstCode)) return true;
    if (/process\.env\.[A-Z0-9_]*(WEBHOOK|WORKFLOW)/.test(firstCode)) return true;
    const literalRelative = /^\s*["'`]\//.test(firstCode);
    return readsN8n && !literalRelative;
  });
}

const fetchSites = files.flatMap((f) => n8nFetches(f).map((call) => ({ file: f, call })));
const clientFiles = [...new Set(fetchSites.map((s) => s.file))];

// modules that call n8n: a local module that contains an n8n fetch, or (unresolved) a client-like path
const isN8nClientPath = (spec) => /n8n[/-]?client|webhook|workflow/i.test(spec);
function importsFromN8n(file) {
  const out = [];
  for (const m of file.code.matchAll(/import\s+(?!type\b)([\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    const spec = m[2];
    const target = resolveImport(file, spec);
    const n8nModule = target ? clientFiles.includes(target) : isN8nClientPath(spec);
    if (!n8nModule) continue;
    const names = [];
    const clause = m[1];
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) for (const part of braces[1].split(",")) {
      const p = part.trim().replace(/^type\s+/, "");
      if (!p || part.trim().startsWith("type ")) continue;
      const alias = p.split(/\s+as\s+/);
      names.push((alias[1] ?? alias[0]).trim());
    }
    const def = clause.replace(/\{[\s\S]*\}/, "").replace(/,/g, " ").trim().split(/\s+/)[0];
    if (def && def !== "*" && !def.startsWith("{")) names.push(def);
    const ns = clause.match(/\*\s+as\s+(\w+)/);
    if (ns) names.push(`${ns[1]}\\.\\w+`);
    out.push({ spec, names: names.filter(Boolean) });
  }
  return out;
}

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

// all n8n trigger sites: direct fetches + calls of functions imported from n8n modules
function triggerSites(file) {
  const sites = n8nFetches(file).map((call) => ({ call, kind: "fetch" }));
  for (const imp of importsFromN8n(file)) {
    if (!imp.names.length) continue;
    for (const call of callsOf(file, imp.names.join("|"))) sites.push({ call, kind: "import" });
  }
  return sites;
}

function isRouteFile(f) { return /(^|\/)app\/(.*\/)?route\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f.path); }
function exportsPost(f) {
  return /export\s+(async\s+)?function\s+POST\b|export\s+const\s+POST\b|export\s*\{[^}]*\bPOST\b[^}]*\}/.test(f.code);
}
const callbackRoutes = files.filter((f) => isRouteFile(f) && exportsPost(f)
  && (/n8n|callback|webhook/i.test(f.path) || /x-n8n-|n8n|callback|webhook|jobId|job_id/i.test(f.code)));

// route + its local imports (one hop) for checks that may live in helpers
function withHelpers(route) {
  const out = [route];
  for (const m of route.code.matchAll(/import\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g)) {
    const target = resolveImport(route, m[1]);
    if (target && !out.includes(target)) out.push(target);
  }
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

// C1
check("C1", "Тестовий URL /webhook-test/ відсутній у коді та .env.example", (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/\/webhook-test\/(?:[\w.-]+|\$\{)/g)) add(f.path, f.lineOf(m.index), "тестовий URL вебхука в коді");
  }
  envExample?.forEach((l, k) => {
    if (!l.trim().startsWith("#") && /webhook-test/.test(l)) add(".env.example", k + 1, `ключ ${l.split("=")[0].trim()} містить /webhook-test/`);
  });
});

// C2
check("C2", "Змінні N8N_* лише на сервері", (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/NEXT_PUBLIC_N8N_\w*/g)) add(f.path, f.lineOf(m.index), "змінна NEXT_PUBLIC_N8N_* потрапить у клієнтський бандл");
    if (firstStatement(f) === "use client") {
      for (const r of envReads(f)) if (N8N_ENV.test(r.name)) add(f.path, f.lineOf(r.index), `"use client"-модуль читає process.env.${r.name}`);
      for (const m of f.code.matchAll(/import\s+(?!type\b)[\s\S]*?\s+from\s+["']([^"']*(?:^|[/@])n8n(?:\/[^"']*)?)["']/g)) add(f.path, f.lineOf(m.index), `"use client"-модуль імпортує ${m[1]}`);
    }
    if (/(^|\/)next\.config\.[a-z]+$/.test(f.path) && /\benv\s*:\s*\{[\s\S]*?N8N_/.test(f.code)) add(f.path, 1, "next.config env вбудовує N8N_* у клієнт");
    for (const m of f.code.matchAll(/[?&](token|secret|signature|sig)=/gi)) add(f.path, f.lineOf(m.index), `секрет у query string (${m[1]}=)`);
    for (const m of f.code.matchAll(/process\.env\.(N8N_WEBHOOK_TOKEN|N8N_CALLBACK_SECRET)\s*(\?\?|\|\|)\s*(["'`])/g)) {
      add(f.path, f.lineOf(m.index), `літеральний фолбек для ${m[1]}`);
    }
  }
  envExample?.forEach((l, k) => { if (/^\s*(export\s+)?NEXT_PUBLIC_N8N_/.test(l)) add(".env.example", k + 1, "ключ NEXT_PUBLIC_N8N_*"); });
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
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    if (!/(^|\/)lib\/n8n\/client\.(ts|mts|js|mjs)$/.test(file.path)) add(file.path, file.lineOf(call.start), "fetch до n8n поза lib/n8n/client.*", "line", callEnd(file, call));
  }
  for (const f of clientFiles) {
    if (!/^\s*import\s+(["'])server-only\1/.test(f.code)) add(f.path, 1, 'модуль, що викликає n8n, не починається з import "server-only"');
  }
});

// C5
check("C5", "Кожна спроба виклику n8n має AbortSignal.timeout(≤ 10 000)", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const opts = call.args[1] ? file.code.slice(...call.args[1]) : "";
    const line = file.lineOf(call.start);
    let timeout = opts.match(/AbortSignal\.timeout\(\s*([\d_]+)?/);
    if (!timeout) {
      const id = opts.match(/signal\s*:\s*([A-Za-z_$][\w$]*)/) ?? (/\bsignal\b(?!\s*:)/.test(opts) ? [null, "signal"] : null);
      if (id) {
        const def = file.code.match(new RegExp(`\\b${id[1]}\\s*=\\s*AbortSignal\\.timeout\\(\\s*([\\d_]+)?`));
        if (def) {
          timeout = def;
          const defIdx = file.code.search(new RegExp(`\\b${id[1]}\\s*=\\s*AbortSignal\\.timeout`));
          const loop = enclosingLoop(file, call.start);
          if (loop && (defIdx < loop.bodyStart || defIdx > loop.bodyEnd)) add(file.path, file.lineOf(defIdx), "сигнал таймауту створено поза циклом повторів — наступні спроби без таймауту");
        }
      }
    }
    if (!timeout) { add(file.path, line, "fetch до n8n без signal: AbortSignal.timeout(...)", "line", callEnd(file, call)); continue; }
    if (timeout[1] && Number(timeout[1].replace(/_/g, "")) > 10_000) add(file.path, line, "таймаут понад 10 000 мс", "line", callEnd(file, call));
  }
});

function enclosingLoop(file, idx) {
  let best = null;
  for (const m of file.blank.matchAll(/\b(for|while)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const headClose = closeOf(file.blank, open);
    if (headClose === -1) continue;
    const bodyStartBrace = file.blank.slice(headClose + 1).search(/\S/) + headClose + 1;
    if (file.blank[bodyStartBrace] !== "{") continue;
    const bodyEnd = closeOf(file.blank, bodyStartBrace);
    if (bodyStartBrace < idx && idx < bodyEnd && (!best || bodyStartBrace > best.bodyStart)) {
      best = { head: file.code.slice(open + 1, headClose), bodyStart: bodyStartBrace, bodyEnd };
    }
  }
  return best;
}

function constValue(file, name) {
  const m = file.code.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*([\\d_]+)\\b`));
  if (m) return Number(m[1].replace(/_/g, ""));
  const arr = file.code.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`));
  if (arr) return arr[1].split(",").filter((x) => x.trim()).length;
  return null;
}

// C6
const HEADER_NAMES = ["content-type", "x-n8n-token", "idempotency-key", "x-correlation-id"];
check("C6", "Заголовки контракту у виклику n8n", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const lower = file.code.toLowerCase();
    const missing = HEADER_NAMES.filter((h) => !lower.includes(`"${h}"`) && !lower.includes(`'${h}'`));
    if (missing.length) add(file.path, file.lineOf(call.start), `немає заголовків: ${missing.join(", ")}`, "line", callEnd(file, call));
    for (const m of file.code.matchAll(/["']idempotency-key["']\s*:\s*(?:crypto\.)?(randomUUID|uuid|v4|nanoid|Date\.now)\s*\(/gi)) {
      add(file.path, file.lineOf(m.index), "idempotency-key генерується в заголовках — у повторах і повторних операціях ключ буде інший");
    }
  }
});

// C7
check("C7", "Відповідь n8n — за кодом, ≤ 3 спроби, повтор лише мережа/таймаут/5xx/524", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const line = file.lineOf(call.start);
    const before = file.blank.slice(Math.max(0, call.start - 40), call.start);
    if (/(^|[;{}\n])\s*(await\s+|void\s+)?$/.test(before) && !/(=|return|\(|,|\?|:)\s*(await\s+)?$/.test(before)) {
      add(file.path, line, "результат fetch до n8n відкидається — код статусу не перевіряється", "line", callEnd(file, call));
    }
    const loop = enclosingLoop(file, call.start);
    if (!loop) add(file.path, line, "немає повторів для мережевих помилок, таймауту, 5xx і 524", "line", callEnd(file, call));
    else {
      const body = file.code.slice(loop.bodyStart, loop.bodyEnd);
      if (!/(>=|<)\s*500\b|>\s*499\b|\b524\b|\.status\s*>=\s*5\d\d/.test(body)) add(file.path, line, "повтори без перевірки на 5xx/524 — повторюватимуться й 4xx");
      const h = loop.head.match(/let\s+\w+\s*=\s*(\d+)\s*;\s*\w+\s*(<=|<)\s*([\w.]+)(\s*\+\s*1)?/);
      if (h) {
        let bound = /^\d+$/.test(h[3]) ? Number(h[3]) : constValue(file, h[3].replace(/\.length$/, ""));
        if (bound !== null) {
          if (h[4]) bound += 1;
          const attempts = h[2] === "<=" ? bound - Number(h[1]) + 1 : bound - Number(h[1]);
          if (attempts > 3) add(file.path, line, `спроб більше трьох (${attempts})`);
        }
      }
    }
  }
  for (const f of clientFiles) for (const m of f.code.matchAll(/Workflow (was|got) started/g)) add(f.path, f.lineOf(m.index), "розбір тексту відповіді n8n замість коду статусу");
});

// C8
const FORBIDDEN_DATA = /\b(ipAddress|userAgent|rawPayload|internalNotes|acceptLanguage)\b/;
check("C8", "Тіло — конверт { version, event, data } з мінімальними data", (add) => {
  if (!fetchSites.length) return "викликів n8n у коді не знайдено";
  for (const { file, call } of fetchSites) {
    const opts = call.args[1] ? file.code.slice(...call.args[1]) : "";
    const bodyProp = opts.match(/\bbody\s*:\s*([^,}\n]+)|\bbody\b(?=\s*[,}])/);
    const envelopeInFile = /\bversion\s*:\s*[\w$]+/.test(file.code) && /\bevent\b/.test(file.code) && /\bdata\b/.test(file.code);
    const stringify = callsOf(file, "JSON\\.stringify").filter((s) => s.args.length);
    const envelope = stringify.some((s) => /\bversion\b/.test(file.code.slice(...s.args[0])));
    const optsStart = call.args[1] ? call.args[1][0] : call.start;
    if (!envelope && !envelopeInFile) add(file.path, file.lineOf(optsStart + (bodyProp?.index ?? 0)), "тіло не має конверта { version, event, data }", "line", callEnd(file, call));
    for (const s of stringify) {
      const text = file.code.slice(...s.args[0]).trim();
      if (FORBIDDEN_DATA.test(text)) add(file.path, file.lineOf(s.start), "у тілі для n8n — IP/user agent/сирі дані/нотатки");
      else if (/^[A-Za-z_$][\w$]*$/.test(text) && !envelope && !/^(envelope|payload|message)$/.test(text)) add(file.path, file.lineOf(s.start), `у n8n іде цілий об'єкт ${text}, а не мінімальні data`);
    }
  }
  for (const f of files) for (const site of triggerSites(f).filter((s) => s.kind === "import")) {
    for (const [a, b] of site.call.args) {
      const text = f.code.slice(a, b);
      if (FORBIDDEN_DATA.test(text)) add(f.path, f.lineOf(a), "у data для n8n — IP/user agent/сирі дані/нотатки");
      else if (/^\s*\{[^}]*\.\.\.\s*[A-Za-z_$]/.test(text)) add(f.path, f.lineOf(a), "у data для n8n розгортається цілий запис (...spread)");
    }
  }
});

// C9
check("C9", "Server Action не чекає n8n: виклик лише в after()", (add) => {
  const actions = files.filter((f) => firstStatement(f) === "use server");
  let any = false;
  for (const f of actions) {
    const afterSpans = callsOf(f, "after|unstable_after").map((c) => [c.open, c.close]);
    for (const site of triggerSites(f)) {
      any = true;
      const inside = afterSpans.some(([a, b]) => site.call.start > a && site.call.start < b);
      if (!inside) add(f.path, f.lineOf(site.call.start), 'Server Action чекає n8n — перенести виклик у after() з "next/server"');
    }
  }
  if (!any) return "Server Actions не викликають n8n";
});

// C10
check("C10", 'Без export const runtime = "edge"', (add) => {
  for (const f of files) {
    for (const m of f.code.matchAll(/export\s+const\s+runtime\s*=\s*["'`](experimental-)?edge["'`]/g)) add(f.path, f.lineOf(m.index), 'runtime = "edge" (deprecated у Next.js 16, немає node:crypto)');
    for (const m of f.code.matchAll(/export\s+const\s+config\s*=\s*\{[^}]*runtime\s*:\s*["'`](experimental-)?edge/g)) add(f.path, f.lineOf(m.index), "config.runtime = edge");
  }
});

// C11
check("C11", "Колбек читає сире тіло й не парсить JSON до перевірки підпису", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів (POST route з n8n/callback/webhook) не знайдено";
  for (const f of callbackRoutes) {
    for (const m of f.code.matchAll(/\.(json|formData)\s*\(\s*\)/g)) {
      const pre = f.code.slice(Math.max(0, m.index - 30), m.index);
      if (/\b(req|request|\w*[Rr]eq\w*)\s*$/.test(pre) || /await\s+\w+\s*$/.test(pre)) add(f.path, f.lineOf(m.index), `тіло читається через .${m[1]}() — підпис рахується від сирого тексту`);
    }
    if (!/\.(text|arrayBuffer)\s*\(\s*\)/.test(f.code)) add(f.path, 1, "тіло не читається як сирий текст (.text())");
    const verifyIdx = verificationPoint(f);
    for (const m of f.code.matchAll(/JSON\.parse\s*\(/g)) {
      if (verifyIdx === -1 || m.index < verifyIdx) {
        // parse inside a helper defined in this file but called after verification is fine
        if (verifyIdx !== -1 && calledAfter(f, m.index, verifyIdx)) continue;
        add(f.path, f.lineOf(m.index), "JSON.parse до перевірки підпису");
      }
    }
  }
});

function verificationPoint(f) {
  const idx = [];
  const direct = f.code.search(/timingSafeEqual\s*\(/);
  // position of the first CALL of a verifier function (by name), not its definition
  for (const m of f.blank.matchAll(/(?<![\w$.])(verify\w*|\w*[Ss]ignature\w*|\w*[Hh]mac\w*)\s*\(/g)) {
    const before = f.code.slice(Math.max(0, m.index - 10), m.index);
    if (/function\s+$/.test(before)) continue;
    idx.push(m.index);
  }
  if (direct !== -1) {
    const fnStart = enclosingFunctionStart(f, direct);
    const name = fnStart?.name;
    if (!name || name === "POST") idx.push(direct);
  }
  return idx.length ? Math.min(...idx) : -1;
}

function enclosingFunctionStart(f, idx) {
  let best = null;
  for (const m of f.blank.matchAll(/function\s+([\w$]+)\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const headClose = closeOf(f.blank, open);
    const brace = f.blank.indexOf("{", headClose);
    const end = closeOf(f.blank, brace);
    if (brace < idx && idx < end && (!best || brace > best.brace)) best = { name: m[1], brace, end };
  }
  return best;
}

// JSON.parse sits inside a helper whose first call in POST happens after verification
function calledAfter(f, parseIdx, verifyIdx) {
  const fn = enclosingFunctionStart(f, parseIdx);
  if (!fn || fn.name === "POST") return false;
  const calls = [...f.blank.matchAll(new RegExp(`(?<![\\w$.])${fn.name}\\s*\\(`, "g"))]
    .map((m) => m.index).filter((i) => !/function\s+$/.test(f.code.slice(Math.max(0, i - 10), i)));
  return calls.length > 0 && calls.every((i) => i > verifyIdx);
}

// C12
check("C12", "Колбек перевіряє HMAC-SHA256 над ${timestamp}.${raw} з timingSafeEqual", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів не знайдено";
  for (const route of callbackRoutes) {
    const group = withHelpers(route);
    const all = group.map((g) => g.code).join("\n");
    const at = (re) => { for (const g of group) { const i = g.code.search(re); if (i !== -1) return [g, i]; } return null; };
    const hmac = at(/createHmac\s*\(\s*["'`]sha256["'`]\s*,/);
    if (!hmac) add(route.path, 1, "немає createHmac(\"sha256\", секрет)");
    else {
      const [g, i] = hmac;
      const argsText = g.code.slice(i, i + 200);
      if (/createHmac\s*\(\s*["'`]sha256["'`]\s*,\s*["'`]/.test(argsText)) add(g.path, g.lineOf(i), "ключ HMAC — літерал, а не N8N_CALLBACK_SECRET");
      if (!/\$\{[^}]+\}\.\$\{[^}]+\}|\+\s*["'`]\.["'`]\s*\+/.test(all)) add(g.path, g.lineOf(i), "HMAC рахується не від `${timestamp}.${raw}`");
    }
    const tse = at(/timingSafeEqual\s*\(/);
    if (!tse) add(route.path, 1, "немає crypto.timingSafeEqual");
    else {
      const [g, i] = tse;
      const fn = enclosingFunctionStart(g, i);
      const scope = fn ? g.code.slice(fn.brace, i) : g.code.slice(Math.max(0, i - 400), i);
      const sameChain = g.code.slice(Math.max(0, i - 160), i);
      if (!/\.(byte)?[Ll]ength\s*(!==|===|!=|==|<|>)|(!==|===|!=|==)\s*[\w$.]+\.(byte)?[Ll]ength/.test(scope + sameChain)) add(g.path, g.lineOf(i), "немає перевірки довжини перед timingSafeEqual");
    }
    for (const g of group) for (const m of g.code.matchAll(/([\w$.\[\]"'`]+)\s*(===|!==|==|!=)\s*([\w$.\[\]"'`]+)/g)) {
      const [, left, , right] = m;
      const operand = (s) => /sig|signature|hmac|digest/i.test(s) && !/\.(byte)?length$/i.test(s) && !/^(null|undefined|""|''|``)$/.test(s);
      if ((operand(left) || operand(right)) && !/typeof/.test(g.code.slice(Math.max(0, m.index - 8), m.index))) add(g.path, g.lineOf(m.index), `підпис порівнюється через ${m[2]}`);
    }
  }
});

// C13
check("C13", "Колбек: вікно 300 с, ідемпотентність, ключ = jobId:event, 202, стан до відповіді", (add) => {
  if (!callbackRoutes.length) return "колбек-роутів не знайдено";
  for (const route of callbackRoutes) {
    const all = withHelpers(route).map((g) => g.code).join("\n");
    const lower = all.toLowerCase();
    if (!lower.includes("x-n8n-timestamp")) add(route.path, 1, "не читається x-n8n-timestamp");
    if (!/\b300\b|\b300_?000\b|5\s*\*\s*60\b|WINDOW|TOLERANCE|MAX_AGE|SKEW/i.test(all) || !/Math\.abs|>\s*[\w$.]+[\s\S]{0,40}<\s*-|-\s*[\w$.]+\s*>/.test(all)) add(route.path, 1, "немає двостороннього вікна часу 300 с");
    if (!lower.includes("idempotency-key")) add(route.path, 1, "не читається idempotency-key");
    if (!/duplicate/.test(all)) add(route.path, 1, "повтор ключа не відповідає 200 { duplicate: true }");
    if (!/jobId\s*\}\s*:\s*\$\{|jobId\s*\+\s*["'`]:["'`]/.test(all)) add(route.path, 1, "idempotency-key не звіряється з `${data.jobId}:${event}` з підписаного тіла");
    if (!/status\s*:\s*202\b/.test(route.code)) add(route.path, 1, "успіх не відповідає 202");
    const afterSpans = callsOf(route, "after|unstable_after").map((c) => [c.open, c.close]);
    if (afterSpans.length) {
      const writes = [...route.blank.matchAll(/(?<![\w$.])(?:[\w$]+\.)?(save|update|insert|set|persist|store|mark|complete|upsert)\w*\s*\(/gi)]
        .map((m) => m.index).filter((i) => !/function\s+$/.test(route.code.slice(Math.max(0, i - 10), i)));
      if (writes.length && writes.every((i) => afterSpans.some(([a, b]) => i > a && i < b))) add(route.path, route.lineOf(afterSpans[0][0]), "стан зберігається лише в after() — n8n не повторить колбек після 2xx");
    }
  }
});

// C14
const BAD_ARG = /^(body|raw|rawBody|payload|envelope|formData|data|req|request|headers|lead|row|record|input|values|fields)$/;
const PII_PROP = /\.(email|phone|fullName|firstName|lastName|name|ipAddress|userAgent|message|text|notes?)\b/;
const SECRET_WORD = /\b(token|secret|signature|sig|hmac|authorization|cookie|password)\b/i;
check("C14", "Журнали без тіл, персональних даних і секретів", (add) => {
  for (const f of files) {
    for (const call of callsOf(f, "console\\.(?:log|info|warn|error|debug|trace)|logger\\.(?:log|info|warn|error|debug)")) {
      for (const [a, b] of call.args) {
        const arg = f.blank.slice(a, b).trim(); // strings blanked, ${…} kept
        const line = f.lineOf(a);
        if (BAD_ARG.test(arg)) { add(f.path, line, `у журнал іде цілий об'єкт ${arg}`); continue; }
        if (/process\.env|N8N_/.test(arg)) { add(f.path, line, "у журнал ідуть змінні середовища"); continue; }
        const idents = arg.replace(/\b(Buffer\.byteLength|createHash|sha256|Object\.keys)\s*\([^)]*\)/g, "");
        if (PII_PROP.test(idents)) { add(f.path, line, "у журнал ідуть персональні дані"); continue; }
        if (SECRET_WORD.test(idents.replace(/\.length\b/g, ""))) { add(f.path, line, "у журнал ідуть токен, підпис чи секрет"); continue; }
        const obj = arg.match(/^\{([\s\S]*)\}$/);
        if (obj) for (const part of obj[1].split(",")) {
          const p = part.trim();
          const value = p.includes(":") ? p.slice(p.indexOf(":") + 1).trim() : p;
          if (BAD_ARG.test(value)) add(f.path, line, `у журнал іде цілий об'єкт ${value}`);
        }
      }
    }
  }
});

// C15
check("C15", "Колбек лежить у app/api/n8n/[event]/route.*, якщо конверт шле callbackUrl", (add) => {
  const sendsCallback = files.filter((f) => /\bcallbackUrl\b/.test(f.code) && !isRouteFile(f));
  if (!sendsCallback.length && !callbackRoutes.length) return "колбеків у коді немає";
  const contractRoute = files.find((f) => /(^|\/)app\/api\/n8n\/\[event\]\/route\.(ts|tsx|js|mjs)$/.test(f.path));
  if (sendsCallback.length && !contractRoute) {
    const f = sendsCallback[0];
    add(f.path, f.lineOf(f.code.search(/\bcallbackUrl\b/)), "конверт шле callbackUrl, але app/api/n8n/[event]/route.* немає");
  }
  for (const r of callbackRoutes) if (r !== contractRoute) add(r.path, 1, "колбек-роут не за шляхом app/api/n8n/[event]/route.*");
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
