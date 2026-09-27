"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";
import { takeRateLimit } from "@/lib/rate-limit";

// Every accepted request starts a 40–90 s PDF workflow in n8n, so a script must not be able to post the
// public form without limit: at most QUOTES_PER_WINDOW requests per address per QUOTE_WINDOW_MS.
const QUOTES_PER_WINDOW = 5;
const QUOTE_WINDOW_MS = 10 * 60_000;

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField | "form", string>>; values: QuoteFormValues };

// Public form, like the lead form: no session to check. The quote id is a random UUID,
// so only whoever submitted the request knows the address of its status page.
export async function requestQuote(
  _prevState: RequestQuoteState,
  formData: FormData,
): Promise<RequestQuoteState> {
  const parsed = parseQuoteForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors, values: parsed.values };
  }

  // x-forwarded-for is set by the proxy in front of the app; without one every request counts as local.
  const address = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!takeRateLimit(`quote:${address}`, QUOTES_PER_WINDOW, QUOTE_WINDOW_MS)) {
    return {
      status: "invalid",
      errors: { form: "Забагато запитів за короткий час. Спробуйте ще раз за кілька хвилин." },
      values: { ...parsed.data, budget: parsed.data.budget === null ? "" : String(parsed.data.budget) }, // keep what was typed
    };
  }

  const quote = await db.insertQuote({
    ...parsed.data,
    idempotencyKey: randomUUID(),
    correlationId: randomUUID(),
  });

  // The workflow runs 40–90 s: n8n answers 202 at once and reports the result to /api/n8n/quote-request.
  // Even the 202 (with retries) is not worth waiting for, so the user gets the status page right away.
  // No email in data: the PDF link comes back in the callback and is shown on /quotes/[id], n8n writes to nobody.
  after(async () => {
    const result = await triggerWorkflow(
      "quote-request",
      { quoteId: quote.id, company: quote.company, description: quote.description, budget: quote.budget },
      { idempotencyKey: quote.idempotencyKey, correlationId: quote.correlationId },
      { callback: true },
    ).catch(() => null); // nobody awaits after(): an unexpected throw must still end the quote as failed
    // Only 202 with a job id means a callback is coming; anything else would leave the quote waiting forever.
    if (result?.ok && result.status === 202 && result.jobId) await db.setQuoteJob(quote.id, result.jobId);
    else await db.failQuoteTrigger(quote.id); // never over a result the callback has already saved
  });

  // A redirect from the action also works without JavaScript (303 to the status page).
  redirect(`/quotes/${quote.id}`);
}
