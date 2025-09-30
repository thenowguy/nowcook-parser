/* eslint-disable */
import { ingestFromUrl, ingestFromHtml } from "./phase1";

export async function ingestFromUrlOrHtml(input, packs) {
  const trimmed = String(input).trim();
  if (/^https?:\/\/\S+/i.test(trimmed)) {
    return await ingestFromUrl(trimmed, packs);
  }
  // If it's HTML (has tags), treat as HTML; otherwise make a minimal HTML shell
  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
  const html = looksHtml ? trimmed : wrapAsHtml(trimmed);
  return ingestFromHtml(html, packs);
}

function wrapAsHtml(text) {
  // Try to detect Ingredients/Directions blocks in plain text
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;" }[c]));
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const title = lines[0] || "Imported Recipe";
  const body = esc(text);
  return `<!doctype html><html><head><title>${esc(title)}</title></head><body><pre>${body}</pre></body></html>`;
}