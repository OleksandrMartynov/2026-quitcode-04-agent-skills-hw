"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 5_000;

/** Re-renders the status page from the server while the quote is still being prepared. */
export function QuoteStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
