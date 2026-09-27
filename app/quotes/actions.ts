"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { triggerWorkflow } from "@/lib/n8n/client";
import { parseQuoteForm, type QuoteFormField, type QuoteFormValues } from "@/lib/quote-form";

export type RequestQuoteState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<QuoteFormField, string>>; values: QuoteFormValues };

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
    );
    if (result.ok) await db.setQuoteJob(quote.id, result.jobId);
    else await db.finishQuote(quote.id, { status: "failed", errorCode: "trigger_failed" });
  });

  // A redirect from the action also works without JavaScript (303 to the status page).
  redirect(`/quotes/${quote.id}`);
}
