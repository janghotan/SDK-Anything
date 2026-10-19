export function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function trimWhitespace(s: string): string {
  return s.trim();
}
