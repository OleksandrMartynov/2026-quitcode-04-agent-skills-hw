import { BUDGET_OPTIONS, EMAIL_RE } from "./lead-form";

export type QuoteFormField = "company" | "email" | "description" | "budget";

export type QuoteFormData = {
  company: string;
  email: string;
  description: string;
  budget: number | null;
};

/** Raw field values, sent back with errors so the form keeps what the user typed. */
export type QuoteFormValues = Record<QuoteFormField, string>;

export type QuoteParseResult =
  | { ok: true; data: QuoteFormData }
  | { ok: false; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

/** Length limits: a longer value is a field error, never silently cut. */
export const QUOTE_LIMITS = { company: 120, email: 200, description: 2000 } as const;

function text(formData: FormData, name: QuoteFormField) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values: QuoteFormValues = {
    company: text(formData, "company"),
    email: text(formData, "email").toLowerCase(),
    description: text(formData, "description"),
    budget: text(formData, "budget"),
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть компанію";
  else if (values.company.length > QUOTE_LIMITS.company) errors.company = `Назва задовга: ${values.company.length} із ${QUOTE_LIMITS.company} символів`;
  if (values.email.length > QUOTE_LIMITS.email) errors.email = `Email задовгий: ${values.email.length} із ${QUOTE_LIMITS.email} символів`;
  else if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (values.description.length < 10) errors.description = "Опишіть задачу хоча б одним реченням";
  else if (values.description.length > QUOTE_LIMITS.description) errors.description = `Опис задовгий: ${values.description.length} із ${QUOTE_LIMITS.description} символів`;
  if (values.budget && !BUDGET_OPTIONS.some((option) => option.value === values.budget)) {
    errors.budget = "Оберіть бюджет зі списку";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors, values };

  return {
    ok: true,
    data: {
      company: values.company,
      email: values.email,
      description: values.description,
      budget: values.budget ? Number(values.budget) : null,
    },
  };
}
