/* AuthoringPanel.jsx — v2.0.0 (Local-first with ontology parser)
   New in 2.0.0:
     • Removed Google Sheets dependency
     • Uses local parser (src/parser/)
     • Uses unified ontology (src/ontology/)
     • Enhanced verb matching and dependency inference
*/
/* eslint-disable */
import React, { useMemo, useState } from "react";
import { ingestFromUrlOrHtml } from "../ingestion/url_or_text.js";
import { parseRecipe } from "../parser/index.js";

// Local ontology
import VERB_PACK from "../ontology/verbs.json";

/* -------------------------- Pack helpers for preview -------------------------- */
const VERBS_ARRAY = VERB_PACK?.verbs || [];
const DEFAULTS_BY_VERB = Object.fromEntries(
  VERBS_ARRAY.map(v => [v.canon, v.defaults?.planned_min || null]).filter(([, v]) => v != null)
);

/* -------------------------- Simplified text splitter for preview -------------------------- */
function splitLinesSimple(text) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

/* --------------------------------------------------------------------- */

export default function AuthoringPanel({ onLoadMeal, recipeText, onRecipeTextChange }) {
  const [text, setText] = useState(
    "Slice garlic and parsley; set out chili flakes — 3 min\nBring a large pot of water to a boil — 10 min\n…"
  );
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState([]);
  const [roundAboutUp, setRoundAboutUp] = useState(true);
  const [smartDependencies, setSmartDependencies] = useState(true);

  // Sync with external recipeText prop when it changes
  React.useEffect(() => {
    if (recipeText !== undefined && recipeText !== text) {
      setText(recipeText);
    }
  }, [recipeText]);

  // Notify parent when text changes
  const handleTextChange = (newText) => {
    setText(newText);
    onRecipeTextChange?.(newText);
  };

  const rows = useMemo(() => splitLinesSimple(text), [text]);

  async function importFromUrlOrHtml() {
    // This uses the existing URL/HTML ingestion
    const draft = await ingestFromUrlOrHtml(text);
    handleTextChange(draft);
  }

  async function parseLines() {
    // Use the new local parser
    const meal = await parseRecipe(text, title || "Preview", {
      autoDependencies: false,
      smartDependencies,
      roundAboutUp
    });

    setPreview(meal.tasks);
  }

  async function loadAsMeal() {
    if (preview.length === 0) {
      await parseLines();
      // After parsing, try again
      if (preview.length === 0) return;
    }

    const meal = {
      title: title || "Untitled Meal",
      author: { name: "Local Parser v2.0" },
      tasks: preview,
      packs_meta: {
        parser_version: "2.0.0",
        source: "local"
      },
    };
    onLoadMeal?.(meal);
  }

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, background: "#ffe7b3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>Author Ingestion (v2.0.0 - Local Parser)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={parseLines}>Parse → Draft</button>
          <button onClick={loadAsMeal}>Load into Preview</button>
        </div>
      </div>

      {/* Main parsing UI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 12,
          alignItems: "start",
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="One step per line… or paste a URL/HTML, then click 'Import from URL/HTML'."
            style={{
              width: "100%",
              minHeight: 190,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "10px 12px",
              boxSizing: "border-box",
              resize: "vertical",
              background: "#fff",
            }}
          />
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Recipe text (one step per line) — or paste a URL/HTML, and click "Import from URL/HTML".
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Meal title</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Quick Pasta with Garlic Oil"
            style={{
              width: "100%",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 8,
              boxSizing: "border-box",
              background: "#fff",
            }}
          />
          <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5, marginBottom: 10 }}>
            Tip: durations like "— 3 min" are optional — packs provide sensible defaults per verb.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={roundAboutUp} onChange={(e) => setRoundAboutUp(e.target.checked)} />
              Round "about/approx/range" durations up
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={smartDependencies} onChange={(e) => setSmartDependencies(e.target.checked)} />
              Smart dependency inference
            </label>

            <div>
              <button onClick={importFromUrlOrHtml}>Import from URL/HTML</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontWeight: 700, marginTop: 8, marginBottom: 6 }}>Preview</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.6)" }}>
              <th style={th}>#</th>
              <th style={th}>Step</th>
              <th style={th}>Verb</th>
              <th style={th}>Planned (min)</th>
              <th style={th}>Attention</th>
              <th style={th}>Depends on</th>
            </tr>
          </thead>
          <tbody>
            {(preview.length ? preview : rows.map((line, i) => ({ name: line, _row: i }))).map((t, i) => {
              const idx = i + 1;
              const verb = t.canonical_verb || "free_text";
              const planned = t.planned_min ?? DEFAULTS_BY_VERB[verb] ?? "";
              const attention = t.requires_driver ? "attended" : "unattended";
              const dep = t.edges?.[0]?.from ? `#${Number(String(t.edges[0].from).split("_").pop())}` : "—";
              return (
                <tr key={idx} style={{ background: i % 2 ? "rgba(255,255,255,0.45)" : "transparent" }}>
                  <td style={td}>{idx}</td>
                  <td style={td}>{t.name || t}</td>
                  <td style={td}>{verb}</td>
                  <td style={td}>{planned || "—"}</td>
                  <td style={td}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: attention === "attended" ? "#eef5ff" : "#ecfdf5",
                        fontSize: 12,
                      }}
                    >
                      {attention}
                    </span>
                  </td>
                  <td style={td}>{dep}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};
const td = {
  padding: "8px 10px",
  borderBottom: "1px solid #f1f5f9",
};