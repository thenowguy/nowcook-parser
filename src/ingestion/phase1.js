/* Phase 1 ingestion: URL/HTML/JSON-LD → MealMap shape (uses your packs) */
/* eslint-disable */
export async function ingestFromUrl(url, packs) {
  const html = await fetchHtml(url);
  return ingestFromHtml(html, packs, { sourceUrl: url });
}

export function ingestFromHtml(html, packs, meta = {}) {
  const recipe = extractRecipeFromHtml(html);
  if (!recipe) {
    // Fall back to naive lists if no JSON-LD
    const { ingredients, instructions, title, author } = fallbackExtract(html);
    return recipeToMeal(
      {
        name: title || "Imported Recipe",
        author: author || "",
        recipeIngredient: ingredients,
        recipeInstructions: instructions.map((t) => ({ "@type": "HowToStep", text: t })),
      },
      packs,
      meta
    );
  }
  return recipeToMeal(recipe, packs, meta);
}

// -------------------- helpers --------------------
async function fetchHtml(url) {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return await res.text();
}

function extractRecipeFromHtml(html) {
  const scripts = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) scripts.push(m[1]);
  for (const raw of scripts) {
    try {
      const json = JSON.parse(sanitizeJsonLd(raw));
      const candidates = Array.isArray(json) ? json : [json, ...(Array.isArray(json["@graph"]) ? json["@graph"] : [])];
      const recipe = candidates.find((x) => typeIs(x, "Recipe"));
      if (recipe) return recipe;
    } catch {
      /* ignore malformed blocks */
    }
  }
  return null;
}

function sanitizeJsonLd(s) {
  // Some sites shove illegal trailing commas or HTML comment junk; keep it conservative.
  return s.replace(/<!--[\s\S]*?-->/g, "").trim();
}

function typeIs(node, t) {
  if (!node) return false;
  const v = node["@type"];
  if (typeof v === "string") return v.toLowerCase() === t.toLowerCase();
  if (Array.isArray(v)) return v.map(String).some((x) => x.toLowerCase() === t.toLowerCase());
  return false;
}

function textOf(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x.text === "string") return x.text;
  if (typeof x.name === "string") return x.name;
  return "";
}

function flattenInstructions(recipe) {
  const raw = recipe.recipeInstructions;
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const it of items) {
    if (typeIs(it, "HowToSection") && Array.isArray(it.itemListElement)) {
      for (const step of it.itemListElement) out.push(textOf(step).trim());
    } else if (typeIs(it, "HowToStep")) {
      out.push(textOf(it).trim());
    } else if (typeof it === "string") {
      out.push(it.trim());
    } else if (Array.isArray(it)) {
      for (const s of it) out.push(textOf(s).trim());
    }
  }
  return out.filter(Boolean);
}

function fallbackExtract(html) {
  const get = (re) => ((html.match(re) || [null, ""])[1] || "").replace(/<[^>]+>/g, "").trim();
  const title = get(/<title[^>]*>([\s\S]*?)<\/title>/i) || get(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const author = get(/<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)/i) || get(/by\s+([A-Za-z ]{2,40})</i);
  // naive sections:
  const ingBlock = get(/(?:Ingredients|INGREDIENTS)[\s\S]{0,200}?(<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>)/i);
  const dirBlock = get(/(?:Directions|Method|Instructions|DIRECTIONS|INSTRUCTIONS)[\s\S]{0,200}?(<ol[\s\S]*?<\/ol>|<ul[\s\S]*?<\/ul>)/i);

  const listItems = (block) =>
    Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)).map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);

  const ingredients = ingBlock ? listItems(ingBlock) : [];
  const instructions = dirBlock ? listItems(dirBlock) : [];

  return { title, author, ingredients, instructions };
}

// -------------------- normalization → MealMap --------------------
function recipeToMeal(recipe, packs, meta = {}) {
  const { verbsPack, durationsPack, synonymsPack } = packs;
  const VERBS_ARRAY = Array.isArray(verbsPack) ? verbsPack : Array.isArray(verbsPack?.verbs) ? verbsPack.verbs : [];
  const CANONICAL = VERBS_ARRAY.map((v) => ({
    name: v.canon,
    attention: v.attention, // "attended" | "unattended_after_start"
    patterns: (v.patterns || []).map((p) => new RegExp(p, "i")),
    default_planned: v?.defaults?.planned_min ?? null,
  }));

  const DEFAULTS_BY_VERB = Object.fromEntries(extractDurationEntries(durationsPack));

  const steps = flattenInstructions(recipe);
  const title = recipe.name || recipe.headline || "Imported Recipe";
  const author = (recipe.author && (recipe.author.name || recipe.author)) || meta.sourceUrl || "Imported";

  const toDurationObj = (min) => (min == null ? null : { value: min });
  const findVerb = (text) => {
    for (const v of CANONICAL) for (const re of v.patterns) if (re.test(text)) return v;
    return null;
  };
  const parseMinutes = (s) => {
    const m = s.match(/(\d+(?:\.\d+)?)\s*(?:min|minutes?|m)\b/i);
    if (m) return Math.max(1, Math.round(parseFloat(m[1])));
    const hm = s.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?/i);
    if (hm) return Math.max(1, parseInt(hm[1], 10) * 60 + (hm[2] ? parseInt(hm[2], 10) : 0));
    return null;
  };

  const tasks = steps.map((raw) => {
    const text = String(raw).replace(/\s+/g, " ").trim();
    const verbMeta = findVerb(text);
    const verb = verbMeta?.name || "free_text";
    const durMin = parseMinutes(text);
    const byVerb = DEFAULTS_BY_VERB?.[verb] ?? verbMeta?.default_planned ?? null;
    const planned_min = durMin ?? byVerb ?? null;
    const requires_driver = verbMeta ? verbMeta.attention === "attended" : true;
    const self_running_after_start = verbMeta ? verbMeta.attention === "unattended_after_start" : false;
    return {
      id: cryptoRandomId(),
      name: text.replace(/\s+\.+$/, ""),
      canonical_verb: verb,
      duration_min: toDurationObj(durMin),
      planned_min,
      readiness_signal: null,
      requires_driver,
      self_running_after_start,
      inputs: [],
      outputs: [],
      edges: [],
    };
  });

  // Dependencies: conservative FS chain; plus SS from background starters like "warm/simmer"
  for (let i = 1; i < tasks.length; i++) {
    const cur = tasks[i], prev = tasks[i - 1];
    cur.edges.push({ from: prev.id, type: "FS" });
  }
  // Background starters → SS edges to all later steps that mention the same resource (very light heuristic)
  const bgIndices = tasks
    .map((t, i) => [t, i])
    .filter(([t]) => t.self_running_after_start)
    .map(([_, i]) => i);

  for (const idx of bgIndices) {
    const fromId = tasks[idx].id;
    for (let j = idx + 1; j < tasks.length; j++) {
      // only add SS if the later step mentions broth/stock/liquid/warm/ladle etc.
      if (/\b(broth|stock|sauce|oven|marinade|brine|rest|rise|proof|cool|chill|ladle|add\b)/i.test(tasks[j].name)) {
        tasks[j].edges.push({ from: fromId, type: "SS" });
      }
    }
  }

  return {
    title,
    author: { name: typeof author === "string" ? author : (author?.name || "Imported") },
    meta: { source: meta.sourceUrl || null, schema_org: true },
    packs_meta: { synonyms: normalizeSynonyms(synonymsPack) },
    tasks,
  };
}

function extractDurationEntries(pack) {
  const asEntryList = (arr) =>
    (arr || [])
      .filter((d) => d && (d.verb || d.canon || d.name))
      .map((d) => [
        d.verb ?? d.canon ?? d.name,
        d.planned_min ?? d.default_planned ?? d.min ?? d.value,
      ])
      .filter(([, v]) => Number.isFinite(v));
  if (Array.isArray(pack?.durations)) return asEntryList(pack.durations);
  if (Array.isArray(pack)) return asEntryList(pack);
  if (pack && typeof pack === "object") {
    if (pack.defaults && typeof pack.defaults === "object") {
      return Object.entries(pack.defaults).filter(([, v]) => Number.isFinite(v));
    }
    const numKeys = Object.keys(pack).filter((k) => Number.isFinite(pack[k]));
    if (numKeys.length) return numKeys.map((k) => [k, pack[k]]);
  }
  return [];
}

function normalizeSynonyms(s) {
  if (!s) return {};
  if (Array.isArray(s)) {
    if (s.length && Array.isArray(s[0])) {
      return Object.fromEntries(
        s.filter((t) => Array.isArray(t) && t.length === 2 && typeof t[0] === "string")
         .map(([head, aliases]) => [String(head).toLowerCase(), Array.isArray(aliases) ? aliases : []])
      );
    }
    return Object.fromEntries(
      s.filter((x) => x && typeof x.head === "string")
       .map((x) => [x.head.toLowerCase(), Array.isArray(x.aliases) ? x.aliases : []])
    );
  }
  if (typeof s === "object") {
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v : []]));
  }
  return {};
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task_${Math.random().toString(36).slice(2, 10)}`;
}