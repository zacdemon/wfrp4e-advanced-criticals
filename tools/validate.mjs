// Validate JSON pack sources: JSON parses, effect scripts are syntactically valid,
// every table result links to an existing item in the folder matching the table's
// damage type + location, and table ranges are contiguous.
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";

const ROOT = path.join("src", "packs");
const TYPE_FOLDER = { arrows: "Arrows", bullets: "Bullets", crushing: "Crushing", cutting: "Cutting", flames: "Flames", piercing: "Piercing", shrapnel: "Shrapnel", slings: "Slings", teeth: "Teeth", unarmed: "Unarmed" };
const MODULE_ID = JSON.parse(fs.readFileSync("module.json", "utf8")).id;
const errors = [];
const stats = { files: 0, scripts: 0, tables: 0, results: 0 };

function loadPack(pack) {
  const dir = path.join(ROOT, pack);
  return fs.readdirSync(dir).filter(f => f.endsWith(".json")).map(f => {
    stats.files++;
    try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { errors.push(`JSON parse error in ${pack}/${f}: ${e.message}`); return null; }
  }).filter(Boolean);
}

function checkScript(code, where) {
  if (typeof code !== "string" || !code.trim()) return;
  if (/^\s*\[Script\.\w+\]\s*$/.test(code)) return; // reference to a system script file
  stats.scripts++;
  try { acorn.parse(`(async function(args){\n${code}\n})`, { ecmaVersion: "latest" }); }
  catch (e) { errors.push(`Script syntax error in ${where}: ${e.message}`); return; }
  if (/\bfields\.modifer\b/.test(code)) errors.push(`Script typo 'modifer' in ${where}`);
  if (/^\s*[A-Za-z_$][\w$]*\s*;?\s*$/.test(code)) errors.push(`Script is a bare identifier (no-op) in ${where}: ${code.trim()}`);
}

const itemDocs = loadPack("items");
const tableDocs = loadPack("rolltables");
const macroDocs = loadPack("macros");

const folders = Object.fromEntries(itemDocs.filter(d => d._key?.startsWith("!folders!")).map(d => [d._id, d.name]));
const items = Object.fromEntries(itemDocs.filter(d => d._key?.startsWith("!items!")).map(d => [d._id, d]));

const CONDITION_KEYS = new Set(["stunned", "bleeding", "prone", "fatigued", "blinded", "unconscious", "deafened", "ablaze", "broken", "entangled", "poisoned", "surprised", "dead"]);
for (const item of Object.values(items)) {
  for (const effect of item.effects ?? []) {
    if ((effect.statuses ?? []).some(s => CONDITION_KEYS.has(s)))
      errors.push(`Embedded condition copy '${effect.name}' on ${folders[item.folder]} / ${item.name} (${item._id}): use this.actor.addCondition in an immediate script instead`);
    for (const [i, s] of (effect.system?.scriptData ?? []).entries()) {
      const where = `${folders[item.folder]} / ${item.name} (${item._id}) / ${effect.name} [${s.trigger} #${i}]`;
      checkScript(s.script, where);
      for (const opt of ["hideScript", "activateScript", "submissionScript"]) checkScript(s.options?.[opt], `${where}.${opt}`);
    }
  }
}
for (const m of macroDocs.filter(d => d._key?.startsWith("!macros!"))) checkScript(m.command, `macro ${m.name}`);

for (const t of tableDocs.filter(d => d._key?.startsWith("!tables!"))) {
  stats.tables++;
  const column = t.flags?.wfrp4e?.column ?? "";
  const key = t.flags?.wfrp4e?.key ?? "";
  const [src, type] = column.split("-");
  const area = key.replace(/^crit/, "");
  const expectedFolder = `${TYPE_FOLDER[type]} - ${area.charAt(0).toUpperCase()}${area.slice(1)}`;
  if (!TYPE_FOLDER[type] || !["head", "arm", "body", "leg"].includes(area)) { errors.push(`Table ${t.name}: unexpected flags key=${key} column=${column}`); continue; }

  for (const r of t.results ?? []) {
    stats.results++;
    const uuid = r.documentUuid ?? "";
    const m = uuid.match(new RegExp(`^Compendium\\.${MODULE_ID}\\.items\\.Item\\.([A-Za-z0-9]{16})$`));
    if (!m) { errors.push(`Table ${t.name} [${r.range}] ${r.name}: bad/missing documentUuid '${uuid}'`); continue; }
    const item = items[m[1]];
    if (!item) { errors.push(`Table ${t.name} [${r.range}] ${r.name}: item ${m[1]} not found`); continue; }
    if (folders[item.folder] !== expectedFolder) errors.push(`Table ${t.name} [${r.range}] ${r.name}: links to '${folders[item.folder]}' (expected '${expectedFolder}')`);
  }

  const ranges = (t.results ?? []).map(r => r.range).sort((a, b) => a[0] - b[0]);
  let next = 1;
  for (const [lo, hi] of ranges) {
    if (lo !== next || hi < lo) errors.push(`Table ${t.name}: range gap/overlap at [${lo},${hi}] (expected start ${next})`);
    next = hi + 1;
  }
  if (src === "core" && next !== 101) errors.push(`Table ${t.name}: Core table ends at ${next - 1}, expected 100`);
}

// esmodules declared in module.json: must exist and parse as ES modules
for (const esm of JSON.parse(fs.readFileSync("module.json", "utf8")).esmodules ?? []) {
  if (!fs.existsSync(esm)) { errors.push(`esmodule ${esm} missing`); continue; }
  try { acorn.parse(fs.readFileSync(esm, "utf8"), { ecmaVersion: "latest", sourceType: "module" }); stats.scripts++; }
  catch (e) { errors.push(`esmodule ${esm}: ${e.message}`); }
}
// languages declared in module.json: must exist and be valid JSON
for (const l of JSON.parse(fs.readFileSync("module.json", "utf8")).languages ?? []) {
  try { JSON.parse(fs.readFileSync(l.path, "utf8")); } catch (e) { errors.push(`language ${l.path}: ${e.message}`); }
}

console.log(stats);
if (errors.length) {
  console.error(`${errors.length} error(s):\n` + errors.join("\n"));
  process.exit(1);
}
console.log("All checks passed.");
