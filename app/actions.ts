"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, getLead, getWorkspace } from "@/lib/data";
import { parseLeadForm, type LeadFormField } from "@/lib/lead-form";
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

  try {
    await fetch(process.env.N8N_WEBHOOK_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (error) {
    console.error(`Failed to send lead ${lead.id} to n8n`, error);
  }

  await logAudit("lead.created", lead.id);

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

export async function deleteLead(id: string): Promise<LeadMutationState> {
  const lead = await findOwnLead(id);
  if (!lead) return { status: "not_found" };

  await db.deleteLead(lead.id);
  revalidatePath("/dashboard");
  return { status: "ok" };
}
