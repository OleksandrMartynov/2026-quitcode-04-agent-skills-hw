"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LeadRow } from "@/lib/types";
import { StatusBadge } from "./status-badge";

type SortKey = "createdAt" | "fullName" | "company";

const dateFormat = new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium" });

export function LeadsTable({ leads }: { leads: LeadRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [descending, setDescending] = useState(true);

  const sorted = [...leads].sort((a, b) => {
    const order = a[sortKey].localeCompare(b[sortKey], "uk");
    return descending ? -order : order;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(key === "createdAt");
    }
  }

  function header(key: SortKey, label: string) {
    const arrow = sortKey === key ? (descending ? " ↓" : " ↑") : "";
    return (
      <th className="px-4 py-2 text-left font-medium">
        <button type="button" onClick={() => toggleSort(key)} className="hover:text-slate-900">
          {label}
          {arrow}
        </button>
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {header("fullName", "Контакт")}
            {header("company", "Компанія")}
            <th className="px-4 py-2 text-left font-medium">Статус</th>
            {header("createdAt", "Створено")}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => router.push(`/dashboard/leads/${lead.id}`)}
              className="cursor-pointer hover:bg-slate-50"
            >
              <td className="px-4 py-2 font-medium">{lead.fullName}</td>
              <td className="px-4 py-2 text-slate-600">{lead.company}</td>
              <td className="px-4 py-2">
                <StatusBadge status={lead.status} />
              </td>
              <td className="px-4 py-2 text-slate-500">{dateFormat.format(new Date(lead.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
