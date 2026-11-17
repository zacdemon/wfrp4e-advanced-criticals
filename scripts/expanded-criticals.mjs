/**
 * Antares | Expanded Criticals [WFRP4E]
 *
 * Critical chart picker. When a Critical link for a hit location is clicked
 * (damage card, attack card, Critical Cast menu, /table crithead ...), the
 * WFRP4e system calls game.wfrp4e.tables.formatChatRoll(table, options, column).
 * We wrap that function: if the table is crithead/critarm/critbody/critleg and
 * no column was requested, we ask which Expanded Criticals chart (damage type)
 * to use, then hand the call back to the system with column
 * "<core|uia>-<type>". The system's own modifier (options.modifier) is passed
 * through untouched, so Up In Arms / Core modifiers are never applied twice.
 */

const MODULE_ID = "artantares-advanced-criticals";
const SKIP = Symbol("expcrit-skip");

export const DAMAGE_TYPES = ["arrows", "bullets", "crushing", "cutting", "flames", "piercing", "shrapnel", "slings", "teeth", "unarmed"];
const TABLE_LOCATIONS = ["head", "arm", "body", "leg"];
// Specific hit locations offered by the macro: [hit-location key, table location]
const HIT_LOCATIONS = [["head", "head"], ["lArm", "arm"], ["rArm", "arm"], ["body", "body"], ["lLeg", "leg"], ["rLeg", "leg"]];

const loc = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
const esc = (s) => foundry.utils.escapeHTML ? foundry.utils.escapeHTML(String(s ?? "")) : String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "promptOnCrit", {
    name: "EXPCRIT.Settings.PromptOnCrit.Name",
    hint: "EXPCRIT.Settings.PromptOnCrit.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "columnMode", {
    name: "EXPCRIT.Settings.ColumnMode.Name",
    hint: "EXPCRIT.Settings.ColumnMode.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      auto: "EXPCRIT.Settings.ColumnMode.Auto",
      core: "EXPCRIT.Settings.ColumnMode.Core",
      uia: "EXPCRIT.Settings.ColumnMode.UiA"
    },
    default: "auto"
  });

  // Remembers the last chart picked on this client (used when no weapon can be read).
  game.settings.register(MODULE_ID, "lastDamageType", {
    scope: "client",
    config: false,
    type: String,
    default: "cutting"
  });
});

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

/** Is the system's "Use Up In Arms Critical Hit Modifiers" setting on? (wfrp4e src/hooks/init.js, key "uiaCrits") */
export function systemUsesUiA() {
  try { return !!game.settings.get("wfrp4e", "uiaCrits"); }
  catch { return false; }
}

/** "core" or "uia" according to the module setting (auto follows the system setting). */
export function columnSource() {
  const mode = game.settings.get(MODULE_ID, "columnMode");
  if (mode === "core" || mode === "uia") return mode;
  return systemUsesUiA() ? "uia" : "core";
}

/** Map a table key to head/arm/body/leg, or null if it is not a hit-location critical table. */
export function critTableLocation(table) {
  if (typeof table !== "string") return null;
  const tables = game.wfrp4e?.tables;
  const key = tables?.generalizeTable ? tables.generalizeTable(table) : table.toLowerCase().replace(/[lr](arm|leg)$/, "$1");
  const m = /^crit(head|arm|body|leg)$/.exec(key);
  return m ? m[1] : null;
}

/** Does the world contain this module's charts for that location? (findTable only searches world tables) */
function worldHasCharts(tableLoc) {
  return game.tables.some((t) => {
    const key = t.getFlag("wfrp4e", "key");
    const column = t.getFlag("wfrp4e", "column");
    return key === `crit${tableLoc}` && typeof column === "string" && /^(core|uia)-/.test(column);
  });
}

function safe(fn) {
  try { return fn(); }
  catch { return undefined; }
}

/** Find the attacking item (weapon, trait, spell...) behind a chat message, if any. */
export function itemFromMessage(messageId) {
  const message = messageId ? game.messages.get(messageId) : null;
  if (!message) return null;
  const system = message.system ?? {};
  return safe(() => system.opposedTest?.attackerTest?.item)
    ?? safe(() => system.test?.item)
    ?? safe(() => system.test?.weapon)
    ?? null;
}

/** Specific hit location (lArm, rLeg...) from the message, so arm/leg criticals get their side set. */
function hitLocationFromMessage(messageId) {
  const message = messageId ? game.messages.get(messageId) : null;
  if (!message) return undefined;
  const system = message.system ?? {};
  return safe(() => system.test?.result?.hitloc?.result)
    ?? safe(() => system.opposedTest?.result?.hitloc?.value)
    ?? safe(() => system.opposedTest?.attackerTest?.result?.hitloc?.result)
    ?? undefined;
}

/**
 * Suggest a chart from the attacking item, following the supplement's guidance
 * (Cutting: axes/swords; Crushing: maces/hammers; Piercing: spears, rapiers, daggers,
 * spiked gauntlets; Bullets: single-ball firearms; Shrapnel: blunderbuss, bombs;
 * Arrows: bows, crossbows, javelins, darts; Slings; Teeth & Claws: natural weapons;
 * Flames & Energy: magic missiles and Critical Casts; Unarmed: fists, knuckledusters,
 * saps, locked gauntlets). It is only a default; the GM always confirms.
 */
export function guessDamageType(item) {
  if (!item) return null;
  const name = String(item.name ?? "").toLowerCase();
  if (item.type === "spell" || item.type === "prayer") return "flames";
  if (item.type === "trait") return /fist|punch|kick|unarmed/.test(name) ? "unarmed" : "teeth";
  if (item.type !== "weapon") return null;

  const group = String(item.system?.weaponGroup?.value ?? "").toLowerCase();
  const qualities = new Set((item.system?.qualities?.value ?? []).map((q) => String(q?.name ?? q).toLowerCase()));

  if (/blunderbuss|grenade|bomb|incendiar|scattershot|shot\b/.test(name) || group === "explosives") return "shrapnel";
  if (group === "blackpowder" || group === "engineering") return qualities.has("blast") ? "shrapnel" : "bullets";
  if (group === "sling" || /sling/.test(name)) return "slings";
  if (group === "bow" || group === "crossbow") return "arrows";
  if (group === "throwing") {
    if (/axe|hatchet/.test(name)) return "cutting";
    if (/hammer|stone|rock|club/.test(name)) return "crushing";
    if (/knife|dagger|star/.test(name)) return "piercing";
    return "arrows"; // javelins, darts
  }
  if (/spiked gauntlet/.test(name)) return "piercing";
  if (group === "brawling" || /unarmed|fist|knuckle|\bsap\b|gauntlet|improvised/.test(name)) {
    if (/dagger|knife/.test(name)) return "piercing";
    return "unarmed";
  }
  if (/mace|hammer|flail|club|morning ?star|maul|staff|cudgel/.test(name)) return "crushing";
  if (/rapier|foil|dagger|knife|stiletto|spear|pike|lance|trident|main.?gauche|estoc|gladius|pick/.test(name)) return "piercing";
  if (/axe|sword|sabre|saber|falchion|cutlass|scythe|cleaver|zweih|great ?weapon|bill|glaive|pollaxe|halberd/.test(name)) return "cutting";
  if (qualities.has("impale")) return "piercing";
  if (qualities.has("pummel")) return "crushing";
  if (qualities.has("hack")) return "cutting";
  if (group === "flail") return "crushing";
  if (group === "fencing" || group === "parry" || group === "polearm") return "piercing";
  return "cutting";
}

/* -------------------------------------------- */
/*  Dialog                                      */
/* -------------------------------------------- */

/**
 * Ask for damage type, column and modifier.
 * @returns {Promise<object|"system"|null>} the choice, "system" (Cancel: use system table) or null (window closed).
 */
export async function promptCritical({ tableLocation = null, hitLocation = null, modifier = 0, messageId = null, askLocation = false, item = null } = {}) {
  item ??= itemFromMessage(messageId);
  const guessed = guessDamageType(item);
  const defaultType = guessed ?? game.settings.get(MODULE_ID, "lastDamageType") ?? "cutting";
  const source = columnSource();
  const uia = systemUsesUiA();

  const typeOptions = DAMAGE_TYPES.map((t) => `<option value="${t}" ${t === defaultType ? "selected" : ""}>${esc(loc(`EXPCRIT.Type.${t}`))}</option>`).join("");
  const columnOptions = ["core", "uia"].map((c) => `<option value="${c}" ${c === source ? "selected" : ""}>${esc(loc(`EXPCRIT.Column.${c}`))}</option>`).join("");
  const currentHit = hitLocation ?? tableLocation ?? "body";
  const locationOptions = HIT_LOCATIONS.map(([key]) => `<option value="${key}" ${key === currentHit ? "selected" : ""}>${esc(game.wfrp4e?.config?.locations?.[key] ? loc(game.wfrp4e.config.locations[key]) : key)}</option>`).join("");

  const content = `
    <div class="expcrit-dialog">
      ${askLocation ? `<div class="form-group"><label>${esc(loc("EXPCRIT.Dialog.Location"))}</label><div class="form-fields"><select name="hitLocation">${locationOptions}</select></div></div>` : ""}
      <div class="form-group">
        <label>${esc(loc("EXPCRIT.Dialog.DamageType"))}</label>
        <div class="form-fields"><select name="damageType" autofocus>${typeOptions}</select></div>
        ${guessed && item ? `<p class="hint">${esc(loc("EXPCRIT.Dialog.Guessed", { item: item.name }))}</p>` : ""}
      </div>
      <div class="form-group">
        <label>${esc(loc("EXPCRIT.Dialog.Column"))}</label>
        <div class="form-fields"><select name="source">${columnOptions}</select></div>
        <p class="hint">${esc(loc(uia ? "EXPCRIT.Dialog.UiAOn" : "EXPCRIT.Dialog.UiAOff"))}</p>
      </div>
      <div class="form-group">
        <label>${esc(loc("EXPCRIT.Dialog.Modifier"))}</label>
        <div class="form-fields"><input type="number" name="modifier" step="1" value="${Number(modifier) || 0}"></div>
        ${askLocation ? "" : `<p class="hint">${esc(loc("EXPCRIT.Dialog.ModifierHint"))}</p>`}
      </div>
    </div>`;

  const DialogV2 = foundry.applications.api.DialogV2;
  const result = await DialogV2.wait({
    window: { title: loc("EXPCRIT.Dialog.Title"), icon: "fa-solid fa-skull" },
    position: { width: 400 },
    content,
    rejectClose: false,
    buttons: [
      {
        action: "roll",
        label: loc("EXPCRIT.Dialog.Roll"),
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: (event, button) => {
          const el = button.form.elements;
          const hit = el.hitLocation?.value ?? hitLocation;
          return {
            type: el.damageType.value,
            source: el.source.value,
            modifier: parseInt(el.modifier.value) || 0,
            hitLocation: hit,
            tableLocation: askLocation ? HIT_LOCATIONS.find(([k]) => k === hit)?.[1] : tableLocation
          };
        }
      },
      { action: "system", label: loc("EXPCRIT.Dialog.SystemTable"), icon: "fa-solid fa-xmark", callback: () => "system" }
    ]
  });

  if (result && typeof result === "object") await game.settings.set(MODULE_ID, "lastDamageType", result.type);
  return result ?? null;
}

/* -------------------------------------------- */
/*  Rolling                                     */
/* -------------------------------------------- */

let originalFormatChatRoll = null;

/**
 * Roll one Expanded Criticals chart through the system's own formatChatRoll, and post
 * the result to chat when the system returns HTML (critical items post themselves).
 */
export async function rollCritical({ tableLocation, hitLocation, type, source = columnSource(), modifier = 0, messageId } = {}) {
  if (!TABLE_LOCATIONS.includes(tableLocation) || !DAMAGE_TYPES.includes(type)) throw new Error(`${MODULE_ID} | bad critical request ${tableLocation}/${type}`);
  const key = `crit${tableLocation}`;
  const column = `${source}-${type}`;
  if (!game.wfrp4e.tables.findTable(key, column)) {
    ui.notifications.warn(loc("EXPCRIT.Error.NoTable", { key, column }));
    return null;
  }
  const options = { modifier, showRoll: true, messageId, criticalLocation: hitLocation, [SKIP]: true };
  const html = await game.wfrp4e.tables.formatChatRoll(key, options, column);
  if (!foundry.utils.isEmpty(html)) {
    const chatData = game.wfrp4e.utility.chatDataSetup(html, game.settings.get("core", "rollMode"), true);
    await ChatMessage.create(chatData);
  }
  return html;
}

/** Macro entry point: dialog with hit location, then roll. */
export async function openCriticalDialog({ modifier = 0, hitLocation = "body", item = null } = {}) {
  const choice = await promptCritical({ askLocation: true, hitLocation, modifier, item });
  if (!choice || choice === "system") return null;
  return rollCritical(choice);
}

/** Wrapper around WFRP_Tables.formatChatRoll(table, options, column). */
async function formatChatRollWrapper(wrapped, table, options = {}, column = undefined, ...rest) {
  try {
    if (column || options?.[SKIP] || !game.settings.get(MODULE_ID, "promptOnCrit")) return wrapped(table, options, column, ...rest);
    const tableLocation = critTableLocation(table);
    if (!tableLocation || !worldHasCharts(tableLocation)) return wrapped(table, options, column, ...rest);

    const hitLocation = options.criticalLocation ?? hitLocationFromMessage(options.messageId);
    const choice = await promptCritical({ tableLocation, hitLocation, modifier: options.modifier ?? 0, messageId: options.messageId });
    if (choice === null) return null; // window closed: no roll
    if (choice === "system") return wrapped(table, options, column, ...rest);

    const key = `crit${tableLocation}`;
    const newColumn = `${choice.source}-${choice.type}`;
    if (!game.wfrp4e.tables.findTable(key, newColumn)) {
      ui.notifications.warn(loc("EXPCRIT.Error.NoTable", { key, column: newColumn }));
      return wrapped(table, options, column, ...rest);
    }
    // Same options the system built (modifier, showRoll, messageId); only the column changes.
    const newOptions = { ...options, modifier: choice.modifier, criticalLocation: options.criticalLocation ?? hitLocation, [SKIP]: true };
    return wrapped(key, newOptions, newColumn, ...rest);
  }
  catch (err) {
    console.error(`${MODULE_ID} | critical picker failed, using system table`, err);
    return wrapped(table, options, column, ...rest);
  }
}

Hooks.once("setup", () => {
  const tables = game.wfrp4e?.tables;
  if (!tables?.formatChatRoll) {
    console.warn(`${MODULE_ID} | game.wfrp4e.tables.formatChatRoll not found; critical picker disabled.`);
  }
  else if (game.modules.get("lib-wrapper")?.active && globalThis.libWrapper) {
    globalThis.libWrapper.register(MODULE_ID, "game.wfrp4e.tables.formatChatRoll", formatChatRollWrapper, "MIXED");
  }
  else {
    originalFormatChatRoll = tables.formatChatRoll;
    tables.formatChatRoll = function (...args) {
      return formatChatRollWrapper(originalFormatChatRoll.bind(this), ...args);
    };
  }

  const module = game.modules.get(MODULE_ID);
  module.api = { DAMAGE_TYPES, promptCritical, rollCritical, openCriticalDialog, guessDamageType, itemFromMessage, columnSource, systemUsesUiA, critTableLocation };
});
