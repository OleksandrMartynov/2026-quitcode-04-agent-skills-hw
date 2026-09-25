---
name: building-client-form
description: >-
  Патерн команди для форм у Next.js 16 (App Router, React 19): Server Action перевіряє сесію, права й
  валідує дані всередині, useActionState, доступні помилки полів, введене не зникає, дія повертає лише
  { status, … }, без персональних даних у журналах, повільні побічні ефекти — в after().
  Use when додаєш або змінюєш форму, яка надсилає дані на сервер (публічна заявка, форма в дашборді,
  зворотний зв'язок, налаштування), або коли форма не працює без JavaScript, помилки не чути скрінрідеру,
  введене стирається після помилки чи відправка довго «думає».
  Тригери: «додай форму…», «форма заявки», «форма кошторису», «форма зворотного зв'язку»,
  «форма налаштувань», «помилки валідації не видно», «після помилки все стирається»,
  «форма не працює без JS».
  Не для: контракту з n8n і вебхуків (скіл integrating-n8n-webhooks), пошуку й фільтрів без запису на
  сервер, входу через стороннього провайдера.
metadata:
  owner: quitcode-agency
  version: "0.2.0"
---

# Клієнтська форма: один патерн для всіх проєктів

Кожна форма — це публічний POST-ендпоінт із персональними даними. Тому безпека й валідація живуть на
сервері, а доступність і робота без JavaScript — за замовчуванням, а не «потім». Правила Vercel, на яких
стоїть патерн, — у скілі `vercel-react-best-practices`; тут на них лише посилання за id.

## Коли застосовувати

- Нова або змінена форма, що записує дані через Server Action: заявка з сайту, форма в дашборді, налаштування.
- Скарги «помилки не видно», «введене зникає», «без JS не працює», «форма думає кілька секунд».
- **Не** застосовувати: пошук і фільтри без запису на сервер; контракт з n8n — скіл `integrating-n8n-webhooks`.

## Як робимо

1. **Server Action = публічний POST** (`server-auth-actions`). Файл із `"use server"` експортує лише
   async-функції й типи (`initialState` та інші константи — у клієнтському компоненті). Усередині дії,
   саме в такому порядку:
   1. **Сесія й права.** Форма за входом: функція сесії проєкту (знайди наявну; без сесії — redirect на вхід
      або відмова) і перевірка, що запис, який змінюють, належить воркспейсу чи власнику користувача. Публічна
      форма (заявка з сайту) сесії не має за призначенням — це явно видно з коду (коментар), а захист —
      валідація, ліміти й відсутність даних у відповіді. Перевірки сторінки, middleware/proxy чи атрибути
      `required`/`maxLength` у браузері дію **не** захищають.
   2. **Валідація кожного поля на сервері**: обов'язковість, тип, формат, довжина. Ліміт перевищено —
      помилка поля, а не мовчазне обрізання.
   3. **Запис** — до відповіді (це і є результат дії).
   4. **Відповідь** — лише стан форми (п. 2).
2. **Відповідь дії — мінімальна** (`server-serialization`): `{ status: "idle" }`, `{ status: "invalid",
   errors, values }` або `{ status: "ok" }`. Ніколи не повертати рядок з бази, id сесії чи зайві поля.
3. **Клієнтська форма**: `"use client"`; `const [state, formAction, pending] = useActionState(action,
   initialState)`; `<form action={formAction} noValidate>` — так вона працює й без JS, а помилки однаково
   показує серверна валідація. Кнопка `disabled={pending}`.
   - Кожне поле: `<label htmlFor>`, `id`, `name`, `aria-invalid={Boolean(error)}`,
     `aria-describedby={error ? "<id>-error" : undefined}`; текст помилки — окремий елемент з цим id, поза `<label>`.
   - Над формою — підсумок `<div role="alert">` зі списком помилок, коли `status === "invalid"`.
   - Введене не зникає: `defaultValue={values.<поле>}`; для `<select>` ще й `key={values.<поле>}` — React 19
     скидає неконтрольовані поля після дії, а новий `defaultValue` у `select` без перемонтування не діє.
     `values` повертаємо з **кожною** відмовою (і коли запис недоступний), не лише з помилками валідації.
   - Успіх — у `role="status"`, який **завжди** є в розмітці й отримує текст лише після успіху: область, що
     з'являється одразу з текстом, скрінрідери можуть не озвучити.
4. **Журнали без персональних даних**: лише подія й ідентифікатор (`console.info("feedback.saved", { recordId })`).
   Ніколи `console.log(formData)`, email, телефон, текст полів, IP, cookie.
5. **Повільне — після відповіді** (`server-after-nonblocking`): листи, аудит, виклики n8n/CRM —
   `after(() => …)` з `next/server`. Запис, без якого відповідь неправдива, — до відповіді, не в `after()`.

Приклад — публічна форма зворотного зв'язку (скорочено; назви — приклад):

```tsx
// app/contact/actions.ts
"use server";
import { after } from "next/server";

export async function sendFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  // Публічна форма: сесії немає за призначенням; захист — валідація й мінімальна відповідь.
  const parsed = parseFeedbackForm(formData); // { ok: true, data } | { ok: false, errors, values }
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };
  const saved = await db.insertFeedback(parsed.data);             // запис — до відповіді
  after(() => notifyTeam(saved.id));                              // лист/інтеграція — після відповіді
  console.info("feedback.received", { id: saved.id });            // лише подія й id
  return { status: "ok" };
}
```

```tsx
// app/contact/feedback-form.tsx
"use client";
const initialState: FeedbackState = { status: "idle" };
const TOPICS = [["", "Оберіть тему"], ["project", "Новий проєкт"], ["support", "Підтримка"]] as const;

export function FeedbackForm() {
  const [state, formAction, pending] = useActionState(sendFeedback, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};
  const field = (name: "email" | "topic" | "message") => ({
    id: name, name, "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  return (
    <form action={formAction} noValidate>
      {state.status === "invalid" && (
        <div role="alert"><ul>{Object.entries(errors).map(([k, m]) => <li key={k}>{m}</li>)}</ul></div>
      )}
      <label htmlFor="email">Email</label>
      <input type="email" autoComplete="email" defaultValue={values.email} {...field("email")} />
      {errors.email && <p id="email-error">{errors.email}</p>}
      <label htmlFor="topic">Тема</label>
      <select key={values.topic ?? ""} defaultValue={values.topic ?? ""} {...field("topic")}>
        {TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {errors.topic && <p id="topic-error">{errors.topic}</p>}
      <label htmlFor="message">Повідомлення</label>
      <textarea defaultValue={values.message} {...field("message")} />
      {errors.message && <p id="message-error">{errors.message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Надсилаємо…" : "Надіслати"}</button>
      <p role="status">{state.status === "ok" ? "Дякуємо, повідомлення надіслано" : ""}</p>
    </form>
  );
}
```

Форма за входом відрізняється лише початком дії: спершу сесія й перевірка, що запис належить користувачу
(інакше — `{ status: "invalid", errors: { form: "…недоступний" }, values }` з тим, що людина ввела), далі так само.

## Чекліст

```
- [ ] 1. Дія сама перевіряє сесію й права (або явно публічна) — server-auth-actions.
- [ ] 2. Кожне поле валідується на сервері; перевищений ліміт — помилка, а не обрізання.
- [ ] 3. Дія повертає лише { status, errors?, values? }.
- [ ] 4. useActionState + <form action>; кнопка заблокована під час pending.
- [ ] 5. Кожне поле: label, aria-invalid, aria-describedby; підсумок role="alert".
- [ ] 6. Після помилки введене на місці — і з JS, і без.
- [ ] 7. У журналах немає персональних даних.
- [ ] 8. Листи, аудит, інтеграції — в after(); критичний запис — до відповіді.
```

## Правила зупинки — зупинись і спитай людину, якщо:

- незрозуміло, хто має право надсилати форму (роль, воркспейс, публічна) — модель прав не вигадуй;
- для валідації чи форми потрібна нова npm-залежність;
- форма має приймати паролі, платіжні дані чи документи.

## Verify — задача готова, лише коли:

- [ ] `npm run lint` і `npm run build` без помилок.
- [ ] Порожня відправка: під кожним обов'язковим полем — помилка, у поля `aria-invalid="true"` і
      `aria-describedby`, над формою — підсумок `role="alert"`.
- [ ] Відправка з однією помилкою: інші введені значення лишились.
- [ ] DevTools → Settings → Debugger → Disable JavaScript: форма надсилається, помилки й значення показує сервер.
- [ ] Дія від користувача іншого воркспейсу або з підробленою cookie нічого не змінює.
- [ ] Журнал сервера (`npm start`) після відправки — без email, телефонів і тексту полів.
