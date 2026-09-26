export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_SOURCES = [
  "website",
  "google-ads",
  "facebook-ads",
  "linkedin",
  "referral",
  "webinar",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export type Lead = {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  website: string;
  city: string;
  country: string;
  source: LeadSource;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  budget: number | null;
  message: string;
  status: LeadStatus;
  score: number;
  assignedTo: string | null;
  tags: string[];
  consentMarketing: boolean;
  ipAddress: string;
  userAgent: string;
  rawPayload: Record<string, unknown>;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  /** lead-created ids for n8n: created once with the lead, the same on any re-send of the event. */
  n8nIdempotencyKey?: string;
  n8nCorrelationId?: string;
};

/** Lead fields the dashboard table receives as RSC props (search loads its own set from /api/leads). */
export type LeadRow = Pick<Lead, "id" | "fullName" | "company" | "status" | "createdAt">;

export type NewLead = Omit<
  Lead,
  | "id"
  | "fullName"
  | "status"
  | "score"
  | "assignedTo"
  | "tags"
  | "internalNotes"
  | "createdAt"
  | "updatedAt"
>;

export type User = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager";
  workspaceSlug: string;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  plan: "starter" | "growth";
  timezone: string;
};

export type LeadStats = {
  total: number;
  byStatus: Record<LeadStatus, number>;
  last7Days: number;
  conversionRate: number;
  averageBudget: number;
};

export type SourceCount = {
  source: LeadSource;
  count: number;
};

export type QuoteStatus = "queued" | "processing" | "ready" | "failed";

export type Quote = {
  id: string;
  company: string;
  email: string;
  description: string;
  budget: number | null;
  status: QuoteStatus;
  /** Key of the outgoing n8n request: created once with the quote, reused by every retry. */
  idempotencyKey: string;
  correlationId: string;
  /** n8n execution id from the 202 response. */
  jobId: string | null;
  documentUrl: string | null;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NewQuote = Pick<Quote, "company" | "email" | "description" | "budget" | "idempotencyKey" | "correlationId">;

export type AuditEntry = {
  action: string;
  leadId: string;
  at: string;
};
