/**
 * Antares | Expanded Criticals [WFRP4E]
 *
 * Critical modifier bookkeeping:
 *  - records which effect script changed a Test's Critical modifier, so the
 *    chart dialog can show a breakdown (Savagery +10, Core-Rulebook +20 ...);
 *  - works out every other modifier that will reach the roll (Critical Mitigation,
 *    the wound-Critical link value, `wfrp4e:rollTable` listeners such as the
 *    Mutant's Handbook wound-Critical markers);
 *  - implements the system homebrew "Critical Mitigation" (setting
 *    `homebrew.mooCriticalMitigation`) for naturally rolled Criticals: -10 per AP
 *    at the hit location, a negative result means no Critical Wound, and the
 *    outermost armour layer loses 1 AP once the Critical has been resolved.
 */

const MODULE_ID = "artantares-advanced-criticals";
const ARMOUR_QUERY = `${MODULE_ID}.mitigationArmour`;
const FLAG = "mitigationArmour";
const MARK = "/*amut-crit ";

const L = (k) => game.i18n.localize(k);
const F = (k, d) => game.i18n.format(k, d);
const safe = (fn) => { try { return fn(); } catch { return undefined; } };
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function homebrew() {
  return safe(() => game.settings.get("wfrp4e", "homebrew")) ?? {};
}

export function mitigationActive() {
  return !!homebrew().mooCriticalMitigation;
}

function locationName(loc) {
  const label = safe(() => game.wfrp4e.config.locations[loc]) ?? loc;
  return game.i18n.localize(label);
}

/** "critrArm" -> "arm" (same mapping as the system's generalizeTable). */
function tableLocationOf(key) {
  const k = safe(() => game.wfrp4e.tables.generalizeTable(key)) ?? key ?? "";
  return String(k).replace(/^crit/, "");
}

function critModifier(result) {
  const t = result?.tables?.critical;
  return t && typeof t === "object" ? num(t.modifier) : null;
}

function scriptLabel(script) {
  const ctx = script.context ?? {};
  const name = ctx.effect?.name ?? ctx.item?.name;
  const label = script.label;
  const base = String(name ?? "").split(" (")[0];
  if (name && label && base && !String(label).includes(base)) return `${name}: ${label}`;
  return label || name || L("EXPCRIT.Breakdown.Effect");
}

// --------------------------------------------------------------------------------------------
// Recording (runs on the rolling client while the Test is computed)

/** Wraps WarhammerScript#execute: records the change each script makes to the Critical modifier. */
function executeWrapper(wrapped, args, ...rest) {
  const result = args?.test?.result;
  const before = result ? critModifier(result) : null;
  const out = wrapped(args, ...rest);
  if (result) {
    try {
      const after = critModifier(result);
      if (after !== null && after !== (before ?? 0)) {
        (result.expcritSources ??= []).push({ label: scriptLabel(this), value: after - (before ?? 0) });
      }
    } catch (err) { /* never break a Test for bookkeeping */ }
  }
  return out;
}

/** Wraps TestWFRP#postTest: snapshots the Critical modifier before the system's Critical Mitigation replaces it. */
async function postTestWrapper(wrapped, ...args) {
  const m = critModifier(this.result);
  if (m !== null) this.result.expcritPre = m;
  return wrapped(...args);
}

// --------------------------------------------------------------------------------------------
// Breakdown

/**
 * Modifier lines for one chart roll.
 * @returns {{lines: object[], natural: boolean, mitigation: object|null}}
 *   lines: {label, value, kind} — kind "hook" lines are re-added by their listener at roll time.
 */
export function critBreakdown({ tableLocation, hitLocation, messageId, linkModifier = 0 } = {}) {
  const lines = [];
  let mitigation = null;
  let natural = false;
  const message = messageId ? game.messages.get(messageId) : null;
  const test = message ? safe(() => message.system?.test) : null;
  const result = test?.result;
  const critTable = result?.tables?.critical;

  if (result && critTable && (!tableLocation || tableLocationOf(critTable.key) === tableLocation)) {
    // Naturally rolled Critical (attack / Test result)
    natural = true;
    const sources = Array.isArray(result.expcritSources) ? result.expcritSources : [];
    let sum = 0;
    for (const s of sources) {
      lines.push({ label: s.label, value: num(s.value), kind: "effect" });
      sum += num(s.value);
    }
    const systemMitigated = (result.other ?? []).some((o) => String(o).includes("applyCriticalDeflection"));
    let pre = result.expcritPre;
    if (pre === undefined || pre === null) pre = systemMitigated ? sum : num(linkModifier);
    const rest = num(pre) - sum;
    if (rest) lines.push({ label: L("EXPCRIT.Breakdown.TestOther"), value: rest, kind: "test" });

    if (mitigationActive()) {
      const target = safe(() => test.targets?.[0]);
      const loc = result.hitloc?.result ?? hitLocation;
      if (!target) {
        lines.push({ label: L("EXPCRIT.Breakdown.MitigationNoTarget"), value: 0, kind: "mitigation" });
      } else {
        const ap = num(safe(() => target.status.armour[loc].value));
        mitigation = { ap, value: -10 * ap, actorUuid: target.uuid, actorName: target.name, loc };
        lines.push({
          label: F("EXPCRIT.Breakdown.Mitigation", { ap, location: locationName(loc), name: target.name }),
          value: -10 * ap,
          kind: "mitigation"
        });
      }
    }
  } else if (num(linkModifier)) {
    let label = L("EXPCRIT.Breakdown.Link");
    if (message && !result) {
      // Wound Critical (at / reduced to 0 Wounds) posted with the damage message
      const hb = homebrew();
      const uia = !!safe(() => game.settings.get("wfrp4e", "uiaCrits"));
      const per = num(hb.uiaCritsMod) || 10;
      if (uia && linkModifier > 0) label = F("EXPCRIT.Breakdown.UiAWounds", { n: Math.round(linkModifier / per), per });
      else if (hb.mooCritModifiers) label = L("EXPCRIT.Breakdown.MooWounds");
      else if (num(linkModifier) === -20) label = L("EXPCRIT.Breakdown.BelowTB");
      else label = L("EXPCRIT.Breakdown.Wounds");
    }
    lines.push({ label, value: num(linkModifier), kind: "link" });
  }
  return { lines, natural, mitigation };
}

/** Effect markers used by the Mutant's Handbook module (`/*amut-crit {...} *\/`). */
function mutationMarkerLines(messageId, loc) {
  const message = game.messages.get(messageId);
  const opposed = safe(() => message?.system?.opposedTest);
  if (!opposed) return [];
  const out = [];
  const scan = (actor, side, who) => {
    if (!actor) return;
    for (const effect of safe(() => [...actor.allApplicableEffects()]) ?? []) {
      if (effect.disabled || effect.isSuppressed) continue;
      for (const s of effect.system?.scriptData ?? []) {
        const src = String(s.script ?? "");
        if (!src.startsWith(MARK)) continue;
        const o = safe(() => JSON.parse(src.slice(MARK.length, src.lastIndexOf("*/"))));
        if (!o || o.side !== side) continue;
        if (o.loc && loc && o.loc !== loc) continue;
        out.push({ label: `${effect.name} (${who})`, value: num(o.n), kind: "hook" });
      }
    }
  };
  scan(safe(() => opposed.attackerTest.actor), "dealt", L("EXPCRIT.Breakdown.Attacker"));
  scan(safe(() => opposed.defenderTest.actor), "taken", L("EXPCRIT.Breakdown.Defender"));
  return out;
}

/**
 * Dry-runs every `wfrp4e:rollTable` listener on a copy of the options to find what it will add at roll time.
 * @returns {object[]} lines of kind "hook"
 */
export function probeHookModifiers(tableKey, options = {}, column) {
  const out = [];
  const listeners = safe(() => Hooks.events?.["wfrp4e:rollTable"]) ?? [];
  for (const h of listeners) {
    const fn = h?.fn ?? h;
    if (typeof fn !== "function") continue;
    const probe = { ...foundry.utils.deepClone({ ...options }), modifier: num(options.modifier) };
    const before = probe.modifier;
    try { fn({ tableKey, options: probe, column }); } catch { continue; }
    const delta = num(probe.modifier) - before;
    if (!delta) continue;
    if (fn.name === "critHookModifier") {
      const marks = mutationMarkerLines(options.messageId, String(tableKey).replace(/^crit/, ""));
      if (marks.reduce((a, l) => a + l.value, 0) === delta) { out.push(...marks); continue; }
      out.push({ label: L("EXPCRIT.Breakdown.Mutations"), value: delta, kind: "hook" });
      continue;
    }
    out.push({ label: F("EXPCRIT.Breakdown.Hook", { name: fn.name || "?" }), value: delta, kind: "hook" });
  }
  return out;
}

// --------------------------------------------------------------------------------------------
// "No Critical Wound" card

/** If `html` is the system's "Roll: X - canceled" text, returns X. */
export function cancelledRoll(html) {
  if (typeof html !== "string") return null;
  const parts = game.i18n.format("TABLE.Cancel", { result: "\u0001" }).split("\u0001");
  const text = html.trim();
  if (parts.length !== 2 || !text.startsWith(parts[0]) || !text.endsWith(parts[1])) return null;
  return text.slice(parts[0].length, text.length - parts[1].length);
}

export function noCriticalCard(rollText, mitigation) {
  const total = safe(() => Roll.safeEval(String(rollText)));
  if (Number.isFinite(total) && String(total) !== String(rollText).trim()) rollText = `${rollText} = ${total}`;
  return `<div class="expcrit-no-crit"><p><strong>${L("EXPCRIT.Mitigation.Title")}</strong></p>`
    + `<p>${F("EXPCRIT.Mitigation.NoCrit", { roll: rollText, ap: mitigation.ap, name: mitigation.actorName, location: locationName(mitigation.loc) })}</p></div>`;
}

// --------------------------------------------------------------------------------------------
// Armour damage

/**
 * Outermost physical layer at a location. Armour is worn leather under mail under plate, so the
 * layer with the "heaviest" armour type is outermost; among equals the last listed layer.
 */
const ARMOUR_RANK = { softLeather: 1, boiledLeather: 2, mail: 3, plate: 4 };
function outermostArmour(actor, loc) {
  const items = safe(() => actor.physicalNonDamagedArmourAtLocation(loc)) ?? [];
  let best = null;
  let bestRank = -1;
  for (const item of items) {
    const rank = ARMOUR_RANK[item.system?.armorType?.value] ?? 0;
    if (rank >= bestRank) { best = item; bestRank = rank; }
  }
  return best;
}

async function damageArmourLocal({ actorUuid, loc, messageId, markOnly = false } = {}) {
  const message = messageId ? game.messages.get(messageId) : null;
  if (message?.getFlag(MODULE_ID, FLAG)) return { already: true };
  let damaged = null;
  if (!markOnly) {
    const actor = await fromUuid(actorUuid);
    const target = actor?.actor ?? actor;
    if (!target) return { error: "no-actor" };
    const armour = outermostArmour(target, loc);
    const type = L("EXPCRIT.Mitigation.Title");
    const speaker = ChatMessage.getSpeaker({ actor: target });
    if (!armour) {
      await ChatMessage.create({ content: `<p>${F("EXPCRIT.Mitigation.NoArmour", { name: target.name, location: locationName(loc) })}</p>`, speaker });
    } else {
      await armour.system.damageItem(1, [loc]);
      damaged = armour.uuid;
      await ChatMessage.create({
        content: `<p>${F("CHAT.DamageToArmour", { item: `@UUID[${armour.uuid}]{${armour.name}}`, type })}</p>`,
        speaker
      });
    }
  }
  if (message && (game.user.isGM || message.isOwner)) await message.setFlag(MODULE_ID, FLAG, true);
  return { ok: true, damaged };
}

/** Routes the armour damage to the active GM (the target is usually not owned by the rolling player). */
async function requestArmour(payload) {
  if (game.user.isGM) return damageArmourLocal(payload);
  const gm = game.users.activeGM;
  if (gm) {
    try { return await gm.query(ARMOUR_QUERY, payload, { timeout: 30000 }); }
    catch (err) { console.warn(`${MODULE_ID} | armour query failed`, err); }
  }
  const actor = payload.actorUuid ? await fromUuid(payload.actorUuid) : null;
  if (payload.markOnly || actor?.isOwner) return damageArmourLocal(payload);
  ui.notifications.warn(L("EXPCRIT.Mitigation.NoGM"));
  return { error: "no-gm" };
}

/** Damages the outermost armour layer by 1 AP once the mitigated Critical is resolved (once per Test). */
export async function applyMitigationArmour(mitigation, messageId) {
  if (!mitigation?.ap || !mitigation.actorUuid) return null;
  const message = messageId ? game.messages.get(messageId) : null;
  if (message?.getFlag(MODULE_ID, FLAG)) {
    ui.notifications.info(L("EXPCRIT.Mitigation.Already"));
    return { already: true };
  }
  return requestArmour({ actorUuid: mitigation.actorUuid, loc: mitigation.loc, messageId });
}

/** The system's "Critical Mitigation: Damage AP" button must not damage armour a second time. */
function guardSystemButton() {
  const cls = CONFIG.ChatMessage.dataModels?.test;
  const original = cls?.onApplyCriticalDeflection;
  if (typeof original !== "function" || original.__expcrit) return;
  const guarded = async function (event, ...rest) {
    const message = this.parent;
    if (mitigationActive() && message?.getFlag?.(MODULE_ID, FLAG)) {
      ui.notifications.info(L("EXPCRIT.Mitigation.Already"));
      return;
    }
    const count = game.messages.size;
    const out = await original.call(this, event, ...rest);
    if (mitigationActive() && message && game.messages.size > count) await requestArmour({ messageId: message.id, markOnly: true });
    return out;
  };
  guarded.__expcrit = true;
  cls.onApplyCriticalDeflection = guarded;
}

// --------------------------------------------------------------------------------------------

export function registerCritModifiers() {
  CONFIG.queries[ARMOUR_QUERY] = async (payload = {}) => {
    if (!game.user.isGM) return { error: "not-gm" };
    return damageArmourLocal(payload);
  };
  const lw = globalThis.libWrapper;
  const wrap = (target, fn, type) => {
    try {
      if (lw) lw.register(MODULE_ID, target, fn, type);
      else {
        const path = target.split(".");
        const key = path.pop();
        const owner = path.reduce((o, k) => o?.[k], globalThis);
        const orig = owner?.[key];
        if (typeof orig === "function") owner[key] = function (...a) { return fn.call(this, orig.bind(this), ...a); };
      }
    } catch (err) { console.warn(`${MODULE_ID} | could not wrap ${target}`, err); }
  };
  if (globalThis.warhammer?.apps?.WarhammerScript) wrap("warhammer.apps.WarhammerScript.prototype.execute", executeWrapper, "WRAPPER");
  if (game.wfrp4e?.rolls?.TestWFRP) wrap("game.wfrp4e.rolls.TestWFRP.prototype.postTest", postTestWrapper, "WRAPPER");
  guardSystemButton();
}
