/* eslint-disable no-console */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const title = process.argv[2] || "Untitled Meal";
const idSafe = title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const out = path.join(process.cwd(), "src/meals", `${idSafe || "new_meal"}.json`);

const meal = {
  schema_version: 1,
  title,
  author: { name: "Unknown" },
  meta: { serves: null, notes: "" },
  tasks: [
    // Add tasks like this:
    // {
    //   id: crypto.randomUUID ? crypto.randomUUID() : `task_${Math.random().toString(36).slice(2,10)}`,
    //   name: "Boil water",
    //   canonical_verb: "bring_to_boil",
    //   planned_min: 10,
    //   requires_driver: false,
    //   duration_min: { value: 10 },
    //   edges: [] // e.g. [{ from: "<other_task_id>", type: "FS" }]
    // }
  ]
};

await writeFile(out, JSON.stringify(meal, null, 2));
console.log(`Created ${out}`);