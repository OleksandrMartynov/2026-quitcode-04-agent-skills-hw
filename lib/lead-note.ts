export const NOTE_MAX_LENGTH = 500;

export type LeadNoteField = "note";

export type LeadNoteParseResult =
  | { ok: true; note: string }
  | { ok: false; errors: Partial<Record<LeadNoteField, string>>; values: Partial<Record<LeadNoteField, string>> };

export function parseLeadNote(formData: FormData): LeadNoteParseResult {
  const raw = formData.get("note");
  // Browsers submit textarea line breaks as CRLF; count them as one character, like `maxLength` does.
  const note = typeof raw === "string" ? raw.replace(/\r\n?/g, "\n").trim() : "";

  if (!note) return { ok: false, errors: { note: "Напишіть текст нотатки" }, values: { note } };
  if (note.length > NOTE_MAX_LENGTH) {
    return {
      ok: false,
      errors: { note: `Нотатка задовга: ${note.length} із ${NOTE_MAX_LENGTH} символів` },
      values: { note },
    };
  }

  return { ok: true, note };
}
