/**
 * Parser: Text Splitter
 * Splits recipe text into candidate instruction steps
 * Ported from Google Apps Script splitIntoCandidateSteps_()
 */

const BULLET_MARKERS = /^\s*(?:[•\-\*]|\d+[\.)]\s)/;
const SECTION_HEADERS = /^(?:ingredients?|directions?|method|instructions?|steps?|for the|meanwhile,? for|to finish|to serve|to assemble)[:.]?\s*$/i;
const TEMPORAL_CUES = /\b(?:meanwhile|then|next|after|while|once)\b/i;

/**
 * Split raw recipe text into individual instruction lines
 * @param {string} text - Raw recipe text
 * @returns {string[]} - Array of instruction strings
 */
export function splitIntoSteps(text) {
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const steps = [];

  for (let line of lines) {
    // Skip section headers
    if (SECTION_HEADERS.test(line)) {
      continue;
    }

    // Clean up the line
    const cleaned = line.replace(BULLET_MARKERS, "").trim();
    
    if (cleaned) {
      // Split compound actions if present (e.g., "X; Y")
      const split = splitCompoundActions(cleaned);
      steps.push(...split);
    }
  }

  return steps.filter(s => s && s.length > 3); // Filter very short steps
}

/**
 * Split compound actions joined by semicolons or temporal markers
 * e.g., "Heat oil; sauté onions" → ["Heat oil", "sauté onions"]
 * @param {string} text - Instruction text
 * @returns {string[]} - Array of split actions
 */
export function splitCompoundActions(text) {
  if (!text) return [];

  // Protect parenthetical content from splitting
  const masks = [];
  let masked = "";
  let depth = 0;
  let parenBuffer = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      if (depth === 0 && parenBuffer === "") {
        // Start of parenthetical
      }
      depth++;
      parenBuffer += ch;
    } else if (ch === ")") {
      parenBuffer += ch;
      depth--;
      if (depth === 0) {
        const token = `@@P${masks.length}@@`;
        masks.push(parenBuffer);
        masked += token;
        parenBuffer = "";
      }
    } else {
      if (depth > 0) {
        parenBuffer += ch;
      } else {
        masked += ch;
      }
    }
  }
  if (parenBuffer) masked += parenBuffer;

  // Split on semicolons and strong temporal markers
  const parts = masked
    .split(/(?:\s*;\s+|\.\s+then\s+|\.\s+next\s+|\s+and then\s+)/i)
    .map(p => p.trim())
    .filter(Boolean);

  // Unmask parentheticals
  const unmasked = parts.map(p =>
    p.replace(/@@P(\d+)@@/g, (m, idx) => masks[Number(idx)] || "")
  );

  // Merge very short fragments back
  const merged = [];
  for (const segment of unmasked) {
    const cleaned = segment.replace(/\s+/g, " ").trim();
    
    // If segment is very short (< 18 chars) and we have previous segments, append to previous
    if (cleaned.length < 18 && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1].replace(/\.?\s*$/, "")}; ${cleaned}`;
    } else {
      merged.push(cleaned);
    }
  }

  return merged;
}

/**
 * Clean instruction text (remove step numbers, etc.)
 * @param {string} text - Raw instruction
 * @returns {string} - Cleaned text
 */
export function cleanInstructionText(text) {
  return text
    .replace(/^\s*step\s*\d+\s*[:.\-–—]\s*/i, "")
    .replace(/^\s*\d+[\.)]\s*/, "")
    .replace(/^\s*[•\-\*]\s*/, "")
    .trim();
}

/**
 * Normalize text (fix unicode, fractions, etc.)
 * @param {string} text - Raw text
 * @returns {string} - Normalized text
 */
export function normalizeText(text) {
  const FRACTION_MAP = {
    "¼": "1/4", "½": "1/2", "¾": "3/4",
    "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
    "⅓": "1/3", "⅔": "2/3",
    "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
    "⅙": "1/6", "⅚": "5/6",
    "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8"
  };

  return text
    .replace(/\u2013|\u2014/g, "—") // Normalize dashes
    .replace(/\u2022|\u25CF|\u2219|\*/g, "•") // Normalize bullets
    .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, m => FRACTION_MAP[m] || m)
    .replace(/[ \t]+/g, " ") // Collapse spaces/tabs but preserve newlines
    .trim();
}
