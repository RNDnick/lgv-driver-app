// Escapes free-text user input (job notes, feedback messages, etc.) before it
// goes into innerHTML - needed anywhere that text might be read by someone
// other than the person who typed it (a manager viewing another driver's
// data), where it stops being merely self-inflicted if left unescaped.
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
