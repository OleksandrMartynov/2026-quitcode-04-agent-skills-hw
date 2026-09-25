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
  version: "0.1.0"
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
   1. **Сесія й права.** Форма дашборду: `getCurrentUser()` (у LeadDesk — `lib/data.ts`, без сесії робить
      redirect на `/login`) і перевірка, що запис належить воркспейсу користувача. Публічна форма сесії не має
      за призначенням — це явно видно з коду (коментар), захист — валідація й відсутність даних у відповіді.
      Перевірки сторінки, `proxy.ts` чи атрибути `required`/`maxLength` у браузері дію **не** захищають.
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
   - Успіх — повідомлення з `role="status"` (або `aria-live="polite"`).
4. **Журнали без персональних даних**: лише подія й ідентифікатор (`console.info("feedback.saved", { recordId })`).
   Ніколи `console.log(formData)`, email, телефон, текст полів, IP, cookie.
5. **Повільне — після відповіді** (`server-after-nonblocking`): листи, аудит, виклики n8n/CRM —
   `after(() => …)` з `next/server`. Запис, без якого відповідь неправдива, — до відповіді, не в `after()`.

```tsx
// actions.ts (скорочено; назви — приклад)
"use server";
export async function saveFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const user = await getCurrentUser();                               // 1. сесія
  const record = await findOwnRecord(user, formData.get("recordId")); //    права: запис свого воркспейсу
  if (!record) return { status: "invalid", errors: { form: "Запис недоступний" }, values: {} };
  const parsed = parseFeedbackForm(formData);   // 2. валідація: { ok: true, data } | { ok: false, errors, values }
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };
  await db.saveFeedback(record.id, parsed.data);                     // 3. запис
  after(() => logAudit("feedback.saved", record.id));                //    повільне — після відповіді
  revalidatePath(`/dashboard/records/${record.id}`);
  return { status: "ok" };                                           // 4. лише стан
}
```

```tsx
// feedback-form.tsx (скорочено)
"use client";
const initialState: FeedbackState = { status: "idle" };
export function FeedbackForm({ recordId }: { recordId: string }) {
  const [state, formAction, pending] = useActionState(saveFeedback, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : {};
  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="recordId" value={recordId} />
      {state.status === "invalid" && (
        <div role="alert"><ul>{Object.values(errors).map((m) => <li key={m}>{m}</li>)}</ul></div>
      )}
      <label htmlFor="message">Повідомлення</label>
      <textarea id="message" name="message" defaultValue={values.message}
        aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "message-error" : undefined} />
      {errors.message && <p id="message-error">{errors.message}</p>}
      <button type="submit" disabled={pending}>{pending ? "Надсилаємо…" : "Надіслати"}</button>
      {state.status === "ok" && <p role="status">Надіслано</p>}
    </form>
  );
}
```

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
