export function decodeBase64(encoded: string): string {
  const cleaned = encoded.replace(/\n/g, '');
  try {
    return atob(cleaned);
  } catch {
    // Fallback for Unicode content
    const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
}
