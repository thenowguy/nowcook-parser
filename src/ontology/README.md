# NowCook Ontology

This directory contains the **unified cooking ontology** for NowCook - the single source of truth for verbs, ingredients, parameters, natural language patterns, and safety guards.

## 📁 File Structure

### Core Files

- **`verbs.json`** - All cooking verbs with attention modes, duration defaults, and regex patterns
- **`parameters.json`** - Parameter definitions (heat_level, time_min, temp_f, etc.) with validation rules
- **`ingredients.json`** - Ingredient classes, traits, verb compatibility, and typical parameter values
- **`patterns.json`** - Natural language patterns for parsing recipe instructions
- **`guards.json`** - Safety redirects and warnings (e.g., "don't boil chicken breast")

### Supporting Files

- **`verbs.master.json`** - Legacy verb definitions (being phased out)
- **`ingredients.master.json`** - Legacy ingredient data (being phased out)
- **`verbs.applicability.overrides.json`** - Verb-ingredient compatibility overrides
- **`loadOntology.js`** - Lazy loading module

---

## 🔧 How to Edit

### Adding a New Verb

Edit `verbs.json`:

```json
{
  "canon": "braise",
  "attention": "unattended_after_start",
  "patterns": [
    "\\bbraise\\b",
    "\\bcook.*(?:covered|low heat).*(?:long|slow)\\b"
  ],
  "defaults": { "planned_min": 120 }
}
```

**Fields:**
- `canon` (string): Canonical verb name (e.g., "sauté", "slice")
- `attention` (string): "attended" | "unattended_after_start" | "unattended"
- `patterns` (array): Regex patterns to match in recipe text
- `defaults` (object): Default parameters (primarily `planned_min`)

### Adding a Parameter

Edit `parameters.json`:

```json
"marinade_time": {
  "type": "range",
  "min": 30,
  "max": 1440,
  "description": "Time to marinate in minutes",
  "verbs": ["marinate"]
}
```

**Types:** `enum`, `range`, `boolean`, `array`

### Adding an Ingredient

Edit `ingredients.json`:

```json
"shallot": {
  "classes": ["vegetable", "allium", "aromatics"],
  "traits": ["mild", "sweet", "delicate"],
  "compatible_verbs": ["mince", "slice", "dice", "sauté"],
  "typical_parameters": {
    "sauté": { "time_min": [5, 8], "heat_level": "medium" }
  }
}
```

### Adding a Natural Language Pattern

Edit `patterns.json`:

```json
{
  "pattern": "\\bcook.*until.*fork.*tender\\b",
  "readiness_cue": "fork_tender",
  "note": "Common phrase for testing doneness"
}
```

### Adding a Safety Guard

Edit `guards.json`:

```json
{
  "id": "frozen_meat_high_heat",
  "trigger": {
    "verb": "sear",
    "note_keywords": ["frozen", "not thawed"]
  },
  "redirect_to": null,
  "rationale": "Searing frozen meat creates uneven cooking. Thaw first or use lower heat method.",
  "severity": "warning"
}
```

**Severity Levels:**
- `critical` - Food safety (blocks execution)
- `warning` - Likely to fail badly
- `caution` - Suboptimal but not harmful
- `info` - Helpful suggestion
- `myth` - Common misconception
- `technique` - Technique improvement

---

## ✅ Validation

After editing, validate your changes:

```bash
npm run validate-ontology
```

This checks:
- JSON syntax
- Schema compliance
- Required fields
- Valid references between files

---

## 🧪 Testing with Sample Recipe

```bash
npm run test-parser
```

Tests the parser with sample recipes to ensure nothing broke.

---

## 📊 Ontology Statistics

Current coverage:
- **40 verbs** (sauté, simmer, roast, slice, etc.)
- **25 parameters** (heat_level, time_min, temp_f, etc.)
- **15 ingredients** with full compatibility data
- **30 natural language patterns**
- **15 safety guards**

---

## 🚀 How the Ontology is Used

1. **Parser** (`src/parser/`) uses `verbs.json` + `patterns.json` to identify verbs
2. **Verb Matcher** applies `guards.json` to redirect unsafe combinations
3. **Extractor** uses `parameters.json` for validation
4. **Dependency Inference** uses `ingredients.json` to track ingredient flow

---

## 📖 Philosophy

**One Source of Truth**
- No more dual systems (Sheets + local)
- Version controlled with git
- Editable in VS Code
- Extensible by design

**Human-Readable**
- Comments in JSON (via `description` fields)
- Clear parameter names
- Rationale for every guard

**Progressive Enhancement**
- Start with simple verbs
- Add parameters as needed
- Guards are optional but recommended

---

## 💡 Tips for Non-Technical Users

1. **Use VS Code's JSON editor** - It shows errors in real-time
2. **Copy existing entries** - Easiest way to add new items
3. **Test after changes** - Run `npm run validate-ontology`
4. **Ask for regex help** - Patterns can be tricky (use simple words first)
5. **Document your changes** - Add `description` fields

---

## 🔗 References

- JSON Schema: `/schemas/packs/verbs.schema.json`
- Parser Implementation: `/src/parser/`
- Usage Example: `/src/components/AuthoringPanel.jsx`

---

## Version History

- **v2.0.0** (2025-10-19): Initial unified ontology, migrated from Google Sheets
- **v1.x**: Legacy dual system (Google Sheets + local packs)

---

For questions or issues, check the main `README.md` or open a GitHub issue.
