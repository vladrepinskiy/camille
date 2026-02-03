export function safeJsonStringify(value: unknown): string | null {
  if (value === undefined) return null;

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}
