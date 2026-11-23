/**
 * Antares | Expanded Criticals [WFRP4E]
 *
 * Critical chart picker. When a Critical link for a hit location is clicked
 * (damage card, attack card, Critical Cast menu, /table crithead ...), the
 * WFRP4e system calls game.wfrp4e.tables.formatChatRoll(table, options, column).
 * We wrap that function: if the table is crithead/critarm/critbody/critleg and
 * no column was requested, we ask which Expanded Criticals chart (damage type)
 * to use, then hand the call back to the system with column
 * "<core|uia>-<type>". The dialog lists every modifier that reaches the roll
 * (crit-modifiers.mjs); the system's link modifier is never applied twice and
 * rollTable listeners (e.g. Mutant's Handbook) are shown but left to add their
 * own share, so the roll always equals the total shown.
 */

import { registerCritTestSettings, critTestApi } from "./crit-tests.mjs";
import { critBreakdown, probeHookModifiers, mitigationActive, cancelledRoll, noCriticalCard, applyMitigationArmour, registerCritModifiers } from "./crit-modifiers.mjs";

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
  registerCritTestSettings();

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

/** Signed number for display ("+10", "-30", "0"). */
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Modifier lines for the dialog: system/link/effect/mitigation lines (critBreakdown) and
 * `wfrp4e:rollTable` listener lines (probeHookModifiers), which those listeners add again at roll time.
 */
function breakdownFor({ tableLocation, hitLocation, messageId, linkModifier, askLocation }) {
  const base = askLocation ? { lines: [], natural: false, mitigation: null }
    : critBreakdown({ tableLocation, hitLocation, messageId, linkModifier });
  const sent = base.lines.reduce((a, l) => a + l.value, 0);
  const hooks = tableLocation ? probeHookModifiers(`crit${tableLocation}`, { modifier: sent, messageId, criticalLocation: hitLocation }) : [];
  return { ...base, lines: [...base.lines, ...hooks], hookDelta: hooks.reduce((a, l) => a + l.value, 0) };
}

/**
 * Ask for damage type, column and modifier, showing every modifier that reaches the roll.
 * @returns {Promise<object|"system"|null>} the choice, "system" (Cancel: use system table) or null (window closed).
 *   choice.modifier is the total shown in the dialog; choice.hookDelta the part `wfrp4e:rollTable` listeners add themselves.
 */
export async function promptCritical({ tableLocation = null, hitLocation = null, modifier = 0, messageId = null, askLocation = false, item = null } = {}) {
  item ??= itemFromMessage(messageId);
  const guessed = guessDamageType(item);
  const defaultType = guessed ?? game.settings.get(MODULE_ID, "lastDamageType") ?? "cutting";
  const source = columnSource();
  const uia = systemUsesUiA();
  const linkModifier = Number(modifier) || 0;

  const typeOptions = DAMAGE_TYPES.map((t) => `<option value="${t}" ${t === defaultType ? "selected" : ""}>${esc(loc(`EXPCRIT.Type.${t}`))}</option>`).join("");
  const columnOptions = ["core", "uia"].map((c) => `<option value="${c}" ${c === source ? "selected" : ""}>${esc(loc(`EXPCRIT.Column.${c}`))}</option>`).join("");
  const currentHit = hitLocation ?? tableLocation ?? "body";
  const locationOptions = HIT_LOCATIONS.map(([key]) => `<option value="${key}" ${key === currentHit ? "selected" : ""}>${esc(game.wfrp4e?.config?.locations?.[key] ? loc(game.wfrp4e.config.locations[key]) : key)}</option>`).join("");
  const tableLocFor = (hit) => (askLocation ? HIT_LOCATIONS.find(([k]) => k === hit)?.[1] : tableLocation);

  let breakdown = breakdownFor({ tableLocation: tableLocFor(currentHit), hitLocation: currentHit, messageId, linkModifier, askLocation });
  // The macro has no link: its modifier argument becomes the starting manual adjustment.
  const manualStart = askLocation ? linkModifier : 0;

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
      <fieldset class="expcrit-breakdown">
        <legend>${esc(loc("EXPCRIT.Breakdown.Title"))}</legend>
        <ol class="expcrit-lines" style="list-style:none;margin:0;padding:0"></ol>
        <div class="form-group">
          <label>${esc(loc("EXPCRIT.Dialog.Modifier"))}</label>
          <div class="form-fields"><input type="number" name="modifier" step="1" value="${manualStart}"></div>
        </div>
        <div class="expcrit-total" style="display:flex;justify-content:space-between;border-top:1px solid var(--color-border-light-primary, #999);padding-top:4px;font-weight:bold">
          <span>${esc(loc("EXPCRIT.Breakdown.Total"))}</span><span data-total></span>
        </div>
        <p class="hint" data-formula></p>
        <p class="hint" data-mitigation-hint></p>
      </fieldset>
    </div>`;

  const manualOf = (form) => parseInt(form?.elements?.modifier?.value) || 0;
  const totalOf = (form) => breakdown.lines.reduce((a, l) => a + l.value, 0) + manualOf(form);

  const refresh = (form, recompute = false) => {
    if (!form) return;
    const hit = form.elements.hitLocation?.value ?? hitLocation;
    if (recompute) breakdown = breakdownFor({ tableLocation: tableLocFor(hit), hitLocation: hit, messageId, linkModifier, askLocation });
    const manual = manualOf(form);
    const rows = breakdown.lines.map((l) => ({ label: l.label, value: l.value, hint: l.kind === "hook" ? loc("EXPCRIT.Breakdown.AtRoll") : "" }));
    if (manual) rows.push({ label: loc("EXPCRIT.Breakdown.Manual"), value: manual });
    if (!rows.length) rows.push({ label: loc("EXPCRIT.Breakdown.None"), value: 0 });
    form.querySelector(".expcrit-lines").innerHTML = rows.map((r) =>
      `<li style="display:flex;justify-content:space-between;gap:8px" data-value="${r.value}"><span>${esc(r.label)}${r.hint ? ` <em class="hint">(${esc(r.hint)})</em>` : ""}</span><span>${signed(r.value)}</span></li>`).join("");
    const total = totalOf(form);
    form.querySelector("[data-total]").textContent = signed(total);
    const key = `crit${tableLocFor(hit)}`;
    const column = `${form.elements.source.value}-${form.elements.damageType.value}`;
    const table = game.wfrp4e.tables.findTable(key, column);
    form.querySelector("[data-formula]").textContent = loc("EXPCRIT.Breakdown.Formula", {
      formula: table?.formula ?? "1d100", total: total >= 0 ? `+ ${total}` : `- ${-total}`, table: table?.name ?? `${key} (${column})`
    });
    form.querySelector("[data-mitigation-hint]").textContent = breakdown.mitigation?.ap ? loc("EXPCRIT.Breakdown.MitigationHint") : "";
  };

  const DialogV2 = foundry.applications.api.DialogV2;
  const result = await DialogV2.wait({
    window: { title: loc("EXPCRIT.Dialog.Title"), icon: "fa-solid fa-skull" },
    position: { width: 440 },
    content,
    rejectClose: false,
    render: (event, dialog) => {
      const form = (dialog?.element ?? event?.target?.element)?.querySelector("form") ?? dialog?.element?.querySelector?.(".expcrit-dialog")?.closest("form");
      if (!form) return;
      refresh(form);
      form.elements.modifier.addEventListener("input", () => refresh(form));
      form.elements.source.addEventListener("change", () => refresh(form));
      form.elements.damageType.addEventListener("change", () => refresh(form));
      form.elements.hitLocation?.addEventListener("change", () => refresh(form, true));
    },
    buttons: [
      {
        action: "roll",
        label: loc("EXPCRIT.Dialog.Roll"),
        icon: "fa-solid fa-dice-d20",
        default: true,
        callback: (event, button) => {
          const form = button.form;
          const el = form.elements;
          const hit = el.hitLocation?.value ?? hitLocation;
          if (askLocation && hit !== currentHit) breakdown = breakdownFor({ tableLocation: tableLocFor(hit), hitLocation: hit, messageId, linkModifier, askLocation });
          return {
            type: el.damageType.value,
            source: el.source.value,
            modifier: totalOf(form),
            manual: manualOf(form),
            hookDelta: breakdown.hookDelta,
            natural: breakdown.natural,
            mitigation: breakdown.mitigation,
            lines: breakdown.lines,
            hitLocation: hit,
            tableLocation: tableLocFor(hit)
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
export async function rollCritical({ tableLocation, hitLocation, type, source = columnSource(), modifier = 0, hookDelta = 0, messageId } = {}) {
  if (!TABLE_LOCATIONS.includes(tableLocation) || !DAMAGE_TYPES.includes(type)) throw new Error(`${MODULE_ID} | bad critical request ${tableLocation}/${type}`);
  const key = `crit${tableLocation}`;
  const column = `${source}-${type}`;
  if (!game.wfrp4e.tables.findTable(key, column)) {
    ui.notifications.warn(loc("EXPCRIT.Error.NoTable", { key, column }));
    return null;
  }
  // `modifier` is the dialog total; rollTable listeners add their share (hookDelta) again themselves.
  const options = { modifier: (Number(modifier) || 0) - (Number(hookDelta) || 0), showRoll: true, messageId, criticalLocation: hitLocation, [SKIP]: true };
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
    // Same options the system built (showRoll, messageId); the column changes and the modifier becomes the
    // dialog total minus what rollTable listeners add themselves, so the roll equals the total shown.
    // Critical Mitigation (natural Criticals only): below the chart minimum means no Critical Wound.
    const mitigation = choice.natural && choice.mitigation?.ap > 0 && mitigationActive() ? choice.mitigation : null;
    const newOptions = {
      ...options,
      modifier: choice.modifier - (choice.hookDelta || 0),
      criticalLocation: options.criticalLocation ?? hitLocation,
      [SKIP]: true,
      ...(mitigation ? { cancelUnderMin: true } : {})
    };
    let html = await wrapped(key, newOptions, newColumn, ...rest);
    if (mitigation) {
      const cancelled = cancelledRoll(html);
      if (cancelled !== null) {
        // Post the "no Critical Wound" card now so it precedes the armour damage message.
        await ChatMessage.create(game.wfrp4e.utility.chatDataSetup(noCriticalCard(cancelled, mitigation), game.settings.get("core", "rollMode"), true));
        html = null;
      }
      // The Critical is resolved (posted or cancelled): the outermost armour layer loses 1 AP.
      await applyMitigationArmour(mitigation, options.messageId);
    }
    return html;
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
    globalThis.libWrapper.ignore_conflicts?.(MODULE_ID, ["artantares-mutations", "wfrp4e-automated-miscasts"], "game.wfrp4e.tables.formatChatRoll");
  }
  else {
    originalFormatChatRoll = tables.formatChatRoll;
    tables.formatChatRoll = function (...args) {
      return formatChatRollWrapper(originalFormatChatRoll.bind(this), ...args);
    };
  }

  registerCritModifiers();

  const module = game.modules.get(MODULE_ID);
  module.api = { DAMAGE_TYPES, promptCritical, rollCritical, openCriticalDialog, guessDamageType, itemFromMessage, columnSource, systemUsesUiA, critTableLocation, critBreakdown, mitigationActive, ...critTestApi };
});
