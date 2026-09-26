"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
import { parseLeadNote, type LeadNoteField } from "@/lib/lead-note";
import { triggerWorkflow } from "@/lib/n8n/client";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";

const PUBLIC_FORM_WORKSPACE_ID = "ws_studio_nova";

export type SubmitLeadState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<LeadFormField, string>> }
  | { status: "ok" };

export async function submitLead(
  _prevState: SubmitLeadState,
  formData: FormData,
): Promise<SubmitLeadState> {
  const parsed = parseLeadForm(formData);
  if (!parsed.ok) {
    return { status: "invalid", errors: parsed.errors };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0].trim() ?? "127.0.0.1";
  const userAgent = requestHeaders.get("user-agent") ?? "";

  const lead = await db.insertLead({
    ...parsed.data,
    // lead-created ids: once per lead, stored with it (team n8n contract), reused in retries and re-sends
    n8nIdempotencyKey: randomUUID(),
    n8nCorrelationId: randomUUID(),
    workspaceId: PUBLIC_FORM_WORKSPACE_ID,
    jobTitle: "",
    city: "",
    country: "",
    source: "website",
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ipAddress,
    userAgent,
    rawPayload: {
      form: { id: "contact-main", version: "2026-07", fields: parsed.data },
      request: {
        ip: ipAddress,
        userAgent,
        acceptLanguage: requestHeaders.get("accept-language"),
        receivedAt: new Date().toISOString(),
      },
    },
  });

  // lead-created is an informational event (Webhook "Immediately", no callback): the form does not wait
  // for n8n, and n8n gets only what the workflow needs — no email, phone, IP or raw form payload.
  const ids = { idempotencyKey: lead.n8nIdempotencyKey!, correlationId: lead.n8nCorrelationId! };
  after(async () => {
    const result = await triggerWorkflow(
      "lead-created",
      { leadId: lead.id, source: lead.source, company: lead.company, budget: lead.budget },
      ids,
    );
    if (!result.ok) console.error("n8n.out", { event: "lead-created", correlationId: ids.correlationId, status: result.status, error: "delivery_failed" });
  });

  after(() => logAudit("lead.created", lead.id)); // the visitor does not wait for the audit write

  return { status: "ok" };
}

export type LeadMutationState = { status: "ok" } | { status: "invalid" } | { status: "not_found" };

// Server Actions are public POST endpoints: the page's own checks do not cover them,
// so every mutation re-checks the session and that the lead is in the caller's workspace.
async function findOwnLead(id: unknown) {
  if (typeof id !== "string") return null;
  const user = await getCurrentUser();
  const [workspace, lead] = await Promise.all([
    getWorkspace({ slug: user.workspaceSlug }),
    getLead(id),
  ]);
  return lead && lead.workspaceId === workspace.id ? lead : null;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<LeadMutationState> {
  const lead = await findOwnLead(id);
  if (!lead) return { status: "not_found" };
  if (!(LEAD_STATUSES as readonly unknown[]).includes(status)) return { status: "invalid" };

  await db.updateLeadStatus(lead.id, status);
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok" };
}

export type AddLeadNoteState =
  | { status: "idle" }
  | {
      status: "invalid";
      errors: Partial<Record<LeadNoteField | "form", string>>;
      values: Partial<Record<LeadNoteField, string>>;
    }
  | { status: "ok" };

const LEAD_UNAVAILABLE = "Лід недоступний: його вже видалено або він з іншого воркспейсу.";

export async function addLeadNote(
  _prevState: AddLeadNoteState,
  formData: FormData,
): Promise<AddLeadNoteState> {
  const typed = formData.get("note");
  const values = { note: typeof typed === "string" ? typed : "" };

  const lead = await findOwnLead(formData.get("leadId"));
  if (!lead) return { status: "invalid", errors: { form: LEAD_UNAVAILABLE }, values };

  const parsed = parseLeadNote(formData);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values: parsed.values };

  const saved = await db.appendLeadNote(lead.id, parsed.note);
  if (!saved) return { status: "invalid", errors: { form: LEAD_UNAVAILABLE }, values };

  after(() => logAudit("lead.note_added", lead.id));
  revalidatePath(`/dashboard/leads/${lead.id}`);
  return { status: "ok" };
}

export async function deleteLead(id: string): Promise<LeadMutationState> {
  const lead = await findOwnLead(id);
  if (!lead) return { status: "not_found" };

  await db.deleteLead(lead.id);
  revalidatePath("/dashboard");
  return { status: "ok" };
}
