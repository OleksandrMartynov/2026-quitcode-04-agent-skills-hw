import { QuoteForm } from "@/components/quote-form";

export default function NewQuotePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Запит на кошторис</h1>
        <p className="text-slate-600">
          Опишіть задачу — ми підготуємо PDF-кошторис. Зазвичай це займає до двох хвилин, статус
          видно на сторінці запиту.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <QuoteForm />
      </section>
    </div>
  );
}
