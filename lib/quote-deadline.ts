// The quote-request workflow runs 40–90 s; after this the status page stops polling and says the quote
// is late (a late callback is still accepted and shows up on the next visit).
export const QUOTE_DEADLINE_MS = 5 * 60_000;

export function isQuoteOverdue(createdAt: string, now = Date.now()) {
  return now - Date.parse(createdAt) > QUOTE_DEADLINE_MS;
}
