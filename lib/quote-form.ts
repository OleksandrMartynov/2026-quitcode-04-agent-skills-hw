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

function text(formData: FormData, name: QuoteFormField, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseQuoteForm(formData: FormData): QuoteParseResult {
  const values: QuoteFormValues = {
    company: text(formData, "company", 120),
    email: text(formData, "email", 200).toLowerCase(),
    description: text(formData, "description", 2000),
    budget: text(formData, "budget", 10),
  };

  const errors: Partial<Record<QuoteFormField, string>> = {};

  if (!values.company) errors.company = "Вкажіть компанію";
  if (!EMAIL_RE.test(values.email)) errors.email = "Перевірте email";
  if (values.description.length < 10) errors.description = "Опишіть задачу хоча б одним реченням";
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
