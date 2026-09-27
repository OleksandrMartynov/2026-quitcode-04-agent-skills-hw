"use client";

import { useActionState, useState } from "react";
import { addLeadNote, type AddLeadNoteState } from "@/app/actions";
import { NOTE_MAX_LENGTH } from "@/lib/lead-note";

const initialState: AddLeadNoteState = { status: "idle" };

export function LeadNoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState(addLeadNote, initialState);
  // The answer the user has since edited the note against: its note error is stale. A new answer resets this.
  const [editedAfter, setEditedAfter] = useState<AddLeadNoteState | null>(null);
  const errors = state.status === "invalid" ? { ...state.errors } : {};
  if (editedAfter === state) delete errors.note;
  const values = state.status === "invalid" ? state.values : {};
  const messages = Object.values(errors);

  return (
    <form action={formAction} className="space-y-2" noValidate>
      <input type="hidden" name="leadId" value={leadId} />

      {messages.length > 0 && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          <ul className="list-disc pl-4">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <label htmlFor="note" className="block font-medium">
        Додати нотатку
      </label>
      <textarea
        id="note"
        name="note"
        rows={3}
        maxLength={NOTE_MAX_LENGTH}
        defaultValue={values.note}
        onChange={() => setEditedAfter(state)}
        aria-invalid={Boolean(errors.note)}
        aria-describedby={errors.note ? "note-hint note-error" : "note-hint"}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 aria-invalid:border-red-500"
      />
      <p id="note-hint" className="text-xs text-slate-500">
        До {NOTE_MAX_LENGTH} символів. Нотатку бачить лише команда.
      </p>
      {errors.note && (
        <p id="note-error" className="text-xs text-red-600">
          {errors.note}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Зберігаємо…" : "Додати нотатку"}
        </button>
        <p role="status" className="text-sm text-emerald-700">
          {state.status === "ok" ? "Нотатку додано" : ""}
        </p>
      </div>
    </form>
  );
}
