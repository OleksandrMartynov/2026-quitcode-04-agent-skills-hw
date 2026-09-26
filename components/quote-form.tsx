"use client";

import { useActionState } from "react";
import { requestQuote, type RequestQuoteState } from "@/app/quotes/actions";
import { BUDGET_OPTIONS } from "@/lib/lead-form";
import { QUOTE_LIMITS, type QuoteFormField } from "@/lib/quote-form";

const initialState: RequestQuoteState = { status: "idle" };

const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500";

export function QuoteForm() {
  // On success the action redirects to /quotes/<id>, so the form only ever shows validation errors.
  const [state, formAction, pending] = useActionState(requestQuote, initialState);
  const errors = state.status === "invalid" ? state.errors : {};
  const values = state.status === "invalid" ? state.values : undefined;
  const field = (name: QuoteFormField) => ({
    id: `quote-${name}`,
    name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `quote-${name}-error` : undefined,
  });
  const error = (name: QuoteFormField) =>
    errors[name] ? (
      <p id={`quote-${name}-error`} className="mt-1 text-xs text-red-600">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.status === "invalid" && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <ul className="list-disc pl-4">
            {Object.values(errors).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quote-company" className="block text-sm font-medium">
            Компанія
          </label>
          <input {...field("company")} autoComplete="organization" maxLength={QUOTE_LIMITS.company} defaultValue={values?.company} className={inputClass} />
          {error("company")}
        </div>
        <div>
          <label htmlFor="quote-email" className="block text-sm font-medium">
            Email
          </label>
          <input {...field("email")} type="email" autoComplete="email" maxLength={QUOTE_LIMITS.email} defaultValue={values?.email} className={inputClass} />
          {error("email")}
        </div>
      </div>

      <div>
        <label htmlFor="quote-description" className="block text-sm font-medium">
          Опис задачі
        </label>
        <textarea {...field("description")} rows={5} maxLength={QUOTE_LIMITS.description} defaultValue={values?.description} className={inputClass} />
        {error("description")}
      </div>

      <div>
        <label htmlFor="quote-budget" className="block text-sm font-medium">
          Бюджет
        </label>
        {/* key: React 19 resets the form after an action; a new defaultValue on <select> needs a remount */}
        <select {...field("budget")} key={values?.budget ?? ""} defaultValue={values?.budget ?? ""} className={inputClass}>
          {BUDGET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error("budget")}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Надсилаємо…" : "Запросити кошторис"}
      </button>
    </form>
  );
}
