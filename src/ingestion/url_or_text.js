/* url_or_text.js — v1.0.2 (stable)
   - If input looks like a URL, try to fetch it client-side (CORS permitting).
   - Else return the raw text unchanged.
   - Phase hooks are optional (kept as simple pass-throughs).
*/
/* eslint-disable */

// Optional phase transform — keep as no-op for now
export function phase1Transform(s) {
  return String(s ?? "");
}

function looksLikeUrl(s) {
  return /^https?:\/\/\S+/i.test(s || "");
}

export async function ingestFromUrlOrHtml(input /*, packs */) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";

  // If it looks like a URL, try to fetch; otherwise treat as raw HTML/text
  if (looksLikeUrl(raw)) {
    try {
      const res = await fetch(raw, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // Super-naive <body> text extraction fallback
      const textOnly = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      return phase1Transform(textOnly);
    } catch (_e) {
      // If fetch fails (CORS, network), just return the original string
      return phase1Transform(raw);
    }
  }
  // Not a URL: already text/HTML pasted by user
  return phase1Transform(raw);
}