// Validate JSON pack sources: JSON parses, effect scripts are syntactically valid,
// every table result links to an existing item in the folder matching the table's
// damage type + location, and table ranges are contiguous.
import fs from "node:fs";
import path from "node:path";
import * as acorn from "acorn";
import { CRIT_TESTS as TESTS, CRIT_CHOICES, CHOICE_EXCEPTIONS, NOT_ON_ADD } from "./crit-tests-data.mjs";

const CRIT_TESTS = { ...TESTS, ...CRIT_CHOICES };
import { GRANTS, GRANT_EXCEPTIONS, CORE_NAMES } from "./grants-data.mjs";

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

// Criticals with a Test on receipt: every critical whose text calls for a Test is either automated
// (CRIT_TESTS: exactly one generated "(Test)" effect) or reviewed as not rolled on receipt (NOT_ON_ADD).
const DIFFICULTIES = new Set(["veasy", "easy", "average", "challenging", "difficult", "hard", "vhard"]);
const TEST_TEXT = /(?:Easy|Average|Challenging|Difficult|Hard|Very Hard)\s*\([+-\u2212\u2013]?\s*\d+\)\s*(?:\w+\s){0,2}?(?:[A-Z][a-z]+(?: \([^)]*\))?\s)?Tests?|\b(?:pass|fail|make|succeed|roll|attempt)\w*\s+(?:a|an|another)\s+[^.]{0,60}?Test/i;
for (const item of Object.values(items)) {
  const where = `${folders[item.folder]} / ${item.name} (${item._id})`;
  const generated = (item.effects ?? []).filter(e => e.flags?.[MODULE_ID]?.critTest);
  const spec = CRIT_TESTS[item._id];
  if (spec) {
    if (generated.length !== 1) errors.push(`${where}: expected 1 generated (Test) effect, found ${generated.length}; run npm run crit-tests`);
    for (const t of spec.tests ?? []) if (!DIFFICULTIES.has(t.difficulty)) errors.push(`${where}: bad difficulty '${t.difficulty}'`);
  }
  else if (generated.length) errors.push(`${where}: generated (Test) effect but no CRIT_TESTS entry`);
  for (const e of item.effects ?? []) {
    if (e.flags?.[MODULE_ID]?.critTest) continue;
    for (const s of e.system?.scriptData ?? [])
      if (s.trigger === "immediate" && /setup(Skill|Characteristic)\(/.test(s.script ?? "")) errors.push(`${where} / ${e.name}: hand-written immediate Test script; add it to tools/crit-tests-data.mjs instead`);
  }
  const text = (item.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/@\w+\[([^\]]+)\](\{([^}]*)\})?/g, (m, a, b, c) => c || a.split(".").pop()).replace(/\s+/g, " ");
  const effectsText = text.slice(text.indexOf("Effects")).replace(/Extraction (will be|is)[^.]*\.?/g, "").replace(/(Surgery|Heal)[^.]*required for Extraction\.?/g, "");
  if (TEST_TEXT.test(effectsText) && !spec && !NOT_ON_ADD[item._id]) errors.push(`${where}: text calls for a Test but the critical is in neither CRIT_TESTS nor NOT_ON_ADD`);
}
stats.critTests = Object.keys(TESTS).length;

// Choices on receipt: every critical whose text offers a choice is automated (a `choices` entry or the
// "dropchoose" action, i.e. a generated script calling chooseCritOption / dropChosen) or in CHOICE_EXCEPTIONS.
const CHOICE_TEXT = /\bchoos\w*|\bchoice\b|\beither\b|\bmay spend\b|\bone of your hands\b|\bpick the (?:best|worst)\b|\bGM decides\b|\bGM.s decision\b|\bdepending on your method\b|\bif you (?:want|wish|prefer)\b/i;
let choiceCount = 0;
for (const id of Object.keys(CHOICE_EXCEPTIONS)) if (!items[id]) errors.push(`CHOICE_EXCEPTIONS: item ${id} not found`);
for (const [id, spec] of Object.entries(CRIT_TESTS)) for (const c of spec.choices ?? []) {
  if (!c.prompt || !(c.options?.length >= 2)) errors.push(`${spec.name} (${id}): a choice needs a prompt and at least 2 options`);
  const ids = (c.options ?? []).map(o => o.id);
  if (new Set(ids).size !== ids.length || ids.some(x => !x)) errors.push(`${spec.name} (${id}): choice option ids must be unique and non-empty`);
}
for (const item of Object.values(items).filter(i => i.type === "critical")) {
  const where = `${folders[item.folder]} / ${item.name} (${item._id})`;
  const text = (item.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/@\w+\[([^\]]+)\](\{([^}]*)\})?/g, (m, a, b, c) => c || a.split(".").pop()).replace(/\s+/g, " ");
  const generated = (item.effects ?? []).filter(e => e.flags?.[MODULE_ID]?.critTest).flatMap(e => e.system?.scriptData ?? []).map(s => s.script ?? "").join("\n");
  const automated = /api\.(chooseCritOption|dropChosen)\(/.test(generated);
  if (automated) choiceCount++;
  const asks = CHOICE_TEXT.test(text.slice(text.indexOf("Effects")));
  if (asks && !automated && !CHOICE_EXCEPTIONS[item._id]) errors.push(`${where}: text offers a choice but no generated script asks for it (add it to CRIT_CHOICES / a choices entry in tools/crit-tests-data.mjs, or to CHOICE_EXCEPTIONS with a reason)`);
  if (CHOICE_EXCEPTIONS[item._id] && automated) errors.push(`${where}: in CHOICE_EXCEPTIONS but its choice is automated; remove the exception`);
  if (CHOICE_EXCEPTIONS[item._id] && !asks) errors.push(`${where}: in CHOICE_EXCEPTIONS but its text no longer matches; remove the exception`);
}
stats.critChoices = choiceCount;
stats.choiceExceptions = Object.keys(CHOICE_EXCEPTIONS).length;

// Granted items: every core injury/disease a critical's text gives the victim (Broken Bone / Torn Muscle
// (Minor|Major), Amputation, Festering Wound, Blood Rot, Minor Infection) is added by one of its scripts,
// or the critical is in GRANT_EXCEPTIONS with a reason. Core ids used in scripts must be known core items.
const CRIT_TEST_KEYS = { festering: "Festering Wound", bloodrot: "Blood Rot", minor: "Minor Infection", teeth: "Amputated Teeth" };
function categories(str) {
  const c = new Set();
  for (const m of str.matchAll(/Broken[\w\s]*?\((Minor|Major)\)/gi)) c.add(`broken-${m[1].toLowerCase()}`);
  for (const m of str.matchAll(/Torn[\w\s]*?\((Minor|Major)\)/gi)) c.add(`torn-${m[1].toLowerCase()}`);
  if (/Festering Wound/i.test(str)) c.add("festering");
  if (/Blood Rot/i.test(str)) c.add("bloodrot");
  if (/Minor Infection/i.test(str)) c.add("minor");
  if (/Amputat/i.test(str)) c.add("amputation");
  return c;
}
const grantSpecs = new Set(Object.keys(GRANTS));
for (const id of Object.keys(GRANT_EXCEPTIONS)) if (!items[id]) errors.push(`GRANT_EXCEPTIONS: item ${id} not found`);
for (const item of Object.values(items).filter(i => i.type === "critical")) {
  const where = `${folders[item.folder]} / ${item.name} (${item._id})`;
  const granted = [];
  for (const e of item.effects ?? []) for (const s of e.system?.scriptData ?? []) {
    const code = s.script ?? "";
    if (s.trigger === "immediate" && /^\s*\[Script\.\w+\]\s*$/.test(code)) granted.push(e.name); // system script: named after what it grants
    for (const m of code.matchAll(/wfrp4e-core\.items\.(?:Item\.)?([A-Za-z0-9]{16})/g)) {
      if (CORE_NAMES[m[1]]) granted.push(CORE_NAMES[m[1]]);
      else errors.push(`${where} / ${e.name}: script uses unknown core item ${m[1]} (add it to CORE_NAMES in tools/grants-data.mjs if it is a real wfrp4e-core injury/disease)`);
    }
    for (const m of code.matchAll(/\bgrant\("([A-Za-z0-9]{16})"/g)) granted.push(CORE_NAMES[m[1]] ?? "");
    for (const call of code.matchAll(/addCoreItem\(this,[^;]*/g)) for (const m of call[0].matchAll(/"(\w+)"/g)) if (CRIT_TEST_KEYS[m[1]]) granted.push(CRIT_TEST_KEYS[m[1]]);
  }
  if (grantSpecs.has(item._id) && !(item.effects ?? []).some(e => e.flags?.[MODULE_ID]?.grant || e.flags?.[MODULE_ID]?.grantFix)) errors.push(`${where}: in GRANTS but no generated effect; run npm run grants`);
  const have = categories(granted.join(" | "));
  const text = (item.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/@\w+\[([^\]]+)\](\{([^}]*)\})?/g, (m, a, b, c) => c || a.split(".").pop()).replace(/\s+/g, " ");
  const need = categories(text.slice(text.indexOf("Effects")));
  const missing = [...need].filter(c => c === "amputation" ? ![...have].some(h => h === "amputation") : !have.has(c));
  const ex = GRANT_EXCEPTIONS[item._id];
  if (ex && !ex.reason) errors.push(`${where}: GRANT_EXCEPTIONS entry without a reason`);
  if (ex && ex.name !== item.name) errors.push(`${where}: GRANT_EXCEPTIONS name '${ex.name}' != '${item.name}'`);
  const excused = new Set(ex?.skip ?? []);
  for (const c of missing) if (!excused.has(c)) errors.push(`${where}: text gives '${c}' but no script grants it (add it to tools/grants-data.mjs, or to GRANT_EXCEPTIONS with a reason)`);
  for (const c of excused) if (!missing.includes(c)) errors.push(`${where}: GRANT_EXCEPTIONS skips '${c}' but it is granted or not in the text; remove it`);
}
stats.grants = Object.keys(GRANTS).length;
stats.grantExceptions = Object.keys(GRANT_EXCEPTIONS).length;

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
