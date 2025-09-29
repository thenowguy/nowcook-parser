/* eslint-disable no-console */
import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const root = process.cwd();

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schemas
const schemaPaths = {
  meal: "schemas/meal.schema.json",
  verbs: "schemas/packs/verbs.schema.json",
  durations: "schemas/packs/durations.schema.json",
  synonyms: "schemas/packs/synonyms.schema.json",
  readiness: "schemas/packs/readiness.schema.json",
};

const schemas = {};
for (const [key, relPath] of Object.entries(schemaPaths)) {
  const abs = path.join(root, relPath);
  const json = JSON.parse(await readFile(abs, "utf8"));
  schemas[key] = ajv.compile(json);
}

function fail(file, errors) {
  console.error(`\n❌ ${file}`);
  for (const err of errors ?? []) {
    console.error(
      "  -",
      err.instancePath || "(root)",
      err.message,
      err.params ? JSON.stringify(err.params) : ""
    );
  }
}

let ok = true;

// Validate meals
for (const file of await fg("src/meals/*.json", { cwd: root })) {
  const data = JSON.parse(await readFile(path.join(root, file), "utf8"));
  const valid = schemas.meal(data);
  if (!valid) {
    ok = false;
    fail(file, schemas.meal.errors);
  } else {
    console.log(`✅ ${file}`);
  }
}

// Validate packs (by filename)
const packMap = [
  { glob: "src/packs/verbs.en.json", schema: "verbs" },
  { glob: "src/packs/durations.en.json", schema: "durations" },
  { glob: "src/packs/synonyms.en.json", schema: "synonyms" },
  { glob: "src/packs/readiness.en.json", schema: "readiness" },
];

for (const { glob, schema } of packMap) {
  for (const file of await fg(glob, { cwd: root })) {
    const data = JSON.parse(await readFile(path.join(root, file), "utf8"));
    const valid = schemas[schema](data);
    if (!valid) {
      ok = false;
      fail(file, schemas[schema].errors);
    } else {
      console.log(`✅ ${file}`);
    }
  }
}

if (!ok) {
  console.error("\nValidation failed.");
  process.exit(1);
} else {
  console.log("\nAll good ✔");
}