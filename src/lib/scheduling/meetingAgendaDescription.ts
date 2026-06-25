const NUCLEAS_AGENDA_START = /\n\nMeeting:\s/m;
const NUCLEAS_AGENDA_ONLY = /^Meeting:\s/m;

/**
 * Removes the auto-generated Nucleas agenda block from a calendar description,
 * returning only user-authored notes.
 */
export function stripNucleasAgendaFromDescription(text: string | undefined | null): string {
  if (!text?.trim()) return '';

  const agendaStart = text.search(NUCLEAS_AGENDA_START);
  if (agendaStart !== -1) {
    return text.slice(0, agendaStart).trim();
  }

  if (NUCLEAS_AGENDA_ONLY.test(text.trim())) {
    return '';
  }

  return text.trim();
}
