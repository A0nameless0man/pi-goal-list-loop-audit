/** Bounded prose only: never serialize provider objects or exception stacks.
 * Shared by retry journals and progress telemetry; redaction precedes truncation. */
export function safeDiagnostic(value: unknown, limit = 600): string | undefined {
  let text = typeof value === "string" ? value : value instanceof Error ? value.message : undefined;
  if (text === undefined) return undefined;
  text = text.slice(0, 16_384)
    .replace(/\x1b(?:\][^\x07]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~])|\x9b[0-?]*[ -/]*[@-~]/g, "")
    .replace(/-----BEGIN [^-\r\n]+-----[\s\S]*?(?:-----END [^-\r\n]+-----|$)/g, "REDACTED-PEM")
    .replace(/^\s*at\s+.*$/gm, "")
    .replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, " ");
  // Objects embedded as JSON are not a diagnostic contract. Project only the
  // message/error string, then apply the same credential filters below.
  if (/^\s*[\[{]/.test(text)) {
    try {
      const payload = JSON.parse(text);
      const message = payload?.message ?? payload?.error?.message ?? payload?.error;
      return typeof message === "string" ? safeDiagnostic(message, limit) : "Structured error payload omitted";
    } catch { return "Structured error payload omitted"; }
  }
  text = text
    .replace(/\{\s*["'][\s\S]*$/, "structured payload omitted")
    .replace(/https?:\/\/[^\s<>"']+/gi, url => url.replace(/(\/\/)[^/@\s]+@/, "$1REDACTED@").replace(/[?#].*$/, "?REDACTED"))
    .replace(/\b(?:authorization|proxy-authorization)\s*["']?\s*[:=]\s*(?:["'][^"']*(?:["']|$)|(?:Bearer|Basic)\s+[^\s,;]+|[^\s,;]+)/gi, "authorization=REDACTED")
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;"']+/gi, "Bearer REDACTED")
    .replace(/\bsk-[\w-]+/g, "REDACTED")
    .replace(/\b(api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|token|password|passwd|secret|credential(?:s)?|cookie|signature|x-amz-[\w-]+)\s*["']?\s*[:=]\s*(?:["'][^"']*(?:["']|$)|[^\s,;]+)/gi, "$1=REDACTED")
    .replace(/<[^>]*(?:>|$)/g, " ")
    .replace(/[`*_\[\]{}]/g, " ")
    .replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : undefined;
}
