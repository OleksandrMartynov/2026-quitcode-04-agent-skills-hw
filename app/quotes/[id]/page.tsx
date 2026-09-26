import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteStatusRefresh } from "@/components/quote-status-refresh";
import { db } from "@/lib/db";
import { BUDGET_OPTIONS } from "@/lib/lead-form";
import type { QuoteStatus } from "@/lib/types";

const dateTimeFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" });

const STATUS_TEXT: Record<QuoteStatus, { title: string; hint: string; className: string }> = {
  queued: {
    title: "У черзі",
    hint: "Передаємо запит на підготовку кошторису.",
    className: "bg-slate-100 text-slate-700",
  },
  processing: {
    title: "Готуємо кошторис",
    hint: "Зазвичай це займає 1–2 хвилини. Сторінка оновиться сама.",
    className: "bg-amber-100 text-amber-800",
  },
  ready: {
    title: "Кошторис готовий",
    hint: "PDF можна завантажити за посиланням нижче.",
    className: "bg-emerald-100 text-emerald-800",
  },
  failed: {
    title: "Не вдалося підготувати кошторис",
    hint: "Спробуйте надіслати запит ще раз трохи пізніше.",
    className: "bg-red-100 text-red-800",
  },
};

export default async function QuotePage({ params }: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await db.getQuote(id);
  if (!quote) notFound();

  const status = STATUS_TEXT[quote.status];
  const pending = quote.status === "queued" || quote.status === "processing";
  const budget = BUDGET_OPTIONS.find((option) => option.value === String(quote.budget ?? ""))?.label;

  return (
    <div className="space-y-6">
      {pending && <QuoteStatusRefresh />}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Кошторис для {quote.company}</h1>
          <p className="text-sm text-slate-500">Запит від {dateTimeFormat.format(new Date(quote.createdAt))}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${status.className}`}>
          {status.title}
        </span>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm">
        <p className="text-slate-700">{status.hint}</p>
        {quote.status === "ready" && quote.documentUrl && (
          <a
            href={quote.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
          >
            Завантажити PDF
          </a>
        )}
        {quote.status === "failed" && (
          <Link href="/quotes/new" className="inline-block font-medium text-indigo-600 hover:text-indigo-800">
            Надіслати запит ще раз →
          </Link>
        )}
      </section>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Бюджет</dt>
          <dd className="font-medium">{budget ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-slate-500">Опис задачі</dt>
          <dd className="whitespace-pre-line text-slate-700">{quote.description}</dd>
        </div>
      </dl>
    </div>
  );
}
