import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE } from "./session";
import type { LeadRow } from "./types";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login");

  const user = await db.getUserBySession(sessionId);
  if (!user) redirect("/login");

  return user;
}

export const getWorkspace = cache(async ({ slug }: { slug: string }) => {
  const workspace = await db.getWorkspace(slug);
  if (!workspace) throw new Error(`Workspace "${slug}" not found`);
  return workspace;
});

export async function getLeadRows(workspaceId: string): Promise<LeadRow[]> {
  return db.getLeadRows(workspaceId); // projected in the store, not cut down from full records
}

export async function getLeadStats(workspaceId: string) {
  return db.getLeadStats(workspaceId);
}

export async function getSourceBreakdown(workspaceId: string) {
  return db.getSourceBreakdown(workspaceId);
}

export async function getLead(id: string) {
  return db.getLead(id);
}
